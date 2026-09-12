import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp, type CompositeNavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Category, PackSku } from "@grailhaus/shared";
import { useSessionViewModel } from "../viewmodels/useSessionViewModel";
import { useShelfViewModel } from "../viewmodels/useShelfViewModel";
import { useCategoriesViewModel } from "../viewmodels/useCategoriesViewModel";
import { useAuthStore } from "../state/authStore";
import { PackTile, ART_GRADIENT, tierLabel, HERO_TIER } from "../components/PackTile";
import { PackFace } from "../components/PackFace";
import { CategorySwitch } from "../components/CategorySwitch";
import { Crown } from "../components/Crown";
import { PACK_RENDER } from "../content/localArt";
import { useHideTabBarOnScroll, useTabBarClearance } from "../navigation/tabBarVisibility";
import { fonts, ink, typography } from "../theme/tokens";
import { brand, shelf as shelfCopy, packTile as packTileCopy } from "../content/copy";
import type { RootTabParamList } from "../navigation/RootTabs";
import type { HomeStackParamList } from "../navigation/HomeStack";
import type { AppStackParamList } from "../navigation/AppNavigator";

// Cards gets its own multi-pull TierRow treatment below; every other category (watches, and
// anything added after, e.g. handbags) shares the single-box PackTile treatment — same fallback
// rule the Home doors and their accent colors already use. A category with no dedicated entry
// here just reuses watches' wash color rather than crashing on an undefined lookup.
const REGISTER: Partial<Record<Category, { label: string; wash: [string, string] }>> = {
  cards: { label: shelfCopy.categoryLabel.cards, wash: ["rgba(177,75,255,0.24)", "transparent"] },
  watches: { label: shelfCopy.categoryLabel.watches, wash: ["rgba(242,196,107,0.2)", "transparent"] },
};

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<AppStackParamList>,
  CompositeNavigationProp<
    NativeStackNavigationProp<HomeStackParamList, "World">,
    BottomTabNavigationProp<RootTabParamList>
  >
>;

/**
 * "World" — a single category's shelf, reached through a door on Home or
 * flipped in place with the Cards/Watches switch (per the final "full app"
 * mockup pass, which puts the switch on the shelf itself rather than only
 * on Home's doors). Switching calls `setParams` rather than pushing a new
 * route, so there's still exactly one World screen on the stack. View only:
 * no fetch calls, no business logic — everything comes from the viewmodels
 * below. Both categories drill into their own detail screen from here now —
 * cards into PackDetail, watches into VaultDetail — neither buys straight
 * off this list.
 */
export function ShelfScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { category } = useRoute<RouteProp<HomeStackParamList, "World">>().params;
  const session = useSessionViewModel();
  const shelf = useShelfViewModel(category);
  const { byId: categoriesById } = useCategoriesViewModel();
  const requireAuth = useAuthStore((s) => s.requireAuth);
  const scrollHandler = useHideTabBarOnScroll();
  const tabBarClearance = useTabBarClearance();

  // Wash color is a cosmetic fallback (any category past cards/watches shares watches' wash);
  // the label itself always comes from the category's own admin-configured label, never the
  // hardcoded copy map, so a new category shows its real name instead of "Watches".
  const register = REGISTER[category] ?? REGISTER.watches!;
  const categoryLabel = categoriesById.get(category)?.label ?? register.label;

  const priceRange = useMemo(() => {
    if (shelf.packs.length === 0) return null;
    const prices = shelf.packs.map((p) => p.priceCents).sort((a, b) => a - b);
    return { min: prices[0], max: prices[prices.length - 1] };
  }, [shelf.packs]);

  return (
    <View style={styles.fill}>
      {/* Bounded to the fixed header+heading area (never scrolls) rather than the whole screen
          — a full-screen wash here would stay pinned behind the scrolled tier cards too. */}
      <LinearGradient colors={register.wash} style={styles.base} />

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
            <Text style={styles.signInText}>{shelfCopy.signIn}</Text>
          </Pressable>
        )}
      </View>

      <CategorySwitch value={category} onChange={(next) => navigation.setParams({ category: next })} />

      <View style={styles.heading}>
        {category === "cards" ? (
          <>
            <Text style={styles.eyebrow}>{shelfCopy.explorePacks.eyebrow}</Text>
            <Text style={styles.headingTitle}>{shelfCopy.explorePacks.heading}</Text>
            <Text style={styles.headingSub}>{shelfCopy.explorePacks.sub}</Text>
          </>
        ) : (
          <>
            <Text style={styles.headingTitle}>{categoryLabel}</Text>
            <Text style={styles.headingSub}>
              {priceRange
                ? shelfCopy.priceRangeSub(
                    (priceRange.min / 100).toLocaleString(),
                    (priceRange.max / 100).toLocaleString()
                  )
                : " "}
            </Text>
          </>
        )}
      </View>

      {shelf.error && <Text style={styles.error}>{shelfCopy.serverUnreachable(shelf.error)}</Text>}

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance }]}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {category === "cards"
          ? shelf.packs.map((sku) => (
              <TierRow key={sku.id} sku={sku} onPress={() => navigation.navigate("PackDetail", { skuId: sku.id })} />
            ))
          : shelf.packs.map((sku) => (
              <PackTile key={sku.id} sku={sku} onBuy={() => navigation.navigate("VaultDetail", { skuId: sku.id })} />
            ))}
        {!shelf.isLoading && shelf.packs.length === 0 && <Text style={styles.empty}>{shelfCopy.emptyPacks}</Text>}

        {category === "cards" && shelf.packs.length > 0 && (
          <>
            {/* Exact styling of GrailhausPacks.js's own `.odds` banner. */}
            <View style={styles.odds}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#d9ab52" />
              <Text style={styles.oddsText}>{shelfCopy.explorePacks.trustNote}</Text>
              <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.5)" />
            </View>
            <Pressable onPress={() => navigation.navigate("Portfolio")}>
              <Text style={styles.collectionLink}>{shelfCopy.explorePacks.collectionLink}</Text>
            </Pressable>
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

/** One row in "Pick your tier" — the middle (hero) tier gets a highlighted
 * border/shadow and a floating "MOST OPENED" tag, per the mockup. */
/** GrailhausPacks.js's own crown-chip tier swatch — one per real `sku.rarityTiers` entry
 * (admin-configured name + color), not the reference's hardcoded CORE/PRIME/GRAIL array. A
 * two-stop gradient synthesized from the tier's single stored color the same way
 * CategorySwitch's own `darken()` already does, so a chip reads as a lit surface rather than a
 * flat color swatch — matching the reference's own two-stop `bg` per tier. */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function TierRow({ sku, onPress }: { sku: PackSku; onPress: () => void }) {
  const isFeatured = HERO_TIER.has(sku.tier);
  const render = PACK_RENDER[sku.tier];
  const art = ART_GRADIENT[sku.tier] ?? ART_GRADIENT.street_rip;

  return (
    <View style={[styles.pack, isFeatured && styles.packPopular]}>
      {isFeatured && (
        <LinearGradient colors={["#3a1263", "#22093f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
          <Crown />
          <Text style={styles.badgeText}>{shelfCopy.explorePacks.mostOpened}</Text>
        </LinearGradient>
      )}

      {/* GrailhausPacks.js's own real pack render, bled off the row's left/top/bottom edges at
          full size (`contain`, not cropped) — falls back to PackFace's flat-gradient box for any
          tier with no render yet (a category added later, e.g. handbags). */}
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
            {sku.stockRemaining != null && (
              <Text style={styles.left}>
                {sku.stockRemaining} {shelfCopy.explorePacks.leftSuffix}
              </Text>
            )}
          </View>

          {/* Real rarity tiers this SKU actually draws from — admin-configured name + color. */}
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
  list: { padding: 20, paddingTop: 16, gap: 16, paddingBottom: 40 },
  empty: { ...typography.sectionSub, textAlign: "center", marginTop: 32 },
  error: {
    ...typography.errorText,
    paddingHorizontal: 20,
    marginTop: 8,
  },

  // Exact values from GrailhausPacks.js's own `.pack`/`.packImgWrap`/`.badge`/etc — real sku data
  // fills every field, but the box itself is the reference's, not a reinterpretation of it.
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

  odds: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(216,170,60,0.28)",
    backgroundColor: "rgba(255,255,255,0.03)",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
  },
  oddsText: { flex: 1, fontSize: 12.5, color: "rgba(255,255,255,0.82)" },
  collectionLink: {
    ...typography.linkMuted,
    color: "#C99BFF",
    textAlign: "center",
    marginTop: 4,
  },
});
