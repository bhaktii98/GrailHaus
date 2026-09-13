import type { PulledOwnedItem } from "@grailhaus/shared";
import { apiGet, apiPost } from "./apiClient";

export interface PurchaseResult {
  purchaseId: string;
  status: "completed" | "failed" | "pending";
  packId: string;
  quantity: number;
  totalPriceCents: number | null;
  failureReason: string | null;
  /** Full catalog detail per pulled item (same shape as GET /items/:id) plus the real
   * `ownedItemId` purchase created for it — lets a post-reveal screen act on that exact copy. */
  items: PulledOwnedItem[];
}

export const purchaseService = {
  purchase: (idempotencyKey: string, packId: string, quantity: number) =>
    apiPost<PurchaseResult>("/purchase", { idempotencyKey, packId, quantity }),

  /** Reconciles a purchase whose response never arrived — same key, no re-execution server-side. */
  getByIdempotencyKey: (idempotencyKey: string) =>
    apiGet<PurchaseResult>(`/purchases/${encodeURIComponent(idempotencyKey)}`),
};
