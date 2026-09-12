import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Image as PhotoImage } from "expo-image";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Category, Listing, RarityTierLevel, RecentPull } from "@grailhaus/shared";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSessionViewModel } from "../viewmodels/useSessionViewModel";
import { useHomeViewModel } from "../viewmodels/useHomeViewModel";
import { useCategoriesViewModel } from "../viewmodels/useCategoriesViewModel";
import { useRecentActivityViewModel } from "../viewmodels/useRecentActivityViewModel";
import type { CollectionProgressSummary } from "../viewmodels/useHomeViewModel";
import { useHideTabBarOnScroll, useTabBarClearance, useTabBarHidden } from "../navigation/tabBarVisibility";
import { useAuthStore } from "../state/authStore";
import { useOnboardingStore } from "../state/onboardingStore";
import { resetOnboarding } from "../lib/onboarding";
import { PackFace } from "../components/PackFace";
import { WatchDial } from "../components/WatchDial";
import { Countdown } from "../components/Countdown";
import { ART_GRADIENT, tierLabel } from "../components/PackTile";
import { itemArtGradient } from "../content/cardArt";
import { heroArt, cardsArt, watchesArt } from "../content/localArt";
import type { DropView } from "../viewmodels/useDropsViewModel";
import { accents, colors, ink, spacing, typography } from "../theme/tokens";
import { brand, shelf as shelfCopy, home as copy, packTile as packTileCopy } from "../content/copy";
import type { RootTabParamList } from "../navigation/RootTabs";
import type { HomeStackParamList } from "../navigation/HomeStack";
import type { AppStackParamList } from "../navigation/AppNavigator";

type Nav = CompositeNavigationProp<
  NativeStackNavigationProp<HomeStackParamList, "Home">,
  CompositeNavigationProp<BottomTabNavigationProp<RootTabParamList>, NativeStackNavigationProp<AppStackParamList>>
>;

/**
 * The dashboard — the mockup's "seven engagements, then the three doors" screen (turn 14a).
 *
 * Integration status per engagement, as of this pass:
 * - Featured Drop, Explore Cards/Watches doors, Upcoming Drops: fully real, off the same
 *   `PackSku` data Shelf/Drops read. One exception inside Featured Drop: the "1,842 watching"
 *   line (content/copy.ts's `featuredDrop.watching`) is a static string — there's no live
 *   viewer-count backend, and none is planned; flagging it here since it reads as real.
 * - Your Collection Progress: real once signed in with ≥1 owned item — total value and the
 *   cards/watches value split both come straight off `/me/portfolio` (see useHomeViewModel's
 *   `collectionProgress`). Two pieces the mockup wants still have no backing endpoint and stay
 *   on `SAMPLE_COLLECTION` below until one exists: (1) a day-over-day value delta ("+1.84%") —
 *   needs a portfolio-value-history/snapshot mechanism server-side; (2) per-set completion
 *   counts ("7 / 9 Prism Core") — needs a full per-collection catalog census endpoint (today's
 *   catalog is only readable one item at a time via `/items/:id`, or via `/packs`' own roster,
 *   neither of which gives "how many total items exist in the Prism Core set").
 * - Marketplace Highlights: real whenever `/listings` has anything — item, category, price,
 *   seller. Falls back to `SAMPLE_LISTINGS` only while the marketplace is empty (a seeding gap,
 *   not a missing-field gap). Two sub-fields the mockup wants have no backing at all and are
 *   dropped from the real rows entirely rather than faked: comp-price deltas ("-12% vs comp",
 *   needs market-average analytics per item) and "offers on yours" (this app only has fixed-
 *   price listings, per PRD §30-32 — there's no offer/bid system for that count to come from).
 * - Recently Revealed: real — `GET /activity/recent` returns the most recent genuine pack pulls
 *   (owner, item, timestamp), filtered to actual reveals rather than marketplace transfers (see
 *   `useRecentActivityViewModel`). No sample fallback: with zero pulls yet, the section shows a
 *   plain "nobody's pulled yet" empty state rather than fabricated rows.
 */
export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const session = useSessionViewModel();
  const home = useHomeViewModel();
  const { categories } = useCategoriesViewModel();
  const recentActivity = useRecentActivityViewModel();
  const requireAuth = useAuthStore((s) => s.requireAuth);
  const setNeedsOnboarding = useOnboardingStore((s) => s.setNeedsOnboarding);
  const scrollHandler = useHideTabBarOnScroll();
  const tabBarClearance = useTabBarClearance();
  const hidden = useTabBarHidden();
  const [headerHeight, setHeaderHeight] = useState(insets.top + 58);

  const headerAnimatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: -hidden.value * headerHeight }],
      opacity: 1 - hidden.value,
    }),
    [headerHeight]
  );

  function handleHeaderLayout(e: LayoutChangeEvent) {
    setHeaderHeight(e.nativeEvent.layout.height);
  }

  function handleReplayOnboarding() {
    if (!__DEV__) return;
    resetOnboarding();
    setNeedsOnboarding(true);
  }

  return (
    <View style={styles.fill}>
      {/* A gentle, low-opacity ambient wash behind the header *and* the top of the scroll
          content — anchored to the screen rather than the scroll content so it never scrolls
          away and leaves the header looking like a separate, flat-colored box sitting on top
          of a differently-tinted page underneath it. */}
      <LinearGradient
        pointerEvents="none"
        colors={home.featuredDrop ? ["rgba(255,92,122,0.16)", "transparent"] : ["rgba(177,75,255,0.12)", "transparent"]}
        style={styles.ambientWash}
      />

      <Animated.View
        onLayout={handleHeaderLayout}
        pointerEvents="box-none"
        style={[styles.header, styles.headerOverlay, { paddingTop: insets.top + 12 }, headerAnimatedStyle]}
      >
        <Pressable style={styles.brand} onLongPress={handleReplayOnboarding} disabled={!__DEV__}>
          <View style={styles.brandChip}>
            <Image source={require("../../assets/icon.png")} style={styles.brandIcon} />
          </View>
          <Text style={styles.brandText}>{brand.name}</Text>
        </Pressable>
        <View style={styles.headerRight}>
          {session.isSignedIn && (
            <Pressable style={styles.iconButton} onPress={() => useAuthStore.getState().openAccountSheet()} hitSlop={8}>
              <Ionicons name="person" size={16} color="rgba(255,255,255,0.85)" />
            </Pressable>
          )}
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
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: headerHeight + 20, paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <View style={styles.scrollInner}>
          {home.featuredDrop && (
            <FeaturedDropCard
              drop={home.featuredDrop}
              onPress={() => navigation.navigate("DropDetail", { packId: home.featuredDrop!.sku.id })}
            />
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.doors}>
            {categories.map((c) => (
              <DoorCard
                key={c.id}
                category={c.id}
                label={c.label}
                summary={home.evergreenByCategory[c.id] ?? { tierCount: 0, fromPriceCents: null }}
                onPress={() => navigation.navigate("World", { category: c.id })}
              />
            ))}
          </ScrollView>

          {home.upcomingDrops.length > 0 && (
            <Section
              title={copy.upcomingDrops.title}
              actionLabel={copy.upcomingDrops.seeAll}
              onAction={() => navigation.navigate("Drops")}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upcomingRow}>
                {home.upcomingDrops.map((d) => (
                  <UpcomingDropCard
                    key={d.sku.id}
                    drop={d}
                    onPress={() => navigation.navigate("DropDetail", { packId: d.sku.id })}
                  />
                ))}
              </ScrollView>
            </Section>
          )}

          <Section title={copy.recentlyRevealed.title} sub={copy.recentlyRevealed.sub} actionLabel={copy.recentlyRevealed.action}>
            {recentActivity.pulls.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.revealedRow}>
                {recentActivity.pulls.map((pull) => (
                  <RecentPullCard key={pull.ownedItemId} pull={pullCardFromActivity(pull)} />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.revealedEmpty}>
                {recentActivity.isLoading ? "Loading recent pulls…" : "Nobody's pulled yet — be the first."}
              </Text>
            )}
          </Section>

          <Section
            title={copy.collectionProgress.title}
            actionLabel={copy.collectionProgress.action}
            onAction={() => navigation.navigate("Portfolio")}
          >
            <CollectionProgressCard progress={home.collectionProgress} />
          </Section>

          <Section
            title={copy.marketplaceHighlights.title}
            actionLabel={copy.marketplaceHighlights.action}
            onAction={() => navigation.navigate("Marketplace")}
          >
            <View style={{ gap: spacing.sm }}>
              {home.recentListings.length > 0
                ? home.recentListings.map((listing) => <RealListingRow key={listing.id} listing={listing} />)
                : SAMPLE_LISTINGS.map((listing) => <ListingRow key={listing.name} listing={listing} />)}
            </View>
          </Section>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function FeaturedDropCard({ drop, onPress }: { drop: DropView; onPress: () => void }) {
  const { sku } = drop;
  const remaining = sku.stockRemaining;
  const max = sku.maxStock;
  const pips = max != null && max > 0 && max <= 20 ? max : null;
  const filledPips = pips != null && remaining != null ? Math.round((remaining / max!) * pips) : 0;

  return (
    <View style={styles.featured}>
      {/* A tilted, floating real photo — GrailhausHome.js's own `heroCardWrap`, not a full-bleed
          background — so the photo keeps its own framing regardless of this card's
          content-driven height. */}
      <View style={styles.featuredPhotoCard}>
        <PhotoImage source={heroArt} style={StyleSheet.absoluteFill} contentFit="contain" />
      </View>
      {/* Opaque up to 40% (the text zone, well left of the photo), fully clear by 50% so the
          whole photo shows with no tint over it — same technique as the reference's own scrim. */}
      <LinearGradient
        colors={["rgba(20,4,10,0.95)", "rgba(20,4,10,0.95)", "transparent"]}
        locations={[0, 0.4, 0.5]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.featuredGlow} pointerEvents="none" />

      {/* The live badge sits inside the bordered showcase box, over the photo/scrim — same
          placement as the reference's own `heroContent` — instead of floating above it. */}
      <View style={styles.featuredEyebrowRow}>
        <View style={styles.liveDot} />
        <Text style={styles.featuredEyebrow}>{copy.featuredDrop.eyebrow}</Text>
      </View>

      <Text style={styles.featuredKicker}>
        {sku.category.toUpperCase()} · {tierLabel(sku)}
      </Text>
      <Text style={styles.featuredName}>{sku.name}</Text>
      <Text style={styles.featuredSub}>{packTileCopy.countLabel(sku.category, sku.itemCount)}</Text>

      {/* Icon + fact triplets, same shape as the reference's `metaRow` — real count/price/stock,
          never the reference's own flavor copy. */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="layers-outline" size={13} color="rgba(255,255,255,0.85)" />
          <Text style={styles.metaText}>{packTileCopy.countLabel(sku.category, sku.itemCount)}</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Ionicons name="pricetag-outline" size={13} color="rgba(255,255,255,0.85)" />
          <Text style={styles.metaText}>${(sku.priceCents / 100).toLocaleString()}</Text>
        </View>
        {remaining != null && max != null && (
          <>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Ionicons name="cube-outline" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.metaText}>
                {remaining} <Text style={styles.metaSmall}>REMAINING</Text>
              </Text>
            </View>
          </>
        )}
      </View>

      {pips != null && (
        <View style={styles.pipRow}>
          {Array.from({ length: pips }).map((_, i) => (
            <View key={i} style={[styles.pip, i < filledPips ? styles.pipFilled : styles.pipEmpty]} />
          ))}
        </View>
      )}

      {/* CTA beside a real countdown — GrailhausHome.js's own footer pairing — shown only when
          this drop actually has a real end time (`sku.endsAt`), never a fabricated clock. */}
      <View style={styles.heroFooter}>
        <Pressable onPress={onPress} style={styles.featuredCtaWrap}>
          <LinearGradient colors={["#FF7A9C", "#C4183C"]} style={styles.featuredCta}>
            <Text style={styles.featuredCtaLabel}>{copy.featuredDrop.cta}</Text>
          </LinearGradient>
        </Pressable>
        {sku.endsAt && (
          <View style={styles.endsInWrap}>
            <Text style={styles.endsInLabel}>ENDS IN</Text>
            <Countdown target={sku.endsAt} color="#fff" />
          </View>
        )}
      </View>
    </View>
  );
}

function DoorCard({
  category,
  label,
  summary,
  onPress,
}: {
  category: string;
  label: string;
  summary: { tierCount: number; fromPriceCents: number | null };
  onPress: () => void;
}) {
  // Every category from the categories table gets a door now — cards and watches each get their
  // own real photo blended into the tile via a horizontal scrim (GrailhausHome.js's own
  // `CollectionCard`); any category added after (e.g. handbags) has no photo of its own yet and
  // falls back to the watch-dial icon treatment, same as its accent color already does.
  const accent = accents[category as keyof typeof accents] ?? accents.cards;
  const art = category === "cards" ? ART_GRADIENT.vault_break : ART_GRADIENT.obsidian_vault;
  const photo = category === "cards" ? cardsArt : category === "watches" ? watchesArt : null;
  // Each source photo frames its subject differently (the watch sits well right-of-center,
  // higher up, in watches-art.jpg) — a plain center crop misses it entirely on a narrow, tall
  // panel like this one, so each gets its own bias toward where the actual subject sits.
  const photoPosition = category === "watches" ? { left: "82%", top: "28%" } : { left: "50%" };

  return (
    <Pressable onPress={onPress} style={[styles.door, { borderColor: `${accent.top}70` }]}>
      {photo ? (
        <>
          {/* Full-height panel (GrailhausHome.js's own `CollectionCard`) — a small bounded corner
              tile was tried here and never rendered any pixels at all, at any size, with either
              the plain RN `Image` or `expo-image`, even though the tile's own border/shape
              rendered fine. This size is a known-working baseline (it showed real pixels, just
              cropped tighter than ideal) rather than a smaller one that silently failed
              outright. */}
          <PhotoImage source={photo} style={styles.doorPhoto} contentFit="cover" contentPosition={photoPosition} />
          {/* Opaque up to 42% (well left of the 48%-wide photo panel on the right), fully clear
              by 52% — same scrim technique as the reference's own `CollectionCard`. */}
          <LinearGradient
            colors={[`${accent.bottom}f7`, `${accent.bottom}f7`, "transparent"]}
            locations={[0, 0.42, 0.52]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <LinearGradient colors={[`${accent.top}33`, `${accent.bottom}1a`]} style={StyleSheet.absoluteFill} />
      )}
      {!photo && (
        <View style={styles.doorArt} pointerEvents="none">
          <WatchDial art={art} size={58} />
        </View>
      )}
      <Text style={[styles.doorEyebrow, { color: accent.top }]}>{copy.door.eyebrow}</Text>
      <Text style={styles.doorName}>{label}</Text>
      <Text style={styles.doorSub}>
        {summary.tierCount > 0
          ? `${copy.door.tiersLabel(summary.tierCount)} · ${copy.door.fromPrice(summary.fromPriceCents ?? 0)}`
          : copy.door.comingSoon}
      </Text>
    </Pressable>
  );
}

function UpcomingDropCard({ drop, onPress }: { drop: DropView; onPress: () => void }) {
  const { sku } = drop;
  const accent = accents[sku.category as keyof typeof accents] ?? accents.cards;

  return (
    <Pressable style={styles.upcoming} onPress={onPress}>
      <View style={styles.upcomingKickerRow}>
        <View style={[styles.upcomingDot, { backgroundColor: accent.top }]} />
        <Text style={styles.upcomingKicker}>{sku.category.toUpperCase()}</Text>
      </View>
      <Text style={styles.upcomingName} numberOfLines={1}>
        {sku.name}
      </Text>
      <Text style={styles.upcomingSub}>
        {sku.maxStock != null ? `${copy.upcomingDrops.units(sku.maxStock)} · ` : ""}$
        {(sku.priceCents / 100).toLocaleString()}
      </Text>
      <View style={styles.upcomingFooter}>
        {sku.goesLiveAt && <Countdown target={sku.goesLiveAt} color={accent.top} />}
        <View style={styles.notifyChip}>
          <Text style={[styles.notifyLabel, { color: accent.top }]}>{copy.upcomingDrops.notify}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function Section({
  title,
  sub,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  sub?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {sub && <Text style={styles.sectionSub}>{sub}</Text>}
        </View>
        {actionLabel &&
          (onAction ? (
            <Pressable onPress={onAction}>
              <Text style={styles.sectionAction}>{actionLabel}</Text>
            </Pressable>
          ) : (
            <Text style={styles.sectionAction}>{actionLabel}</Text>
          ))}
      </View>
      {children}
    </View>
  );
}

/**
 * SAMPLE DATA — visual placeholder only, kept as the fallback rendered when there's nothing
 * real yet. `SAMPLE_COLLECTION` and `SAMPLE_LISTINGS` are shown only before there's real data to
 * replace them with (no session / no owned items; an empty marketplace) — see
 * `CollectionProgressCard` and `RealListingRow` above for the real branches. "Recently Revealed"
 * has no sample fallback (see this file's top comment) — `RecentPullCard` below only ever renders
 * real `/activity/recent` rows.
 */
type PullCardData = {
  handle: string;
  badge: "CHASE" | "GRAIL" | null;
  priceLabel: string;
  timeLabel: string;
  art: string[];
  borderColor: string;
  glowColor?: string;
  imageUrl?: string | null;
};

/** Coarse per-tier styling for a pull card — the real feed carries no tier name/color (`ItemDetail`
 * only has the ordinal `rarityTierLevel`), so this mirrors the badge/border scheme the mockup's own
 * sample rows used per tier rather than inventing new colors. */
const TIER_PULL_STYLE: Record<RarityTierLevel, Pick<PullCardData, "badge" | "borderColor" | "glowColor">> = {
  3: { badge: "GRAIL", borderColor: "rgba(242,196,107,0.5)" },
  2: { badge: "CHASE", borderColor: "rgba(255,215,94,0.7)", glowColor: "rgba(255,201,74,0.3)" },
  1: { badge: null, borderColor: "rgba(143,169,255,0.55)" },
};

function formatPullTimeAgo(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function pullCardFromActivity(pull: RecentPull): PullCardData {
  const item = pull.item;
  const tierStyle = TIER_PULL_STYLE[item.rarityTierLevel];
  return {
    handle: pull.username ? `@${pull.username}` : "collector",
    priceLabel: `$${(item.baseValueCents / 100).toLocaleString()}`,
    timeLabel: formatPullTimeAgo(pull.acquiredAt),
    art: itemArtGradient(item),
    imageUrl: item.textureUrl,
    ...tierStyle,
  };
}

const SAMPLE_COLLECTION = {
  totalLabel: "$35,143",
  deltaLabel: "+1.84%",
  sets: [
    { name: "Prism Core", current: 7, total: 9, note: "2 slots left · Prism badge at 9", art: accents.cards },
    { name: "Glacier Seal", current: 18, total: 24, note: null, art: { top: "#59D8FF", bottom: "#1668D8" } },
  ],
};

const SAMPLE_LISTINGS: {
  name: string;
  meta: string;
  priceLabel: string;
  deltaLabel: string;
  deltaColor: string;
  category: Category;
  art: [string, string];
}[] = [
  {
    name: "VEILWROUGHT",
    meta: "Holo · 6 listed · fills your slot 08",
    priceLabel: "$640",
    deltaLabel: "−12% vs comp",
    deltaColor: "#8BF285",
    category: "cards",
    art: ART_GRADIENT.vault_break,
  },
  {
    name: "Black Bay 58",
    meta: "Tudor · 2 offers on yours",
    priceLabel: "$3,400",
    deltaLabel: "your listing",
    deltaColor: "#F2C46B",
    category: "watches",
    art: ART_GRADIENT.archive,
  },
];

function RecentPullCard({ pull }: { pull: PullCardData }) {
  return (
    <View style={styles.pullCard}>
      <View style={styles.pullArtWrap}>
        <PackFace
          art={pull.art}
          imageUrl={pull.imageUrl}
          width={96}
          height={120}
          radius={12}
          borderColor={pull.borderColor}
          glowColor={pull.glowColor}
        />
        {pull.badge && (
          <View style={styles.pullBadge}>
            <Text style={[styles.pullBadgeText, pull.badge === "GRAIL" && { color: colors.watchesTop }]}>
              {pull.badge}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.pullHandle} numberOfLines={1}>
        {pull.handle}
      </Text>
      <Text style={styles.pullMeta}>
        {pull.priceLabel} · {pull.timeLabel}
      </Text>
    </View>
  );
}

/**
 * Real once `progress.hasData` (signed in, ≥1 owned item) — total value and the cards/watches
 * split both come straight off `/me/portfolio`. No day-over-day delta pill in that branch: the
 * API has no value-history to compute one from, and this screen never invents a number (see the
 * top-of-file comment for what a real delta and real per-set completion would each need
 * server-side). Falls back to the fully-dummy `SAMPLE_COLLECTION` card — delta pill included —
 * before sign-in or before a first pull, same as the rest of Home's placeholder content.
 */
function CollectionProgressCard({ progress }: { progress: CollectionProgressSummary }) {
  if (!progress.hasData) {
    return (
      <View style={styles.collectionCard}>
        <View style={styles.collectionHeaderRow}>
          <View>
            <Text style={styles.collectionEyebrow}>PORTFOLIO</Text>
            <Text style={styles.collectionValue}>{SAMPLE_COLLECTION.totalLabel}</Text>
          </View>
          <View style={styles.collectionDeltaPill}>
            <Text style={styles.collectionDeltaText}>{SAMPLE_COLLECTION.deltaLabel}</Text>
          </View>
        </View>
        <View style={styles.collectionDivider} />
        <View style={{ gap: spacing.md }}>
          {SAMPLE_COLLECTION.sets.map((set) => (
            <View key={set.name}>
              <View style={styles.setRow}>
                <Text style={styles.setName}>{set.name}</Text>
                <Text style={styles.setProgress}>
                  {set.current} / {set.total}
                </Text>
              </View>
              <View style={styles.setTrack}>
                <LinearGradient
                  colors={[set.art.top, set.art.bottom]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.setFill, { width: `${(set.current / set.total) * 100}%` }]}
                />
              </View>
              {set.note && <Text style={styles.setNote}>{set.note}</Text>}
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.collectionCard}>
      <View style={styles.collectionHeaderRow}>
        <View>
          <Text style={styles.collectionEyebrow}>PORTFOLIO</Text>
          <Text style={styles.collectionValue}>${(progress.totalValueCents / 100).toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.collectionDivider} />
      {/* One row per category actually held — real label and share, off `byCategory` — instead
          of two hardcoded Cards/Watches rows, so a third category (e.g. handbags) shows up here
          with its own name and never gets silently folded into (or dropped from) the split. */}
      <View style={{ gap: spacing.md }}>
        {progress.byCategory.map((c) => {
          // Cards/watches get their own accent color; any other category (e.g. handbags) shares
          // watches' as a generic fallback — same "cards is special, everything else shares
          // watches' treatment" rule as DoorCard's own accent lookup above.
          const accent = accents[c.categoryId as keyof typeof accents] ?? accents.watches;
          return (
            <View key={c.categoryId}>
              <View style={styles.setRow}>
                <Text style={styles.setName}>{c.label}</Text>
                <Text style={styles.setProgress}>{c.sharePercent}%</Text>
              </View>
              <View style={styles.setTrack}>
                <LinearGradient
                  colors={[accent.top, accent.bottom]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.setFill, { width: `${c.sharePercent}%` }]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ListingRow({ listing }: { listing: (typeof SAMPLE_LISTINGS)[number] }) {
  return (
    <View style={styles.listingRow}>
      {/* Cards keeps its own pack-face art; every other category shares the watch-dial
          treatment, same fallback rule as DoorCard/RealListingRow below. */}
      {listing.category === "cards" ? (
        <PackFace art={listing.art} width={42} height={58} radius={8} />
      ) : (
        <WatchDial art={listing.art} size={44} />
      )}
      <View style={styles.listingInfo}>
        <Text style={styles.listingName}>{listing.name}</Text>
        <Text style={styles.listingMeta}>{listing.meta}</Text>
      </View>
      <View style={styles.listingPriceWrap}>
        <Text style={styles.listingPrice}>{listing.priceLabel}</Text>
        <Text style={[styles.listingDelta, { color: listing.deltaColor }]}>{listing.deltaLabel}</Text>
      </View>
    </View>
  );
}

/**
 * A live `/listings` row — item, category, price, and seller are all real. No delta/comp line
 * here (unlike the dummy `ListingRow` above): there's no comp-price analytics endpoint to draw
 * one from, and this screen doesn't invent one just to fill the space the mockup left for it.
 */
function RealListingRow({ listing }: { listing: Listing }) {
  const item = listing.item;
  const art = itemArtGradient(item);

  return (
    <View style={styles.listingRow}>
      {/* Same cards-special/else-shared-watch-dial fallback as the rest of this file. */}
      {item.category === "cards" ? (
        <PackFace art={art} imageUrl={item.textureUrl} width={42} height={58} radius={8} />
      ) : (
        <WatchDial art={art} size={44} />
      )}
      <View style={styles.listingInfo}>
        <Text style={styles.listingName} numberOfLines={1}>
          {(item.cardTitle ?? item.watchName ?? item.name).toUpperCase()}
        </Text>
        <Text style={styles.listingMeta} numberOfLines={1}>
          {[item.collection ?? item.brand, listing.seller.username ? `@${listing.seller.username}` : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <View style={styles.listingPriceWrap}>
        <Text style={styles.listingPrice}>${(listing.priceCents / 100).toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: ink.groundDeep },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // Floats over the scroll content (like the bottom pill nav) so hiding it on scroll-down
  // doesn't leave a reserved, mismatched-colored strip behind it — same fix, same reason.
  headerOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandChip: { width: 26, height: 26, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.14)" },
  brandIcon: { width: "100%", height: "100%" },
  brandText: typography.navBrand,
  headerRight: { flexDirection: "row", alignItems: "center", gap: 9 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
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
  signInChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(177,75,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  signInText: typography.chipLabel,

  scroll: { padding: 20, paddingTop: 20, paddingBottom: 40 },
  scrollInner: { position: "relative", gap: spacing.xl },
  ambientWash: { position: "absolute", top: 0, left: 0, right: 0, height: 900 },

  featuredEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  featuredEyebrow: { ...typography.eyebrow, color: "#FF8DA1" },
  featured: {
    minHeight: 300,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(255,92,122,0.45)",
    padding: 18,
    overflow: "hidden",
  },
  featuredGlow: {
    position: "absolute",
    right: -30,
    top: -14,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255,201,74,0.16)",
  },
  // Exact size/position as GrailhausHome.js's own `heroCardWrap`.
  featuredPhotoCard: {
    position: "absolute",
    left: "42%",
    top: 8,
    width: "60%",
    height: 210,
    borderRadius: 12,
    overflow: "hidden",
    transform: [{ rotate: "6deg" }],
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  featuredKicker: { ...typography.eyebrow, color: "rgba(255,255,255,0.7)", maxWidth: 150, marginTop: spacing.md },
  featuredName: { ...typography.pageHeading, fontSize: 28, lineHeight: 30, marginTop: spacing.sm, maxWidth: 155 },
  featuredSub: { ...typography.packSub, marginTop: spacing.sm, maxWidth: 155 },
  // Icon + fact triplets — GrailhausHome.js's own `metaRow`/`metaItem`/`metaDivider`. Sits below
  // the photo's own bottom edge (see featuredPhotoCard's top+height) so it's free to span the
  // full card width without competing with the photo for room.
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: spacing.lg, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { ...typography.packSub, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  metaSmall: { fontSize: 9.5, letterSpacing: 1 },
  metaDivider: { width: 1, height: 13, backgroundColor: "rgba(255,255,255,0.2)" },
  pipRow: { flexDirection: "row", gap: 4, marginTop: spacing.md },
  pip: { flex: 1, height: 6, borderRadius: 4 },
  pipFilled: { backgroundColor: "#F2C46B" },
  pipEmpty: { backgroundColor: "rgba(255,255,255,0.14)" },
  // CTA + a real "ends in" countdown side by side — GrailhausHome.js's own `heroFooter`.
  heroFooter: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: spacing.lg },
  featuredCtaWrap: { flex: 1 },
  featuredCta: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
    shadowColor: "rgba(255,92,122,0.4)",
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 8,
  },
  featuredCtaLabel: { ...typography.chunkyButtonLabel, letterSpacing: 0.8 },
  endsInWrap: { alignItems: "center", paddingBottom: 6 },
  endsInLabel: { ...typography.footNote, letterSpacing: 1.6 },

  doors: { flexDirection: "row", gap: spacing.md },
  door: {
    width: 168,
    height: 135,
    borderRadius: 20,
    borderWidth: 2,
    padding: 15,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  doorArt: { position: "absolute", right: -10, bottom: -6, opacity: 0.85 },
  // Exact size/position as GrailhausHome.js's own `collImg`.
  doorPhoto: { position: "absolute", right: -6, top: 0, bottom: 0, width: "48%" },
  doorEyebrow: { ...typography.eyebrow, letterSpacing: 2 },
  doorName: { ...typography.packNameHero, fontSize: 22, marginTop: 6 },
  doorSub: { ...typography.packSub, marginTop: 5 },

  section: { gap: spacing.md },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  sectionHeaderText: { flex: 1, minWidth: 0 },
  sectionTitle: { ...typography.title, color: ink.text },
  sectionSub: { ...typography.sectionSub, marginTop: 2 },
  sectionAction: { ...typography.linkMuted, color: "#C99BFF" },
  upcomingRow: { gap: spacing.md },
  upcoming: {
    width: 168,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 13,
  },
  upcomingKickerRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  upcomingDot: { width: 6, height: 6, borderRadius: 3 },
  upcomingKicker: { ...typography.eyebrow, fontSize: 9, letterSpacing: 1.6 },
  upcomingName: { ...typography.packName, marginTop: 8 },
  upcomingSub: { ...typography.packSub, marginTop: 3 },
  upcomingFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 11 },
  notifyChip: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifyLabel: { ...typography.footNote, letterSpacing: 0.6 },

  revealedRow: { gap: spacing.sm },
  pullCard: { width: 96 },
  pullArtWrap: { position: "relative" },
  pullBadge: {
    position: "absolute",
    left: 5,
    top: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  pullBadgeText: { ...typography.tierPill, fontSize: 7, color: "#FFD75E" },
  pullHandle: { ...typography.footNote, color: ink.text, marginTop: 7 },
  pullMeta: { ...typography.footNote, marginTop: 1 },
  revealedEmpty: { ...typography.footNote, color: ink.textMuted },

  collectionCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    padding: 18,
  },
  collectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  collectionEyebrow: { ...typography.eyebrow, letterSpacing: 1.6 },
  collectionValue: { ...typography.pageHeading, fontSize: 30, marginTop: 6 },
  collectionDeltaPill: {
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "rgba(99,232,92,0.2)",
    borderWidth: 1,
    borderColor: "rgba(99,232,92,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  collectionDeltaText: { ...typography.chipLabel, color: "#8BF285" },
  collectionDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 14 },
  setRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  setName: { ...typography.body, color: ink.text },
  setProgress: { ...typography.chipLabel, color: "#8BF285" },
  setTrack: { height: 6, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)", marginTop: 6, overflow: "hidden" },
  setFill: { height: "100%", borderRadius: 4 },
  setNote: { ...typography.footNote, marginTop: 5 },

  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 11,
  },
  listingInfo: { flex: 1, minWidth: 0 },
  listingName: { ...typography.chipLabel, color: ink.text },
  listingMeta: { ...typography.footNote, marginTop: 2 },
  listingPriceWrap: { alignItems: "flex-end", flexShrink: 0 },
  listingPrice: { ...typography.chipLabel, color: ink.text },
  listingDelta: { ...typography.footNote, marginTop: 2 },
});
