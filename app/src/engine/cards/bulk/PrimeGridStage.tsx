import { useMemo } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, FadeIn } from "react-native-reanimated";
import type { PackSku, PulledOwnedItem } from "@grailhaus/shared";
import { fonts, ink, spacing } from "../../../theme/tokens";
import { bulkRun as copy } from "../../../content/copy";
import { tierRevealIdentity } from "./tierPersonality";

/**
 * Stage two: every Prime from the run, together, in a 3×3 grid.
 *
 * The design call here is compression without cheapening. A ten-pack can easily produce eighteen
 * Primes; eighteen full-screen cinematic reveals would be exhausting and would flatten the
 * distinction between a Prime and a Grail — the thing that makes the Grail Hunt land is that
 * *not everything* gets that treatment. So Primes get presence instead of ceremony: real
 * artwork at a readable size, tier colour, name and value, and a staggered entrance so the grid
 * assembles itself rather than snapping into place.
 *
 * Performance: pure 2D. `expo-image` with `memory-disk` caching and a short transition, three
 * columns sized off screen width, inside one `ScrollView`. The stagger is capped so a large run
 * doesn't spend two seconds animating in — past the cap, later rows simply appear.
 */

const COLUMNS = 3;
const GAP = 10;
const H_PADDING = 20;
/** Beyond this many cards the per-item entrance delay stops growing, so a 30-Prime run doesn't
 * take noticeably longer to assemble than a 9-Prime one. */
const MAX_STAGGER_INDEX = 11;
const STAGGER_MS = 45;

export function PrimeGridStage({
  sku,
  primes,
  onContinue,
}: {
  sku: PackSku;
  primes: PulledOwnedItem[];
  onContinue: () => void;
}) {
  const tileWidth = useMemo(() => {
    const available = Dimensions.get("window").width - H_PADDING * 2 - GAP * (COLUMNS - 1);
    return Math.floor(available / COLUMNS);
  }, []);
  const tileHeight = Math.round(tileWidth * 1.38);

  const tierByLevel = useMemo(
    () => new Map(sku.rarityTiers.map((t) => [t.level, t])),
    [sku.rarityTiers]
  );
  const identity = useMemo(() => tierRevealIdentity(sku.tier), [sku.tier]);

  return (
    <View style={[styles.fill, { backgroundColor: identity.backgroundHex }]}>
      {/* Same room as the hunt the user just came out of — the run reads as one continuous
          journey rather than a set of differently-coloured screens. */}
      <LinearGradient colors={identity.backdropGradient} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: identity.accentHex }]}>{copy.prime.eyebrow}</Text>
        <Text style={styles.title}>{copy.prime.title(primes.length)}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {primes.map((item, i) => {
          const tier = tierByLevel.get(item.rarityTierLevel);
          const accent = tier?.colorHex ?? "#8A7BFF";
          return (
            <Animated.View
              key={item.ownedItemId}
              entering={FadeIn.delay(Math.min(i, MAX_STAGGER_INDEX) * STAGGER_MS)
                .duration(340)
                .easing(Easing.out(Easing.cubic))}
              style={[styles.tile, { width: tileWidth, height: tileHeight, borderColor: `${accent}55` }]}
            >
              {item.textureUrl ? (
                <Image
                  source={item.textureUrl}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={160}
                  cachePolicy="memory-disk"
                />
              ) : null}
              <LinearGradient
                colors={item.textureUrl ? ["transparent", "rgba(0,0,0,0.82)"] : [`${accent}CC`, "rgba(0,0,0,0.7)"]}
                style={StyleSheet.absoluteFill}
              />
              <Text style={[styles.tileTier, { color: accent }]} numberOfLines={1}>
                {tier?.name.toUpperCase()}
              </Text>
              <View style={styles.tileFooter}>
                <Text style={styles.tileName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.tileValue}>${(item.currentValueCents / 100).toFixed(0)}</Text>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={onContinue} style={[styles.continueButton, { borderColor: `rgba(${identity.accentRGB},0.4)` }]}>
          <Text style={styles.continueLabel}>{copy.prime.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b0b10", paddingTop: 56 },
  header: { alignItems: "center", gap: 6, paddingHorizontal: H_PADDING },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 2.4 },
  title: { fontFamily: fonts.black, fontSize: 26, color: ink.text },
  scroll: { flex: 1, marginTop: spacing.lg },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    paddingHorizontal: H_PADDING,
    paddingBottom: spacing.xl,
    justifyContent: "flex-start",
  },
  tile: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    justifyContent: "space-between",
    padding: 8,
  },
  tileTier: { fontFamily: fonts.extrabold, fontSize: 8.5, letterSpacing: 1.2 },
  tileFooter: { gap: 1 },
  tileName: { fontFamily: fonts.semibold, fontSize: 10.5, color: "rgba(255,255,255,0.9)" },
  tileValue: { fontFamily: fonts.black, fontSize: 14, color: "#fff" },
  footer: { paddingBottom: 40, paddingTop: spacing.md, paddingHorizontal: H_PADDING, alignItems: "center" },
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
});
