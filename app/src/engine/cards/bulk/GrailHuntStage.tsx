import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { PackSku, PulledOwnedItem } from "@grailhaus/shared";
import { grailIntensity } from "@grailhaus/shared";
import { PackFace } from "../../../components/PackFace";
import { playHapticTrack } from "../../core/HapticsTrack";
import type { HapticStep } from "../../core/types";
import { fonts, ink, spacing } from "../../../theme/tokens";
import { bulkRun as copy } from "../../../content/copy";
import { tierRevealIdentity, type TierRevealIdentity } from "./tierPersonality";
import { GrailAmbience } from "./GrailAmbience";
import { GrailJourneyTracker } from "./GrailJourneyTracker";

/**
 * Stage one of a bulk run, and the reason the feature exists: the grails from all ten packs,
 * pulled out of their packs and revealed one at a time, weakest to strongest.
 *
 * The escalation is real, not decorative. `grailIntensity` (shared) gives each reveal a 0..1
 * weight — anticipation length, glow reach, sheen speed and haptic density all scale off it — so
 * the first grail is a genuine moment and the last is the climax of the run. A single-grail run
 * still gets full intensity: it doesn't build, but it isn't diminished either.
 *
 * Deliberately restrained: one card, one slow rise, one sheen pass, a held beat before the value
 * lands. No coin showers, no slot-machine spin, no flashing. The brief for GrailHaus is luxury
 * collecting, and a premium reveal earns its drama through timing and restraint rather than noise.
 *
 * **Tier consistency.** Every visual and tactile channel here is driven by the pack's own tier
 * identity (see tierPersonality.ts), so a 10-pack of Black Label reads as Black Label rather than
 * as a generic bulk screen: its ember field and crimson room glow stand in for `art/fire.ts`'s
 * particle system, its card backs are the same graphite-over-ink as the sealed pack, its backdrop
 * carries the fire's heat, and its haptics land heavier and build longer because its foil is a
 * heavier gauge. Vault Break gets violet vault shafts over plum; Street Rip gets sparse gold foil
 * motes over violet. Nothing here is hardcoded per tier — it all comes from one lookup.
 *
 * Performance: exactly one card is mounted at a time — the grail being revealed. Nothing
 * pre-renders the next one, and no 3D scene is mounted here at all (the expensive `PackTearMesh`
 * path belongs to a single-pack rip, where there's one pack to tear, not ten). The tier ambience
 * is a translation of each tier's 3D atmosphere into a handful of Reanimated views on the UI
 * thread rather than a port of it — see GrailAmbience's own header for why that tradeoff is the
 * right one when up to ten grails reveal back to back.
 */

/** How long the card holds face-down, building anticipation, before it turns. Scales with
 * intensity so later grails make you wait longer. */
const ANTICIPATION_MIN_MS = 620;
const ANTICIPATION_MAX_MS = 1850;
/** The turn itself — constant, because a slow flip reads as sluggish rather than dramatic. */
const TURN_MS = 520;
/** Beat between the card landing and its value appearing. The pause is the point. */
const VALUE_DELAY_MS = 340;

/**
 * Haptic track for one grail reveal, on two independent axes.
 *
 * **Tier** sets the character — Black Label's heavier-gauge foil (`tear.stretch` 0.07, `springK`
 * 44 in its own config) resists longer and gives harder, so it builds with more pre-beats and
 * lands on a heavy impact; the base pack gets one clean beat. This is what makes the bulk run
 * *feel* like the tier it belongs to, matching its single-pack tear.
 *
 * **Intensity** sets the escalation within a run — later grails add beats on top of whatever the
 * tier already does, so the climax is the densest moment regardless of which tier it is.
 */
function grailHaptics(
  identity: TierRevealIdentity,
  intensity: number,
  anticipationMs: number,
  isFinal: boolean
): HapticStep[] {
  const steps: HapticStep[] = [{ atMs: 0, kind: "light" }];

  // The tier's own build — spread evenly through the anticipation.
  const build = identity.haptics.buildSteps;
  for (let i = 1; i <= build; i++) {
    steps.push({ atMs: anticipationMs * (i / (build + 1)), kind: i === build ? "medium" : "light" });
  }
  // Escalation on top: the last third of a run earns an extra tick the early grails don't get.
  if (intensity > 0.75) steps.push({ atMs: anticipationMs * 0.85, kind: "light" });

  steps.push({ atMs: anticipationMs, kind: identity.haptics.land });
  steps.push({ atMs: anticipationMs + TURN_MS, kind: "success" });
  // The release-burst: Black Label and Vault Break punctuate their climax twice, the base pack
  // doesn't — the same way only those tiers fire a burst on their 3D reveal.
  if (isFinal && identity.haptics.climaxDouble) {
    steps.push({ atMs: anticipationMs + TURN_MS + 130, kind: "heavy" });
  }
  return steps;
}

export function GrailHuntStage({
  sku,
  grails,
  startIndex,
  onGrailRevealed,
  onStageComplete,
  onSkip,
}: {
  sku: PackSku;
  /** Already in escalation order (weakest first) — see shared's compareGrailsForReveal. */
  grails: PulledOwnedItem[];
  /** Which grail to start on. Non-zero when resuming a run that was killed mid-hunt. */
  startIndex: number;
  onGrailRevealed: (ownedItemId: string) => void;
  onStageComplete: () => void;
  onSkip: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const current = grails[index] ?? null;
  // One lookup drives every tier-specific channel on this screen — gradients, ambience, haptics,
  // background. See tierPersonality.ts.
  const identity = useMemo(() => tierRevealIdentity(sku.tier), [sku.tier]);

  // A run with no grails is an honest outcome, not an error state — it gets its own beat rather
  // than silently skipping the stage the whole feature is named after.
  if (grails.length === 0) {
    return <NoGrailView identity={identity} onContinue={onStageComplete} />;
  }

  if (!current) {
    // Resumed past the end (every grail already witnessed) — nothing left to reveal.
    return <HuntCompleteView count={grails.length} identity={identity} onContinue={onStageComplete} />;
  }

  const isFinal = index === grails.length - 1;
  const intensity = grailIntensity(index, grails.length);

  function handleRevealed(item: PulledOwnedItem) {
    onGrailRevealed(item.ownedItemId);
  }

  function handleContinue() {
    if (isFinal) {
      onStageComplete();
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <GrailReveal
      // Keyed so every grail mounts fresh — shared values from the previous reveal must never
      // leak into the next one (the same class of bug CardFlowEngine's own per-card key avoids).
      key={current.ownedItemId}
      sku={sku}
      identity={identity}
      item={current}
      intensity={intensity}
      isFinal={isFinal}
      revealIndex={index}
      totalRevealed={grails.length}
      onRevealed={handleRevealed}
      onContinue={handleContinue}
      onSkip={onSkip}
    />
  );
}

function GrailReveal({
  sku,
  identity,
  item,
  intensity,
  isFinal,
  revealIndex,
  totalRevealed,
  onRevealed,
  onContinue,
  onSkip,
}: {
  sku: PackSku;
  identity: TierRevealIdentity;
  item: PulledOwnedItem;
  intensity: number;
  isFinal: boolean;
  revealIndex: number;
  totalRevealed: number;
  onRevealed: (item: PulledOwnedItem) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<"waiting" | "revealing" | "revealed">("waiting");
  const tier = useMemo(
    () => sku.rarityTiers.find((t) => t.level === item.rarityTierLevel) ?? null,
    [sku.rarityTiers, item.rarityTierLevel]
  );
  // The rarity tier's own configured colour still wins for the card's chrome (it's admin-editable
  // and is what the rest of the app shows this rarity as); the tier *identity* supplies everything
  // around it — the room, the card back, the atmosphere.
  const accent = tier?.colorHex ?? identity.accentHex;

  const anticipationMs = Math.round(
    ANTICIPATION_MIN_MS + (ANTICIPATION_MAX_MS - ANTICIPATION_MIN_MS) * intensity
  );

  // rise: 0 → 1 as the card lifts into frame. flip: 0 → 1 as it turns face-up.
  // glow: ambient pulse behind the card, scaled by intensity. sheen: the specular pass.
  const rise = useSharedValue(0);
  const flip = useSharedValue(0);
  const glow = useSharedValue(0);
  const sheen = useSharedValue(0);
  const valueIn = useSharedValue(0);
  // Spikes as the card lands and decays — the 2D stand-in for `fire.ts`'s `burst()`/`uSurge`,
  // which flares the whole particle field on the reveal beat. Handed to the ambience so the tier's
  // atmosphere reacts to the card turning rather than idling through it.
  const surge = useSharedValue(0);

  const cancelHaptics = useRef<(() => void) | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      cancelHaptics.current?.();
      timers.current.forEach(clearTimeout);
      cancelAnimation(rise);
      cancelAnimation(flip);
      cancelAnimation(glow);
      cancelAnimation(sheen);
      cancelAnimation(valueIn);
      cancelAnimation(surge);
    },
    [rise, flip, glow, sheen, valueIn, surge]
  );

  const startReveal = useCallback(() => {
    if (phase !== "waiting") return;
    setPhase("revealing");
    cancelHaptics.current = playHapticTrack(grailHaptics(identity, intensity, anticipationMs, isFinal));

    // The atmosphere flares as the card turns, then settles — fire.ts's own surge decay shape.
    surge.value = withDelay(
      anticipationMs,
      withSequence(
        withTiming(1, { duration: TURN_MS * 0.6, easing: Easing.out(Easing.quad) }),
        withTiming(0.25, { duration: 1200, easing: Easing.out(Easing.cubic) })
      )
    );

    // The rise: slow, weighted, easing out — a card being lifted, not launched.
    rise.value = withTiming(1, { duration: anticipationMs, easing: Easing.out(Easing.cubic) });
    // Glow swells through the anticipation and holds. Higher intensity reaches further.
    glow.value = withTiming(intensity, { duration: anticipationMs, easing: Easing.inOut(Easing.quad) });
    // The turn happens after the anticipation has fully played out.
    flip.value = withDelay(anticipationMs, withTiming(1, { duration: TURN_MS, easing: Easing.inOut(Easing.cubic) }));
    // One sheen pass across the face as it settles, then a slow idle repeat on the climax only.
    sheen.value = withDelay(
      anticipationMs + TURN_MS * 0.6,
      isFinal
        ? withRepeat(withSequence(withTiming(1, { duration: 1100 }), withTiming(0, { duration: 0 })), -1, false)
        : withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) })
    );
    valueIn.value = withDelay(
      anticipationMs + TURN_MS + VALUE_DELAY_MS,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })
    );

    timers.current.push(
      setTimeout(() => {
        setPhase("revealed");
        onRevealed(item);
      }, anticipationMs + TURN_MS + VALUE_DELAY_MS)
    );
  }, [phase, identity, intensity, anticipationMs, isFinal, item, onRevealed, rise, glow, flip, sheen, valueIn, surge]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(rise.value, [0, 1], [58, 0]) },
      { scale: interpolate(rise.value, [0, 1], [0.9, 1]) + interpolate(flip.value, [0, 0.5, 1], [0, 0.04, 0]) },
      { perspective: 900 },
      { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
    ],
    opacity: interpolate(rise.value, [0, 0.25, 1], [0, 1, 1]),
  }));

  // The face is only legible in the back half of the turn; before that the viewer is looking at
  // the card's back, so showing the artwork early would spoil the flip entirely.
  const faceStyle = useAnimatedStyle(() => ({ opacity: flip.value > 0.5 ? 1 : 0 }));
  const backStyle = useAnimatedStyle(() => ({ opacity: flip.value > 0.5 ? 0 : 1 }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.85,
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.7, 1.25]) }],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.35, 1], [0, 0.5, 0]),
    transform: [{ translateX: interpolate(sheen.value, [0, 1], [-160, 160]) }, { rotate: "18deg" }],
  }));

  const valueStyle = useAnimatedStyle(() => ({
    opacity: valueIn.value,
    transform: [{ translateY: interpolate(valueIn.value, [0, 1], [12, 0]) }],
  }));

  const cardWidth = isFinal ? 244 : 214;
  const cardHeight = isFinal ? 338 : 296;

  return (
    <View style={[styles.fill, { backgroundColor: identity.backgroundHex }]}>
      {/* The tier's room, behind everything — Black Label's heat-bled crimson, Vault Break's
          plum, the base pack's violet. */}
      <LinearGradient colors={identity.backdropGradient} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={styles.header}>
        <GrailJourneyTracker index={revealIndex} total={totalRevealed} identity={identity} isFinal={isFinal} />
      </View>

      <Pressable style={styles.stage} onPress={phase === "waiting" ? startReveal : undefined} disabled={phase !== "waiting"}>
        {/* The tier's atmosphere — ember field / vault shafts / foil motes. Sits behind the card
            and reacts to the turn via `surge`. */}
        <GrailAmbience identity={identity} intensity={intensity} surge={surge} />

        <Animated.View style={[styles.glow, { backgroundColor: accent }, glowStyle]} pointerEvents="none" />

        <Animated.View style={cardStyle}>
          <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
            {/* Face-down, the card is the sealed pack's own material — so a grail turning over in
                the bulk run comes out of the same pack the single-pack rip tears open. */}
            <PackFace
              art={identity.cardBackGradient}
              width={cardWidth}
              height={cardHeight}
              radius={18}
              crimp
              borderColor={`rgba(${identity.accentRGB},0.45)`}
            />
          </Animated.View>
          <Animated.View style={faceStyle}>
            <PackFace
              art={[accent, "rgba(0,0,0,0.6)"]}
              imageUrl={item.textureUrl}
              width={cardWidth}
              height={cardHeight}
              radius={18}
              tier={tier?.name.toUpperCase()}
              glowColor={isFinal ? accent : undefined}
            >
              {/* The light sweep across the face — `fire.ts`'s `apexSweep` in 2D, tinted with the
                  tier's hot core colour so Black Label's sweep reads as champagne-over-ember
                  rather than plain white. */}
              <Animated.View style={[styles.sheen, sheenStyle]} pointerEvents="none">
                <LinearGradient
                  colors={["transparent", `${identity.hotHex}8C`, "transparent"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </PackFace>
          </Animated.View>
        </Animated.View>

        {phase === "waiting" && <Text style={styles.tapHint}>{copy.grail.hint}</Text>}
      </Pressable>

      <View style={styles.footer}>
        <Animated.View style={[styles.valueBlock, valueStyle]}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.itemValue, { color: accent }]}>
            ${(item.currentValueCents / 100).toFixed(0)}
          </Text>
          {/* The authoritative coordinate, surfaced. The UI reordered these cards out of their
              packs for the hunt; saying which pack each really came from is what keeps the
              presentation honest about not having changed anything underneath. */}
          {item.packIndex != null && <Text style={styles.fromPack}>{copy.grail.fromPack(item.packIndex)}</Text>}
          {isFinal && <Text style={[styles.bestPull, { color: accent }]}>{copy.grail.bestPull}</Text>}
        </Animated.View>

        {phase === "revealed" ? (
          <Pressable onPress={onContinue} style={[styles.continueButton, { borderColor: `${accent}66` }]}>
            <Text style={styles.continueLabel}>
              {isFinal ? copy.grail.foundCount(totalRevealed) : copy.grail.continueHint}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={onSkip}>
            <Text style={styles.skipLink}>{copy.intro.skip}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** The zero-grail outcome. Honest, brief, and not styled as a failure — the run still produced
 * cards, and the copy moves the user toward them rather than dwelling. */
function NoGrailView({ identity, onContinue }: { identity: TierRevealIdentity; onContinue: () => void }) {
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [fade]);
  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: interpolate(fade.value, [0, 1], [16, 0]) }],
  }));

  return (
    <View style={[styles.fill, { backgroundColor: identity.backgroundHex }]}>
      <LinearGradient colors={identity.backdropGradient} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Animated.View style={[styles.centered, style]}>
        <Text style={styles.noGrailTitle}>{copy.noGrail.title}</Text>
        <Text style={styles.noGrailBody}>{copy.noGrail.body}</Text>
      </Animated.View>
      <View style={styles.footer}>
        <Pressable onPress={onContinue} style={[styles.continueButton, { borderColor: `rgba(${identity.accentRGB},0.4)` }]}>
          <Text style={styles.continueLabel}>{copy.noGrail.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Resumed past the last grail — every one was already witnessed before the app died. */
function HuntCompleteView({
  count,
  identity,
  onContinue,
}: {
  count: number;
  identity: TierRevealIdentity;
  onContinue: () => void;
}) {
  return (
    <View style={[styles.fill, { backgroundColor: identity.backgroundHex }]}>
      <LinearGradient colors={identity.backdropGradient} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.centered}>
        <Text style={[styles.noGrailTitle, { color: identity.accentHex }]}>{copy.grail.foundCount(count)}</Text>
      </View>
      <View style={styles.footer}>
        <Pressable onPress={onContinue} style={[styles.continueButton, { borderColor: `rgba(${identity.accentRGB},0.4)` }]}>
          <Text style={styles.continueLabel}>{copy.noGrail.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b0b10", paddingTop: 56, paddingHorizontal: 20 },
  header: { alignItems: "center" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 300, height: 300, borderRadius: 150, opacity: 0 },
  sheen: { position: "absolute", top: -40, bottom: -40, width: 90 },
  tapHint: {
    position: "absolute",
    bottom: 24,
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.5)",
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  noGrailTitle: { fontFamily: fonts.black, fontSize: 24, letterSpacing: 1.2, color: ink.text, textAlign: "center" },
  noGrailBody: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  footer: { paddingBottom: 40, gap: spacing.md, alignItems: "center" },
  valueBlock: { alignItems: "center", gap: 4, minHeight: 96 },
  itemName: { fontFamily: fonts.bold, fontSize: 15.5, color: ink.text, textAlign: "center", maxWidth: 260 },
  itemValue: { fontFamily: fonts.black, fontSize: 30 },
  fromPack: { fontFamily: fonts.medium, fontSize: 11.5, color: "rgba(255,255,255,0.42)" },
  bestPull: { fontFamily: fonts.extrabold, fontSize: 10.5, letterSpacing: 2, marginTop: 2 },
  continueButton: {
    height: 56,
    minWidth: 260,
    paddingHorizontal: 28,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  continueLabel: { fontFamily: fonts.bold, fontSize: 13.5, letterSpacing: 1.2, color: ink.text },
  skipLink: { fontFamily: fonts.semibold, fontSize: 13, color: "rgba(255,255,255,0.45)" },
});
