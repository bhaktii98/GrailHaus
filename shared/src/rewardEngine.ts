import type { OwnershipCounts, PackItem, PackSku, PressureRule, PressureState, RarityTierLevel } from "./types.js";

const TIER_LEVELS: RarityTierLevel[] = [1, 2, 3];

function rollTier(probabilities: Record<RarityTierLevel, number>): RarityTierLevel {
  const total = TIER_LEVELS.reduce((sum, level) => sum + (probabilities[level] ?? 0), 0);
  let roll = Math.random() * total;
  for (const level of TIER_LEVELS) {
    roll -= probabilities[level] ?? 0;
    if (roll <= 0) return level;
  }
  return TIER_LEVELS[TIER_LEVELS.length - 1];
}

function applyBonus(
  probabilities: Record<RarityTierLevel, number>,
  targetTier: RarityTierLevel,
  bonusPoints: number
): Record<RarityTierLevel, number> {
  const next = { ...probabilities };
  const available = TIER_LEVELS.filter((l) => l !== targetTier && next[l] > 0);
  const takeableTotal = available.reduce((sum, l) => sum + next[l], 0);
  const actualBonus = Math.min(bonusPoints, takeableTotal);
  if (actualBonus <= 0) return next;
  for (const level of available) {
    next[level] -= actualBonus * (next[level] / takeableTotal);
  }
  next[targetTier] += actualBonus;
  return next;
}

/** Rolls a tier guaranteed to be >= minTier, weighting by the eligible tiers' relative base probabilities. */
function rollAtLeast(
  probabilities: Record<RarityTierLevel, number>,
  minTier: RarityTierLevel
): RarityTierLevel {
  const eligible = TIER_LEVELS.filter((l) => l >= minTier);
  const weights = Object.fromEntries(eligible.map((l) => [l, probabilities[l] ?? 0])) as Record<
    RarityTierLevel,
    number
  >;
  const total = eligible.reduce((sum, l) => sum + weights[l], 0);
  if (total <= 0) return minTier;
  return rollTier(weights);
}

function pickPressureRule(rules: PressureRule[]): RarityTierLevel {
  return rules[0]?.qualifyingMinTier ?? 3;
}

/**
 * Pulls one pack's worth of results. Pure and framework-agnostic — the same
 * function backs both the mobile preview pull and (once it exists) the real
 * server-side /purchase endpoint, so behavior can never drift between them.
 *
 * Interpretive calls made where the product spec was ambiguous (documented
 * here, not silently guessed): pressure thresholds are non-cumulative — the
 * highest threshold met wins, not a sum of every threshold crossed; a
 * `bonus_percent` rule only ever pulls percentage points from tiers below
 * its target (never from a tier already used to satisfy a stricter
 * guarantee); the streak resets only on a pull at/above the pack's
 * qualifying tier, tracked per this one pack SKU — never globally across a
 * user's account or shared across price tiers, which is what would reopen
 * the cross-tier "farm cheap packs, cash in on an expensive one" exploit
 * documented in the loophole audit.
 */
export function pullPack(
  pack: PackSku,
  pressureState: PressureState
): { tierLevels: RarityTierLevel[]; nextPressureState: PressureState } {
  const qualifyingTier = pickPressureRule(pack.pressureRules);
  let consecutive = pressureState.consecutiveWithoutQualifying;
  const tierLevels: RarityTierLevel[] = [];

  const orderedSlots = [...pack.slotProbabilities].sort((a, b) => a.slotPosition - b.slotPosition);

  for (const slot of orderedSlots) {
    const isFinalSlot = slot.slotPosition === pack.itemCount;
    let probabilities = { ...slot.probabilities };

    // Non-cumulative: for each target tier, only the highest met threshold's bonus applies —
    // "+3 at 5, +6 at 8" is a ladder, not +9 stacked at step 8.
    const strongestBonusByTarget = new Map<RarityTierLevel, PressureRule>();
    for (const rule of pack.pressureRules) {
      if (rule.effectType !== "bonus_percent") continue;
      if (consecutive < rule.stepsWithoutQualifying) continue;
      if ((probabilities[rule.targetTierLevel] ?? 0) <= 0) continue;
      const current = strongestBonusByTarget.get(rule.targetTierLevel);
      if (!current || rule.stepsWithoutQualifying > current.stepsWithoutQualifying) {
        strongestBonusByTarget.set(rule.targetTierLevel, rule);
      }
    }
    for (const rule of strongestBonusByTarget.values()) {
      probabilities = applyBonus(probabilities, rule.targetTierLevel, rule.effectValue ?? 0);
    }

    let forcedMinTier: RarityTierLevel | null = null;
    for (const rule of pack.pressureRules) {
      if (rule.effectType !== "guarantee_min_tier") continue;
      if (rule.appliesToFinalSlotOnly && !isFinalSlot) continue;
      if (consecutive < rule.stepsWithoutQualifying) continue;
      if (!forcedMinTier || rule.targetTierLevel > forcedMinTier) forcedMinTier = rule.targetTierLevel;
    }

    const tier = forcedMinTier ? rollAtLeast(probabilities, forcedMinTier) : rollTier(probabilities);
    tierLevels.push(tier);
    consecutive = tier >= qualifyingTier ? 0 : consecutive + 1;
  }

  return {
    tierLevels,
    nextPressureState: { packId: pack.id, consecutiveWithoutQualifying: consecutive },
  };
}

/** One category's ownership-weight ladder: `byCopies[n]` is the weight for owning
 * exactly `n` copies already; `floor` applies from `byCopies.length` copies up. */
export interface OwnershipWeightCurve {
  byCopies: number[];
  floor: number;
}

export type OwnershipWeightTable = Partial<Record<string, OwnershipWeightCurve>>;

/** Used when a category (e.g. one just added via the admin dashboard, with no
 * `ownership_weight_tiers` rows yet) has no curve of its own — a mild, category-agnostic
 * fade rather than a crash or a silent "duplicates never fade" no-op. */
const FALLBACK_OWNERSHIP_CURVE: OwnershipWeightCurve = { byCopies: [1.0, 0.5, 0.25], floor: 0.15 };

/**
 * Personal Duplicate Weight Logic: owning more copies of an item makes it
 * progressively less likely to be selected again — never impossible, never
 * removed from the pool, and never blocked within a single pack (two slots
 * in the same pack can independently land on the same item). Cards fade out
 * faster of a hard floor since they're meant to circulate more (bulk buys,
 * marketplace supply); watches use a steeper drop since a repeat premium
 * watch should be rarer. Weight is `1.0 (base) × ownership modifier` — the
 * base is always 1.0 here since there's no other per-item weighting yet.
 *
 * This is the fallback used when no table is supplied — the real, current
 * values live in the `ownership_weight_tiers` DB table (admin-editable),
 * not here; a caller reading that table passes it into `resolveItems`
 * instead of relying on this default. Kept here anyway so existing callers
 * that don't pass one yet (nothing does, today) still get correct behavior.
 */
export const DEFAULT_OWNERSHIP_WEIGHTS: OwnershipWeightTable = {
  cards: { byCopies: [1.0, 0.5, 0.25], floor: 0.15 },
  watches: { byCopies: [1.0, 0.35, 0.1], floor: 0.05 },
};

function ownershipWeight(table: OwnershipWeightTable, category: PackSku["category"], copiesOwned: number): number {
  const { byCopies, floor } = table[category] ?? FALLBACK_OWNERSHIP_CURVE;
  return copiesOwned < byCopies.length ? byCopies[copiesOwned] : floor;
}

/**
 * Turns rolled tier levels into actual catalog items — one weighted-random
 * pick per tier from that pack's pool. `ownershipCounts` (item id → copies
 * this user already owns) is optional and defaults to empty, which makes
 * every item weight 1.0 (plain uniform selection, today's behavior) — there
 * is currently nowhere ownership is persisted from, so real callers have
 * nothing to pass yet. `weightTable` defaults to `DEFAULT_OWNERSHIP_WEIGHTS`;
 * pass the live `ownership_weight_tiers` DB rows once a caller reads them.
 */
export function resolveItems(
  pack: PackSku,
  tierLevels: RarityTierLevel[],
  ownershipCounts: OwnershipCounts = {},
  weightTable: OwnershipWeightTable = DEFAULT_OWNERSHIP_WEIGHTS
): PackItem[] {
  return tierLevels.map((level) => {
    const pool = pack.itemsByTier[level] ?? [];
    if (pool.length === 0) {
      throw new Error(`No catalog items for ${pack.name} at tier ${level}`);
    }
    const weights = pool.map((item) => ownershipWeight(weightTable, pack.category, ownershipCounts[item.id] ?? 0));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  });
}
