import { DEFAULT_OWNERSHIP_WEIGHTS, pullPack, resolveItems } from "@grailhaus/shared";
import type { OwnershipWeightTable, PackSku, PressureState, PulledItem, PulledOwnedItem } from "@grailhaus/shared";
import { pool } from "../../db/pool.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.js";
import { getPackSkuById } from "../packs/packs.service.js";
import { broadcastStockUpdate } from "../packs/dropBroadcast.js";
import { findItemDetailsByIds } from "../items/items.repository.js";
import { toItemDetail } from "../items/items.service.js";
import {
  claimPurchase,
  debitBalance,
  decrementStock,
  findByIdempotencyKey,
  getOwnershipCounts,
  getOwnershipWeightTable,
  getPressureState,
  insertOwnedItems,
  lockPackForPurchase,
  lockProfileBalance,
  markPurchaseCompleted,
  markPurchaseFailed,
  upsertPressureState,
} from "./purchase.repository.js";
import type { PurchaseRow } from "./purchase.types.js";

/** One item's authoritative position within a purchase — see PurchaseResultPayload. */
type PackCoordinate = { packIndex: number; cardIndex: number };

/** PRD §21 / instructions.md frame this as exactly two purchase modes, not a free 1-10 range:
 * a single pack, or a fixed 10-pack bulk buy. "Buy 7" isn't a real product mode. */
const SINGLE_QUANTITY = 1;
const BULK_QUANTITY = 10;
/** How long a 'pending' row is trusted to still be genuinely in-flight before a retry is
 * allowed to assume the original attempt crashed and pick the purchase back up itself. Well
 * above how long the transaction below ever actually takes. */
const STALE_PENDING_MS = 15_000;

export interface PurchaseResponse {
  purchaseId: string;
  status: "completed" | "failed" | "pending";
  packId: string;
  quantity: number;
  totalPriceCents: number | null;
  failureReason: string | null;
  items: PulledOwnedItem[];
}

/** `purchases.result` stores only the minimal `PulledItem` shape (what the reward engine
 * produced) plus the `owned_items.id` each one got — this is what turns that into the full
 * catalog detail (+ ownership) the reveal screen actually needs, in one batched lookup,
 * preserving the original pull order (reveal pacing depends on it — the reward engine's own
 * reordering already happened before this ever runs). Pairs by array position, not by
 * `item.id` alone, since one pull can pull the same catalog item more than once. */
async function enrichItems(
  pulledItems: PulledItem[],
  ownedItemIds: string[],
  packCoordinates?: PackCoordinate[],
  itemCount?: number
): Promise<PulledOwnedItem[]> {
  if (pulledItems.length === 0) return [];
  const rows = await findItemDetailsByIds(pulledItems.map((item) => item.id));
  const byId = new Map(rows.map((row) => [row.id, toItemDetail(row)]));
  const out: PulledOwnedItem[] = [];
  pulledItems.forEach((item, i) => {
    const detail = byId.get(item.id);
    if (!detail) return;
    // Prefer the stored coordinate; fall back to deriving it positionally for rows written before
    // `packCoordinates` was persisted. The fallback reproduces exactly how the batch was built
    // (pack-sized contiguous slices), so old and new rows describe identical structure.
    const stored = packCoordinates?.[i];
    const derived =
      itemCount && itemCount > 0
        ? { packIndex: Math.floor(i / itemCount), cardIndex: i % itemCount }
        : undefined;
    const coord = stored ?? derived;
    out.push({ ...detail, ownedItemId: ownedItemIds[i], packIndex: coord?.packIndex, cardIndex: coord?.cardIndex });
  });
  return out;
}

async function toResponse(row: PurchaseRow): Promise<PurchaseResponse> {
  // Only needed as a fallback for rows stored before `packCoordinates` existed; a lookup miss
  // just means coordinates stay undefined, which the client already handles positionally.
  let itemCount: number | undefined;
  if (row.result && !row.result.packCoordinates) {
    itemCount = (await getPackSkuById(row.pack_id))?.itemCount;
  }
  return {
    purchaseId: row.id,
    status: row.status === "pending" ? "pending" : row.status,
    packId: row.pack_id,
    quantity: row.quantity,
    totalPriceCents: row.total_price_cents != null ? Number(row.total_price_cents) : null,
    failureReason: row.failure_reason,
    items: await enrichItems(
      row.result?.items ?? [],
      row.result?.ownedItemIds ?? [],
      row.result?.packCoordinates,
      itemCount
    ),
  };
}

/**
 * The one purchase path — evergreen shelf, timed drops, single, and bulk all call this.
 * `idempotencyKey` is client-generated and reused across retries of the same attempt; see
 * purchase.repository.ts's claimPurchase for the actual dedupe mechanism (a unique-index
 * insert, not application logic).
 */
export async function purchase(
  userId: string,
  idempotencyKey: string,
  packId: string,
  quantity: number
): Promise<PurchaseResponse> {
  if (quantity !== SINGLE_QUANTITY && quantity !== BULK_QUANTITY) {
    throw new BadRequestError(`quantity must be ${SINGLE_QUANTITY} (single) or ${BULK_QUANTITY} (bulk)`);
  }

  const packSku = await getPackSkuById(packId);
  if (!packSku) throw new NotFoundError("Pack not found");
  if (quantity === BULK_QUANTITY && packSku.category === "watches") {
    throw new BadRequestError("Watches don't support bulk purchase — one case at a time.");
  }

  const claimed = await claimPurchase(idempotencyKey, userId, packId, quantity);
  if (claimed) return executePurchase(claimed, packSku);

  const existing = await findByIdempotencyKey(idempotencyKey);
  if (!existing) {
    throw new ConflictError("Purchase is being processed — retry shortly.");
  }
  if (existing.user_id !== userId) {
    // The key is globally unique by design (see purchase.repository.ts), so this can only mean
    // a client reused someone else's key — never a legitimate retry. Refuse rather than leak.
    throw new ConflictError("Idempotency key already in use.");
  }
  if (existing.status !== "pending") {
    return await toResponse(existing);
  }
  const ageMs = Date.now() - new Date(existing.created_at).getTime();
  if (ageMs < STALE_PENDING_MS) {
    return await toResponse(existing);
  }
  // Stale: whoever claimed this crashed before reaching a terminal state. Safe to resume —
  // executePurchase re-locks and re-checks the row's status itself before doing anything, so
  // two retries racing into this branch at once still can't double-execute it.
  return executePurchase(existing, packSku);
}

export async function getPurchaseByIdempotencyKey(userId: string, idempotencyKey: string): Promise<PurchaseResponse> {
  const row = await findByIdempotencyKey(idempotencyKey);
  if (!row || row.user_id !== userId) {
    throw new NotFoundError("No purchase found for that idempotency key");
  }
  return toResponse(row);
}


async function executePurchase(claim: PurchaseRow, packSku: PackSku): Promise<PurchaseResponse> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Re-check under lock: if another attempt already finished this exact purchase (the
    // stale-recovery race), don't redo the work — just hand back what it did.
    const { rows: current } = await client.query<PurchaseRow>(
      "select * from public.purchases where id = $1 for update",
      [claim.id]
    );
    if (current[0]?.status !== "pending") {
      await client.query("COMMIT");
      return await toResponse(current[0] ?? claim);
    }

    const balanceCents = await lockProfileBalance(client, claim.user_id);
    const { priceCents, stockRemaining, goesLiveAt, endsAt } = await lockPackForPurchase(client, claim.pack_id);
    const totalCost = priceCents * claim.quantity;
    const now = Date.now();

    if (goesLiveAt != null && new Date(goesLiveAt).getTime() > now) {
      await markPurchaseFailed(client, claim.id, "not_live_yet");
      await client.query("COMMIT");
      return { ...emptyResult(claim), status: "failed", failureReason: "not_live_yet" };
    }
    if (endsAt != null && new Date(endsAt).getTime() <= now) {
      await markPurchaseFailed(client, claim.id, "drop_ended");
      await client.query("COMMIT");
      return { ...emptyResult(claim), status: "failed", failureReason: "drop_ended" };
    }
    if (stockRemaining !== null && stockRemaining < claim.quantity) {
      await markPurchaseFailed(client, claim.id, "insufficient_stock");
      await client.query("COMMIT");
      return { ...emptyResult(claim), status: "failed", failureReason: "insufficient_stock" };
    }
    if (balanceCents < totalCost) {
      await markPurchaseFailed(client, claim.id, "insufficient_funds");
      await client.query("COMMIT");
      return { ...emptyResult(claim), status: "failed", failureReason: "insufficient_funds" };
    }

    const itemIds = Object.values(packSku.itemsByTier).flat().map((item) => item.id);
    const ownershipCounts = await getOwnershipCounts(client, claim.user_id, itemIds);
    const weightOverrides = await getOwnershipWeightTable(client);
    const weightTable: OwnershipWeightTable = {
      cards: weightOverrides.cards ?? DEFAULT_OWNERSHIP_WEIGHTS.cards,
      watches: weightOverrides.watches ?? DEFAULT_OWNERSHIP_WEIGHTS.watches,
    };

    let consecutive = await getPressureState(client, claim.user_id, claim.pack_id);
    const allItems: PulledItem[] = [];
    // The authoritative batch → pack → card structure, recorded as it is generated rather than
    // re-derived later. Nothing about generation changes here: the same pullPack/resolveItems
    // calls in the same order, with Grail Pressure still carried across packs exactly as before.
    const packCoordinates: PackCoordinate[] = [];
    for (let i = 0; i < claim.quantity; i++) {
      const pressureState: PressureState = { packId: claim.pack_id, consecutiveWithoutQualifying: consecutive };
      const { tierLevels, nextPressureState } = pullPack(packSku, pressureState);
      const items = resolveItems(packSku, tierLevels, ownershipCounts, weightTable);
      for (const item of items) ownershipCounts[item.id] = (ownershipCounts[item.id] ?? 0) + 1;
      items.forEach((_, cardIndex) => packCoordinates.push({ packIndex: i, cardIndex }));
      allItems.push(...items);
      consecutive = nextPressureState.consecutiveWithoutQualifying;
    }

    const ownedItemIds = await insertOwnedItems(
      client,
      claim.id,
      claim.user_id,
      claim.pack_id,
      allItems.map((item) => item.id)
    );
    await decrementStock(client, claim.pack_id, claim.quantity);
    await debitBalance(client, claim.user_id, totalCost);
    await upsertPressureState(client, claim.user_id, claim.pack_id, consecutive);
    await markPurchaseCompleted(client, claim.id, totalCost, { items: allItems, ownedItemIds, packCoordinates });

    await client.query("COMMIT");

    // A drop (goesLiveAt set) is the one case with a live screen actually watching this pack's
    // stock count — an evergreen pack has no such screen, so there's nothing to notify. Fired
    // after COMMIT, not before: a socket message implying a purchase happened has to be true.
    if (goesLiveAt != null && stockRemaining !== null) {
      broadcastStockUpdate(claim.pack_id, stockRemaining - claim.quantity);
    }

    return {
      purchaseId: claim.id,
      status: "completed",
      packId: claim.pack_id,
      quantity: claim.quantity,
      totalPriceCents: totalCost,
      failureReason: null,
      items: await enrichItems(allItems, ownedItemIds, packCoordinates, packSku.itemCount),
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function emptyResult(claim: PurchaseRow): PurchaseResponse {
  return {
    purchaseId: claim.id,
    status: "failed",
    packId: claim.pack_id,
    quantity: claim.quantity,
    totalPriceCents: null,
    failureReason: null,
    items: [],
  };
}
