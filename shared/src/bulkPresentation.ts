import type {
  BatchRevealState,
  MoneyCents,
  PackSku,
  PresentationStrategy,
  PulledOwnedItem,
  RarityTierLevel,
  RevealStage,
} from "./types.js";

/**
 * The bulk (10-pack) reveal's *presentation* layer, as pure data transforms.
 *
 * The single most important invariant in this file: **nothing here generates, re-rolls, reorders,
 * or otherwise touches authoritative data.** Every function takes the already-generated,
 * already-persisted, server-authoritative pull results and returns a different *view* of them.
 * Each item keeps its `packIndex`/`cardIndex` (its real coordinates in the purchase) no matter
 * where it lands in a presentation list, so "which pack did this actually come from" survives the
 * reordering intact — see PulledOwnedItem's own header.
 *
 * Kept in `shared` rather than the app deliberately: it is pure, it is the part worth testing in
 * isolation, and a future category (or an admin-side preview tool) reuses it without pulling in
 * React Native. The app wraps it in a stage machine; this file has no opinion about rendering.
 */

/** Cards' rarity levels read Core (1) / Prime (2) / Grail (3) — the names come from the admin
 * `rarity_tiers` rows, but the *ordinal* is fixed and is what grouping keys off, so this works
 * for any category with the same three-tier shape (Watches: Heritage/Icon/Apex). */
export const CORE_TIER: RarityTierLevel = 1;
export const PRIME_TIER: RarityTierLevel = 2;
export const GRAIL_TIER: RarityTierLevel = 3;

/** Bulk purchases are a fixed 10 — mirrors purchase.service.ts's BULK_QUANTITY. */
export const BULK_QUANTITY = 10;

/**
 * Which presentation a purchase gets. Derived from quantity alone: one pack is always the
 * traditional sequential rip, a bulk buy is always the curated run. Deliberately a function
 * rather than a constant so the single/bulk decision has exactly one definition across the app.
 */
export function presentationStrategyFor(quantity: number): PresentationStrategy {
  return quantity > 1 ? "BULK_GRAIL_HUNT" : "SINGLE_PACK";
}

/**
 * Escalation ranking for grail reveals: weakest first, strongest last, so a run *builds* instead
 * of peaking early.
 *
 * Rarity is explicitly NOT the ranking — every item here is already the same rarity class. What
 * separates them is desirability, and the only desirability signal this data model carries today
 * is value. `baseValueCents` is used rather than `currentValueCents` because the latter drifts
 * every 30 seconds (PRD §28): ranking on it would let the *order of a locked, already-generated
 * result* change between a reveal and its resume, which would be a visible inconsistency for no
 * benefit. Base value is fixed at catalog import, so the ordering is deterministic for the life
 * of the batch.
 *
 * Ties break on `ownedItemId` — stable, unique, and already present — so two grails of identical
 * value never swap places between renders or across a resume.
 *
 * If a future schema adds a real `revealRank`/desirability score, this is the one function that
 * changes; nothing else in the stack knows how grails are ordered.
 */
export function compareGrailsForReveal(a: PulledOwnedItem, b: PulledOwnedItem): number {
  if (a.baseValueCents !== b.baseValueCents) return a.baseValueCents - b.baseValueCents;
  return a.ownedItemId.localeCompare(b.ownedItemId);
}

/**
 * How much cinematic treatment a given grail gets, 0..1, where 1 is the climax.
 *
 * The last grail in the run is always 1 regardless of how many there are — a single-grail run
 * still gets a full hero moment, it just doesn't build to one. Earlier grails ramp linearly from
 * a floor so that even the first reveal feels substantial rather than perfunctory.
 */
export function grailIntensity(index: number, total: number): number {
  if (total <= 1) return 1;
  const FLOOR = 0.45;
  return FLOOR + (index / (total - 1)) * (1 - FLOOR);
}

export interface BulkRunGroups {
  grails: PulledOwnedItem[];
  primes: PulledOwnedItem[];
  cores: PulledOwnedItem[];
}

/**
 * Splits a whole batch's items into the three presentation groups.
 *
 * `packs` is the authoritative per-pack structure and is read, never mutated — the returned
 * arrays are new arrays of the *same item references*, so nothing is copied or rewritten. Grails
 * come back in escalation order (see compareGrailsForReveal); primes and cores keep their natural
 * pack-then-slot order, which is already the order the server generated them in.
 */
export function groupBulkRun(packs: PulledOwnedItem[][]): BulkRunGroups {
  const all = packs.flat();
  const grails = all.filter((i) => i.rarityTierLevel === GRAIL_TIER).slice().sort(compareGrailsForReveal);
  const primes = all.filter((i) => i.rarityTierLevel === PRIME_TIER);
  const cores = all.filter((i) => i.rarityTierLevel === CORE_TIER);
  return { grails, primes, cores };
}

/**
 * Attaches authoritative coordinates to every item of an already-chunked batch, for rows that
 * predate the server persisting them. Derives from position — which is exactly how the boundaries
 * were always drawn (see the app's chunkIntoPacks) — and never overwrites a value the server did
 * send.
 */
export function withPackCoordinates(packs: PulledOwnedItem[][]): PulledOwnedItem[][] {
  return packs.map((pack, packIndex) =>
    pack.map((item, cardIndex) => ({
      ...item,
      packIndex: item.packIndex ?? packIndex,
      cardIndex: item.cardIndex ?? cardIndex,
    }))
  );
}

export interface BulkRunSummary {
  packCount: number;
  totalCards: number;
  grailCount: number;
  primeCount: number;
  coreCount: number;
  /** The single most valuable pull of the whole run — the last grail if there is one, otherwise
   * the best of whatever was pulled. Null only for a genuinely empty batch. */
  bestPull: PulledOwnedItem | null;
  totalSpendCents: MoneyCents;
  /** Mark-to-market against the live drifting value, matching how the portfolio values holdings
   * (PRD §28) — not `baseValueCents`, which is a catalog constant and would disagree with every
   * other value the user sees after this screen. */
  estimatedValueCents: MoneyCents;
  /** Estimated value minus what the run cost. Negative is normal and shown honestly. */
  estimatedPnlCents: MoneyCents;
}

/**
 * Every figure the batch summary reports, computed in one place from authoritative data.
 *
 * `bestPull` is picked by the same comparator the grail hunt escalates with, so "the last grail
 * you revealed" and "BEST PULL" on the summary are guaranteed to be the same card — they'd
 * otherwise be able to disagree, which would read as a bug to a collector.
 */
export function summarizeBulkRun(sku: PackSku, packs: PulledOwnedItem[][]): BulkRunSummary {
  const all = packs.flat();
  const { grails, primes, cores } = groupBulkRun(packs);
  const best =
    grails.length > 0
      ? grails[grails.length - 1]
      : all.length > 0
        ? all.slice().sort(compareGrailsForReveal)[all.length - 1]
        : null;
  const totalSpendCents = sku.priceCents * packs.length;
  const estimatedValueCents = all.reduce((sum, i) => sum + i.currentValueCents, 0);
  return {
    packCount: packs.length,
    totalCards: all.length,
    grailCount: grails.length,
    primeCount: primes.length,
    coreCount: cores.length,
    bestPull: best,
    totalSpendCents,
    estimatedValueCents,
    estimatedPnlCents: estimatedValueCents - totalSpendCents,
  };
}

/** A fresh run's reveal state — always starts at the intro beat, nothing revealed yet. */
export function initialBatchRevealState(): BatchRevealState {
  return {
    stage: "intro",
    currentGrailIndex: 0,
    completedGrailIds: [],
    primeStageCompleted: false,
    coreStageCompleted: false,
    summaryViewed: false,
  };
}

/**
 * The stage machine's one transition rule: given where the run is and what it contains, what
 * comes next.
 *
 * Stages with nothing to show are skipped rather than rendered empty — a run with no primes goes
 * straight from the hunt to the cores. The zero-grail case is deliberately *not* skipped here:
 * the grail_hunt stage renders its own "no grail this run" beat (see the app's GrailHuntStage),
 * because silently skipping the headline stage of a "Grail Hunt" would read as the feature being
 * broken rather than as an honest outcome.
 */
export function nextStage(stage: RevealStage, groups: BulkRunGroups): RevealStage {
  switch (stage) {
    case "intro":
      return "grail_hunt";
    case "grail_hunt":
      if (groups.primes.length > 0) return "prime";
      if (groups.cores.length > 0) return "core";
      return "summary";
    case "prime":
      return groups.cores.length > 0 ? "core" : "summary";
    case "core":
    case "summary":
      return "summary";
  }
}
