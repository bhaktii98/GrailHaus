import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Canvas, useFrame } from "@react-three/fiber/native";
import type { DirectionalLight } from "three";
import type { ItemDetail, PackSku } from "@grailhaus/shared";
import { usePackFlowStore } from "../../state/packFlowStore";
import { usePackFlowViewModel } from "../../viewmodels/usePackFlowViewModel";
import { useCollectionViewModel } from "../../viewmodels/useCollectionViewModel";
import { GestureLayer } from "../core/GestureLayer";
import { Renderer3DBoundary } from "../core/Renderer3DBoundary";
import { useDeviceTilt, type DeviceTilt } from "../core/useDeviceTilt";
import type { CategoryRevealConfig } from "../core/types";
import { PackTearMesh } from "./reveal/PackTearMesh";
import { PackTear2D } from "./reveal/PackTear2D";
import { cardPackPersonality } from "./reveal/config/cardPack.config";
import { CardPackFanReveal } from "./reveal/CardPackFanReveal";
import { playHapticTrack } from "../core/HapticsTrack";
import { playSfx } from "../../lib/sfx";
import { PackFace } from "../../components/PackFace";
import { ProgressRing } from "../../components/ProgressRing";
import { StatBox } from "../../components/StatBox";
import { ART_GRADIENT, tierLabel } from "../../components/PackTile";
import { accents, fonts, ink, shadow, spacing } from "../../theme/tokens";
import { cardFlow as copy } from "../../content/copy";

type Step = "processing" | "ready" | "introduction" | "cards" | "summary";

const PROCESSING_DURATION_MS = 2000;

/** Which pack of a bulk (10-pack) batch this instance is showing, 1-based `index`/`total` for
 * display. Undefined for a plain single-pack purchase. See RevealScreen for how this is derived
 * from `usePackFlowStore`'s `packs`/`currentPackIndex`, and CardFlowEngine's own header for what
 * it changes here (skips the processing narration after pack one, swaps the summary's terminal
 * three-button footer for a single "next pack" advance). */
export interface BatchContext {
  index: number; // 0-based
  total: number;
}

/**
 * The Cards journey's post-payment flow: Processing → Ready → Introduction →
 * press-and-hold-per-card fan reveal → Pack Complete summary. Replaces
 * `RevealEngine`'s cards branch. Keeps the 3D `CardMesh` + `GestureLayer` for
 * exactly one beat — the pack tear in Introduction — everything else here is
 * flat 2D. The card reveal itself (CardPackFanReveal, in ./reveal/) is the
 * same shared engine Vault Break and Black Label use for their own post-tear
 * reveal (see reveal/holdToOpen/HoldToOpenFanReveal.tsx) — every tier now
 * reveals its cards the same deliberate way, only the pack tear before it and
 * the card art itself differ per tier.
 *
 * Also the engine a bulk (10-pack) batch runs, one pack at a time — `batchContext`/`onNextPack`
 * are the only things that change for that case (see RevealScreen, which mounts a fresh instance
 * of this per pack, keyed by purchase id + pack index). Nothing about the reveal itself — gesture
 * physics, pacing, haptics, tension choreography — is a "batch mode": each pack still tears,
 * fans through its own cards, and holds on its own rare pull exactly like a standalone purchase
 * would. The only two concessions to not making ten of these back to back feel like a chore: the
 * "Processing" narration (payment/stock/contents) only plays once, before pack one — replaying
 * "Payment successful" ten times narrates nothing new after the first — and each pack's own
 * summary hands off to the next pack (or the batch's terminal summary) with one tap instead of
 * the three-way choice a standalone purchase's summary offers.
 */
export function CardFlowEngine({
  sku,
  items,
  config,
  batchContext,
  onNextPack,
  onSkipToResults,
  onFinished,
  onRipAgain,
  onGoHome,
  onViewCollection,
  isRipAgainWorking,
}: {
  sku: PackSku;
  items: ItemDetail[];
  /** This category's backend-driven reveal personality (see categoryRevealConfig.ts) — gesture
   * feel and haptic track come from here now instead of the old hardcoded `cardsConfig` import,
   * so an admin editing the "cards" row in the dashboard actually changes this screen. */
  config: CategoryRevealConfig;
  batchContext?: BatchContext;
  onNextPack?: () => void;
  /** Batch-mode agency: jump straight to the terminal batch summary from anywhere in this
   * pack's own flow, without watching the rest of it (or any later pack) play out. Every pack's
   * contents are already pulled and persisted regardless — this only ever skips animation, never
   * content. Undefined outside batch mode. */
  onSkipToResults?: () => void;
  onFinished: () => void;
  onRipAgain: () => void;
  onGoHome: () => void;
  onViewCollection: () => void;
  isRipAgainWorking: boolean;
}) {
  const setPhase = usePackFlowStore((s) => s.setPhase);
  // True only when this flow was reconstructed from disk after a process death or lost network
  // response (see lib/activeReveal.ts) — never on a normal fresh purchase, and never on a normal
  // advance to the next pack of a batch. Read once at mount (a flow engine is always freshly
  // mounted per pack — keyed by purchase id + pack index in RevealScreen) so a resumed session
  // lands directly on its summary instead of replaying the intro/tear/per-card beats the user
  // already missed. The pulled contents are identical either way.
  const resumedToSummary = usePackFlowStore((s) => s.resumedToSummary);
  // Non-null only alongside a partial-progress resume — how many cards were already dock'd, so
  // this can land straight on "cards" (its own tear already happened before the process died)
  // instead of replaying processing/ready/introduction. See packFlowStore's own doc comment —
  // mutually exclusive with `resumedToSummary` by construction.
  const resumedOpenedCount = usePackFlowStore((s) => s.resumedOpenedCount);
  const { recordCardOpened } = usePackFlowViewModel();
  const { owned } = useCollectionViewModel();
  // Every pack after the first in a batch skips straight past the processing narration — the
  // one purchase behind the whole batch already cleared, once, before pack one ever mounted.
  const skipProcessing = (batchContext?.index ?? 0) > 0;
  const [step, setStep] = useState<Step>(
    resumedOpenedCount != null ? "cards" : resumedToSummary ? "summary" : skipProcessing ? "ready" : "processing"
  );
  const [visibleStatusRows, setVisibleStatusRows] = useState(0);
  const tearCompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (tearCompleteTimer.current) clearTimeout(tearCompleteTimer.current);
  }, []);

  // Standalone pack: commons first, rarest last (cardsConfig.revealOrder's own rule,
  // reimplemented here rather than called directly so `orderedItems` keeps its full
  // `ItemDetail[]` typing instead of narrowing to the reveal engine's minimal `PulledItem` shape)
  // — "Card 5 is the major tension point" only works if the grail really is last.
  // A batch pack's `items` arrives already grouped and ordered by RevealScreen (every grail
  // across the whole batch first, then prime, then core — see its own `batchOrderedItems`), so
  // this just keeps that order rather than re-deriving or overriding it.
  const orderedItems = useMemo(
    () => (batchContext ? items : [...items].sort((a, b) => a.rarityTierLevel - b.rarityTierLevel)),
    [items, batchContext]
  );

  // Real ownership math: how many of each pulled id this account held *before* this pack —
  // `owned` already includes the just-purchased copies (the purchase's query invalidation ran
  // before this screen mounted), so we subtract this pull's own copies back out.
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
    const timers = [0, 700, 1400].map((delay, i) =>
      setTimeout(() => setVisibleStatusRows(i + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [step]);

  function handleProcessingDone() {
    setStep("ready");
    setPhase("ready");
  }

  function handleBeginRip() {
    setStep("introduction");
    setPhase("revealing");
  }

  function handleOpenLater() {
    onFinished();
  }

  function handleTearComplete() {
    // GestureLayer's onComplete fires the instant the swipe is *recognized* — well before
    // buildPackObject's own tear-off release (past q > 0.97) and its ballistic fall have played
    // out. That fall isn't a quick drop: with this physics's gravity/drag/restitution
    // constants, the torn strip typically needs two or three bounces to settle below the "at
    // rest" threshold — a first pass at 1000ms cut away while it was still visibly mid-bounce,
    // which read as "nothing lands." 2500ms comfortably covers a full multi-bounce settle.
    playHapticTrack(config.hapticTrack("opening", false));
    playSfx("packTear");
    tearCompleteTimer.current = setTimeout(() => {
      // Every pack of a batch — including this one — still gets the real per-card reveal
      // (step "cards"), same as a standalone pack: same HoldToOpenFanReveal, same grail
      // treatment, just paced by `compressed`/`autoAdvance` below once mounted. `onSkipToResults`
      // is an explicit user choice (the "Skip to results" link on ReadyView), never something a
      // tear triggers on its own — firing it here unconditionally for every batch pack was a bug:
      // it skipped straight to the terminal batch summary after the very first tear, before a
      // single card had actually been shown.
      setStep("cards");
    }, 2500);
  }

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
    return (
      <ProcessingView
        visibleRows={visibleStatusRows}
        onComplete={handleProcessingDone}
      />
    );
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

  if (step === "introduction") {
    return (
      <IntroductionView sku={sku} gesture={config.gesture} batchContext={batchContext} onTearComplete={handleTearComplete} />
    );
  }

  if (step === "cards") {
    // Pack one of a batch still plays the full ritual — only pack two onward compresses, so the
    // choreography is established once before it starts tightening up. Auto-advance, though,
    // applies to the whole batch including pack one: sitting through 50 taps across 10 packs
    // isn't practical regardless of which pack it is, so every pack of a batch auto-cascades
    // through its commons/rares, leaving only the chase pull requiring a real tap.
    const compressed = (batchContext?.index ?? 0) > 0;
    const autoAdvance = batchContext != null;
    return (
      <CardPackFanReveal
        items={orderedItems}
        sku={sku}
        compressed={compressed}
        autoAdvance={autoAdvance}
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

export function ProcessingView({ visibleRows, onComplete }: { visibleRows: number; onComplete: () => void }) {
  const rows = [
    { label: copy.processing.paymentSuccess, done: visibleRows >= 1 },
    { label: copy.processing.stockDecremented, done: visibleRows >= 2 },
    { label: copy.processing.sealingContents, done: visibleRows >= 3 },
  ];
  return (
    <View style={styles.fill}>
      <View style={styles.processingCenter}>
        <Text style={styles.eyebrow}>{copy.processing.title}</Text>
        <ProgressRing durationMs={PROCESSING_DURATION_MS} color={accents.cards.top} onComplete={onComplete} />
        <Text style={styles.processingHeading}>{copy.processing.heading}</Text>
        <Text style={styles.processingBody}>{copy.processing.body}</Text>
      </View>
      <View style={styles.processingSteps}>
        {rows.map((row) => (
          <View key={row.label} style={[styles.processingRow, !row.done && styles.processingRowPending]}>
            <View style={[styles.processingDot, row.done && styles.processingDotDone]} />
            <Text style={styles.processingRowText}>{row.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ReadyView({
  sku,
  batchContext,
  onBeginRip,
  onOpenLater,
  onSkipToResults,
}: {
  sku: PackSku;
  batchContext?: BatchContext;
  onBeginRip: () => void;
  onOpenLater: () => void;
  onSkipToResults?: () => void;
}) {
  const art = ART_GRADIENT[sku.tier] ?? ART_GRADIENT.street_rip;
  // A batch purchase is one tear standing in for the whole ten (see CardFlowEngine's own
  // handleTearComplete) — this screen is the one and only place that tear gets set up, so it
  // needs to read as "one big pack holding everything," not "pack 1 of 10, nine more to go."
  // Deliberately blunt about it: the pack itself is physically bigger than a single-pack purchase
  // ever renders (266x368 vs 206x286 — not a subtle few-percent bump), with a visible slab of
  // stacked edges behind it (offsets big enough to read at a glance, not a faint few-pixel hint)
  // and a bold ×N badge. `bigPackGhosts` are inert PackFaces with no state of their own.
  const bigPackGhosts = batchContext ? [4, 3, 2, 1] : [];
  const BIG_W = 266, BIG_H = 368;
  return (
    <View style={styles.fill}>
      <View style={styles.readyCenter}>
        <Text style={styles.eyebrow}>{batchContext ? `${batchContext.total}-PACK BATCH` : copy.ready.title}</Text>
        <Text style={styles.readyHeading}>
          {batchContext ? `All ${batchContext.total} packs, sealed into one.` : copy.ready.heading}
        </Text>
        {batchContext ? (
          <View style={[styles.bigPackStack, { width: BIG_W + 24, height: BIG_H + 24 }]}>
            {bigPackGhosts.map((d) => (
              <View
                key={d}
                style={[
                  styles.bigPackGhost,
                  { transform: [{ translateX: d * 6 }, { translateY: -d * 6 }], opacity: 1 - d * 0.16 },
                ]}
              >
                <PackFace art={art} width={BIG_W} height={BIG_H} radius={18} crimp />
              </View>
            ))}
            <View style={styles.bigPackGhost}>
              <PackFace art={art} width={BIG_W} height={BIG_H} radius={18} crimp label={sku.name} />
            </View>
            <View style={styles.bigPackBadge}>
              <Text style={styles.bigPackBadgeText}>×{batchContext.total} PACKS</Text>
            </View>
          </View>
        ) : (
          <PackFace art={art} width={206} height={286} radius={16} crimp label={sku.name} />
        )}
        <StatBox
          label={copy.ready.insideLabel}
          value={copy.ready.insideValue(batchContext ? sku.itemCount * batchContext.total : sku.itemCount)}
          bordered={false}
        />
      </View>
      <View style={styles.footer}>
        <Pressable onPress={onBeginRip}>
          <LinearGradient colors={[accents.cards.top, accents.cards.bottom]} style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>{copy.ready.beginRip}</Text>
          </LinearGradient>
        </Pressable>
        {onSkipToResults ? (
          // Batch mode: "open later" doesn't have a coherent meaning mid-batch (there's no
          // per-pack "sealed" state to leave a batch pack in once purchase has already happened
          // for the whole ten) — "Skip to results" is the equivalent agency instead, jumping
          // straight to the terminal batch summary without losing any pack's contents.
          <Pressable onPress={onSkipToResults}>
            <Text style={styles.openLaterLink}>Skip to results</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onOpenLater}>
            <Text style={styles.openLaterLink}>{copy.ready.openLater}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// Nudges the tear scene's key + rim lights off their declared base positions every frame,
// following the phone's live tilt (see useDeviceTilt) — the foil-catches-a-highlight-as-you-turn
// requirement (PRD §42), same idea as TiltLights but written by hand here since these two lights
// (unlike RevealEngine's config-driven array) also carry the key light's own shadow-camera ref.
export function TiltCardLights({
  keyLightRef,
  rimLightRef,
  tilt,
}: {
  keyLightRef: React.RefObject<DirectionalLight | null>;
  rimLightRef: React.RefObject<DirectionalLight | null>;
  tilt: React.MutableRefObject<DeviceTilt>;
}) {
  useFrame(() => {
    if (keyLightRef.current) {
      keyLightRef.current.position.set(0.16 + tilt.current.x * 0.3, 0.3 + tilt.current.y * 0.3, 0.28);
    }
    if (rimLightRef.current) {
      rimLightRef.current.position.set(-0.28 + tilt.current.x * 0.3, 0.1 + tilt.current.y * 0.3, -0.24);
    }
  });
  return null;
}

function IntroductionView({
  sku,
  gesture,
  batchContext,
  onTearComplete,
}: {
  sku: PackSku;
  gesture: CategoryRevealConfig["gesture"];
  batchContext?: BatchContext;
  onTearComplete: () => void;
}) {
  const keyLightRef = useRef<DirectionalLight>(null);
  const rimLightRef = useRef<DirectionalLight>(null);
  const tilt = useDeviceTilt();

  // r3f's shadow pipeline is off by default at the Canvas level, and a directional light's own
  // shadow camera defaults to a frustum sized for a whole outdoor scene — hopelessly wrong for
  // a 0.068-unit-wide pack, so every shadow it casts would clip to nothing. Both need this
  // explicit setup, matching the prototype's own PackScene.tsx exactly, or every castShadow/
  // receiveShadow flag already set inside buildPackObject.ts silently does nothing.
  useEffect(() => {
    const light = keyLightRef.current;
    if (!light) return;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0004;
    Object.assign(light.shadow.camera, { left: -0.12, right: 0.12, top: 0.12, bottom: -0.12 });
    light.shadow.camera.updateProjectionMatrix();
  }, []);

  return (
    <View style={styles.fill}>
      <Text style={styles.introHeading}>
        {batchContext
          ? copy.introduction.heading(sku.itemCount * batchContext.total)
          : copy.introduction.heading(sku.itemCount)}
      </Text>
      <Text style={styles.introBody}>
        {batchContext
          ? `Tear this one open and all ${batchContext.total} packs unseal with it — nothing left to tear one at a time.`
          : copy.introduction.body}
      </Text>
      <View style={styles.tearCanvas}>
        <GestureLayer gesture={gesture} onComplete={onTearComplete}>
          {(openProgress) => (
            <Renderer3DBoundary
              fallback={
                <PackTear2D
                  openProgress={openProgress}
                  topColor={cardPackPersonality.palette.violet}
                  bottomColor={cardPackPersonality.palette.violetDeep}
                  wordmark={cardPackPersonality.copy.wordmark}
                  badge={cardPackPersonality.copy.codeBadge}
                  sizeMultiplier={batchContext ? 1.3 : 1}
                />
              }
            >
              {/* Real-world-scale pack (~0.068 units wide, i.e. meters) needs a much closer
                  camera and its own lighting recipe than the old placeholder's 1.4-unit plane —
                  matched to the prototype's own PackScene.tsx setup (warm key + violet rim, no
                  flat ambient wash), not cardsConfig's generic ambient+directional pair.
                  A batch tear stands for the whole bundle (see the heading/body above), so the
                  pack itself reads bigger than a standalone one — the same mesh and tear physics,
                  just scaled up, with the camera pulled back the same proportion so framing holds. */}
              <Canvas shadows camera={{ position: [0, 0.01, batchContext ? 0.29 : 0.22], fov: 35 }}>
                <hemisphereLight args={["#2a1b47", "#090610", 0.7]} />
                <directionalLight
                  ref={keyLightRef}
                  color="#fff0d8"
                  intensity={3}
                  position={[0.16, 0.3, 0.28]}
                  castShadow
                />
                <directionalLight ref={rimLightRef} color="#8f5cff" intensity={1.6} position={[-0.28, 0.1, -0.24]} />
                <TiltCardLights keyLightRef={keyLightRef} rimLightRef={rimLightRef} tilt={tilt} />
                <group scale={batchContext ? 1.3 : 1}>
                  <PackTearMesh openProgress={openProgress} />
                </group>
              </Canvas>
            </Renderer3DBoundary>
          )}
        </GestureLayer>
      </View>
      <View style={styles.introFooter}>
        <Text style={styles.hint}>{copy.introduction.hint}</Text>
        <View style={styles.dragHandle} />
      </View>
    </View>
  );
}

export function SummaryView({
  sku,
  items,
  priorCountById,
  batchContext,
  onNextPack,
  onRipAgain,
  onGoHome,
  onViewCollection,
  isRipAgainWorking,
}: {
  sku: PackSku;
  items: ItemDetail[];
  priorCountById: Map<string, number>;
  batchContext?: BatchContext;
  onNextPack?: () => void;
  onRipAgain: () => void;
  onGoHome: () => void;
  onViewCollection: () => void;
  isRipAgainWorking: boolean;
}) {
  const totalValueCents = items.reduce((sum, i) => sum + i.baseValueCents, 0);
  const profitCents = totalValueCents - sku.priceCents;
  const newCount = items.filter((item) => (priorCountById.get(item.id) ?? 0) === 0).length;
  const duplicateCount = items.length - newCount;
  const tierLabelText = tierLabel(sku);
  const isLastOfBatch = batchContext != null && batchContext.index === batchContext.total - 1;

  return (
    <View style={styles.fill}>
      <View style={styles.summaryHeader}>
        <Text style={styles.eyebrow}>
          {batchContext ? `PACK ${batchContext.index + 1} OF ${batchContext.total}` : copy.summary.title}
        </Text>
      </View>
      <View style={styles.summaryScroll}>
        <Text style={[styles.profit, { color: profitCents >= 0 ? "#8BF285" : "#F0554A" }]}>
          {profitCents >= 0 ? "+" : "-"}${(Math.abs(profitCents) / 100).toFixed(0)}
        </Text>
        <Text style={styles.summarySub}>
          {copy.summary.pulledOn(totalValueCents, sku.priceCents, items.length)}
        </Text>

        <View style={styles.resultsGrid}>
          {items.map((item, i) => {
            const tier = sku.rarityTiers.find((t) => t.level === item.rarityTierLevel);
            return (
              <View key={`${item.id}-${i}`} style={styles.resultTile}>
                {item.textureUrl ? (
                  <Image
                    source={item.textureUrl}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                ) : null}
                <LinearGradient
                  colors={
                    item.textureUrl
                      ? ["transparent", "rgba(0,0,0,0.55)"]
                      : [`${tier?.colorHex ?? "#888"}CC`, "rgba(0,0,0,0.5)"]
                  }
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.resultValue}>${(item.baseValueCents / 100).toFixed(0)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.statRow}>
          <StatBox label={copy.summary.newLabel} value={String(newCount)} />
          <StatBox label={copy.summary.duplicateLabel} value={String(duplicateCount)} />
          <StatBox label={copy.summary.collectionValueLabel} value={`$${(totalValueCents / 100).toFixed(0)}`} />
        </View>

        {/* Always true — the purchase already inserted these as owned_items server-side in the
            same atomic transaction, there's no separate "add" step for the user to trigger. */}
        <Text style={styles.addedNote}>{copy.summary.addedToCollection}</Text>
      </View>

      {batchContext ? (
        // Bulk pacing (see CardFlowEngine's header): one tap hands off to the next pack, or — on
        // the batch's last pack — straight to the terminal batch summary. No secondary actions
        // here on purpose; "bail out early" agency lives in the batch HUD's "Skip to Results"
        // control (see RevealScreen), not duplicated on every single pack's own recap.
        <View style={styles.footer}>
          <Pressable onPress={onNextPack} disabled={isRipAgainWorking}>
            <LinearGradient colors={[accents.cards.top, accents.cards.bottom]} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>
                {isLastOfBatch ? "SEE FULL RESULTS" : `NEXT PACK (${batchContext.index + 2}/${batchContext.total})`}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <View style={styles.footer}>
          <Pressable onPress={onRipAgain} disabled={isRipAgainWorking}>
            <LinearGradient colors={[accents.cards.top, accents.cards.bottom]} style={styles.primaryButton}>
              {isRipAgainWorking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonLabel}>{copy.summary.ripAgain(tierLabelText)}</Text>
              )}
            </LinearGradient>
          </Pressable>
          <View style={styles.secondaryRow}>
            <Pressable onPress={onViewCollection} disabled={isRipAgainWorking} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>{copy.summary.viewCollection}</Text>
            </Pressable>
            <Pressable onPress={onGoHome} disabled={isRipAgainWorking} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>{copy.summary.backToHome}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b0b10", paddingTop: 56, paddingHorizontal: 20 },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.62)" },

  processingCenter: { alignItems: "center", gap: spacing.md, marginTop: 60 },
  processingHeading: { fontFamily: fonts.black, fontSize: 22, color: ink.text, marginTop: spacing.md },
  processingBody: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 19,
  },
  processingSteps: { marginTop: spacing.xxl, gap: spacing.md },
  processingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  processingRowPending: { opacity: 0.35 },
  processingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.2)" },
  processingDotDone: { backgroundColor: "#8BF285" },
  processingRowText: { fontFamily: fonts.semibold, fontSize: 13.5, color: ink.text },

  readyCenter: { alignItems: "center", gap: spacing.lg, marginTop: 24 },
  readyHeading: { fontFamily: fonts.black, fontSize: 26, color: ink.text, textAlign: "center" },
  bigPackStack: { marginTop: 7 },
  bigPackGhost: { position: "absolute", top: 0, left: 0 },
  bigPackBadge: {
    position: "absolute",
    top: -16,
    right: -20,
    backgroundColor: accents.cards.top,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    ...shadow.glow(accents.cards.glow),
  },
  bigPackBadgeText: { fontFamily: fonts.black, fontSize: 15, letterSpacing: 0.5, color: "#160a24" },

  footer: { position: "absolute", bottom: 40, left: 20, right: 20, gap: spacing.md, alignItems: "center" },
  primaryButton: {
    height: 62,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.26)",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 260,
    paddingHorizontal: 24,
  },
  primaryButtonLabel: { fontFamily: fonts.black, fontSize: 16, letterSpacing: 1.1, color: "#fff" },
  openLaterLink: { fontFamily: fonts.semibold, fontSize: 13, color: "rgba(255,255,255,0.5)" },

  introHeading: { fontFamily: fonts.black, fontSize: 30, color: ink.text, marginTop: 40, textAlign: "center" },
  introBody: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  tearCanvas: { flex: 1, marginVertical: 20 },
  introFooter: { alignItems: "center", gap: spacing.md, paddingBottom: 24 },
  hint: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 1, color: "rgba(255,255,255,0.5)" },
  dragHandle: { width: 44, height: 4, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },

  cardHud: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dotRow: { flexDirection: "row", gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.16)" },
  dotDone: { backgroundColor: "rgba(255,255,255,0.5)" },
  dotCurrent: { width: 20, backgroundColor: accents.cards.top },
  cardCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardFooter: { paddingBottom: 32, gap: spacing.md, alignItems: "center" },
  statusRow: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  statusRight: { alignItems: "flex-end" },
  statusLabel: { fontFamily: fonts.medium, fontSize: 11, color: "rgba(255,255,255,0.5)" },
  statusValue: { fontFamily: fonts.bold, fontSize: 15, color: ink.text, marginTop: 3 },
  holdLabel: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 1.4, color: accents.cards.top },
  newBinderNote: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    width: "100%",
  },
  newBinderText: { fontFamily: fonts.semibold, fontSize: 13.5, color: ink.text, textAlign: "center" },

  summaryHeader: { alignItems: "center" },
  summaryScroll: { flex: 1, alignItems: "center", marginTop: 20, gap: spacing.lg, width: "100%" },
  profit: { fontFamily: fonts.black, fontSize: 44 },
  summarySub: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.6)" },
  resultsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", width: "100%" },
  resultTile: {
    width: 56,
    height: 78,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: 6,
  },
  resultValue: { fontFamily: fonts.bold, fontSize: 11, color: "#fff" },
  statRow: { flexDirection: "row", gap: 10, width: "100%" },
  addedNote: { fontFamily: fonts.semibold, fontSize: 12.5, color: "#8BF285" },
  secondaryRow: { flexDirection: "row", gap: spacing.sm, width: "100%", minWidth: 260 },
  secondaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonLabel: { fontFamily: fonts.bold, fontSize: 12.5, letterSpacing: 0.5, color: "rgba(255,255,255,0.85)" },
});
