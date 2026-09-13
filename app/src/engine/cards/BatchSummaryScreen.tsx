import { useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import type { PackSku, PulledOwnedItem } from "@grailhaus/shared";
import { summarizeBulkRun } from "@grailhaus/shared";
import { StatBox } from "../../components/StatBox";
import { tierLabel } from "../../components/PackTile";
import { track } from "../../lib/analytics";
import { fonts, ink, spacing } from "../../theme/tokens";
import { bulkRun as copy } from "../../content/copy";
import { tierRevealIdentity } from "./bulk/tierPersonality";

/**
 * The terminal screen for a bulk (10-pack) run — "everything pulled across ten packs, total spend
 * versus total value, and the best pull surfaced as the hero".
 *
 * Every figure on it comes from shared's `summarizeBulkRun`, which is also what the Grail Hunt
 * ranks with — so "the last grail you revealed" and "BEST PULL" here are guaranteed to be the
 * same card. They'd otherwise be able to disagree, which reads as a bug to a collector.
 *
 * Reached three ways, all of which land here identically: the run's last stage completing, "skip
 * to results" from anywhere in it, or a device that died between the run finishing and this
 * screen being dismissed (the same `resumedToSummary` contract every other terminal screen in
 * this engine honours). Every pack's contents already exist regardless of how much of the
 * presentation was actually watched — skipping ahead never loses or re-rolls anything.
 *
 * This is also the screenshot people post, so it earns a staged entrance: the headline number,
 * then the hero, then the ledger. Nothing here waits on a timer to become usable.
 */
export function BatchSummaryScreen({
  sku,
  packs,
  isRipAgainWorking,
  onRipAgain,
  onGoHome,
  onViewCollection,
  onListPull,
}: {
  sku: PackSku;
  packs: PulledOwnedItem[][];
  isRipAgainWorking: boolean;
  onRipAgain: () => void;
  onGoHome: () => void;
  onViewCollection: () => void;
  /** Hands the run's best pull straight into the existing marketplace listing flow, prefilled.
   * Undefined when there's nothing sellable (an empty run). */
  onListPull?: (item: PulledOwnedItem) => void;
}) {
  const summary = useMemo(() => summarizeBulkRun(sku, packs), [sku, packs]);
  const tierLabelText = tierLabel(sku);
  // The run ends in the same room it ran in — the summary is the screenshot people post, so it
  // has to look like the tier they bought, not like a generic receipt.
  const identity = useMemo(() => tierRevealIdentity(sku.tier), [sku.tier]);
  const isProfit = summary.estimatedPnlCents >= 0;
  const pnlColor = isProfit ? "#8BF285" : "#F0554A";

  useEffect(() => {
    track("batch_summary_viewed", {
      tier: sku.tier,
      packId: sku.id,
      quantity: summary.packCount,
      totalCards: summary.totalCards,
      grailCount: summary.grailCount,
      primeCount: summary.primeCount,
      coreCount: summary.coreCount,
      bestPullId: summary.bestPull?.id,
      bestPullValueCents: summary.bestPull?.currentValueCents,
    });
  }, [sku.tier, sku.id, summary]);

  const headline = useSharedValue(0);
  useEffect(() => {
    headline.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [headline]);

  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headline.value,
    transform: [{ scale: interpolate(headline.value, [0, 1], [0.86, 1]) }],
  }));

  const best = summary.bestPull;
  const bestTier = best ? sku.rarityTiers.find((t) => t.level === best.rarityTierLevel) : null;
  const bestAccent = bestTier?.colorHex ?? identity.accentHex;

  return (
    <View style={[styles.fill, { backgroundColor: identity.backgroundHex }]}>
      <LinearGradient colors={identity.backdropGradient} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.summaryHeader}>
        <Text style={[styles.eyebrow, { color: identity.accentHex }]}>{copy.summary.eyebrow}</Text>
        <Text style={styles.runLine}>
          {sku.name.toUpperCase()} × {summary.packCount}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.summaryScroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.headlineBlock, headlineStyle]}>
          <Text style={[styles.pnl, { color: pnlColor }]}>
            {isProfit ? "+" : "−"}${(Math.abs(summary.estimatedPnlCents) / 100).toFixed(0)}
          </Text>
          <Text style={styles.cardsCollected}>{copy.summary.cardsCollected(summary.totalCards)}</Text>
        </Animated.View>

        {/* Rarity breakdown — the shape of the run at a glance. */}
        <Animated.View entering={FadeIn.delay(160).duration(420)} style={styles.breakdownRow}>
          <BreakdownCell
            label={copy.summary.grailLabel}
            value={summary.grailCount}
            color={sku.rarityTiers.find((t) => t.level === 3)?.colorHex ?? "#E5C08A"}
          />
          <BreakdownCell
            label={copy.summary.primeLabel}
            value={summary.primeCount}
            color={sku.rarityTiers.find((t) => t.level === 2)?.colorHex ?? "#8A7BFF"}
          />
          <BreakdownCell
            label={copy.summary.coreLabel}
            value={summary.coreCount}
            color={sku.rarityTiers.find((t) => t.level === 1)?.colorHex ?? "#6B7280"}
          />
        </Animated.View>

        {best && (
          <Animated.View entering={FadeIn.delay(300).duration(520)} style={styles.heroCard}>
            <Text style={[styles.heroEyebrow, { color: bestAccent }]}>{copy.summary.bestPull}</Text>
            <View style={[styles.heroTile, { borderColor: `${bestAccent}66` }]}>
              {best.textureUrl ? (
                <Image
                  source={best.textureUrl}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={150}
                  cachePolicy="memory-disk"
                />
              ) : null}
              <LinearGradient
                colors={best.textureUrl ? ["transparent", "rgba(0,0,0,0.72)"] : [`${bestAccent}CC`, "rgba(0,0,0,0.6)"]}
                style={StyleSheet.absoluteFill}
              />
              {bestTier && <Text style={styles.heroTierLabel}>{bestTier.name.toUpperCase()}</Text>}
              <Text style={styles.heroValue}>${(best.currentValueCents / 100).toFixed(0)}</Text>
            </View>
            <Text style={styles.heroName} numberOfLines={2}>
              {best.name}
            </Text>
          </Animated.View>
        )}

        {/* The ledger. Spend vs estimated value is the headline comparison; the note keeps it
            honest about what "estimated" means rather than implying a guaranteed sale price. */}
        <Animated.View entering={FadeIn.delay(420).duration(420)} style={styles.ledger}>
          <LedgerRow label={copy.summary.totalSpend} value={`$${(summary.totalSpendCents / 100).toFixed(2)}`} />
          <View style={styles.divider} />
          <LedgerRow label={copy.summary.estimatedValue} value={`$${(summary.estimatedValueCents / 100).toFixed(2)}`} />
          <View style={styles.divider} />
          <LedgerRow
            label={copy.summary.estimatedPnl}
            value={`${isProfit ? "+" : "−"}$${(Math.abs(summary.estimatedPnlCents) / 100).toFixed(2)}`}
            valueColor={pnlColor}
          />
        </Animated.View>
        <Text style={styles.valueNote}>{copy.summary.valueNote}</Text>

        <View style={styles.statRow}>
          <StatBox label="PACKS" value={String(summary.packCount)} />
          <StatBox label="CARDS" value={String(summary.totalCards)} />
        </View>

        <Text style={styles.addedNote}>✓ All {summary.totalCards} cards added to your collection</Text>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: identity.backgroundHex }]}>
        <Pressable onPress={onRipAgain} disabled={isRipAgainWorking}>
          <LinearGradient
            colors={[identity.accentHex, `rgba(${identity.accentRGB},0.35)`]}
            style={[styles.primaryButton, { borderColor: `rgba(${identity.accentRGB},0.55)` }]}
          >
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
          {best && onListPull ? (
            <Pressable onPress={() => onListPull(best)} disabled={isRipAgainWorking} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>{copy.summary.listPull}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onGoHome} disabled={isRipAgainWorking} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>{copy.summary.done}</Text>
            </Pressable>
          )}
        </View>
        {best && onListPull && (
          <Pressable onPress={onGoHome} disabled={isRipAgainWorking}>
            <Text style={styles.doneLink}>{copy.summary.done}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function BreakdownCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.breakdownCell, { borderColor: `${color}44` }]}>
      <Text style={[styles.breakdownValue, { color }]}>{value}</Text>
      <Text style={styles.breakdownLabel}>{label}</Text>
    </View>
  );
}

function LedgerRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.ledgerRow}>
      <Text style={styles.ledgerLabel}>{label}</Text>
      <Text style={[styles.ledgerValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b0b10", paddingTop: 56, paddingHorizontal: 20 },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 2.4, color: "rgba(255,255,255,0.62)" },
  runLine: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1, color: "rgba(255,255,255,0.45)", marginTop: 5 },
  summaryHeader: { alignItems: "center" },
  scroll: { flex: 1, marginTop: 18 },
  summaryScroll: { alignItems: "center", gap: spacing.lg, paddingBottom: 250 },
  headlineBlock: { alignItems: "center", gap: 4 },
  pnl: { fontFamily: fonts.black, fontSize: 46 },
  cardsCollected: {
    fontFamily: fonts.extrabold,
    fontSize: 11,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.55)",
  },
  breakdownRow: { flexDirection: "row", gap: 10, width: "100%" },
  breakdownCell: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  breakdownValue: { fontFamily: fonts.black, fontSize: 24 },
  breakdownLabel: { fontFamily: fonts.extrabold, fontSize: 9, letterSpacing: 1.6, color: "rgba(255,255,255,0.5)" },
  heroCard: { alignItems: "center", gap: 9, marginTop: spacing.xs },
  heroEyebrow: { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 2.2 },
  heroTile: {
    width: 150,
    height: 206,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: 11,
    borderWidth: 1.5,
  },
  heroTierLabel: {
    position: "absolute",
    top: 11,
    left: 11,
    fontFamily: fonts.extrabold,
    fontSize: 9,
    letterSpacing: 1,
    color: "#fff",
  },
  heroValue: { fontFamily: fonts.black, fontSize: 22, color: "#fff" },
  heroName: { fontFamily: fonts.bold, fontSize: 14.5, color: ink.text, maxWidth: 230, textAlign: "center" },
  ledger: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 16,
  },
  ledgerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  ledgerLabel: { fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 1.2, color: "rgba(255,255,255,0.55)" },
  ledgerValue: { fontFamily: fonts.black, fontSize: 16, color: ink.text },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  valueNote: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "rgba(255,255,255,0.38)",
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 16,
    marginTop: -6,
  },
  statRow: { flexDirection: "row", gap: 10, width: "100%" },
  addedNote: { fontFamily: fonts.semibold, fontSize: 12.5, color: "#8BF285" },
  footer: {
    position: "absolute",
    bottom: 34,
    left: 20,
    right: 20,
    gap: spacing.sm,
    alignItems: "center",
    backgroundColor: "#0b0b10",
    paddingTop: spacing.sm,
  },
  primaryButton: {
    height: 60,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.26)",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 260,
    paddingHorizontal: 24,
  },
  primaryButtonLabel: { fontFamily: fonts.black, fontSize: 15, letterSpacing: 0.8, color: "#fff" },
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
  doneLink: { fontFamily: fonts.semibold, fontSize: 12.5, color: "rgba(255,255,255,0.45)", paddingTop: 2 },
});
