import { useState } from "react";
import { Image, Pressable, RefreshControl, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHideTabBarOnScroll, useTabBarClearance } from "../../navigation/tabBarVisibility";
import { useSessionViewModel } from "../../viewmodels/useSessionViewModel";
import { useDiscoverHubViewModel } from "../../viewmodels/useDiscoverHubViewModel";
import { useCollectionsViewModel } from "../../viewmodels/useCollectionsViewModel";
import { useManualRefresh } from "../../hooks/useManualRefresh";
import { colors, fonts, ink, typography } from "../../theme/tokens";
import { discover as copy } from "../../content/copy";
import type { DiscoverStackParamList } from "../../navigation/DiscoverStack";

type Nav = NativeStackNavigationProp<DiscoverStackParamList, "Discover">;

/**
 * Reference door art from GrailhausDiscover.js's `IMAGES` table — placeholder-only, NOT cleared
 * for release. The Collections and Trading Cards images both include a small Pokémon card
 * (Pikachu) rendering, and Collections also shows a real Nike swoosh on a sneaker — both real
 * third-party trademarks this app has no license for; the Watches/Handbags renders visually echo
 * a Rolex Daytona and a Hermès Birkin's trade dress closely enough to carry the same risk even
 * without literal logos/text visible. Same call as Home's `heroArt`/`cardArt`/`watchArt`: wired in
 * now to see the full visual, needs real commissioned/licensed art (or a plain gradient fallback)
 * before any real release.
 */
const doorArt: Record<string, number> = {
  cards: require("../../../assets/discover-cards.png"),
  watches: require("../../../assets/discover-watches.png"),
  handbags: require("../../../assets/discover-handbags.png"),
};
const collectionsArt = require("../../../assets/discover-collections.png");

/** Darkens a `#rrggbb` hex color toward black by `amount` (0-1) — same helper as
 * CategorySwitch.tsx, used here to synthesize each door's two-stop gradient from a category's
 * single admin-configured accent color. Still the fallback for any category not named in
 * `DOOR_STYLE` below (e.g. one added via the admin dashboard tomorrow) — that one keeps
 * generalizing from the category's own `paletteAccent`, same as before this pass. */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Exact per-door colors from GrailhausDiscover.js's own `ROWS` table — cards and watches share
 * the same warm gold register there (unlike Home's own doors, which split cards=violet/
 * watches=gold from theme/tokens.ts's `accents`), and handbags gets its own coral/salmon tone.
 * Deliberately hardcoded by known category id rather than derived from each category's
 * admin-configurable `paletteAccent` — the user asked for this exact palette, not the generic
 * one — but any category NOT in this table (added later, e.g. via the admin dashboard) still
 * falls back to deriving its two-stop gradient from its own `paletteAccent` via `darken()`, so
 * this doesn't regress the "a new category needs no app change" guarantee for anything unknown.
 */
const DOOR_STYLE: Record<
  string,
  { bg: [string, string]; border: string; kickerColor: string; accent: string }
> = {
  cards: { bg: ["#241804", "#120a02"], border: "rgba(216,170,60,0.55)", kickerColor: "#e0b34a", accent: "#e8bb4e" },
  watches: { bg: ["#1f1603", "#0f0902"], border: "rgba(216,170,60,0.5)", kickerColor: "#e0b34a", accent: "#f0c247" },
  handbags: { bg: ["#2a1209", "#150803"], border: "rgba(226,140,105,0.45)", kickerColor: "#e79a78", accent: "#f0a988" },
};
const COLLECTIONS_STYLE = {
  bg: ["#2b0f52", "#160727"] as [string, string],
  border: "rgba(168,85,247,0.5)",
  kickerColor: "#c9a3ff",
  accent: "#c084fc",
};

/**
 * Discover is the surface where every category sits side by side (mockup 17a's cards/watches
 * pairing, generalized) — one shared neutral dark field, every world as equals. Real counts
 * throughout: item and tier counts come straight off `/packs`, "listed now" off `/listings`.
 * One door per category in the categories table (useDiscoverHubViewModel), not a hardcoded
 * cards/watches pair — a category added via the admin dashboard gets its own door here with no
 * app change.
 */
export function DiscoverScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const session = useSessionViewModel();
  const hub = useDiscoverHubViewModel();
  const collections = useCollectionsViewModel();
  const { isRefreshing, refresh } = useManualRefresh(() => Promise.all([hub.refetch(), collections.refetch()]));
  const scrollHandler = useHideTabBarOnScroll();
  const tabBarClearance = useTabBarClearance();
  // Sticky header: pinned outside the scroll content via `headerOverlay`'s own position:absolute,
  // so it never scrolls away with it, and — unlike the floating pill tab bar — always visible
  // regardless of scroll direction, not tied to the shared tab-bar hide/show value.
  const [headerHeight, setHeaderHeight] = useState(insets.top + 58);
  function handleHeaderLayout(e: LayoutChangeEvent) {
    setHeaderHeight(e.nativeEvent.layout.height);
  }

  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={["rgba(255,255,255,0.06)", "#08040F", "#020101"]}
        locations={[0, 0.36, 1]}
        style={styles.base}
      />
      {/* Opaque strip behind the true status bar (battery/clock) row — see HomeScreen's own
          statusBarCover comment for why this can't just be part of the transparent header. */}
      <View pointerEvents="none" style={[styles.statusBarCover, { height: insets.top }]} />

      <Animated.View
        onLayout={handleHeaderLayout}
        pointerEvents="box-none"
        style={[styles.header, styles.headerOverlay, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.brandRow}>
          <Image source={require("../../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{copy.title}</Text>
        </View>
        {session.balanceCents != null && (
          <View style={styles.balancePill}>
            <LinearGradient colors={["#ffeaa0", "#d79b21", "#96650d"]} style={styles.coin} />
            <Text style={styles.balanceText}>{(session.balanceCents / 100).toLocaleString()}</Text>
          </View>
        )}
      </Animated.View>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: tabBarClearance }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.violetTop} colors={[colors.violetTop]} progressBackgroundColor={ink.ground} />}
      >
      <Text style={styles.headline}>
        {copy.headlineLead}
        <Text style={styles.headlineAccent}>{copy.headlineAccent}</Text>
      </Text>
      <Text style={styles.body}>{copy.body}</Text>

      {/* Lands on Cards' own real search (TextInput, filters by name/set) with the keyboard
          already up, rather than pretending to search from here — this bar has no query of its
          own to run across both categories at once. */}
      <Pressable
        style={styles.searchBar}
        onPress={() => navigation.navigate("DiscoverCategory", { category: "cards", autoFocusSearch: true })}
      >
        <Ionicons name="search" size={15} color="rgba(255,255,255,0.55)" />
        <Text style={styles.searchPlaceholder}>{copy.searchPlaceholder}</Text>
      </Pressable>

      <View style={styles.doors}>
        {hub.byCategory.map((c) => {
          const known = DOOR_STYLE[c.categoryId];
          const bg: [string, string] = known?.bg ?? [c.paletteAccent, darken(c.paletteAccent, 0.55)];
          const border = known?.border ?? `${c.paletteAccent}80`;
          const kickerColor = known?.kickerColor ?? c.paletteAccent;
          const accent = known?.accent ?? c.paletteAccent;
          const art = doorArt[c.categoryId];
          return (
            <Pressable
              key={c.categoryId}
              style={styles.door}
              onPress={() => navigation.navigate("DiscoverCategory", { category: c.categoryId })}
            >
              <LinearGradient colors={bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={[styles.doorBorder, { borderColor: border }]} />
              <Text style={[styles.doorEyebrow, { color: kickerColor }]}>{c.label.toUpperCase()}</Text>
              <Text style={styles.doorTitle}>
                {c.label}
                {"\n"}
                <Text style={{ color: accent }}>Discovery</Text>
              </Text>
              <Text style={styles.doorSummary}>{copy.doorSummary(c.itemCount, c.tierCount, c.listedNow)}</Text>
              <Text style={styles.doorBlurb}>{copy.doorBlurb[c.categoryId] ?? copy.doorBlurbFallback}</Text>
              {/* Bounded corner thumbnail, not a full-bleed panel — sized to the source art's own
                  ratio so `cover` shows the whole picture with no crop, small enough to sit clear
                  of the row's text. */}
              {art && (
                <View style={[styles.doorPhoto, { borderColor: border }]}>
                  <Image source={art} style={styles.doorPhotoImg} resizeMode="cover" />
                </View>
              )}
            </Pressable>
          );
        })}

        <Pressable style={styles.door} onPress={() => navigation.navigate("Collections")}>
          <LinearGradient
            colors={COLLECTIONS_STYLE.bg}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.doorBorder, { borderColor: COLLECTIONS_STYLE.border }]} />
          <Text style={[styles.doorEyebrow, { color: COLLECTIONS_STYLE.kickerColor }]}>
            {copy.collectionsDoor.eyebrow}
          </Text>
          <Text style={styles.doorTitle}>{copy.collectionsDoor.title}</Text>
          <Text style={styles.doorSummary}>
            {copy.collectionsDoorSummary(collections.groups.length, collections.totalItemCount)}
          </Text>
          <Text style={styles.doorBlurb}>{copy.collectionsDoor.blurb}</Text>
          <View style={[styles.doorPhoto, { borderColor: COLLECTIONS_STYLE.border }]}>
            <Image source={collectionsArt} style={styles.doorPhotoImg} resizeMode="cover" />
          </View>
        </Pressable>
      </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  base: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Same as HomeScreen's own headerOverlay — takes this out of the scroll flow entirely so it
  // floats above the content rather than scrolling away with it. No background color, same as
  // Home's: the LinearGradient wash behind both the header and the scroll content already reads
  // as continuous, so a solid bar here would just draw a hard seam where the header ends instead.
  headerOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  statusBarCover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 11,
    backgroundColor: ink.groundDeep,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: { width: 28, height: 28, borderRadius: 9 },
  title: { ...typography.navBrand, fontSize: 15 },
  balancePill: {
    height: 32,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(216,170,60,0.4)",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  coin: { width: 12, height: 12, borderRadius: 6 },
  balanceText: { ...typography.countMain, fontSize: 13 },
  headline: { ...typography.pageHeading, fontSize: 30, marginTop: 22, paddingHorizontal: 22 },
  headlineAccent: { color: "#e8bb4e" },
  body: { ...typography.paragraph, marginTop: 10, paddingHorizontal: 22 },
  searchBar: {
    marginTop: 18,
    marginHorizontal: 22,
    height: 50,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 11,
  },
  searchPlaceholder: { ...typography.body, fontSize: 13.5, color: "rgba(255,255,255,0.45)" },
  doors: { marginTop: 20, paddingHorizontal: 22, gap: 12 },
  door: { minHeight: 138, borderRadius: 14, padding: 17, overflow: "hidden" },
  // Bounded corner thumbnail — fixed width, height derived from the source art's own ratio (see
  // doorPhotoImg) so the whole picture always shows with no crop, at a size that sits clear of
  // the row's own text instead of bleeding across it.
  doorPhoto: {
    position: "absolute",
    right: 13,
    top: 15,
    width: 128,
    borderRadius: 11,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  doorPhotoImg: { width: "100%", aspectRatio: 840 / 475 },
  doorBorder: { ...StyleSheet.absoluteFill, borderRadius: 20, borderWidth: 1.5 },
  // Exact type scale from GrailhausDiscover.js's own `kicker`/`rowTitle`/`stats`/`blurb` styles —
  // this app models font weight as a family token (`fonts.*`) rather than a numeric `fontWeight`,
  // so 800/700/500 map to extrabold/bold/medium respectively.
  doorEyebrow: { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 3, color: "#E0C4FF" },
  doorTitle: { fontFamily: fonts.extrabold, fontSize: 20, color: "#fff", lineHeight: 23, letterSpacing: -0.5, marginTop: 5, maxWidth: "70%" },
  doorSummary: { fontFamily: fonts.bold, fontSize: 11.5, color: "rgba(255,255,255,0.9)", marginTop: 7 },
  doorBlurb: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: "rgba(255,255,255,0.66)", marginTop: 5, maxWidth: "54%" },
});
