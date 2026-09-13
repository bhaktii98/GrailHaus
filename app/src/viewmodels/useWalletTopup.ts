import { useState } from "react";
import * as Crypto from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import { walletService } from "../services/walletService";
import { retryOnceOnNetworkError } from "../lib/retryOnNetworkError";
import { NetworkError } from "../services/apiClient";

export type TopUpResult = { ok: true; newBalanceCents: number | null } | { ok: false; error: string };

/**
 * ViewModel for adding funds to the sandbox wallet — same idempotency-key + retry-once shape
 * usePackFlowViewModel.startFlow already established for purchases, applied to a credit instead
 * of a debit. A fresh key per tap, reused verbatim if that same tap needs to retry; a *new*
 * top-up (a second tap after a completed one) always mints its own key, never reuses the last.
 */
export function useWalletTopup() {
  const [isToppingUp, setToppingUp] = useState(false);
  const queryClient = useQueryClient();

  async function topUp(amountCents: number): Promise<TopUpResult> {
    setToppingUp(true);
    try {
      const idempotencyKey = Crypto.randomUUID();
      const result = await retryOnceOnNetworkError(() => walletService.topUp(idempotencyKey, amountCents));
      if (result.status !== "completed") {
        return { ok: false, error: result.failureReason ?? "Couldn't add funds — try again." };
      }
      // Portfolio's own summary (["portfolio","me","summary"], which carries walletCents) is a
      // child key of this one and refreshes automatically via prefix matching — same convention
      // every other balance-changing mutation in this app already follows (see
      // usePackFlowViewModel.ts, useMarketplaceViewModel.ts).
      queryClient.invalidateQueries({ queryKey: ["portfolio", "me"] });
      return { ok: true, newBalanceCents: result.newBalanceCents };
    } catch (err) {
      if (err instanceof NetworkError) {
        return { ok: false, error: "Lost connection — we'll pick this back up automatically. Try again shortly." };
      }
      return { ok: false, error: err instanceof Error ? err.message : "Couldn't add funds — try again." };
    } finally {
      setToppingUp(false);
    }
  }

  return { topUp, isToppingUp };
}
