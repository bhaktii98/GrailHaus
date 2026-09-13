import { pullPack } from "@grailhaus/shared";
import type { PackSku, PressureRule, RarityTierLevel } from "@grailhaus/shared";
import { pool } from "./db";

/**
 * Real expected value: probability × the actual average of this pack's own
 * catalog items at that tier — not the category-wide rarity-tier value
 * range midpoint. That approximation (shared/src/economics.ts) badly
 * overstates cheap packs and understates expensive ones whenever a
 * category's packs deliberately use different value sub-ranges per tier
 * (a Street Rip Grail vs. a Black Label Grail), which is exactly our case.
 *
 * This is deliberately the *no-pity* number: a single isolated pull's odds, exactly as configured
 * in `slot_probabilities`, with no streak history. It's what a first-time buyer sees, and it's
 * still useful as a baseline — but see `computeSteadyStateEvForAllPacks` below for the number
 * that actually predicts what a repeat buyer costs, which is what pressure_rules affects.
 */
export async function computeRealEvCents(packId: string): Promise<number> {
  const [items, slots] = await Promise.all([
    pool.query<{ rarity_tier_level: number; avg_cents: string }>(
      "select rarity_tier_level, avg(base_value_cents) as avg_cents from public.items where pack_id = $1 group by rarity_tier_level",
      [packId]
    ),
    pool.query<{ rarity_tier_level: number; probability_percent: string }>(
      "select rarity_tier_level, probability_percent from public.slot_probabilities where pack_id = $1",
      [packId]
    ),
  ]);

  const avgByTier = new Map<number, number>(items.rows.map((r) => [r.rarity_tier_level, Number(r.avg_cents)]));

  let evCents = 0;
  for (const row of slots.rows) {
    evCents += (Number(row.probability_percent) / 100) * (avgByTier.get(row.rarity_tier_level) ?? 0);
  }
  return Math.round(evCents);
}

export async function computeRealEvForAllPacks(): Promise<Map<string, number>> {
  const [items, slots] = await Promise.all([
    pool.query<{ pack_id: string; rarity_tier_level: number; avg_cents: string }>(
      "select pack_id, rarity_tier_level, avg(base_value_cents) as avg_cents from public.items group by pack_id, rarity_tier_level"
    ),
    pool.query<{ pack_id: string; rarity_tier_level: number; probability_percent: string }>(
      "select pack_id, rarity_tier_level, probability_percent from public.slot_probabilities"
    ),
  ]);

  const avgByPackTier = new Map<string, number>();
  for (const row of items.rows) {
    avgByPackTier.set(`${row.pack_id}_${row.rarity_tier_level}`, Number(row.avg_cents));
  }

  const evByPack = new Map<string, number>();
  for (const row of slots.rows) {
    const avg = avgByPackTier.get(`${row.pack_id}_${row.rarity_tier_level}`) ?? 0;
    const contribution = (Number(row.probability_percent) / 100) * avg;
    evByPack.set(row.pack_id, (evByPack.get(row.pack_id) ?? 0) + contribution);
  }

  for (const [id, cents] of evByPack) evByPack.set(id, Math.round(cents));
  return evByPack;
}

export interface SteadyStateEv {
  /** A single isolated pull, no streak history — identical to `computeRealEvForAllPacks`. */
  noPityCents: number;
  /** The number that actually matters: average payout over a long run of consecutive pulls,
   * carrying the pity streak forward exactly like a real repeat buyer's `user_pressure_state`
   * does across purchases. Equal to `noPityCents` for a pack with no `pressure_rules` rows. */
  withPityCents: number;
}

/** How many consecutive pulls to simulate per pack when estimating the pity system's steady-state
 * cost — long enough to cycle through several pity-guarantee windows (Street Rip's fires roughly
 * every 5-10 non-qualifying pulls) so the average isn't dominated by whatever streak phase the
 * simulation happened to start on. Pure in-memory math, not a DB call, so this is cheap even at
 * this size — the whole simulation across every pack still finishes in well under a second. */
const PITY_SIM_PULLS = 4000;

interface PressureRuleRow {
  pack_id: string;
  qualifying_min_tier: number;
  steps_without_qualifying: number;
  effect_type: "bonus_percent" | "guarantee_min_tier";
  target_tier_level: number;
  effect_value: number | null;
  applies_to_final_slot_only: boolean;
}

/**
 * The no-pity EV above is exactly wrong for any pack with `pressure_rules` (Grail Pressure /
 * Curator's Guarantee): pity is a *streak* mechanic, so its cost only shows up once you simulate
 * a realistic run of consecutive pulls, not one isolated pull. A real repeat buyer — exactly who
 * a pack like Street Rip is designed for — walks the pity ladder and periodically hits the
 * guaranteed-Grail floor, which the no-pity number can't see at all. This was the actual, real
 * gap that made the Overview page's "Est. EV" look healthy while real repeat buyers ran the
 * platform at a loss.
 *
 * Simulates `PITY_SIM_PULLS` consecutive pulls of each pack, carrying the pressure streak forward
 * across pulls exactly like the real purchase flow does via `user_pressure_state`, using the real
 * `pullPack()` from `@grailhaus/shared`'s rewardEngine.ts — the identical function the actual
 * `/purchase` endpoint runs, so this estimate can never drift from what a real purchase actually
 * does. Tier *value* still uses each tier's average (not a full item-value simulation): pity only
 * changes which tier gets rolled, not the spread of values within a tier, so averaging there keeps
 * the estimate low-variance without needing tens of thousands of iterations.
 */
export async function computeSteadyStateEvForAllPacks(): Promise<Map<string, SteadyStateEv>> {
  const [items, slots, rules] = await Promise.all([
    pool.query<{ pack_id: string; rarity_tier_level: number; avg_cents: string }>(
      "select pack_id, rarity_tier_level, avg(base_value_cents) as avg_cents from public.items group by pack_id, rarity_tier_level"
    ),
    pool.query<{ pack_id: string; slot_position: number; rarity_tier_level: number; probability_percent: string }>(
      "select pack_id, slot_position, rarity_tier_level, probability_percent from public.slot_probabilities"
    ),
    pool.query<PressureRuleRow>(
      `select pack_id, qualifying_min_tier, steps_without_qualifying, effect_type, target_tier_level,
              effect_value, applies_to_final_slot_only
       from public.pressure_rules`
    ),
  ]);

  const avgByPackTier = new Map<string, number>();
  for (const row of items.rows) avgByPackTier.set(`${row.pack_id}_${row.rarity_tier_level}`, Number(row.avg_cents));

  const slotsByPack = new Map<string, PackSku["slotProbabilities"]>();
  for (const row of slots.rows) {
    const list = slotsByPack.get(row.pack_id) ?? [];
    let slot = list.find((s) => s.slotPosition === row.slot_position);
    if (!slot) {
      slot = { slotPosition: row.slot_position, probabilities: { 1: 0, 2: 0, 3: 0 } };
      list.push(slot);
    }
    slot.probabilities[row.rarity_tier_level as RarityTierLevel] = Number(row.probability_percent);
    slotsByPack.set(row.pack_id, list);
  }

  const rulesByPack = new Map<string, PressureRule[]>();
  for (const row of rules.rows) {
    const list = rulesByPack.get(row.pack_id) ?? [];
    list.push({
      qualifyingMinTier: row.qualifying_min_tier as RarityTierLevel,
      stepsWithoutQualifying: row.steps_without_qualifying,
      effectType: row.effect_type,
      targetTierLevel: row.target_tier_level as RarityTierLevel,
      effectValue: row.effect_value,
      appliesToFinalSlotOnly: row.applies_to_final_slot_only,
    });
    rulesByPack.set(row.pack_id, list);
  }

  const result = new Map<string, SteadyStateEv>();
  for (const [packId, slotProbabilities] of slotsByPack) {
    const avgForTier = (tier: RarityTierLevel) => avgByPackTier.get(`${packId}_${tier}`) ?? 0;

    let noPityCents = 0;
    for (const slot of slotProbabilities) {
      for (const tier of [1, 2, 3] as const) {
        noPityCents += (slot.probabilities[tier] / 100) * avgForTier(tier);
      }
    }

    const pressureRules = rulesByPack.get(packId) ?? [];
    let withPityCents = noPityCents;
    if (pressureRules.length > 0) {
      // Only the fields pullPack() actually reads — id/itemCount/slotProbabilities/pressureRules
      // — are real; the rest of PackSku isn't needed for a pull roll, so it's asserted rather
      // than filled with meaningless placeholder values just to satisfy the wider shape.
      const simPack = {
        id: packId,
        itemCount: slotProbabilities.length,
        slotProbabilities,
        pressureRules,
      } as unknown as PackSku;

      let consecutive = 0;
      let totalValueCents = 0;
      for (let i = 0; i < PITY_SIM_PULLS; i++) {
        const { tierLevels, nextPressureState } = pullPack(simPack, {
          packId,
          consecutiveWithoutQualifying: consecutive,
        });
        consecutive = nextPressureState.consecutiveWithoutQualifying;
        for (const tier of tierLevels) totalValueCents += avgForTier(tier);
      }
      withPityCents = totalValueCents / PITY_SIM_PULLS;
    }

    result.set(packId, { noPityCents: Math.round(noPityCents), withPityCents: Math.round(withPityCents) });
  }
  return result;
}

export async function computeSteadyStateEvCents(packId: string): Promise<SteadyStateEv> {
  const all = await computeSteadyStateEvForAllPacks();
  return all.get(packId) ?? { noPityCents: 0, withPityCents: 0 };
}
