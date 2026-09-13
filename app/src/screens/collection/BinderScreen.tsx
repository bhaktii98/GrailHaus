import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { computePriceDrift } from "@grailhaus/shared";
import type { OwnedItem, RarityTierLevel } from "@grailhaus/shared";
import { useCollectionViewModel } from "../../viewmodels/useCollectionViewModel";
import { useManualRefresh } from "../../hooks/useManualRefresh";
import { useRarityTiers } from "../../viewmodels/useRarityTiers";
import { useTabBarClearance } from "../../navigation/tabBarVisibility";
import { CardFace } from "../../components/CardFace";
import { PnlPill } from "../../components/PnlPill";
import { itemArtGradient } from "../../content/cardArt";
import { useDriftClock } from "../../lib/driftClock";
import { money } from "../../lib/money";
import { colors, ink, typography } from "../../theme/tokens";
import { binder as copy } from "../../content/copy";
import type { CollectionStackParamList } from "../../navigation/CollectionStack";

type Nav = NativeStackNavigationProp<CollectionStackParamList, "Binder">;
type Route = RouteProp<CollectionStackParamList, "Binder">;

type Facet = "collection" | "rarity";

/** Cards get a grid — nine to a page in the mockup, a scrolling 3-column grid here — filtered
 * by collection or by rarity, both with real counts. No "still missing" section: knowing what's
 * *not* owned needs a full per-collection catalog listing the API doesn't expose today (only
 * /items/:id, one at a time) — see the note on useCollectionViewModel. Showing a fabricated
 * "7 / 9" would be worse than not showing it. */
export function BinderScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const route = useRoute<Route>();
  // Sized off the real viewport (grid's 20px side padding + the 9px inter-column gap, ×3 columns)
  // rather than a fixed 108px, which ran the third column off the edge on any phone narrower than
  // ~382pt (iPhone SE/mini and similar).
  const { width: windowWidth } = useWindowDimensions();
  const cellWidth = (windowWidth - 20 * 2 - 9 * 2) / 3;
  const vm = useCollectionViewModel();
  const { isRefreshing, refresh } = useManualRefresh(vm.refetch);
  // Admin-configurable (rarity_tiers table), not a hardcoded name map — see useRarityTiers.ts.
  const rarityTiers = useRarityTiers("cards");
  const [facet, setFacet] = useState<Facet>("collection");
  const [filter, setFilter] = useState<string | null>(route.params?.collectionFilter ?? null);
  const tabBarClearance = useTabBarClearance();
  // One clock for the whole page, so every cell's value steps on the same 30s boundary.
  const now = useDriftClock();

  const rarityGroups = useMemo(() => {
    const levels: RarityTierLevel[] = [1, 2, 3];
    return levels
      .map((level) => ({
        key: String(level),
        label: rarityTiers[level]?.name ?? "",
        items: vm.cards.filter((o) => o.item.rarityTierLevel === level),
      }))
      .filter((g) => g.items.length > 0);
  }, [vm.cards, rarityTiers]);

  const facetGroups = facet === "collection" ? vm.collections : rarityGroups;

  const visible = useMemo(() => {
    if (!filter) return vm.cards;
    if (facet === "collection") return vm.cards.filter((o) => (o.item.collection ?? "Uncategorized") === filter);
    return vm.cards.filter((o) => String(o.item.rarityTierLevel) === filter);
  }, [vm.cards, filter, facet]);

  function handleFacetChange(next: Facet) {
    setFacet(next);
    setFilter(null);
  }

  return (
    <View style={styles.fill}>
      {/* Bounded to the fixed header+filter row (never scrolls) rather than the whole screen —
          a full-screen wash here would stay pinned behind the grid's scrolled rows too. */}
      <LinearGradient colors={["rgba(177,75,255,0.24)", "transparent"]} style={styles.base} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{copy.header}</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.facetRow}>
        <Pressable
          style={[styles.facetChip, facet === "collection" && styles.facetChipActive]}
          onPress={() => handleFacetChange("collection")}
        >
          <Text style={[styles.facetText, facet === "collection" && styles.facetTextActive]}>{copy.facetCollection}</Text>
        </Pressable>
        <Pressable
          style={[styles.facetChip, facet === "rarity" && styles.facetChipActive]}
          onPress={() => handleFacetChange("rarity")}
        >
          <Text style={[styles.facetText, facet === "rarity" && styles.facetTextActive]}>{copy.facetRarity}</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        <Pressable style={[styles.chip, filter == null && styles.chipActive]} onPress={() => setFilter(null)}>
          <Text style={[styles.chipText, filter == null && styles.chipTextActive]}>{copy.all(vm.cards.length)}</Text>
        </Pressable>
        {facetGroups.map((g) => (
          <Pressable
            key={g.key}
            style={[styles.chip, filter === g.key && styles.chipActive]}
            onPress={() => setFilter(g.key)}
          >
            <Text style={[styles.chipText, filter === g.key && styles.chipTextActive]}>
              {g.label} {g.items.length}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(o: OwnedItem) => o.ownedItemId}
        numColumns={3}
        contentContainerStyle={[styles.grid, { paddingBottom: tabBarClearance }]}
        columnWrapperStyle={styles.gridRow}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.violetTop} colors={[colors.violetTop]} progressBackgroundColor={ink.ground} />}
        ListEmptyComponent={<Text style={styles.empty}>{copy.empty}</Text>}
        renderItem={({ item: owned }: { item: OwnedItem }) => (
          <BinderCell
            owned={owned}
            width={cellWidth}
            now={now}
            onPress={() => navigation.navigate("CardDetail", { owned })}
          />
        )}
      />
    </View>
  );
}

/** A binder page is a browsing surface, not a tracker — so the cell stays art-first and adds only
 * the two figures a collector would otherwise have to open the card to see: what it's worth on
 * this tick, and what that is against what they paid. Same live value and same P&L definition as
 * the Portfolio grid (see usePortfolioViewModel), so the two screens can never disagree. */
function BinderCell({
  owned,
  width,
  now,
  onPress,
}: {
  owned: OwnedItem;
  width: number;
  now: Date;
  onPress: () => void;
}) {
  const { currentValueCents } = computePriceDrift(owned.item, now);
  const basis = owned.costBasisCents;

  return (
    <Pressable style={{ width }} onPress={onPress}>
      <CardFace
        gradient={itemArtGradient(owned.item)}
        imageUrl={owned.item.textureUrl}
        width={width}
        height={width * 1.36}
      />
      <Text style={styles.cellName} numberOfLines={1}>
        {(owned.item.cardTitle ?? owned.item.name).toUpperCase()}
      </Text>
      <Text style={styles.cellValue}>{money(currentValueCents)}</Text>
      <View style={styles.cellPnl}>
        <PnlPill
          cents={basis == null ? null : currentValueCents - basis}
          percent={basis == null || basis === 0 ? null : ((currentValueCents - basis) / basis) * 100}
          size="sm"
          showPercent={false}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: ink.groundDeep },
  base: { position: "absolute", top: 0, left: 0, right: 0, height: 280 },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { ...typography.title, fontSize: 15 },
  facetRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 16 },
  facetChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
  },
  facetChipActive: { backgroundColor: "rgba(177,75,255,0.24)", borderColor: "rgba(177,75,255,0.6)" },
  facetText: { ...typography.metaLine, fontSize: 11.5, color: "rgba(255,255,255,0.5)" },
  facetTextActive: { color: "#E0C4FF" },
  chipRow: { flexDirection: "row", gap: 7, paddingHorizontal: 20, paddingTop: 12, flexWrap: "wrap" },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    marginBottom: 7,
  },
  chipActive: { backgroundColor: colors.violetTop, borderColor: colors.violetTop },
  chipText: { ...typography.metaLine, fontSize: 12, color: "rgba(255,255,255,0.6)" },
  chipTextActive: { color: "#fff" },
  grid: { padding: 20, paddingTop: 8, gap: 14 },
  gridRow: { gap: 9 },
  cellName: { ...typography.footNote, fontWeight: "800" as const, color: "#fff", marginTop: 6, fontSize: 9 },
  cellValue: { ...typography.footNote, color: colors.goldTop, marginTop: 1, fontSize: 10.5, fontVariant: ["tabular-nums"] },
  cellPnl: { marginTop: 3 },
  empty: { ...typography.sectionSub, textAlign: "center", marginTop: 60, width: "100%" },
});
