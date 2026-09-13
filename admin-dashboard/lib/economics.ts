import { pool } from "./db";

/**
 * Actual realized numbers from real purchases — the counterpart to the Overview page's
 * forward-looking EV estimate. This is Deliverable 5's "thin admin screen [that] closes the
 * loop: packs sold, fees collected, contents payout vs pack revenue, margin per category" —
 * every number here comes from rows that actually exist in `purchases`/`listings`/`owned_items`,
 * not a projection.
 */
export interface PackEconomics {
  id: string;
  category: string;
  tier: string;
  name: string;
  priceCents: number;
  packsSold: number;
  revenueCents: number;
  payoutCents: number;
}

export async function getPackEconomics(): Promise<PackEconomics[]> {
  const { rows } = await pool.query<{
    id: string;
    category: string;
    tier: string;
    name: string;
    price_cents: string;
    packs_sold: string;
    revenue_cents: string;
    payout_cents: string;
  }>(`
    select
      p.id, p.category, p.tier, p.name, p.price_cents,
      coalesce(sum(pu.quantity), 0) as packs_sold,
      coalesce(sum(pu.total_price_cents), 0) as revenue_cents,
      coalesce(sum(payout.value_cents), 0) as payout_cents
    from public.packs p
    left join public.purchases pu on pu.pack_id = p.id and pu.status = 'completed'
    left join (
      select oi.purchase_id, sum(i.base_value_cents) as value_cents
      from public.owned_items oi
      join public.items i on i.id = oi.item_id
      where oi.purchase_id is not null
      group by oi.purchase_id
    ) payout on payout.purchase_id = pu.id
    group by p.id, p.category, p.tier, p.name, p.price_cents
    order by p.category, p.price_cents
  `);

  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    tier: r.tier,
    name: r.name,
    priceCents: Number(r.price_cents),
    packsSold: Number(r.packs_sold),
    revenueCents: Number(r.revenue_cents),
    payoutCents: Number(r.payout_cents),
  }));
}

export interface MarketplaceEconomics {
  category: string;
  salesCount: number;
  grossSalesCents: number;
  feesCollectedCents: number;
  sellerProceedsCents: number;
}

export async function getMarketplaceEconomics(): Promise<MarketplaceEconomics[]> {
  const { rows } = await pool.query<{
    category: string;
    sales_count: string;
    gross_sales_cents: string;
    fees_collected_cents: string;
    seller_proceeds_cents: string;
  }>(`
    select
      p.category,
      count(l.id) as sales_count,
      coalesce(sum(l.price_cents), 0) as gross_sales_cents,
      coalesce(sum(l.fee_cents), 0) as fees_collected_cents,
      coalesce(sum(l.seller_proceeds_cents), 0) as seller_proceeds_cents
    from public.listings l
    join public.owned_items oi on oi.id = l.owned_item_id
    join public.items i on i.id = oi.item_id
    join public.packs p on p.id = i.pack_id
    where l.status = 'sold'
    group by p.category
    order by p.category
  `);

  return rows.map((r) => ({
    category: r.category,
    salesCount: Number(r.sales_count),
    grossSalesCents: Number(r.gross_sales_cents),
    feesCollectedCents: Number(r.fees_collected_cents),
    sellerProceedsCents: Number(r.seller_proceeds_cents),
  }));
}
