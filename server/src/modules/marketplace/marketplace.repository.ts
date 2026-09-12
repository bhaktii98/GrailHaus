import type { Pool, PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import type { ListingRow, ListingWithPartiesRow } from "./marketplace.types.js";

type Queryable = Pool | PoolClient;

/** PRD §31's stated rate — used only if a (category, tier) row is somehow missing from
 * `marketplace_fee_tiers` (every row is seeded at 8% today; this is a floor, not a live value). */
export const DEFAULT_FEE_PERCENT = 8;

const LISTING_WITH_PARTIES_SELECT = `
  select
    l.id as listing_id, l.owned_item_id, l.price_cents, l.status,
    l.fee_percent, l.fee_cents, l.seller_proceeds_cents, l.created_at, l.resolved_at,
    i.id as item_id, i.pack_id as item_pack_id, p.category, i.name, i.rarity_tier_level, i.texture_url, i.base_value_cents,
    i.collection, i.tagline, i.traits,
    i.pokemon_name, i.card_title, i.pokemon_type, i.generation, i.pokedex_number,
    i.watch_name, i.model_name, i.brand, i.style, i.case_material, i.dial_color, i.movement, i.case_size,
    seller.public_id as seller_public_id, seller.username as seller_username,
    buyer.public_id as buyer_public_id, buyer.username as buyer_username
  from public.listings l
  join public.owned_items oi on oi.id = l.owned_item_id
  join public.items i on i.id = oi.item_id
  join public.packs p on p.id = i.pack_id
  join public.profiles seller on seller.id = l.seller_id
  left join public.profiles buyer on buyer.id = l.buyer_id
`;

/**
 * Browse: every *other* collector's active listings. `excludeSellerId` (the caller, when signed
 * in) is filtered out in SQL rather than client-side — you can't buy your own listing (the buy
 * transaction rejects it outright), so showing it in Browse only offers a dead end. A seller's
 * own book lives behind "My Listings", which fetches it deliberately via `findListingsBySeller`.
 */
export async function findActiveListings(
  category: string | undefined,
  limit: number,
  offset: number,
  excludeSellerId?: string
): Promise<ListingWithPartiesRow[]> {
  const params: unknown[] = [];
  let where = "where l.status = 'active'";
  if (category) {
    params.push(category);
    where += ` and p.category = $${params.length}`;
  }
  if (excludeSellerId) {
    params.push(excludeSellerId);
    where += ` and l.seller_id <> $${params.length}`;
  }
  params.push(limit, offset);
  const { rows } = await pool.query<ListingWithPartiesRow>(
    `${LISTING_WITH_PARTIES_SELECT} ${where} order by l.created_at desc limit $${params.length - 1} offset $${params.length}`,
    params
  );
  return rows;
}

/**
 * A seller's own book, keyed on the authenticated `seller_id` — the only trustworthy "is this
 * mine" signal. Browse used to be filtered client-side by matching `seller.username`, which both
 * missed listings whose seller has no username set and silently broke if two profiles ever
 * shared one. Includes resolved (sold/delisted) listings so a seller can see what happened to
 * what they listed, newest first; `status` on each row is what distinguishes them.
 */
export async function findListingsBySeller(
  sellerId: string,
  category: string | undefined,
  limit: number,
  offset: number
): Promise<ListingWithPartiesRow[]> {
  const params: unknown[] = [sellerId];
  let where = "where l.seller_id = $1";
  if (category) {
    params.push(category);
    where += ` and p.category = $${params.length}`;
  }
  params.push(limit, offset);
  const { rows } = await pool.query<ListingWithPartiesRow>(
    `${LISTING_WITH_PARTIES_SELECT} ${where}
     order by case when l.status = 'active' then 0 else 1 end, l.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params
  );
  return rows;
}

export async function findListingWithPartiesById(listingId: string): Promise<ListingWithPartiesRow | null> {
  const { rows } = await pool.query<ListingWithPartiesRow>(`${LISTING_WITH_PARTIES_SELECT} where l.id = $1`, [
    listingId,
  ]);
  return rows[0] ?? null;
}

export async function findOwnedItemOwner(ownedItemId: string): Promise<{ userId: string; itemId: string } | null> {
  const { rows } = await pool.query<{ user_id: string; item_id: string }>(
    "select user_id, item_id from public.owned_items where id = $1",
    [ownedItemId]
  );
  return rows[0] ? { userId: rows[0].user_id, itemId: rows[0].item_id } : null;
}

/** Throws a `pg` error with `code === "23505"` if this owned item already has an active
 * listing — the partial unique index is the actual guard, this just performs the insert. */
export async function insertListing(ownedItemId: string, sellerId: string, priceCents: number): Promise<ListingRow> {
  const { rows } = await pool.query<ListingRow>(
    `insert into public.listings (owned_item_id, seller_id, price_cents, status)
     values ($1, $2, $3, 'active')
     returning *`,
    [ownedItemId, sellerId, priceCents]
  );
  return rows[0];
}

/** Only succeeds while the listing is still active and belongs to this seller — a single
 * conditional UPDATE, atomic by construction; a listing sold out from under a delist attempt
 * (or already delisted) simply fails to match the WHERE clause and reports no rows changed. */
export async function delistListing(listingId: string, sellerId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "update public.listings set status = 'delisted', resolved_at = now() where id = $1 and seller_id = $2 and status = 'active'",
    [listingId, sellerId]
  );
  return (rowCount ?? 0) > 0;
}

/** Same shape as `delistListing` — a single conditional UPDATE, only takes effect while the
 * listing is still active and belongs to this seller. `fee_percent`/`fee_cents`/
 * `seller_proceeds_cents` stay untouched: those are only ever written once, at sale time (see
 * `markListingSold`) — an active listing's fee preview is always computed live from today's
 * rate, never stored. */
export async function updateListingPrice(listingId: string, sellerId: string, priceCents: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    "update public.listings set price_cents = $3 where id = $1 and seller_id = $2 and status = 'active'",
    [listingId, sellerId, priceCents]
  );
  return (rowCount ?? 0) > 0;
}

interface LockedListing {
  id: string;
  owned_item_id: string;
  seller_id: string;
  price_cents: number;
  status: ListingRow["status"];
  buyer_id: string | null;
  category: string;
  rarity_tier_level: number;
  current_owner_id: string;
}

/** The one lock the whole buy transaction hinges on — every concurrent buy/delist attempt on
 * this listing serializes here, and re-reads this row's current status once it gets the lock. */
export async function lockListingForBuy(client: PoolClient, listingId: string): Promise<LockedListing | null> {
  const { rows } = await client.query<LockedListing>(
    `select l.id, l.owned_item_id, l.seller_id, l.price_cents, l.status, l.buyer_id,
            p.category, i.rarity_tier_level, oi.user_id as current_owner_id
     from public.listings l
     join public.owned_items oi on oi.id = l.owned_item_id
     join public.items i on i.id = oi.item_id
     join public.packs p on p.id = i.pack_id
     where l.id = $1
     for update of l`,
    [listingId]
  );
  return rows[0] ?? null;
}

export async function lockBuyerBalance(client: PoolClient, userId: string): Promise<number> {
  const { rows } = await client.query<{ balance_cents: string }>(
    "select balance_cents from public.profiles where id = $1 for update",
    [userId]
  );
  if (rows.length === 0) throw new Error(`Profile not found for user ${userId}`);
  return Number(rows[0].balance_cents);
}

export async function debitBuyer(client: PoolClient, userId: string, amountCents: number): Promise<void> {
  await client.query("update public.profiles set balance_cents = balance_cents - $2 where id = $1", [
    userId,
    amountCents,
  ]);
}

export async function creditSeller(client: PoolClient, userId: string, amountCents: number): Promise<void> {
  await client.query("update public.profiles set balance_cents = balance_cents + $2 where id = $1", [
    userId,
    amountCents,
  ]);
}

export async function transferOwnership(client: PoolClient, ownedItemId: string, buyerId: string): Promise<void> {
  await client.query("update public.owned_items set user_id = $2 where id = $1", [ownedItemId, buyerId]);
}

export async function markListingSold(
  client: PoolClient,
  listingId: string,
  buyerId: string,
  feePercent: number,
  feeCents: number,
  sellerProceedsCents: number
): Promise<void> {
  await client.query(
    `update public.listings
     set status = 'sold', buyer_id = $2, fee_percent = $3, fee_cents = $4, seller_proceeds_cents = $5, resolved_at = now()
     where id = $1`,
    [listingId, buyerId, feePercent, feeCents, sellerProceedsCents]
  );
}

export async function getFeePercentForCategoryTier(
  client: Queryable,
  category: string,
  rarityTierLevel: number
): Promise<number> {
  const { rows } = await client.query<{ fee_percent: string }>(
    "select fee_percent from public.marketplace_fee_tiers where category = $1 and rarity_tier_level = $2",
    [category, rarityTierLevel]
  );
  return rows[0] ? Number(rows[0].fee_percent) : DEFAULT_FEE_PERCENT;
}
