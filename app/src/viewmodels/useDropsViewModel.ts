import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PackSku } from "@grailhaus/shared";
import { packsService } from "../services/packsService";

export type DropPhase = PackSku["phase"];

export interface DropView {
  sku: PackSku;
  phase: DropPhase;
}

/** Tighter than the app's normal 30s staleTime (see state/queryClient.ts) —
 * a live drop's stock/remaining-time is the one place in the app where
 * "polling every 30s" (PRD §29) feels too slow to watch happen. Only kicks
 * in while a drop is actually soon/live; falls back to the default cadence
 * once every drop is closed. */
const LIVE_POLL_MS = 10_000;

/**
 * There's no dedicated `/drops` endpoint — a "drop" is just any `PackSku`
 * with a non-null `goesLiveAt` (see shared/src/types.ts). This fetches the
 * full catalog and reads each drop's soon/live/closed state straight off
 * `sku.phase` — computed server-side (packs.service.ts's `resolveDropWindow`),
 * off the server's own clock, not derived from `goesLiveAt`/`endsAt` here. A
 * recurring drop's `goesLiveAt`/`endsAt` are themselves server-computed (the
 * current-or-next occurrence) for the same reason: this app never runs the
 * recurrence math itself, only ever displays what the server already resolved.
 */
export function useDropsViewModel() {
  const query = useQuery({
    queryKey: ["packs", "all"],
    queryFn: () => packsService.list(),
    refetchInterval: (q) => {
      const data = q.state.data as PackSku[] | undefined;
      const hasActiveDrop = (data ?? []).some((sku) => sku.goesLiveAt != null && sku.phase !== "closed");
      return hasActiveDrop ? LIVE_POLL_MS : false;
    },
  });

  const drops = useMemo<DropView[]>(() => {
    return (query.data ?? []).filter((sku) => sku.goesLiveAt != null).map((sku) => ({ sku, phase: sku.phase }));
  }, [query.data]);

  return {
    drops,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: () => query.refetch(),
  };
}
