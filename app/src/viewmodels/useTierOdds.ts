import { useMemo } from "react";
import type { PackSku, RarityTier } from "@grailhaus/shared";

export interface TierOddsRow {
  tier: RarityTier;
  percent: number;
}

/**
 * The published odds for a sku's last slot, highest rarity first — the one
 * number every tier is required to show before a purchase (per the mockup's
 * own "every tier publishes its odds" trust line). Generalized out of what
 * was inline in DropDetailScreen so Pack/Vault Detail can show the identical
 * bars without a second implementation.
 */
export function useTierOdds(sku: PackSku | null): TierOddsRow[] {
  return useMemo(() => {
    if (!sku) return [];
    const finalSlot = sku.slotProbabilities[sku.slotProbabilities.length - 1] ?? null;
    if (!finalSlot) return [];
    return sku.rarityTiers
      .slice()
      .sort((a, b) => b.level - a.level)
      .map((tier) => ({ tier, percent: finalSlot.probabilities[tier.level] ?? 0 }));
  }, [sku]);
}
