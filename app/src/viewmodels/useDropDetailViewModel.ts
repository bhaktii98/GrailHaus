import { useMemo } from "react";
import { useDropsViewModel } from "./useDropsViewModel";

/** No single-pack endpoint exists — reuses the same `["packs", "all"]`
 * catalog Home/Drops already fetch and picks out the one drop by id. */
export function useDropDetailViewModel(packId: string) {
  const { drops, isLoading, error } = useDropsViewModel();
  const drop = useMemo(() => drops.find((d) => d.sku.id === packId) ?? null, [drops, packId]);
  return { drop, isLoading, error };
}
