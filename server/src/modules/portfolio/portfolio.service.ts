import { computePriceDrift } from "@grailhaus/shared";
import type { Category, OwnedItem, PortfolioCategoryBreakdown, PortfolioSummary } from "@grailhaus/shared";
import { NotFoundError } from "../../lib/errors.js";
import { toItemDetail } from "../items/items.service.js";
import { findProfileByUserId } from "../profile/profile.repository.js";
import {
  findHoldingValuations,
  findMarketplaceBuyTotals,
  findOwnedItems,
  findPurchaseTotals,
  findSaleTotals,
} from "./portfolio.repository.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function getPortfolio(userId: string, limit = DEFAULT_LIMIT, offset = 0): Promise<OwnedItem[]> {
  const boundedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
  const rows = await findOwnedItems(userId, boundedLimit, Math.max(0, offset));
  return rows.map((row) => ({
    ownedItemId: row.owned_item_id,
    item: toItemDetail(row.item),
    packId: row.pack_id,
    purchaseId: row.purchase_id,
    acquiredAt: row.acquired_at,
    heldSinceAt: row.held_since,
    costBasisCents: row.cost_basis_cents,
    acquiredVia: row.acquired_via,
    activeListing:
      row.active_listing_id != null && row.active_listing_price_cents != null
        ? { id: row.active_listing_id, priceCents: row.active_listing_price_cents }
        : null,
  }));
}

/**
 * The whole money picture for one collector, in one request.
 *
 * Four independent reads rather than one heroic join — holdings, pack purchases, marketplace
 * buys, sales are genuinely different questions of different tables, and a single query answering
 * all four would either fan out (counting the same purchase once per item it produced) or need
 * enough nested CTEs to be unreviewable. They're fired concurrently, so the cost is one round
 * trip's latency, not four.
 *
 * Mark-to-market runs here in JS rather than in SQL because the live value *is* JS — the same
 * `computePriceDrift` (PRD §28) that `/items` and every catalog read already evaluates. Keeping
 * one implementation means a portfolio total can never disagree with the sum of the item prices
 * the client is showing right beside it.
 */
export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  const [profile, holdings, purchases, marketplaceBuys, sales] = await Promise.all([
    findProfileByUserId(userId),
    findHoldingValuations(userId),
    findPurchaseTotals(userId),
    findMarketplaceBuyTotals(userId),
    findSaleTotals(userId),
  ]);
  if (!profile) throw new NotFoundError("Profile not found");

  // One `now` for every item, so the whole snapshot lands on a single drift tick — valuing item
  // #700 a few milliseconds later than item #1 could otherwise straddle a 30s boundary and make
  // the total disagree with itself.
  const valuedAt = new Date();

  let valueCents = 0;
  let costBasisCents = 0;
  let pricedCount = 0;
  let listedCount = 0;
  const byCategory = new Map<Category, PortfolioCategoryBreakdown>();

  for (const holding of holdings) {
    const category = holding.category as Category;
    const { currentValueCents } = computePriceDrift(
      { id: holding.item_id, category, baseValueCents: holding.base_value_cents },
      valuedAt
    );

    valueCents += currentValueCents;
    if (holding.is_listed) listedCount += 1;

    const bucket = byCategory.get(category) ?? {
      category,
      count: 0,
      valueCents: 0,
      costBasisCents: 0,
      unrealizedPnlCents: 0,
      sharePercent: 0,
    };
    bucket.count += 1;
    bucket.valueCents += currentValueCents;

    // A holding with no derivable basis contributes its value but not a fake $0 cost — otherwise
    // every unpriced item would read as pure profit.
    if (holding.cost_basis_cents != null) {
      costBasisCents += holding.cost_basis_cents;
      pricedCount += 1;
      bucket.costBasisCents += holding.cost_basis_cents;
      bucket.unrealizedPnlCents += currentValueCents - holding.cost_basis_cents;
    }
    byCategory.set(category, bucket);
  }

  const unrealizedPnlCents = [...byCategory.values()].reduce((sum, b) => sum + b.unrealizedPnlCents, 0);
  const breakdown = [...byCategory.values()]
    .map((bucket) => ({
      ...bucket,
      sharePercent: valueCents > 0 ? Math.round((bucket.valueCents / valueCents) * 100) : 0,
    }))
    .sort((a, b) => b.valueCents - a.valueCents);

  return {
    walletCents: Number(profile.balance_cents),
    holdings: {
      count: holdings.length,
      valueCents,
      costBasisCents,
      pricedCount,
      unrealizedPnlCents,
      unrealizedPnlPercent: costBasisCents > 0 ? (unrealizedPnlCents / costBasisCents) * 100 : 0,
      listedCount,
    },
    netWorthCents: Number(profile.balance_cents) + valueCents,
    purchases,
    marketplaceBuys,
    sales,
    totalSpendCents: purchases.spendCents + marketplaceBuys.spendCents,
    realizedPnlCents: sales.realizedPnlCents,
    totalPnlCents: sales.realizedPnlCents + unrealizedPnlCents,
    byCategory: breakdown,
    valuedAt: valuedAt.toISOString(),
  };
}
