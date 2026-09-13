import type { OwnedItem, PortfolioSummary } from "@grailhaus/shared";
import { apiGet } from "./apiClient";

/** `/me/portfolio` caps a single response at 200 rows (see the route's querystring schema). */
const PAGE_SIZE = 200;
/** A hard stop so a server that somehow keeps returning full pages can't spin this forever.
 * 5,000 items is far past any real collection — the largest account in the dataset holds ~700. */
const MAX_PAGES = 25;

export const portfolioService = {
  /**
   * The user's complete holdings, paged through rather than truncated at the first 200.
   *
   * The portfolio screen states totals ("715 pieces · $4,210") next to the grid those totals
   * describe, so a silently clipped first page would put two contradictory numbers on one screen.
   * Pages are fetched in sequence, not in parallel, because the total count isn't known up front —
   * the last page is identified by coming back short.
   */
  list: async (): Promise<OwnedItem[]> => {
    const all: OwnedItem[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await apiGet<OwnedItem[]>(`/me/portfolio?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`);
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
    return all;
  },

  summary: (): Promise<PortfolioSummary> => apiGet<PortfolioSummary>("/me/portfolio/summary"),
};
