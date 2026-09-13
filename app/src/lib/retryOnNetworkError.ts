import { NetworkError } from "../services/apiClient";

/**
 * Retries `fn` exactly once, after a short pause, but only when it failed with a `NetworkError`
 * — meaning the request never definitively reached the server, so we don't yet know what
 * happened. A real `ApiError` (a definite 4xx/5xx response) is never retried here: the server
 * already gave its final answer, and replaying it verbatim would just fail the same way again.
 *
 * Only ever wrap calls that are genuinely safe to repeat. Every marketplace mutation this is
 * used for qualifies by construction, not by convention:
 *  - `buyListing` re-reads the listing's current state under lock before doing anything, and
 *    explicitly treats "this same buyer already won it" as a completed success, not a failure
 *    (see marketplace.service.ts) — so replaying a buy can never double-charge or double-buy.
 *  - `createListing`/`delist`/`updatePrice` are each guarded by a DB constraint keyed on the
 *    listing's current state (an active-listing unique index, an ownership/seller check) — a
 *    replay either repeats the exact same effect or fails loudly with a specific, recognizable
 *    conflict, never silently double-applies.
 * Airplane mode toggled back on a few hundred milliseconds after a request went out is exactly
 * the case this exists for — one retry recovers it without the user ever seeing an error or
 * having to decide whether tapping the button again is safe.
 */
export async function retryOnceOnNetworkError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 800));
    return fn();
  }
}
