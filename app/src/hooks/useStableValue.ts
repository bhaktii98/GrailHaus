import { useRef } from "react";

/**
 * Returns the same object/array reference across renders as long as its value hasn't actually
 * changed — even when the caller passes a freshly-computed one every time.
 *
 * Needed because react-query hands back a brand-new top-level array/object on every refetch
 * (even a polled one that returns byte-identical data isn't guaranteed to structurally-share
 * every branch once *any* sibling in the response changed), and any `useMemo` derived from that
 * data inherits a fresh reference too — cascading a re-render through every consumer, however
 * unrelated to what actually changed. Wrapping a derived value in this breaks that cascade: a
 * component reading it only re-renders when the value it actually reads is different, not
 * whenever the upstream query happened to tick.
 *
 * Plain-data only (no functions, no Dates/Maps/Sets) — everything this wraps today (catalog
 * summaries, drop lists) is JSON-safe API response data already.
 */
export function useStableValue<T>(value: T): T {
  const ref = useRef(value);
  const prevJson = useRef(JSON.stringify(value));
  const nextJson = JSON.stringify(value);
  if (nextJson !== prevJson.current) {
    ref.current = value;
    prevJson.current = nextJson;
  }
  return ref.current;
}
