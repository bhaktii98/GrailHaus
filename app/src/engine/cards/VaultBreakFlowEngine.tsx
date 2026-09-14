import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { PackSku, PulledOwnedItem } from "@grailhaus/shared";
import { usePackFlowStore } from "../../state/packFlowStore";
import { usePackFlowViewModel } from "../../viewmodels/usePackFlowViewModel";
import { useCollectionViewModel } from "../../viewmodels/useCollectionViewModel";
import { ProcessingView, ReadyView, SummaryView, type BatchContext } from "./CardFlowEngine";
import { VaultTearStage } from "./vaultReveal/VaultTearStage";
import { VaultCardFanReveal } from "./vaultReveal/VaultCardFanReveal";
import { playSfx } from "../../lib/sfx";

type Step = "processing" | "ready" | "tear" | "cards" | "summary";

/**
 * The Vault Break tier's own flow — Processing → Ready → [premium 3D tear] → fanned card reveal
 * → Pack Complete summary.
 *
 * The tear and the card reveal are two separate screens, not one continuous 3D scene — an
 * earlier version ran the staged multi-card fan-and-inspect reveal (engine/cards/vaultReveal's
 * buildReveal.ts) inside the *same* 3D scene as the tear, and on-device that measured well
 * under 10fps with visible overlapping-UI corruption once card inspection kicked in. Splitting
 * it lets the tear stay a genuinely premium 3D moment (VaultTearStage, bounded to a few
 * seconds) while the card reveal itself runs flat, in VaultCardFanReveal — the fanned,
 * overlapping collector-card spread from the original design handoff, each card turning face-up
 * on its own timed cue instead of a per-card swipe gesture (see that file's header). Every other
 * card tier keeps CardFlowEngine's own tear + swipe-through-cards flow unchanged; this tier gets
 * both a fancier tear and a fancier reveal.
 *
 * Vault Break IS bulk-eligible (PackDetailScreen's own `bulkEligible` — every card tier can batch
 * now) — `batchContext`/`onSkipToResults` exist for exactly that: a 10-pack Vault Break buy needs
 * the same "one big pack" ready screen and one-tear-then-straight-to-batch-summary handoff
 * CardFlowEngine.tsx and BlackLabelFlowEngine already have, or it silently renders as if it were
 * a single pack.
 */
export function VaultBreakFlowEngine({
  sku,
  items,
  batchContext,
  onFinished,
  onRipAgain,
  onGoHome,
  onViewCollection,
  onSkipToResults,
  onNextPack,
  isRipAgainWorking,
}: {
  sku: PackSku;
  items: PulledOwnedItem[];
  batchContext?: BatchContext;
  onFinished: () => void;
  onRipAgain: () => void;
  onGoHome: () => void;
  onViewCollection: () => void;
  onSkipToResults?: () => void;
  onNextPack?: () => void;
  isRipAgainWorking: boolean;
}) {
  const setPhase = usePackFlowStore((s) => s.setPhase);
  // See CardFlowEngine's own comment on this flag (state/packFlowStore.ts) — true only for a
  // flow reconstructed from disk after a process death, never a fresh purchase.
  const resumedToSummary = usePackFlowStore((s) => s.resumedToSummary);
  // Non-null only alongside a partial-progress resume — see CardFlowEngine's own comment.
  const resumedOpenedCount = usePackFlowStore((s) => s.resumedOpenedCount);
  const { recordCardOpened } = usePackFlowViewModel();
  const { owned } = useCollectionViewModel();
  const [step, setStep] = useState<Step>(
    resumedOpenedCount != null ? "cards" : resumedToSummary ? "summary" : "processing"
  );
  const [visibleStatusRows, setVisibleStatusRows] = useState(0);

  // Same ordering rule as CardFlowEngine.orderedItems — commons-first for a standalone pack; a
  // batch pack's `items` already arrives grouped grail-then-prime-then-core across the whole
  // batch (see RevealScreen's own `batchOrderedItems`), so this keeps that order as-is.
  const orderedItems = useMemo(
    () => (batchContext ? items : [...items].sort((a, b) => a.rarityTierLevel - b.rarityTierLevel)),
    [items, batchContext]
  );

  // Same real-ownership math as CardFlowEngine: how many of each pulled id this account held
  // *before* this pack (`owned` already includes this pull's own copies).
  const priorCountById = useMemo(() => {
    const pulledCount = new Map<string, number>();
    for (const item of orderedItems) pulledCount.set(item.id, (pulledCount.get(item.id) ?? 0) + 1);
    const ownedCount = new Map<string, number>();
    for (const o of owned) ownedCount.set(o.item.id, (ownedCount.get(o.item.id) ?? 0) + 1);
    const prior = new Map<string, number>();
    for (const [id, count] of pulledCount) prior.set(id, Math.max(0, (ownedCount.get(id) ?? 0) - count));
    return prior;
  }, [orderedItems, owned]);

  useEffect(() => {
    if (step !== "processing") return;
    const timers = [0, 700, 1400].map((delay, i) => setTimeout(() => setVisibleStatusRows(i + 1), delay));
    return () => timers.forEach(clearTimeout);
  }, [step]);

  function handleProcessingDone() {
    setStep("ready");
    setPhase("ready");
  }

  function handleBeginRip() {
    setStep("tear");
    setPhase("revealing");
  }

  function handleOpenLater() {
    onFinished();
  }

  function handleTearComplete() {
    playSfx("packTear");
    // Every pack of a batch still gets its own fanned reveal, same as a standalone pack —
    // `onSkipToResults` is the explicit "Skip to results" link on ReadyView, never something a
    // tear fires on its own (see CardFlowEngine's own handleTearComplete for the bug this matches
    // the fix of: firing it here unconditionally skipped the reveal entirely after the first tear).
    setStep("cards");
  }

  // Mid-batch, this pack still needs its own recap + "next pack" handoff (SummaryView) — there's
  // more of the purchase left to show. A standalone pack has nothing left to hand off to, so its
  // own reveal goes straight to the portfolio instead of a results screen the user would just
  // have to tap through again. (Previously always went to the portfolio — a real bug that ended
  // a batch run after pack one's own reveal, before packs 2-10 were ever shown.)
  function handleCardsDone() {
    // One reveal pass already covered the whole batch (every grail, then prime, then core,
    // across all packs — see RevealScreen's own `batchOrderedItems`), so there's no "next pack"
    // left to hand off to: straight to the terminal batch summary. A standalone pack instead
    // goes to the portfolio, same as always.
    if (batchContext && onSkipToResults) {
      onSkipToResults();
    } else {
      onViewCollection();
    }
  }

  if (step === "processing") {
    return <ProcessingView visibleRows={visibleStatusRows} onComplete={handleProcessingDone} />;
  }

  if (step === "ready") {
    return (
      <ReadyView
        sku={sku}
        batchContext={batchContext}
        onBeginRip={handleBeginRip}
        onOpenLater={handleOpenLater}
        onSkipToResults={batchContext ? onSkipToResults : undefined}
      />
    );
  }

  if (step === "tear") {
    return (
      <View style={styles.fill}>
        <VaultTearStage onTearComplete={handleTearComplete} />
      </View>
    );
  }

  if (step === "cards") {
    return (
      <VaultCardFanReveal
        items={orderedItems}
        sku={sku}
        initialOpenedCount={resumedOpenedCount ?? undefined}
        onProgress={recordCardOpened}
        onDone={handleCardsDone}
      />
    );
  }

  // "summary"
  return (
    <SummaryView
      sku={sku}
      items={orderedItems}
      priorCountById={priorCountById}
      batchContext={batchContext}
      onNextPack={onNextPack}
      onRipAgain={onRipAgain}
      onGoHome={onGoHome}
      onViewCollection={onViewCollection}
      isRipAgainWorking={isRipAgainWorking}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#05030a" },
});
