import { useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { PackSku, PulledOwnedItem } from "@grailhaus/shared";
import { fonts, ink, spacing } from "../../../theme/tokens";
import { bulkRun as copy } from "../../../content/copy";
import { tierRevealIdentity } from "./tierPersonality";

/**
 * Stage three: everything else. A ten-pack Black Label run leaves ~48 Cores, and the entire point
 * of this stage is that the user can take them in at a glance and move on — "here is everything
 * else you pulled", not "here are 48 more animations to sit through".
 *
 * So: a compact row per card, thumbnail + name + tier + value, scrolled at speed. No entrance
 * animation at all, deliberately — staggering 48 rows would be exactly the delay this stage
 * exists to avoid, and animation on a fast-scrolling list is where jank shows up first.
 *
 * Performance: `FlatList` rather than a mapped ScrollView, so rows are windowed and recycled
 * instead of all mounting at once. `getItemLayout` is supplied (rows are a fixed height), which
 * lets the list skip measurement entirely — the single biggest win for long lists on mid-range
 * Android. Thumbnails are small and memory-disk cached, so scrolling back up costs nothing.
 */

const ROW_HEIGHT = 68;
const ROW_GAP = 8;
const ROW_STRIDE = ROW_HEIGHT + ROW_GAP;

export function CoreListStage({
  sku,
  cores,
  onContinue,
}: {
  sku: PackSku;
  cores: PulledOwnedItem[];
  onContinue: () => void;
}) {
  const tierByLevel = useMemo(() => new Map(sku.rarityTiers.map((t) => [t.level, t])), [sku.rarityTiers]);
  const identity = useMemo(() => tierRevealIdentity(sku.tier), [sku.tier]);

  const renderItem = useCallback(
    ({ item }: { item: PulledOwnedItem }) => {
      const tier = tierByLevel.get(item.rarityTierLevel);
      const accent = tier?.colorHex ?? "#6B7280";
      return (
        <View style={styles.row}>
          <View style={[styles.thumb, { borderColor: `${accent}44` }]}>
            {item.textureUrl ? (
              <Image
                source={item.textureUrl}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={120}
                cachePolicy="memory-disk"
              />
            ) : (
              <LinearGradient colors={[`${accent}AA`, "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} />
            )}
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.rowTier, { color: accent }]}>{tier?.name.toUpperCase()}</Text>
          </View>
          <Text style={styles.rowValue}>${(item.currentValueCents / 100).toFixed(0)}</Text>
        </View>
      );
    },
    [tierByLevel]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: ROW_STRIDE, offset: ROW_STRIDE * index, index }),
    []
  );

  return (
    <View style={[styles.fill, { backgroundColor: identity.backgroundHex }]}>
      <LinearGradient colors={identity.backdropGradient} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: identity.accentHex }]}>{copy.core.eyebrow}</Text>
        <Text style={styles.title}>{copy.core.title(cores.length)}</Text>
        <Text style={styles.body}>{copy.core.body}</Text>
      </View>

      <FlatList
        style={styles.list}
        data={cores}
        renderItem={renderItem}
        keyExtractor={(item) => item.ownedItemId}
        getItemLayout={getItemLayout}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
      />

      <View style={styles.footer}>
        <Pressable onPress={onContinue} style={[styles.continueButton, { borderColor: `rgba(${identity.accentRGB},0.4)` }]}>
          <Text style={styles.continueLabel}>{copy.core.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b0b10", paddingTop: 56 },
  header: { alignItems: "center", gap: 5, paddingHorizontal: 20 },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 2.4 },
  title: { fontFamily: fonts.black, fontSize: 26, color: ink.text },
  body: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.55)" },
  list: { flex: 1, marginTop: spacing.lg },
  listContent: { paddingHorizontal: 20, paddingBottom: spacing.xl, gap: ROW_GAP },
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  thumb: { width: 38, height: 52, borderRadius: 7, overflow: "hidden", borderWidth: 1 },
  rowBody: { flex: 1, gap: 3 },
  rowName: { fontFamily: fonts.semibold, fontSize: 13.5, color: ink.text },
  rowTier: { fontFamily: fonts.extrabold, fontSize: 9, letterSpacing: 1.1 },
  rowValue: { fontFamily: fonts.black, fontSize: 15, color: "#fff" },
  footer: { paddingBottom: 40, paddingTop: spacing.md, paddingHorizontal: 20, alignItems: "center" },
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
