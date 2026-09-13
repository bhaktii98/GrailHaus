// The Vault Break tier's 3D moment, now scoped to just the tear — the staged multi-card fan
// reveal and tap-to-inspect system (VaultBreakStage.tsx, now removed) ran continuously as one
// 3D scene together with the tear, and on-device that was unplayable (measured well under
// 10fps, with visible overlapping-UI corruption once the "inspect one card" hero view kicked
// in). Splitting the tear from the card reveal into two separate screens — this one purely 3D,
// the next one flat 2D (VaultBreakFlowEngine.tsx reuses CardFlowEngine's own CardView/
// FinalCardView, the same proven-smooth per-card swipe/hold-reveal every other tier already
// uses) — is what actually fixes it, not another round of trimming the combined scene.
//
// Passing an empty deck into VaultScene means buildVaultPackObject/buildReveal build zero card
// meshes, zero card textures, and run zero per-card spring physics — the single biggest cost
// this reveal ever had. All that's left running is the pack shell tear itself, which is the
// same kind of tear-only 3D moment Tier 1's CardFlowEngine already runs smoothly for every
// other pack tier.
//
// The overlay chrome below (kicker/title/meta/hint) is plain RN + Reanimated, a completely
// separate rendering path from the WebGL Canvas above it — none of it touches the 3D scene's
// performance budget, which is why it's the right place to spend on making Vault Break read as
// the pricier tier: a staggered entrance (kicker → title → meta, not everything appearing at
// once like Tier 1's static overlay), a slow breathing glow on "Break", and the meta line as
// real bordered chips instead of plain mono text separated by slashes.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Canvas } from "@react-three/fiber/native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import type { SkImage } from "@shopify/react-native-skia";
import { vaultBreakPersonality } from "./config/vaultBreak.config";
import { VaultScene, type VaultStateSnapshot } from "./scene/VaultScene";
import { loadLogoImage } from "../reveal/engine/textures";
import { VaultVignette } from "./ui/VaultVignette";
import type { VaultCardData } from "./config/types";
import { GestureLayer } from "../../core/GestureLayer";
import { Renderer3DBoundary } from "../../core/Renderer3DBoundary";
import { PackTear2D } from "../reveal/PackTear2D";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LOGO_ASSET = require("../../../../assets/logo.png");

const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const EMPTY_DECK: VaultCardData[] = [];

// Torn strip needs a couple of bounce cycles to settle before cutting away — same 2500ms
// convention CardFlowEngine's own Tier 1 tear uses, for the same reason (see that file's
// handleTearComplete comment): cutting away right when the tear is merely *recognized* catches
// the ballistic-fall physics still visibly mid-bounce.
const SETTLE_DELAY_MS = 2500;

// Vault Break's real 3D tear runs its own bespoke pointer state machine (useVaultInteraction —
// tear + orbit/pinch/flip inspection) tightly coupled to the 3D scene's refs, not the shared
// GestureLayer every other tier's tear uses. Extracting that into something a flat 2D fallback
// could drive isn't a small job, and the fallback's job is to still feel good, not to replicate
// every mechanic — so on a device where the 3D scene degrades, this tier's tear gesture becomes
// the same generic GestureLayer physics Street Rip and Black Label already use (1:1 tracking,
// reversible, velocity-aware, interruptible), just with Vault Break's own branding on the foil. A
// documented scope cut, not an oversight.
const VAULT_2D_GESTURE = { mode: "tear" as const, velocityThreshold: 900, travelDistance: 200 };

export function VaultTearStage({ onTearComplete }: { onTearComplete: () => void }) {
  const { width, height } = useWindowDimensions();
  const [logo, setLogo] = useState<SkImage | null>(null);
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<VaultStateSnapshot>({
    phase: "idle", hero: -1, ready: false, running: false, dim: 0, shown: 0, heroLabel: null,
  });
  const personality = vaultBreakPersonality;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  // Staggered entrance — kicker, then title, then the meta chips — rather than the whole frame
  // appearing at once. Runs once, on mount.
  const kickerIn = useSharedValue(0);
  const titleIn = useSharedValue(0);
  const metaIn = useSharedValue(0);
  // A slow, continuous breathing glow on the "Break" emphasis word — a small living/premium
  // touch, cheap (pure opacity+scale on one Text node).
  const shimmer = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    loadLogoImage(LOGO_ASSET).then((img) => {
      if (!mounted) return;
      setLogo(img);
      setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  useEffect(() => {
    if (snapshot.shown > 0.96 && !firedRef.current) {
      firedRef.current = true;
      settleTimer.current = setTimeout(onTearComplete, SETTLE_DELAY_MS);
    }
  }, [snapshot.shown, onTearComplete]);

  // Same settle-then-advance shape as the 3D path above, just triggered by GestureLayer's
  // onComplete instead of the 3D scene's own snapshot — shares firedRef/settleTimer so only one
  // of the two paths can ever actually fire (only one is ever mounted at a time).
  function handleFallbackTearComplete() {
    if (firedRef.current) return;
    firedRef.current = true;
    settleTimer.current = setTimeout(onTearComplete, SETTLE_DELAY_MS);
  }

  useEffect(() => {
    if (!ready) return;
    const ease = Easing.out(Easing.cubic);
    kickerIn.value = withTiming(1, { duration: 480, easing: ease });
    titleIn.value = withDelay(160, withTiming(1, { duration: 560, easing: ease }));
    metaIn.value = withDelay(380, withTiming(1, { duration: 480, easing: ease }));
    shimmer.value = withDelay(900, withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const kickerStyle = useAnimatedStyle(() => ({
    opacity: kickerIn.value,
    transform: [{ translateY: (1 - kickerIn.value) * 8 }],
  }));
  const kickerRuleStyle = useAnimatedStyle(() => ({ width: 26 * kickerIn.value }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleIn.value,
    transform: [{ translateY: (1 - titleIn.value) * 10 }],
  }));
  const emphasisStyle = useAnimatedStyle(() => ({
    opacity: 0.86 + shimmer.value * 0.14,
    transform: [{ scale: 1 + shimmer.value * 0.015 }],
  }));
  const metaStyle = useAnimatedStyle(() => ({
    opacity: metaIn.value,
    transform: [{ translateY: (1 - metaIn.value) * 8 }],
  }));

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={personality.palette.champagne} />
      </View>
    );
  }

  const hint = personality.copy.hintDrag;
  const hintOpacity = Math.max(0, 1 - snapshot.shown * 1.6);

  return (
    <View style={styles.root}>
      <VaultVignette width={width} height={height} />

      {/* Camera starts pulled back to 0.34 (vs. the pack's resting 0.214) — `introDolly` on
          VaultScene skips its usual instant snap-to-position on mount, so this eases smoothly
          in over about a second instead of appearing already framed. A small cinematic touch
          Tier 1's tear doesn't have, and free performance-wise — it's just where the camera
          starts, not an extra render pass. */}
      <Renderer3DBoundary
        fallback={
          <GestureLayer gesture={VAULT_2D_GESTURE} onComplete={handleFallbackTearComplete}>
            {(openProgress) => (
              <PackTear2D
                openProgress={openProgress}
                topColor={personality.palette.violet}
                bottomColor={personality.palette.plum}
                wordmark="GRAILHAUS"
                badge={personality.copy.kicker}
              />
            )}
          </GestureLayer>
        }
      >
        <Canvas
          style={styles.canvas}
          camera={{ position: [0, 0.006, 0.34], fov: 45, near: 0.01, far: 2 }}
          gl={{ antialias: false, alpha: true }}
        >
          <VaultScene personality={personality} deck={EMPTY_DECK} logo={logo} orbit={false} onSnapshot={setSnapshot} introDolly />
        </Canvas>
      </Renderer3DBoundary>

      <View pointerEvents="none" style={styles.frame}>
        <View>
          <Animated.View style={[styles.kickerRow, kickerStyle]}>
            <Animated.View style={[styles.kickerRule, kickerRuleStyle]} />
            <Text style={styles.kicker}>{personality.copy.kicker}</Text>
          </Animated.View>
          <Animated.Text style={[styles.title, titleStyle]}>
            {personality.copy.title}
            <Animated.Text style={[styles.titleEmphasis, emphasisStyle]}>{personality.copy.titleEmphasis}</Animated.Text>
          </Animated.Text>
          <Animated.View style={[styles.metaRow, metaStyle]}>
            {personality.copy.meta.map((m) => (
              <View key={m} style={styles.metaChip}>
                <Text style={styles.meta}>{m}</Text>
              </View>
            ))}
          </Animated.View>
        </View>
        <View />
        <Text style={[styles.hint, { opacity: hintOpacity }]}>{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05030a" },
  loading: { flex: 1, backgroundColor: "#05030a", alignItems: "center", justifyContent: "center" },
  canvas: { flex: 1, backgroundColor: "transparent" },
  frame: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    padding: 24, paddingBottom: 32,
    justifyContent: "space-between",
    alignItems: "center",
  },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "flex-start" },
  kickerRule: { height: 1, backgroundColor: "rgba(232,207,162,0.5)" },
  kicker: {
    fontFamily: mono, fontSize: 10, letterSpacing: 3.4, color: "#b99b57", textTransform: "uppercase",
  },
  title: { marginTop: 10, fontSize: 30, fontWeight: "500", color: "#f4ece0", alignSelf: "flex-start" },
  titleEmphasis: { fontStyle: "italic", color: "#e8cf9a" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14, alignSelf: "flex-start" },
  metaChip: {
    borderWidth: 1,
    borderColor: "rgba(232,207,162,0.32)",
    backgroundColor: "rgba(232,207,162,0.07)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  meta: { fontFamily: mono, fontSize: 9.5, letterSpacing: 1.2, color: "#d9c9a0" },
  hint: {
    fontFamily: mono, fontSize: 10, letterSpacing: 2.6, textTransform: "uppercase",
    color: "rgba(244,236,224,0.5)", textAlign: "center",
  },
});
