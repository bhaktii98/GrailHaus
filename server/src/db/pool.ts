import { Pool } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: { rejectUnauthorized: false },
  // DATABASE_URL points at Supabase's *transaction-mode* pooler (port 6543), not session mode
  // (5432) — session mode only allows 15 total concurrent client sessions project-wide, which
  // Supabase's own platform services (Supavisor, PostgREST, pg_net, pg_cron, the metrics
  // exporter) were already consuming most of on their own, so this app had almost no headroom
  // left before ever touching it. Transaction mode multiplexes far more client sessions onto a
  // shared backend pool (a connection is only tied to one client for the span of one
  // transaction), which is exactly this app's own usage pattern — every multi-statement
  // transaction here (see purchase.service.ts) already does BEGIN...COMMIT on one held `client`
  // and nothing outside that span needs session-level state (no prepared statements kept across
  // requests, no advisory-lock-across-requests, etc.), so the switch is safe. `max` can be
  // generous here for the same reason it couldn't be under session mode.
  max: 20,
  // node-postgres's own default is 0 — no timeout, wait forever. That turned a real pooler
  // slot exhaustion into a silent, unkillable-except-by-force hang once (see scripts/hammer.ts's
  // own header) instead of a clear, catchable error. Bounded here so contention surfaces as a
  // thrown error within a few seconds, never as a stuck process.
  connectionTimeoutMillis: 15_000,
});
