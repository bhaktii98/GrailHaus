import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import type { PackSku } from "@grailhaus/shared";
import { PackFace } from "../../../components/PackFace";
import { ART_GRADIENT } from "../../../components/PackTile";
import { fonts, ink, spacing } from "../../../theme/tokens";
import { bulkRun as copy } from "../../../content/copy";
import { tierRevealIdentity } from "./tierPersonality";

/**
 * The opening beat of a bulk run — the moment that has to establish "this is different from
 * buying one pack ten times" before a single card is shown.
 *
 * It deliberately discloses nothing about what's inside. No grail count, no rarity breakdown, no
 * "you found…" — the whole point of the hunt is that the user doesn't know yet. What it does say,
 * plainly, is that the results are already decided and already theirs: the run is a presentation
 * of a locked outcome, not a live draw, and the copy is honest about that rather than implying
 * the order or the pacing affects anything.
 */
export function RunIntroStage({
  sku,
  packCount,
  onBegin,
  onSkip,
}: {
  sku: PackSku;
  packCount: number;
  onBegin: () => void;
  onSkip: () => void;
}) {
  const enter = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) });
    drift.value = withDelay(200, withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }));
  }, [enter, drift]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [18, 0]) }],
  }));

  const bodyStyle = useAnimatedStyle(() => ({ opacity: interpolate(enter.value, [0.4, 1], [0, 1]) }));

  const art = ART_GRADIENT[sku.tier] ?? ART_GRADIENT.street_rip;
  // Same tier identity the hunt uses — the intro is the first thing a run shows, so it has to set
  // the tier's tone rather than opening generic and switching character one screen later.
  const identity = tierRevealIdentity(sku.tier);

  return (
    <View style={[styles.fill, { backgroundColor: identity.backgroundHex }]}>
      <LinearGradient colors={identity.backdropGradient} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.center}>
        {/* A short fan of pack faces standing in for the run — three is enough to read as "a
            stack" without mounting ten of anything. */}
        <View style={styles.fan}>
          {[-1, 0, 1].map((offset) => (
            <FanCard key={offset} offset={offset} drift={drift} art={art} />
          ))}
        </View>

        <Animated.View style={[styles.copyBlock, titleStyle]}>
          <Text style={[styles.eyebrow, { color: identity.accentHex }]}>{copy.intro.eyebrow(packCount)}</Text>
          <Text style={styles.title}>{copy.intro.title}</Text>
          {/* The tier's own sealed-pack kicker ("Tier III · Sealed"), so the run opens naming the
              same thing the pack detail screen named. */}
          <Text style={styles.kicker}>{identity.kicker.toUpperCase()}</Text>
        </Animated.View>

        <Animated.Text style={[styles.body, bodyStyle]}>{copy.intro.body}</Animated.Text>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={onBegin}>
          {/* The CTA carries the tier's metal — Black Label's bronze, Vault Break's champagne. */}
          <LinearGradient
            colors={[identity.accentHex, `rgba(${identity.accentRGB},0.35)`]}
            style={[styles.primaryButton, { borderColor: `rgba(${identity.accentRGB},0.55)` }]}
          >
            <Text style={styles.primaryLabel}>{copy.intro.begin}</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={onSkip}>
          <Text style={styles.skipLink}>{copy.intro.skip}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FanCard({
  offset,
  drift,
  art,
}: {
  offset: number;
  drift: SharedValue<number>;
  art: string[];
}) {
  const style = useAnimatedStyle(() => ({
    position: "absolute",
    opacity: interpolate(drift.value, [0, 1], [0, offset === 0 ? 1 : 0.55]),
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [0, offset * 46]) },
      { translateY: interpolate(drift.value, [0, 1], [22, Math.abs(offset) * 10]) },
      { rotate: `${interpolate(drift.value, [0, 1], [0, offset * 9])}deg` },
      { scale: interpolate(drift.value, [0, 1], [0.88, offset === 0 ? 1 : 0.94]) },
    ],
  }));

  return (
    <Animated.View style={style}>
      <PackFace art={art} width={150} height={208} radius={14} crimp />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b0b10", paddingTop: 56, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg },
  fan: { height: 230, width: "100%", alignItems: "center", justifyContent: "center" },
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
  },
  footer: { paddingBottom: 40, gap: spacing.md, alignItems: "center" },
  primaryButton: {
    height: 62,
    minWidth: 260,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.26)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { fontFamily: fonts.black, fontSize: 15, letterSpacing: 1.1, color: "#fff" },
  skipLink: { fontFamily: fonts.semibold, fontSize: 13, color: "rgba(255,255,255,0.45)" },
});
