import type { Category, Listing, RarityTierLevel } from "@grailhaus/shared";
import { apiGet, apiPost } from "./apiClient";

export interface FeePreview {
  feePercent: number;
  feeCents: number;
  sellerProceedsCents: number;
}

export const marketplaceService = {
  /** Other collectors' active listings only — the server leaves the caller's own out (it reads
   * the bearer token when one is sent), since you can't buy from yourself. */
  browse: (category?: Category): Promise<Listing[]> =>
    apiGet<Listing[]>(category ? `/listings?category=${category}&limit=100` : "/listings?limit=100"),
  /** The signed-in seller's own book, keyed server-side on the authenticated seller id — active
   * listings first, then sold/delisted ones. Requires a session. */
  mine: (category?: Category): Promise<Listing[]> =>
    apiGet<Listing[]>(category ? `/listings/mine?category=${category}&limit=100` : "/listings/mine?limit=100"),
  get: (id: string): Promise<Listing> => apiGet<Listing>(`/listings/${id}`),
  create: (ownedItemId: string, priceCents: number): Promise<Listing> =>
    apiPost<Listing>("/listings", { ownedItemId, priceCents }),
  delist: (id: string): Promise<Listing> => apiPost<Listing>(`/listings/${id}/delist`, {}),
  updatePrice: (id: string, priceCents: number): Promise<Listing> =>
    apiPost<Listing>(`/listings/${id}/price`, { priceCents }),
  buy: (id: string): Promise<{ status: "completed" | "failed"; failureReason: string | null; listing: Listing }> =>
    apiPost(`/listings/${id}/buy`, {}),
  /** Live preview at today's configured rate — same math the server applies at listing-create
   * time, just not yet committed. Lets the sell screen show a real net figure while the seller
   * is still typing a price, matching the mockup's "fee and net update live." */
  previewFee: (category: Category, rarityTierLevel: RarityTierLevel, priceCents: number): Promise<FeePreview> =>
    apiGet<FeePreview>(
      `/marketplace/fee-preview?category=${category}&rarityTierLevel=${rarityTierLevel}&priceCents=${priceCents}`
    ),
};
