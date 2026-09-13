// The one place a (category, tier) pair is mapped to a timeline reveal.
//
// WHY THIS FILE EXISTS — it is the answer to the architecture requirement
//
// When only The Archive had a choreography, its config module exported its own
// `usesVaultChoreography(category, tier)` helper and the viewmodel called it directly. Adding The
// Reserve the same way would have meant a second `usesReserveChoreography`, a second import in the
// viewmodel, and a second `if` — and the third and fourth would follow the same way. That is the
// "copy the folder" shape the architecture requirement is specifically designed to catch: each new
// reveal editing shared plumbing rather than registering itself.
//
// So the plumbing is inverted. The viewmodel asks this registry one question — "is there a
// choreography for this pack?" — and each reveal contributes one row. Adding a timeline reveal for
// a third category is now: write the reveal's own folder, add one row here. Nothing else in core/
// changes, the viewmodel does not change, and `RevealEngine` never learns that tiers exist.
//
// HOW A NON-TIERED CATEGORY REGISTERS
//
// Watch reveals happen to differ per pack tier, so their rows name a tier. A category whose reveal
// is uniform across its tiers (handbags, most likely — one category, one presentation) registers
// with `tier: "*"`, which matches any tier of that category. That wildcard is why the registry is
// keyed by a matcher rather than a plain `Record<string, ...>`: the two shapes coexist without the
// caller needing to know which kind a given category is.
import type { CategoryRevealConfig } from "./types";

/** Decorates a base category config with a timeline reveal. */
type ChoreographyDecorator = (base: CategoryRevealConfig) => CategoryRevealConfig;

interface ChoreographyRow {
  /** The `packs.category` this applies to. */
  category: string;
  /** The `packs.tier` slug, or "*" for every tier of the category. */
  tier: string;
  /** Human-readable name, for logs and for reading this table. */
  label: string;
  /**
   * The decorator, behind a thunk rather than imported at module scope.
   *
   * Two reasons, and the second is the important one:
   *
   * 1. A reveal's decorator transitively imports its scene component, which imports
   *    `@react-three/fiber/native` and the whole React Native runtime. Importing every row eagerly
   *    means every reveal's module graph loads the moment anything touches this registry — on app
   *    start, for a user who never buys a watch. Lazy rows keep each reveal's cost with the tier
   *    that uses it.
   * 2. It makes this table testable. Asserting "the Reserve resolves and the Obsidian Vault does
   *    not" is a statement about the table, and it should not require a JSX runtime to verify.
   *    With eager imports the test could not even be collected outside a native environment.
   */
  load: () => ChoreographyDecorator;
}

/**
 * The registry. One row per timeline reveal.
 *
 * Watch pack tiers are `reserve` / `archive` / `obsidian_vault` (see components/PackTile.tsx's own
 * tier labels). The Obsidian Vault has no reveal yet and so has no row — a pack with no row simply
 * keeps whatever its category's `categories` table row configures, which for watches is the
 * gesture-driven `lift-lid-box` mesh archetype. That fallback is deliberate: an unbuilt or
 * misconfigured tier degrades to a working reveal rather than a blank screen.
 */
const ROWS: ChoreographyRow[] = [
  {
    category: "watches",
    tier: "reserve",
    label: "The Reserve — Heritage Case",
    // `require` rather than a static import, so the reveal's module graph (and the React Native
    // runtime underneath it) loads only when a Reserve pack is actually revealed. Metro resolves
    // this the same way it resolves an import; see the `load` field's own note.
    load: () =>
      (require("../watches/reserveReveal/config/watchReserve.config") as {
        withReserveChoreography: ChoreographyDecorator;
      }).withReserveChoreography,
  },
  {
    category: "watches",
    tier: "archive",
    label: "The Archive — Collector's Vault",
    load: () =>
      (require("../watches/vaultReveal/config/watchVault.config") as {
        withVaultChoreography: ChoreographyDecorator;
      }).withVaultChoreography,
  },
  {
    category: "watches",
    tier: "obsidian_vault",
    label: "The Obsidian Vault — Apex Delivery",
    load: () =>
      (require("../watches/obsidianReveal/config/watchObsidian.config") as {
        withObsidianChoreography: ChoreographyDecorator;
      }).withObsidianChoreography,
  },
];

function findRow(category: string, tier: string): ChoreographyRow | undefined {
  // Exact tier match wins over a wildcard, so a category can register a default for most tiers and
  // still override one of them.
  return (
    ROWS.find((r) => r.category === category && r.tier === tier) ??
    ROWS.find((r) => r.category === category && r.tier === "*")
  );
}

/**
 * Applies a timeline reveal to a base config if one is registered for this pack.
 *
 * Returns the base config untouched when nothing matches, so every existing category keeps working
 * and a new pack tier is additive rather than breaking. The single call site is
 * viewmodels/usePackFlowViewModel.ts.
 */
export function applyChoreography(
  base: CategoryRevealConfig,
  pack: { category: string; tier: string }
): CategoryRevealConfig {
  const row = findRow(pack.category, pack.tier);
  return row ? row.load()(base) : base;
}

/** Whether a pack has a timeline reveal — for tests and diagnostics; the app itself just calls
 * `applyChoreography`, which is a no-op when nothing matches. */
export function hasChoreography(category: string, tier: string): boolean {
  return findRow(category, tier) != null;
}

/** The registered reveal's label, for logs and diagnostics. */
export function choreographyLabel(category: string, tier: string): string | null {
  return findRow(category, tier)?.label ?? null;
}
