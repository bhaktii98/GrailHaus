import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTVerifyGetKey } from "jose";

export class InvalidTokenError extends Error {}

const APP_TOKEN_ISSUER = "grailhaus-app";

/** Signs a GrailHaus-issued access token (HS256, our own secret) — used by the mobile
 * app's own email/password auth, not Supabase. Long-lived (90d): this is a dev-scope
 * project with no refresh-token flow, not a production session model. */
export async function signAppAccessToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(APP_TOKEN_ISSUER)
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(new TextEncoder().encode(secret));
}

/** Verifies a GrailHaus-issued access token. Deliberately separate from
 * `verifyAccessToken` below (which stays Supabase-JWKS-only, for the admin
 * dashboard's still-Supabase-backed login) rather than one function trying to
 * handle both token shapes. */
export async function verifyAppAccessToken(token: string, secret: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: APP_TOKEN_ISSUER,
    });
    if (typeof payload.sub !== "string") {
      throw new InvalidTokenError("Token has no subject");
    }
    return payload.sub;
  } catch {
    throw new InvalidTokenError("Invalid or expired token");
  }
}

const jwksCache = new Map<string, JWTVerifyGetKey>();

function getJwks(supabaseUrl: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(supabaseUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    jwksCache.set(supabaseUrl, jwks);
  }
  return jwks;
}

/**
 * Verifies a Supabase-issued access token against a project's JWKS and
 * returns the user id (`sub`). Shared between the Fastify server and the
 * admin dashboard so both apps enforce auth identically, not via a copy —
 * `jose` is Edge- and Node-compatible, which matters since Next.js
 * middleware/edge runtimes can't use a raw `pg`/Node-only verifier.
 */
export async function verifyAccessToken(token: string, supabaseUrl: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, getJwks(supabaseUrl), {
      issuer: `${supabaseUrl}/auth/v1`,
    });
    if (typeof payload.sub !== "string") {
      throw new InvalidTokenError("Token has no subject");
    }
    return payload.sub;
  } catch {
    throw new InvalidTokenError("Invalid or expired token");
  }
}
