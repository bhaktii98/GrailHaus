import type { FastifyInstance } from "fastify";
import { getCurrentProfile } from "./profile.service.js";

export async function profileRoutes(app: FastifyInstance) {
  app.get(
    "/me",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["profile"],
        summary: "The signed-in user's own profile",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string", description: "Opaque public id, e.g. usr_..." },
              displayName: { type: ["string", "null"] },
              username: { type: ["string", "null"], description: "The public Collector ID, null until claimed" },
              balanceCents: { type: "number" },
              createdAt: { type: "string" },
            },
          },
        },
      },
    },
    async (req) => getCurrentProfile(req.userId!)
  );
}
