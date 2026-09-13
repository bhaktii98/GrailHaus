/**
 * A minimal analytics sink.
 *
 * There is no analytics provider wired into this stack today and no server endpoint to receive
 * events, so this deliberately does not pretend to be one: it type-checks the event vocabulary,
 * keeps a small in-memory ring buffer for debugging, and logs in development. That is genuinely
 * all it does.
 *
 * It exists as a real module rather than scattered `console.log`s so that adding a provider later
 * is a change to `track` alone — every call site already speaks the right vocabulary, with the
 * right payload shape, at the right moment. Swapping in Segment/PostHog/an internal endpoint
 * means implementing one function.
 *
 * Nothing here sends identifying information: events carry pack/tier/count/value facts about a
 * run, never the user, their balance, or their account.
 */

export type AnalyticsEvent =
  | "bulk_purchase_started"
  | "bulk_purchase_completed"
  | "bulk_reveal_started"
  | "grail_hunt_started"
  | "grail_revealed"
  | "best_grail_revealed"
  | "prime_stage_started"
  | "core_stage_started"
  | "batch_summary_viewed"
  | "bulk_reveal_completed";

export interface AnalyticsPayload {
  tier?: string;
  packId?: string;
  quantity?: number;
  totalCards?: number;
  grailCount?: number;
  primeCount?: number;
  coreCount?: number;
  bestPullId?: string;
  bestPullValueCents?: number;
  grailIndex?: number;
  durationMs?: number;
  [key: string]: string | number | boolean | undefined;
}

interface RecordedEvent {
  event: AnalyticsEvent;
  payload: AnalyticsPayload;
  at: number;
}

const BUFFER_LIMIT = 100;
const buffer: RecordedEvent[] = [];

export function track(event: AnalyticsEvent, payload: AnalyticsPayload = {}): void {
  const record: RecordedEvent = { event, payload, at: Date.now() };
  buffer.push(record);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();
  if (__DEV__) {
    console.log(`[analytics] ${event}`, payload);
  }
}

/** The recent event buffer — for debugging and for tests that assert a flow emitted what it should. */
export function recentEvents(): readonly RecordedEvent[] {
  return buffer;
}

export function resetAnalytics(): void {
  buffer.length = 0;
}
