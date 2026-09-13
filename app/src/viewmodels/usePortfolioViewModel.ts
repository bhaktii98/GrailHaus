import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { computePriceDrift, driftParams, driftValueAt } from "@grailhaus/shared";
import type { Category, OwnedItem, PortfolioSummary } from "@grailhaus/shared";
import { portfolioService } from "../services/portfolioService";
import { useAuthStore } from "../state/authStore";
import { useDriftClock } from "../lib/driftClock";

export type PortfolioFilter = "all" | Category;
export type PortfolioSort = "value" | "pnl" | "recent";

/** One holding, marked to the current drift tick. `item.currentValueCents` off the wire is only
 * as fresh as the last fetch; `valueCents` here is recomputed locally every 30s from the same
 * formula the server uses, so it never lags what the item is actually worth. */
export interface Position {
  owned: OwnedItem;
  valueCents: number;
  costBasisCents: number | null;
  /** Null when the cost basis isn't derivable — never silently 0, which would read as pure profit. */
  pnlCents: number | null;
  pnlPercent: number | null;
  isListed: boolean;
}

/** One category's slice of the live-ticked positions — every category actually held, not just
 * cards/watches, so a third category (e.g. handbags) is never silently excluded from the
 * allocation breakdown or (more importantly) from any *total* summed across this array. */
export interface CategoryPosition {
  categoryId: string;
  positions: Position[];
  valueCents: number;
  sharePercent: number;
  pnlCents: number;
}

/** How often the holdings list and the money aggregates are re-fetched. Deliberately slow: these
 * queries answer "what do I own / what did I spend", which only changes when the user rips, buys,
 * or sells — and every one of those paths already invalidates `["portfolio", "me"]` explicitly.
 * This interval is the safety net for changes made on another device, not the mechanism that
 * keeps prices live (see `useDriftClock`). */
const OWNERSHIP_POLL_MS = 120_000;

/** Sparkline resolution and window. Sixty points over six hours reads as a trend without pretending
 * to per-second precision the underlying simulation doesn't have. */
const SPARKLINE_WINDOW_MS = 6 * 60 * 60 * 1000;
const SPARKLINE_POINTS = 60;
/** The historical part of the sparkline is recomputed on this cadence rather than on every 30s
 * tick: summing the drift formula across every holding at 60 timestamps is real work on a large
 * collection, and a six-hour window sliding by 30 seconds is a change nobody can see. The live
 * right-hand point is appended from the tick-fresh total instead, so the chart's leading edge is
 * always current even between recomputes. */
const SPARKLINE_REFRESH_MS = 5 * 60 * 1000;

/**
 * The Portfolio tab's viewmodel: server-owned money facts plus a locally-ticked mark-to-market.
 *
 * The division of labour is deliberate. `/me/portfolio/summary` owns everything that comes out of
 * the ledger — wallet, spend, sales, realized P&L, and the cost basis of every holding — because
 * those are facts about rows in the database that a client cannot derive and must not guess, and
 * because they have to cover the *whole* collection rather than whatever page the grid fetched.
 * Current value and unrealized P&L are recomputed here on every drift tick, because those are a
 * pure function of time that the client can evaluate exactly (see `useDriftClock` for why that
 * beats both polling and a push channel).
 *
 * The two never disagree: both sides call the same `computePriceDrift` from `@grailhaus/shared`.
 * The summary's own `valueCents` is used only as the value at `valuedAt`; anything shown as a live
 * number comes from `live` below.
 */
export function usePortfolioViewModel() {
  const isSignedIn = useAuthStore((s) => s.token != null);
  const now = useDriftClock();
  const [filter, setFilter] = useState<PortfolioFilter>("all");
  const [sort, setSort] = useState<PortfolioSort>("value");

  const holdingsQuery = useQuery({
    queryKey: ["portfolio", "me"],
    queryFn: portfolioService.list,
    enabled: isSignedIn,
    refetchInterval: OWNERSHIP_POLL_MS,
  });

  // A child of `["portfolio", "me"]` on purpose: every existing invalidation of that key (rip,
  // buy, sell, delist, sign-in) already matches by prefix, so the summary refreshes alongside the
  // holdings without a single extra call site needing to know it exists.
  const summaryQuery = useQuery({
    queryKey: ["portfolio", "me", "summary"],
    queryFn: portfolioService.summary,
    enabled: isSignedIn,
    refetchInterval: OWNERSHIP_POLL_MS,
  });

  const owned = useMemo(() => holdingsQuery.data ?? [], [holdingsQuery.data]);
  const summary: PortfolioSummary | null = summaryQuery.data ?? null;

  const positions = useMemo<Position[]>(
    () =>
      owned.map((o) => {
        const { currentValueCents } = computePriceDrift(o.item, now);
        const basis = o.costBasisCents;
        return {
          owned: o,
          valueCents: currentValueCents,
          costBasisCents: basis,
          pnlCents: basis == null ? null : currentValueCents - basis,
          pnlPercent: basis == null || basis === 0 ? null : ((currentValueCents - basis) / basis) * 100,
          isListed: o.activeListing != null,
        };
      }),
    [owned, now]
  );

  /**
   * Live restatement of the summary's mark-to-market half.
   *
   * Computed over `positions`, which is the fetched page set — for accounts inside the fetch cap
   * (every account in practice; the service pages until exhausted) that is the whole collection,
   * so this and the server's own figure agree to the cent. Realized P&L, spend and wallet are
   * taken from the summary untouched: nothing about them ticks.
   */
  const live = useMemo(() => {
    let valueCents = 0;
    let costBasisCents = 0;
    for (const p of positions) {
      valueCents += p.valueCents;
      if (p.costBasisCents != null) costBasisCents += p.costBasisCents;
    }
    const unrealizedPnlCents = positions.reduce((sum, p) => sum + (p.pnlCents ?? 0), 0);
    const walletCents = summary?.walletCents ?? 0;
    const realizedPnlCents = summary?.realizedPnlCents ?? 0;

    return {
      holdingsValueCents: valueCents,
      costBasisCents,
      unrealizedPnlCents,
      unrealizedPnlPercent: costBasisCents > 0 ? (unrealizedPnlCents / costBasisCents) * 100 : 0,
      walletCents,
      netWorthCents: walletCents + valueCents,
      realizedPnlCents,
      totalPnlCents: realizedPnlCents + unrealizedPnlCents,
    };
  }, [positions, summary]);

  /** Generalized replacement for what used to be two hardcoded `cards`/`watches` filters plus a
   * `categoryTotals` object with a `cardsX`/`watchesX` field pair — every category actually held,
   * sorted by value. `live.holdingsValueCents` (summed over every position regardless of
   * category) stays the source of truth for the portfolio *total*, so a category this array
   * doesn't get its own UI row for still counts toward it. */
  const positionsByCategory = useMemo<CategoryPosition[]>(() => {
    const total = live.holdingsValueCents;
    const map = new Map<string, Position[]>();
    for (const p of positions) {
      const categoryId = p.owned.item.category;
      if (!map.has(categoryId)) map.set(categoryId, []);
      map.get(categoryId)!.push(p);
    }
    return [...map.entries()]
      .map(([categoryId, list]) => {
        const valueCents = list.reduce((sum, p) => sum + p.valueCents, 0);
        return {
          categoryId,
          positions: list,
          valueCents,
          sharePercent: total > 0 ? Math.round((valueCents / total) * 100) : 0,
          pnlCents: list.reduce((sum, p) => sum + (p.pnlCents ?? 0), 0),
        };
      })
      .sort((a, b) => b.valueCents - a.valueCents);
  }, [positions, live.holdingsValueCents]);

  const visible = useMemo(() => {
    const scoped =
      filter === "all" ? positions : positions.filter((p) => p.owned.item.category === filter);
    const sorted = [...scoped];
    if (sort === "value") sorted.sort((a, b) => b.valueCents - a.valueCents);
    // Unpriced holdings sort last under P&L rather than being treated as break-even — they have no
    // position to rank, and burying them beats interleaving them with real zeros.
    else if (sort === "pnl")
      sorted.sort((a, b) => (b.pnlCents ?? -Infinity) - (a.pnlCents ?? -Infinity));
    else
      sorted.sort(
        (a, b) => new Date(b.owned.heldSinceAt).getTime() - new Date(a.owned.heldSinceAt).getTime()
      );
    return sorted;
  }, [positions, filter, sort]);

  const best = useMemo(() => {
    const priced = positions.filter((p) => p.pnlPercent != null);
    if (priced.length === 0) return null;
    return priced.reduce((top, p) => (p.pnlPercent! > top.pnlPercent! ? p : top));
  }, [positions]);

  /** The portfolio's total value swept back across the window, using the same formula as the live
   * figure — a real history of a deterministic simulation, not a smoothed or invented trend.
   *
   * `driftParams` is hoisted out of the inner loop deliberately: this is (holdings × points)
   * evaluations, and re-hashing every item id at every timestamp is what would make it expensive
   * on a large collection. */
  const sparkline = useMemo(() => {
    if (owned.length === 0) return [] as number[];
    const curves = owned.map((o) => driftParams(o.item));
    const end = now.getTime();
    const points: number[] = [];
    for (let i = 0; i < SPARKLINE_POINTS; i++) {
      const at = new Date(end - SPARKLINE_WINDOW_MS + (SPARKLINE_WINDOW_MS * i) / (SPARKLINE_POINTS - 1));
      let total = 0;
      for (const curve of curves) total += driftValueAt(curve, at);
      points.push(total);
    }
    return points;
    // Keyed on the refresh bucket rather than on `now` itself — see SPARKLINE_REFRESH_MS. The
    // live leading edge is spliced on by the consumer from `live.holdingsValueCents`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owned, Math.floor(now.getTime() / SPARKLINE_REFRESH_MS)]);

  /** Tracked separately from react-query's `isFetching` on purpose: the background poll (and any
   * invalidation fired by a rip or a sale elsewhere in the app) is also "fetching", and wiring
   * that to a `RefreshControl` would drop a spinner onto the screen every couple of minutes with
   * nobody having asked for one. This flag is only ever set by an actual pull. */
  const [isManualRefreshing, setManualRefreshing] = useState(false);

  async function refresh() {
    setManualRefreshing(true);
    try {
      await Promise.all([holdingsQuery.refetch(), summaryQuery.refetch()]);
    } finally {
      setManualRefreshing(false);
    }
  }

  return {
    isSignedIn,
    isLoading: holdingsQuery.isLoading || summaryQuery.isLoading,
    isRefreshing: isManualRefreshing,
    error: (holdingsQuery.error ?? summaryQuery.error) as Error | null,
    refresh,
    summary,
    live,
    positions,
    positionsByCategory,
    visible,
    best,
    sparkline,
    filter,
    setFilter,
    sort,
    setSort,
  };
}
