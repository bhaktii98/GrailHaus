import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import type { WalletTopupRow } from "./wallet.types.js";

/** Same idempotency claim shape as purchase.repository.ts's claimPurchase: exactly one caller
 * for a given key ever gets a row back — everyone else, including replays of this exact
 * request, finds it via findByIdempotencyKey instead. */
export async function claimTopup(
  idempotencyKey: string,
  userId: string,
  amountCents: number
): Promise<WalletTopupRow | null> {
  const { rows } = await pool.query<WalletTopupRow>(
    `insert into public.wallet_topups (idempotency_key, user_id, amount_cents, status)
     values ($1, $2, $3, 'pending')
     on conflict (idempotency_key) do nothing
     returning *`,
    [idempotencyKey, userId, amountCents]
  );
  return rows[0] ?? null;
}

export async function findTopupByIdempotencyKey(idempotencyKey: string): Promise<WalletTopupRow | null> {
  const { rows } = await pool.query<WalletTopupRow>(
    "select * from public.wallet_topups where idempotency_key = $1",
    [idempotencyKey]
  );
  return rows[0] ?? null;
}

/** Same lock purchase.repository.ts's lockProfileBalance takes — serializes against any
 * concurrent purchase or top-up by this same user, so a credit and a debit racing each other
 * can never interleave into a wrong final balance. */
export async function lockProfileBalance(client: PoolClient, userId: string): Promise<number> {
  const { rows } = await client.query<{ balance_cents: string }>(
    "select balance_cents from public.profiles where id = $1 for update",
    [userId]
  );
  if (rows.length === 0) throw new Error(`Profile not found for user ${userId}`);
  return Number(rows[0].balance_cents);
}

/** Returns the balance *after* crediting, straight off the same statement — one round trip,
 * and no separate re-read that could race against something else. */
export async function creditBalance(client: PoolClient, userId: string, amountCents: number): Promise<number> {
  const { rows } = await client.query<{ balance_cents: string }>(
    "update public.profiles set balance_cents = balance_cents + $2 where id = $1 returning balance_cents",
    [userId, amountCents]
  );
  return Number(rows[0].balance_cents);
}

export async function markTopupCompleted(client: PoolClient, topupId: string, newBalanceCents: number): Promise<void> {
  await client.query(
    `update public.wallet_topups
     set status = 'completed', new_balance_cents = $2, completed_at = now()
     where id = $1`,
    [topupId, newBalanceCents]
  );
}
