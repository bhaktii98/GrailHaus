import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Category, Listing, RarityTierLevel } from "@grailhaus/shared";
import { useSessionViewModel } from "../../viewmodels/useSessionViewModel";
import { useMarketplaceViewModel } from "../../viewmodels/useMarketplaceViewModel";
import { useRarityTiers } from "../../viewmodels/useRarityTiers";
import { useTabBarClearance } from "../../navigation/tabBarVisibility";
import { SignInPrompt } from "../../components/SignInPrompt";
import { CardFace } from "../../components/CardFace";
import { WatchDial } from "../../components/WatchDial";
import { itemArtGradient } from "../../content/cardArt";
import { colors, ink, typography } from "../../theme/tokens";
import { marketplace as copy } from "../../content/copy";
import type { MarketplaceStackParamList } from "../../navigation/MarketplaceStack";

type Nav = NativeStackNavigationProp<MarketplaceStackParamList, "Marketplace">;

const CATEGORY_TABS: { key: Category | null; label: string }[] = [
  { key: null, label: "All" },
  { key: "cards", label: "Cards" },
  { key: "watches", label: "Watches" },
];

interface PriceBand {
  key: string;
  label: string;
  min: number;
  max: number | null;
}

/** Real quartile bands off whatever's actually listed right now — never fixed dollar amounts,
 * since cards ($5–$1k+) and watches ($500–$50k+) sit on completely different price scales. */
function computePriceBands(listings: Listing[]): PriceBand[] {
  if (listings.length < 4) return [];
  const prices = listings.map((l) => l.priceCents).sort((a, b) => a - b);
  const at = (p: number) => prices[Math.min(prices.length - 1, Math.floor(p * (prices.length - 1)))];
  const p25 = at(0.25);
  const p50 = at(0.5);
  const p75 = at(0.75);
  const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;
  const bands: PriceBand[] = [{ key: "b0", label: `Under ${fmt(p25)}`, min: 0, max: p25 }];
  if (p50 > p25) bands.push({ key: "b1", label: `${fmt(p25)}–${fmt(p50)}`, min: p25, max: p50 });
  if (p75 > p50) bands.push({ key: "b2", label: `${fmt(p50)}–${fmt(p75)}`, min: p50, max: p75 });
  bands.push({ key: "b3", label: `${fmt(p75)}+`, min: p75, max: null });
  return bands;
}

/**
 * Browse split from My Listings at the top (mockup 12a) so a seller never has to leave the
 * marketplace to check their own book. "My Listings" is filtered client-side by username —
 * `/listings` is a public, unauthenticated-friendly browse endpoint with no seller filter, and
 * `Listing.seller.id` is deliberately an opaque public id rather than the caller's own profile
 * id, so username is the only real signal available to match "is this mine" here.
 */
export function MarketplaceScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const session = useSessionViewModel();
  // A fixed per-card width rather than `flex: 1` — with `numColumns={2}` and an odd (or just
  // sparse) result count, a flex:1 lone card in its row stretches to the full row width instead
  // of sitting at half-width like every other card, which reads as broken rather than "just one
  // result." Matches grid's 20px side padding + gridRow's 12px inter-column gap.
  const { width: windowWidth } = useWindowDimensions();
  const cardCellWidth = (windowWidth - 20 * 2 - 12) / 2;
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [category, setCategory] = useState<Category | null>(null);
  const vm = useMarketplaceViewModel(category ?? undefined);
  const tabBarClearance = useTabBarClearance();

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [rarityFilter, setRarityFilter] = useState<RarityTierLevel | null>(null);
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [identityFilter, setIdentityFilter] = useState<string | null>(null);
  const [priceBandKey, setPriceBandKey] = useState<string | null>(null);
  // Rarity/Collection/Brand-Pokémon tier names and groupings differ per category, so those three
  // facets only make sense once a specific category is picked — Price alone works across both
  // since it's just real dollar quartiles, category-agnostic.
  const rarityTiers = useRarityTiers(category ?? "cards");

  const scopedListings = useMemo(() => {
    if (tab === "browse") return vm.listings;
    if (!session.profile?.username) return [];
    return vm.listings.filter((l) => l.seller.username === session.profile!.username);
  }, [vm.listings, tab, session.profile]);

  const mineCount = useMemo(
    () => (session.profile?.username ? vm.listings.filter((l) => l.seller.username === session.profile!.username).length : 0),
    [vm.listings, session.profile]
  );

  const collectionOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of scopedListings) {
      const key = l.item.collection ?? "Uncategorized";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  }, [scopedListings]);

  const identityOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of scopedListings) {
      // Flat fallback chain instead of a category check — exactly one of these two is ever set
      // per real cards/watches item; a category with neither (e.g. handbags) has no meaningful
      // "identity" grouping and is skipped below by the `if (!key) continue`, same as today.
      const key = l.item.pokemonName ?? l.item.brand;
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  }, [scopedListings]);

  const rarityOptions = useMemo(() => {
    const levels: RarityTierLevel[] = [1, 2, 3];
    return levels
      .map((level) => ({
        level,
        label: rarityTiers[level]?.name ?? "",
        count: scopedListings.filter((l) => l.item.rarityTierLevel === level).length,
      }))
      .filter((r) => r.count > 0);
  }, [scopedListings, rarityTiers]);

  const priceBands = useMemo(() => computePriceBands(scopedListings), [scopedListings]);
  const activePriceBand = priceBands.find((b) => b.key === priceBandKey) ?? null;

  const activeFilterCount =
    (rarityFilter != null ? 1 : 0) + (collectionFilter != null ? 1 : 0) + (identityFilter != null ? 1 : 0) + (activePriceBand ? 1 : 0);

  const listings = useMemo(() => {
    return scopedListings.filter((l) => {
      if (rarityFilter != null && l.item.rarityTierLevel !== rarityFilter) return false;
      if (collectionFilter != null && (l.item.collection ?? "Uncategorized") !== collectionFilter) return false;
      if (identityFilter != null) {
        const identity = l.item.pokemonName ?? l.item.brand;
        if (identity !== identityFilter) return false;
      }
      if (activePriceBand) {
        if (l.priceCents < activePriceBand.min) return false;
        if (activePriceBand.max != null && l.priceCents > activePriceBand.max) return false;
      }
      return true;
    });
  }, [scopedListings, rarityFilter, collectionFilter, identityFilter, activePriceBand]);

  function handleCategoryChange(next: Category | null) {
    setCategory(next);
    setRarityFilter(null);
    setCollectionFilter(null);
    setIdentityFilter(null);
  }

  function handleClearFilters() {
    setRarityFilter(null);
    setCollectionFilter(null);
    setIdentityFilter(null);
    setPriceBandKey(null);
  }

  return (
    <View style={styles.fill}>
      {/* Bounded to the fixed header+toggle+filter rows (never scrolls) rather than the whole
          screen — a full-screen wash here would stay pinned behind the grid's scrolled rows too. */}
      <LinearGradient colors={["rgba(177,75,255,0.24)", "transparent"]} style={styles.base} />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>{copy.title}</Text>
        {session.balanceCents != null && (
          <View style={styles.balancePill}>
            <LinearGradient colors={["#FFE27A", "#E0A016"]} style={styles.coin} />
            <Text style={styles.balanceText}>{(session.balanceCents / 100).toLocaleString()}</Text>
          </View>
        )}
      </View>

      <View style={styles.toggleRow}>
        <Pressable style={styles.toggleBtn} onPress={() => setTab("browse")}>
          {tab === "browse" ? (
            <LinearGradient colors={["#B14BFF", "#5B1FD6"]} style={styles.toggleFill}>
              <Text style={styles.toggleLabelActive}>{copy.browse}</Text>
            </LinearGradient>
          ) : (
            <View style={styles.toggleInactive}>
              <Text style={styles.toggleLabel}>{copy.browse}</Text>
            </View>
          )}
        </Pressable>
        <Pressable style={styles.toggleBtn} onPress={() => setTab("mine")}>
          {tab === "mine" ? (
            <LinearGradient colors={["#B14BFF", "#5B1FD6"]} style={styles.toggleFill}>
              <Text style={styles.toggleLabelActive}>{copy.myListings}</Text>
              {mineCount > 0 && <Badge n={mineCount} />}
            </LinearGradient>
          ) : (
            <View style={styles.toggleInactive}>
              <Text style={styles.toggleLabel}>{copy.myListings}</Text>
              {mineCount > 0 && <Badge n={mineCount} />}
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {CATEGORY_TABS.map((c) => (
          <Pressable
            key={c.label}
            style={[styles.chip, category === c.key && styles.chipActive]}
            onPress={() => handleCategoryChange(c.key)}
          >
            <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>{c.label}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={() => setFilterSheetOpen(true)}
        >
          <Text style={[styles.filterButtonText, activeFilterCount > 0 && styles.filterButtonTextActive]}>
            {copy.filters}
            {activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
          </Text>
        </Pressable>
      </View>

      {tab === "mine" && !session.isSignedIn ? (
        <SignInPrompt title={copy.signInTitle} body={copy.signInBody} />
      ) : vm.isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.textSecondary} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l: Listing) => l.id}
          numColumns={2}
          contentContainerStyle={[styles.grid, { paddingBottom: tabBarClearance }]}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={
            <Text style={styles.empty}>{tab === "browse" ? copy.empty : copy.myListingsEmpty}</Text>
          }
          renderItem={({ item: listing }: { item: Listing }) => (
            <Pressable
              style={[styles.card, { width: cardCellWidth }]}
              onPress={() => navigation.navigate("ListingDetail", { listing })}
            >
              {/* Cards keeps its own rectangular card-face art; every other category (watches,
                  and anything added after, e.g. handbags) shares the watch-dial treatment as a
                  generic fallback — same rule as the rest of this pass. */}
              {listing.item.category === "cards" ? (
                <CardFace
                  gradient={itemArtGradient(listing.item)}
                  imageUrl={listing.item.textureUrl}
                  width={cardCellWidth - 18}
                  height={132}
                  style={styles.cellFace}
                />
              ) : (
                <View style={styles.watchCardFace}>
                  <WatchDial art={itemArtGradient(listing.item)} size={110} />
                </View>
              )}
              <Text style={styles.cardName} numberOfLines={1}>
                {(listing.item.cardTitle ?? listing.item.watchName ?? listing.item.name).toUpperCase()}
              </Text>
              <Text style={styles.cardSub} numberOfLines={1}>
                {listing.item.collection ?? listing.item.brand ?? ""}
              </Text>
              <Text style={styles.cardPrice}>${(listing.priceCents / 100).toLocaleString()}</Text>
            </Pressable>
          )}
        />
      )}

      <FilterSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        category={category}
        rarityOptions={rarityOptions}
        collectionOptions={collectionOptions}
        identityOptions={identityOptions}
        priceBands={priceBands}
        rarityFilter={rarityFilter}
        collectionFilter={collectionFilter}
        identityFilter={identityFilter}
        priceBandKey={priceBandKey}
        onRarityChange={setRarityFilter}
        onCollectionChange={setCollectionFilter}
        onIdentityChange={setIdentityFilter}
        onPriceBandChange={setPriceBandKey}
        onClearAll={handleClearFilters}
      />
    </View>
  );
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  category: Category | null;
  rarityOptions: { level: RarityTierLevel; label: string; count: number }[];
  collectionOptions: { label: string; count: number }[];
  identityOptions: { label: string; count: number }[];
  priceBands: PriceBand[];
  rarityFilter: RarityTierLevel | null;
  collectionFilter: string | null;
  identityFilter: string | null;
  priceBandKey: string | null;
  onRarityChange: (level: RarityTierLevel | null) => void;
  onCollectionChange: (label: string | null) => void;
  onIdentityChange: (label: string | null) => void;
  onPriceBandChange: (key: string | null) => void;
  onClearAll: () => void;
}

/**
 * Real facets only — every chip's count comes off whatever's actually listed right now
 * (`scopedListings` in the parent), never an invented total. Rarity/Collection/Brand-Pokémon
 * need a specific category picked first since their vocabulary (tier names, identity field)
 * differs between cards and watches; Price alone works across "All" too since it's just dollar
 * quartiles of whatever's currently in view.
 */
function FilterSheet({
  visible,
  onClose,
  category,
  rarityOptions,
  collectionOptions,
  identityOptions,
  priceBands,
  rarityFilter,
  collectionFilter,
  identityFilter,
  priceBandKey,
  onRarityChange,
  onCollectionChange,
  onIdentityChange,
  onPriceBandChange,
  onClearAll,
}: FilterSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.overlay} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.titleRow}>
            <Text style={sheetStyles.title}>{copy.filtersTitle}</Text>
            <Pressable onPress={onClearAll}>
              <Text style={sheetStyles.clearAll}>{copy.clearFilters}</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={sheetStyles.scroll}>
            <FacetSection title={copy.facetPrice}>
              {priceBands.length === 0 ? (
                <Text style={sheetStyles.emptyNote}>{copy.pickCategoryFirst}</Text>
              ) : (
                <View style={sheetStyles.chipWrap}>
                  {priceBands.map((band) => (
                    <FilterChip
                      key={band.key}
                      label={band.label}
                      active={priceBandKey === band.key}
                      onPress={() => onPriceBandChange(priceBandKey === band.key ? null : band.key)}
                    />
                  ))}
                </View>
              )}
            </FacetSection>

            <FacetSection title={copy.facetRarity}>
              {!category || rarityOptions.length === 0 ? (
                <Text style={sheetStyles.emptyNote}>{copy.pickCategoryFirst}</Text>
              ) : (
                <View style={sheetStyles.chipWrap}>
                  {rarityOptions.map((r) => (
                    <FilterChip
                      key={r.level}
                      label={`${r.label} · ${r.count}`}
                      active={rarityFilter === r.level}
                      onPress={() => onRarityChange(rarityFilter === r.level ? null : r.level)}
                    />
                  ))}
                </View>
              )}
            </FacetSection>

            <FacetSection title={copy.facetCollection}>
              {!category || collectionOptions.length === 0 ? (
                <Text style={sheetStyles.emptyNote}>{copy.pickCategoryFirst}</Text>
              ) : (
                <View style={sheetStyles.chipWrap}>
                  {collectionOptions.map((c) => (
                    <FilterChip
                      key={c.label}
                      label={`${c.label} · ${c.count}`}
                      active={collectionFilter === c.label}
                      onPress={() => onCollectionChange(collectionFilter === c.label ? null : c.label)}
                    />
                  ))}
                </View>
              )}
            </FacetSection>

            <FacetSection title={category ? copy.facetIdentity[category] : "Pokémon / Brand"}>
              {!category || identityOptions.length === 0 ? (
                <Text style={sheetStyles.emptyNote}>{copy.pickCategoryFirst}</Text>
              ) : (
                <View style={sheetStyles.chipWrap}>
                  {identityOptions.map((o) => (
                    <FilterChip
                      key={o.label}
                      label={`${o.label} · ${o.count}`}
                      active={identityFilter === o.label}
                      onPress={() => onIdentityChange(identityFilter === o.label ? null : o.label)}
                    />
                  ))}
                </View>
              )}
            </FacetSection>
          </ScrollView>

          <Pressable style={sheetStyles.applyButton} onPress={onClose}>
            <Text style={sheetStyles.applyLabel}>{copy.applyFilters}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FacetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sheetStyles.section}>
      <Text style={sheetStyles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[sheetStyles.chip, active && sheetStyles.chipActive]} onPress={onPress}>
      <Text style={[sheetStyles.chipText, active && sheetStyles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{n}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: ink.groundDeep },
  base: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: typography.heroWordmark,
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
  toggleRow: { flexDirection: "row", gap: 5, paddingHorizontal: 20, paddingTop: 18 },
  toggleBtn: { flex: 1, height: 42 },
  toggleFill: { flex: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  toggleInactive: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  toggleLabel: { ...typography.chipLabel, fontSize: 13.5, color: "rgba(255,255,255,0.55)" },
  toggleLabelActive: { ...typography.chipLabel, fontSize: 13.5, color: "#fff" },
  badge: {
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: "#FF5C7A",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { ...typography.footNote, fontWeight: "900" as const, color: "#fff", fontSize: 10.5 },
  chipRow: { flexDirection: "row", gap: 7, paddingHorizontal: 20, paddingTop: 14 },
  chip: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: "rgba(177,75,255,0.24)", borderColor: "rgba(177,75,255,0.6)" },
  chipText: { ...typography.metaLine, fontSize: 11.5, color: "rgba(255,255,255,0.55)" },
  chipTextActive: { color: "#E0C4FF" },
  filterButton: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    marginLeft: "auto",
  },
  filterButtonActive: { backgroundColor: "rgba(255,215,94,0.16)", borderColor: "rgba(255,215,94,0.5)" },
  filterButtonText: { ...typography.metaLine, fontSize: 11.5, color: "rgba(255,255,255,0.55)" },
  filterButtonTextActive: { color: "#FFD75E" },
  loading: { marginTop: 60 },
  grid: { padding: 20, gap: 12 },
  gridRow: { gap: 12 },
  card: {
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
    padding: 9,
  },
  cellFace: { width: "100%" },
  watchCardFace: { height: 132, alignItems: "center", justifyContent: "center" },
  cardName: { ...typography.footNote, fontWeight: "800" as const, color: "#fff", marginTop: 9, fontSize: 11.5 },
  cardSub: { ...typography.footNote, marginTop: 2, fontSize: 10 },
  cardPrice: { ...typography.title, fontSize: 16, marginTop: 7, color: "#fff" },
  empty: { ...typography.sectionSub, textAlign: "center", marginTop: 60, width: "100%" },
});

const sheetStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(6,3,14,0.72)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "80%",
    backgroundColor: "#171029",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderTopColor: "rgba(255,255,255,0.16)",
    padding: 22,
    paddingBottom: 30,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.24)",
    alignSelf: "center",
    marginBottom: 16,
  },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { ...typography.pageHeading, fontSize: 20 },
  clearAll: { ...typography.chipLabel, fontSize: 12, color: "#C99BFF" },
  scroll: { marginTop: 16 },
  section: { marginBottom: 20 },
  sectionLabel: { ...typography.eyebrow, marginBottom: 10 },
  emptyNote: { ...typography.footNote, fontStyle: "italic" as const },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: "rgba(177,75,255,0.24)", borderColor: "rgba(177,75,255,0.6)" },
  chipText: { ...typography.metaLine, fontSize: 12, color: "rgba(255,255,255,0.6)" },
  chipTextActive: { color: "#E0C4FF" },
  applyButton: {
    marginTop: 6,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.violetTop,
    alignItems: "center",
    justifyContent: "center",
  },
  applyLabel: { ...typography.buttonLabel, color: "#fff" },
});
