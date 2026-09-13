import { apiGet, apiPost } from "./apiClient";

export interface WalletTopupResult {
  topupId: string;
  status: "completed" | "failed" | "pending";
  amountCents: number;
  newBalanceCents: number | null;
  failureReason: string | null;
}

export const walletService = {
  topUp: (idempotencyKey: string, amountCents: number) =>
    apiPost<WalletTopupResult>("/wallet/topup", { idempotencyKey, amountCents }),

  /** Reconciles a top-up whose response never arrived — same key, no re-execution server-side. */
  getByIdempotencyKey: (idempotencyKey: string) =>
    apiGet<WalletTopupResult>(`/wallet/topups/${encodeURIComponent(idempotencyKey)}`),
};
