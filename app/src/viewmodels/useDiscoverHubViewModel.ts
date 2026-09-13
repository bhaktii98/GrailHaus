import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { packsService } from "../services/packsService";
import { marketplaceService } from "../services/marketplaceService";
import { useCategoriesViewModel } from "./useCategoriesViewModel";

export interface DiscoverHubCategory {
  categoryId: string;
  label: string;
  paletteAccent: string;
  itemCount: number;
  tierCount: number;
  listedNow: number;
}

/**
 * Cheap hub-level counts — real totals straight off `/packs` and `/listings`, without the
 * per-item `/items/:id` fan-out `useDiscoverViewModel` does once you're actually inside a
 * category (the hub only needs sums, not each item's full detail). Keyed by every category in
 * the categories table (not a hardcoded cards/watches pair) via `useQueries` — a plain loop of
 * `useQuery` calls would break React's rules of hooks the moment `categories` grows from 0 to N
 * once the categories list itself finishes loading, same reasoning as useRarityTiersByCategory.
 */
export function useDiscoverHubViewModel() {
  const { categories } = useCategoriesViewModel();

  const packsResults = useQueries({
    queries: categories.map((c) => ({ queryKey: ["packs", c.id], queryFn: () => packsService.list(c.id) })),
  });
  const listingsResults = useQueries({
    queries: categories.map((c) => ({ queryKey: ["listings", c.id], queryFn: () => marketplaceService.browse(c.id) })),
  });

  const byCategory = useMemo<DiscoverHubCategory[]>(
    () =>
      categories.map((c, i) => {
        const packs = packsResults[i]?.data ?? [];
        return {
          categoryId: c.id,
          label: c.label,
          paletteAccent: c.paletteAccent,
          itemCount: packs.reduce((sum, p) => sum + p.itemCount, 0),
          tierCount: packs.length,
          listedNow: (listingsResults[i]?.data ?? []).length,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, ...packsResults.map((r) => r.data), ...listingsResults.map((r) => r.data)]
  );

  async function refetch() {
    await Promise.all([...packsResults.map((r) => r.refetch()), ...listingsResults.map((r) => r.refetch())]);
  }

  return {
    isLoading: packsResults.some((r) => r.isLoading),
    byCategory,
    refetch,
  };
}
