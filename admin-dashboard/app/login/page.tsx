"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Button, Input } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const denied = useSearchParams().get("denied") === "1";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-[120px]"
        style={{ background: "radial-gradient(circle, var(--color-accent), transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm px-6">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface text-2xl">
            ◈
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text">GrailHaus Admin</h1>
          <p className="mt-1.5 text-sm text-text-soft">
            Sign in with an admin account. Non-admin accounts are denied after verification.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6">
          {denied && !sent && (
            <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
              That sign-in worked, but the account isn&apos;t an admin — ask someone with database
              access to set <code className="font-mono">profiles.is_admin = true</code> for it.
            </p>
          )}

          {sent ? (
            <p className="text-sm text-text-soft">
              Check <strong className="text-text">{email}</strong> and click the sign-in link — no
              code to type, just open it on this device.
            </p>
          ) : (
            <form onSubmit={sendLink} className="flex flex-col gap-3">
              <Input
                type="email"
                required
                placeholder="you@grailhaus.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" disabled={busy}>
                {busy ? "Sending…" : "Send sign-in link"}
              </Button>
            </form>
          )}

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}
        </div>
      </div>
    </main>
  );
}
