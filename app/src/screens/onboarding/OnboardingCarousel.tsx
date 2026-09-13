import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Screen } from "../../components/Screen";
import { PackFace } from "../../components/PackFace";
import { GameButton } from "../../components/GameButton";
import { Dots } from "../../components/Dots";
import { accent, spring, typography } from "../../theme/tokens";
import { brand, onboardingControls, onboardingPages } from "../../content/copy";

interface Page {
  eyebrow: string;
  title: string;
  body: string;
  acc: { c1: string; c2: string; glow: string };
  tilt: number;
  art: string[];
  beats: readonly (readonly [string, string, string])[];
}

/** Visual treatment only — the actual copy (eyebrow/title/body/beats) lives
 * in content/copy.ts's `onboardingPages`, kept content-only on purpose. Order
 * must match that array; each entry here is one page's accent/tilt/artwork. */
const ONBOARDING_DESIGN: { acc: Page["acc"]; tilt: number; art: string[] }[] = [
  { acc: accent.cards, tilt: -7, art: ["#FFB3F0", "#C64BFF", "#6420C8", "#2E0B63"] },
  { acc: accent.warn, tilt: 5, art: ["#FFD9B8", "#FF7A2F", "#C42410", "#4A0C04"] },
];

const PAGES: Page[] = onboardingPages.map((page, i) => ({ ...page, ...ONBOARDING_DESIGN[i] }));

const SWIPE_DISTANCE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 500;

/** Loosely inspired by rn/src/screens/OnboardingScreen.js, with real swipe
 * navigation added — the original only moved between pages via the button
 * or by tapping a dot, which isn't how anyone expects a page carousel to
 * behave. Swiping left/right past a small distance or velocity threshold
 * (same two-signal pattern as the reveal engine's GestureLayer) moves
 * forward/back; each page's content also now fades in/out on change instead
 * of hard-cutting. */
export function OnboardingCarousel({ onFinish }: { onFinish: () => void }) {
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const p = PAGES[i];
  const last = i === PAGES.length - 1;
  const first = i === 0;

  function next() {
    if (last) onFinish();
    else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setI((n) => n + 1);
    }
  }

  function prev() {
    if (!first) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setI((n) => n - 1);
    }
  }

  const swipe = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onEnd((event) => {
      "worklet";
      const wentLeft = event.translationX < 0;
      const passedDistance = Math.abs(event.translationX) > SWIPE_DISTANCE_THRESHOLD;
      const passedVelocity = Math.abs(event.velocityX) > SWIPE_VELOCITY_THRESHOLD;
      if (!passedDistance && !passedVelocity) return;
      if (wentLeft) runOnJS(next)();
      else runOnJS(prev)();
    });

  return (
    <GestureDetector gesture={swipe}>
      <View collapsable={false} style={styles.fill}>
        <Screen glow={p.acc.glow} intensity={0.3}>
          <View style={styles.head}>
            <View style={styles.brand}>
              <Image source={require("../../../assets/icon.png")} style={styles.logo} />
              <Text style={styles.brandText}>{brand.name}</Text>
            </View>
            {!last ? (
              <Pressable onPress={onFinish} hitSlop={10}>
                <Text style={styles.skip}>{onboardingControls.skip}</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <Tilted tilt={p.tilt} key={i}>
                <PackFace art={p.art} width={178} height={246} radius={20} crimp>
                  <View style={styles.packMark}>
                    <Image
                      source={require("../../../assets/icon.png")}
                      style={{ width: 62, height: 62, borderRadius: 13, opacity: 0.9 }}
                    />
                  </View>
                </PackFace>
              </Tilted>
            </View>

            <Animated.View key={i} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={styles.body}>
              <Text style={styles.eyebrow}>{p.eyebrow}</Text>
              <Text style={styles.title}>{p.title}</Text>
              <Text style={styles.para}>{p.body}</Text>

              <View style={[styles.rule, { backgroundColor: `rgba(${p.acc.glow},0.5)` }]} />

              <View style={{ gap: 12 }}>
                {p.beats.map(([k, t, d]) => (
                  <View key={t} style={styles.beat}>
                    <View style={[styles.key, { backgroundColor: `rgba(${p.acc.glow},0.18)` }]}>
                      <Text style={[styles.keyText, { color: p.acc.c1 }]}>{k}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.beatTitle}>{t}</Text>
                      <Text style={styles.beatBody}>{d}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          </ScrollView>

          {/* Pinned below the scrollable content (rather than at the end of it) so it's always
              reachable on a short device — a tall page's beats/body scroll under it instead of
              pushing it, and shrinking, off the bottom of the screen. */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.dotRow}>
              <Dots count={PAGES.length} index={i} onPick={setI} />
            </View>

            <GameButton
              label={last ? onboardingControls.getStarted : onboardingControls.next}
              accent={p.acc}
              onPress={next}
              style={{ marginTop: 16 }}
            />
          </View>
        </Screen>
      </View>
    </GestureDetector>
  );
}

/** Page changes remount this, so the pack settles in on a spring each time. */
function Tilted({ tilt, children }: { tilt: number; children: ReactNode }) {
  const t = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    t.value = withSpring(1, spring.cards);
    // A slight continuous drift once it settles in — otherwise the pack just
    // sits dead still for the rest of the page, unlike everywhere else in
    // onboarding where something is always gently moving.
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [t, bob]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -6 * bob.value },
      { rotate: `${tilt * t.value + 1.5 * bob.value}deg` },
      { scale: 0.94 + 0.06 * t.value },
    ],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: {
    paddingTop: 52,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: { width: 28, height: 28, borderRadius: 8 },
  brandText: { ...typography.navBrand, fontSize: 15, letterSpacing: 0.3 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  hero: { minHeight: 230, alignItems: "center", justifyContent: "center" },
  packMark: { position: "absolute", left: 58, top: 88 },
  body: { paddingHorizontal: 26 },
  eyebrow: typography.eyebrow,
  title: { ...typography.carouselTitle, marginTop: 11 },
  para: { ...typography.paragraph, marginTop: 11 },
  rule: { height: 1, marginVertical: 18 },
  beat: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  key: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  keyText: typography.beatKey,
  beatTitle: typography.beatTitle,
  beatBody: { ...typography.beatBody, marginTop: 2 },
  footer: { paddingHorizontal: 26, paddingTop: 6 },
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  skip: typography.linkMuted,
});
