import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { activityService } from "../services/activityService";
import { connectDropSocket } from "../lib/dropSocket";

const CLAIMS_LIMIT = 6;

/**
 * The live half of a drop's own screen: real recent claims for this pack (not the fabricated
 * placeholder rows this screen used to show — see DropDetailScreen's git history), refreshed the
 * instant anyone claims one via a WebSocket push rather than a poll (see lib/dropSocket.ts /
 * server's dropBroadcast.ts). `liveStockRemaining` is `null` until the first push arrives, so a
 * caller falls back to the polled `sku.stockRemaining` in the meantime.
 *
 * Only meaningful — and only connects the socket — while the drop is actually live; a "soon" or
 * "closed" drop has no live claims to watch.
 */
export function useDropLiveFeed(packId: string, active: boolean) {
  const [liveStockRemaining, setLiveStockRemaining] = useState<number | null>(null);
  const claimsQuery = useQuery({
    queryKey: ["activity", "recent", "pack", packId],
    queryFn: () => activityService.recentForPack(packId, CLAIMS_LIMIT),
    enabled: active,
  });

  useEffect(() => {
    if (!active) return undefined;
    const disconnect = connectDropSocket(packId, (stockRemaining) => {
      setLiveStockRemaining(stockRemaining);
      claimsQuery.refetch();
    });
    return disconnect;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId, active]);

  return {
    claims: claimsQuery.data ?? [],
    liveStockRemaining,
  };
}
