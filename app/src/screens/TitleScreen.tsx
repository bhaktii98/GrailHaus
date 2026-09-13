import { useEffect, useRef, type ReactNode } from "react";
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useSharedValue, withRepeat, withTiming, Easing, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Stop, Rect, Polygon } from "react-native-svg";
import { Screen } from "../components/Screen";
import { RayBurst } from "../components/RayBurst";
import { PackFace } from "../components/PackFace";
import { typography } from "../theme/tokens";
import { splash, brand } from "../content/copy";

const { width: W, height: H } = Dimensions.get("window");

/**
 * The launch screen (mockup turn 10) — distinct from onboarding's own splash (turn 9a's plain
 * loading beat): this one is the game-title-style screen the app opens on every cold start,
 * animated and interactive (menu affordance, tap anywhere to continue), not a timed
 * auto-advance. Ported from the standalone rn/ and root-level TitleScreen.js reference
 * implementations already built against this exact mockup, into app's own component set
 * (Screen/RayBurst/PackFace) and TypeScript.
 */
type Drift = { x: number; y: number; w: number; rot: number; op: number; dur: number; delay: number; art: string[] };
type Speck = { x: number; y: number; s: number; op: number; dur: number; delay: number };

// Ten cards at four depths — near ones large and bright, far ones small and dim — each with its
// own duration and a staggered start delay so none of them ever fall into phase.
const DRIFT: Drift[] = [
  { x: 0.06, y: 0.09, w: 62, rot: -13, op: 0.26, dur: 7500, delay: 0, art: ["#DCE8FF", "#6C8BF5", "#2B2F86"] },
  { x: 0.33, y: 0.04, w: 70, rot: 8, op: 0.32, dur: 9000, delay: 1200, art: ["#FFB3F0", "#C64BFF", "#6420C8", "#2E0B63"] },
  { x: 0.62, y: 0.11, w: 58, rot: 15, op: 0.22, dur: 8200, delay: 3000, art: ["#D6F5B4", "#6FB758", "#2C5A2A"] },
  { x: 0.84, y: 0.05, w: 66, rot: -9, op: 0.28, dur: 10000, delay: 2000, art: ["#FFF3D6", "#D8B26A", "#6B4E1E", "#1A1206"] },
  { x: 0.02, y: 0.3, w: 84, rot: -18, op: 0.5, dur: 8600, delay: 600, art: ["#C9DCE8", "#6C8AA3", "#33455C"] },
  { x: 0.78, y: 0.27, w: 92, rot: 14, op: 0.55, dur: 9400, delay: 4000, art: ["#FFF6D8", "#FFC94A", "#E0761A", "#7A2C06"] },
  { x: 0.04, y: 0.62, w: 74, rot: 11, op: 0.3, dur: 9800, delay: 2600, art: ["#F2CDA8", "#B87A4E", "#5E3722"] },
  { x: 0.7, y: 0.66, w: 96, rot: -12, op: 0.6, dur: 8000, delay: 5000, art: ["#DCE8FF", "#6C8BF5", "#2B2F86"] },
  { x: 0.3, y: 0.74, w: 66, rot: 17, op: 0.26, dur: 10400, delay: 1800, art: ["#E4FBFF", "#59D8FF", "#1668D8", "#062E68"] },
  { x: 0.52, y: 0.84, w: 56, rot: -7, op: 0.2, dur: 7800, delay: 3600, art: ["#2A2340", "#171126"] },
];

const SPECKS: Speck[] = [
  { x: 0.17, y: 0.15, s: 4, op: 0.7, dur: 3200, delay: 0 },
  { x: 0.88, y: 0.19, s: 3, op: 0.5, dur: 4000, delay: 1000 },
  { x: 0.09, y: 0.48, s: 3, op: 0.6, dur: 3600, delay: 2000 },
  { x: 0.93, y: 0.52, s: 4, op: 0.45, dur: 4400, delay: 700 },
  { x: 0.24, y: 0.9, s: 3, op: 0.55, dur: 3800, delay: 2600 },
  { x: 0.66, y: 0.94, s: 4, op: 0.4, dur: 4200, delay: 1400 },
];

// How long the launch beat sits before moving on by itself — long enough for the drift/breathe
// animation to read, short enough that it doesn't feel like a stall for someone who isn't going
// to tap anyway.
const AUTO_START_DELAY_MS = 2600;

export function TitleScreen({ onStart }: { onStart: () => void }) {
  // Stashed in a ref, not read directly in the effect below: App.tsx passes this as a fresh
  // inline closure on every render, and it can re-render during this window (fonts/auth
  // resolving) — depending on `onStart` directly would restart the countdown from zero each
  // time instead of firing once, mount-to-mount.
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  useEffect(() => {
    const id = setTimeout(() => onStartRef.current(), AUTO_START_DELAY_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen glow="58,20,112" intensity={0.5}>
      <RayBurst size={W * 2.6} tint={["#C878FF", "#FFC45A"]} spin={90} count={22} />

      <View style={styles.bloom} pointerEvents="none">
        <Svg width={520} height={520}>
          <Defs>
            <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFD078" stopOpacity="0.28" />
              <Stop offset="0.42" stopColor="#A050FF" stopOpacity="0.16" />
              <Stop offset="0.7" stopColor="#A050FF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width={520} height={520} fill="url(#bloom)" />
        </Svg>
      </View>

      {DRIFT.map((d, i) => (
        <Drifter key={i} d={d} />
      ))}
      {SPECKS.map((s, i) => (
        <Speck key={i} s={s} />
      ))}

      <View style={styles.head}>
        <View>
          <Text style={styles.meta}>{splash.version}</Text>
        </View>
        <Pressable style={styles.menu} hitSlop={8}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
      </View>

      <Pressable style={styles.center} onPress={onStart}>
        <Breathe>
          <Image source={require("../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
        </Breathe>

        <Text style={styles.wordmark}>{brand.name}</Text>

        <View style={styles.plate}>
          <Text style={styles.plateText}>{brand.tagline}</Text>
        </View>
      </Pressable>

      <View style={styles.foot}>
        <View style={styles.footMark}>
          <Svg width={22} height={22} viewBox="0 0 48 48">
            <Polygon points="24,9 37,16.5 37,31.5 24,39 11,31.5 11,16.5" fill="none" stroke="#2A1440" strokeWidth={3} strokeLinejoin="round" />
            <Polygon points="24,17.5 30.5,21.2 30.5,27.8 24,31.5 17.5,27.8 17.5,21.2" fill="#2A1440" />
          </Svg>
        </View>
        <View>
          <Text style={styles.footText}>{brand.copyrightLine}</Text>
          <Text style={styles.footText}>{brand.disclaimerLine}</Text>
        </View>
      </View>
    </Screen>
  );
}

function Drifter({ d }: { d: Drift }) {
  const t = useSharedValue(0);
  useEffect(() => {
    const id = setTimeout(() => {
      t.value = withRepeat(withTiming(1, { duration: d.dur, easing: Easing.inOut(Easing.sin) }), -1, true);
    }, d.delay);
    return () => clearTimeout(id);
  }, [d.dur, d.delay, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -22 * t.value }, { rotate: `${d.rot}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.drifter, { left: W * d.x, top: H * d.y, opacity: d.op }, style]}
    >
      <PackFace art={d.art} width={d.w} height={Math.round(d.w * 1.4)} radius={7} crimp />
    </Animated.View>
  );
}

function Speck({ s }: { s: Speck }) {
  const t = useSharedValue(0.15);
  useEffect(() => {
    const id = setTimeout(() => {
      t.value = withRepeat(withTiming(1, { duration: s.dur, easing: Easing.inOut(Easing.sin) }), -1, true);
    }, s.delay);
    return () => clearTimeout(id);
  }, [s.dur, s.delay, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value * s.op,
    transform: [{ scale: 0.7 + 0.6 * t.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.speck, { left: W * s.x, top: H * s.y, width: s.s, height: s.s, borderRadius: s.s }, style]}
    />
  );
}

/** The mark breathes 3.5% on a 5s cycle (2.5s each way). */
function Breathe({ children }: { children: ReactNode }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withTiming(1.035, { duration: 2500, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  bloom: { position: "absolute", left: W / 2 - 260, top: H * 0.46 - 260 },
  drifter: { position: "absolute" },
  speck: {
    position: "absolute",
    backgroundColor: "#FFE9B8",
    shadowColor: "#FFE096",
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  head: {
    paddingTop: 52,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  meta: { fontSize: 12.5, fontWeight: "600", color: "rgba(255,255,255,0.6)", marginTop: 3 },
  menu: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  menuLine: { width: 20, height: 2.4, borderRadius: 2, backgroundColor: "#2A1440" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  logo: {
    width: 236,
    height: 236,
    shadowColor: "#FFC45A",
    shadowOpacity: 0.4,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
  },
  wordmark: {
    ...typography.heroWordmark,
    fontSize: 40,
    textShadowColor: "rgba(255,200,100,0.55)",
    textShadowRadius: 32,
    textShadowOffset: { width: 0, height: 3 },
  },
  plate: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFD678",
    borderWidth: 1.5,
    borderColor: "rgba(255,240,200,0.7)",
  },
  plateText: typography.plateLabel,
  foot: { paddingHorizontal: 22, paddingBottom: 26, flexDirection: "row", alignItems: "center", gap: 12 },
  footMark: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  footText: { fontSize: 11, fontWeight: "500", color: "rgba(255,255,255,0.62)", marginTop: 2 },
});
