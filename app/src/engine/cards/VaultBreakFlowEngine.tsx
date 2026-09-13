import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { PackSku, PulledOwnedItem } from "@grailhaus/shared";
import { usePackFlowStore } from "../../state/packFlowStore";
import { usePackFlowViewModel } from "../../viewmodels/usePackFlowViewModel";
import { useCollectionViewModel } from "../../viewmodels/useCollectionViewModel";
import { ProcessingView, ReadyView, SummaryView } from "./CardFlowEngine";
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
 */
export function VaultBreakFlowEngine({
  sku,
  items,
  onFinished,
  onRipAgain,
  onGoHome,
  onViewCollection,
  isRipAgainWorking,
}: {
  sku: PackSku;
  items: PulledOwnedItem[];
  onFinished: () => void;
  onRipAgain: () => void;
  onGoHome: () => void;
  onViewCollection: () => void;
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
    setStep("cards");
  }

  // Vault Break is never batched (see this file's header) — its own reveal's "Continue"/swipe-up
  // goes straight to the portfolio instead of the results screen (SummaryView), same as a
  // standalone CardFlowEngine pack.
  function handleCardsDone() {
    onViewCollection();
  }

  if (step === "processing") {
    return <ProcessingView visibleRows={visibleStatusRows} onComplete={handleProcessingDone} />;
  }

  if (step === "ready") {
    return <ReadyView sku={sku} onBeginRip={handleBeginRip} onOpenLater={handleOpenLater} />;
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
