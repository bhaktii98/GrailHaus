import type { FastifyInstance } from "fastify";
import { checkUsernameAvailability, claimUsernameForUser } from "./username.service.js";

export async function usernameRoutes(app: FastifyInstance) {
  app.get(
    "/username/availability",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["username"],
        summary: "Check whether a Collector ID is free to claim",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["u"],
          properties: { u: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              username: { type: "string" },
              available: { type: "boolean" },
            },
          },
        },
      },
    },
    async (req) => {
      const { u } = req.query as { u: string };
      return checkUsernameAvailability(u);
    }
  );

  app.post(
    "/username",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["username"],
        summary: "Claim this account's Collector ID — one-time, permanent",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["username"],
          properties: { username: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: { username: { type: "string" } },
          },
        },
      },
    },
    async (req) => {
      const { username } = req.body as { username: string };
      return claimUsernameForUser(req.userId!, username);
    }
  );
}
