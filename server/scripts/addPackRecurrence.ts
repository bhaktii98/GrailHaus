import "dotenv/config";
import { pool } from "../src/db/pool.js";

/**
 * Adds recurring-drop support to `packs`, additive and backward-compatible: a pack with these
 * three columns null behaves exactly as it always has (evergreen, or a plain one-off
 * goes_live_at/ends_at drop). When all three are set, the pack becomes a recurring drop — its
 * effective goes_live_at/ends_at are computed on every read from the recurrence rule instead of
 * read directly off these static columns (see packs.service.ts's `resolveDropWindow`).
 *
 * `recurrence_last_reset_at` is the lazy-reset bookmark: the first read that lands after a new
 * occurrence has started resets `stock_remaining` back to `max_stock` and stamps this column with
 * that occurrence's start, so it doesn't reset again on every subsequent read of the same
 * occurrence. No cron/worker needed — occurrence boundaries are only ever noticed on read.
 */
async function main() {
  await pool.query(`
    alter table public.packs
      add column if not exists recurrence_weekdays smallint[],
      add column if not exists recurrence_time_utc time,
      add column if not exists recurrence_duration_minutes integer,
      add column if not exists recurrence_last_reset_at timestamptz;
  `);
  console.log("done — public.packs has recurrence_weekdays/recurrence_time_utc/recurrence_duration_minutes/recurrence_last_reset_at");
  await pool.end();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
