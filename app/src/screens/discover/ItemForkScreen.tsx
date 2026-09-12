import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CardFace } from "../../components/CardFace";
import { WatchDial } from "../../components/WatchDial";
import { itemArtGradient } from "../../content/cardArt";
import { marketplaceService } from "../../services/marketplaceService";
import { useRarityTiers } from "../../viewmodels/useRarityTiers";
import { useActionBarPadding } from "../../navigation/tabBarVisibility";
import { colors, ink, typography } from "../../theme/tokens";
import { itemFork as copy, itemDetail as itemDetailCopy } from "../../content/copy";
import type { AppStackParamList } from "../../navigation/AppNavigator";

type Nav = NativeStackNavigationProp<AppStackParamList, "ItemFork">;
type Route = RouteProp<AppStackParamList, "ItemFork">;

/** Same split rule as Portfolio's CardDetailScreen — traits come off the catalog as a
 * bullet-separated string ("Rookie Icon • Bright Pull • Spark"), not comma-separated. */
function splitTraits(traits: string | null): string[] {
  if (!traits) return [];
  return traits
    .split(/[•,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** The honest fork the whole Discover journey is built around (mockup 18a/18b): every catalog
 * item ends in one decision, priced against each other with real numbers — chase it in the
 * pack that can drop it, or buy the exact one from someone who already pulled it. */
export function ItemForkScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { category, item } = useRoute<Route>().params;
  const { detail } = item;
  // Two different questions, kept as two different booleans: `isWatch` gates the watches-only
  // spec block below (a category that's neither cards nor watches correctly gets no flavor block
  // at all, same as cards already does here — see the `specs` memo), while `isCards` is purely
  // the visual-register choice (wash color, icon shape) — cards is the one with its own bespoke
  // treatment, everything else (watches, and anything added after, e.g. handbags) shares the
  // other register, same fallback rule ShelfScreen/HomeScreen already use.
  const isWatch = category === "watches";
  const isCards = category === "cards";
  const actionBarPadding = useActionBarPadding();

  const listingsQuery = useQuery({
    queryKey: ["listings", category],
    queryFn: () => marketplaceService.browse(category),
  });

  const matchingListing = useMemo(
    () => (listingsQuery.data ?? []).find((l) => l.item.id === detail.id) ?? null,
    [listingsQuery.data, detail.id]
  );

  // Admin-configurable (rarity_tiers table) — never a hardcoded name/color map, so a rename
  // from the admin dashboard's Rarity Tiers page shows up here immediately, same as everywhere
  // else in the app that reads real tier data (see RarityBadge.tsx).
  const rarityTiers = useRarityTiers(category);
  const rarityTier = rarityTiers[detail.rarityTierLevel];
  const rarityName = rarityTier?.name ?? "";
  const traits = useMemo(() => splitTraits(detail.traits), [detail.traits]);
  const specs = useMemo<[string, string][]>(
    () =>
      isWatch
        ? ([
            // `watchName` ("Royal Oak") and `modelName` ("Perpetual Calendar") are two distinct
            // real catalog fields, not a fallback chain — see WatchDetailScreen for the same fix.
            detail.watchName ? ["Model", detail.watchName] : ["Model", detail.name],
            detail.modelName ? ["Edition", detail.modelName] : null,
            detail.style ? ["Style", detail.style] : null,
            detail.caseMaterial ? ["Case material", detail.caseMaterial] : null,
            detail.dialColor ? ["Dial color", detail.dialColor] : null,
            detail.movement ? ["Movement", detail.movement] : null,
            detail.caseSize ? ["Case size", detail.caseSize] : null,
          ].filter((s): s is [string, string] => s != null))
        : [],
    [isWatch, detail]
  );

  // ItemFork lives on the root stack (see AppNavigator) so both Discover and Explore can reach
  // it, but "buy exact"/"try your luck" land inside a *tab's own* nested stack (Marketplace's
  // ListingDetail, Home's World) — two levels down through "Tabs", which isn't expressible in
  // AppStackParamList's types (it only declares "Tabs" itself, not each tab's nested screens),
  // so this jump is deliberately loosely typed.
  const rootNavigate = navigation.navigate as (name: string, params?: object) => void;

  function handleBuyExact() {
    if (matchingListing) {
      rootNavigate("Tabs", {
        screen: "Marketplace",
        params: { screen: "ListingDetail", params: { listing: matchingListing } },
      });
    } else {
      rootNavigate("Tabs", { screen: "Marketplace" });
    }
  }

  function handleTryLuck() {
    rootNavigate("Tabs", { screen: "Home", params: { screen: "World", params: { category } } });
  }

  return (
    <View style={styles.fill}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 140 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Wash lives in content coordinates, not as a screen-fixed sibling — a fixed wash
            would stay pinned to the viewport as the header/hero scroll away, bleeding into
            whatever section (value, fork options) scrolls into that same screen region. */}
        <View style={styles.washWrap}>
          <LinearGradient
            colors={[isCards ? "rgba(177,75,255,0.24)" : "rgba(242,196,107,0.2)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </Pressable>
            <Text style={styles.headerLabel}>{rarityName.toUpperCase()} VERSION</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.heroRow}>
            {isCards ? (
              <CardFace gradient={itemArtGradient(detail)} imageUrl={detail.textureUrl} width={124} height={173} borderColor="rgba(255,215,94,0.78)" />
            ) : (
              <WatchDial art={itemArtGradient(detail)} imageUrl={detail.textureUrl} size={124} />
            )}
            <View style={styles.heroInfo}>
              <Text style={styles.name}>{(detail.cardTitle ?? detail.watchName ?? detail.name).toUpperCase()}</Text>
              <Text style={styles.subName}>
                {[detail.pokemonName ?? detail.brand, rarityName].filter(Boolean).join(" · ")}
              </Text>

              <View style={styles.specRows}>
                <SpecRow label={copy.rarity} value={rarityName} valueColor={rarityTier?.colorHex ?? colors.goldTop} />
                <SpecRow label={copy.collectionLabel} value={detail.collection ?? detail.brand ?? "—"} />
                <SpecRow label={copy.youOwn} value={item.ownedCount > 0 ? String(item.ownedCount) : copy.none} />
              </View>
            </View>
          </View>
        </View>

        {specs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{itemDetailCopy.specifications}</Text>
            <View style={styles.specList}>
              {specs.map(([label, value]) => (
                <SpecRow key={label} label={label} value={value} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.valueCard}>
            <Text style={styles.sectionLabel}>{copy.estimatedValue}</Text>
            <Text style={styles.valueBig}>${(detail.currentValueCents / 100).toLocaleString()}</Text>
          </View>
        </View>

        {traits.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{itemDetailCopy.traits}</Text>
            <View style={styles.traitRow}>
              {traits.map((t) => (
                <View key={t} style={styles.traitChip}>
                  <Text style={styles.traitText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* `tagline` is a generic catalog field (see shared/src/types.ts's `ItemDetail`), not a
            watches-only one — WatchDetailScreen already shows it unconditionally, so this no
            longer gates on category either, otherwise a real tagline on a cards or handbags item
            would never render. */}
        {detail.tagline && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{copy.collectorStory}</Text>
            <Text style={styles.tagline}>{detail.tagline}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{copy.availability}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.listedNow}</Text>
              <Text style={styles.statValue}>{item.listedCount}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{copy.packPrice}</Text>
              <Text style={styles.statValue}>${(item.packPriceCents / 100).toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: actionBarPadding }]}>
        <Text style={styles.howTitle}>{copy.howToGet}</Text>
        <View style={styles.forkRow}>
          <Pressable style={[styles.forkButton, styles.forkLuck]} onPress={handleTryLuck}>
            <Text style={styles.forkLabel}>{copy.tryYourLuck}</Text>
            <Text style={styles.forkSub}>{copy.fromPack(item.packName)}</Text>
          </Pressable>
          <Pressable style={[styles.forkButton, styles.forkBuy]} onPress={handleBuyExact}>
            <Text style={[styles.forkLabel, styles.forkLabelDark]}>{copy.buyExact}</Text>
            <Text style={[styles.forkSub, styles.forkSubDark]}>
              {matchingListing ? copy.listingsFrom(item.listedCount, matchingListing.priceCents) : copy.noListings}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SpecRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.specRow}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={[styles.specValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: ink.groundDeep },
  scroll: { paddingBottom: 20 },
  washWrap: { position: "relative" },
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
  headerLabel: { ...typography.eyebrow, letterSpacing: 2.4, color: colors.goldTop },
  heroRow: { flexDirection: "row", gap: 15, paddingHorizontal: 20, paddingTop: 16, alignItems: "flex-start" },
  heroInfo: { flex: 1, minWidth: 0 },
  name: { ...typography.pageHeading, fontSize: 23 },
  subName: { ...typography.sectionSub, marginTop: 5 },
  specRows: { marginTop: 12, gap: 7 },
  specRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  specLabel: { ...typography.metaLine, fontSize: 10, color: "rgba(255,255,255,0.62)" },
  specValue: { ...typography.metaLine, fontSize: 11, color: "#fff" },
  section: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: typography.eyebrow,
  specList: { marginTop: 11, gap: 8 },
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
  tagline: {
    fontStyle: "italic",
    fontSize: 13,
    lineHeight: 21,
    color: "rgba(255,255,255,0.66)",
    marginTop: 9,
  },
  valueCard: {
    padding: 15,
    borderRadius: 18,
    backgroundColor: "rgba(255,215,94,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,215,94,0.36)",
  },
  valueBig: { ...typography.heroWordmark, fontSize: 30, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 9, marginTop: 11 },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  statLabel: { fontSize: 9, fontWeight: "600" as const, letterSpacing: 1.3, color: "rgba(255,255,255,0.62)" },
  statValue: { ...typography.title, fontSize: 19, marginTop: 3, color: "#fff" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundColor: ink.groundDeep,
  },
  howTitle: { ...typography.chipLabel, fontSize: 15, marginBottom: 11 },
  forkRow: { flexDirection: "row", gap: 10 },
  forkButton: {
    flex: 1,
    height: 64,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.26)",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  forkLuck: { backgroundColor: colors.violetTop },
  forkBuy: { backgroundColor: colors.goldTop },
  forkLabel: { ...typography.chipLabel, fontSize: 12.5, color: "#fff" },
  forkLabelDark: { color: "#2A1706" },
  forkSub: { fontSize: 10, fontWeight: "600" as const, color: "rgba(255,255,255,0.78)" },
  forkSubDark: { color: "rgba(42,23,6,0.75)" },
});
