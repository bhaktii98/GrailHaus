export type ListingStatusRow = "active" | "sold" | "delisted";

/** Bare listing columns — used internally for locking/updating during the buy transaction,
 * where item/party detail isn't needed. */
export interface ListingRow {
  id: string;
  owned_item_id: string;
  seller_id: string;
  price_cents: string;
  status: ListingStatusRow;
  buyer_id: string | null;
  fee_percent: string | null;
  fee_cents: string | null;
  seller_proceeds_cents: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** A listing joined with the item's catalog detail and both parties' public identity — the
 * shape every client-facing read builds its response from. Field names are flat and explicit
 * (not composed via `extends`) specifically because `listings.id` and `items.id` would
 * otherwise collide under one `id` key. */
export interface ListingWithPartiesRow {
  listing_id: string;
  owned_item_id: string;
  price_cents: string;
  status: ListingStatusRow;
  fee_percent: string | null;
  fee_cents: string | null;
  seller_proceeds_cents: string | null;
  created_at: string;
  resolved_at: string | null;

  item_id: string;
  item_pack_id: string;
  category: string;
  name: string;
  rarity_tier_level: number;
  texture_url: string | null;
  base_value_cents: string;
  collection: string | null;
  tagline: string | null;
  traits: string | null;
  pokemon_name: string | null;
  card_title: string | null;
  pokemon_type: string | null;
  generation: string | null;
  pokedex_number: string | null;
  watch_name: string | null;
  model_name: string | null;
  brand: string | null;
  style: string | null;
  case_material: string | null;
  dial_color: string | null;
  movement: string | null;
  case_size: string | null;

  seller_public_id: string;
  seller_username: string | null;
  buyer_public_id: string | null;
  buyer_username: string | null;
}
