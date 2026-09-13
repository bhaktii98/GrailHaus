import type { RecentPull } from "@grailhaus/shared";
import { apiGet } from "./apiClient";

export const activityService = {
  recent: (limit = 20): Promise<RecentPull[]> => apiGet<RecentPull[]>(`/activity/recent?limit=${limit}`),
  /** Scoped to one pack's own pulls — a single drop's real claims feed (see DropDetailScreen /
   * useDropLiveFeed), not the app-wide "Recently Revealed" list. */
  recentForPack: (packId: string, limit = 6): Promise<RecentPull[]> =>
    apiGet<RecentPull[]>(`/activity/recent?limit=${limit}&packId=${encodeURIComponent(packId)}`),
};
