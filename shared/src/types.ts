/** A slug matching a row in the backend-driven `categories` table (see server's
 * categories.repository.ts) — "cards" and "watches" are just the two rows that exist today, not
 * a closed set. A third category (e.g. "handbags") is a new row plus a mesh archetype, not a
 * type change here — keeping this as `string` (not a union) is what makes that true instead of
 * aspirational. */
export type Category = string;

/** Always integer cents. Never a float. */
export type MoneyCents = number;

export interface Profile {
  id: string;
  displayName: string | null;
  /** The public @handle ("Collector ID"). Null until claimed — every account gets one via
   * /username right after its first sign-in, and it's permanent once set. */
  username: string | null;
  balanceCents: MoneyCents;
  createdAt: string;
}

/**
 * Rarity is an ordinal level, not a fixed name — the display name, color,
 * and value range are admin-configurable data per category (Cards:
 * Core/Prime/Grail; Watches: Heritage/Icon/Apex), not a hardcoded enum.
 */
export type RarityTierLevel = 1 | 2 | 3;

export interface RarityTier {
  level: RarityTierLevel;
  name: string;
  colorHex: string;
  valueMinCents: MoneyCents;
  valueMaxCents: MoneyCents;
}

export interface PackItem {
  id: string;
  name: string;
  rarityTierLevel: RarityTierLevel;
  textureUrl: string | null;
  baseValueCents: MoneyCents;
}

/**
 * The full catalog record for one item — everything imported from the Pokémon/watch
 * spreadsheets, not just the minimal fields `PackItem` carries for the reveal engine. Card and
 * watch fields are both optional on every item since a given row only ever fills in one set
 * (its `category` says which); nothing here is admin-configurable the way rarity tiers or
 * probabilities are — it's catalog data, fixed at import time.
 */
export interface ItemDetail extends PackItem {
  category: Category;
  collection: string | null;
  tagline: string | null;
  traits: string | null;
  pokemonName: string | null;
  cardTitle: string | null;
  pokemonType: string | null;
  generation: string | null;
  pokedexNumber: string | null;
  watchName: string | null;
  modelName: string | null;
  brand: string | null;
  style: string | null;
  caseMaterial: string | null;
  dialColor: string | null;
  movement: string | null;
  caseSize: string | null;
  /** Bounded simulated price drift (PRD §28) — computed live on every read, not stored;
   * ticks every 30 seconds and never leaves [minValueCents, maxValueCents]. See
   * economics.ts's computePriceDrift for how. */
  currentValueCents: MoneyCents;
  minValueCents: MoneyCents;
  maxValueCents: MoneyCents;
}

/** How the *current* owner came to hold a specific copy: they tore it out of a pack, or they
 * bought it off another collector on the marketplace. Not a property of the item — the same
 * copy can change hands and change source. */
export type AcquisitionSource = "pack" | "marketplace";

/** One row in a user's portfolio — an owned item plus when and from which purchase/pack it
 * was acquired, and what it cost the person holding it now.
 *
 * `costBasisCents` is what makes per-item P&L real rather than guessed, and it is derived, never
 * stored: a pack pull costs its share of the pack's price (that purchase's `total_price_cents`
 * split across every copy it produced, to the cent), a marketplace acquisition costs exactly what
 * the buyer paid. It is null only when neither is derivable (a legacy row whose purchase never
 * completed), and a null basis is excluded from P&L everywhere rather than being treated as zero
 * — "we don't know" and "it was free" are very different claims to put in front of a collector.
 */
export interface OwnedItem {
  ownedItemId: string;
  item: ItemDetail;
  packId: string;
  purchaseId: string | null;
  /** When this copy first came into existence (the pack pull), regardless of who holds it now. */
  acquiredAt: string;
  /** When the *current* owner took possession — the same as `acquiredAt` for a pack pull, the
   * sale timestamp for a marketplace buy. This is the one to sort "recent" by, and the one
   * per-item P&L is measured from. */
  heldSinceAt: string;
  costBasisCents: MoneyCents | null;
  acquiredVia: AcquisitionSource;
  /** This copy's own live listing, if the owner currently has it up for sale — lets a portfolio
   * view show "listed at $X" instead of offering to list something twice (the DB's partial
   * unique index would reject that anyway). */
  activeListing: { id: string; priceCents: MoneyCents } | null;
}

/** One category's slice of a portfolio. `sharePercent` is share of current *value*, not of
 * item count — two cards and one watch is not a 67/33 portfolio. */
export interface PortfolioCategoryBreakdown {
  category: Category;
  count: number;
  valueCents: MoneyCents;
  costBasisCents: MoneyCents;
  unrealizedPnlCents: MoneyCents;
  sharePercent: number;
}

/**
 * Every money fact about one collector's position, computed server-side from the ledger tables
 * (`purchases`, `listings`, `owned_items`) rather than assembled by the client out of whatever
 * it happens to have paged in — a portfolio that says "$4,210 spent" must mean it across all 715
 * items a user owns, not just the first 200 the grid fetched.
 *
 * Realized vs unrealized is kept strictly separate, the way a brokerage does it: unrealized is
 * mark-to-market against the live simulated value (PRD §28) and moves every 30 seconds; realized
 * is settled cash out of completed sales and never moves again. `totalPnlCents` is the sum, and
 * is the only figure that answers "am I up or down overall".
 */
export interface PortfolioSummary {
  /** Spendable paper USD — the same balance `/me` reports, restated here so one request answers
   * the whole screen. */
  walletCents: MoneyCents;
  holdings: {
    count: number;
    valueCents: MoneyCents;
    /** Cost basis of the priced holdings only — see `pricedCount`. */
    costBasisCents: MoneyCents;
    /** How many holdings have a derivable cost basis; the rest are excluded from P&L. */
    pricedCount: number;
    unrealizedPnlCents: MoneyCents;
    /** Against cost basis. 0 when nothing is priced. */
    unrealizedPnlPercent: number;
    listedCount: number;
  };
  /** Wallet + current value of everything held. */
  netWorthCents: MoneyCents;
  purchases: {
    /** Completed `/purchase` calls — one tap of "buy", which may have been a ×10. */
    count: number;
    /** Packs actually bought across those calls. */
    packCount: number;
    spendCents: MoneyCents;
    /** Items those packs produced — includes copies since sold or given away. */
    itemsReceived: number;
  };
  marketplaceBuys: { count: number; spendCents: MoneyCents };
  sales: {
    count: number;
    /** What buyers paid. */
    grossCents: MoneyCents;
    feeCents: MoneyCents;
    /** What actually landed in the wallet, after fees. */
    netCents: MoneyCents;
    /** Net proceeds minus cost basis, over the sales whose basis is known. */
    realizedPnlCents: MoneyCents;
    pricedCount: number;
  };
  /** Packs + marketplace buys. */
  totalSpendCents: MoneyCents;
  realizedPnlCents: MoneyCents;
  /** Realized + unrealized. */
  totalPnlCents: MoneyCents;
  byCategory: PortfolioCategoryBreakdown[];
  /** The instant the mark-to-market figures above were computed — they are a snapshot of a
   * value that ticks every 30s, so a client holding this response knows how old it is. */
  valuedAt: string;
}

/** One pack slot's base probability distribution across tier levels — percentage points, sums to 100. */
export interface SlotProbability {
  slotPosition: number;
  probabilities: Record<RarityTierLevel, number>;
}

/**
 * A "pity"/protection rule. `qualifyingMinTier` defines what resets the streak
 * (a pull at or above this tier resets the counter to 0); `stepsWithoutQualifying`
 * is the threshold that triggers the effect. `bonus_percent` adds `effectValue`
 * percentage points to `targetTierLevel` on every slot where that tier already
 * has non-zero base probability; `guarantee_min_tier` forces the result to be at
 * least `targetTierLevel`. `appliesToFinalSlotOnly` scopes a guarantee to just the
 * pack's last slot (how the spec's "next eligible final pull" guarantees read).
 */
export interface PressureRule {
  qualifyingMinTier: RarityTierLevel;
  stepsWithoutQualifying: number;
  effectType: "bonus_percent" | "guarantee_min_tier";
  targetTierLevel: RarityTierLevel;
  effectValue: number | null;
  appliesToFinalSlotOnly: boolean;
}

export interface PackSku {
  id: string;
  category: Category;
  tier: string;
  name: string;
  priceCents: MoneyCents;
  itemCount: number;
  slotProbabilities: SlotProbability[];
  pressureRules: PressureRule[];
  rarityTiers: RarityTier[];
  itemsByTier: Record<RarityTierLevel, PackItem[]>;
  /** Null = evergreen (always available, restocks over time — see `maxStock`). Non-null = a
   * timed drop (PRD §19-20): not purchasable before this instant. A one-off drop never
   * restocks once its stock runs out; a *recurring* drop (see `recurrenceWeekdays` below)
   * restocks back to `maxStock` at the start of each new occurrence. For a recurring drop,
   * this is always the current-or-next occurrence's start, computed server-side — never a
   * fixed date the way a one-off drop's is. */
  goesLiveAt: string | null;
  /** Optional hard cutoff for a drop; evergreen packs never set this. For a recurring drop,
   * this is the current-or-next occurrence's own end (goesLiveAt + recurrenceDurationMinutes),
   * recomputed on every read. */
  endsAt: string | null;
  /** Null = unlimited (not used today — every pack is either evergreen-with-restock or a
   * finite drop); otherwise how many are left right now (right now's occurrence, for a
   * recurring drop). */
  stockRemaining: number | null;
  /** The ceiling evergreen stock restocks up to, a one-off drop's starting inventory, or a
   * recurring drop's per-occurrence starting inventory. */
  maxStock: number | null;
  /** Which UTC weekdays (0=Sunday..6=Saturday) a recurring drop goes live on. Null/empty = not
   * a recurring drop — `goesLiveAt`/`endsAt` are then the plain one-off (or evergreen) values
   * above, set directly by an admin rather than computed. Configured from the admin dashboard;
   * the actual occurrence timing is always computed server-side (see `phase` below) — the app
   * never derives this from the raw recurrence rule itself. */
  recurrenceWeekdays: number[] | null;
  /** "HH:MM" (UTC) each occurrence starts at. Set together with `recurrenceWeekdays`. */
  recurrenceTimeUtc: string | null;
  /** How long each occurrence stays live once it starts. Set together with `recurrenceWeekdays`. */
  recurrenceDurationMinutes: number | null;
  /** Server-computed — "soon" (before goesLiveAt), "live" (purchasable now), or "closed" (past
   * endsAt, or sold out). Only meaningful when `goesLiveAt` is non-null (an evergreen pack is
   * always "live"). Computed here, not on-device, so every client shows the exact same phase
   * off the same server clock regardless of the device's own clock/timezone. */
  phase: "soon" | "live" | "closed";
}

/** An item as it comes out of a rip — same shape as PackItem, kept distinct so the reveal engine's
 * input type can evolve independently of the catalog type once real pulls exist server-side. */
export type PulledItem = PackItem;

/** One pulled item as `/purchase` actually returns it — full catalog detail plus the specific
 * `owned_items` row id that purchase created for it, so a post-reveal screen (Cards' Pack
 * Summary, Watches' post-reveal fork) can act on *that exact copy* — view it, sell it — without
 * a separate portfolio lookup.
 *
 * `packIndex`/`cardIndex` are the item's *authoritative* coordinates within the purchase: which
 * pack of the batch produced it (0-based) and its slot within that pack's own pull order. They
 * are assigned server-side at generation time and never change. The bulk reveal deliberately
 * presents items in a different order than this (grails first — see bulkPresentation.ts), which
 * is exactly why these must travel with each item: the presentation layer may reorder freely
 * precisely because the authoritative position is never lost. Optional only for backward
 * compatibility with purchase rows written before these were persisted; treat a missing value as
 * "derive it positionally" (see chunkIntoPacks in the app).
 */
export interface PulledOwnedItem extends ItemDetail {
  ownedItemId: string;
  packIndex?: number;
  cardIndex?: number;
}

/**
 * Which presentation a completed purchase's results get. This is a *presentation* choice made
 * entirely client-side from the purchase's quantity — it never touches generation, odds,
 * ownership, or stored order, and the server neither knows nor cares which one is in use.
 *
 * `SINGLE_PACK` is the original sequential rip (tear → card → card → rare-pull climax → summary),
 * unchanged. `BULK_GRAIL_HUNT` is the 10-pack curated run (grails first, escalating → prime grid
 * → core list → summary). A future category adds a strategy here rather than a second engine.
 */
export type PresentationStrategy = "SINGLE_PACK" | "BULK_GRAIL_HUNT";

/** The stages a `BULK_GRAIL_HUNT` run moves through, in order. `intro` is the "THE CHASE BEGINS"
 * beat that deliberately does *not* disclose the grail count. */
export type RevealStage = "intro" | "grail_hunt" | "prime" | "core" | "summary";

/**
 * Everything needed to put a bulk run back exactly where it was after a process death. Persisted
 * on the device (see the app's lib/activeReveal.ts) alongside the purchase's idempotency key —
 * the *contents* are never stored here and never at risk, since they're server-side and
 * immutable; only "how far through presenting them had this device gotten" is.
 *
 * `completedGrailIds` is kept (rather than just an index) so a replay or an out-of-order resume
 * can still tell exactly which grails the user has already witnessed.
 */
export interface BatchRevealState {
  stage: RevealStage;
  /** How many grails have been fully revealed — the next one to show. Never exposed to the user
   * as a total (that would spoil the hunt), only used to resume. */
  currentGrailIndex: number;
  completedGrailIds: string[];
  primeStageCompleted: boolean;
  coreStageCompleted: boolean;
  summaryViewed: boolean;
}

/** Per-user, per-pack pity counter — deliberately scoped to one SKU, never global across a user's
 * account or shared across tiers. See rewardEngine.ts for why. */
export interface PressureState {
  packId: string;
  consecutiveWithoutQualifying: number;
}

/** How many copies of each catalog item (by PackItem.id) a user already owns going into a
 * pull — the input to the reward engine's ownership-weighted selection. Not persisted here;
 * this is just the shape the caller passes in after reading `owned_items`. */
export type OwnershipCounts = Record<string, number>;

export type ListingStatus = "active" | "sold" | "delisted";

/** A public-facing identity — never the raw internal profile id (which is also the Supabase
 * auth user id), only the opaque public_id + optional Collector ID, same externalization
 * `/me` already uses for `Profile.id`. */
export interface ListingParty {
  id: string;
  username: string | null;
}

/**
 * Fixed-price peer-to-peer listing (PRD §30-32). One `ownedItemId` can have at most one
 * `active` listing at a time — enforced by a DB constraint, not application logic. `feePercent`
 * /`feeCents`/`sellerProceedsCents` are the *actual* recorded split once `status` is `sold`
 * (computed once, atomically, at sale time, and never recalculated after); for a still-`active`
 * listing they're a live preview computed from the current admin-configured rate, which can
 * still change before a sale actually happens.
 */
/** One row in the "Recently Revealed" feed — a real pack pull (not a marketplace transfer),
 * newest first. `username` is null for the rare account that hasn't claimed a Collector ID yet
 * (shouldn't normally happen post-onboarding, but the feed degrades gracefully either way). */
export interface RecentPull {
  ownedItemId: string;
  item: ItemDetail;
  username: string | null;
  acquiredAt: string;
}

export interface Listing {
  id: string;
  ownedItemId: string;
  item: ItemDetail;
  seller: ListingParty;
  buyer: ListingParty | null;
  priceCents: MoneyCents;
  status: ListingStatus;
  feePercent: number | null;
  feeCents: MoneyCents | null;
  sellerProceedsCents: MoneyCents | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CategoryLight {
  kind: "ambient" | "directional";
  position?: [number, number, number];
  intensity: number;
  color?: string;
}

export interface CategoryHapticStep {
  atMs: number;
  kind: "light" | "medium" | "heavy" | "success";
}

export interface CategoryOpeningBeat {
  atMs: number;
  label: string;
}

/**
 * A category's whole reveal *personality*, exactly as stored in the backend `categories` table
 * (server's categories.repository.ts) — the thing that makes a category genuinely
 * admin/backend-driven instead of a hardcoded `*.config.tsx` file in the app. `meshArchetype` is
 * the one field that isn't pure data: it selects a geometry-builder function from a small, fixed
 * registry in the app (see engine/core/meshArchetypes.tsx) — no config system invents new 3D
 * topology from numbers alone, so a genuinely novel silhouette (e.g. a handbag's structured body
 * + flap + handle) needs one new archetype function, everything else about the category is this
 * row.
 */
export interface CategoryReveal {
  id: string;
  label: string;
  meshArchetype: string;
  paletteBackground: string;
  paletteAccent: string;
  cameraPosition: [number, number, number];
  cameraFov: number;
  lighting: CategoryLight[];
  gestureMode: "tear" | "lift-lid";
  gestureVelocityThreshold: number;
  gestureTravelDistance: number;
  commonBeatMs: number;
  rareHoldMs: number;
  hapticCommon: CategoryHapticStep[];
  hapticRare: CategoryHapticStep[];
  openingBeatsCommon: CategoryOpeningBeat[] | null;
  openingBeatsRare: CategoryOpeningBeat[] | null;
  sortOrder: number;
}
