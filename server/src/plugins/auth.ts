import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { InvalidTokenError, verifyAccessToken } from "../lib/jwt.js";
import { pool } from "../db/pool.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Same identity check as `authenticate`, plus a `profiles.is_admin` lookup — for the
     * admin-only mutation routes (pack/slot edits, etc.), not used by anything user-facing. */
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Identifies the caller when a valid bearer token happens to be present, and does nothing
     * at all when one isn't — for routes that stay public but behave differently for a signed-in
     * caller (e.g. `/listings` hiding your own listings from Browse). Never sends a 401. */
    identifyOptional: (req: FastifyRequest) => Promise<void>;
  }
}

async function verifyAndSetUserId(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    reply.code(401).send({ error: "Missing bearer token" });
    return false;
  }
  try {
    req.userId = await verifyAccessToken(token);
    return true;
  } catch (err) {
    if (err instanceof InvalidTokenError) {
      reply.code(401).send({ error: err.message });
      return false;
    }
    throw err;
  }
}

/**
 * fastify-plugin bypasses Fastify's default encapsulation — without it, the
 * `authenticate`/`requireAdmin` decorators and `userId` request property would only be
 * visible inside this plugin's own scope, not to the sibling route modules
 * (profile, packs, ...) that need to reference them.
 */
export const authPlugin = fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("userId", undefined);

  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    await verifyAndSetUserId(req, reply);
  });

  app.decorate("identifyOptional", async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) return;
    try {
      req.userId = await verifyAccessToken(token);
    } catch (err) {
      // An expired or malformed token on a public route is not an error — the caller simply
      // stays anonymous and gets the unauthenticated view, exactly as if they'd sent no token.
      if (!(err instanceof InvalidTokenError)) throw err;
    }
  });

  app.decorate("requireAdmin", async (req: FastifyRequest, reply: FastifyReply) => {
    const identified = await verifyAndSetUserId(req, reply);
    if (!identified) return; // verifyAndSetUserId already sent the 401

    const { rows } = await pool.query<{ is_admin: boolean }>(
      "select is_admin from public.profiles where id = $1",
      [req.userId]
    );
    if (!rows[0]?.is_admin) {
      reply.code(403).send({ error: "Admin access required" });
    }
  });
});
