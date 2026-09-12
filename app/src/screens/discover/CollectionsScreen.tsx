import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CardFace } from "../../components/CardFace";
import { WatchDial } from "../../components/WatchDial";
import { itemArtGradient } from "../../content/cardArt";
import { useCollectionsViewModel, type CatalogCollectionGroup } from "../../viewmodels/useCollectionsViewModel";
import { useTabBarClearance } from "../../navigation/tabBarVisibility";
import { colors, ink, typography } from "../../theme/tokens";
import { collections as copy, discoverCategory as categoryCopy } from "../../content/copy";
import type { DiscoverStackParamList } from "../../navigation/DiscoverStack";

type Nav = NativeStackNavigationProp<DiscoverStackParamList, "Collections">;

// Cosmetic capitalization for the two known categories — any category not listed here (e.g. one
// added via the admin dashboard) falls back to its raw id at the call site below rather than
// crashing or showing "undefined".
const CATEGORY_LABEL: Record<string, string> = { cards: "Cards", watches: "Watches" };

/**
 * The Discover hub's third door — every named collection across both worlds, not filtered to
 * one category. Built from `useCollectionsViewModel`, which is itself just the same two
 * `useDiscoverViewModel("cards")`/`("watches")` calls Explore already makes, regrouped by the
 * catalog's real `collection` field instead of by Pokémon/brand identity.
 */
export function CollectionsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const vm = useCollectionsViewModel();
  const tabBarClearance = useTabBarClearance();

  return (
    <View style={styles.fill}>
      <LinearGradient colors={["rgba(255,255,255,0.06)", "transparent"]} style={styles.base} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerLabel}>{copy.title.toUpperCase()}</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text style={styles.body}>{copy.body}</Text>

      {vm.isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.textSecondary} />
      ) : (
        <FlatList
          data={vm.groups}
          keyExtractor={(g: CatalogCollectionGroup) => g.key}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance }]}
          ListEmptyComponent={<Text style={styles.empty}>{copy.empty}</Text>}
          renderItem={({ item: group }: { item: CatalogCollectionGroup }) => {
            const primary = group.items[0];
            // Cards keeps its own rectangular card-face art; everything else (watches, and any
            // category added after, e.g. handbags) shares the watch-dial treatment as a generic
            // fallback — same rule as the rest of this pass (see ShelfScreen/HomeScreen).
            const isCards = primary.detail.category === "cards";
            return (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate("CollectionDetail", { title: group.label, items: group.items })}
              >
                {isCards ? (
                  <CardFace gradient={itemArtGradient(primary.detail)} imageUrl={primary.detail.textureUrl} width={44} height={61} />
                ) : (
                  <WatchDial art={itemArtGradient(primary.detail)} imageUrl={primary.detail.textureUrl} size={52} />
                )}
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {group.label}
                  </Text>
                  <Text style={styles.rowSub}>
                    {categoryCopy.itemCount(group.items.length)} · {copy.categoriesLabel(group.categories.map((c) => CATEGORY_LABEL[c] ?? c))}
                  </Text>
                </View>
                <View style={styles.rowValue}>
                  <Text style={styles.priceText}>
                    {categoryCopy.priceRange(group.minValueCents, group.maxValueCents)}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
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
  body: { ...typography.sectionSub, paddingHorizontal: 20, paddingTop: 14 },
  loading: { marginTop: 60 },
  list: { padding: 20, paddingTop: 13, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { ...typography.packName, fontSize: 15 },
  rowSub: { ...typography.footNote, marginTop: 3 },
  rowValue: { alignItems: "flex-end" },
  priceText: { ...typography.title, fontSize: 14, color: "#fff" },
  empty: { ...typography.sectionSub, textAlign: "center", marginTop: 60 },
});
