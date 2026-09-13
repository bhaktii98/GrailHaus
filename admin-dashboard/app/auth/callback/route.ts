import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

/** Where a magic-link email sends the browser back to. Exchanges the one-time
 * `code` for a real session (cookie-based, via @supabase/ssr), then lands on
 * the dashboard — requireAdmin() takes it from there. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/`);
}
