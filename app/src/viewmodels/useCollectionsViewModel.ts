import { useMemo } from "react";
import type { Category } from "@grailhaus/shared";
import { useDiscoverAllCategoriesViewModel, type DiscoverItem } from "./useDiscoverViewModel";

export interface CatalogCollectionGroup {
  key: string;
  label: string;
  items: DiscoverItem[];
  categories: Category[];
  minValueCents: number;
  maxValueCents: number;
}

/**
 * Discover's third door — "a collection isn't a category," some (confirmed against the live
 * catalog, e.g. "GrailHaus: Velocity") span more than one category. Built off
 * `useDiscoverAllCategoriesViewModel`'s merged `allItems` across every real category (not a
 * hardcoded cards/watches pair), grouped here by `item.detail.collection` instead of by
 * Pokémon/brand identity. No new endpoint — `collection` is a real column on every catalog row
 * already fetched by `/items`.
 */
export function useCollectionsViewModel() {
  const { isLoading, allItems, refetch } = useDiscoverAllCategoriesViewModel();

  const groups = useMemo<CatalogCollectionGroup[]>(() => {
    const map = new Map<string, DiscoverItem[]>();
    for (const item of allItems) {
      const key = item.detail.collection ?? "Uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()]
      .map(([key, items]) => ({
        key,
        label: key,
        items,
        categories: [...new Set(items.map((i) => i.detail.category))],
        minValueCents: Math.min(...items.map((i) => i.detail.currentValueCents)),
        maxValueCents: Math.max(...items.map((i) => i.detail.currentValueCents)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allItems]);

  return {
    isLoading,
    groups,
    totalItemCount: allItems.length,
    refetch,
  };
}
