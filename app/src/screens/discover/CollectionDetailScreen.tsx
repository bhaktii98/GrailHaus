import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type CompositeNavigationProp, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CardFace } from "../../components/CardFace";
import { WatchDial } from "../../components/WatchDial";
import { itemArtGradient } from "../../content/cardArt";
import type { DiscoverItem } from "../../viewmodels/useDiscoverViewModel";
import { useTabBarClearance } from "../../navigation/tabBarVisibility";
import { fonts, ink, typography } from "../../theme/tokens";
import { discoverCategory as copy } from "../../content/copy";
import type { DiscoverStackParamList } from "../../navigation/DiscoverStack";
import type { AppStackParamList } from "../../navigation/AppNavigator";

// ItemFork lives on the root stack (see AppNavigator), not DiscoverStack — same cross-stack
// jump DiscoverCategoryScreen already makes.
type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<AppStackParamList>,
  NativeStackNavigationProp<DiscoverStackParamList, "CollectionDetail">
>;
type Route = RouteProp<DiscoverStackParamList, "CollectionDetail">;

/**
 * Generic "here's a flat list of catalog items" screen — reused by both the Discover hub's
 * cross-category Collections door and each category hub's own "Collections" facet
 * (DiscoverCategoryScreen), so a card-and-watch-mixed collection and a single-category one
 * render identically. Items go straight to ItemFork — a collection groups already-specific
 * printings/models, not identities that still need a Versions-style disambiguation step.
 */
export function CollectionDetailScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { title, items } = useRoute<Route>().params;
  const tabBarClearance = useTabBarClearance();

  return (
    <View style={styles.fill}>
      <LinearGradient colors={["rgba(255,255,255,0.06)", "transparent"]} style={styles.base} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerLabel} numberOfLines={1}>
          {title.toUpperCase()}
        </Text>
        <View style={{ width: 36 }} />
      </View>
      <Text style={styles.subLabel}>{copy.itemCount(items.length)}</Text>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabBarClearance }]} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {items.map((item) => (
            <Cell key={item.detail.id} item={item} onPress={() => navigation.navigate("ItemFork", { category: item.detail.category, item })} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Cell({ item, onPress }: { item: DiscoverItem; onPress: () => void }) {
  const detail = item.detail;
  // Cards keeps its own rectangular card-face art; everything else shares the watch-dial
  // treatment as a generic fallback — same rule as the rest of this pass.
  const isCards = detail.category === "cards";

  return (
    <Pressable onPress={onPress} style={styles.cell}>
      {isCards ? (
        <CardFace gradient={itemArtGradient(detail)} imageUrl={detail.textureUrl} width={64} height={89} />
      ) : (
        <WatchDial art={itemArtGradient(detail)} imageUrl={detail.textureUrl} size={64} />
      )}
      {/* Flat fallback chain instead of a category check — exactly one of pokemonName/watchName
          is ever set per real item, and both fall through to the generic catalog name for a
          category with neither (e.g. handbags). */}
      <Text style={styles.cellName} numberOfLines={1}>
        {detail.pokemonName ?? detail.watchName ?? detail.name}
      </Text>
      {detail.cardTitle && (
        <Text style={styles.cellSub} numberOfLines={1}>
          {detail.cardTitle}
        </Text>
      )}
      <Text style={styles.cellPrice}>${(detail.currentValueCents / 100).toLocaleString()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: ink.groundDeep },
  base: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    flexShrink: 0,
  },
  headerLabel: { ...typography.eyebrow, letterSpacing: 2, flex: 1 },
  subLabel: { ...typography.metaLine, paddingHorizontal: 20, paddingTop: 14 },
  scroll: { padding: 20, paddingTop: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: {
    width: 92,
    padding: 8,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cellName: { fontFamily: fonts.semibold, fontSize: 10.5, color: ink.text, marginTop: 7, textAlign: "center" },
  cellSub: { fontFamily: fonts.medium, fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 1, textAlign: "center" },
  cellPrice: { fontFamily: fonts.bold, fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 3 },
});
