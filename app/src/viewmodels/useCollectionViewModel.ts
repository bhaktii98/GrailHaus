import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OwnedItem } from "@grailhaus/shared";
import { portfolioService } from "../services/portfolioService";
import { useAuthStore } from "../state/authStore";

export interface CollectionGroup {
  key: string;
  label: string;
  items: OwnedItem[];
  valueCents: number;
}

/** One category's slice of the signed-in user's owned items — every category actually present in
 * `owned`, not just cards/watches, so a category added after this pass (e.g. handbags) still
 * shows up in anything that reads this instead of the two dedicated `cards`/`watches` arrays
 * below. See `useHomeViewModel`'s `collectionProgress` for the consumer this exists for. */
export interface CollectionCategoryBreakdown {
  categoryId: string;
  items: OwnedItem[];
  valueCents: number;
  sharePercent: number;
}

/**
 * ViewModel for the Portfolio hub and both category worlds (Binder / Vault).
 * `/me/portfolio` is the only server truth here — grouping and totals are all
 * derived client-side from it, nothing here is invented data.
 */
export function useCollectionViewModel() {
  const isSignedIn = useAuthStore((s) => s.token != null);
  // `/me/portfolio` requires an app session — matches useSessionViewModel's gating on
  // `/me`, otherwise every signed-out mount fires a guaranteed 401.
  const query = useQuery({
    queryKey: ["portfolio", "me"],
    queryFn: portfolioService.list,
    enabled: isSignedIn,
  });

  const owned = query.data ?? [];

  // `cards`/`watches` stay as their own dedicated slices — Binder and Vault are real, separate
  // browse screens that only ever show one of these two worlds (there's no generic "world" screen
  // for a category added after them yet, e.g. handbags), so they need exactly this shape.
  const cards = useMemo(() => owned.filter((o) => o.item.category === "cards"), [owned]);
  const watches = useMemo(() => owned.filter((o) => o.item.category === "watches"), [owned]);

  const totalValueCents = useMemo(() => owned.reduce((sum, o) => sum + o.item.currentValueCents, 0), [owned]);
  const cardsValueCents = useMemo(() => cards.reduce((sum, o) => sum + o.item.currentValueCents, 0), [cards]);
  const watchesValueCents = useMemo(() => watches.reduce((sum, o) => sum + o.item.currentValueCents, 0), [watches]);

  // Real groupings only — `collection`/`brand` come straight off the catalog row, never guessed.
  const collections = useMemo(() => groupBy(cards, (o) => o.item.collection ?? "Uncategorized"), [cards]);
  const brands = useMemo(() => groupBy(watches, (o) => o.item.brand ?? "Independent"), [watches]);

  // The generalized counterpart to `cards`/`watches` above — every category actually present in
  // `owned`, sorted by value. Anything that needs to show/sum a user's *whole* collection by
  // category (not drill into one dedicated world screen) should read this instead of naming
  // "cards" and "watches" directly, so a third category's value is never silently dropped.
  const byCategory = useMemo<CollectionCategoryBreakdown[]>(() => {
    const map = new Map<string, OwnedItem[]>();
    for (const o of owned) {
      const categoryId = o.item.category;
      if (!map.has(categoryId)) map.set(categoryId, []);
      map.get(categoryId)!.push(o);
    }
    return [...map.entries()]
      .map(([categoryId, items]) => {
        const valueCents = items.reduce((sum, o) => sum + o.item.currentValueCents, 0);
        return {
          categoryId,
          items,
          valueCents,
          sharePercent: totalValueCents > 0 ? Math.round((valueCents / totalValueCents) * 100) : 0,
        };
      })
      .sort((a, b) => b.valueCents - a.valueCents);
  }, [owned, totalValueCents]);

  return {
    isSignedIn,
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    owned,
    cards,
    watches,
    totalValueCents,
    cardsValueCents,
    watchesValueCents,
    byCategory,
    collections,
    brands,
    refetch: () => query.refetch(),
  };
}

function groupBy(items: OwnedItem[], keyFn: (item: OwnedItem) => string): CollectionGroup[] {
  const map = new Map<string, OwnedItem[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()]
    .map(([key, groupItems]) => ({
      key,
      label: key,
      items: groupItems,
      valueCents: groupItems.reduce((sum, o) => sum + o.item.currentValueCents, 0),
    }))
    .sort((a, b) => b.valueCents - a.valueCents);
}
