import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Listing } from "@grailhaus/shared";
import { packsService } from "../services/packsService";
import { marketplaceService } from "../services/marketplaceService";
import { useDropsViewModel } from "./useDropsViewModel";
import { useCollectionViewModel } from "./useCollectionViewModel";
import { useCategoriesViewModel } from "./useCategoriesViewModel";
import { useStableValue } from "../hooks/useStableValue";

export interface CategorySummary {
  tierCount: number;
  fromPriceCents: number | null;
}

/** One category's row in the Collection Progress card — real label off the categories table
 * (never a hardcoded "Cards"/"Watches" pair), so a third category's holdings render with its own
 * name instead of being unlabeled or dropped. */
export interface CollectionProgressCategory {
  categoryId: string;
  label: string;
  sharePercent: number;
  valueCents: number;
}

export interface CollectionProgressSummary {
  /** False until this account is signed in *and* actually owns something — there's no
   * real number to show before that, so the screen falls back to its own placeholder. */
  hasData: boolean;
  totalValueCents: number;
  byCategory: CollectionProgressCategory[];
}

const MARKETPLACE_HIGHLIGHTS_LIMIT = 3;

/**
 * Home's door cards need a tier count + starting price per category, which
 * is just the evergreen slice of the same catalog Shelf/World already reads
 * (see useShelfViewModel) — no separate endpoint. Shares its `["packs",
 * "all"]` query with useDropsViewModel's identical call; react-query
 * dedupes by key, so this doesn't cost a second network request.
 *
 * Collection Progress and Marketplace Highlights are real as far as the API goes today —
 * `/me/portfolio` and `/listings` back them — but each still has fields the mockup wants that
 * no endpoint provides yet (day-over-day portfolio delta, per-set completion counts, comp-price
 * deltas, offer counts). See HomeScreen.tsx's own top comment for the itemized list; this
 * viewmodel only ever returns real numbers, never invents the missing ones.
 *
 * `evergreenByCategory`/`featuredDrop`/`upcomingDrops` are wrapped in `useStableValue`: this
 * hook shares its `["packs", "all"]` query with useDropsViewModel, which polls every 10s
 * whenever a live/soon drop exists (so its stock/countdown stay fresh) — every poll hands back
 * a new top-level array reference even when nothing this screen actually shows changed, and
 * without stabilizing, that cascaded into the *whole* Home screen (Explore doors, Portfolio
 * card, Marketplace section — none of which have anything to do with a live drop's stock)
 * re-rendering every 10 seconds. `useStableValue` keeps the same reference unless the derived
 * value is actually different, so an unrelated screen doesn't repaint just because a drop ticked.
 */
export function useHomeViewModel() {
  const packsQuery = useQuery({
    queryKey: ["packs", "all"],
    queryFn: () => packsService.list(),
  });
  const { drops, isLoading: dropsLoading } = useDropsViewModel();
  const collection = useCollectionViewModel();
  const listingsQuery = useQuery({ queryKey: ["listings", "all"], queryFn: () => marketplaceService.browse() });
  const { categories, byId: categoriesById, refetch: refetchCategories } = useCategoriesViewModel();

  // Keyed by every category in the categories table, not a hardcoded cards/watches pair — a
  // category with zero evergreen packs yet still gets an entry (tierCount 0), same "show it, but
  // empty" rule the admin dashboard's own per-category pages already follow.
  const evergreenByCategoryRaw = useMemo<Record<string, CategorySummary>>(() => {
    const evergreen = (packsQuery.data ?? []).filter((p) => p.goesLiveAt == null);
    const summarize = (category: string): CategorySummary => {
      const packs = evergreen.filter((p) => p.category === category);
      const prices = packs.map((p) => p.priceCents);
      return { tierCount: packs.length, fromPriceCents: prices.length ? Math.min(...prices) : null };
    };
    return Object.fromEntries(categories.map((c) => [c.id, summarize(c.id)]));
  }, [packsQuery.data, categories]);
  const evergreenByCategory = useStableValue(evergreenByCategoryRaw);

  // A "soon" drop is promoted to Featured too, not just "live" ones — the banner should always
  // have something to show (with a real countdown, to goesLiveAt while soon or endsAt while
  // live) rather than only appearing once a drop happens to already be open. Ties among several
  // "soon" drops go to whichever goes live soonest.
  const featuredDropRaw = useMemo(() => {
    const live = drops.find((d) => d.phase === "live");
    if (live) return live;
    const soon = drops
      .filter((d) => d.phase === "soon" && d.sku.goesLiveAt != null)
      .sort((a, b) => new Date(a.sku.goesLiveAt!).getTime() - new Date(b.sku.goesLiveAt!).getTime());
    return soon[0] ?? null;
  }, [drops]);
  // Whichever drop is already shown as Featured above doesn't also get a duplicate row here.
  const upcomingDropsRaw = useMemo(
    () => drops.filter((d) => d.phase === "soon" && d.sku.id !== featuredDropRaw?.sku.id),
    [drops, featuredDropRaw]
  );
  const featuredDrop = useStableValue(featuredDropRaw);
  const upcomingDrops = useStableValue(upcomingDropsRaw);

  const collectionProgress = useMemo<CollectionProgressSummary>(
    () => ({
      hasData: collection.isSignedIn && collection.owned.length > 0,
      totalValueCents: collection.totalValueCents,
      byCategory: collection.byCategory.map((c) => ({
        categoryId: c.categoryId,
        label: categoriesById.get(c.categoryId)?.label ?? c.categoryId,
        sharePercent: c.sharePercent,
        valueCents: c.valueCents,
      })),
    }),
    [collection.isSignedIn, collection.owned.length, collection.totalValueCents, collection.byCategory, categoriesById]
  );

  const recentListings = useMemo<Listing[]>(
    () =>
      [...(listingsQuery.data ?? [])]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MARKETPLACE_HIGHLIGHTS_LIMIT),
    [listingsQuery.data]
  );

  async function refetch() {
    // packsQuery shares its ["packs","all"] key with useDropsViewModel (see the comment above),
    // so refetching it also refreshes `drops` — no separate drops refetch needed.
    await Promise.all([packsQuery.refetch(), listingsQuery.refetch(), collection.refetch(), refetchCategories()]);
  }

  return {
    evergreenByCategory,
    featuredDrop,
    upcomingDrops,
    collectionProgress,
    recentListings,
    isLoading: packsQuery.isLoading || dropsLoading,
    refetch,
  };
}
