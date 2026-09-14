import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { PackSku, PulledOwnedItem } from "@grailhaus/shared";
import { usePackFlowStore } from "../../state/packFlowStore";
import { usePackFlowViewModel } from "../../viewmodels/usePackFlowViewModel";
import { useCollectionViewModel } from "../../viewmodels/useCollectionViewModel";
import { ProcessingView, ReadyView, SummaryView, type BatchContext } from "./CardFlowEngine";
import { BlackLabelTearStage } from "./blackLabelReveal/BlackLabelTearStage";
import { BlackLabelFanReveal } from "./blackLabelReveal/BlackLabelFanReveal";
import { playSfx } from "../../lib/sfx";

type Step = "processing" | "ready" | "tear" | "cards" | "summary";

/**
 * The Black Label tier's own flow — Processing → Ready → [premium 3D tear] → fanned card reveal
 * → Pack Complete summary. Structurally identical to VaultBreakFlowEngine.tsx (same reasoning
 * for the tear/reveal split — see that file's header) — this is that same flow bound to
 * BlackLabelTearStage/BlackLabelFanReveal (this tier's own bronze-on-onyx personality/art)
 * instead of Vault Break's. Every other card tier still keeps CardFlowEngine's own tear +
 * swipe-through-cards flow unchanged.
 *
 * Black Label IS bulk-eligible (PackDetailScreen's own `bulkEligible` check — only vault_break is
 * excluded) — `batchContext`/`onSkipToResults` exist here for exactly that: a 10-pack Black Label
 * buy needs the same "one big pack" ready screen and one-tear-then-straight-to-batch-summary
 * handoff CardFlowEngine.tsx just got, or it silently renders as if it were a single pack (the
 * bug this fixes — RevealScreen was routing bulk Black Label purchases here without ever telling
 * this component a batch existed).
 */
export function BlackLabelFlowEngine({
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
  // See CardFlowEngine's own comment on both these flags (state/packFlowStore.ts) — true/non-null
  // only for a flow reconstructed from disk after a process death, never a fresh purchase. (This
  // engine previously read neither and always started at "processing" regardless of a resume —
  // fixed here alongside adding partial-progress support, not left half-resumable.)
  const resumedToSummary = usePackFlowStore((s) => s.resumedToSummary);
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
    // tear fires on its own (this was previously firing unconditionally for every batch pack,
    // skipping the reveal entirely after the very first tear — see CardFlowEngine's own fix).
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
        <BlackLabelTearStage onTearComplete={handleTearComplete} />
      </View>
    );
  }

  if (step === "cards") {
    return (
      <BlackLabelFanReveal
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
