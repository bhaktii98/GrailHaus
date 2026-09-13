import type { FastifyInstance } from "fastify";
import { getPurchaseByIdempotencyKey, purchase } from "./purchase.service.js";
import { itemDetailSchema } from "../items/items.schema.js";

// Fastify's response schemas serialize via fast-json-stringify, which silently drops any
// property not explicitly declared here — spreading itemDetailSchema's properties rather than
// nesting it is what lets `ownedItemId` actually reach the client alongside them (see
// packs.routes.ts's `slotProbabilities.probabilities` for what happens when a field is left
// off: it comes back as `{}`/missing, not an error).
const pulledOwnedItemSchema = {
  type: "object",
  properties: {
    ...itemDetailSchema.properties,
    ownedItemId: {
      type: "string",
      description: "The owned_items row this pull created — lets the client act on this exact copy (view it, sell it) without a separate portfolio lookup.",
    },
  },
};

const purchaseResponseSchema = {
  type: "object",
  properties: {
    purchaseId: { type: "string" },
    status: { type: "string", enum: ["completed", "failed", "pending"] },
    packId: { type: "string" },
    quantity: { type: "number" },
    totalPriceCents: { type: ["number", "null"] },
    failureReason: { type: ["string", "null"] },
    items: {
      type: "array",
      description: "Full catalog detail per pulled item, plus the ownedItemId purchase created for it",
      items: pulledOwnedItemSchema,
    },
  },
};

export async function purchaseRoutes(app: FastifyInstance) {
  app.post(
    "/purchase",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["purchase"],
        summary: "Buy a pack — single or bulk, evergreen or drop, all one atomic path",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["idempotencyKey", "packId", "quantity"],
          properties: {
            idempotencyKey: {
              type: "string",
              description: "Client-generated once per purchase attempt (e.g. Crypto.randomUUID()); reuse the exact same value on every retry of that attempt, never on a new one.",
            },
            packId: { type: "string" },
            quantity: { type: "number", enum: [1, 10], description: "1 for a single pack, 10 for the bulk buy — no other value is a real purchase mode" },
          },
        },
        response: { 200: purchaseResponseSchema },
      },
    },
    async (req) => {
      const { idempotencyKey, packId, quantity } = req.body as {
        idempotencyKey: string;
        packId: string;
        quantity: number;
      };
      return purchase(req.userId!, idempotencyKey, packId, quantity);
    }
  );

  app.get(
    "/purchases/:idempotencyKey",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["purchase"],
        summary: "Reconcile a purchase after a lost response — same key, no re-execution",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["idempotencyKey"],
          properties: { idempotencyKey: { type: "string" } },
        },
        response: { 200: purchaseResponseSchema },
      },
    },
    async (req) => {
      const { idempotencyKey } = req.params as { idempotencyKey: string };
      return getPurchaseByIdempotencyKey(req.userId!, idempotencyKey);
    }
  );
}
