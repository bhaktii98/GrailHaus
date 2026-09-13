import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cookie-based Supabase session client for Server Components/Actions — the
 * current officially-recommended pattern for Supabase Auth in Next.js. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render (no mutable response available) —
            // safe to ignore; session writes happen from the login Server Action instead.
          }
        },
      },
    }
  );
}
