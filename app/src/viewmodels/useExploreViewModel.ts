import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PackSku } from "@grailhaus/shared";
import { packsService } from "../services/packsService";

/** One GET /packs call, split by category client-side rather than N
 * requests. Evergreen only — a pack with a `goesLiveAt` is a timed drop and
 * belongs on the Drops tab (see useDropsViewModel), same rule as Shelf.
 *
 * Keyed by whatever category each SKU actually carries (not a hardcoded cards/watches pair), so
 * a third category's (e.g. handbags) evergreen packs show up in `byCategory` instead of being
 * silently dropped from Explore's own pack-tier sections. */
export function useExploreViewModel() {
  const query = useQuery({
    queryKey: ["packs"],
    queryFn: () => packsService.list(),
  });

  const byCategory = useMemo(() => {
    const evergreen = (query.data ?? []).filter((sku) => sku.goesLiveAt == null);
    const map: Record<string, PackSku[]> = {};
    for (const sku of evergreen) {
      (map[sku.category] ??= []).push(sku);
    }
    return map;
  }, [query.data]);

  return {
    byCategory,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}
