export type WalletTopupStatus = "pending" | "completed" | "failed";

export interface WalletTopupRow {
  id: string;
  idempotency_key: string;
  user_id: string;
  amount_cents: string;
  status: WalletTopupStatus;
  new_balance_cents: string | null;
  failure_reason: string | null;
  created_at: string;
  completed_at: string | null;
}
