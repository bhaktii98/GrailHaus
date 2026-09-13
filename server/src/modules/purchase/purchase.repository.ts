import type { Pool, PoolClient } from "pg";
import type { OwnershipWeightCurve, OwnershipWeightTable } from "@grailhaus/shared";
import { pool } from "../../db/pool.js";
import { computeDropOccurrence } from "../packs/dropRecurrence.js";
import type { PurchaseResultPayload, PurchaseRow } from "./purchase.types.js";

/** Everything below takes either the shared `pool` or a single checked-out `PoolClient` —
 * the claim step runs on the pool (it's one statement, no transaction needed); everything
 * that must see a consistent, locked view of the world runs on the same `client` inside
 * the purchase transaction in purchase.service.ts. */
type Queryable = Pool | PoolClient;

/** The idempotency claim: exactly one caller for a given key ever gets a row back. Everyone
 * else — including replays of this exact request — finds it via findByIdempotencyKey instead. */
export async function claimPurchase(
  idempotencyKey: string,
  userId: string,
  packId: string,
  quantity: number
): Promise<PurchaseRow | null> {
  const { rows } = await pool.query<PurchaseRow>(
    `insert into public.purchases (idempotency_key, user_id, pack_id, quantity, status)
     values ($1, $2, $3, $4, 'pending')
     on conflict (idempotency_key) do nothing
     returning *`,
    [idempotencyKey, userId, packId, quantity]
  );
  return rows[0] ?? null;
}

export async function findByIdempotencyKey(idempotencyKey: string): Promise<PurchaseRow | null> {
  const { rows } = await pool.query<PurchaseRow>("select * from public.purchases where idempotency_key = $1", [
    idempotencyKey,
  ]);
  return rows[0] ?? null;
}

export async function findPurchaseById(purchaseId: string): Promise<PurchaseRow | null> {
  const { rows } = await pool.query<PurchaseRow>("select * from public.purchases where id = $1", [purchaseId]);
  return rows[0] ?? null;
}

/** Locks the user's balance row for the rest of the transaction — every other purchase by
 * this same user blocks here until this one commits or rolls back. */
export async function lockProfileBalance(client: PoolClient, userId: string): Promise<number> {
  const { rows } = await client.query<{ balance_cents: string }>(
    "select balance_cents from public.profiles where id = $1 for update",
    [userId]
  );
  if (rows.length === 0) throw new Error(`Profile not found for user ${userId}`);
  return Number(rows[0].balance_cents);
}

/** Locks the pack's row — every concurrent purchase of this SKU serializes here, which is
 * the entire no-oversell guarantee: whoever gets the lock next re-reads the post-commit
 * stock, not a stale value. */
export interface LockedPack {
  priceCents: number;
  stockRemaining: number | null;
  maxStock: number | null;
  goesLiveAt: string | null;
  endsAt: string | null;
  /** 0=Sunday..6=Saturday. Null/empty = not a recurring drop — `goesLiveAt`/`endsAt` above are
   * the real, authoritative window in that case. See purchase.service.ts's own recurrence
   * handling for why a recurring drop can't use those two columns for its live/ended check. */
  recurrenceWeekdays: number[] | null;
  recurrenceTimeUtc: string | null;
  recurrenceDurationMinutes: number | null;
}

export async function lockPackForPurchase(client: PoolClient, packId: string): Promise<LockedPack> {
  const { rows } = await client.query<{
    price_cents: string;
    stock_remaining: number | null;
    max_stock: number | null;
    goes_live_at: string | null;
    ends_at: string | null;
    restock_amount: number | null;
    restock_interval_seconds: number | null;
    last_restocked_at: string | null;
    recurrence_weekdays: number[] | null;
    recurrence_time_utc: string | null;
    recurrence_duration_minutes: number | null;
    recurrence_last_reset_at: string | null;
  }>(
    `select price_cents, stock_remaining, max_stock, goes_live_at, ends_at,
            restock_amount, restock_interval_seconds, last_restocked_at,
            recurrence_weekdays, recurrence_time_utc, recurrence_duration_minutes, recurrence_last_reset_at
     from public.packs where id = $1 for update`,
    [packId]
  );
  if (rows.length === 0) throw new Error(`Pack not found: ${packId}`);
  const pack = rows[0];
  let stockRemaining = pack.stock_remaining;
  let goesLiveAt = pack.goes_live_at;
  let endsAt = pack.ends_at;

  // Lazy restock catch-up (PRD §19 — evergreen packs "restock after inventory is depleted"):
  // computed and persisted right here, under the same lock a purchase already needs, rather
  // than a background scheduler — there's no cron/worker process in this stack, and every
  // purchase already passes through this exact lock. Advances `last_restocked_at` by whole
  // interval multiples (not to `now()`) so restock ticks stay on a fixed grid regardless of
  // how long it's been since anyone last bought from this pack.
  if (
    pack.restock_amount != null &&
    pack.restock_interval_seconds != null &&
    pack.max_stock != null &&
    stockRemaining != null &&
    stockRemaining < pack.max_stock
  ) {
    const lastRestockedMs = pack.last_restocked_at ? new Date(pack.last_restocked_at).getTime() : Date.now();
    const ticksOwed = Math.floor((Date.now() - lastRestockedMs) / (pack.restock_interval_seconds * 1000));
    if (ticksOwed > 0) {
      stockRemaining = Math.min(pack.max_stock, stockRemaining + ticksOwed * pack.restock_amount);
      const advancedTo = new Date(lastRestockedMs + ticksOwed * pack.restock_interval_seconds * 1000);
      await client.query("update public.packs set stock_remaining = $2, last_restocked_at = $3 where id = $1", [
        packId,
        stockRemaining,
        advancedTo,
      ]);
    }
  }

  // A recurring drop's *actual* live window is never the static goes_live_at/ends_at columns —
  // those are only ever set once, by whoever configured the very first non-recurring version of
  // this pack (or left null), and are never touched again once recurrence takes over (see
  // packs.service.ts's resolveDropWindow, which already computes the real window for GET
  // /packs — this is that same computation, done again here so the *purchase* path can't be
  // tricked by a stale/irrelevant static timestamp into allowing a buy outside every real
  // occurrence, or blocking one inside a real occurrence). Recomputed fresh under this same
  // row lock, so it can't race against a concurrent recurrence-config edit either.
  const hasRecurrence =
    pack.recurrence_weekdays != null &&
    pack.recurrence_weekdays.length > 0 &&
    pack.recurrence_time_utc != null &&
    (pack.recurrence_duration_minutes ?? 0) > 0;
  if (hasRecurrence) {
    const occurrence = computeDropOccurrence(
      { weekdays: pack.recurrence_weekdays!, timeUtc: pack.recurrence_time_utc!, durationMinutes: pack.recurrence_duration_minutes! },
      new Date()
    );
    if (occurrence) {
      goesLiveAt = occurrence.goesLiveAt.toISOString();
      endsAt = occurrence.endsAt.toISOString();
      if (occurrence.phase === "live") {
        // Same lazy-restock-on-read idea as above, just for a recurring drop's own per-
        // occurrence stock reset instead of an evergreen pack's continuous trickle — see
        // packs.repository.ts's resetStockForNewOccurrence for the read-path's version of this
        // exact guard (only actually resets once per occurrence, not on every purchase).
        const alreadyReset =
          pack.recurrence_last_reset_at != null &&
          new Date(pack.recurrence_last_reset_at).getTime() >= occurrence.goesLiveAt.getTime();
        if (!alreadyReset && pack.max_stock != null) {
          stockRemaining = pack.max_stock;
          await client.query(
            "update public.packs set stock_remaining = $2, recurrence_last_reset_at = $3 where id = $1",
            [packId, stockRemaining, occurrence.goesLiveAt.toISOString()]
          );
        }
      }
    }
  }

  return {
    priceCents: Number(pack.price_cents),
    stockRemaining,
    maxStock: pack.max_stock,
    goesLiveAt,
    endsAt,
    recurrenceWeekdays: pack.recurrence_weekdays,
    recurrenceTimeUtc: pack.recurrence_time_utc,
    recurrenceDurationMinutes: pack.recurrence_duration_minutes,
  };
}

export async function getOwnershipCounts(
  client: Queryable,
  userId: string,
  itemIds: string[]
): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};
  const { rows } = await client.query<{ item_id: string; count: string }>(
    "select item_id, count(*) as count from public.owned_items where user_id = $1 and item_id = any($2) group by item_id",
    [userId, itemIds]
  );
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.item_id] = Number(row.count);
  return counts;
}

/** Reads the admin-editable duplicate-weight table (Duplicate Weights page in the admin
 * dashboard) and reshapes it into what `resolveItems` expects. Falls back to whatever rows
 * exist per category — if a category has no rows yet, the caller's own default kicks in. */
export async function getOwnershipWeightTable(client: Queryable): Promise<Partial<OwnershipWeightTable>> {
  const { rows } = await client.query<{ category: string; copies_owned: number; weight_percent: string }>(
    "select category, copies_owned, weight_percent from public.ownership_weight_tiers order by category, copies_owned"
  );
  const byCategory = new Map<string, { copies: number; weight: number }[]>();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push({ copies: row.copies_owned, weight: Number(row.weight_percent) / 100 });
    byCategory.set(row.category, list);
  }

  const table: Partial<OwnershipWeightTable> = {};
  for (const [category, entries] of byCategory) {
    const sorted = [...entries].sort((a, b) => a.copies - b.copies);
    if (sorted.length === 0) continue;
    const floorEntry = sorted[sorted.length - 1];
    const curve: OwnershipWeightCurve = {
      byCopies: sorted.slice(0, -1).map((e) => e.weight),
      floor: floorEntry.weight,
    };
    table[category] = curve;
  }
  return table;
}

export async function getPressureState(client: Queryable, userId: string, packId: string): Promise<number> {
  const { rows } = await client.query<{ consecutive_without_qualifying: number }>(
    "select consecutive_without_qualifying from public.user_pressure_state where user_id = $1 and pack_id = $2",
    [userId, packId]
  );
  return rows[0]?.consecutive_without_qualifying ?? 0;
}

export async function upsertPressureState(
  client: Queryable,
  userId: string,
  packId: string,
  consecutiveWithoutQualifying: number
): Promise<void> {
  await client.query(
    `insert into public.user_pressure_state (user_id, pack_id, consecutive_without_qualifying, updated_at)
     values ($1, $2, $3, now())
     on conflict (user_id, pack_id)
     do update set consecutive_without_qualifying = excluded.consecutive_without_qualifying, updated_at = now()`,
    [userId, packId, consecutiveWithoutQualifying]
  );
}

/** Returns the new `owned_items.id` per input item, same order as `itemIds` — a multi-row
 * `INSERT ... VALUES ... RETURNING` reflects rows back in the order they were listed, which is
 * what lets the caller pair each id back up with the pulled item at that same position (an
 * ordinary lookup by `item_id` alone can't do this: one pull can pull the same catalog item
 * more than once). */
export async function insertOwnedItems(
  client: PoolClient,
  purchaseId: string,
  userId: string,
  packId: string,
  itemIds: string[]
): Promise<string[]> {
  if (itemIds.length === 0) return [];
  const values: string[] = [];
  const params: unknown[] = [];
  itemIds.forEach((itemId, i) => {
    const base = i * 4;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, now())`);
    params.push(userId, itemId, packId, purchaseId);
  });
  const { rows } = await client.query<{ id: string }>(
    `insert into public.owned_items (user_id, item_id, pack_id, purchase_id, acquired_at) values ${values.join(", ")} returning id`,
    params
  );
  return rows.map((row) => row.id);
}

export async function decrementStock(client: PoolClient, packId: string, quantity: number): Promise<void> {
  // `stock_remaining - $2` on a null column stays null — unlimited (evergreen) SKUs need no branch.
  await client.query("update public.packs set stock_remaining = stock_remaining - $2 where id = $1", [
    packId,
    quantity,
  ]);
}

export async function debitBalance(client: PoolClient, userId: string, amountCents: number): Promise<void> {
  await client.query("update public.profiles set balance_cents = balance_cents - $2 where id = $1", [
    userId,
    amountCents,
  ]);
}

export async function markPurchaseCompleted(
  client: PoolClient,
  purchaseId: string,
  totalPriceCents: number,
  result: PurchaseResultPayload
): Promise<void> {
  await client.query(
    `update public.purchases
     set status = 'completed', total_price_cents = $2, result = $3, completed_at = now()
     where id = $1`,
    [purchaseId, totalPriceCents, JSON.stringify(result)]
  );
}

export async function markPurchaseFailed(client: Queryable, purchaseId: string, reason: string): Promise<void> {
  await client.query(
    "update public.purchases set status = 'failed', failure_reason = $2, completed_at = now() where id = $1",
    [purchaseId, reason]
  );
}
