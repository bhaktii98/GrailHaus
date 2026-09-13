import type { FastifyInstance } from "fastify";
import { pool } from "../../db/pool.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        summary: "Liveness + DB connectivity check",
        response: {
          200: {
            type: "object",
            properties: { ok: { type: "boolean" }, db: { type: "string" } },
          },
          503: {
            type: "object",
            properties: { ok: { type: "boolean" }, db: { type: "string" } },
          },
        },
      },
    },
    async (_req, reply) => {
      try {
        await pool.query("select 1");
        return { ok: true, db: "connected" };
      } catch (err) {
        app.log.error(err);
        reply.code(503);
        return { ok: false, db: "unreachable" };
      }
    }
  );
}
