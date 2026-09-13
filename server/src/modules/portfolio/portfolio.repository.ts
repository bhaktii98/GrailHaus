import { pool } from "../../db/pool.js";
import type { ItemDetailRow } from "../items/items.types.js";

export interface OwnedItemRow {
  owned_item_id: string;
  pack_id: string;
  purchase_id: string | null;
  acquired_at: string;
  held_since: string;
  cost_basis_cents: number | null;
  acquired_via: "pack" | "marketplace";
  active_listing_id: string | null;
  active_listing_price_cents: number | null;
  item: ItemDetailRow;
}

interface OwnedItemQueryRow extends ItemDetailRow {
  owned_item_id: string;
  owned_pack_id: string;
  purchase_id: string | null;
  acquired_at: string;
  held_since: string;
  cost_basis_cents: string | null;
  acquired_via: "pack" | "marketplace";
  active_listing_id: string | null;
  active_listing_price_cents: string | null;
}

/**
 * What each copy a pack produced cost the person who bought that pack: the purchase's
 * `total_price_cents` split evenly across every `owned_items` row it created.
 *
 * Split to the cent, not by rounded division — `floor` alone loses up to (n-1) cents per pack,
 * which would quietly make every portfolio's cost basis (and therefore its P&L) drift high by a
 * few cents per purchase forever. The remainder is handed out one cent at a time to the first
 * rows in id order, so summing the allocation back up always returns the exact price paid.
 * Verified against the live dataset: 123 purchases allocate to 1,212,500¢, the exact total spent.
 *
 * Deliberately scoped to `$1`'s own purchases. A copy pulled by someone else and later bought on
 * the marketplace has a cost basis to *this* user of what they paid for it, never of what the
 * original ripper paid for the pack it fell out of.
 */
const PACK_COST_CTE = `
  pack_cost as (
    select
      s.owned_item_id,
      (s.total_price_cents / s.siblings)
        + case when s.rn <= (s.total_price_cents % s.siblings) then 1 else 0 end as cost_cents
    from (
      select
        oi.id as owned_item_id,
        pu.total_price_cents::bigint as total_price_cents,
        row_number() over (partition by oi.purchase_id order by oi.id) as rn,
        count(*) over (partition by oi.purchase_id) as siblings
      from public.owned_items oi
      join public.purchases pu on pu.id = oi.purchase_id
      where pu.user_id = $1 and pu.status = 'completed' and pu.total_price_cents is not null
    ) s
  )`;

/**
 * What `$1` most recently paid on the marketplace for each copy they bought. `distinct on` keeps
 * only the latest such sale per copy, which is what makes buy → sell → buy-back land on the
 * price of the *repurchase* rather than the first buy.
 */
const BUY_COST_CTE = `
  buy_cost as (
    select distinct on (l.owned_item_id)
      l.owned_item_id, l.price_cents::bigint as cost_cents, l.resolved_at
    from public.listings l
    where l.status = 'sold' and l.buyer_id = $1
    order by l.owned_item_id, l.resolved_at desc
  )`;

/** Marketplace price wins over pack allocation whenever both exist: the later of the two is
 * always the current owner's actual outlay for the copy they hold now. */
const COST_BASIS_SELECT = `
  coalesce(bc.cost_cents, pc.cost_cents) as cost_basis_cents,
  case when bc.owned_item_id is not null then 'marketplace' else 'pack' end as acquired_via,
  coalesce(bc.resolved_at, oi.acquired_at) as held_since`;

const COST_BASIS_JOINS = `
  left join pack_cost pc on pc.owned_item_id = oi.id
  left join buy_cost bc on bc.owned_item_id = oi.id`;

export async function findOwnedItems(userId: string, limit: number, offset: number): Promise<OwnedItemRow[]> {
  const { rows } = await pool.query<OwnedItemQueryRow>(
    `with ${PACK_COST_CTE}, ${BUY_COST_CTE}
     select
       oi.id as owned_item_id, oi.pack_id as owned_pack_id, oi.purchase_id, oi.acquired_at,
       ${COST_BASIS_SELECT},
       al.id as active_listing_id, al.price_cents as active_listing_price_cents,
       i.id, i.pack_id, p.category, i.name, i.rarity_tier_level, i.texture_url, i.base_value_cents,
       i.collection, i.tagline, i.traits,
       i.pokemon_name, i.card_title, i.pokemon_type, i.generation, i.pokedex_number,
       i.watch_name, i.model_name, i.brand, i.style, i.case_material, i.dial_color, i.movement, i.case_size
     from public.owned_items oi
     join public.items i on i.id = oi.item_id
     join public.packs p on p.id = i.pack_id
     ${COST_BASIS_JOINS}
     left join public.listings al on al.owned_item_id = oi.id and al.status = 'active'
     where oi.user_id = $1
     order by oi.acquired_at desc
     limit $2 offset $3`,
    [userId, limit, offset]
  );

  return rows.map((row) => ({
    owned_item_id: row.owned_item_id,
    pack_id: row.owned_pack_id,
    purchase_id: row.purchase_id,
    acquired_at: row.acquired_at,
    held_since: row.held_since,
    cost_basis_cents: row.cost_basis_cents == null ? null : Number(row.cost_basis_cents),
    acquired_via: row.acquired_via,
    active_listing_id: row.active_listing_id,
    active_listing_price_cents:
      row.active_listing_price_cents == null ? null : Number(row.active_listing_price_cents),
    item: row,
  }));
}

export interface HoldingValuationRow {
  item_id: string;
  category: string;
  base_value_cents: number;
  cost_basis_cents: number | null;
  is_listed: boolean;
}

/**
 * Every holding a user has, stripped to just what mark-to-market needs (id, category, base value,
 * cost) — no catalog columns, no joins to art or traits.
 *
 * Unpaged on purpose, unlike `findOwnedItems`: a summary that says "$4,210 across 715 pieces" has
 * to count all 715, and would be simply wrong if it summed only the page the grid happens to have
 * fetched. The row is deliberately this narrow so that staying unpaged is cheap.
 */
export async function findHoldingValuations(userId: string): Promise<HoldingValuationRow[]> {
  const { rows } = await pool.query<{
    item_id: string;
    category: string;
    base_value_cents: string;
    cost_basis_cents: string | null;
    is_listed: boolean;
  }>(
    `with ${PACK_COST_CTE}, ${BUY_COST_CTE}
     select
       i.id as item_id, p.category, i.base_value_cents,
       coalesce(bc.cost_cents, pc.cost_cents) as cost_basis_cents,
       (al.id is not null) as is_listed
     from public.owned_items oi
     join public.items i on i.id = oi.item_id
     join public.packs p on p.id = i.pack_id
     ${COST_BASIS_JOINS}
     left join public.listings al on al.owned_item_id = oi.id and al.status = 'active'
     where oi.user_id = $1`,
    [userId]
  );

  return rows.map((row) => ({
    item_id: row.item_id,
    category: row.category,
    base_value_cents: Number(row.base_value_cents),
    cost_basis_cents: row.cost_basis_cents == null ? null : Number(row.cost_basis_cents),
    is_listed: row.is_listed,
  }));
}

export interface PurchaseTotalsRow {
  count: number;
  packCount: number;
  spendCents: number;
  itemsReceived: number;
}

/** Completed pack purchases only — a `pending` row is money not yet committed and a `failed` one
 * was refunded by never being debited, so neither belongs in "total spent". */
export async function findPurchaseTotals(userId: string): Promise<PurchaseTotalsRow> {
  const { rows } = await pool.query<{
    count: string;
    pack_count: string | null;
    spend_cents: string | null;
    items_received: string;
  }>(
    `select
       count(*) as count,
       sum(pu.quantity) as pack_count,
       sum(pu.total_price_cents) as spend_cents,
       (select count(*) from public.owned_items oi
         join public.purchases p2 on p2.id = oi.purchase_id
         where p2.user_id = $1 and p2.status = 'completed') as items_received
     from public.purchases pu
     where pu.user_id = $1 and pu.status = 'completed'`,
    [userId]
  );
  const row = rows[0];
  return {
    count: Number(row?.count ?? 0),
    packCount: Number(row?.pack_count ?? 0),
    spendCents: Number(row?.spend_cents ?? 0),
    itemsReceived: Number(row?.items_received ?? 0),
  };
}

export interface MarketplaceBuyTotalsRow {
  count: number;
  spendCents: number;
}

export async function findMarketplaceBuyTotals(userId: string): Promise<MarketplaceBuyTotalsRow> {
  const { rows } = await pool.query<{ count: string; spend_cents: string | null }>(
    `select count(*) as count, sum(price_cents) as spend_cents
     from public.listings
     where buyer_id = $1 and status = 'sold'`,
    [userId]
  );
  return { count: Number(rows[0]?.count ?? 0), spendCents: Number(rows[0]?.spend_cents ?? 0) };
}

export interface SaleTotalsRow {
  count: number;
  grossCents: number;
  feeCents: number;
  netCents: number;
  realizedPnlCents: number;
  pricedCount: number;
}

/**
 * Settled sales. The subtlety is the cost basis of something already sold: after a sale the
 * `owned_items` row belongs to the *buyer*, so the seller's own outlay has to be reconstructed —
 * either the price they themselves paid for that copy in an earlier sale (the correlated subquery,
 * bounded to sales that resolved *before* this one so a later repurchase can't leak backwards), or
 * their allocated share of the pack they ripped it out of.
 *
 * Sales whose basis can't be established still count toward `count`/`grossCents`/`netCents` — the
 * cash moved and hiding it would be a lie — but are left out of `realizedPnlCents` and reported
 * separately via `pricedCount`, so the screen can say what the P&L figure does and doesn't cover.
 */
export async function findSaleTotals(userId: string): Promise<SaleTotalsRow> {
  const { rows } = await pool.query<{
    count: string;
    gross_cents: string;
    fee_cents: string;
    net_cents: string;
    realized_pnl_cents: string;
    priced_count: string;
  }>(
    `with ${PACK_COST_CTE}, sales as (
       select
         l.price_cents, l.fee_cents, l.seller_proceeds_cents,
         coalesce(
           (select lb.price_cents
              from public.listings lb
             where lb.owned_item_id = l.owned_item_id
               and lb.status = 'sold'
               and lb.buyer_id = $1
               and lb.resolved_at < l.resolved_at
             order by lb.resolved_at desc
             limit 1),
           pc.cost_cents
         ) as basis_cents
       from public.listings l
       left join pack_cost pc on pc.owned_item_id = l.owned_item_id
       where l.seller_id = $1 and l.status = 'sold'
     )
     select
       count(*) as count,
       coalesce(sum(price_cents), 0) as gross_cents,
       coalesce(sum(fee_cents), 0) as fee_cents,
       coalesce(sum(seller_proceeds_cents), 0) as net_cents,
       coalesce(sum(seller_proceeds_cents - basis_cents) filter (where basis_cents is not null), 0)
         as realized_pnl_cents,
       count(*) filter (where basis_cents is not null) as priced_count
     from sales`,
    [userId]
  );
  const row = rows[0];
  return {
    count: Number(row?.count ?? 0),
    grossCents: Number(row?.gross_cents ?? 0),
    feeCents: Number(row?.fee_cents ?? 0),
    netCents: Number(row?.net_cents ?? 0),
    realizedPnlCents: Number(row?.realized_pnl_cents ?? 0),
    pricedCount: Number(row?.priced_count ?? 0),
  };
}
