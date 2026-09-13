import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db/pool.js";
import { purchase } from "../src/modules/purchase/purchase.service.js";

/**
 * Concurrency harness (PRD §26 / instructions.md's "you must ship a concurrency harness — fires
 * N concurrent purchase requests at the last unit of a given SKU — shelf or drop"). Fires N
 * concurrent purchases at a real pack, temporarily pinned to a small finite stock and forced
 * live, and verifies inventory reconciles exactly afterward.
 *
 * Works against *any* pack tier — evergreen shelf, a one-off timed drop, or a recurring drop
 * (see packs/dropRecurrence.ts) — by temporarily overriding whatever availability fields that
 * pack has (goes_live_at/ends_at/recurrence_*) to "definitely live right now, no recurrence,"
 * running the hammer, then restoring every touched field exactly as found. That's deliberate:
 * the recurrence *math* already has its own unit tests (dropRecurrence.test.ts) — what this
 * harness is actually proving is that concurrent purchases against the pack's stock lock can't
 * oversell, which is the same question regardless of which availability model got the pack to
 * "live" in the first place.
 *
 * All N attempts run as the same seeded test profile rather than N fabricated identities —
 * `profiles.id` has a real FK to `auth.users` (the Supabase signup trigger), so minting
 * throwaway buyers would mean writing directly into Supabase's auth schema, which is more
 * invasive than this needs. What's actually under test — whether concurrent transactions
 * racing on the *pack's* stock lock can ever oversell — doesn't depend on the buyers being
 * distinct people; the pack-row lock is what's contended, and a purchase's own user_id has
 * no bearing on whether another concurrent purchase can slip past it. Every row this script
 * touches (balance, stock, pressure state, drop timing) is restored to its original value on exit.
 *
 * Calls `purchase()` directly rather than over HTTP: what's actually under test is the
 * transaction/locking logic in purchase.service.ts (the thing that can oversell or
 * double-spend), not the JWT-verification layer in front of it, which is a separate,
 * already-covered concern.
 *
 * Usage: npm run hammer -- [concurrency] [startingStock] [tier]
 *   npm run hammer                              → street_rip (evergreen shelf), 20 buyers, stock 5
 *   npm run hammer -- 30 3 black_label_drop      → a timed/recurring drop pack instead
 */

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";
// 10, not the higher number this used to default to — the app's own pool.ts now caps at 8
// connections (see that file's own comment on why: staying well under Supabase's shared
// session-mode pooler limit), so this still exercises genuine queuing/contention (10 > 8)
// without alone risking that shared ceiling. Pass a higher value explicitly to stress harder.
const CONCURRENCY = Number(process.argv[2] ?? 10);
const STARTING_STOCK = Number(process.argv[3] ?? 5);
const TIER = process.argv[4] ?? "street_rip";

interface DropTimingSnapshot {
  goesLiveAt: string | null;
  endsAt: string | null;
  recurrenceWeekdays: number[] | null;
  recurrenceTimeUtc: string | null;
  recurrenceDurationMinutes: number | null;
  recurrenceLastResetAt: string | null;
}

async function main() {
  const { rows: packRows } = await pool.query<{
    id: string;
    price_cents: string;
    item_count: number;
    stock_remaining: number | null;
    goes_live_at: string | null;
    ends_at: string | null;
    recurrence_weekdays: number[] | null;
    recurrence_time_utc: string | null;
    recurrence_duration_minutes: number | null;
    recurrence_last_reset_at: string | null;
    last_restocked_at: string | null;
  }>(
    `select id, price_cents, item_count, stock_remaining, goes_live_at, ends_at,
            recurrence_weekdays, recurrence_time_utc, recurrence_duration_minutes, recurrence_last_reset_at,
            last_restocked_at
     from public.packs where tier = $1`,
    [TIER]
  );
  const pack = packRows[0];
  if (!pack) throw new Error(`Seed data missing: no '${TIER}' pack found — run against a seeded database.`);

  const { rows: profileRows } = await pool.query<{ balance_cents: string }>(
    "select balance_cents from public.profiles where id = $1",
    [TEST_USER_ID]
  );
  if (!profileRows[0]) {
    throw new Error(`Seed data missing: test profile ${TEST_USER_ID} not found — run against a seeded database.`);
  }

  const originalStock = pack.stock_remaining;
  const originalLastRestockedAt = pack.last_restocked_at;
  const originalBalance = Number(profileRows[0].balance_cents);
  const priceCents = Number(pack.price_cents);
  const originalTiming: DropTimingSnapshot = {
    goesLiveAt: pack.goes_live_at,
    endsAt: pack.ends_at,
    recurrenceWeekdays: pack.recurrence_weekdays,
    recurrenceTimeUtc: pack.recurrence_time_utc,
    recurrenceDurationMinutes: pack.recurrence_duration_minutes,
    recurrenceLastResetAt: pack.recurrence_last_reset_at,
  };
  const isDrop = originalTiming.goesLiveAt != null || originalTiming.recurrenceWeekdays != null;

  const { rows: pressureRows } = await pool.query<{ consecutive_without_qualifying: number }>(
    "select consecutive_without_qualifying from public.user_pressure_state where user_id = $1 and pack_id = $2",
    [TEST_USER_ID, pack.id]
  );
  const hadPressureRow = pressureRows.length > 0;
  const originalPressure = pressureRows[0]?.consecutive_without_qualifying ?? 0;

  // Everything from here on mutates real rows, so it's all inside one try/finally — if setup
  // itself throws partway through (as it did once, mid-development: the stock write landed,
  // the very next write threw, and nothing had restored it), the finally block below still
  // runs and puts the pack and profile back exactly as found.
  let exitCode = 0;
  const purchaseIds: string[] = [];
  try {
    // `last_restocked_at = now()` alongside the forced stock level — an evergreen pack's own
    // lazy-restock-catchup (packs.repository.ts's lockPackForPurchase, a real, correct feature
    // for actual usage) reads elapsed time since this column on every single lock acquisition.
    // Left at its real, possibly-hours-stale value, the very first purchase in the run sees a
    // huge backlog of "owed" restock ticks and refills the pack back toward max_stock *during*
    // the hammer — which silently erases the low-stock scenario this harness exists to test
    // (this is exactly what happened before this line existed: every buyer "succeeded" because
    // the pack was quietly restocked out from under the test, not because of an oversell bug).
    await pool.query("update public.packs set stock_remaining = $1, last_restocked_at = now() where id = $2", [
      STARTING_STOCK,
      pack.id,
    ]);
    await pool.query("update public.profiles set balance_cents = $1 where id = $2", [
      priceCents * CONCURRENCY * 2,
      TEST_USER_ID,
    ]);
    if (isDrop) {
      // Forced into "definitely live, no recurrence, no end in sight" for the duration of the
      // run — a drop pack the harness picked wouldn't otherwise reliably be inside its own live
      // window at whatever moment this happens to run.
      await pool.query(
        `update public.packs
         set goes_live_at = now() - interval '1 minute', ends_at = null,
             recurrence_weekdays = null, recurrence_time_utc = null, recurrence_duration_minutes = null
         where id = $1`,
        [pack.id]
      );
    }

    console.log(
      `Hammering ${pack.id} (${TIER}${isDrop ? ", drop" : ""}): stock=${STARTING_STOCK}, ${CONCURRENCY} concurrent buyers, $${(
        priceCents / 100
      ).toFixed(2)}/pack\n`
    );

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, () => purchase(TEST_USER_ID, randomUUID(), pack.id, 1))
    );

    for (const r of results) {
      if (r.status === "fulfilled") purchaseIds.push(r.value.purchaseId);
    }

    const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.status === "completed");
    const failed = results.filter((r) => !(r.status === "fulfilled" && r.value.status === "completed"));

    console.log(`Succeeded: ${succeeded.length}`);
    console.log(`Failed:    ${failed.length}`);
    for (const [i, r] of failed.entries()) {
      if (r.status === "rejected") console.log(`  buyer ${i}: threw — ${r.reason}`);
      else console.log(`  buyer ${i}: ${r.value.status}${r.value.failureReason ? ` (${r.value.failureReason})` : ""}`);
    }

    const { rows: finalPack } = await pool.query<{ stock_remaining: number }>(
      "select stock_remaining from public.packs where id = $1",
      [pack.id]
    );
    const { rows: ownedCountRows } = await pool.query<{ count: string }>(
      "select count(*) from public.owned_items where purchase_id = any($1)",
      [purchaseIds]
    );

    const expectedSuccesses = Math.min(CONCURRENCY, STARTING_STOCK);
    const expectedStockLeft = STARTING_STOCK - expectedSuccesses;
    const actualStockLeft = finalPack[0].stock_remaining;
    const expectedItems = expectedSuccesses * pack.item_count;
    const actualItems = Number(ownedCountRows[0].count);

    console.log(`\nExpected successes: ${expectedSuccesses}   Actual: ${succeeded.length}`);
    console.log(`Expected stock left: ${expectedStockLeft}   Actual: ${actualStockLeft}`);
    console.log(`Expected owned_items: ${expectedItems}   Actual: ${actualItems}`);

    const ok =
      succeeded.length === expectedSuccesses && actualStockLeft === expectedStockLeft && actualItems === expectedItems;

    console.log(ok ? "\nPASS — no oversell, no undersell, exact accounting." : "\nFAIL — inventory does not reconcile.");
    exitCode = ok ? 0 : 1;
  } finally {
    await pool.query("delete from public.owned_items where purchase_id = any($1)", [purchaseIds]);
    await pool.query("delete from public.purchases where id = any($1)", [purchaseIds]);
    if (hadPressureRow) {
      await pool.query(
        "update public.user_pressure_state set consecutive_without_qualifying = $1 where user_id = $2 and pack_id = $3",
        [originalPressure, TEST_USER_ID, pack.id]
      );
    } else {
      await pool.query("delete from public.user_pressure_state where user_id = $1 and pack_id = $2", [
        TEST_USER_ID,
        pack.id,
      ]);
    }
    await pool.query("update public.profiles set balance_cents = $1 where id = $2", [originalBalance, TEST_USER_ID]);
    await pool.query(
      `update public.packs
       set stock_remaining = $2, goes_live_at = $3, ends_at = $4,
           recurrence_weekdays = $5, recurrence_time_utc = $6, recurrence_duration_minutes = $7,
           recurrence_last_reset_at = $8, last_restocked_at = $9
       where id = $1`,
      [
        pack.id,
        originalStock,
        originalTiming.goesLiveAt,
        originalTiming.endsAt,
        originalTiming.recurrenceWeekdays,
        originalTiming.recurrenceTimeUtc,
        originalTiming.recurrenceDurationMinutes,
        originalTiming.recurrenceLastResetAt,
        originalLastRestockedAt,
      ]
    );
    await pool.end();
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
