import { useState } from "react";
import * as Crypto from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import type { PackSku, PulledOwnedItem, RevealStage } from "@grailhaus/shared";
import { groupBulkRun, nextStage, presentationStrategyFor, withPackCoordinates } from "@grailhaus/shared";
import { usePackFlowStore } from "../state/packFlowStore";
import { useCategoriesViewModel } from "./useCategoriesViewModel";
import { toCategoryRevealConfig } from "../engine/core/categoryRevealConfig";
import { applyChoreography } from "../engine/core/choreographyRegistry";
import { purchaseService } from "../services/purchaseService";
import { clearPendingPurchase, getPendingPurchase, reconcilePendingPurchase, setPendingPurchase } from "../lib/pendingPurchase";
import {
  chunkIntoPacks,
  clearActiveReveal,
  resumeActiveReveal,
  setActiveReveal,
  setActiveRevealBulkState,
  setActiveRevealPackIndex,
} from "../lib/activeReveal";
import { retryOnceOnNetworkError } from "../lib/retryOnNetworkError";
import { NetworkError } from "../services/apiClient";

export type StartFlowResult = { ok: true } | { ok: false; error: string };

/**
 * ViewModel for the whole post-payment flow (Pack/Vault Detail's confirm sheet through the
 * Reveal tab's summary, single pack or a 10-pack batch). Views only ever call
 * `startFlow`/`advanceBatch`/`skipToResults` and read `items`+`config`+`phase`+batch fields here
 * — they don't know about the flow store, the purchase API, or the category registry directly.
 *
 * `startFlow` is the real atomic purchase (POST /purchase), not a client-side roll — pack
 * contents (every pack in the batch, for a bulk buy) are decided server-side, inside the same
 * transaction that debits the balance and decrements stock once for the whole purchase, and are
 * already persisted by the time this resolves. The idempotency key is minted and written to
 * secure storage *before* the network call, so a dropped connection or a killed app can be
 * safely retried with the same key rather than risking a double charge — one charge, N packs,
 * never N+N.
 *
 * Because the purchase has already fully resolved by the time `phase` becomes `"processing"`,
 * that phase is pure pacing (a deliberate pause before the reveal, per the mockup), not a wait
 * for the payment/stock/contents steps it visually narrates — those are already done.
 */
export function usePackFlowViewModel() {
  const sku = usePackFlowStore((s) => s.sku);
  const packs = usePackFlowStore((s) => s.packs);
  const currentPackIndex = usePackFlowStore((s) => s.currentPackIndex);
  const isBatchSummary = usePackFlowStore((s) => s.isBatchSummary);
  const purchaseId = usePackFlowStore((s) => s.purchaseId);
  const phase = usePackFlowStore((s) => s.phase);
  const start = usePackFlowStore((s) => s.start);
  const setPhase = usePackFlowStore((s) => s.setPhase);
  const advancePack = usePackFlowStore((s) => s.advancePack);
  const skipToBatchSummary = usePackFlowStore((s) => s.skipToBatchSummary);
  const clear = usePackFlowStore((s) => s.clear);
  const bulkReveal = usePackFlowStore((s) => s.bulkReveal);
  const setBulkStage = usePackFlowStore((s) => s.setBulkStage);
  const completeGrail = usePackFlowStore((s) => s.completeGrail);
  const [isPurchasing, setPurchasing] = useState(false);
  const queryClient = useQueryClient();
  const { byId: categoriesById } = useCategoriesViewModel();

  const items: PulledOwnedItem[] | null = packs[currentPackIndex] ?? null;

  /** `quantity` is 1 (single buy) or 10 (bulk buy) — see purchase.service.ts's own
   * SINGLE_QUANTITY/BULK_QUANTITY. Bulk is deliberately not offered for watches (one case at a
   * time, per PRD) or the vault_break card tier (its own richer 3D tear+fan reveal isn't built
   * to batch) — see ConfirmPurchaseSheet/PackDetailScreen for where that's enforced client-side;
   * the server enforces the watches half independently either way. */
  async function startFlow(pack: PackSku, quantity: 1 | 10 = 1): Promise<StartFlowResult> {
    setPurchasing(true);
    try {
      // Critical for "airplane mode mid-purchase, reconnect, one charge, never twenty": a tap
      // that follows a *previous* attempt for this exact pack and quantity which never learned
      // its outcome must resume that same attempt's idempotency key, not mint a fresh one —
      // minting a new key here would abandon the old marker (silently overwriting it) and let
      // this be a genuinely second, independently-chargeable purchase if the first one had
      // actually gone through server-side before its response was lost. Only a mismatched
      // marker (a *different* pack or quantity still unresolved) is treated as unrelated.
      const existing = await getPendingPurchase();
      if (existing && (existing.packId !== pack.id || existing.quantity !== quantity)) {
        // Try to resolve the stale one out of the way first — most of the time this either
        // completes it (leaving nothing to reuse) or confirms it failed, so it stops shadowing
        // a fresh attempt for this different pack. See pendingPurchase.ts for what "resolve"
        // means here (it also hands off to activeReveal.ts on success, so that purchase's
        // reveal isn't lost either).
        await reconcilePendingPurchase();
        const stillStuck = await getPendingPurchase();
        if (stillStuck) {
          return {
            ok: false,
            error: "A previous purchase is still resolving — check your connection and try again shortly.",
          };
        }
      }
      const reused = existing && existing.packId === pack.id && existing.quantity === quantity;
      const idempotencyKey = reused ? existing.idempotencyKey : Crypto.randomUUID();
      if (!reused) {
        await setPendingPurchase({ idempotencyKey, packId: pack.id, quantity });
      }

      // Same idempotency key on the retry — claimPurchase's unique index means this can never
      // execute the purchase twice, so a brief connectivity blip (a call interrupting the
      // request, wifi handing off to cell) can self-heal here instead of surfacing an error the
      // user then has to decide whether it's safe to act on. This is also what makes "airplane
      // mode mid-purchase of a 10-pack, reconnect, one charge, ten packs, never twenty" hold —
      // the retry (and any later reconciliation in lib/pendingPurchase.ts) always replays the
      // exact same key, so the server either finishes the one attempt it already claimed or
      // hands back that same attempt's result; it can never start a second one.
      const result = await retryOnceOnNetworkError(() =>
        purchaseService.purchase(idempotencyKey, pack.id, quantity)
      );
      // The purchase call itself is now settled either way — pendingPurchase.ts's job (protect
      // the *request*) is done. From here it's activeReveal.ts's job: protect the *reveal(s)*
      // the user hasn't seen yet. Set before clearing the purchase marker, never after, so
      // there's no gap where a kill would leave neither marker able to explain what happened.
      if (result.status === "completed") {
        await setActiveReveal({ idempotencyKey, packId: pack.id, quantity, packIndex: 0 });
      }
      await clearPendingPurchase();
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "me"] });

      if (result.status !== "completed") {
        return { ok: false, error: failureMessage(result.failureReason) };
      }
      // One flat, ordered list back into `quantity` per-pack groups — see chunkIntoPacks's own
      // header for why this exact math (itemCount-sized slices) is what resumeActiveReveal also
      // uses, so a fresh batch and a disk-restored one always draw pack boundaries identically.
      // `withPackCoordinates` is a no-op for anything the server already tagged (it only fills
      // gaps left by purchase rows written before coordinates were persisted) — so every item
      // carries its authoritative pack/card position from here on, whatever order the bulk
      // presentation later shows it in.
      start(pack, result.purchaseId, withPackCoordinates(chunkIntoPacks(result.items, pack.itemCount, quantity)));
      return { ok: true };
    } catch (err) {
      // The idempotency key is left in secure storage on purpose — even after the one built-in
      // retry above, a network failure here means the server may or may not have already
      // completed this purchase. The next attempt (explicit retry, or the app-boot/foreground
      // reconciliation in lib/pendingPurchase.ts) reuses the same key rather than risking a
      // second charge for the same tap.
      if (err instanceof NetworkError) {
        return { ok: false, error: "Lost connection — we'll pick this back up automatically. Try again shortly." };
      }
      return { ok: false, error: err instanceof Error ? err.message : "Couldn't reach GrailHaus — try again." };
    } finally {
      setPurchasing(false);
    }
  }

  /** The pack on screen is done (its own mini-summary was dismissed / "Next Pack" tapped) —
   * moves on to the next pack, or reveals the terminal batch summary once there isn't one, and
   * persists the new position so a kill right after this still resumes at the right pack rather
   * than replaying one already shown. A no-op on the persistence side for a single (quantity 1)
   * purchase's own summary — advancing straight into `isBatchSummary` there just means the
   * *whole* purchase (one pack) is done, same moment `finishFlow` would otherwise be called
   * from. */
  async function advanceBatch() {
    advancePack();
    const state = usePackFlowStore.getState();
    if (!state.isBatchSummary) {
      await setActiveRevealPackIndex(state.currentPackIndex);
    }
  }

  /** Agency for a bulk rip: jump straight to the batch summary from wherever the user currently
   * is. Every pack's contents are already in `packs` regardless of how many were actually
   * watched — this skips remaining animations, never remaining content. */
  function skipToResults() {
    skipToBatchSummary();
    const state = usePackFlowStore.getState();
    if (state.bulkReveal) void setActiveRevealBulkState(state.bulkReveal);
  }

  /** Moves a bulk run to an explicit stage and persists that, so a kill resumes there. */
  async function goToBulkStage(stage: RevealStage) {
    setBulkStage(stage);
    const state = usePackFlowStore.getState();
    if (state.bulkReveal) await setActiveRevealBulkState(state.bulkReveal);
  }

  /** Moves a bulk run to whatever stage naturally follows the current one, skipping stages with
   * nothing in them (see shared's `nextStage` for that rule). */
  async function advanceBulkStage() {
    const state = usePackFlowStore.getState();
    if (!state.bulkReveal) return;
    await goToBulkStage(nextStage(state.bulkReveal.stage, groupBulkRun(state.packs)));
  }

  /** One grail fully revealed. Persists immediately — this is exactly the moment a resume needs
   * to land after, so it must survive a kill on the very next frame. */
  async function revealGrail(ownedItemId: string) {
    completeGrail(ownedItemId);
    const state = usePackFlowStore.getState();
    if (state.bulkReveal) await setActiveRevealBulkState(state.bulkReveal);
  }

  /** Runs at boot and on every foreground resume (see App.tsx). Re-populates this store from a
   * persisted `activeReveal` marker if the app died (or lost its purchase response) while a
   * reveal was still on screen — see lib/activeReveal.ts for exactly what "resume" means here
   * (every pack's contents restored in full, the in-progress pack landing on its own summary
   * rather than replaying missed beats, every pack before it already counted as shown, every
   * pack after it still fully sealed).
   *
   * Guarded on `sku == null`: a non-null `sku` means THIS process already has the flow live in
   * memory — the ordinary "backgrounded mid-rip by a call, foregrounded again, process never
   * died" case, where the in-memory state (mid-gesture, mid-card-index, which pack of the batch,
   * whatever it is) is still completely correct and must not be clobbered by jumping straight to
   * a summary. Only an empty store — genuinely no memory of the flow in this process, which for
   * a live marker only happens after the process actually died — warrants reconstructing from
   * disk. Returns whether the caller should navigate to the Reveal screen. */
  async function resumeFlow(): Promise<boolean> {
    if (usePackFlowStore.getState().sku != null) return false;
    const outcome = await resumeActiveReveal();
    if (outcome.kind === "resume") {
      // A bulk run resumes into its *own* stage machine (mid-hunt, at the prime grid, wherever it
      // was), never into a per-pack summary — `resumedToSummary` is a single-pack concept and
      // would strand a bulk run on the wrong screen entirely.
      const isBulk = outcome.packs.length > 1;
      start(outcome.sku, outcome.purchaseId, outcome.packs, {
        resumeAtIndex: outcome.resumeIndex,
        resumedToSummary: !isBulk,
        bulkReveal: outcome.bulkReveal ?? null,
      });
      return true;
    }
    return false;
  }

  async function finishFlow() {
    clear();
    await clearActiveReveal();
  }

  return {
    sku,
    items,
    packs,
    currentPackIndex,
    quantity: packs.length,
    isBatch: packs.length > 1,
    /** Which presentation this purchase's results get — the single/bulk decision has exactly one
     * definition (shared's `presentationStrategyFor`) rather than a `length > 1` check per screen. */
    strategy: presentationStrategyFor(packs.length),
    bulkReveal,
    isBatchSummary,
    purchaseId,
    phase,
    config: sku
      ? (() => {
          const row = categoriesById.get(sku.category);
          if (!row) return null;
          const base = toCategoryRevealConfig(row);
          // The one seam where a *tier* refines a *category's* reveal. The categories table is
          // keyed by category, so every watch pack — Reserve, Archive, Obsidian Vault — resolves
          // to the same row; a tier with its own timeline reveal earns it on top of that row
          // rather than getting a separate screen or a duplicated config. Decorating here (instead
          // of branching in RevealScreen, the way the card tiers do) means the admin-configured
          // palette, camera and lighting for watches still flow through, and RevealEngine stays
          // unaware that tiers exist at all.
          //
          // Deliberately one call into a registry rather than a chain of per-tier `if`s: adding a
          // reveal is a row in engine/core/choreographyRegistry.ts, never an edit here.
          return applyChoreography(base, sku);
        })()
      : null,
    isActive: sku != null && (items != null || isBatchSummary),
    isPurchasing,
    startFlow,
    advanceBatch,
    skipToResults,
    goToBulkStage,
    advanceBulkStage,
    revealGrail,
    resumeFlow,
    setPhase,
    finishFlow,
  };
}

function failureMessage(reason: string | null): string {
  if (reason === "insufficient_funds") return "Not enough balance for this pack.";
  if (reason === "insufficient_stock") return "That pack just sold out.";
  if (reason === "not_live_yet") return "This drop hasn't gone live yet.";
  if (reason === "drop_ended") return "This drop has ended.";
  return "That purchase couldn't be completed.";
}
