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

  // Same commons-first ordering as CardFlowEngine.orderedItems.
  const orderedItems = useMemo(() => [...items].sort((a, b) => a.rarityTierLevel - b.rarityTierLevel), [items]);

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
    // Bulk purchase: same fix as CardFlowEngine's own handleTearComplete — one tear stands for
    // the whole batch (every pack's contents already exist regardless of how many get watched),
    // so it hands straight off to the terminal batch summary instead of this pack's own 5-card
    // reveal. A standalone purchase has no `onSkipToResults` and falls through unchanged.
    if (batchContext && onSkipToResults) {
      onSkipToResults();
    } else {
      setStep("cards");
    }
  }

  // A standalone pack's own reveal goes straight to the portfolio instead of the results screen
  // (SummaryView) once it's done — a batch pack never reaches "cards" at all now (see
  // handleTearComplete above), so this only ever fires for the standalone case in practice; kept
  // simple rather than branching on batchContext for a path it can't actually take.
  function handleCardsDone() {
    onViewCollection();
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
