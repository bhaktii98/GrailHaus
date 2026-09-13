import { useMemo } from "react";
import type { PackItem, PackSku, RarityTierLevel } from "@grailhaus/shared";
import { useCollectionViewModel } from "./useCollectionViewModel";

export interface TierOwnership {
  /** Every catalog item in this tier (or every tier, if none given), in a stable order. */
  items: PackItem[];
  ownedIds: Set<string>;
  ownedCount: number;
  totalCount: number;
}

/**
 * Real "you hold N / M" data for a tier's collection-preview grid — cross-
 * references the catalog (`sku.itemsByTier`) against what this account
 * actually owns (`/me/portfolio`, via `useCollectionViewModel`), the same
 * source of truth the Portfolio tab itself reads from. No placeholder counts:
 * if the portfolio is still loading, `ownedIds` is simply empty until it
 * resolves.
 */
export function useTierOwnership(sku: PackSku | null, tierLevel?: RarityTierLevel): TierOwnership {
  const { owned } = useCollectionViewModel();

  return useMemo(() => {
    const items = sku
      ? tierLevel != null
        ? (sku.itemsByTier[tierLevel] ?? [])
        : (Object.values(sku.itemsByTier).flat() as PackItem[])
      : [];
    const ownedIds = new Set(owned.map((o) => o.item.id));
    const ownedCount = items.filter((item) => ownedIds.has(item.id)).length;
    return { items, ownedIds, ownedCount, totalCount: items.length };
  }, [sku, tierLevel, owned]);
}
