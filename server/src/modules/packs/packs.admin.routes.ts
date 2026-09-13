import type { FastifyInstance } from "fastify";
import { adminUpdatePack, type AdminUpdatePackInput } from "./packs.admin.service.js";
import { packSkuSchema } from "./packs.routes.js";

export async function packsAdminRoutes(app: FastifyInstance) {
  app.patch(
    "/admin/packs/:id",
    {
      preHandler: app.requireAdmin,
      schema: {
        tags: ["admin"],
        summary: "Edit a pack's price, item count, and/or slot probabilities — admin only",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            priceCents: { type: "number", minimum: 1 },
            itemCount: { type: "number", minimum: 1 },
            stockRemaining: { type: ["number", "null"], minimum: 0 },
            maxStock: { type: ["number", "null"], minimum: 0, description: "Evergreen restock ceiling, or a drop's starting inventory." },
            restockAmount: {
              type: ["number", "null"],
              minimum: 1,
              description: "How much stock is added back per interval. Set to null to make this pack never restock (a drop).",
            },
            restockIntervalSeconds: { type: ["number", "null"], minimum: 1 },
            goesLiveAt: {
              type: ["string", "null"],
              description: "ISO datetime. Null = evergreen, available immediately. A future date makes this a scheduled drop.",
            },
            endsAt: { type: ["string", "null"], description: "ISO datetime — optional hard cutoff for a drop." },
            recurrenceWeekdays: {
              type: ["array", "null"],
              items: { type: "number", minimum: 0, maximum: 6 },
              description:
                "0=Sunday..6=Saturday. Set together with recurrenceTimeUtc/recurrenceDurationMinutes to make this a recurring drop (goes live on this cadence indefinitely, restocking to maxStock each occurrence) instead of a one-off goesLiveAt/endsAt. Send an empty array (or null) to turn a recurring drop back into a plain one-off/evergreen pack.",
            },
            recurrenceTimeUtc: {
              type: ["string", "null"],
              description: "\"HH:MM\" UTC, e.g. \"18:00\" — the time of day each occurrence starts.",
            },
            recurrenceDurationMinutes: {
              type: ["number", "null"],
              minimum: 1,
              description: "How long each occurrence stays live before closing until its next scheduled day.",
            },
            slotProbabilities: {
              type: "array",
              description:
                "Optional. If provided, every touched slot position must include all 3 rarity tiers together, summing to exactly 100 — a partial single-tier update is rejected, since its sum can't be checked.",
              items: {
                type: "object",
                required: ["slotPosition", "rarityTierLevel", "probabilityPercent"],
                properties: {
                  slotPosition: { type: "number", minimum: 1, description: "1 = first pull, etc." },
                  rarityTierLevel: { type: "number", enum: [1, 2, 3] },
                  probabilityPercent: { type: "number", minimum: 0, maximum: 100 },
                },
              },
            },
          },
        },
        response: { 200: packSkuSchema },
      },
    },
    async (req) => {
      const { id } = req.params as { id: string };
      return adminUpdatePack(id, req.body as AdminUpdatePackInput);
    }
  );
}
