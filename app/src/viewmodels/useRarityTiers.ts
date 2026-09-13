import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { Category, RarityTier, RarityTierLevel } from "@grailhaus/shared";
import { packsService } from "../services/packsService";

/**
 * Every `PackSku` in a category carries the identical, admin-configured `rarityTiers` array
 * (see server's packs.service.ts — it's read fresh from the `rarity_tiers` table onto every
 * pack row for that category, not per-SKU data). This reads it off the same `["packs",
 * category]` query every other catalog screen already shares, rather than each Discover screen
 * hardcoding its own "Core"/"Prime"/"Grail" name map — those names (and colors) are editable
 * from the admin dashboard's Rarity Tiers page and must never go stale here.
 */
export function useRarityTiers(category: Category): Partial<Record<RarityTierLevel, RarityTier>> {
  const query = useQuery({ queryKey: ["packs", category], queryFn: () => packsService.list(category) });

  return useMemo(() => {
    const tiers = query.data?.[0]?.rarityTiers ?? [];
    const byLevel: Partial<Record<RarityTierLevel, RarityTier>> = {};
    for (const tier of tiers) byLevel[tier.level] = tier;
    return byLevel;
  }, [query.data]);
}

/**
 * The multi-category counterpart to `useRarityTiers` above, for a screen that shows items from
 * more than one category at once (e.g. the Portfolio grid) and so can't fetch off a single
 * hardcoded category — `useQueries` (not a `.map` of `useRarityTiers` calls) is what makes calling
 * a variable, data-dependent number of these safe: React's rules of hooks forbid a component's own
 * hook-call count changing between renders, which a plain loop of `useQuery` calls would do the
 * moment `categories` grows from 0 to N once the categories list itself finishes loading.
 */
export function useRarityTiersByCategory(categories: Category[]): Record<string, Partial<Record<RarityTierLevel, RarityTier>>> {
  const results = useQueries({
    queries: categories.map((category) => ({
      queryKey: ["packs", category],
      queryFn: () => packsService.list(category),
    })),
  });

  return useMemo(() => {
    const out: Record<string, Partial<Record<RarityTierLevel, RarityTier>>> = {};
    categories.forEach((category, i) => {
      const tiers = results[i]?.data?.[0]?.rarityTiers ?? [];
      const byLevel: Partial<Record<RarityTierLevel, RarityTier>> = {};
      for (const tier of tiers) byLevel[tier.level] = tier;
      out[category] = byLevel;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, ...results.map((r) => r.data)]);
}
