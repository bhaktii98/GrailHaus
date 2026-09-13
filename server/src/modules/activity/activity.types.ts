import type { ItemDetailRow } from "../items/items.types.js";

export interface RecentPullRow extends ItemDetailRow {
  owned_item_id: string;
  acquired_at: string;
  username: string | null;
}
