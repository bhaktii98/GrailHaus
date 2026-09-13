import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut } from "react-native-reanimated";
import type { BatchRevealState, PackSku, PulledOwnedItem, RevealStage } from "@grailhaus/shared";
import { groupBulkRun, summarizeBulkRun } from "@grailhaus/shared";
import { track } from "../../../lib/analytics";
import { tierRevealIdentity } from "./tierPersonality";
import { RunIntroStage } from "./RunIntroStage";
import { GrailHuntStage } from "./GrailHuntStage";
import { PrimeGridStage } from "./PrimeGridStage";
import { CoreListStage } from "./CoreListStage";

/**
 * The `BULK_GRAIL_HUNT` presentation strategy's stage machine.
 *
 * This is the whole of the bulk flow's control logic, and it is deliberately thin: which stage is
 * on screen, and what "next" means. The *rules* (how grails are ordered, which stages can be
 * skipped as empty, what the summary adds up to) all live in shared's bulkPresentation.ts as pure
 * functions, and each stage owns its own rendering. Nothing here re-implements a reveal — this is
 * a router over presentation stages, not a second reveal engine.
 *
 * It renders no summary of its own either: the terminal screen is the same `BatchSummaryScreen`
 * the existing flow already routes to, reached by the same `isBatchSummary` flag, so there is
 * exactly one batch summary in the app rather than a bulk-specific copy of one.
 *
 * Every transition is persisted by the caller (see usePackFlowViewModel's goToBulkStage /
 * revealGrail), which is what lets a process death resume mid-hunt rather than restarting the
 * chase. The contents themselves were never at risk — they're server-side and immutable — so
 * nothing here can change *what* the user gets, only how far along the presentation of it is.
 */
export function BulkRunOrchestrator({
  sku,
  packs,
  bulkReveal,
  onGoToStage,
  onAdvanceStage,
  onRevealGrail,
  onSkipToResults,
}: {
  sku: PackSku;
  /** The authoritative per-pack structure, exactly as the purchase produced it. Read, never
   * mutated — the grouping below returns new arrays over the same item references. */
  packs: PulledOwnedItem[][];
  bulkReveal: BatchRevealState;
  onGoToStage: (stage: RevealStage) => void;
  onAdvanceStage: () => void;
  onRevealGrail: (ownedItemId: string) => void;
  onSkipToResults: () => void;
}) {
  const groups = useMemo(() => groupBulkRun(packs), [packs]);
  const summary = useMemo(() => summarizeBulkRun(sku, packs), [sku, packs]);
  // Held here too so the crossfade between stages sits on the tier's own ground — otherwise the
  // 160ms gap where one stage has faded out and the next hasn't faded in flashes a generic dark.
  const identity = useMemo(() => tierRevealIdentity(sku.tier), [sku.tier]);
  const startedAt = useRef(Date.now());

  // One `bulk_reveal_started` per run, with the shape of what was pulled. Fired here rather than
  // at purchase time so it describes a run the user actually entered.
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    track("bulk_reveal_started", {
      tier: sku.tier,
      packId: sku.id,
      quantity: packs.length,
      totalCards: summary.totalCards,
      grailCount: summary.grailCount,
      primeCount: summary.primeCount,
      coreCount: summary.coreCount,
    });
  }, [sku.tier, sku.id, packs.length, summary]);

  // Stage-entry analytics. Keyed on the stage itself so a resume into the middle of a run still
  // reports the stage it landed on, and a re-render never double-fires.
  const lastStage = useRef<RevealStage | null>(null);
  useEffect(() => {
    if (lastStage.current === bulkReveal.stage) return;
    lastStage.current = bulkReveal.stage;
    const common = { tier: sku.tier, packId: sku.id };
    if (bulkReveal.stage === "grail_hunt") {
      track("grail_hunt_started", { ...common, grailCount: summary.grailCount });
    } else if (bulkReveal.stage === "prime") {
      track("prime_stage_started", { ...common, primeCount: summary.primeCount });
    } else if (bulkReveal.stage === "core") {
      track("core_stage_started", { ...common, coreCount: summary.coreCount });
    } else if (bulkReveal.stage === "summary") {
      track("bulk_reveal_completed", {
        ...common,
        totalCards: summary.totalCards,
        grailCount: summary.grailCount,
        bestPullId: summary.bestPull?.id,
        bestPullValueCents: summary.bestPull?.currentValueCents,
        durationMs: Date.now() - startedAt.current,
      });
    }
  }, [bulkReveal.stage, sku.tier, sku.id, summary]);

  function handleGrailRevealed(ownedItemId: string) {
    const isBest = summary.bestPull?.ownedItemId === ownedItemId;
    track(isBest ? "best_grail_revealed" : "grail_revealed", {
      tier: sku.tier,
      grailIndex: bulkReveal.currentGrailIndex,
    });
    onRevealGrail(ownedItemId);
  }

  return (
    <View style={[styles.fill, { backgroundColor: identity.backgroundHex }]}>
      {/* Crossfading each stage keeps the run feeling continuous — one journey rather than a
          sequence of screens that pop. Exiting first, so two stages never paint at once. */}
      <Animated.View
        key={bulkReveal.stage}
        style={styles.fill}
        entering={FadeIn.duration(320).easing(Easing.out(Easing.cubic))}
        exiting={FadeOut.duration(160)}
      >
        {bulkReveal.stage === "intro" && (
          <RunIntroStage
            sku={sku}
            packCount={packs.length}
            onBegin={() => onGoToStage("grail_hunt")}
            onSkip={onSkipToResults}
          />
        )}

        {bulkReveal.stage === "grail_hunt" && (
          <GrailHuntStage
            sku={sku}
            grails={groups.grails}
            startIndex={bulkReveal.currentGrailIndex}
            onGrailRevealed={handleGrailRevealed}
            onStageComplete={onAdvanceStage}
            onSkip={onSkipToResults}
          />
        )}

        {bulkReveal.stage === "prime" && (
          <PrimeGridStage sku={sku} primes={groups.primes} onContinue={onAdvanceStage} />
        )}

        {bulkReveal.stage === "core" && (
          <CoreListStage sku={sku} cores={groups.cores} onContinue={onAdvanceStage} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b0b10" },
});
