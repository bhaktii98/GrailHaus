export interface PackRow {
  id: string;
  category: string;
  tier: string;
  name: string;
  price_cents: string;
  item_count: number;
  stock_remaining: number | null;
  max_stock: number | null;
  goes_live_at: string | null;
  ends_at: string | null;
  /** 0=Sunday..6=Saturday. Null/empty = not a recurring drop. */
  recurrence_weekdays: number[] | null;
  /** "HH:MM:SS" (pg's `time` type), UTC. */
  recurrence_time_utc: string | null;
  recurrence_duration_minutes: number | null;
  /** Bookkeeping only — when `stock_remaining` was last reset for a new occurrence. Never
   * surfaced to a client; see packs.service.ts's `applyRecurringDropWindow`. */
  recurrence_last_reset_at: string | null;
}

export interface ItemRow {
  id: string;
  pack_id: string;
  name: string;
  rarity_tier_level: number;
  texture_url: string | null;
  base_value_cents: string;
}

export interface SlotProbabilityRow {
  pack_id: string;
  slot_position: number;
  rarity_tier_level: number;
  probability_percent: string;
}

export interface PressureRuleRow {
  pack_id: string;
  qualifying_min_tier: number;
  steps_without_qualifying: number;
  effect_type: "bonus_percent" | "guarantee_min_tier";
  target_tier_level: number;
  effect_value: number | null;
  applies_to_final_slot_only: boolean;
}

export interface RarityTierRow {
  category: string;
  tier_level: number;
  name: string;
  color_hex: string;
  value_min_cents: string;
  value_max_cents: string;
}
