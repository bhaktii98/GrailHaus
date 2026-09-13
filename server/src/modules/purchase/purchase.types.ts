import type { PulledItem } from "@grailhaus/shared";

export type PurchaseStatus = "pending" | "completed" | "failed";

export interface PurchaseResultPayload {
  items: PulledItem[];
  /** Same order as `items` — the `owned_items.id` each pulled item got, captured once at
   * insert time so a later cached/retried read (`findByIdempotencyKey`) doesn't need a separate,
   * ambiguous-on-duplicates lookup to reconstruct it. */
  ownedItemIds: string[];
  /**
   * The authoritative batch structure: for each entry of `items` (same order, same length), which
   * pack of this purchase produced it and its slot within that pack's own pull.
   *
   * This was always implicit — `items` is generated pack by pack, so boundaries could be
   * re-derived by slicing on `itemCount`. Persisting it explicitly makes the batch → pack → card
   * relationship a stored fact rather than a reconstruction, which is what auditing, debugging and
   * any future pack-level history actually need. The bulk reveal reorders items freely for
   * presentation (grails first); this is what guarantees that reordering can never lose which pack
   * a card really came from.
   *
   * Optional because purchase rows written before this existed don't have it. Readers must fall
   * back to positional derivation (see enrichItems) rather than assuming it's present.
   */
  packCoordinates?: { packIndex: number; cardIndex: number }[];
}

export interface PurchaseRow {
  id: string;
  idempotency_key: string;
  user_id: string;
  pack_id: string;
  quantity: number;
  total_price_cents: string | null;
  status: PurchaseStatus;
  failure_reason: string | null;
  result: PurchaseResultPayload | null;
  created_at: string;
  completed_at: string | null;
}
