// Black Label's 3D moment — same split-screen structure as ../vaultReveal/VaultTearStage.tsx
// (that file's header explains why the tear is its own screen, separate from the card reveal:
// running both as one continuous 3D scene measured well under 10fps on-device). This file is
// that same component bound to Black Label's own personality/config/blackLabel.config.ts and
// art/blackLabelArt.ts (via buildBlackLabelPackObject) instead of Vault Break's — VaultScene
// itself is shared unchanged (see its own header for the `buildPack`/`lighting` parameterization
// that made this possible without forking it).
//
// The staggered kicker → title → meta entrance and the breathing glow on the title's emphasis
// word are unchanged from Vault Break's own tear stage — a good idea for "this tier is pricier
// and should feel it" doesn't need reinventing per tier, just re-coloring.
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
import { blackLabelPersonality } from "./config/blackLabel.config";
import { BlackLabelScene, type BlackLabelStateSnapshot } from "./scene/BlackLabelScene";
import { loadLogoImage } from "../reveal/engine/textures";
import { VaultVignette } from "../vaultReveal/ui/VaultVignette";
import type { VaultCardData } from "../vaultReveal/config/types";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LOGO_ASSET = require("../../../../assets/logo.png");

const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const EMPTY_DECK: VaultCardData[] = [];

// Torn strip needs a couple of bounce cycles to settle before cutting away — same 2500ms
// convention CardFlowEngine's own Tier 1 tear uses, for the same reason (see that file's
// handleTearComplete comment): cutting away right when the tear is merely *recognized* catches
// the ballistic-fall physics still visibly mid-bounce.
const SETTLE_DELAY_MS = 2500;

export function BlackLabelTearStage({ onTearComplete }: { onTearComplete: () => void }) {
  const { width, height } = useWindowDimensions();
  const [logo, setLogo] = useState<SkImage | null>(null);
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<BlackLabelStateSnapshot>({
    phase: "idle", hero: -1, ready: false, running: false, dim: 0, shown: 0,
    fireLevel: 0, surge: 0, heroLabel: null,
  });
  const personality = blackLabelPersonality;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  // Staggered entrance — kicker, then title, then the meta chips — rather than the whole frame
  // appearing at once. Runs once, on mount.
  const kickerIn = useSharedValue(0);
  const titleIn = useSharedValue(0);
  const metaIn = useSharedValue(0);
  // A slow, continuous breathing glow on the title — the design's own warm text-shadow
  // (`0 0 40px rgba(255,140,50,.28)`) held static, animated here instead so it reads as living
  // firelight rather than a printed effect. Small living/premium touch, cheap (pure
  // opacity+scale on one Text node).
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
    opacity: titleIn.value * (0.9 + shimmer.value * 0.1),
    transform: [{ translateY: (1 - titleIn.value) * 10 }, { scale: 1 + shimmer.value * 0.012 }],
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

  // The design's #vign reads --fire/--surge off the render loop to intensify the ambient glow
  // as the fire builds — approximated here with a plain opacity ramp on the same Skia vignette
  // rather than threading a second live value through Skia's declarative <Canvas>, since a
  // React-state-driven style (snapshot only updates on a real change, see BlackLabelScene's own
  // throttling) is cheap enough not to need Reanimated for this one number.
  const vignetteOpacity = Math.min(1, 0.82 + snapshot.fireLevel * 0.4 + snapshot.surge * 0.5);

  return (
    <View style={styles.root}>
      <View style={{ opacity: vignetteOpacity }}>
        <VaultVignette width={width} height={height} glowColor="rgba(255,106,24,0.22)" />
      </View>

      {/* Camera starts pulled back to 0.34 (vs. the pack's resting 0.218) — `introDolly` skips
          the usual instant snap-to-position on mount, so this eases smoothly in over about a
          second instead of appearing already framed. */}
      <Canvas
        style={styles.canvas}
        camera={{ position: [0, 0.006, 0.34], fov: 45, near: 0.01, far: 2 }}
        gl={{ antialias: false, alpha: true }}
      >
        <BlackLabelScene
          personality={personality}
          deck={EMPTY_DECK}
          logo={logo}
          orbit={false}
          onSnapshot={setSnapshot}
          introDolly
        />
      </Canvas>

      <View pointerEvents="none" style={styles.frame}>
        <View>
          <Animated.View style={[styles.kickerRow, kickerStyle]}>
            <Animated.View style={[styles.kickerRule, kickerRuleStyle]} />
            <Text style={styles.kicker}>{personality.copy.kicker}</Text>
          </Animated.View>
          <Animated.Text style={[styles.title, titleStyle]}>{personality.copy.title}</Animated.Text>
          <Animated.Text style={[styles.sub, titleStyle]}>Collectible cards</Animated.Text>
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
  kickerRule: { height: 1, backgroundColor: "rgba(201,162,74,0.5)" },
  kicker: {
    fontFamily: mono, fontSize: 10, letterSpacing: 3.4, color: "#8a6a2e", textTransform: "uppercase",
  },
  title: {
    marginTop: 9, fontSize: 32, fontWeight: "300", letterSpacing: 6, textTransform: "uppercase",
    color: "#f7e6bd", alignSelf: "flex-start",
    textShadowColor: "rgba(255,140,50,0.5)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18,
  },
  sub: {
    marginTop: 6, fontFamily: mono, fontSize: 9, letterSpacing: 4, textTransform: "uppercase",
    color: "rgba(242,236,226,0.44)", alignSelf: "flex-start",
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14, alignSelf: "flex-start" },
  metaChip: {
    borderWidth: 1,
    borderColor: "rgba(201,162,74,0.32)",
    backgroundColor: "rgba(201,162,74,0.07)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  meta: { fontFamily: mono, fontSize: 9.5, letterSpacing: 1.2, color: "#c9b98a" },
  hint: {
    fontFamily: mono, fontSize: 10, letterSpacing: 2.6, textTransform: "uppercase",
    color: "rgba(244,236,224,0.5)", textAlign: "center",
  },
});
