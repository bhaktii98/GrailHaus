import { redirect } from "next/navigation";
import { verifyAccessToken } from "@grailhaus/shared";
import { pool } from "./db";
import { createSupabaseServerClient } from "./supabaseServer";

/**
 * Called at the top of the dashboard's root layout — not a middleware.ts edge
 * function, deliberately, since Next.js middleware defaults to the Edge
 * runtime where a raw `pg` TCP connection isn't available. This runs in the
 * Node runtime (Server Components do by default), so a direct DB lookup for
 * the admin flag is fine here.
 *
 * `redirect()` throws internally — never call it inside a try/catch, or the
 * catch swallows the redirect instead of letting it propagate.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) redirect("/login");

  let userId: string | null = null;
  try {
    userId = await verifyAccessToken(session.access_token, process.env.NEXT_PUBLIC_SUPABASE_URL!);
  } catch {
    userId = null;
  }
  if (!userId) redirect("/login");

  const { rows } = await pool.query<{ is_admin: boolean }>(
    "select is_admin from public.profiles where id = $1",
    [userId]
  );
  // Distinct from "not logged in" — a real, verified session that just isn't
  // an admin. Same destination, but the query param lets /login tell them apart.
  if (!rows[0]?.is_admin) redirect("/login?denied=1");

  return { userId };
}
