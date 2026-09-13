import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type CompositeNavigationProp, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CardFace } from "../../components/CardFace";
import { WatchDial } from "../../components/WatchDial";
import { itemArtGradient } from "../../content/cardArt";
import type { DiscoverItem } from "../../viewmodels/useDiscoverViewModel";
import { useRarityTiers } from "../../viewmodels/useRarityTiers";
import { useTabBarClearance } from "../../navigation/tabBarVisibility";
import { colors, ink, typography } from "../../theme/tokens";
import { versions as copy } from "../../content/copy";
import type { DiscoverStackParamList } from "../../navigation/DiscoverStack";
import type { AppStackParamList } from "../../navigation/AppNavigator";

// ItemFork lives on the root stack now (see AppNavigator), not DiscoverStack.
type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<AppStackParamList>,
  NativeStackNavigationProp<DiscoverStackParamList, "Versions">
>;
type Route = RouteProp<DiscoverStackParamList, "Versions">;

/** "Same Pokémon, nine printings, three tiers of scarcity" (mockup 18a) — every version of one
 * name/brand, ordered rarest-last so the chase piece anchors the bottom of the list. */
export function VersionsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { category, group } = useRoute<Route>().params;
  // Cards gets its own bespoke visual register (art shape, wash color); everything else shares
  // the other register as a generic fallback — same "cards is special, else shared" rule used
  // throughout this pass.
  const isCards = category === "cards";
  const tabBarClearance = useTabBarClearance();
  // Admin-configurable (rarity_tiers table), not a hardcoded name map — see useRarityTiers.ts.
  const rarityTiers = useRarityTiers(category);

  return (
    <View style={styles.fill}>
      {/* Bounded to the fixed header+title row (never scrolls) rather than the whole screen —
          a full-screen wash here would stay pinned behind the list's scrolled rows too. */}
      <LinearGradient
        colors={[isCards ? "rgba(177,75,255,0.24)" : "rgba(242,196,107,0.2)", "transparent"]}
        style={styles.base}
      />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerLabel}>{copy.header.toUpperCase()}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.titleRow}>
        {isCards ? (
          <CardFace gradient={itemArtGradient(group.versions[0].detail)} imageUrl={group.versions[0].detail.textureUrl} width={48} height={67} />
        ) : (
          <WatchDial art={itemArtGradient(group.versions[0].detail)} imageUrl={group.versions[0].detail.textureUrl} size={58} />
        )}
        <View style={styles.titleInfo}>
          <Text style={styles.name}>{group.label}</Text>
          <Text style={styles.sub}>
            {[group.subtitle, copy.versionCount(group.versions.length), group.ownedTotal > 0 ? `you hold ${group.ownedTotal}` : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </View>

      <FlatList
        data={group.versions}
        keyExtractor={(v: DiscoverItem) => v.detail.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: v }: { item: DiscoverItem }) => (
          <Pressable style={styles.row} onPress={() => navigation.navigate("ItemFork", { category, item: v })}>
            {isCards ? (
              <CardFace gradient={itemArtGradient(v.detail)} imageUrl={v.detail.textureUrl} width={56} height={78} />
            ) : (
              <WatchDial art={itemArtGradient(v.detail)} imageUrl={v.detail.textureUrl} size={56} />
            )}
            <View style={styles.rowInfo}>
              <View style={styles.rowBadges}>
                <Text style={styles.tierLabel}>{rarityTiers[v.detail.rarityTierLevel]?.name ?? ""}</Text>
                {v.ownedCount > 0 && (
                  <View style={styles.ownedBadge}>
                    <Text style={styles.ownedText}>{copy.ownedBadge(v.ownedCount)}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.itemName}>{(v.detail.cardTitle ?? v.detail.watchName ?? v.detail.name).toUpperCase()}</Text>
              <Text style={styles.itemMeta}>
                {v.listedCount > 0 ? copy.listedBadge(v.listedCount) : copy.noneListed}
              </Text>
            </View>
            <View style={styles.rowValue}>
              <Text style={styles.priceText}>${(v.detail.currentValueCents / 100).toLocaleString()}</Text>
            </View>
          </Pressable>
        )}
      />

      <View style={[styles.footer, { paddingBottom: tabBarClearance }]}>
        <Text style={styles.footerHint}>{copy.tapHint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: ink.groundDeep },
  base: { position: "absolute", top: 0, left: 0, right: 0, height: 260 },
  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabel: { ...typography.eyebrow, letterSpacing: 2.4 },
  titleRow: { flexDirection: "row", gap: 14, alignItems: "center", paddingHorizontal: 20, paddingTop: 18 },
  titleInfo: { flex: 1, minWidth: 0 },
  name: { ...typography.pageHeading, fontSize: 26 },
  sub: { ...typography.sectionSub, marginTop: 5 },
  list: { padding: 20, paddingTop: 14, gap: 11 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 13,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowBadges: { flexDirection: "row", alignItems: "center", gap: 8 },
  tierLabel: { ...typography.eyebrow, fontSize: 9 },
  ownedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: "rgba(99,232,92,0.18)",
    borderWidth: 1,
    borderColor: "rgba(99,232,92,0.4)",
  },
  ownedText: { fontSize: 8, fontWeight: "800" as const, letterSpacing: 1, color: "#8BF285" },
  itemName: { ...typography.packName, fontSize: 15, marginTop: 5 },
  itemMeta: { ...typography.footNote, marginTop: 3 },
  rowValue: { alignItems: "flex-end" },
  priceText: { ...typography.title, fontSize: 15, color: "#fff" },
  footer: { padding: 20, alignItems: "center" },
  footerHint: { ...typography.footNote },
});
