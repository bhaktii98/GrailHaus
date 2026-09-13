import "dotenv/config";
import { pool } from "../src/db/pool.js";

/**
 * One-off schema script for the new `wallet_topups` table — same "no migrations folder, applied
 * by hand against the live Postgres instance" convention seedCategories.ts already documents and
 * follows. No seed data here (unlike that script) — this table starts empty; every row in it is
 * a real user-initiated top-up going forward, not sample data.
 *
 * `user_id` is deliberately `text`, not a `uuid` foreign key — this repo's other financial table
 * (`purchases`) was created directly against Supabase outside this codebase, so its exact column
 * type was never verified here; a mismatched FK type would fail to apply rather than degrade
 * gracefully. Application code is the only thing that ever joins on it, and a loose text column
 * works identically for that.
 */
async function main() {
  await pool.query(`
    create table if not exists public.wallet_topups (
      id uuid primary key default gen_random_uuid(),
      idempotency_key text not null unique,
      user_id text not null,
      amount_cents bigint not null,
      status text not null default 'pending',
      new_balance_cents bigint,
      failure_reason text,
      created_at timestamptz not null default now(),
      completed_at timestamptz
    )
  `);
  await pool.query(`
    create index if not exists wallet_topups_user_id_idx on public.wallet_topups (user_id)
  `);

  console.log("wallet_topups table ready.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
