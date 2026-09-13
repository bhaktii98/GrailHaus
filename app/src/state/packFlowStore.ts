import { create } from "zustand";
import type { BatchRevealState, PackSku, PulledOwnedItem, RevealStage } from "@grailhaus/shared";
import { initialBatchRevealState } from "@grailhaus/shared";

/**
 * Where the *current pack* is in the post-payment flow — `RevealScreen` branches its whole
 * render on this. `"revealing"` is deliberately coarse: each category's flow engine
 * (CardFlowEngine / VaultBreakFlowEngine / RevealEngine) keeps its own local sub-phase
 * (introduction, per-card index, final-card hold, door/silhouette/full-reveal beats, ...) the
 * same way it always has — this store only needs to know enough to route to the right engine
 * and to survive a re-mount of the Reveal tab.
 */
export type FlowPhase = "processing" | "ready" | "revealing" | "summary";

interface PackFlowState {
  sku: PackSku | null;
  /**
   * One entry per pack the purchase produced — length 1 for a single buy, `quantity` (10) for a
   * bulk buy. Each entry is that one pack's own pulled items, in reveal order, exactly as
   * `/purchase` returned them (chunked by `sku.itemCount` — see usePackFlowViewModel.startFlow
   * and lib/activeReveal.ts, which both do this same chunking so a fresh purchase and a
   * disk-restored one produce identical pack boundaries). A single buy is not a special case
   * here, just the `packs.length === 1` case of the same shape.
   */
  packs: PulledOwnedItem[][];
  /** The real purchase record's id — one purchase covers the *whole* batch (all of `packs`),
   * not one per pack — lets the engine be `key`-ed per pack (purchaseId + index) so advancing
   * within a batch, or tapping "Rip Another" for a genuinely new purchase, always remounts fresh
   * instead of leaving stale per-card `useState` behind from whatever was on screen before. */
  purchaseId: string | null;
  /** Which entry of `packs` is on screen right now. Persisted to disk every time it advances
   * (see lib/activeReveal.ts's `setActiveRevealPackIndex`, called from
   * usePackFlowViewModel.advanceBatch) — this is specifically what "force-stop at pack six of
   * ten, reopen, packs one to five stay revealed, seven to ten still sealed" resumes from: the
   * *contents* were never in question (server-side, immutable, already fully generated in one
   * transaction), only "how far through watching them had this device gotten" was ever at risk
   * of being lost, and that's exactly what this field (persisted) protects. */
  currentPackIndex: number;
  /** True once every entry in `packs` has been shown and the terminal *batch* summary (every
   * item pulled across the whole purchase, total spend vs. total value, best pull surfaced as
   * the hero) should render instead of any per-pack flow engine. Sticky once true within a
   * session — the only way back to a per-pack engine is starting an entirely new purchase. */
  isBatchSummary: boolean;
  phase: FlowPhase;
  /** Set only when the pack at `currentPackIndex` was reconstructed from a persisted
   * `activeReveal` marker (see lib/activeReveal.ts) after a process death or a
   * cold-start-after-network-loss — never on a normal fresh purchase or a normal advance to the
   * next pack in a batch. Each flow engine reads this once at mount to decide its *initial*
   * step: `true` means the intro/tear/per-card beats the user already missed don't get replayed
   * from scratch for *that one pack* — it lands directly on its own summary instead, which is
   * the "resumes ... or lands on its summary" half of the interruption-safety bar. The pulled
   * contents themselves are identical either way (server-side, immutable) — this only ever
   * changes which beat the animation *starts* on for the in-progress pack, never what any pack
   * shows, and never anything about the packs before or after it. */
  resumedToSummary: boolean;
  /**
   * Non-null only when the pack at `currentPackIndex` was reconstructed from disk *and* had
   * partial per-card progress worth resuming into — how many of its cards were already dock'd
   * before the process died. Mutually exclusive with `resumedToSummary`: a pack resumes to
   * *either* its own summary (nothing worth skipping ahead to, or everything already shown) *or*
   * straight to its "cards" step landed on this many cards already opened, never both. Each card
   * flow engine reads this once at mount, same as `resumedToSummary`, to decide its initial step
   * and to seed `useHoldToOpenDeck`'s starting status instead of every card starting sealed. Null
   * for a bulk run (which never sets this — see usePackFlowViewModel.resumeFlow) and for any
   * ordinary fresh start/advance.
   */
  resumedOpenedCount: number | null;
  /**
   * Where a bulk (10-pack) run's curated presentation currently is — which stage, and how many
   * grails have been witnessed. Null for a single-pack purchase, which has no stages at all and
   * keeps running the original sequential rip untouched.
   *
   * This is *presentation* progress only. It never describes what was pulled (that's `packs`,
   * server-authoritative and immutable) — only how much of it this device has shown the user, so
   * a process death can resume mid-hunt instead of restarting the chase. Persisted by
   * usePackFlowViewModel alongside the reveal marker (lib/activeReveal.ts).
   */
  bulkReveal: BatchRevealState | null;
  /**
   * Begins a flow right after a successful purchase — payment, stock decrement and item
   * assignment are already committed server-side by this point, so `"processing"` here is pure
   * pacing, not a wait for anything to actually finish. `opts` is only ever populated by the
   * boot/foreground resume path (see usePackFlowViewModel.resumeFlow): a normal fresh purchase
   * (single or bulk) always starts at pack 0, phase "processing", not resumed.
   */
  start: (
    sku: PackSku,
    purchaseId: string,
    packs: PulledOwnedItem[][],
    opts?: {
      resumeAtIndex?: number;
      resumedToSummary?: boolean;
      resumedOpenedCount?: number | null;
      bulkReveal?: BatchRevealState | null;
    }
  ) => void;
  /** Moves a bulk run to a named stage (the stage machine's transitions live in shared's
   * `nextStage`, not here — this store only records the outcome). No-op for a single pack. */
  setBulkStage: (stage: RevealStage) => void;
  /** Records that one more grail has been fully revealed. Idempotent per grail id, so a
   * double-fired animation callback can't advance the hunt twice. */
  completeGrail: (ownedItemId: string) => void;
  setPhase: (phase: FlowPhase) => void;
  /** Called when the pack currently on screen is done (its own summary was dismissed / "Next
   * Pack" tapped). Moves to the next pack fresh (not resumed), or — once there isn't a next pack
   * — flips on the terminal batch summary. Persisting the new index to disk is the caller's job
   * (usePackFlowViewModel.advanceBatch), same separation as `start`/`clear`: this store is pure
   * synchronous state, side effects live one layer up. */
  advancePack: () => void;
  /** Agency: jump straight to the batch summary from wherever the user currently is, skipping
   * the remaining packs' animations without skipping their *contents* — every pack is already in
   * `packs` regardless of how many were actually watched. */
  skipToBatchSummary: () => void;
  clear: () => void;
}

/** Holds the in-flight purchase flow so tapping "Rip"/"Unlock" on Shelf can hand off to the
 * Reveal tab (sibling tabs, not a stack, so this can't just be a navigation param). */
export const usePackFlowStore = create<PackFlowState>((set, get) => ({
  sku: null,
  packs: [],
  purchaseId: null,
  currentPackIndex: 0,
  isBatchSummary: false,
  phase: "processing",
  resumedToSummary: false,
  resumedOpenedCount: null,
  bulkReveal: null,
  start: (sku, purchaseId, packs, opts) => {
    const resumeAtIndex = opts?.resumeAtIndex ?? 0;
    const resumedToSummary = opts?.resumedToSummary ?? false;
    const resumedOpenedCount = opts?.resumedOpenedCount ?? null;
    // Defensive clamp: a resume index at or past the end of `packs` (shouldn't happen — it would
    // mean the batch was already fully watched before the marker was cleared) lands directly on
    // the batch summary rather than reading out of bounds.
    const pastEnd = resumeAtIndex >= packs.length;
    // A bulk run gets stage state; a single pack never does. On a fresh bulk purchase this starts
    // at the intro beat, on a resume it's whatever was persisted.
    const isBulk = packs.length > 1;
    const bulkReveal = isBulk ? (opts?.bulkReveal ?? initialBatchRevealState()) : null;
    set({
      sku,
      purchaseId,
      packs,
      currentPackIndex: pastEnd ? Math.max(0, packs.length - 1) : resumeAtIndex,
      isBatchSummary: pastEnd,
      // A partial-progress resume lands straight on the per-card reveal (its own tear already
      // happened before the process died) — "revealing", same phase `handleBeginRip` sets for a
      // fresh pack's own tear-complete transition — not "processing"/"ready", which would replay
      // beats already watched.
      phase: resumedToSummary || pastEnd ? "summary" : resumedOpenedCount != null ? "revealing" : "processing",
      resumedToSummary: resumedToSummary && !pastEnd,
      resumedOpenedCount: pastEnd ? null : resumedOpenedCount,
      bulkReveal,
    });
  },
  setBulkStage: (stage) => {
    const { bulkReveal } = get();
    if (!bulkReveal) return;
    set({
      bulkReveal: {
        ...bulkReveal,
        stage,
        primeStageCompleted: bulkReveal.primeStageCompleted || stage === "core" || stage === "summary",
        coreStageCompleted: bulkReveal.coreStageCompleted || stage === "summary",
        summaryViewed: bulkReveal.summaryViewed || stage === "summary",
      },
      // The terminal batch summary is one and the same screen for both paths — keeping this flag
      // in sync means RevealScreen's existing summary routing needs no bulk-specific branch.
      isBatchSummary: stage === "summary" ? true : get().isBatchSummary,
      phase: stage === "summary" ? "summary" : "revealing",
    });
  },
  completeGrail: (ownedItemId) => {
    const { bulkReveal } = get();
    if (!bulkReveal || bulkReveal.completedGrailIds.includes(ownedItemId)) return;
    set({
      bulkReveal: {
        ...bulkReveal,
        currentGrailIndex: bulkReveal.currentGrailIndex + 1,
        completedGrailIds: [...bulkReveal.completedGrailIds, ownedItemId],
      },
    });
  },
  setPhase: (phase) => set({ phase }),
  advancePack: () => {
    const { currentPackIndex, packs } = get();
    const nextIndex = currentPackIndex + 1;
    if (nextIndex >= packs.length) {
      set({ isBatchSummary: true, phase: "summary" });
      return;
    }
    // "ready", not "processing" — CardFlowEngine skips the processing narration for every pack
    // after the first in a batch (see its own `skipProcessing`), so this mirrors the engine's
    // actual initial step instead of describing a beat that won't play.
    set({
      currentPackIndex: nextIndex,
      phase: nextIndex > 0 ? "ready" : "processing",
      resumedToSummary: false,
      resumedOpenedCount: null,
    });
  },
  skipToBatchSummary: () => {
    const { bulkReveal } = get();
    set({
      isBatchSummary: true,
      phase: "summary",
      bulkReveal: bulkReveal
        ? { ...bulkReveal, stage: "summary", primeStageCompleted: true, coreStageCompleted: true, summaryViewed: true }
        : null,
    });
  },
  clear: () =>
    set({
      sku: null,
      packs: [],
      purchaseId: null,
      currentPackIndex: 0,
      isBatchSummary: false,
      phase: "processing",
      resumedToSummary: false,
      resumedOpenedCount: null,
      bulkReveal: null,
    }),
}));
