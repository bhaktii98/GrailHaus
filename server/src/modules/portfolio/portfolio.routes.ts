import type { FastifyInstance } from "fastify";
import { getPortfolio, getPortfolioSummary } from "./portfolio.service.js";

const ownedItemSchema = {
  type: "object",
  properties: {
    ownedItemId: { type: "string" },
    packId: { type: "string" },
    purchaseId: { type: ["string", "null"] },
    acquiredAt: { type: "string" },
    heldSinceAt: {
      type: "string",
      description: "When the current owner took possession — the sale date for a marketplace buy",
    },
    costBasisCents: {
      type: ["number", "null"],
      description: "What this copy cost its current owner; null when not derivable",
    },
    acquiredVia: { type: "string", enum: ["pack", "marketplace"] },
    activeListing: {
      anyOf: [
        { type: "object", properties: { id: { type: "string" }, priceCents: { type: "number" } } },
        { type: "null" },
      ],
    },
    item: {
      type: "object",
      description: "Full catalog detail — same shape as GET /items/:id",
      additionalProperties: true,
    },
  },
};

const categoryBreakdownSchema = {
  type: "object",
  properties: {
    category: { type: "string" },
    count: { type: "number" },
    valueCents: { type: "number" },
    costBasisCents: { type: "number" },
    unrealizedPnlCents: { type: "number" },
    sharePercent: { type: "number" },
  },
};

const summarySchema = {
  type: "object",
  properties: {
    walletCents: { type: "number" },
    holdings: {
      type: "object",
      properties: {
        count: { type: "number" },
        valueCents: { type: "number" },
        costBasisCents: { type: "number" },
        pricedCount: { type: "number" },
        unrealizedPnlCents: { type: "number" },
        unrealizedPnlPercent: { type: "number" },
        listedCount: { type: "number" },
      },
    },
    netWorthCents: { type: "number" },
    purchases: {
      type: "object",
      properties: {
        count: { type: "number" },
        packCount: { type: "number" },
        spendCents: { type: "number" },
        itemsReceived: { type: "number" },
      },
    },
    marketplaceBuys: {
      type: "object",
      properties: { count: { type: "number" }, spendCents: { type: "number" } },
    },
    sales: {
      type: "object",
      properties: {
        count: { type: "number" },
        grossCents: { type: "number" },
        feeCents: { type: "number" },
        netCents: { type: "number" },
        realizedPnlCents: { type: "number" },
        pricedCount: { type: "number" },
      },
    },
    totalSpendCents: { type: "number" },
    realizedPnlCents: { type: "number" },
    totalPnlCents: { type: "number" },
    byCategory: { type: "array", items: categoryBreakdownSchema },
    valuedAt: { type: "string" },
  },
};

export async function portfolioRoutes(app: FastifyInstance) {
  app.get(
    "/me/portfolio",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["portfolio"],
        summary: "The signed-in user's owned items, newest first",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "number", minimum: 0, default: 0 },
          },
        },
        response: { 200: { type: "array", items: ownedItemSchema } },
      },
    },
    async (req) => {
      const { limit, offset } = req.query as { limit?: number; offset?: number };
      return getPortfolio(req.userId!, limit, offset);
    }
  );

  app.get(
    "/me/portfolio/summary",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["portfolio"],
        summary: "Wallet, holdings value, spend, sales and realized/unrealized P&L in one read",
        description:
          "Aggregates over the user's whole ledger, not just the page of items /me/portfolio returns. " +
          "Mark-to-market figures are a snapshot of a value that ticks every 30 seconds (PRD §28) — " +
          "`valuedAt` says which tick.",
        security: [{ bearerAuth: [] }],
        response: { 200: summarySchema },
      },
    },
    async (req) => getPortfolioSummary(req.userId!)
  );
}
