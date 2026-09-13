import { useQuery } from "@tanstack/react-query";
import { activityService } from "../services/activityService";

/**
 * ViewModel for Home's "Recently Revealed" — `/activity/recent` is public (no session needed,
 * same as /packs), so this fetches unconditionally rather than gating on sign-in the way
 * useCollectionViewModel does for /me/portfolio.
 */
export function useRecentActivityViewModel(limit = 20) {
  const query = useQuery({
    queryKey: ["activity", "recent", limit],
    queryFn: () => activityService.recent(limit),
    refetchInterval: 30_000,
  });

  return {
    pulls: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: () => query.refetch(),
  };
}
