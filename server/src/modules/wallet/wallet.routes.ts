import type { FastifyInstance } from "fastify";
import { getTopupByIdempotencyKey, topUp } from "./wallet.service.js";

const walletTopupResponseSchema = {
  type: "object",
  properties: {
    topupId: { type: "string" },
    status: { type: "string", enum: ["completed", "failed", "pending"] },
    amountCents: { type: "number" },
    newBalanceCents: { type: ["number", "null"] },
    failureReason: { type: ["string", "null"] },
  },
};

export async function walletRoutes(app: FastifyInstance) {
  app.post(
    "/wallet/topup",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["wallet"],
        summary: "Add funds to the signed-in user's wallet balance — sandbox economy, no real payment processor",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["idempotencyKey", "amountCents"],
          properties: {
            idempotencyKey: {
              type: "string",
              description: "Client-generated once per top-up attempt (e.g. Crypto.randomUUID()); reuse the exact same value on every retry of that attempt, never on a new one.",
            },
            amountCents: {
              type: "number",
              description: "Whole cents, e.g. 2500 for $25.",
            },
          },
        },
        response: { 200: walletTopupResponseSchema },
      },
    },
    async (req) => {
      const { idempotencyKey, amountCents } = req.body as { idempotencyKey: string; amountCents: number };
      return topUp(req.userId!, idempotencyKey, amountCents);
    }
  );

  app.get(
    "/wallet/topups/:idempotencyKey",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["wallet"],
        summary: "Reconcile a top-up after a lost response — same key, no re-execution",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["idempotencyKey"],
          properties: { idempotencyKey: { type: "string" } },
        },
        response: { 200: walletTopupResponseSchema },
      },
    },
    async (req) => {
      const { idempotencyKey } = req.params as { idempotencyKey: string };
      return getTopupByIdempotencyKey(req.userId!, idempotencyKey);
    }
  );
}
