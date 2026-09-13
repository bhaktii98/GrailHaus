import * as SecureStore from "expo-secure-store";

const KEY = "grailhaus_pending_purchase";

export interface PendingPurchase {
  idempotencyKey: string;
  packId: string;
  quantity: number;
}

/**
 * The one thing that makes "never twice, never lost" survive an app kill, not just a network
 * blip: the idempotency key is written here *before* the purchase request ever goes out, and
 * cleared only once that key's outcome is known for certain. If the app dies mid-purchase, the
 * next launch finds this and reconciles via GET /purchases/:idempotencyKey instead of either
 * silently dropping the attempt or letting the user fire a brand-new one.
 */
export async function setPendingPurchase(pending: PendingPurchase): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(pending));
}

export async function getPendingPurchase(): Promise<PendingPurchase | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingPurchase;
  } catch {
    return null;
  }
}

export async function clearPendingPurchase(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

/**
 * Runs at app boot AND every time the app returns to the foreground (see App.tsx's AppState
 * listener) — an interrupted purchase should reconcile as soon as the app is back, not just on a
 * full cold start, since "backgrounded mid-purchase by an incoming call" never kills the process
 * at all, and neither does toggling airplane mode off and back on (which typically backgrounds
 * the app only briefly, if at all). Asks the server what actually happened (no re-execution —
 * see purchase.service.ts's claim-then-execute design) instead of leaving that purchase in limbo
 * forever or letting a future retry mint a fresh key for an attempt that may have already gone
 * through. The purchase's correctness never depended on this running — the server already
 * settled it one way or the other — this is purely about the client not losing track.
 *
 * One extra case beyond "ask what happened": if the very first POST /purchase never reached the
 * server at all (killed/offline before the request left the device — claimPurchase never ran,
 * so no row exists yet), the lookup 404s. That's not "unknown," it's "definitely never
 * attempted" — safe, and necessary, to fire the same POST again with the same key rather than
 * leaving the purchase stuck forever with nothing server-side to reconcile against.
 *
 * A successful reconciliation here — whether found already-completed or completed just now on
 * the 404 retry — hands off to activeReveal.ts exactly the way a normal in-app purchase does
 * (see usePackFlowViewModel.startFlow), so the very next `resumeFlow()` call in the same
 * `reconcileAndResume` tick (see AuthProvider.tsx) picks the reveal back up and navigates to it.
 * Without this, "airplane mode mid-purchase, reconnect, one charge, ten packs, never twenty"
 * would hold at the ledger level (this function alone already guarantees that) but silently drop
 * the *reveal* the user paid for — they'd never see the rip, only later notice the packs sitting
 * in their portfolio.
 */
export async function reconcilePendingPurchase(): Promise<void> {
  const pending = await getPendingPurchase();
  if (!pending) return;

  // Deferred imports: avoids a require cycle with services that themselves touch auth state.
  const { purchaseService } = await import("../services/purchaseService");
  const { ApiError } = await import("../services/apiClient");
  const { setActiveReveal } = await import("./activeReveal");

  let completedPurchaseId: string | null = null;
  try {
    const result = await purchaseService.getByIdempotencyKey(pending.idempotencyKey);
    if (result.status === "pending") return; // still genuinely in flight — check again next launch
    if (result.status === "completed") completedPurchaseId = result.purchaseId;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // Never reached the server the first time — same key, so claimPurchase's unique index
      // still guarantees at most one execution even if this races a very-late original attempt.
      try {
        const retried = await purchaseService.purchase(pending.idempotencyKey, pending.packId, pending.quantity);
        if (retried.status === "completed") completedPurchaseId = retried.purchaseId;
      } catch {
        return; // still couldn't get it through — leave it for the next launch/foreground
      }
    } else {
      return; // network error, or some other server hiccup — leave it for next launch, not fatal
    }
  }

  if (completedPurchaseId) {
    await setActiveReveal({
      idempotencyKey: pending.idempotencyKey,
      packId: pending.packId,
      quantity: pending.quantity,
      packIndex: 0,
    });
  }
  // A "failed" outcome (sold out, insufficient funds by the time this ran) needs no reveal
  // marker — there's nothing to show. Either way, this purchase attempt is now fully resolved.
  await clearPendingPurchase();
}
