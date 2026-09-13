import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Listing } from "@grailhaus/shared";
import { marketplaceService } from "../services/marketplaceService";
import { ApiError, NetworkError } from "../services/apiClient";
import { retryOnceOnNetworkError } from "../lib/retryOnNetworkError";

export type ListResult = { ok: true } | { ok: false; error: string };
export type UpdatePriceResult = { ok: true; listing: Listing } | { ok: false; error: string };

/** A dropped connection right as the request lands is genuinely ambiguous even after the retry
 * inside `retryOnceOnNetworkError` fails too — unlike `createListing` (see below), there's no
 * conflict message here that unambiguously means "my own retry, already done": the same generic
 * conflict also covers "someone else bought it while you were offline," which is not the same
 * outcome for the seller. Refreshing state and saying so honestly beats guessing. */
const CONNECTION_LOST_MESSAGE = "Lost connection before we could confirm. Pull to refresh — it may have already gone through.";

/** ViewModel behind "Sell" on an owned item, and "Edit Price"/"Delist" on an active listing. */
export function useListingViewModel() {
  const [isWorking, setWorking] = useState(false);
  const queryClient = useQueryClient();

  function refreshMarketState() {
    queryClient.invalidateQueries({ queryKey: ["portfolio", "me"] });
    queryClient.invalidateQueries({ queryKey: ["listings"] });
  }

  async function createListing(ownedItemId: string, priceCents: number): Promise<ListResult> {
    setWorking(true);
    try {
      await retryOnceOnNetworkError(() => marketplaceService.create(ownedItemId, priceCents));
      refreshMarketState();
      return { ok: true };
    } catch (err) {
      refreshMarketState(); // state may have changed server-side even though this call errored
      // Unlike delist's conflict below, this one is unambiguous: the *only* way creating a
      // listing for this exact item conflicts is that an active listing for it already exists —
      // and since this is a retry of the user's own just-now tap, that's almost certainly this
      // same attempt having actually landed the first time. Treat it as the success it is,
      // rather than telling the user their "Sell" tap failed when the item is, in fact, listed.
      if (err instanceof ApiError && err.status === 409) return { ok: true };
      if (err instanceof NetworkError) return { ok: false, error: CONNECTION_LOST_MESSAGE };
      return { ok: false, error: err instanceof Error ? err.message : "Couldn't list that item." };
    } finally {
      setWorking(false);
    }
  }

  async function delist(listingId: string): Promise<ListResult> {
    setWorking(true);
    try {
      await retryOnceOnNetworkError(() => marketplaceService.delist(listingId));
      refreshMarketState();
      return { ok: true };
    } catch (err) {
      refreshMarketState();
      if (err instanceof NetworkError) return { ok: false, error: CONNECTION_LOST_MESSAGE };
      return { ok: false, error: err instanceof Error ? err.message : "Couldn't delist that item." };
    } finally {
      setWorking(false);
    }
  }

  async function updatePrice(listingId: string, priceCents: number): Promise<UpdatePriceResult> {
    setWorking(true);
    try {
      const listing = await retryOnceOnNetworkError(() => marketplaceService.updatePrice(listingId, priceCents));
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      return { ok: true, listing };
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      if (err instanceof NetworkError) return { ok: false, error: CONNECTION_LOST_MESSAGE };
      return { ok: false, error: err instanceof Error ? err.message : "Couldn't update the price." };
    } finally {
      setWorking(false);
    }
  }

  return { isWorking, createListing, delist, updatePrice };
}
