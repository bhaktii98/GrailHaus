import { useState } from "react";

/**
 * Manual pull-to-refresh state, deliberately separate from react-query's own `isFetching`/
 * `isRefetching` — those also fire for background polling and for query invalidations fired
 * elsewhere in the app (a purchase, a sale, a rip), and wiring either straight into a
 * `RefreshControl` would pop a spinner onto the screen with nobody having pulled for one. This
 * flag is only ever set by an actual pull. Same pattern usePortfolioViewModel.ts's own `refresh`
 * already established, pulled out here so every other screen's viewmodel doesn't hand-roll it.
 */
export function useManualRefresh(refetchAll: () => Promise<unknown>) {
  const [isRefreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  }

  return { isRefreshing, refresh };
}
