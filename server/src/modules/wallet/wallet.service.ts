import { pool } from "../../db/pool.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.js";
import {
  claimTopup,
  creditBalance,
  findTopupByIdempotencyKey,
  lockProfileBalance,
  markTopupCompleted,
} from "./wallet.repository.js";
import type { WalletTopupRow } from "./wallet.types.js";

/** Sandbox economy, not a real payment processor (none exists anywhere in this stack) — these
 * bounds exist purely so a fat-fingered or malicious amount can't push balance_cents somewhere
 * absurd, not to model a real funding limit. */
const MIN_TOPUP_CENTS = 100; // $1
const MAX_TOPUP_CENTS = 1_000_000_00; // $1,000,000

/** Same trust window as purchase.service.ts's STALE_PENDING_MS — how long a 'pending' row is
 * assumed to still be genuinely in-flight before a retry is allowed to resume it itself. */
const STALE_PENDING_MS = 15_000;

export interface WalletTopupResponse {
  topupId: string;
  status: "completed" | "failed" | "pending";
  amountCents: number;
  newBalanceCents: number | null;
  failureReason: string | null;
}

function toResponse(row: WalletTopupRow): WalletTopupResponse {
  return {
    topupId: row.id,
    status: row.status,
    amountCents: Number(row.amount_cents),
    newBalanceCents: row.new_balance_cents != null ? Number(row.new_balance_cents) : null,
    failureReason: row.failure_reason,
  };
}

/**
 * The one top-up path. `idempotencyKey` is client-generated and reused across retries of the
 * same attempt — see wallet.repository.ts's claimTopup for the actual dedupe mechanism (a
 * unique-index insert, not application logic), the exact same shape purchase.service.ts already
 * established for the debit side.
 */
export async function topUp(userId: string, idempotencyKey: string, amountCents: number): Promise<WalletTopupResponse> {
  if (!Number.isInteger(amountCents) || amountCents < MIN_TOPUP_CENTS || amountCents > MAX_TOPUP_CENTS) {
    throw new BadRequestError(
      `amountCents must be a whole number between ${MIN_TOPUP_CENTS} and ${MAX_TOPUP_CENTS}`
    );
  }

  const claimed = await claimTopup(idempotencyKey, userId, amountCents);
  if (claimed) return executeTopup(claimed);

  const existing = await findTopupByIdempotencyKey(idempotencyKey);
  if (!existing) {
    throw new ConflictError("Top-up is being processed — retry shortly.");
  }
  if (existing.user_id !== userId) {
    // Globally unique by design — this can only mean a client reused someone else's key, never
    // a legitimate retry. Refuse rather than leak.
    throw new ConflictError("Idempotency key already in use.");
  }
  if (existing.status !== "pending") {
    return toResponse(existing);
  }
  const ageMs = Date.now() - new Date(existing.created_at).getTime();
  if (ageMs < STALE_PENDING_MS) {
    return toResponse(existing);
  }
  // Stale: whoever claimed this crashed before reaching a terminal state. Safe to resume —
  // executeTopup re-locks and re-checks the row's status itself before doing anything, so two
  // retries racing into this branch at once still can't double-credit.
  return executeTopup(existing);
}

export async function getTopupByIdempotencyKey(userId: string, idempotencyKey: string): Promise<WalletTopupResponse> {
  const row = await findTopupByIdempotencyKey(idempotencyKey);
  if (!row || row.user_id !== userId) {
    throw new NotFoundError("No top-up found for that idempotency key");
  }
  return toResponse(row);
}

async function executeTopup(claim: WalletTopupRow): Promise<WalletTopupResponse> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Re-check under lock: if another attempt already finished this exact top-up (the
    // stale-recovery race), don't redo the work — just hand back what it did.
    const { rows: current } = await client.query<WalletTopupRow>(
      "select * from public.wallet_topups where id = $1 for update",
      [claim.id]
    );
    if (current[0]?.status !== "pending") {
      await client.query("COMMIT");
      return toResponse(current[0] ?? claim);
    }

    // Locked even though a credit never needs to check sufficiency — the lock is what
    // guarantees a top-up and a concurrent purchase (or another top-up) by the same user can
    // never interleave into a wrong final balance.
    await lockProfileBalance(client, claim.user_id);
    const newBalanceCents = await creditBalance(client, claim.user_id, Number(claim.amount_cents));
    await markTopupCompleted(client, claim.id, newBalanceCents);

    await client.query("COMMIT");
    return {
      topupId: claim.id,
      status: "completed",
      amountCents: Number(claim.amount_cents),
      newBalanceCents,
      failureReason: null,
    };
  } catch (err) {
    // Matches purchase.service.ts's own executePurchase exactly: an unexpected error just rolls
    // back and rethrows, leaving the row 'pending' rather than guessing at a failure_reason here
    // — the stale-pending-retry path above (topUp's own ageMs check) is what picks it back up.
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
