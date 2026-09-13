import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Canvas } from "@react-three/fiber/native";
import { runOnJS, useAnimatedReaction, type SharedValue } from "react-native-reanimated";
import type { OwnedItem, PulledOwnedItem, RarityTier } from "@grailhaus/shared";
import type { CategoryRevealConfig, RevealPhase } from "./types";
import { GestureLayer } from "./GestureLayer";
import { ChoreographyDriver } from "./ChoreographyDriver";
import { TiltLights } from "./TiltLights";
import { useDeviceTilt } from "./useDeviceTilt";
import { playHapticTrack } from "./HapticsTrack";
import { Renderer3DBoundary } from "./Renderer3DBoundary";
import { LiftLid2D } from "./LiftLid2D";
import { PackTear2D } from "../cards/reveal/PackTear2D";
import { ExploreOrbitGroup, ExploreOrbitSurface, useExploreOrbit } from "./ExploreOrbit";
import { usePackFlowStore } from "../../state/packFlowStore";
import { radii, spacing, typography } from "../../theme/tokens";
import { RarityBadge } from "../../components/RarityBadge";
import { Price } from "../../components/Price";
import { vaultFlow as copy } from "../../content/copy";

interface RevealEngineProps {
  config: CategoryRevealConfig;
  items: PulledOwnedItem[];
  rarityTiers: RarityTier[];
  packId: string;
  purchaseId: string | null;
  packPriceCents?: number;
  onViewDetails: (owned: OwnedItem) => void;
  onKeep: () => void;
  onListForSale: (owned: OwnedItem) => void;
}

/**
 * The reveal is its own dark, focused world regardless of the bright shell
 * around it (Shelf, nav) — it deliberately does not read shell theme
 * colors, only spacing/radii scale. Text/accent colors here are fixed, not
 * sourced from theme/tokens.ts.
 */
const reveal = {
  textPrimary: "#f5f0e6",
  textSecondary: "#a89fc4",
  accent: "#f4c94f",
  success: "#5ec49a",
  danger: "#e0705f",
  surface: "#1d1d28",
  border: "#3a3550",
  background: "#0b0b10",
};

function resolveTier(rarityTiers: RarityTier[], level: number): RarityTier {
  return (
    rarityTiers.find((t) => t.level === level) ?? {
      level: level as RarityTier["level"],
      name: "Unknown",
      colorHex: "#888888",
      valueMinCents: 0,
      valueMaxCents: 0,
    }
  );
}

// The 5-state progression from the original lift-lid design handoff (heritage-case.html's
// `.states` list: Closed / Lid opening / Lid fully open / Watch emergence / Inspection) — ported
// as a `gesture.mode === "lift-lid"` only enrichment (watches, handbags), never shown for `"tear"`
// (cards keep their own existing dot row). "Closed"/"Lid opening" both happen inside RevealEngine's
// own `"idle"` phase (the gesture hasn't completed yet) and are told apart by `liftDragActive`
// below; "Lid fully open"/"Watch emergence" both happen inside `"opening"` and are told apart by
// `openingSubPhase`, timed against the same dwell-before-rise beat WatchMesh's own `DWELL_S`
// already animates, so the label change and the on-screen motion land together.
const LID_STATES = ["Closed", "Lid opening", "Lid fully open", "Watch emergence", "Inspection"] as const;

/**
 * Bridges the gesture's UI-thread `openProgress` shared value to a one-shot JS boolean the
 * instant a lift-lid drag actually starts moving — not a live-updating number (that would
 * re-render this screen every frame of the drag for no visual payoff), just the single
 * Closed→"Lid opening" transition the states list needs. Renders nothing.
 */
function LiftLidDragWatcher({
  openProgress,
  active,
  onDragStart,
}: {
  openProgress: SharedValue<number>;
  active: boolean;
  onDragStart: () => void;
}) {
  useAnimatedReaction(
    () => openProgress.value,
    (value, prev) => {
      if (active && value > 0.03 && (prev == null || prev <= 0.03)) {
        runOnJS(onDragStart)();
      }
    },
    [active]
  );
  return null;
}

/**
 * Written once, shared by every category. A category personality is
 * entirely `config` — geometry, materials, lighting, camera, timing,
 * haptics, gesture feel, pacing order. Adding a category means writing a
 * new CategoryRevealConfig, not touching this file. Rarity names/colors
 * come from `rarityTiers` (admin-configurable data), never hardcoded here.
 */
export function RevealEngine({
  config,
  items,
  rarityTiers,
  packId,
  purchaseId,
  packPriceCents,
  onViewDetails,
  onKeep,
  onListForSale,
}: RevealEngineProps) {
  // True only for a flow reconstructed from disk after a process death mid-reveal (see
  // lib/activeReveal.ts and state/packFlowStore.ts) — never a fresh purchase. Watches only ever
  // pull one item, so there's no per-card beat to skip past here, just the single tear/lift
  // gesture and its opening hold; landing directly on the summary is still the right call, since
  // the alternative (re-showing an unopened box for an item that's already sitting in the user's
  // portfolio) would look like re-gifting something they already unwrapped.
  const resumedToSummary = usePackFlowStore((s) => s.resumedToSummary);
  const tilt = useDeviceTilt();
  // "Explore it in 3D" — drag to orbit, pinch to zoom, once a reveal has actually settled (see
  // ExploreOrbit.tsx's own header for why it's a separate gesture from GestureLayer's tear/lift
  // Pan, and why its overlay has to sit on top of the Canvas rather than wrap it).
  const orbit = useExploreOrbit();
  const orderedItems = useMemo(() => config.revealOrder(items), [items, config]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<RevealPhase>(resumedToSummary ? "summary" : "idle");
  const [beatLabel, setBeatLabel] = useState<string | null>(null);
  // Lift-lid-only states-list progression (see LID_STATES above) — both reset per item so a
  // second lift-lid pull in the same pack (handbags can have several; watches never do, per
  // PRD §21) starts back at "Closed" rather than carrying over the previous item's progress.
  const [liftDragActive, setLiftDragActive] = useState(false);
  const [openingSubPhase, setOpeningSubPhase] = useState<0 | 1>(0);
  const [momentVisible, setMomentVisible] = useState(false);
  const momentOpacity = useRef(new Animated.Value(0)).current;

  const maxTierLevel = useMemo(() => Math.max(...rarityTiers.map((t) => t.level), 1), [rarityTiers]);

  const current = orderedItems[index];
  const currentTier = current ? resolveTier(rarityTiers, current.rarityTierLevel) : null;
  const isRare = current?.rarityTierLevel === maxTierLevel;

  // A timeline reveal (see CategoryRevealConfig.choreographyMode) builds its scene once per item
  // and hands back bound pose/lights closures. Absent for every category whose reveal *is* its
  // gesture — those keep using `buildMesh` below, unchanged.
  const choreographyMode = config.choreographyMode;
  const mounted = useMemo(() => {
    if (!choreographyMode || !current || !currentTier) return null;
    const bound = choreographyMode.mount(current, { tierColor: currentTier.colorHex });
    return { ...bound, timing: choreographyMode.timing };
  }, [choreographyMode, current, currentTier]);

  // A timeline scene holds real GPU allocations (a prefiltered environment, a few hundred meshes),
  // and this engine remounts per item and per pack of a batch — so disposal is not optional.
  useEffect(() => {
    if (!mounted) return;
    return () => mounted.dispose();
  }, [mounted]);

  function handleChoreographyComplete() {
    setPhase("settled");
  }

  // A multi-stage timeline reveal (see RevealChoreography.gestureStages) changes which drag axis it
  // wants as it advances: The Obsidian Vault's ribbon is drawn sideways, then its lid is lifted
  // upward. `GestureLayer` derives its axis from one `gesture` value, so the driver announces each
  // stage and this state re-keys that layer.
  //
  // `null` means "no stage has been announced" — every single-stage reveal, and frame one of a
  // multi-stage one — in which case the category's own configured gesture is used unchanged. That
  // default is what keeps cards, handbags and the other two watch tiers untouched by this.
  const [activeStage, setActiveStage] = useState<{
    id: string;
    axis: "x" | "y";
    prompt?: string;
    index: number;
  } | null>(null);

  // Reset per item, so a second pull in the same pack starts from its first stage rather than
  // inheriting the previous item's last one.
  useEffect(() => {
    setActiveStage(null);
  }, [index]);

  // The gesture handed to GestureLayer: the category's own, with the active stage's axis and feel
  // substituted when one has been announced. A stage's axis maps onto the existing `mode` values
  // ("tear" reads translationX, "lift-lid" reads -translationY), so no new gesture primitive is
  // needed for this — only a different selection among what GestureLayer already does.
  const effectiveGesture = useMemo(() => {
    if (!activeStage || !mounted) return config.gesture;
    const stage = mounted.timing.gestureStages?.[activeStage.index];
    return {
      mode: activeStage.axis === "x" ? ("tear" as const) : ("lift-lid" as const),
      velocityThreshold: stage?.velocityThreshold ?? config.gesture.velocityThreshold,
      travelDistance: stage?.travelDistance ?? config.gesture.travelDistance,
    };
  }, [activeStage, mounted, config.gesture]);

  // A stage whose `autoAdvanceAfterS` is set plays itself — the ribbon settling on the floor is
  // watched, not dragged. The engine must therefore leave `phase` at "opening" (so the driver's
  // clock keeps running) while offering no gesture for it.
  const activeStageIsAuto = useMemo(() => {
    if (!activeStage || !mounted) return false;
    return mounted.timing.gestureStages?.[activeStage.index]?.autoAdvanceAfterS != null;
  }, [activeStage, mounted]);

  // Whether another opening gesture is still owed after the current one commits. While true a
  // committed gesture must NOT advance the engine's own phase past "opening", or the remaining
  // stages would never be offered.
  const hasPendingStages = useMemo(() => {
    if (!mounted) return false;
    const stages = mounted.timing.gestureStages;
    if (!stages || stages.length <= 1) return false;
    const i = activeStage?.index ?? 0;
    return i < stages.length - 1;
  }, [mounted, activeStage]);

  useEffect(() => {
    if (phase !== "opening" || !current) return;
    // A timeline reveal owns its own duration: the driver calls `onComplete` when the choreography
    // actually finishes. This block's fixed hold (commonBeatMs/rareHoldMs — 1.4s/3s for watches)
    // would otherwise force `settled` while the 12.6s sequence was still mid-motion, cutting the
    // reveal off around the platform's rise and skipping the presentation and rarity beats
    // entirely. The narration and haptics below are skipped for the same reason: the choreography
    // publishes its own phase labels through the driver and fires its own beats pinned to the
    // motion, so running both would double up one beat out of step.
    if (config.choreographyMode) return;
    const cancel = playHapticTrack(config.hapticTrack(phase, isRare));
    const holdMs = isRare ? config.timing.rareHoldMs : config.timing.commonBeatMs;
    // A slower, narrated version of the same gesture/hold — not a new phase, just labels laid
    // over the existing duration (see CategoryRevealConfig.openingBeats).
    const beats = config.openingBeats?.(isRare) ?? [];
    setBeatLabel(beats[0]?.label ?? null);
    const beatTimers = beats.slice(1).map((beat) => setTimeout(() => setBeatLabel(beat.label), beat.atMs));
    const timer = setTimeout(() => setPhase("settled"), holdMs);
    // "Lid fully open" → "Watch emergence": same dwell WatchMesh's own DWELL_S (0.45s) spends
    // motionless before the platform starts rising, capped to a third of a short common-pull
    // hold so the label change never outlasts the hold itself.
    setOpeningSubPhase(0);
    const dwellMs = Math.min(450, holdMs / 3);
    const subPhaseTimer = setTimeout(() => setOpeningSubPhase(1), dwellMs);
    return () => {
      cancel();
      beatTimers.forEach(clearTimeout);
      clearTimeout(timer);
      clearTimeout(subPhaseTimer);
    };
  }, [phase, current, isRare, config]);

  // The states list resets to "Closed" at the start of every fresh idle phase (a new item, or —
  // for watches specifically — the only item), and the "Heritage moment" word (see `.moment` in
  // the original design's heritage-case.html: a single word + brass hairline, nothing else) plays
  // once, automatically, right as the piece settles into view — never gating anything, never
  // reappearing until the next item.
  useEffect(() => {
    if (phase === "idle") setLiftDragActive(false);
    if (phase === "settled") {
      setMomentVisible(true);
      const t = setTimeout(() => setMomentVisible(false), 2200);
      return () => clearTimeout(t);
    }
    setMomentVisible(false);
  }, [phase, index]);

  useEffect(() => {
    Animated.timing(momentOpacity, {
      toValue: momentVisible ? 1 : 0,
      duration: momentVisible ? 700 : 900,
      useNativeDriver: true,
    }).start();
  }, [momentVisible, momentOpacity]);

  // Was a flat 500ms auto-advance out of "settled" — the one phase where the user is actually
  // looking at what they got, with nothing left to build toward. A fixed timer here is exactly
  // the "reveals that auto-play... miss the entire point" failure mode every other reveal in
  // this app was built to avoid (HoldToOpenFanReveal's own card only docks on a tap, never a
  // timer) — RevealEngine just never got the same treatment. Continuing now takes a real tap
  // (handleContinue, wired below), so "explore the watch" means whatever the user wants it to.
  function handleContinue() {
    if (index + 1 < orderedItems.length) {
      setIndex((i) => i + 1);
      setPhase("idle");
    } else {
      setPhase("summary");
    }
  }

  if (phase === "summary" || !current || !currentTier) {
    return (
      <SummaryView
        items={orderedItems}
        rarityTiers={rarityTiers}
        packId={packId}
        purchaseId={purchaseId}
        packPriceCents={packPriceCents}
        onViewDetails={onViewDetails}
        onKeep={onKeep}
        onListForSale={onListForSale}
      />
    );
  }

  const isTear = config.gesture.mode === "tear";
  const hintLabel = isTear ? "SWIPE UP TO TEAR" : "LIFT THE LID";
  // See LID_STATES above — idle/opening each cover two named states, told apart by
  // `liftDragActive`/`openingSubPhase`; settled is always "Inspection".
  const liftStateIndex =
    phase === "idle" ? (liftDragActive ? 1 : 0) : phase === "opening" ? (openingSubPhase === 0 ? 2 : 3) : 4;

  return (
    <View style={[styles.container, { backgroundColor: config.palette.background }]}>
      <View style={styles.hud}>
        {phase === "idle" ? (
          <>
            <Text style={styles.hudEyebrow}>
              {config.label.toUpperCase()} · {isTear ? "SEALED" : "LIFT THE LID"}
            </Text>
            {isTear && (
              <View style={styles.dotRow}>
                {orderedItems.map((item, i) => (
                  <View key={item.id ?? i} style={[styles.dot, i === index && styles.dotActive]} />
                ))}
              </View>
            )}
          </>
        ) : phase === "opening" ? (
          // Rarity intentionally withheld here — the RarityBadge only appears once "settled",
          // so the narrated beats ("SILHOUETTE VISIBLE", "RARITY LOCKING IN", ...) actually
          // lead somewhere instead of the badge spoiling it from the first frame.
          <Text style={styles.hudEyebrow}>{beatLabel ?? `${config.label.toUpperCase()} OPENING…`}</Text>
        ) : (
          <>
            <Text style={styles.hudText}>
              {index + 1} / {orderedItems.length}
            </Text>
            <RarityBadge tier={currentTier} />
          </>
        )}
      </View>

      <View style={{ flex: 1 }}>
        {/* `gesture` is the active stage's when a multi-stage timeline reveal has announced one,
            and the category's own otherwise (see `effectiveGesture`). `enabled` additionally stays
            true through the intermediate stages of such a reveal: once the first gesture commits
            the engine's phase becomes "opening", but a further gesture is still owed, and gating on
            `phase === "idle"` alone would leave the user with nothing to drag. An auto-advancing
            stage (the ribbon settling) offers no gesture, which is the one case where "opening"
            genuinely means hands-off. */}
        <GestureLayer
          gesture={effectiveGesture}
          onComplete={() => {
            // A committed gesture with stages still owed must not advance the engine past
            // "opening" — the driver walks to the next stage itself and re-announces the axis.
            if (!hasPendingStages) setPhase("opening");
            else if (phase === "idle") setPhase("opening");
          }}
          enabled={
            phase === "idle" || (phase === "opening" && hasPendingStages && !activeStageIsAuto)
          }
        >
          {(openProgress) => (
            <>
              {!isTear && (
                <LiftLidDragWatcher
                  openProgress={openProgress}
                  active={phase === "idle"}
                  onDragStart={() => setLiftDragActive(true)}
                />
              )}
              {/* Every card-tier tear already goes through this same boundary (see
                  CardFlowEngine.IntroductionView) — RevealEngine's own Canvas never did, which meant
                  a broken/unavailable 3D context here (expo-gl init failure, an r3f reconciler error —
                  Renderer3DBoundary's own header names on-device iOS as a real, seen failure mode) had
                  no fallback at all: gesture physics still ran (GestureLayer owns that, unconditionally),
                  but there was nothing for the user to actually see or feel respond to it. */}
              <Renderer3DBoundary
                fallback={
                  isTear ? (
                    <PackTear2D
                      openProgress={openProgress}
                      topColor={config.palette.accent}
                      bottomColor={config.palette.background}
                      wordmark={config.label.toUpperCase()}
                      badge={config.label}
                    />
                  ) : (
                    <LiftLid2D openProgress={openProgress} accentColor={config.palette.accent} caseColor={config.palette.background} />
                  )
                }
              >
                <Canvas
                  camera={{
                    position: config.camera.position,
                    fov: config.camera.fov,
                    // A timeline reveal may model at true real-world scale (the vault is 0.26m
                    // wide with millimetre detail, framed from ~0.35m), where r3f's default
                    // `near: 0.1` clips the subject away as soon as the user zooms in. A category
                    // can declare its own clipping planes; everything else keeps r3f's defaults.
                    ...(config.camera.near != null ? { near: config.camera.near } : {}),
                    ...(config.camera.far != null ? { far: config.camera.far } : {}),
                  }}
                >
                  {mounted ? (
                    <>
                      {/* A timeline reveal supplies its own light rig as part of its scene, so the
                          category's flat ambient/directional pair (and its tilt sway) would fight
                          the choreography's own escalating spots rather than add to them. */}
                      <ChoreographyDriver
                        timing={mounted.timing}
                        pose={mounted.pose}
                        lights={mounted.lights}
                        openProgress={openProgress}
                        gestureActive={phase === "idle"}
                        playing={phase === "opening"}
                        onComplete={handleChoreographyComplete}
                        onPhaseChange={setBeatLabel}
                        cameraReleased={phase === "settled"}
                        // Re-keys the gesture layer onto each stage's own axis as the reveal
                        // advances. Never fires for a single-stage reveal.
                        onStageChange={setActiveStage}
                      />
                      <ExploreOrbitGroup handle={orbit}>{mounted.node}</ExploreOrbitGroup>
                    </>
                  ) : (
                    <>
                      <TiltLights lighting={config.lighting} tilt={tilt} />
                      <ExploreOrbitGroup handle={orbit}>
                        {config.buildMesh(current, { openProgress, tierColor: currentTier.colorHex })}
                      </ExploreOrbitGroup>
                    </>
                  )}
                </Canvas>
              </Renderer3DBoundary>
            </>
          )}
        </GestureLayer>
        <ExploreOrbitSurface handle={orbit} active={phase === "settled"} />
      </View>

      {/* States list — ported from heritage-case.html's `.states` (bottom-left hairline list).
          Lift-lid only; cards keep their own dot row above. Two design-source features
          deliberately NOT ported here: the "collection" sidebar (browsing other pieces of the
          same tier mid-reveal) and the "ident" panel — both assume a design-tool showcase
          browsing between several pieces at once, which doesn't map onto this app's flow of
          revealing the one specific item a pull just produced. A "Return to rest" reset action
          was cut for the same reason: there's nothing to reset back to — once revealed, the item
          is already the user's, not a case to re-close and re-open. */}
      {!isTear && (
        <View style={styles.statesList} pointerEvents="none">
          {LID_STATES.map((label, i) => (
            <View key={label} style={styles.stateRow}>
              <View
                style={[
                  styles.stateHairline,
                  i < liftStateIndex && styles.stateHairlineDone,
                  i === liftStateIndex && styles.stateHairlineOn,
                ]}
              />
              <Text
                style={[
                  styles.stateLabel,
                  i < liftStateIndex && styles.stateLabelDone,
                  i === liftStateIndex && styles.stateLabelOn,
                ]}
              >
                {label.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {phase === "idle" && (
        // pointerEvents="none": this absolutely-positioned footer floats on top of the
        // GestureLayer's view (a separate sibling, not a descendant of its GestureDetector) —
        // without this, a touch starting on the hint text itself (the single most natural place
        // to start the swipe) gets captured by this plain View's native hit-test first and never
        // reaches the gesture recognizer at all, making the whole screen feel completely
        // unresponsive. Purely decorative, never needs to receive touches itself.
        <View style={styles.idleFooter} pointerEvents="none">
          {isTear ? (
            <Text style={styles.hint}>{hintLabel}</Text>
          ) : (
            <>
              <Text style={styles.hintEm}>Drag upward to lift the lid</Text>
              <Text style={styles.hint}>Slow and steady</Text>
            </>
          )}
          <View style={styles.dragHandle} />
        </View>
      )}

      {phase === "settled" && (
        // "Explore the watch" only means something if nothing forces you off this screen —
        // this used to auto-advance to the next item/summary on a flat 500ms timer regardless
        // of whether anyone had actually looked yet (handleContinue's own comment). A deliberate
        // tap target rather than making the whole screen tappable, so tilting the device to
        // watch the case's own light sweep (TiltLights) never accidentally dismisses it.
        <View style={styles.idleFooter} pointerEvents="box-none">
          {!isTear && <Text style={styles.hintEmSmall}>Drag to rotate · pinch to zoom</Text>}
          <Text style={[styles.hint, { opacity: 0.6 }]}>{isTear ? "DRAG TO ROTATE · PINCH TO ZOOM" : "Inspect every detail"}</Text>
          <Pressable onPress={handleContinue} hitSlop={16}>
            <Text style={styles.hint}>TAP TO CONTINUE</Text>
          </Pressable>
        </View>
      )}

      {/* The "moment" — heritage-case.html's `.moment`: one word (here, the tier the pull actually
          landed on, so it's a real payoff rather than a static brand word) with a brass hairline
          underneath, fading in as the piece settles, then fading back out on its own. Never
          blocks input (pointerEvents="none") and never gates phase advancement. */}
      {!isTear && (
        <Animated.View style={[styles.momentOverlay, { opacity: momentOpacity }]} pointerEvents="none">
          <Text style={styles.momentWord}>{currentTier.name.toUpperCase()}</Text>
          <View style={styles.momentHairline} />
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Watches always pull exactly one item (PRD §21 — no bulk mode for watches), so "the revealed
 * watch" below is unambiguous even though this stays written for the general N-item case. The
 * three terminal actions act on that one real `owned_items` row — `ownedItemId` comes straight
 * off the purchase response (see server's purchase.service.ts), not a separate portfolio
 * lookup, so "List for Sale" can hand off directly into SellItemScreen.
 */
function SummaryView({
  items,
  rarityTiers,
  packId,
  purchaseId,
  packPriceCents,
  onViewDetails,
  onKeep,
  onListForSale,
}: {
  items: PulledOwnedItem[];
  rarityTiers: RarityTier[];
  packId: string;
  purchaseId: string | null;
  packPriceCents?: number;
  onViewDetails: (owned: OwnedItem) => void;
  onKeep: () => void;
  onListForSale: (owned: OwnedItem) => void;
}) {
  const totalValueCents = items.reduce((sum, item) => sum + item.baseValueCents, 0);
  const best = items.reduce((a, b) => (b.baseValueCents > a.baseValueCents ? b : a), items[0]);
  const bestTier = best ? resolveTier(rarityTiers, best.rarityTierLevel) : null;

  // Synthesized locally rather than read back from `/me/portfolio` — the purchase response
  // already carries everything the two terminal actions need, and a round trip here would put a
  // spinner between the reveal and "List for Sale".
  //
  // `costBasisCents` is this copy's share of what the pack cost, which is exactly how the server
  // derives it too (portfolio.repository.ts) — floored here because the server hands the
  // sub-cent remainder to specific rows in id order, which this side can't know. The
  // authoritative figure lands with the next portfolio read; the two differ by at most a cent,
  // and only for packs whose price doesn't divide evenly.
  const acquiredAt = new Date().toISOString();
  const bestOwned: OwnedItem | null = best
    ? {
        ownedItemId: best.ownedItemId,
        item: best,
        packId,
        purchaseId,
        acquiredAt,
        heldSinceAt: acquiredAt,
        costBasisCents: packPriceCents != null ? Math.floor(packPriceCents / items.length) : null,
        acquiredVia: "pack",
        activeListing: null,
      }
    : null;

  return (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>{copy.summaryTitle}</Text>
      {best && bestTier && (
        <View style={styles.heroCard}>
          <RarityBadge tier={bestTier} />
          <Text style={styles.heroName}>{best.name}</Text>
          <Price cents={best.baseValueCents} color={reveal.accent} />
        </View>
      )}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Total value</Text>
        <Price cents={totalValueCents} color={reveal.textPrimary} />
      </View>
      {packPriceCents != null && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Profit / Loss</Text>
          <Text
            style={[
              typography.price,
              { color: totalValueCents >= packPriceCents ? reveal.success : reveal.danger },
            ]}
          >
            {totalValueCents - packPriceCents >= 0 ? "+" : "-"}$
            {(Math.abs(totalValueCents - packPriceCents) / 100).toFixed(2)}
          </Text>
        </View>
      )}
      {bestOwned && (
        <View style={styles.terminalActions}>
          <Pressable style={styles.terminalPrimary} onPress={() => onViewDetails(bestOwned)}>
            <Text style={styles.terminalPrimaryLabel}>{copy.viewDetails}</Text>
          </Pressable>
          <View style={styles.terminalRow}>
            <Pressable style={styles.terminalSecondary} onPress={onKeep}>
              <Text style={styles.terminalSecondaryLabel}>{copy.keep}</Text>
            </Pressable>
            <Pressable style={styles.terminalSecondary} onPress={() => onListForSale(bestOwned)}>
              <Text style={styles.terminalSecondaryLabel}>{copy.listForSale}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
  },
  hudText: { color: reveal.textSecondary, ...typography.caption },
  hudEyebrow: { ...typography.eyebrow, color: "rgba(255,255,255,0.7)", letterSpacing: 2 },
  dotRow: { flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.24)" },
  dotActive: { backgroundColor: reveal.accent },
  idleFooter: {
    position: "absolute",
    bottom: spacing.xxl,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: spacing.lg,
  },
  hint: {
    color: reveal.textSecondary,
    ...typography.body,
    letterSpacing: 1,
  },
  hintEm: {
    ...typography.title,
    color: reveal.textPrimary,
    textAlign: "center",
  },
  hintEmSmall: {
    ...typography.body,
    color: reveal.textPrimary,
    textAlign: "center",
  },
  dragHandle: {
    width: 44,
    height: 4,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  statesList: {
    position: "absolute",
    left: spacing.xl,
    bottom: spacing.xxl,
    gap: 9,
  },
  stateRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stateHairline: {
    width: 18,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  stateHairlineOn: { width: 34, backgroundColor: reveal.accent },
  stateHairlineDone: { backgroundColor: "rgba(255,255,255,0.4)" },
  stateLabel: {
    ...typography.caption,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.32)",
  },
  stateLabelOn: { color: reveal.textPrimary },
  stateLabelDone: { color: "rgba(255,255,255,0.5)" },
  momentOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: "20%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  momentWord: {
    ...typography.eyebrow,
    color: reveal.textPrimary,
    letterSpacing: 6,
    paddingBottom: 14,
  },
  momentHairline: {
    width: 40,
    height: 1,
    backgroundColor: reveal.accent,
    opacity: 0.8,
  },
  summary: {
    flex: 1,
    backgroundColor: reveal.background,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.lg,
  },
  summaryTitle: { color: reveal.textPrimary, ...typography.display, textAlign: "center" },
  heroCard: {
    backgroundColor: reveal.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: reveal.border,
  },
  heroName: { color: reveal.textPrimary, ...typography.title },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
  },
  summaryLabel: { color: reveal.textSecondary, ...typography.body },
  terminalActions: { marginTop: spacing.lg, gap: spacing.sm },
  terminalPrimary: {
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: reveal.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  terminalPrimaryLabel: { ...typography.body, fontWeight: "700" as const, color: reveal.background },
  terminalRow: { flexDirection: "row", gap: spacing.sm },
  terminalSecondary: {
    flex: 1,
    height: 50,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: reveal.border,
    alignItems: "center",
    justifyContent: "center",
  },
  terminalSecondaryLabel: { ...typography.body, color: reveal.textPrimary },
});
