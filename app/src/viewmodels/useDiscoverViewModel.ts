import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { Category, ItemDetail, Listing, OwnedItem, PackSku } from "@grailhaus/shared";
import { packsService } from "../services/packsService";
import { itemsService } from "../services/itemsService";
import { marketplaceService } from "../services/marketplaceService";
import { portfolioService } from "../services/portfolioService";
import { useAuthStore } from "../state/authStore";
import { useCategoriesViewModel } from "./useCategoriesViewModel";

export interface DiscoverItem {
  detail: ItemDetail;
  packId: string;
  packName: string;
  packPriceCents: number;
  ownedCount: number;
  listedCount: number;
  lowestListingCents: number | null;
}

export interface DiscoverGroup {
  key: string;
  label: string;
  subtitle: string;
  versions: DiscoverItem[];
  minValueCents: number;
  maxValueCents: number;
  ownedTotal: number;
}

/**
 * The pure part of Discover's premise — "Pikachu is not one object, it's nine printings" — needs
 * the full catalog roster grouped by real Pokémon/brand identity. Extracted from the hook below
 * so both the single-category hook (`useDiscoverViewModel`, for DiscoverCategoryScreen) and the
 * multi-category one (`useDiscoverAllCategoriesViewModel`, for ExploreScreen's "All ..." grids and
 * Collections' cross-category grouping) share one derivation instead of duplicating it.
 */
function deriveDiscoverData(
  category: Category,
  packs: PackSku[],
  items: ItemDetail[],
  listings: Listing[],
  owned: OwnedItem[]
) {
  const packByItemId = new Map<string, { packId: string; packName: string; packPriceCents: number }>();
  for (const pack of packs) {
    for (const packItems of Object.values(pack.itemsByTier)) {
      for (const item of packItems) {
        packByItemId.set(item.id, { packId: pack.id, packName: pack.name, packPriceCents: pack.priceCents });
      }
    }
  }

  const listedByItem = new Map<string, { count: number; lowestCents: number }>();
  for (const l of listings) {
    const entry = listedByItem.get(l.item.id);
    if (!entry) listedByItem.set(l.item.id, { count: 1, lowestCents: l.priceCents });
    else {
      entry.count += 1;
      entry.lowestCents = Math.min(entry.lowestCents, l.priceCents);
    }
  }
  const ownedByItem = new Map<string, number>();
  for (const o of owned) {
    ownedByItem.set(o.item.id, (ownedByItem.get(o.item.id) ?? 0) + 1);
  }

  const discoverItems: DiscoverItem[] = [];
  for (const detail of items) {
    const pack = packByItemId.get(detail.id);
    if (!pack) continue;
    const listed = listedByItem.get(detail.id);
    discoverItems.push({
      detail,
      packId: pack.packId,
      packName: pack.packName,
      packPriceCents: pack.packPriceCents,
      ownedCount: ownedByItem.get(detail.id) ?? 0,
      listedCount: listed?.count ?? 0,
      lowestListingCents: listed?.lowestCents ?? null,
    });
  }

  // Cards group by the Pokémon they depict — "Pikachu" is nine printings, not one card.
  // Watches group by brand — nobody types a reference number, they think "Rolex" first.
  // Any other category (e.g. handbags, which has neither a pokemonName nor a brand) falls back
  // to grouping by its own catalog name — every real item is still its own group, just not
  // merged under a false shared identity the way cards/watches printings/models are.
  const keyOf = (d: ItemDetail) => d.pokemonName ?? d.brand ?? d.name;
  const subtitleOf = (versions: DiscoverItem[]) => {
    const first = versions[0].detail;
    if (category === "cards") return first.pokemonType ?? "";
    if (category === "watches") return `${versions.length} model${versions.length === 1 ? "" : "s"}`;
    return `${versions.length} version${versions.length === 1 ? "" : "s"}`;
  };

  const map = new Map<string, DiscoverItem[]>();
  for (const item of discoverItems) {
    const key = keyOf(item.detail);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  const groups: DiscoverGroup[] = [...map.entries()]
    .map(([key, versions]) => {
      const sorted = [...versions].sort((a, b) => a.detail.rarityTierLevel - b.detail.rarityTierLevel);
      return {
        key,
        label: key,
        subtitle: subtitleOf(sorted),
        versions: sorted,
        minValueCents: Math.min(...sorted.map((v) => v.detail.currentValueCents)),
        maxValueCents: Math.max(...sorted.map((v) => v.detail.currentValueCents)),
        ownedTotal: sorted.reduce((sum, v) => sum + v.ownedCount, 0),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    items: discoverItems,
    groups,
    listedNowCount: listings.length,
    // `collection` is the generic "set" field real for any category; `brand` is watches-specific
    // — so watches counts distinct brands, and every other category (cards included, plus
    // anything added after, e.g. handbags) counts distinct collections instead.
    setOrBrandCount: new Set(discoverItems.map((i) => (category === "watches" ? i.detail.brand : i.detail.collection)))
      .size,
  };
}

/**
 * Built from four endpoints: `/packs` (which pack/price can drop each item), `/items` (full
 * catalog detail incl. live drift value, one bulk call per category), `/listings` and
 * `/me/portfolio` (ownership + market availability). Nothing here is simulated data standing in
 * for a search index that doesn't exist. Single-category version — used wherever exactly one
 * category is being browsed (DiscoverCategoryScreen). See `useDiscoverAllCategoriesViewModel`
 * below for the N-category version (Explore's "All ..." grids, Collections' cross-category
 * grouping).
 */
export function useDiscoverViewModel(category: Category) {
  const isSignedIn = useAuthStore((s) => s.token != null);
  const packsQuery = useQuery({ queryKey: ["packs", category], queryFn: () => packsService.list(category) });
  const itemsQuery = useQuery({ queryKey: ["items", category], queryFn: () => itemsService.list(category) });
  const listingsQuery = useQuery({ queryKey: ["listings", category], queryFn: () => marketplaceService.browse(category) });
  // `/me/portfolio` requires an app session — matches useSessionViewModel's gating on
  // `/me`, otherwise every signed-out mount fires a guaranteed 401.
  const portfolioQuery = useQuery({ queryKey: ["portfolio", "me"], queryFn: portfolioService.list, enabled: isSignedIn });

  const isLoading = packsQuery.isLoading || itemsQuery.isLoading || listingsQuery.isLoading || portfolioQuery.isLoading;

  const derived = useMemo(
    () =>
      deriveDiscoverData(
        category,
        packsQuery.data ?? [],
        itemsQuery.data ?? [],
        listingsQuery.data ?? [],
        portfolioQuery.data ?? []
      ),
    [category, packsQuery.data, itemsQuery.data, listingsQuery.data, portfolioQuery.data]
  );

  async function refetch() {
    await Promise.all([packsQuery.refetch(), itemsQuery.refetch(), listingsQuery.refetch(), portfolioQuery.refetch()]);
  }

  return {
    isLoading,
    error: packsQuery.error ? (packsQuery.error as Error).message : null,
    refetch,
    ...derived,
  };
}

/**
 * The N-category counterpart to `useDiscoverViewModel` above — every category in the categories
 * table, not a hardcoded cards/watches pair. `useQueries` (not a `.map` of `useDiscoverViewModel`
 * calls) is what makes fetching a variable, data-dependent number of categories safe — React's
 * rules of hooks forbid a component's own hook-call count changing between renders, which a plain
 * loop would do the moment `categories` grows from 0 to N once the categories list itself
 * finishes loading (same reasoning as useRarityTiersByCategory/useDiscoverHubViewModel).
 * `/me/portfolio` isn't category-scoped, so it's fetched once and shared across every category's
 * derivation, not refetched per category.
 */
export function useDiscoverAllCategoriesViewModel() {
  const { categories } = useCategoriesViewModel();
  const isSignedIn = useAuthStore((s) => s.token != null);

  const packsResults = useQueries({
    queries: categories.map((c) => ({ queryKey: ["packs", c.id], queryFn: () => packsService.list(c.id) })),
  });
  const itemsResults = useQueries({
    queries: categories.map((c) => ({ queryKey: ["items", c.id], queryFn: () => itemsService.list(c.id) })),
  });
  const listingsResults = useQueries({
    queries: categories.map((c) => ({ queryKey: ["listings", c.id], queryFn: () => marketplaceService.browse(c.id) })),
  });
  const portfolioQuery = useQuery({ queryKey: ["portfolio", "me"], queryFn: portfolioService.list, enabled: isSignedIn });

  const isLoading = packsResults.some((r) => r.isLoading) || itemsResults.some((r) => r.isLoading) || portfolioQuery.isLoading;

  const byCategory = useMemo(() => {
    const owned = portfolioQuery.data ?? [];
    const out: Record<string, ReturnType<typeof deriveDiscoverData> & { categoryId: string; label: string }> = {};
    categories.forEach((c, i) => {
      out[c.id] = {
        categoryId: c.id,
        label: c.label,
        ...deriveDiscoverData(
          c.id,
          packsResults[i]?.data ?? [],
          itemsResults[i]?.data ?? [],
          listingsResults[i]?.data ?? [],
          owned
        ),
      };
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, portfolioQuery.data, ...packsResults.map((r) => r.data), ...itemsResults.map((r) => r.data), ...listingsResults.map((r) => r.data)]);

  const allItems = useMemo(() => Object.values(byCategory).flatMap((c) => c.items), [byCategory]);

  async function refetch() {
    await Promise.all([
      ...packsResults.map((r) => r.refetch()),
      ...itemsResults.map((r) => r.refetch()),
      ...listingsResults.map((r) => r.refetch()),
      portfolioQuery.refetch(),
    ]);
  }

  return { isLoading, byCategory, allItems, refetch };
}
