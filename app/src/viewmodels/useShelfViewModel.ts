import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Category } from "@grailhaus/shared";
import { packsService } from "../services/packsService";

/** Shelf shows evergreen stock only — a pack with a `goesLiveAt` is a timed
 * drop and belongs on the Drops tab (see useDropsViewModel), not here. */
export function useShelfViewModel(category: Category) {
  const query = useQuery({
    queryKey: ["packs", category],
    queryFn: () => packsService.list(category),
  });

  const packs = useMemo(() => (query.data ?? []).filter((sku) => sku.goesLiveAt == null), [query.data]);

  return {
    packs,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: () => query.refetch(),
  };
}
