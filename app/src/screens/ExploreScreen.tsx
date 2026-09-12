import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { PackSku } from "@grailhaus/shared";
import { useSessionViewModel } from "../viewmodels/useSessionViewModel";
import { useExploreViewModel } from "../viewmodels/useExploreViewModel";
import { useDiscoverAllCategoriesViewModel, type DiscoverItem } from "../viewmodels/useDiscoverViewModel";
import { useCategoriesViewModel } from "../viewmodels/useCategoriesViewModel";
import { useAuthStore } from "../state/authStore";
import { PackTile, ART_GRADIENT, tierLabel, HERO_TIER } from "../components/PackTile";
import { PackFace } from "../components/PackFace";
import { CardFace } from "../components/CardFace";
import { WatchDial } from "../components/WatchDial";
import { itemArtGradient } from "../content/cardArt";
import { PACK_RENDER } from "../content/localArt";
import { Crown } from "../components/Crown";
import { useHideTabBarOnScroll } from "../navigation/tabBarVisibility";
import { fonts, ink, typography } from "../theme/tokens";
import { brand, explore as copy, packTile as packTileCopy } from "../content/copy";
import type { RootTabParamList } from "../navigation/RootTabs";
import type { AppStackParamList } from "../navigation/AppNavigator";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<AppStackParamList>,
  BottomTabNavigationProp<RootTabParamList>
>;

/**
 * Replaces the old idle "Reveal" tab (empty unless a purchase was already
 * in flight) with a real browse entry point: both categories' evergreen
 * catalog, straight off GET /packs, in one place. Both drill into their own
 * detail screen before a purchase — cards into PackDetail, watches into
 * VaultDetail — like Shelf's own tier rows already do.
 */
export function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const session = useSessionViewModel();
  const catalog = useExploreViewModel();
  const { categories } = useCategoriesViewModel();
  const discover = useDiscoverAllCategoriesViewModel();
  const requireAuth = useAuthStore((s) => s.requireAuth);
  const scrollHandler = useHideTabBarOnScroll();

  return (
    <View style={styles.fill}>
      <LinearGradient colors={["rgba(177,75,255,0.16)", "transparent"]} style={styles.base} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.brand}>
          <View style={styles.brandChip}>
            <Image source={require("../../assets/icon.png")} style={styles.brandIcon} />
          </View>
          <Text style={styles.brandText}>{brand.name}</Text>
        </View>
        {session.isSignedIn ? (
          session.balanceCents != null && (
            <View style={styles.balancePill}>
              <LinearGradient colors={["#FFE27A", "#E0A016"]} style={styles.coin} />
              <Text style={styles.balanceText}>{(session.balanceCents / 100).toLocaleString()}</Text>
            </View>
          )
        ) : (
          <Pressable style={styles.signInChip} onPress={() => requireAuth(() => {})}>
            <Text style={styles.signInText}>{copy.signIn}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.heading}>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.headingTitle}>{copy.heading}</Text>
        <Text style={styles.headingSub}>{copy.sub}</Text>
      </View>

      {catalog.error && <Text style={styles.error}>{copy.serverUnreachable(catalog.error)}</Text>}

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* One section per real category (not a hardcoded Cards/Watches pair) — cards keeps its
            own multi-pull TierRow treatment, every other category (watches, and anything added
            after, e.g. handbags) shares the single-box PackTile treatment, same fallback rule
            ShelfScreen's own pack list already uses. */}
        {categories.map((c) => {
          const skus = catalog.byCategory[c.id] ?? [];
          return (
            <Section key={c.id} title={c.label}>
              {skus.length > 0 ? (
                c.id === "cards" ? (
                  skus.map((sku) => (
                    <TierRow key={sku.id} sku={sku} onPress={() => navigation.navigate("PackDetail", { skuId: sku.id })} />
                  ))
                ) : (
                  skus.map((sku) => (
                    <PackTile key={sku.id} sku={sku} onBuy={() => navigation.navigate("VaultDetail", { skuId: sku.id })} />
                  ))
                )
              ) : !catalog.isLoading ? (
                <Text style={styles.empty}>{copy.emptySection(c.label)}</Text>
              ) : null}
            </Section>
          );
        })}

        {categories.map((c) => {
          const catalog = discover.byCategory[c.id];
          return (
            <Section key={c.id} title={copy.allOf(c.label, catalog?.items.length ?? 0)}>
              <CatalogGrid
                category={c.id}
                items={catalog?.items ?? []}
                isLoading={discover.isLoading}
                emptyLabel={copy.emptySection(c.label)}
                onPress={(item) => navigation.navigate("ItemFork", { category: c.id, item })}
              />
            </Section>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Same exact GrailhausPacks.js `.pack` box as Shelf's own cards TierRow, duplicated locally
 * rather than shared — this file's own row shows every tier across both categories at once, not
 * one category's own pick-your-tier list, but the visual language is identical. */
function TierRow({ sku, onPress }: { sku: PackSku; onPress: () => void }) {
  const art = ART_GRADIENT[sku.tier] ?? ART_GRADIENT.street_rip;
  const isHero = HERO_TIER.has(sku.tier);
  const render = PACK_RENDER[sku.tier];

  return (
    <View style={[styles.pack, isHero && styles.packPopular]}>
      {isHero && (
        <LinearGradient colors={["#3a1263", "#22093f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
          <Crown />
          <Text style={styles.badgeText}>{packTileCopy.mostPopular}</Text>
        </LinearGradient>
      )}

      {/* GrailhausPacks.js's own real per-tier render — falls back to PackFace's flat-gradient
          box for any tier with no render yet. */}
      <View style={styles.packImgWrap}>
        {render ? (
          <Image source={render} style={styles.packImg} resizeMode="contain" />
        ) : (
          <PackFace art={art} width={112} height={152} radius={10} />
        )}
      </View>

      <Pressable onPress={onPress} style={styles.packBody}>
        <View style={styles.packTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kicker}>{tierLabel(sku)}</Text>
            <Text style={styles.packName} numberOfLines={1}>
              {sku.name}
            </Text>
          </View>
          <View style={styles.circleBtn}>
            <Ionicons name="chevron-forward" size={12} color="#fff" />
          </View>
        </View>

        <View style={styles.packRow}>
          <View>
            <Text style={styles.count}>{packTileCopy.countLabel(sku.category, sku.itemCount).toUpperCase()}</Text>
            <Text style={styles.price}>${(sku.priceCents / 100).toLocaleString()}</Text>
            {sku.stockRemaining != null && <Text style={styles.left}>{sku.stockRemaining} left</Text>}
          </View>

          {/* Real rarity tiers this SKU draws from — admin-configured name + color. */}
          <View style={styles.tierGroup}>
            {sku.rarityTiers.map((t) => (
              <View key={t.level} style={styles.tierCol}>
                <LinearGradient
                  colors={[t.colorHex, darken(t.colorHex, 0.55)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.chip, { borderColor: `${t.colorHex}b0` }]}
                >
                  <Crown w={13} h={8} fill="#fff" />
                </LinearGradient>
                <Text style={styles.tierColLabel} numberOfLines={1}>
                  {t.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

/** The full individual-item catalog (every printing/model, not just the 3 buyable pack
 * tiers) — plain wrapped grid rather than a virtualized FlatList since every face here is a
 * cheap gradient, not an image; simplest thing that shows all of it. Browse-only: tapping
 * opens ItemFork (chase it in a pack vs. buy the exact one), same destination Discover's own
 * drill-down already uses — an individual card/watch isn't itself purchasable, only the pack
 * that can drop it is. */
function CatalogGrid({
  category,
  items,
  isLoading,
  emptyLabel,
  onPress,
}: {
  category: string;
  items: DiscoverItem[];
  isLoading: boolean;
  emptyLabel: string;
  onPress: (item: DiscoverItem) => void;
}) {
  if (items.length === 0) {
    return !isLoading ? <Text style={styles.empty}>{emptyLabel}</Text> : null;
  }
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <CatalogCell key={item.detail.id} category={category} item={item} onPress={() => onPress(item)} />
      ))}
    </View>
  );
}

function CatalogCell({
  category,
  item,
  onPress,
}: {
  category: string;
  item: DiscoverItem;
  onPress: () => void;
}) {
  const detail = item.detail;
  return (
    <Pressable onPress={onPress} style={styles.cell}>
      {/* Cards keeps its own rectangular card-face art; every other category shares the
          watch-dial treatment as a generic fallback — same rule as the rest of this pass. */}
      {category === "cards" ? (
        <CardFace gradient={itemArtGradient(detail)} imageUrl={detail.textureUrl} width={64} height={89} />
      ) : (
        <WatchDial art={itemArtGradient(detail)} size={64} />
      )}
      {/* Cards: lead with the Pokémon identity (what you're browsing for), the print name
          (cardTitle) is the secondary line — same split ItemFork's own heading/subheading use,
          just swapped since a printing name alone ("Black Forecast") isn't scannable without
          knowing which Pokémon it belongs to. Flat fallback chain (not a category check) for the
          primary line, so a category with neither pokemonName nor watchName (e.g. handbags)
          still shows its real catalog name instead of going blank. */}
      <Text style={styles.cellName} numberOfLines={1}>
        {detail.pokemonName ?? detail.watchName ?? detail.name}
      </Text>
      {category === "cards" && detail.cardTitle && (
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
  base: { position: "absolute", top: 0, left: 0, right: 0, height: 240 },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandChip: { width: 26, height: 26, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.14)" },
  brandIcon: { width: "100%", height: "100%" },
  brandText: typography.navBrand,
  balancePill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  coin: { width: 14, height: 14, borderRadius: 7 },
  balanceText: typography.countMain,
  signInChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(177,75,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  signInText: typography.chipLabel,
  heading: { paddingHorizontal: 20, paddingTop: 20 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.6, color: "rgba(255,255,255,0.55)" },
  headingTitle: { fontFamily: fonts.black, fontSize: 30, letterSpacing: -0.9, lineHeight: 32, color: ink.text, marginTop: 4 },
  headingSub: { ...typography.sectionSub, marginTop: 4 },
  scroll: { flex: 1 },
  list: { padding: 20, paddingTop: 16, gap: 28, paddingBottom: 40 },
  empty: { ...typography.sectionSub, textAlign: "center", marginTop: 12 },
  error: { ...typography.errorText, paddingHorizontal: 20, marginTop: 8 },

  section: { gap: 12 },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 15, letterSpacing: -0.2, color: ink.text },
  sectionBody: { gap: 16 },

  // Exact values from GrailhausPacks.js's own `.pack`/`.packImgWrap`/`.badge`/etc — same box
  // Shelf's own cards TierRow uses.
  pack: {
    minHeight: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  packPopular: {
    borderColor: "#a855f7",
    backgroundColor: "rgba(40,16,66,0.9)",
    shadowColor: "#a855f7",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  packImgWrap: { position: "absolute", left: -4, top: -10, bottom: -10, width: 150, borderRadius: 10, overflow: "hidden" },
  packImg: { width: "100%", height: "100%" },
  packBody: { flex: 1, paddingLeft: 158, paddingRight: 10, paddingTop: 14, paddingBottom: 16 },
  badge: {
    position: "absolute",
    right: -8,
    top: -15,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b26bf5",
    zIndex: 2,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  packTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  kicker: { fontSize: 10, fontWeight: "700", letterSpacing: 2.6, color: "rgba(255,255,255,0.55)" },
  packName: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 4, letterSpacing: -0.4 },
  circleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  packRow: { flexDirection: "row", alignItems: "flex-end", gap: 7, marginTop: 6 },
  count: { fontSize: 10, fontWeight: "700", letterSpacing: 2, color: "rgba(255,255,255,0.5)" },
  price: { fontSize: 23, fontWeight: "800", color: "#fff", marginTop: 4, letterSpacing: -0.5 },
  left: { fontSize: 12.5, color: "rgba(255,255,255,0.6)", marginTop: 5 },
  tierGroup: { flexDirection: "row", gap: 2, paddingBottom: 2, marginLeft: "auto" },
  tierCol: { alignItems: "center", gap: 5, width: 30 },
  chip: { width: 18, height: 25, borderRadius: 5, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tierColLabel: { fontSize: 7, fontWeight: "800", letterSpacing: 0.4, color: "rgba(255,255,255,0.72)" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: {
    width: 92,
    padding: 8,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cellName: { fontFamily: fonts.semibold, fontSize: 10.5, color: ink.text, marginTop: 7, textAlign: "center" },
  cellSub: { fontFamily: fonts.medium, fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 1, textAlign: "center" },
  cellPrice: { fontFamily: fonts.bold, fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 3 },
});
