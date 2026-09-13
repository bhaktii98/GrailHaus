import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import type { ItemRow, PackRow, PressureRuleRow, RarityTierRow, SlotProbabilityRow } from "./packs.types.js";

const PACK_COLUMNS =
  "id, category, tier, name, price_cents, item_count, stock_remaining, max_stock, goes_live_at, ends_at, " +
  "recurrence_weekdays, recurrence_time_utc, recurrence_duration_minutes, recurrence_last_reset_at";

export async function findPacks(category?: string): Promise<PackRow[]> {
  if (category) {
    const { rows } = await pool.query<PackRow>(
      `select ${PACK_COLUMNS} from public.packs where category = $1 order by price_cents asc`,
      [category]
    );
    return rows;
  }
  const { rows } = await pool.query<PackRow>(
    `select ${PACK_COLUMNS} from public.packs order by category, price_cents asc`
  );
  return rows;
}

export async function findPackById(packId: string): Promise<PackRow | null> {
  const { rows } = await pool.query<PackRow>(
    `select ${PACK_COLUMNS} from public.packs where id = $1`,
    [packId]
  );
  return rows[0] ?? null;
}

export async function findItemsForPacks(packIds: string[]): Promise<ItemRow[]> {
  if (packIds.length === 0) return [];
  const { rows } = await pool.query<ItemRow>(
    "select id, pack_id, name, rarity_tier_level, texture_url, base_value_cents from public.items where pack_id = any($1)",
    [packIds]
  );
  return rows;
}

export async function findSlotProbabilitiesForPacks(packIds: string[]): Promise<SlotProbabilityRow[]> {
  if (packIds.length === 0) return [];
  const { rows } = await pool.query<SlotProbabilityRow>(
    "select pack_id, slot_position, rarity_tier_level, probability_percent from public.slot_probabilities where pack_id = any($1)",
    [packIds]
  );
  return rows;
}

export async function findPressureRulesForPacks(packIds: string[]): Promise<PressureRuleRow[]> {
  if (packIds.length === 0) return [];
  const { rows } = await pool.query<PressureRuleRow>(
    `select pack_id, qualifying_min_tier, steps_without_qualifying, effect_type, target_tier_level, effect_value, applies_to_final_slot_only
     from public.pressure_rules where pack_id = any($1)`,
    [packIds]
  );
  return rows;
}

export async function findRarityTiers(category?: string): Promise<RarityTierRow[]> {
  if (category) {
    const { rows } = await pool.query<RarityTierRow>(
      "select category, tier_level, name, color_hex, value_min_cents, value_max_cents from public.rarity_tiers where category = $1 order by tier_level",
      [category]
    );
    return rows;
  }
  const { rows } = await pool.query<RarityTierRow>(
    "select category, tier_level, name, color_hex, value_min_cents, value_max_cents from public.rarity_tiers order by category, tier_level"
  );
  return rows;
}

/** Admin-only writes — everything below is used by packs.admin.routes.ts, gated on
 * app.requireAdmin, never by the public-facing packs.routes.ts. */

export interface PackCoreUpdate {
  priceCents?: number;
  itemCount?: number;
  stockRemaining?: number | null;
  maxStock?: number | null;
  /** null = never restocks (a drop's defining trait) — distinct from "leave unchanged," which
   * is what omitting the key entirely means. */
  restockAmount?: number | null;
  restockIntervalSeconds?: number | null;
  /** null = evergreen (available immediately) — a timed date makes it a drop. Ignored for
   * display (but still stored) once `recurrenceWeekdays` turns this into a recurring drop —
   * see packs.service.ts's `applyRecurringDropWindow`. */
  goesLiveAt?: string | null;
  endsAt?: string | null;
  /** 0=Sunday..6=Saturday. Null/empty clears recurrence, turning this back into a plain
   * evergreen/one-off pack using whatever goesLiveAt/endsAt is stored. */
  recurrenceWeekdays?: number[] | null;
  /** "HH:MM" or "HH:MM:SS", UTC. */
  recurrenceTimeUtc?: string | null;
  recurrenceDurationMinutes?: number | null;
}

const CORE_UPDATE_COLUMNS: Record<keyof PackCoreUpdate, string> = {
  priceCents: "price_cents",
  itemCount: "item_count",
  stockRemaining: "stock_remaining",
  maxStock: "max_stock",
  restockAmount: "restock_amount",
  restockIntervalSeconds: "restock_interval_seconds",
  goesLiveAt: "goes_live_at",
  endsAt: "ends_at",
  recurrenceWeekdays: "recurrence_weekdays",
  recurrenceTimeUtc: "recurrence_time_utc",
  recurrenceDurationMinutes: "recurrence_duration_minutes",
};

export async function updatePackCoreFields(client: PoolClient, packId: string, updates: PackCoreUpdate): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const key of Object.keys(CORE_UPDATE_COLUMNS) as (keyof PackCoreUpdate)[]) {
    // `key in updates` (not `updates[key] != null`) is what lets a caller explicitly clear a
    // nullable field — e.g. un-scheduling a drop back to evergreen by sending `goesLiveAt: null`
    // — while a key that's simply absent from the payload stays untouched.
    if (!(key in updates)) continue;
    params.push(updates[key] ?? null);
    sets.push(`${CORE_UPDATE_COLUMNS[key]} = $${params.length}`);
  }
  if (sets.length === 0) return;
  params.push(packId);
  await client.query(`update public.packs set ${sets.join(", ")} where id = $${params.length}`, params);
}

/**
 * Lazily restocks a recurring drop the first time any request notices its current occurrence
 * has begun — see dropRecurrence.ts and packs.service.ts's `applyRecurringDropWindow` for the
 * full picture. The WHERE guard (not just the caller's own check) is what makes this safe to
 * call on every read of a live recurring drop without re-crediting stock on every request: once
 * `recurrence_last_reset_at` reaches `occurrenceStart`, this becomes a no-op until the *next*
 * occurrence's start is a later timestamp.
 */
export async function resetStockForNewOccurrence(packId: string, occurrenceStart: Date, maxStock: number): Promise<void> {
  await pool.query(
    `update public.packs
     set stock_remaining = $1, recurrence_last_reset_at = $2
     where id = $3 and (recurrence_last_reset_at is null or recurrence_last_reset_at < $2)`,
    [maxStock, occurrenceStart.toISOString(), packId]
  );
}

export async function upsertSlotProbability(
  client: PoolClient,
  packId: string,
  slotPosition: number,
  rarityTierLevel: number,
  probabilityPercent: number
): Promise<void> {
  await client.query(
    `insert into public.slot_probabilities (pack_id, slot_position, rarity_tier_level, probability_percent)
     values ($1, $2, $3, $4)
     on conflict (pack_id, slot_position, rarity_tier_level)
     do update set probability_percent = excluded.probability_percent`,
    [packId, slotPosition, rarityTierLevel, probabilityPercent]
  );
}
