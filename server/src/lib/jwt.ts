import { verifyAppAccessToken as verify, InvalidTokenError } from "@grailhaus/shared";
import { env } from "../config/env.js";

export { InvalidTokenError };

/** Thin re-export bound to this server's own app JWT secret — the real verification
 * logic lives in @grailhaus/shared. Not Supabase: the mobile app's email/password auth
 * (modules/auth) issues these tokens itself now. The admin dashboard's separate
 * magic-link login still verifies Supabase-issued tokens directly via `verifyAccessToken`
 * from @grailhaus/shared, which this server no longer uses anywhere. */
export function verifyAccessToken(token: string): Promise<string> {
  return verify(token, env.appJwtSecret);
}
