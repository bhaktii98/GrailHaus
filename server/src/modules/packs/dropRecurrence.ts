/**
 * Pure recurrence math for a "recurring drop" — a pack that goes live on a repeating weekly
 * schedule (e.g. Mon/Wed/Fri at 18:00 UTC, live for 2 hours) instead of a single fixed
 * goes_live_at/ends_at window. Everything here is a pure function of (rule, now) so it's cheap
 * to call on every read and trivial to test without a clock or a database.
 *
 * All times are UTC throughout — the admin dashboard configures the rule in UTC, and the app
 * only ever displays the `goesLiveAt`/`endsAt` timestamps this produces, never the raw rule
 * (see PackSku's own doc comment in shared/src/types.ts for why: one clock, computed in one
 * place, so every client agrees on the same phase regardless of its own timezone/clock skew).
 */

export interface DropRecurrenceRule {
  /** 0=Sunday..6=Saturday (matches `Date#getUTCDay()`), at least one entry. */
  weekdays: number[];
  /** "HH:MM" or "HH:MM:SS", UTC. */
  timeUtc: string;
  durationMinutes: number;
}

export interface DropOccurrence {
  phase: "live" | "soon";
  goesLiveAt: Date;
  endsAt: Date;
}

/** How far back/forward to search for a candidate occurrence — a week each direction always
 * brackets "the occurrence currently live, if any" and "the next one after now" regardless of
 * which weekdays are picked or where `now` falls in the week. */
const SEARCH_DAYS_BACK = 8;
const SEARCH_DAYS_FORWARD = 8;

function parseTimeUtc(timeUtc: string): { hours: number; minutes: number; seconds: number } {
  const [h, m, s] = timeUtc.split(":").map((part) => Number.parseInt(part, 10));
  return { hours: h || 0, minutes: m || 0, seconds: s || 0 };
}

/** Every occurrence start within [now - SEARCH_DAYS_BACK, now + SEARCH_DAYS_FORWARD], sorted
 * ascending. Walking whole UTC days (not "next Monday, then next Wednesday...") is what makes
 * this correct regardless of how `weekdays` is ordered or how many of them there are. */
function candidateStarts(rule: DropRecurrenceRule, now: Date): Date[] {
  const { hours, minutes, seconds } = parseTimeUtc(rule.timeUtc);
  const weekdaySet = new Set(rule.weekdays);
  const starts: Date[] = [];
  const dayCursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let offset = -SEARCH_DAYS_BACK; offset <= SEARCH_DAYS_FORWARD; offset++) {
    const day = new Date(dayCursor.getTime() + offset * 86_400_000);
    if (!weekdaySet.has(day.getUTCDay())) continue;
    starts.push(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hours, minutes, seconds)));
  }
  return starts.sort((a, b) => a.getTime() - b.getTime());
}

/** The occurrence that's either live right now, or the next one coming up. Null only for a
 * malformed rule (no weekdays) — callers treat that the same as "not a recurring drop." */
export function computeDropOccurrence(rule: DropRecurrenceRule, now: Date): DropOccurrence | null {
  if (rule.weekdays.length === 0 || rule.durationMinutes <= 0) return null;
  const durationMs = rule.durationMinutes * 60_000;
  const starts = candidateStarts(rule, now);

  const nowMs = now.getTime();
  let current: Date | null = null;
  let next: Date | null = null;
  for (const start of starts) {
    const startMs = start.getTime();
    if (startMs <= nowMs && nowMs < startMs + durationMs) {
      current = start;
      break;
    }
    if (startMs > nowMs && next == null) next = start;
  }

  if (current) return { phase: "live", goesLiveAt: current, endsAt: new Date(current.getTime() + durationMs) };
  if (next) return { phase: "soon", goesLiveAt: next, endsAt: new Date(next.getTime() + durationMs) };
  // Only reachable if the search window itself is too narrow for the given rule, which can't
  // happen for any real weekly rule (at most a 7-day gap between occurrences) — kept as a safe
  // fallback rather than throwing, since a drop the math can't currently place is still better
  // shown as "soon, next week" than crashing the request.
  return null;
}
