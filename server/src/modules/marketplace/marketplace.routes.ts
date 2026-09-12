import type { FastifyInstance } from "fastify";
import type { Category, RarityTierLevel } from "@grailhaus/shared";
import { itemDetailSchema } from "../items/items.schema.js";
import {
  browseListings,
  buyListing,
  createListing,
  delist,
  getListing,
  myListings,
  previewFeeSplit,
  updatePrice,
} from "./marketplace.service.js";

const partySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    username: { type: ["string", "null"] },
  },
};

const listingSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    ownedItemId: { type: "string" },
    item: itemDetailSchema,
    seller: partySchema,
    buyer: { anyOf: [partySchema, { type: "null" }] },
    priceCents: { type: "number" },
    status: { type: "string", enum: ["active", "sold", "delisted"] },
    feePercent: { type: ["number", "null"] },
    feeCents: { type: ["number", "null"] },
    sellerProceedsCents: { type: ["number", "null"] },
    createdAt: { type: "string" },
    resolvedAt: { type: ["string", "null"] },
  },
};

export async function marketplaceRoutes(app: FastifyInstance) {
  app.get(
    "/listings",
    {
      // Still public (no 401 without a token), but a token that *is* sent identifies the caller
      // so their own listings can be left out — you can't buy from yourself, so surfacing them
      // in Browse is a dead end. Sellers see their own book under /listings/mine.
      preHandler: app.identifyOptional,
      schema: {
        tags: ["marketplace"],
        summary: "Browse active listings — public; excludes the caller's own when signed in",
        querystring: {
          type: "object",
          properties: {
            category: { type: "string" },
            limit: { type: "number", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "number", minimum: 0, default: 0 },
          },
        },
        response: { 200: { type: "array", items: listingSchema } },
      },
    },
    async (req) => {
      const { category, limit, offset } = req.query as { category?: Category; limit?: number; offset?: number };
      return browseListings(category, limit, offset, req.userId);
    }
  );

  app.get(
    "/listings/mine",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["marketplace"],
        summary: "The signed-in seller's own listings — active first, then sold/delisted",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            category: { type: "string" },
            limit: { type: "number", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "number", minimum: 0, default: 0 },
          },
        },
        response: { 200: { type: "array", items: listingSchema } },
      },
    },
    async (req) => {
      const { category, limit, offset } = req.query as { category?: Category; limit?: number; offset?: number };
      return myListings(req.userId!, category, limit, offset);
    }
  );

  app.get(
    "/listings/:id",
    {
      schema: {
        tags: ["marketplace"],
        summary: "One listing's detail — public, any status",
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        response: { 200: listingSchema },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      return getListing(id);
    }
  );

  app.get(
    "/marketplace/fee-preview",
    {
      schema: {
        tags: ["marketplace"],
        summary: "Live fee/net preview at today's configured rate, before a listing is created",
        querystring: {
          type: "object",
          required: ["category", "rarityTierLevel", "priceCents"],
          properties: {
            category: { type: "string" },
            rarityTierLevel: { type: "number", enum: [1, 2, 3] },
            priceCents: { type: "number", minimum: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              feePercent: { type: "number" },
              feeCents: { type: "number" },
              sellerProceedsCents: { type: "number" },
            },
          },
        },
      },
    },
    async (req) => {
      const { category, rarityTierLevel, priceCents } = req.query as {
        category: Category;
        rarityTierLevel: RarityTierLevel;
        priceCents: number;
      };
      return previewFeeSplit(category, rarityTierLevel, priceCents);
    }
  );

  app.post(
    "/listings",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["marketplace"],
        summary: "List an owned item for sale at a fixed price",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["ownedItemId", "priceCents"],
          properties: {
            ownedItemId: { type: "string", description: "The specific owned_items row id, not the catalog item id" },
            priceCents: { type: "number", minimum: 1 },
          },
        },
        response: { 200: listingSchema },
      },
    },
    async (req) => {
      const { ownedItemId, priceCents } = req.body as { ownedItemId: string; priceCents: number };
      return createListing(req.userId!, ownedItemId, priceCents);
    }
  );

  app.post(
    "/listings/:id/price",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["marketplace"],
        summary: "Edit the asking price on your own still-active listing",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        body: {
          type: "object",
          required: ["priceCents"],
          properties: { priceCents: { type: "number", minimum: 1 } },
        },
        response: { 200: listingSchema },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      const { priceCents } = req.body as { priceCents: number };
      return updatePrice(req.userId!, id, priceCents);
    }
  );

  app.post(
    "/listings/:id/delist",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["marketplace"],
        summary: "Cancel your own active listing",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        response: { 200: listingSchema },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      return delist(req.userId!, id);
    }
  );

  app.post(
    "/listings/:id/buy",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["marketplace"],
        summary: "Buy a listing instantly — atomic: debit buyer, credit seller minus fee, transfer ownership",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["completed", "failed"] },
              failureReason: { type: ["string", "null"] },
              listing: listingSchema,
            },
          },
        },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      return buyListing(req.userId!, id);
    }
  );
}
