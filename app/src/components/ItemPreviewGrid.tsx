import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { PackSku, RarityTierLevel } from "@grailhaus/shared";
import { useTierOwnership } from "../viewmodels/useTierOwnership";
import { fonts, ink } from "../theme/tokens";

const MAX_VISIBLE = 6;

/**
 * "COLLECTION PREVIEW" / "FEATURED IN THIS TIER" — a small grid of every
 * catalog item in a tier, owned ones lit with their real rarity color,
 * unowned ones shown as "?" tiles, real counts from `useTierOwnership` (no
 * placeholder "you hold N" numbers).
 */
export function ItemPreviewGrid({
  sku,
  title,
  tierLevel,
}: {
  sku: PackSku | null;
  title: string;
  tierLevel?: RarityTierLevel;
}) {
  const { items, ownedIds, ownedCount, totalCount } = useTierOwnership(sku, tierLevel);
  if (!sku || totalCount === 0) return null;

  const visible = items.slice(0, MAX_VISIBLE);
  const overflow = totalCount - visible.length;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>
          You hold {ownedCount} / {totalCount}
        </Text>
      </View>
      <View style={styles.grid}>
        {visible.map((item) => {
          const owned = ownedIds.has(item.id);
          const tier = sku.rarityTiers.find((t) => t.level === item.rarityTierLevel);
          const color = tier?.colorHex ?? ink.textMuted;
          return (
            <View key={item.id} style={styles.tile}>
              {owned ? (
                item.textureUrl ? (
                  <>
                    <Image
                      source={item.textureUrl}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={150}
                      cachePolicy="memory-disk"
                    />
                    <LinearGradient colors={["transparent", `${color}55`]} style={StyleSheet.absoluteFill} />
                  </>
                ) : (
                  <LinearGradient colors={[`${color}CC`, `${color}22`]} style={StyleSheet.absoluteFill} />
                )
              ) : (
                // Deliberately never shows real art here, even if textureUrl exists — an unowned
                // item stays a "?" on purpose, so this grid never spoils what a tier contains.
                <Text style={styles.unknown}>?</Text>
              )}
            </View>
          );
        })}
        {overflow > 0 && (
          <View style={[styles.tile, styles.overflowTile]}>
            <Text style={styles.overflowText}>+{overflow}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, color: "rgba(255,255,255,0.62)" },
  count: { fontFamily: fonts.semibold, fontSize: 12, color: "rgba(255,255,255,0.62)" },
  grid: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    aspectRatio: 0.86,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  unknown: { fontFamily: fonts.extrabold, fontSize: 16, color: "rgba(255,255,255,0.3)" },
  overflowTile: { backgroundColor: "rgba(255,255,255,0.04)", borderStyle: "dashed" },
  overflowText: { fontFamily: fonts.extrabold, fontSize: 12, color: "rgba(255,255,255,0.5)" },
});
