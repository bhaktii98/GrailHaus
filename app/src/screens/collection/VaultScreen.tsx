import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { computePriceDrift } from "@grailhaus/shared";
import type { OwnedItem } from "@grailhaus/shared";
import { useCollectionViewModel } from "../../viewmodels/useCollectionViewModel";
import { useManualRefresh } from "../../hooks/useManualRefresh";
import { useRarityTiers } from "../../viewmodels/useRarityTiers";
import { useTabBarClearance } from "../../navigation/tabBarVisibility";
import { WatchDial } from "../../components/WatchDial";
import { PnlPill } from "../../components/PnlPill";
import { itemArtGradient } from "../../content/cardArt";
import { useDriftClock } from "../../lib/driftClock";
import { money } from "../../lib/money";
import { colors, ink, typography } from "../../theme/tokens";
import { vault as copy } from "../../content/copy";
import type { CollectionStackParamList } from "../../navigation/CollectionStack";

type Nav = NativeStackNavigationProp<CollectionStackParamList, "Vault">;

/** Watches: near-black, one column, one watch per row on a lit plinth (mockup 13c) — the
 * opposite register to the binder's grid. No completion meter: there's nothing to complete,
 * only pieces held. */
export function VaultScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const vm = useCollectionViewModel();
  const { isRefreshing, refresh } = useManualRefresh(vm.refetch);
  // Admin-configurable (rarity_tiers table), not a hardcoded name map — see useRarityTiers.ts.
  const rarityTiers = useRarityTiers("watches");
  const tabBarClearance = useTabBarClearance();
  // One clock for the whole list, so every row's value steps on the same 30s boundary.
  const now = useDriftClock();

  return (
    <View style={styles.fill}>
      {/* Bounded to the fixed header+summary (never scrolls) rather than the whole screen —
          a full-screen wash here would stay pinned behind the list's scrolled rows too. */}
      <LinearGradient colors={["rgba(242,196,107,0.22)", "transparent"]} style={styles.base} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={18} color="#F2C46B" />
        </Pressable>
        <Text style={styles.headerLabel}>{copy.header}</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.summary}>
        <Text style={styles.piecesHeld}>{copy.piecesHeld(vm.watches.length)}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>{copy.appraised(vm.watchesValueCents)}</Text>
          <View style={styles.divider} />
          <Text style={styles.summaryText}>{copy.brands(vm.brands.length)}</Text>
        </View>
        <View style={styles.hairline} />
      </View>

      <FlatList
        data={vm.watches}
        keyExtractor={(o: OwnedItem) => o.ownedItemId}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.violetTop} colors={[colors.violetTop]} progressBackgroundColor={ink.ground} />}
        ListEmptyComponent={<Text style={styles.empty}>{copy.empty}</Text>}
        renderItem={({ item: owned }: { item: OwnedItem }) => {
          // Same live value and P&L definition as the Portfolio grid — the vault is the quieter
          // way to browse the same positions, not a different set of numbers.
          const { currentValueCents } = computePriceDrift(owned.item, now);
          const basis = owned.costBasisCents;
          return (
            <Pressable style={styles.row} onPress={() => navigation.navigate("WatchDetail", { owned })}>
              <WatchDial art={itemArtGradient(owned.item)} imageUrl={owned.item.textureUrl} size={70} />
              <View style={styles.rowInfo}>
                <Text style={styles.brand}>{(owned.item.brand ?? "INDEPENDENT").toUpperCase()}</Text>
                <Text style={styles.name}>{owned.item.watchName ?? owned.item.name}</Text>
                <Text style={styles.ref}>{owned.item.modelName ?? rarityTiers[owned.item.rarityTierLevel]?.name ?? ""}</Text>
              </View>
              <View style={styles.rowValue}>
                <Text style={styles.priceText}>{money(currentValueCents)}</Text>
                <PnlPill
                  cents={basis == null ? null : currentValueCents - basis}
                  percent={basis == null || basis === 0 ? null : ((currentValueCents - basis) / basis) * 100}
                  size="sm"
                  showPercent={false}
                />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#020101" },
  base: { position: "absolute", top: 0, left: 0, right: 0, height: 260 },
  header: {
    paddingTop: 56,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(242,196,107,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabel: { fontFamily: "Outfit_600SemiBold", fontSize: 10, letterSpacing: 3.4, color: "rgba(242,196,107,0.7)" },
  summary: { paddingHorizontal: 26, paddingTop: 26 },
  piecesHeld: { fontFamily: "Outfit_400Regular", fontSize: 30, letterSpacing: -0.3, color: ink.textOnWatches },
  summaryRow: { flexDirection: "row", alignItems: "baseline", gap: 14, marginTop: 12 },
  summaryText: { fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "rgba(246,243,236,0.7)" },
  divider: { width: 1, height: 12, backgroundColor: "rgba(242,196,107,0.3)" },
  hairline: { height: 1, backgroundColor: "rgba(242,196,107,0.3)", marginTop: 22 },
  list: { paddingHorizontal: 26 },
  empty: { ...typography.footNote, textAlign: "center", marginTop: 60 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  rowInfo: { flex: 1, minWidth: 0 },
  brand: { fontFamily: "Outfit_600SemiBold", fontSize: 10, letterSpacing: 2.4, color: "rgba(242,196,107,0.75)" },
  name: { fontFamily: "Outfit_400Regular", fontSize: 21, color: ink.textOnWatches, marginTop: 5 },
  ref: { fontFamily: "Outfit_500Medium", fontSize: 11.5, color: "rgba(246,243,236,0.62)", marginTop: 4 },
  rowValue: { alignItems: "flex-end", gap: 5 },
  priceText: { fontFamily: "Outfit_600SemiBold", fontSize: 17, color: "#fff", fontVariant: ["tabular-nums"] },
});
