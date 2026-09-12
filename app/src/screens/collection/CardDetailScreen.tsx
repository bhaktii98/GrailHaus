import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { CardFace } from "../../components/CardFace";
import { PositionCard } from "../../components/PositionCard";
import { ValueDriftChart } from "../../components/ValueDriftChart";
import { itemArtGradient } from "../../content/cardArt";
import { useCollectionViewModel } from "../../viewmodels/useCollectionViewModel";
import { useRarityTiers } from "../../viewmodels/useRarityTiers";
import { useActionBarPadding, useHideTabBarOnScreen } from "../../navigation/tabBarVisibility";
import { colors, ink, typography } from "../../theme/tokens";
import { itemDetail as copy } from "../../content/copy";
import type { CollectionStackParamList } from "../../navigation/CollectionStack";

type Nav = NativeStackNavigationProp<CollectionStackParamList, "CardDetail">;
type Route = RouteProp<CollectionStackParamList, "CardDetail">;

/** Traits come off the catalog as a bullet-separated string ("Rookie Icon • Bright Pull •
 * Spark"), not comma-separated — split on either so a stray comma in future catalog data
 * doesn't silently merge two traits into one chip. */
function splitTraits(traits: string | null): string[] {
  if (!traits) return [];
  return traits
    .split(/[•,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function CardDetailScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { owned } = useRoute<Route>().params;
  const vm = useCollectionViewModel();
  // Admin-configurable (rarity_tiers table), not a hardcoded name map — see useRarityTiers.ts.
  const rarityTiers = useRarityTiers("cards");
  const item = owned.item;
  // A leaf screen with its own Keep/Sell action bar — the pill nav would sit directly under
  // those buttons and push them a nav-bar's height off the bottom edge.
  useHideTabBarOnScreen();
  const actionBarPadding = useActionBarPadding();

  const copiesOfThisItem = useMemo(
    () =>
      [...vm.cards]
        .filter((o) => o.item.id === item.id)
        .sort((a, b) => new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime()),
    [vm.cards, item.id]
  );
  const copiesOwned = copiesOfThisItem.length;

  const acquiredDate = new Date(owned.acquiredAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const traits = splitTraits(item.traits);
  const collectionName = item.collection ?? "Uncategorized";

  return (
    <View style={styles.fill}>
      <ScrollView
        // Clears the absolutely-positioned action bar below (two rows + its own padding) so the
        // last section can still be scrolled clear of it.
        contentContainerStyle={[styles.scroll, { paddingBottom: 190 + actionBarPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Wash lives in content coordinates, not as a screen-fixed sibling — a fixed wash
            would stay pinned to the viewport as the header/hero scroll away, bleeding into
            whatever section (traits, value, acquired) scrolls into that same screen region. */}
        <View style={styles.heroWrap}>
          <LinearGradient colors={["rgba(177,75,255,0.24)", "transparent"]} style={StyleSheet.absoluteFill} />

          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </Pressable>
            <Text style={styles.headerLabel}>
              {copy.owned}
              {copiesOwned > 1 ? ` · ${copiesOwned}×` : ""}
            </Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={styles.heroRow}>
            <CardFace gradient={itemArtGradient(item)} imageUrl={item.textureUrl} width={132} height={184} borderColor="rgba(255,215,94,0.78)" />
            <View style={styles.heroInfo}>
              <Text style={styles.name}>{(item.cardTitle ?? item.name).toUpperCase()}</Text>
              {item.pokemonName ? <Text style={styles.subName}>{item.pokemonName}</Text> : null}

              <View style={styles.specRows}>
                <SpecRow
                  label={copy.rarity}
                  value={rarityTiers[item.rarityTierLevel]?.name ?? ""}
                  valueColor={rarityTiers[item.rarityTierLevel]?.colorHex ?? colors.goldTop}
                />
                <SpecRow label={copy.collectionLabel} value={collectionName} />
                <SpecRow label={copy.ownedCopies(copiesOwned)} value="" hideValue />
              </View>
            </View>
          </View>
        </View>

        {traits.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{copy.traits}</Text>
            <View style={styles.traitRow}>
              {traits.map((t) => (
                <View key={t} style={styles.traitChip}>
                  <Text style={styles.traitText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Position before market value on purpose: "what did this do for me" is the question a
            collector opens their own copy with, and the item-level appraisal below is the
            context for it rather than the other way round. */}
        <View style={styles.section}>
          <PositionCard owned={owned} register="cards" />
        </View>

        <View style={styles.section}>
          <View style={styles.valueCard}>
            <Text style={styles.sectionLabel}>{copy.estimatedValue}</Text>
            <Text style={styles.valueBig}>${(item.currentValueCents / 100).toLocaleString()}</Text>
            <Text style={styles.valueRangeText}>{copy.valueRange(item.minValueCents, item.maxValueCents)}</Text>
            <ValueDriftChart
              item={{ id: item.id, category: item.category, baseValueCents: item.baseValueCents }}
              minValueCents={item.minValueCents}
              maxValueCents={item.maxValueCents}
              accentColor={colors.goldTop}
            />
          </View>
        </View>

        {copiesOwned > 1 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{copy.ownershipHistory}</Text>
            <View style={styles.historyList}>
              {copiesOfThisItem.map((copyRow, i) => (
                <View key={copyRow.ownedItemId} style={styles.historyRow}>
                  <Text style={styles.historyIndex}>#{copiesOwned - i}</Text>
                  <Text style={styles.historyDate}>
                    {copy.acquired(
                      new Date(copyRow.acquiredAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    )}
                  </Text>
                  {copyRow.ownedItemId === owned.ownedItemId && <Text style={styles.historyThisOne}>THIS COPY</Text>}
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.acquiredText}>{copy.acquired(acquiredDate)}</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: actionBarPadding }]}>
        <View style={styles.actionRow}>
          <Pressable style={styles.keepButton} onPress={() => navigation.goBack()}>
            <Text style={styles.keepLabel}>{copy.keep}</Text>
          </Pressable>
          <Pressable style={styles.sellWrap} onPress={() => navigation.navigate("SellItem", { owned })}>
            <LinearGradient colors={["#FFD75E", "#E08A16"]} style={styles.sellButton}>
              <Text style={styles.sellLabel}>{copy.sell}</Text>
            </LinearGradient>
          </Pressable>
        </View>
        <Pressable
          style={styles.viewCollectionButton}
          onPress={() => navigation.navigate("Binder", { collectionFilter: collectionName })}
        >
          <Text style={styles.viewCollectionLabel}>{copy.viewCollection(collectionName)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SpecRow({
  label,
  value,
  valueColor,
  hideValue,
}: {
  label: string;
  value: string;
  valueColor?: string;
  hideValue?: boolean;
}) {
  return (
    <View style={styles.specRow}>
      <Text style={styles.specLabel}>{label}</Text>
      {!hideValue && <Text style={[styles.specValue, valueColor && { color: valueColor }]}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: ink.groundDeep },
  scroll: { paddingBottom: 200 },
  heroWrap: { position: "relative" },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabel: { ...typography.eyebrow, letterSpacing: 2.4 },
  heroRow: { flexDirection: "row", gap: 16, paddingHorizontal: 20, paddingTop: 18, alignItems: "flex-start" },
  heroInfo: { flex: 1, minWidth: 0 },
  name: { ...typography.pageHeading, fontSize: 24 },
  subName: { ...typography.sectionSub, marginTop: 4 },
  specRows: { marginTop: 14, gap: 7 },
  specRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  specLabel: { ...typography.metaLine, fontSize: 10.5, color: "rgba(255,255,255,0.62)" },
  specValue: { ...typography.metaLine, fontSize: 11.5, color: "#fff" },
  section: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: typography.eyebrow,
  traitRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 9 },
  traitChip: {
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "rgba(201,155,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(201,155,255,0.45)",
    justifyContent: "center",
  },
  traitText: { ...typography.metaLine, fontSize: 11, color: "#E0C4FF" },
  valueCard: {
    padding: 15,
    borderRadius: 18,
    backgroundColor: "rgba(255,215,94,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,215,94,0.36)",
  },
  valueBig: { ...typography.heroWordmark, fontSize: 30, marginTop: 4 },
  valueRangeText: { ...typography.footNote, marginTop: 6 },
  acquiredText: typography.footNote,
  historyList: { marginTop: 9, gap: 8 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  historyIndex: { ...typography.metaLine, fontSize: 10.5, color: "rgba(255,255,255,0.5)", width: 26 },
  historyDate: { ...typography.footNote, flex: 1 },
  historyThisOne: {
    ...typography.metaLine,
    fontSize: 8.5,
    fontWeight: "800" as const,
    color: "#8BF285",
    letterSpacing: 0.6,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
    // Matches the screen's own ground (it used to be `colors.bg`, a different near-black, which
    // drew a visible seam across the bottom of the page) with a hairline to separate the action
    // bar from content scrolling underneath it.
    backgroundColor: ink.groundDeep,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  actionRow: { flexDirection: "row", gap: 10 },
  keepButton: {
    flex: 1,
    height: 56,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  keepLabel: { ...typography.chunkyButtonLabel, fontSize: 14 },
  sellWrap: { flex: 1 },
  sellButton: {
    flex: 1,
    height: 56,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  sellLabel: { ...typography.chunkyButtonLabel, fontSize: 14, color: "#2A1706" },
  viewCollectionButton: {
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(177,75,255,0.16)",
    borderWidth: 1.5,
    borderColor: "rgba(177,75,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewCollectionLabel: { ...typography.chipLabel, fontSize: 13, color: "#E0C4FF" },
});
