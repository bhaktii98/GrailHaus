import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Canvas } from "@react-three/fiber/native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { PackSku } from "@grailhaus/shared";
import { GestureLayer } from "../../core/GestureLayer";
import { Renderer3DBoundary } from "../../core/Renderer3DBoundary";
import type { CategoryRevealConfig } from "../../core/types";
import { PackTear2D } from "../reveal/PackTear2D";
import { fonts, ink, spacing } from "../../../theme/tokens";
import { bulkRun as copy } from "../../../content/copy";
import { tierRevealIdentity } from "./tierPersonality";
import { tearPersonalityFor } from "./tearPackPersonality";
import { TenPackMesh } from "./tenPack/TenPackMesh";
import { playSfx } from "../../../lib/sfx";

/** 2D-fallback-only safety net — see handleZipComplete's own comment for why this exists
 * alongside the 3D scene's own spill-driven advance. */
const FALLBACK_ADVANCE_MS = 2600;
/** Once the pile has visibly settled, hold on it before moving on — long enough to actually look
 * at all ten, not just register that something happened before it cuts away. */
const SPILL_HOLD_MS = 1800;

/**
 * The opening beat of a bulk run — one continuous 3D scene, not a tear screen followed by a
 * separate results screen. A sealed zip pouch holding all `packCount` packs; drag the slider
 * across the seam and the pouch unzips for real (the same 1:1, reversible, velocity-aware
 * GestureLayer every tear in this app uses), then — with no further input — every pack inside
 * rises into view already torn open, all at once. Nothing here routes to a per-pack rip screen:
 * the whole point is that unzipping the bundle is what tears all ten, together.
 *
 * Ported from the Claude Design handoff's tenpack-art.js (see tenPack/buildTenPack.ts's own
 * header for exactly what carried over and what was deliberately cut). Every color in the scene
 * comes from this tier's own palette (tearPackPersonality.ts), not a fixed gold — so a Vault
 * Break or Black Label run's pouch reads as that tier, not always the base "GrailHaus" gold.
 *
 * Once the pouch stops being sealed, every bit of chrome (heading, hint, skip link) disappears —
 * this screen's job past that point is just the ten torn packs themselves.
 */
export function RunIntroStage({
  sku,
  packCount,
  gesture,
  onBegin,
  onSkip,
}: {
  sku: PackSku;
  packCount: number;
  gesture: CategoryRevealConfig["gesture"];
  onBegin: () => void;
  onSkip: () => void;
}) {
  const [spilling, setSpilling] = useState(false);
  const enter = useSharedValue(0);
  const advanced = useRef(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) });
  }, [enter]);

  useEffect(
    () => () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
    },
    []
  );

  const titleStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [18, 0]) }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({ opacity: interpolate(enter.value, [0.4, 1], [0, 1]) }));

  // Same tier identity the hunt uses — the intro is the first thing a run shows, so it has to set
  // the tier's tone rather than opening generic and switching character one screen later.
  const identity = tierRevealIdentity(sku.tier);
  const tearPersonality = tearPersonalityFor(sku.tier);

  function advanceOnce() {
    if (advanced.current) return;
    advanced.current = true;
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    onBegin();
  }

  // Fires once the drag gesture itself completes — i.e. the seam has been pulled all the way
  // across, same "past halfway it carries itself" completion every GestureLayer tear already has.
  function handleZipComplete() {
    // Same physical-tear cue every other card tier's own rip plays — the bundle is still a real
    // tear, just one seam standing in for all ten at once.
    playSfx("packTear");
    setSpilling(true);
    // Safety net for the Renderer3DBoundary fallback only: TenPackMesh (which normally drives
    // the real spill-then-advance sequence via onSpillComplete below) never mounts on that path,
    // so nothing else would ever call onBegin. advanceOnce()'s guard means this is a no-op
    // whenever the 3D scene got there first.
    fallbackTimer.current = setTimeout(advanceOnce, FALLBACK_ADVANCE_MS);
  }

  function handleSpillComplete() {
    // The payoff cue — all ten have finished rising and settling, torn open together.
    playSfx("success");
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    holdTimer.current = setTimeout(advanceOnce, SPILL_HOLD_MS);
  }

  return (
    <View style={[styles.fill, { backgroundColor: identity.backgroundHex }]}>
      <LinearGradient colors={identity.backdropGradient} style={StyleSheet.absoluteFill} pointerEvents="none" />

      {!spilling && (
        <>
          <Animated.View style={[styles.copyBlock, titleStyle]}>
            <Text style={[styles.eyebrow, { color: identity.accentHex }]}>{copy.intro.eyebrow(packCount)}</Text>
            <Text style={styles.title}>{copy.intro.title}</Text>
            <Text style={styles.kicker}>{identity.kicker.toUpperCase()}</Text>
          </Animated.View>
          <Animated.Text style={[styles.body, bodyStyle]}>{copy.intro.body}</Animated.Text>
        </>
      )}

      <View style={styles.stageArea}>
        <GestureLayer gesture={gesture} onComplete={handleZipComplete}>
          {(openProgress) => (
            <Renderer3DBoundary
              fallback={
                <PackTear2D
                  openProgress={openProgress}
                  topColor={tearPersonality.palette.violet}
                  bottomColor={tearPersonality.palette.violetDeep}
                  wordmark={tearPersonality.copy.wordmark}
                  badge={tearPersonality.copy.codeBadge}
                  sizeMultiplier={1.3}
                />
              }
            >
              <Canvas
                // No `shadows` — shadow mapping is exactly the kind of GPU feature that trips
                // the known-bad-GPU warning path in rendererCapability.ts on this app's tested
                // Android target (EXT_color_buffer_float), which permanently forces every 3D
                // reveal in the app to its 2D fallback for the rest of the session the instant it
                // fires — not just this screen. The pouch/packs read fine off color + point
                // lights alone; it isn't worth that risk for a cast-shadow nicety.
                //
                // Same starting fov the reference's own stage component defaults to (45°) — the
                // position below is a placeholder for the first frame only; TenPackMesh
                // repositions the camera itself once mounted (see its own header for why a
                // hand-picked position/fov can't work here regardless of the numbers).
                camera={{ position: [0.2, 3.1, 6.1], fov: 45 }}
                onCreated={(state) => {
                  state.gl.localClippingEnabled = true;
                }}
              >
                <hemisphereLight args={["#2a1b47", "#090610", 0.7]} />
                <ambientLight intensity={0.25} />
                <TenPackMesh
                  openProgress={openProgress}
                  personality={tearPersonality}
                  onSpillComplete={handleSpillComplete}
                />
              </Canvas>
            </Renderer3DBoundary>
          )}
        </GestureLayer>
      </View>

      {!spilling && (
        <View style={styles.footer}>
          <Text style={styles.hint}>{copy.intro.dragHint}</Text>
          <View style={styles.dragHandle} />
          <Pressable onPress={onSkip}>
            <Text style={styles.skipLink}>{copy.intro.skip}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b0b10", paddingTop: 56, paddingHorizontal: 20 },
  copyBlock: { alignItems: "center", gap: 8 },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 2.6 },
  kicker: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.38)" },
  title: { fontFamily: fonts.black, fontSize: 32, letterSpacing: 1.4, color: ink.text, textAlign: "center" },
  body: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    color: "rgba(255,255,255,0.58)",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 290,
    alignSelf: "center",
    marginTop: 10,
  },
  stageArea: { flex: 1, marginTop: spacing.md },
  footer: { paddingBottom: 40, gap: spacing.sm, alignItems: "center" },
  hint: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 2, color: "rgba(255,255,255,0.5)" },
  dragHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" },
  skipLink: { fontFamily: fonts.semibold, fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 8 },
});
