import * as SecureStore from "expo-secure-store";
import type { BatchRevealState, PackSku, PulledOwnedItem } from "@grailhaus/shared";
import { withPackCoordinates } from "@grailhaus/shared";

const KEY = "grailhaus_active_reveal";

export interface ActiveReveal {
  idempotencyKey: string;
  packId: string;
  quantity: number;
  /** Which pack within the batch (0-based) the device had reached last time it checked in —
   * always 0 for a single (quantity 1) purchase. Bumped by `setActiveRevealPackIndex` every time
   * `usePackFlowViewModel.advanceBatch` moves to the next pack, which is what actually makes
   * "force-stop at pack six of ten, reopen, packs one to five stay revealed, six resumes, seven
   * to ten still sealed" hold — the *contents* were never at risk (server-side, immutable,
   * generated once in the purchase's own transaction), only "how far this device had gotten
   * watching them" was, and that's exactly what this field exists to protect. */
  packIndex: number;
  /**
   * A bulk run's curated-presentation progress (stage + grails witnessed), or undefined for a
   * single pack, which has no stages. Rewritten on every stage transition and every grail reveal
   * — the same cheap single-field rewrite `setActiveRevealPackIndex` already does per pack.
   *
   * This is what makes "killed during the Grail Hunt, reopen, continue from the next grail" hold.
   * As with `packIndex`, the pulled contents were never at risk — they're server-side and
   * immutable — so nothing here can ever change *what* the user gets, only where the
   * presentation picks back up.
   */
  bulkReveal?: BatchRevealState;
  /**
   * How many cards of the *current* pack (`packIndex`) this device has actually watched get set
   * aside — 0 until the first card is dock'd, up to that pack's own `itemCount` once every card
   * has been. Rewritten on every dock (see `setActiveRevealOpenedCount`, called from
   * HoldToOpenFanReveal's `onProgress`), the same cheap single-field rewrite `setActiveRevealPackIndex`
   * already does per pack. Reset to 0 every time `packIndex` advances (a new pack starts with
   * nothing opened) — see `setActiveRevealPackIndex` below.
   *
   * This is what makes "force-stopped after opening 2 of this pack's 5 cards, reopen, land on
   * card 3 ready to open" hold, instead of the coarser "lands on the pack's own summary" fallback
   * every resume used before this field existed (see `resumeActiveReveal`'s own comment for when
   * each of those two outcomes actually applies). As with every other field here, this can only
   * ever change *where the presentation picks back up* — the pulled contents are server-side and
   * immutable regardless of what this says.
   */
  openedCount?: number;
}

/**
 * Splits one purchase's flat, ordered `items` back into per-pack groups of `itemCount` each —
 * the exact inverse of how purchase.service.ts builds `allItems` server-side (each pack's pull
 * pushed in order, one after another, into a single flat array). Used both right after a fresh
 * purchase (usePackFlowViewModel.startFlow) and when reconstructing one from disk
 * (resumeActiveReveal below) so a fresh batch and a disk-restored one draw pack boundaries
 * identically — neither path "decides" where one pack ends and the next begins independently.
 */
export function chunkIntoPacks<T>(items: T[], itemCount: number, quantity: number): T[][] {
  const packs: T[][] = [];
  for (let i = 0; i < quantity; i++) {
    packs.push(items.slice(i * itemCount, (i + 1) * itemCount));
  }
  return packs;
}

/**
 * The reveal-side twin of pendingPurchase.ts. That module protects the *purchase* — money and
 * stock — across an interruption; this one protects the *experience the user paid for*: the
 * pack(s) they already bought, whose contents already exist server-side, but whose reveal they
 * never got to finish because the app died, backgrounded into a call, or lost its network
 * mid-rip. Covers a bulk (10-pack) purchase exactly the same way as a single one — `quantity`
 * and `packIndex` are the only things that differ.
 *
 * Written the instant a purchase completes (before `usePackFlowStore.start` ever runs), and
 * cleared only when the user actually finishes looking at the terminal summary — not when the
 * purchase call resolves, and not between packs within a batch. That gap (purchase done, marker
 * still set, reveal still on screen) is deliberate: it's exactly the window a kill/force-stop
 * can land in, and it's what makes "packs one to five stay revealed, six resumes or lands on its
 * summary, seven to ten still sealed, nothing re-rolled" true after a real process death instead
 * of just after a network blip.
 */
export async function setActiveReveal(reveal: ActiveReveal): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(reveal));
}

export async function getActiveReveal(): Promise<ActiveReveal | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveReveal;
  } catch {
    return null;
  }
}

/** Called from usePackFlowViewModel.advanceBatch every time the batch moves to its next pack —
 * a small, single-field rewrite (never rewrites idempotencyKey/packId/quantity), so it's cheap
 * enough to call on every single advance without a debounce. If the marker was somehow already
 * cleared (e.g. a race with `clearActiveReveal` from a stray double-tap on "Done"), this is a
 * deliberate no-op rather than resurrecting a marker that shouldn't exist anymore. */
export async function setActiveRevealPackIndex(packIndex: number): Promise<void> {
  const current = await getActiveReveal();
  if (!current) return;
  // A new pack starts with nothing opened — carrying over the previous pack's count would wrongly
  // skip cards in this one on the next resume.
  await setActiveReveal({ ...current, packIndex, openedCount: 0 });
}

/** Called from HoldToOpenFanReveal's `onProgress` every time a card is dock'd — see the field's
 * own doc comment on `ActiveReveal` for what this makes possible. Same deliberate no-op if the
 * marker was already cleared as its pack-index/bulk-state siblings. */
export async function setActiveRevealOpenedCount(openedCount: number): Promise<void> {
  const current = await getActiveReveal();
  if (!current) return;
  await setActiveReveal({ ...current, openedCount });
}

/** The bulk twin of `setActiveRevealPackIndex` — called on every stage transition and grail
 * reveal so a process death resumes mid-hunt rather than restarting the chase. Same deliberate
 * no-op if the marker was already cleared. */
export async function setActiveRevealBulkState(bulkReveal: BatchRevealState): Promise<void> {
  const current = await getActiveReveal();
  if (!current) return;
  await setActiveReveal({ ...current, bulkReveal });
}

export async function clearActiveReveal(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

export type ResumeOutcome =
  | { kind: "none" }
  | { kind: "unknown" } // couldn't reach the server to find out — try again later, marker untouched
  | {
      kind: "resume";
      sku: PackSku;
      packs: PulledOwnedItem[][];
      purchaseId: string;
      resumeIndex: number;
      /** Present only for a bulk run that had already started its curated presentation. */
      bulkReveal?: BatchRevealState;
      /** How many cards of the resumed pack were already dock'd — see `ActiveReveal.openedCount`'s
       * own doc comment. 0 for a bulk run (which never sets this) or a marker written before this
       * field existed. */
      openedCount: number;
    }
  | { kind: "unrecoverable" }; // purchase resolved (or failed) but there's nothing left to show

/**
 * Runs at boot and on every foreground resume (same triggers as reconcilePendingPurchase, see
 * App.tsx). Turns a persisted marker back into exactly what `usePackFlowStore.start` needs to
 * re-populate the flow — contents come from the same `GET /purchases/:idempotencyKey` the
 * purchase reconciler already relies on (server-side, immutable, never re-rolled by asking
 * again), chunked into per-pack groups the same way a fresh purchase is (see `chunkIntoPacks`),
 * and the pack's config comes from the same catalog list every other screen already caches under
 * `["packs","all"]`.
 *
 * Does not try to reconstruct the exact beat the user was mid-gesture on (a flip in progress, a
 * finger still on the current card) — that lives only in the flow engine's own component state
 * and dies with the process, same as any other unsaved UI state would. What it does reconstruct,
 * via `openedCount`, is how many cards of the in-progress pack had already been fully dock'd —
 * enough for the caller to land directly on the next sealed card (see
 * `usePackFlowViewModel.resumeFlow`), not just on the pack's own terminal summary. A pack with
 * `openedCount` at 0 or already at its own `itemCount` still falls back to the coarser "lands on
 * the summary" outcome — the interruption-safety bar's other explicitly-allowed shape — since
 * there's either nothing to skip ahead to, or nothing left to reveal. Every pack before the
 * in-progress one is already-shown (nothing to redo) and every pack after it is still fully
 * sealed, completely unaffected, waiting exactly where it was — none of that changes here.
 */
export async function resumeActiveReveal(): Promise<ResumeOutcome> {
  const pending = await getActiveReveal();
  if (!pending) return { kind: "none" };

  // Deferred imports: avoids a require cycle with services that themselves touch auth state.
  const { purchaseService } = await import("../services/purchaseService");
  const { packsService } = await import("../services/packsService");
  const { NetworkError } = await import("../services/apiClient");

  try {
    const result = await purchaseService.getByIdempotencyKey(pending.idempotencyKey);

    if (result.status === "pending") return { kind: "unknown" }; // still genuinely in flight

    if (result.status !== "completed" || result.items.length === 0) {
      // The purchase itself failed (sold out, insufficient funds, ...) — there is no reveal to
      // resume. Not an error: just nothing left to do here.
      await clearActiveReveal();
      return { kind: "unrecoverable" };
    }

    const catalog = await packsService.list();
    const sku = catalog.find((p) => p.id === pending.packId);
    if (!sku) {
      // Extremely unlikely (a SKU disappearing from the catalog between purchase and resume),
      // but the items themselves are safe in the user's portfolio regardless — only the reveal
      // *presentation* is unrecoverable without the sku's config (art, rarity tiers, pacing).
      await clearActiveReveal();
      return { kind: "unrecoverable" };
    }

    // `withPackCoordinates` only fills in what the server didn't send (older purchase rows) — a
    // response that already carries authoritative packIndex/cardIndex per item is left untouched.
    const packs = withPackCoordinates(chunkIntoPacks(result.items, sku.itemCount, pending.quantity));
    const resumeIndex = Math.min(Math.max(0, pending.packIndex), Math.max(0, packs.length - 1));
    return {
      kind: "resume",
      sku,
      packs,
      purchaseId: result.purchaseId,
      resumeIndex,
      bulkReveal: pending.bulkReveal,
      openedCount: pending.openedCount ?? 0,
    };
  } catch (err) {
    if (err instanceof NetworkError) return { kind: "unknown" };
    // A definite server error (e.g. a stale key the server no longer recognizes) — nothing to
    // resume, and retrying won't change that.
    await clearActiveReveal();
    return { kind: "unrecoverable" };
  }
}
