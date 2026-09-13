import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PackSku } from "@grailhaus/shared";
import { packsService } from "../services/packsService";

/** No single-pack endpoint exists — reuses the same `["packs", "all"]` catalog
 * query Home/Drops/DropDetail already share (see useDropDetailViewModel.ts) and
 * picks out the one sku by id. */
export function usePackDetailViewModel(skuId: string) {
  const query = useQuery({ queryKey: ["packs", "all"], queryFn: () => packsService.list() });
  const sku = useMemo<PackSku | null>(() => query.data?.find((s) => s.id === skuId) ?? null, [query.data, skuId]);
  return { sku, isLoading: query.isLoading, error: query.error ? (query.error as Error).message : null };
}
