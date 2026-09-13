import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { PRICE_DRIFT_TICK_MS } from "@grailhaus/shared";

/** The next 30s drift boundary after `from`, in ms since epoch. */
function nextTickAt(from: number): number {
  return Math.floor(from / PRICE_DRIFT_TICK_MS) * PRICE_DRIFT_TICK_MS + PRICE_DRIFT_TICK_MS;
}

/**
 * A clock that advances exactly when item prices do, so a screen can keep a live total ticking
 * without asking the server for it.
 *
 * ## Why this instead of polling or a subscription
 *
 * Simulated price drift (PRD §28) is not stored anywhere — `computePriceDrift` is a pure function
 * of (item id, category, base value, time), evaluated fresh on every read. The server computes it
 * in `toItemDetail`; the app has the exact same function available from `@grailhaus/shared`. So
 * the three options are not equivalent:
 *
 * - **Realtime subscription (websocket/SSE).** Nothing to push. There is no price *event* — no
 *   process anywhere writes a new price that a channel could carry. The stack has no websocket
 *   layer and no worker to run one, so this would mean standing up push infrastructure whose only
 *   job is to broadcast "it is now 30 seconds later," which the device already knows.
 * - **Polling `/me/portfolio` on the tick.** Correct, but re-downloads the entire catalog payload
 *   for every held item (~700 rows for the largest account here) twice a minute to learn numbers
 *   the client can derive for free — and still shows a value up to one round-trip stale.
 * - **Ticking locally on the same 30s grid (this).** Zero network, zero staleness, and provably
 *   identical to what the server would have said: same formula, same inputs, and the tick grid is
 *   anchored to a fixed shared epoch rather than to when the app happened to start, so every
 *   client and the server land on the same tick index at the same instant.
 *
 * Polling is still used, just for the thing polling is actually for: *ownership* changes (a pack
 * ripped, an item sold, a listing created) are real server-side events with no client-side
 * formula, so the portfolio queries refetch on a slow interval and on window focus. Prices tick
 * here; facts come from the server. See `usePortfolioViewModel`.
 *
 * The timer is scheduled to land on the boundary rather than every 30s from mount, so the number
 * changes when the price actually changes. It also resyncs when the app returns from the
 * background, where timers are throttled or suspended outright.
 */
export function useDriftClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function scheduleNextTick() {
      const at = Date.now();
      timer = setTimeout(() => {
        setNow(new Date());
        scheduleNextTick();
      }, Math.max(250, nextTickAt(at) - at));
    }

    scheduleNextTick();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      // Foregrounding can land arbitrarily far past the tick the timer was waiting on — catch the
      // display up immediately, then re-anchor to the next real boundary.
      setNow(new Date());
      clearTimeout(timer);
      scheduleNextTick();
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return now;
}
