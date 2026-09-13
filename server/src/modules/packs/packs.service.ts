import type { Category, PackItem, PackSku, PressureRule, RarityTier, RarityTierLevel, SlotProbability } from "@grailhaus/shared";
import type { PackRow } from "./packs.types.js";
import { computeDropOccurrence } from "./dropRecurrence.js";
import {
  findItemsForPacks,
  findPackById,
  findPacks,
  findPressureRulesForPacks,
  findRarityTiers,
  findSlotProbabilitiesForPacks,
  resetStockForNewOccurrence,
} from "./packs.repository.js";

type DropPhase = PackSku["phase"];

interface DropWindow {
  goesLiveAt: string | null;
  endsAt: string | null;
  stockRemaining: number | null;
  phase: DropPhase;
}

function phaseForStaticWindow(goesLiveAtMs: number | null, endsAtMs: number | null, stockRemaining: number | null, nowMs: number): DropPhase {
  if (goesLiveAtMs != null && nowMs < goesLiveAtMs) return "soon";
  if (endsAtMs != null && nowMs >= endsAtMs) return "closed";
  if (stockRemaining != null && stockRemaining <= 0) return "closed";
  return "live";
}

/**
 * The one place a pack's `goesLiveAt`/`endsAt`/`stockRemaining`/`phase` get decided — a plain
 * evergreen pack or one-off drop just reports its stored columns (phase computed off the server
 * clock, same math the app used to do on-device); a recurring drop (recurrence_weekdays set)
 * instead reports whichever occurrence is live-or-next, restocking to `max_stock` the first time
 * any request notices a new occurrence has begun (see resetStockForNewOccurrence's own doc
 * comment for why that's safe to call from every read of a live recurring drop, not just once).
 */
async function resolveDropWindow(pack: PackRow, now: Date): Promise<DropWindow> {
  const hasRecurrence = pack.recurrence_weekdays != null && pack.recurrence_weekdays.length > 0 && pack.recurrence_time_utc != null && (pack.recurrence_duration_minutes ?? 0) > 0;

  if (!hasRecurrence) {
    const goesLiveAtMs = pack.goes_live_at ? new Date(pack.goes_live_at).getTime() : null;
    const endsAtMs = pack.ends_at ? new Date(pack.ends_at).getTime() : null;
    return {
      goesLiveAt: pack.goes_live_at,
      endsAt: pack.ends_at,
      stockRemaining: pack.stock_remaining,
      phase: phaseForStaticWindow(goesLiveAtMs, endsAtMs, pack.stock_remaining, now.getTime()),
    };
  }

  const occurrence = computeDropOccurrence(
    { weekdays: pack.recurrence_weekdays!, timeUtc: pack.recurrence_time_utc!, durationMinutes: pack.recurrence_duration_minutes! },
    now
  );
  // Malformed rule (shouldn't happen — the admin API validates before saving) — fall back to
  // the stored static columns rather than a broken response.
  if (!occurrence) {
    const goesLiveAtMs = pack.goes_live_at ? new Date(pack.goes_live_at).getTime() : null;
    const endsAtMs = pack.ends_at ? new Date(pack.ends_at).getTime() : null;
    return {
      goesLiveAt: pack.goes_live_at,
      endsAt: pack.ends_at,
      stockRemaining: pack.stock_remaining,
      phase: phaseForStaticWindow(goesLiveAtMs, endsAtMs, pack.stock_remaining, now.getTime()),
    };
  }

  if (occurrence.phase === "soon") {
    return {
      goesLiveAt: occurrence.goesLiveAt.toISOString(),
      endsAt: occurrence.endsAt.toISOString(),
      // Whatever's left from the previous occurrence — informational only; "soon" already
      // blocks purchase regardless of this number.
      stockRemaining: pack.stock_remaining,
      phase: "soon",
    };
  }

  // "live" — restock once per occurrence, the first time any request notices it's begun.
  const alreadyReset = pack.recurrence_last_reset_at != null && new Date(pack.recurrence_last_reset_at).getTime() >= occurrence.goesLiveAt.getTime();
  let stockRemaining = pack.stock_remaining;
  if (!alreadyReset) {
    await resetStockForNewOccurrence(pack.id, occurrence.goesLiveAt, pack.max_stock ?? 0);
    stockRemaining = pack.max_stock;
  }
  return {
    goesLiveAt: occurrence.goesLiveAt.toISOString(),
    endsAt: occurrence.endsAt.toISOString(),
    stockRemaining,
    phase: stockRemaining != null && stockRemaining <= 0 ? "closed" : "live",
  };
}

/** Shared by `listPacks` (the Shelf) and `getPackSkuById` (the purchase path) — one
 * assembly of a pack's full catalog shape, so there's exactly one place that turns
 * DB rows into the `PackSku` the reward engine consumes. */
async function buildPackSkus(packRows: PackRow[]): Promise<PackSku[]> {
  const packIds = packRows.map((p) => p.id);
  const categories = [...new Set(packRows.map((p) => p.category))];

  const now = new Date();
  const [rarityTierRowLists, itemRows, slotRows, pressureRows, dropWindows] = await Promise.all([
    Promise.all(categories.map((c) => findRarityTiers(c))),
    findItemsForPacks(packIds),
    findSlotProbabilitiesForPacks(packIds),
    findPressureRulesForPacks(packIds),
    Promise.all(packRows.map((pack) => resolveDropWindow(pack, now))),
  ]);
  const dropWindowByPackId = new Map(packRows.map((pack, i) => [pack.id, dropWindows[i]]));

  const rarityTiersByCategory = new Map<string, RarityTier[]>();
  for (const row of rarityTierRowLists.flat()) {
    const list = rarityTiersByCategory.get(row.category) ?? [];
    list.push({
      level: row.tier_level as RarityTierLevel,
      name: row.name,
      colorHex: row.color_hex,
      valueMinCents: Number(row.value_min_cents),
      valueMaxCents: Number(row.value_max_cents),
    });
    rarityTiersByCategory.set(row.category, list);
  }

  return packRows.map((pack) => {
    const itemsByTier: Record<RarityTierLevel, PackItem[]> = { 1: [], 2: [], 3: [] };
    for (const item of itemRows) {
      if (item.pack_id !== pack.id) continue;
      itemsByTier[item.rarity_tier_level as RarityTierLevel].push({
        id: item.id,
        name: item.name,
        rarityTierLevel: item.rarity_tier_level as RarityTierLevel,
        textureUrl: item.texture_url,
        baseValueCents: Number(item.base_value_cents),
      });
    }

    const slotsByPosition = new Map<number, SlotProbability>();
    for (const row of slotRows) {
      if (row.pack_id !== pack.id) continue;
      const slot = slotsByPosition.get(row.slot_position) ?? {
        slotPosition: row.slot_position,
        probabilities: { 1: 0, 2: 0, 3: 0 },
      };
      slot.probabilities[row.rarity_tier_level as RarityTierLevel] = Number(row.probability_percent);
      slotsByPosition.set(row.slot_position, slot);
    }

    const pressureRules: PressureRule[] = pressureRows
      .filter((r) => r.pack_id === pack.id)
      .map((r) => ({
        qualifyingMinTier: r.qualifying_min_tier as RarityTierLevel,
        stepsWithoutQualifying: r.steps_without_qualifying,
        effectType: r.effect_type,
        targetTierLevel: r.target_tier_level as RarityTierLevel,
        effectValue: r.effect_value,
        appliesToFinalSlotOnly: r.applies_to_final_slot_only,
      }));

    return {
      id: pack.id,
      category: pack.category as Category,
      tier: pack.tier,
      name: pack.name,
      priceCents: Number(pack.price_cents),
      itemCount: pack.item_count,
      slotProbabilities: [...slotsByPosition.values()].sort((a, b) => a.slotPosition - b.slotPosition),
      pressureRules,
      rarityTiers: rarityTiersByCategory.get(pack.category) ?? [],
      itemsByTier,
      goesLiveAt: dropWindowByPackId.get(pack.id)!.goesLiveAt,
      endsAt: dropWindowByPackId.get(pack.id)!.endsAt,
      stockRemaining: dropWindowByPackId.get(pack.id)!.stockRemaining,
      maxStock: pack.max_stock,
      recurrenceWeekdays: pack.recurrence_weekdays,
      recurrenceTimeUtc: pack.recurrence_time_utc,
      recurrenceDurationMinutes: pack.recurrence_duration_minutes,
      phase: dropWindowByPackId.get(pack.id)!.phase,
    };
  });
}

export async function listPacks(category?: Category): Promise<PackSku[]> {
  const packRows = await findPacks(category);
  return buildPackSkus(packRows);
}

export async function getPackSkuById(packId: string): Promise<PackSku | null> {
  const packRow = await findPackById(packId);
  if (!packRow) return null;
  const [sku] = await buildPackSkus([packRow]);
  return sku ?? null;
}
