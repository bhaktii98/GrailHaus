import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { FlatList } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { CategoryReveal, RarityTier } from "@grailhaus/shared";
import {
  usePortfolioViewModel,
  type CategoryPosition,
  type PortfolioFilter,
  type PortfolioSort,
  type Position,
} from "../../viewmodels/usePortfolioViewModel";
import { useRarityTiersByCategory } from "../../viewmodels/useRarityTiers";
import { useCategoriesViewModel } from "../../viewmodels/useCategoriesViewModel";
import { useWalletTopup } from "../../viewmodels/useWalletTopup";
import { useHideTabBarOnScroll, useTabBarClearance } from "../../navigation/tabBarVisibility";
import { SignInPrompt } from "../../components/SignInPrompt";
import { GlossyButton } from "../../components/GlossyButton";
import { AddFundsSheet } from "../../components/AddFundsSheet";
import { CardFace } from "../../components/CardFace";
import { WatchDial } from "../../components/WatchDial";
import { PnlPill } from "../../components/PnlPill";
import { Sparkline } from "../../components/Sparkline";
import { StatTile } from "../../components/StatTile";
import { itemArtGradient } from "../../content/cardArt";
import { money, moneyWhole, signedMoney } from "../../lib/money";
import { accents, colors, fonts, ink, shadow, spacing, typography } from "../../theme/tokens";
import { collection as copy } from "../../content/copy";
import type { CollectionStackParamList } from "../../navigation/CollectionStack";

type Nav = NativeStackNavigationProp<CollectionStackParamList, "Collection">;
type Rt = RouteProp<CollectionStackParamList, "Collection">;

// How long the "N new" banner and the per-cell glow stay up before settling back to a normal
// grid — long enough to register, short enough not to nag on a screen you might revisit often.
const JUST_ADDED_BANNER_MS = 4200;

const CARDS_TINT = "#B14BFF";
const WATCHES_TINT = "#F2C46B";

/** Cards/watches keep their existing hardcoded tints (unchanged pixel-for-pixel); any category
 * added after them (e.g. handbags) gets its own real admin-configured `paletteAccent` off the
 * categories table instead of reusing one of the two by coincidence — otherwise a third category
 * would be visually indistinguishable from watches everywhere this tint is used (allocation bar,
 * holding cells, dots). */
function categoryTint(categoryId: string, categoriesById: Map<string, CategoryReveal>): string {
  if (categoryId === "cards") return CARDS_TINT;
  if (categoryId === "watches") return WATCHES_TINT;
  return categoriesById.get(categoryId)?.paletteAccent ?? WATCHES_TINT;
}

/** Sends an empty portfolio off to go buy something — Portfolio's own stack has no route for
 * that, so this jumps up to the root tab navigator the same way RevealScreen/ItemForkScreen
 * already do for the same kind of cross-tab hop. Used to land on the Explore tab; that tab is
 * parked (see RootTabs), so it lands on Home, which carries the featured drop and the Card/
 * Watch world doors onto the same pack shelf.
 * // Original Explore target, for whenever that tab comes back:
 * // (navigation.navigate as (name: string, params?: object) => void)("Tabs", { screen: "Explore" });
 */
function rootNavigateExplore(navigation: Nav) {
  (navigation.navigate as (name: string, params?: object) => void)("Tabs", { screen: "Home" });
}

/**
 * The Portfolio tab's root — a position tracker, not a menu.
 *
 * It used to be two doors and a total: a count of what you held and a button per category, with
 * the actual pieces one tap further in. That answered "where is my stuff" but never "how am I
 * doing", which is the question anyone who has spent real balance on packs actually opens this
 * tab with. So the shape is a broker's: what it's worth now and which way it's moving up top,
 * the money facts behind that (wallet, invested, sold, realized) as tiles, then every piece you
 * hold in one filterable, sortable grid — each with its own live value and its P&L against what
 * it actually cost you.
 *
 * Nothing on this screen is invented to fill a layout. Cost basis and every settled figure come
 * off the ledger via `/me/portfolio/summary`; current values are the same simulated drift the
 * rest of the app shows, recomputed locally on its own 30s tick so the total is live rather than
 * as old as the last fetch (see `useDriftClock` for why that beats polling or a push channel).
 * Where a number genuinely can't be known — a holding whose purchase never completed, so it has
 * no derivable cost — it renders as "—", never as a zero that would read as break-even.
 *
 * The Binder and Vault still exist and are still where a collection is *browsed* (a binder page,
 * a lit vault plinth); they're reached from the compact pair of world tiles rather than from two
 * full-width doors, because the grid below is now the faster path to any individual piece.
 */
export function CollectionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const insets = useSafeAreaInsets();
  const vm = usePortfolioViewModel();
  const scrollHandler = useHideTabBarOnScroll();
  const tabBarClearance = useTabBarClearance();
  const { topUp, isToppingUp } = useWalletTopup();
  const [showAddFunds, setShowAddFunds] = useState(false);

  async function handleAddFunds(amountCents: number) {
    const result = await topUp(amountCents);
    if (result.ok) {
      setShowAddFunds(false);
    } else {
      Alert.alert("Couldn't add funds", result.error);
    }
  }

  // Set only when this screen was landed on right off a reveal's "deal away" exit — see
  // CollectionStackParamList's own comment. Keyed off the params themselves (not computed once
  // at mount) because the Portfolio tab's screen instance persists across visits — ripping a
  // second pack in the same session navigates here again with fresh params on the *same*
  // mounted screen, and that should re-trigger the highlight too, not just the first arrival.
  const justAddedIds = useMemo(() => new Set(route.params?.justAddedIds ?? []), [route.params?.justAddedIds]);
  const [showJustAddedBanner, setShowJustAddedBanner] = useState(justAddedIds.size > 0);
  const listRef = useRef<FlatList<Position>>(null);
  // Scrolling to offset 0 only lands on top of `ListHeaderComponent` (the hero card + stat tiles
  // + allocation + world tiles + filter/sort rows) — that's a lot of vertical space, and it left
  // the actual highlighted cells still below the fold, unseen. Measuring the header's own real
  // rendered height (below) and scrolling to *that* offset instead lands right at row one of the
  // grid, which is the whole point.
  const [headerHeight, setHeaderHeight] = useState(0);

  // The banner doubles as a "take me there" control — tappable any time it's up, not just a
  // passive label, since the whole point is proving the highlighted cells are actually reachable
  // and visible, not just technically present in the (possibly scrolled-away) list underneath.
  function showJustAdded() {
    if (justAddedIds.size === 0) return;
    setShowJustAddedBanner(true);
    vm.setSort("recent");
    vm.setFilter("all");
    listRef.current?.scrollToOffset({ offset: headerHeight, animated: true });
  }

  // The header's height isn't known until its own first layout pass, which can land after the
  // arrival effect below already tried to scroll (and undershot, since headerHeight was still 0
  // then) — this re-scrolls once the real height comes in, while the banner's still up, so the
  // grid still ends up in the right place instead of stuck wherever the first attempt landed.
  useEffect(() => {
    if (justAddedIds.size === 0 || headerHeight === 0 || !showJustAddedBanner) return;
    listRef.current?.scrollToOffset({ offset: headerHeight, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerHeight]);

  useEffect(() => {
    if (justAddedIds.size === 0) return;
    // Forced on each arrival (the Portfolio tab's screen instance persists across visits, so a
    // second pull in the same session re-runs this rather than remounting) — the user's own
    // later sort/filter/scroll choices in between are left alone.
    showJustAdded();
    const t = setTimeout(() => setShowJustAddedBanner(false), JUST_ADDED_BANNER_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justAddedIds]);
  // Matches the grid's 20px side padding + the 12px inter-column gap, so a lone cell in the last
  // row sits at half width instead of stretching (the same fix MarketplaceScreen documents).
  const { width: windowWidth } = useWindowDimensions();
  const cellWidth = (windowWidth - 20 * 2 - 12) / 2;
  const { byId: categoriesById } = useCategoriesViewModel();
  // Admin-configurable (rarity_tiers table), not a hardcoded name map — see useRarityTiers.ts.
  // Fetched for every category actually held (not just cards/watches) via `useQueries` under the
  // hood, so a third category's own tier names/colors show up instead of falling back to
  // whichever of the two hardcoded maps happened to be passed in.
  const heldCategoryIds = useMemo(
    () => [...new Set(vm.positions.map((p) => p.owned.item.category))],
    [vm.positions]
  );
  const tiersByCategory = useRarityTiersByCategory(heldCategoryIds);

  const categoryCount = vm.positionsByCategory.filter((c) => c.positions.length > 0).length;

  const bannerOpacity = useSharedValue(0);
  useEffect(() => {
    bannerOpacity.value = withTiming(showJustAddedBanner ? 1 : 0, { duration: 280 });
  }, [showJustAddedBanner, bannerOpacity]);
  const bannerStyle = useAnimatedStyle(() => ({
    opacity: bannerOpacity.value,
    transform: [{ translateY: (1 - bannerOpacity.value) * -6 }],
  }));

  function openDetail(position: Position) {
    // Cards gets its own dedicated detail screen; every other category (watches, and anything
    // added after, e.g. handbags) shares WatchDetail as the generic fallback — there's no
    // per-category detail screen pipeline yet, same "cards is special, else shared" rule the rest
    // of the app already follows (see ShelfScreen/HomeScreen's own fallback comments).
    if (position.owned.item.category === "cards") {
      navigation.navigate("CardDetail", { owned: position.owned });
    } else {
      navigation.navigate("WatchDetail", { owned: position.owned });
    }
  }

  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={["rgba(177,75,255,0.2)", colors.bg, "#04010A"]}
        locations={[0, 0.42, 1]}
        style={styles.base}
      />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.sub}>{copy.itemCount(vm.positions.length, categoryCount)}</Text>
        </View>
        {vm.summary && (
          <Pressable
            style={styles.balancePill}
            onPress={() => setShowAddFunds(true)}
            accessibilityRole="button"
            accessibilityLabel="Add funds to your wallet"
          >
            <LinearGradient colors={["#FFE27A", "#E0A016"]} style={styles.coin} />
            <Text style={styles.balanceText}>{Math.round(vm.live.walletCents / 100).toLocaleString()}</Text>
            <Ionicons name="add-circle" size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        )}
      </View>

      <AddFundsSheet
        visible={showAddFunds}
        balanceCents={vm.live.walletCents}
        isToppingUp={isToppingUp}
        onClose={() => setShowAddFunds(false)}
        onConfirm={handleAddFunds}
      />

      {justAddedIds.size > 0 && (
        <Animated.View style={[styles.justAddedBanner, bannerStyle]}>
          <Pressable style={styles.justAddedTap} onPress={showJustAdded} hitSlop={8}>
            <Ionicons name="sparkles" size={13} color={colors.violetTop} />
            <Text style={styles.justAddedText}>
              {justAddedIds.size === 1 ? "1 new, right below" : `${justAddedIds.size} new, right below`}
            </Text>
            <Ionicons name="arrow-up-circle" size={14} color={colors.violetTop} />
          </Pressable>
        </Animated.View>
      )}

      {!vm.isSignedIn ? (
        <SignInPrompt title={copy.signInTitle} body={copy.signInBody} />
      ) : vm.isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.textSecondary} />
      ) : vm.positions.length === 0 ? (
        <EmptyCollectionState onExplore={() => rootNavigateExplore(navigation)} />
      ) : (
        <Animated.FlatList
          ref={listRef}
          data={vm.visible}
          keyExtractor={(p: Position) => p.owned.ownedItemId}
          numColumns={2}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.grid, { paddingBottom: tabBarClearance }]}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={vm.isRefreshing} onRefresh={vm.refresh} tintColor={colors.textSecondary} />
          }
          ListHeaderComponent={
            <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
              <PortfolioHeader
                vm={vm}
                width={windowWidth}
                categoriesById={categoriesById}
                onOpenBinder={() => navigation.navigate("Binder", undefined)}
                onOpenVault={() => navigation.navigate("Vault")}
              />
            </View>
          }
          ListEmptyComponent={<Text style={styles.emptyFiltered}>{copy.tracker.emptyFiltered}</Text>}
          renderItem={({ item: position, index }: { item: Position; index: number }) => (
            <HoldingCell
              position={position}
              width={cellWidth}
              tier={tiersByCategory[position.owned.item.category]?.[position.owned.item.rarityTierLevel]}
              tint={categoryTint(position.owned.item.category, categoriesById)}
              onOpen={() => openDetail(position)}
              onSell={() => navigation.navigate("SellItem", { owned: position.owned })}
              justAdded={justAddedIds.has(position.owned.ownedItemId)}
              justAddedIndex={index}
            />
          )}
        />
      )}
    </View>
  );
}

/** Everything above the grid. Split out so the whole block is one `ListHeaderComponent` element
 * rather than a wrapper `ScrollView` around a 700-cell list — a nested scroll view would render
 * every holding at once and lose FlatList's windowing entirely. */
function PortfolioHeader({
  vm,
  width,
  categoriesById,
  onOpenBinder,
  onOpenVault,
}: {
  vm: ReturnType<typeof usePortfolioViewModel>;
  width: number;
  categoriesById: Map<string, CategoryReveal>;
  onOpenBinder: () => void;
  onOpenVault: () => void;
}) {
  const { live, summary, sparkline } = vm;
  // Hero card's inner width: screen padding (20 × 2) + card padding (18 × 2).
  const chartWidth = width - 20 * 2 - 18 * 2;
  const categoryLabel = (categoryId: string) => categoriesById.get(categoryId)?.label ?? categoryId;

  // The chart's own leading edge is the tick-fresh total rather than the last historical sample —
  // the history is recomputed every few minutes, but the live value moves every 30 seconds, and a
  // line whose tip lags the big number printed above it looks broken.
  const series = useMemo(
    () => (sparkline.length > 0 ? [...sparkline.slice(0, -1), live.holdingsValueCents] : []),
    [sparkline, live.holdingsValueCents]
  );
  const up = live.unrealizedPnlCents >= 0;
  const trendColor = up ? colors.success : colors.danger;

  return (
    <View style={styles.headerBlock}>
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <Text style={styles.heroEyebrow}>{copy.tracker.portfolioValue}</Text>
          <View style={styles.liveTag}>
            <View style={[styles.liveDot, { backgroundColor: trendColor }]} />
            <Text style={styles.liveText}>{copy.tracker.liveNote}</Text>
          </View>
        </View>

        <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {money(live.netWorthCents)}
        </Text>
        <Text style={styles.heroSub}>
          {copy.tracker.heroSub(moneyWhole(live.holdingsValueCents), moneyWhole(live.walletCents))}
        </Text>

        <View style={styles.heroPnlRow}>
          <PnlPill cents={live.unrealizedPnlCents} percent={live.unrealizedPnlPercent} size="lg" />
          <Text style={styles.heroPnlNote}>{copy.tracker.unrealizedLabel}</Text>
        </View>

        <View style={styles.chartWrap}>
          <Sparkline points={series} color={trendColor} width={chartWidth} height={72} />
        </View>
        <View style={styles.axisRow}>
          <Text style={styles.axisLabel}>{copy.tracker.window}</Text>
          <Text style={styles.axisLabel}>{copy.tracker.allTimeLabel(signedMoney(live.realizedPnlCents))}</Text>
        </View>
      </View>

      {summary && (
        <>
          <View style={styles.tileRow}>
            <StatTile
              icon="wallet"
              iconColor={colors.goldTop}
              label={copy.tracker.walletStat}
              value={moneyWhole(live.walletCents)}
              sub={copy.tracker.walletSub}
            />
            <StatTile
              icon="cart"
              iconColor={CARDS_TINT}
              label={copy.tracker.investedStat}
              value={moneyWhole(summary.totalSpendCents)}
              sub={copy.tracker.investedSub(summary.purchases.packCount, summary.marketplaceBuys.count)}
            />
          </View>
          <View style={styles.tileRow}>
            <StatTile
              icon="pricetag"
              iconColor={WATCHES_TINT}
              label={copy.tracker.salesStat}
              value={moneyWhole(summary.sales.netCents)}
              sub={copy.tracker.salesSub(summary.sales.count, moneyWhole(summary.sales.feeCents))}
            />
            <StatTile
              icon="trending-up"
              iconColor={summary.sales.realizedPnlCents >= 0 ? colors.success : colors.danger}
              label={copy.tracker.realizedStat}
              value={signedMoney(summary.sales.realizedPnlCents)}
              valueColor={
                summary.sales.realizedPnlCents === 0
                  ? ink.text
                  : summary.sales.realizedPnlCents > 0
                    ? colors.success
                    : colors.danger
              }
              sub={copy.tracker.realizedSub}
            />
          </View>

          {vm.best && (
            <View style={styles.moverRow}>
              <Text style={styles.moverLabel}>{copy.tracker.topMover}</Text>
              <Text style={styles.moverName} numberOfLines={1}>
                {displayName(vm.best)}
              </Text>
              <PnlPill cents={vm.best.pnlCents} percent={vm.best.pnlPercent} size="sm" />
            </View>
          )}

          <View style={styles.allocCard}>
            <View style={styles.allocHead}>
              <Text style={styles.sectionLabel}>{copy.tracker.allocation}</Text>
              <Text style={styles.allocCost}>
                {copy.tracker.costLine(moneyWhole(live.costBasisCents))}
              </Text>
            </View>
            {/* One segment/leg per category actually held (not a hardcoded cards/watches pair),
                so a third category's value is never left out of the split — and never silently
                dropped from the *total* above it either, since that total is summed over every
                position regardless of category. */}
            <View style={styles.splitBar}>
              {vm.positionsByCategory.map((c) => (
                <View
                  key={c.categoryId}
                  style={{ flex: Math.max(c.sharePercent, 1), backgroundColor: categoryTint(c.categoryId, categoriesById) }}
                />
              ))}
            </View>
            <View style={styles.legendRow}>
              {vm.positionsByCategory.map((c) => (
                <AllocationLeg
                  key={c.categoryId}
                  tint={categoryTint(c.categoryId, categoriesById)}
                  label={categoryLabel(c.categoryId)}
                  sharePercent={c.sharePercent}
                  valueCents={c.valueCents}
                  pnlCents={c.pnlCents}
                />
              ))}
            </View>
            {summary.holdings.pricedCount < summary.holdings.count && (
              <Text style={styles.allocNote}>
                {copy.tracker.costSub(summary.holdings.pricedCount, summary.holdings.count)}
              </Text>
            )}
          </View>

          {/* Binder and Vault are real, dedicated browse screens that only exist for cards and
              watches — there's no third "world" screen yet for a category added after them (e.g.
              handbags), so this row stays exactly these two shortcuts. That category's holdings
              are never hidden, though: they're in the total/allocation above and in the grid
              below, just not behind their own shortcut tile here yet. */}
          <View style={styles.worldRow}>
            {(() => {
              const cardsTotal = vm.positionsByCategory.find((c) => c.categoryId === "cards");
              const watchesTotal = vm.positionsByCategory.find((c) => c.categoryId === "watches");
              return (
                <>
                  {cardsTotal && cardsTotal.positions.length > 0 && (
                    <WorldTile
                      tint={CARDS_TINT}
                      icon="albums"
                      label={copy.tracker.binderCta}
                      sub={copy.tracker.worldSummary(cardsTotal.positions.length, moneyWhole(cardsTotal.valueCents))}
                      onPress={onOpenBinder}
                    />
                  )}
                  {watchesTotal && watchesTotal.positions.length > 0 && (
                    <WorldTile
                      tint={WATCHES_TINT}
                      icon="lock-closed"
                      label={copy.tracker.vaultCta}
                      sub={copy.tracker.worldSummary(watchesTotal.positions.length, moneyWhole(watchesTotal.valueCents))}
                      onPress={onOpenVault}
                    />
                  )}
                </>
              );
            })()}
          </View>
        </>
      )}

      <View style={styles.holdingsHead}>
        <Text style={styles.holdingsTitle}>{copy.tracker.holdingsTitle}</Text>
        <Text style={styles.holdingsCount}>{vm.visible.length}</Text>
      </View>

      <View style={styles.controlRow}>
        <FilterChip vm={vm} value="all" label={copy.tracker.filterAll} count={vm.positions.length} />
        {vm.positionsByCategory.map((c) => (
          <FilterChip
            key={c.categoryId}
            vm={vm}
            value={c.categoryId}
            label={categoryLabel(c.categoryId)}
            count={c.positions.length}
          />
        ))}
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>{copy.tracker.sortLabel}</Text>
        <SortChip vm={vm} value="value" label={copy.tracker.sortValue} icon="cash-outline" />
        <SortChip vm={vm} value="pnl" label={copy.tracker.sortPnl} icon="trending-up-outline" />
        <SortChip vm={vm} value="recent" label={copy.tracker.sortRecent} icon="time-outline" />
      </View>
    </View>
  );
}

function AllocationLeg({
  tint,
  label,
  sharePercent,
  valueCents,
  pnlCents,
}: {
  tint: string;
  label: string;
  sharePercent: number;
  valueCents: number;
  pnlCents: number;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={styles.legendTop}>
        <View style={[styles.legendDot, { backgroundColor: tint }]} />
        <Text style={styles.legendText}>
          {label} {sharePercent}%
        </Text>
      </View>
      <Text style={styles.legendValue}>{money(valueCents)}</Text>
      <PnlPill cents={pnlCents} size="sm" showPercent={false} />
    </View>
  );
}

function WorldTile({
  tint,
  icon,
  label,
  sub,
  onPress,
}: {
  tint: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.worldTile, { borderColor: `${tint}55` }]} onPress={onPress}>
      <View style={[styles.worldIcon, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={icon} size={15} color={tint} />
      </View>
      <View style={styles.worldInfo}>
        <Text style={styles.worldLabel}>{label}</Text>
        <Text style={styles.worldSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.4)" />
    </Pressable>
  );
}

function FilterChip({
  vm,
  value,
  label,
  count,
}: {
  vm: ReturnType<typeof usePortfolioViewModel>;
  value: PortfolioFilter;
  label: string;
  count: number;
}) {
  const active = vm.filter === value;
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={() => vm.setFilter(value)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label} {count}
      </Text>
    </Pressable>
  );
}

function SortChip({
  vm,
  value,
  label,
  icon,
}: {
  vm: ReturnType<typeof usePortfolioViewModel>;
  value: PortfolioSort;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const active = vm.sort === value;
  return (
    <Pressable
      style={[styles.sortChip, active && styles.sortChipActive]}
      onPress={() => vm.setSort(value)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={12} color={active ? "#fff" : "rgba(255,255,255,0.5)"} />
      <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** Cards carry a card title, watches a model name — both fall back to the raw catalog name. */
function displayName(position: Position): string {
  const item = position.owned.item;
  return item.cardTitle ?? item.watchName ?? item.name;
}

/**
 * One holding. Everything a decision needs without opening it: what it is, how rare, what it's
 * worth right now, what it did against what you paid, and the two things you can do with it.
 *
 * The sell action is a real button rather than a hidden long-press — listing is the whole point of
 * holding a tradeable asset, and burying it behind a gesture makes the marketplace feel like a
 * separate app. When a copy is already listed the button reports that instead of offering to list
 * it twice (which the DB's partial unique index would reject anyway).
 */
function HoldingCell({
  position,
  width,
  tier,
  tint,
  onOpen,
  onSell,
  justAdded = false,
  justAddedIndex = 0,
}: {
  position: Position;
  width: number;
  tier: RarityTier | undefined;
  tint: string;
  onOpen: () => void;
  onSell: () => void;
  /** True for a holding that's part of the pull this screen was just landed on from (see
   * CollectionScreen's own `justAddedIds`) — gets a brief landing pop + pulsing glow so it's
   * obvious at a glance "this is one of the ones that just came in", not just a silently new row. */
  justAdded?: boolean;
  /** Position within the just-added group (not the whole grid) — staggers the landing pop so a
   * multi-card pull visibly deals into the grid one after another instead of every cell popping
   * in unison. Ignored when `justAdded` is false. */
  justAddedIndex?: number;
}) {
  const { owned, valueCents, pnlCents, pnlPercent, isListed } = position;
  const item = owned.item;
  // Cards gets its own rectangular card-face art; every other category (watches, and anything
  // added after, e.g. handbags) shares the circular watch-dial treatment as a generic fallback —
  // same cards-is-special/else-shared rule used throughout this pass (see ShelfScreen/HomeScreen).
  const isCards = item.category === "cards";
  const artHeight = width * 1.3;

  // Land + pulse, then settle — a small entrance pop (like the card actually dropping into this
  // slot) followed by two glow pulses around the cell's own tint, then fades to a normal,
  // unhighlighted cell. Capped stagger so a big pull doesn't drag the last cells' pop out for
  // seconds; they've all landed by then either way.
  // `land` overshoots past 1 and settles (a spring, not an eased tween) — reads as the card
  // actually dropping into this exact grid slot and bouncing on landing, not just fading up.
  // `fallHeight` scales with the stagger delay so a card further back in the deal also *looks*
  // like it fell from further away, not just later.
  const land = useSharedValue(justAdded ? 0 : 1);
  const glow = useSharedValue(0);
  const fallHeight = 46 + Math.min(justAddedIndex, 8) * 5;
  useEffect(() => {
    if (!justAdded) return;
    const delay = Math.min(justAddedIndex, 8) * 80;
    land.value = withDelay(delay, withSpring(1, { damping: 10, stiffness: 140, mass: 0.7 }));
    glow.value = withDelay(
      delay + 220,
      withSequence(
        withRepeat(withSequence(withTiming(1, { duration: 360 }), withTiming(0.35, { duration: 360 })), 3, true),
        withTiming(0, { duration: 500 })
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const landStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, land.value),
    transform: [{ scale: 0.82 + land.value * 0.18 }, { translateY: (1 - land.value) * -fallHeight }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, borderColor: tint }));

  return (
    <Animated.View style={[styles.cell, { width }, landStyle]}>
      {justAdded ? <Animated.View pointerEvents="none" style={[styles.justAddedGlow, glowStyle]} /> : null}
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={displayName(position)}>
        <View style={[styles.art, { height: artHeight }]}>
          {isCards ? (
            <CardFace
              gradient={itemArtGradient(item)}
              imageUrl={item.textureUrl}
              width={width}
              height={artHeight}
              borderColor={`${tint}66`}
            />
          ) : (
            <View style={styles.watchArt}>
              <WatchDial art={itemArtGradient(item)} imageUrl={item.textureUrl} size={Math.min(width - 44, artHeight - 52)} />
            </View>
          )}
          {isListed && (
            <View style={styles.listedBadge}>
              <Ionicons name="pricetag" size={8} color="#2A1706" />
              <Text style={styles.listedBadgeText}>
                {copy.tracker.listed(moneyWhole(owned.activeListing!.priceCents))}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.cellName} numberOfLines={1}>
          {displayName(position).toUpperCase()}
        </Text>

        <View style={styles.cellMeta}>
          <View style={[styles.categoryDot, { backgroundColor: tint }]} />
          <Text style={styles.cellMetaText} numberOfLines={1}>
            {/* Falls back to the raw category id (never a hardcoded "WATCH"/"CARD") on the rare
                chance its rarity tiers haven't loaded yet. */}
            {tier?.name?.toUpperCase() ?? item.category.toUpperCase()}
          </Text>
        </View>

        <Text style={styles.cellValue}>{money(valueCents)}</Text>
        <View style={styles.cellPnl}>
          <PnlPill cents={pnlCents} percent={pnlPercent} size="sm" />
        </View>
      </Pressable>

      <View style={styles.cellActions}>
        <Pressable
          style={styles.cellAction}
          onPress={onOpen}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`${copy.tracker.actionDetails}: ${displayName(position)}`}
        >
          <Ionicons name="information-circle-outline" size={13} color="rgba(255,255,255,0.72)" />
          <Text style={styles.cellActionText}>{copy.tracker.actionDetails}</Text>
        </Pressable>
        <Pressable
          style={[styles.cellAction, styles.cellActionSell, isListed && styles.cellActionDisabled]}
          onPress={onSell}
          disabled={isListed}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityState={{ disabled: isListed }}
          accessibilityLabel={
            isListed
              ? copy.tracker.listed(moneyWhole(owned.activeListing!.priceCents))
              : `${copy.tracker.actionSell}: ${displayName(position)}`
          }
        >
          <Ionicons
            name={isListed ? "checkmark-circle-outline" : "pricetag-outline"}
            size={13}
            color={isListed ? "rgba(255,255,255,0.45)" : "#2A1706"}
          />
          <Text style={[styles.cellActionText, isListed ? styles.cellActionTextMuted : styles.cellActionTextSell]}>
            {isListed ? copy.tracker.actionListed : copy.tracker.actionSell}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

/** Was a single line of small muted text floating in empty space — easy to miss entirely
 * against the dark background, and gave a signed-in-but-nothing-owned-yet collector no way to
 * act on it. Matches SignInPrompt's structure (icon → title → body → real CTA) for the other
 * "nothing here yet" state this screen can land on. */
function EmptyCollectionState({ onExplore }: { onExplore: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <LinearGradient colors={[accents.cards.top, accents.cards.bottom]} style={[styles.emptyBadge, shadow.glow(accents.cards.glow)]}>
        <Ionicons name="gift-outline" size={30} color={colors.textPrimary} />
      </LinearGradient>
      <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
      <Text style={styles.empty}>{copy.empty}</Text>
      <View style={styles.emptyButton}>
        <GlossyButton label={copy.emptyCta} onPress={onExplore} />
      </View>
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
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: typography.heroWordmark,
  sub: { ...typography.sectionSub, marginTop: 4 },
  justAddedBanner: {
    alignSelf: "center",
    marginTop: 10,
  },
  justAddedTap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(177,75,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(177,75,255,0.4)",
  },
  justAddedText: { fontFamily: fonts.bold, fontSize: 11.5, color: "#e7d4ff" },
  balancePill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  coin: { width: 14, height: 14, borderRadius: 7 },
  balanceText: typography.countMain,
  loading: { marginTop: 60 },

  emptyWrap: { alignItems: "center", paddingHorizontal: 32, marginTop: 56, gap: 10 },
  emptyBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...typography.title, textAlign: "center", color: "#fff" },
  empty: { ...typography.sectionSub, textAlign: "center" },
  emptyButton: { width: "100%", marginTop: 14 },
  // The grid's own "this filter matches nothing" line — sits inside the list, below the header
  // block, so it needs its own spacing rather than the empty-collection body's.
  emptyFiltered: { ...typography.sectionSub, textAlign: "center", width: "100%", marginTop: 34 },

  grid: { padding: 20, paddingTop: 14 },
  gridRow: { gap: 12, marginBottom: 16 },
  headerBlock: { gap: 12, marginBottom: 4 },

  heroCard: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroEyebrow: typography.eyebrow,
  liveTag: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontFamily: fonts.medium, fontSize: 9.5, color: "rgba(255,255,255,0.45)" },
  // Tabular figures keep the hero from reflowing every time a digit changes on the 30s tick.
  heroValue: {
    ...typography.heroWordmark,
    fontSize: 40,
    marginTop: 8,
    fontVariant: ["tabular-nums"],
  },
  heroSub: { ...typography.footNote, marginTop: 3 },
  heroPnlRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 12 },
  heroPnlNote: { fontFamily: fonts.medium, fontSize: 11, color: "rgba(255,255,255,0.45)" },
  chartWrap: { marginTop: 14 },
  axisRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  axisLabel: { fontFamily: fonts.semibold, fontSize: 9.5, letterSpacing: 0.8, color: "rgba(255,255,255,0.42)" },

  tileRow: { flexDirection: "row", gap: 12 },

  moverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  moverLabel: { fontFamily: fonts.bold, fontSize: 8.5, letterSpacing: 1.3, color: "rgba(255,255,255,0.42)" },
  moverName: { flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: ink.text },

  allocCard: {
    padding: 15,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.11)",
  },
  allocHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionLabel: typography.eyebrow,
  allocCost: { fontFamily: fonts.semibold, fontSize: 11, color: "rgba(255,255,255,0.5)" },
  splitBar: { flexDirection: "row", height: 8, borderRadius: 5, overflow: "hidden", marginTop: 13, gap: 3 },
  legendRow: { flexDirection: "row", gap: 18, marginTop: 12 },
  legendItem: { gap: 4 },
  legendTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 3 },
  legendText: { ...typography.metaLine, fontSize: 11.5, color: "rgba(255,255,255,0.72)" },
  legendValue: { fontFamily: fonts.extrabold, fontSize: 15, color: ink.text, fontVariant: ["tabular-nums"] },
  allocNote: { fontFamily: fonts.medium, fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 10 },

  worldRow: { flexDirection: "row", gap: 12 },
  worldTile: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
  },
  worldIcon: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  worldInfo: { flex: 1, minWidth: 0 },
  worldLabel: { fontFamily: fonts.extrabold, fontSize: 13, color: ink.text },
  worldSub: { fontFamily: fonts.medium, fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 },

  holdingsHead: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 },
  holdingsTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: ink.text },
  holdingsCount: { fontFamily: fonts.semibold, fontSize: 12.5, color: "rgba(255,255,255,0.45)" },

  controlRow: { flexDirection: "row", gap: 7 },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.violetTop, borderColor: colors.violetTop },
  chipText: { ...typography.metaLine, fontSize: 12, color: "rgba(255,255,255,0.6)" },
  chipTextActive: { color: "#fff" },

  sortRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  sortLabel: { fontFamily: fonts.bold, fontSize: 8.5, letterSpacing: 1.4, color: "rgba(255,255,255,0.38)" },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sortChipActive: { backgroundColor: "rgba(177,75,255,0.26)", borderColor: "rgba(177,75,255,0.6)" },
  sortChipText: { fontFamily: fonts.semibold, fontSize: 11, color: "rgba(255,255,255,0.5)" },
  sortChipTextActive: { color: "#fff" },

  cell: { gap: 5 },
  // The pulsing "this one just landed" ring — an absolute-fill overlay sitting behind the cell's
  // own content (added first, before the Pressable, so it paints underneath) rather than a real
  // border on the cell itself, so it never nudges the art/text layout while it pulses.
  justAddedGlow: {
    position: "absolute",
    top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: 16,
    borderWidth: 2,
  },
  art: { position: "relative", justifyContent: "center" },
  watchArt: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(242,196,107,0.3)",
  },
  listedBadge: {
    position: "absolute",
    left: 7,
    top: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: WATCHES_TINT,
  },
  listedBadgeText: { fontFamily: fonts.extrabold, fontSize: 7.5, letterSpacing: 0.6, color: "#2A1706" },
  cellName: { fontFamily: fonts.extrabold, fontSize: 10.5, color: ink.text, marginTop: 3 },
  cellMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  categoryDot: { width: 5, height: 5, borderRadius: 3 },
  cellMetaText: { flex: 1, fontFamily: fonts.semibold, fontSize: 8.5, letterSpacing: 0.9, color: "rgba(255,255,255,0.5)" },
  cellValue: { fontFamily: fonts.black, fontSize: 15, color: ink.text, fontVariant: ["tabular-nums"], marginTop: 1 },
  cellPnl: { marginTop: 1 },
  cellActions: { flexDirection: "row", gap: 6, marginTop: 3 },
  cellAction: {
    flex: 1,
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  cellActionSell: { backgroundColor: colors.goldTop, borderColor: "rgba(255,255,255,0.3)" },
  cellActionDisabled: { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" },
  cellActionText: { fontFamily: fonts.extrabold, fontSize: 10, color: "rgba(255,255,255,0.78)" },
  cellActionTextSell: { color: "#2A1706" },
  cellActionTextMuted: { color: "rgba(255,255,255,0.45)" },
});
