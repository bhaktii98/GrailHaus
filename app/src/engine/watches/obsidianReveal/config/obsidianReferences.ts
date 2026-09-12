// The five APEX references — ported verbatim from the design's own `STYLES` table
// (the-obsidian-vault/project/apex-vault.html, lines 420-436).
//
// HOW THIS TIER'S VARIETY DIFFERS FROM THE OTHER TWO — and why the resolver is shaped differently
//
// The design's own comment is the specification: "five APEX references — same vault, same
// architecture, different metal and dial". So:
//
//   The Reserve  — five case *constructions* (dress/diver/chronograph/rectangular/integrated).
//                  An archetype is a shape, dressed by the catalog row's own columns.
//   The Archive  — five curated *pieces* (Monolith/Abyss/Aurum/Cathedral/Meridian), each with a
//                  fixed metal and character. An archetype IS a specific watch.
//   The Obsidian — five *finishes* of one watch. The geometry is identical across all five; only
//                  metal, dial, accent and bezel ring change.
//
// That is the right structure for the top tier rather than a shortcut: at $7,500 the object should
// read as one designed reference offered in five executions, which is how actual high horology is
// sold. It also means this tier's resolver maps a pulled row onto a *finish*, keyed primarily off
// the case material, where the Reserve's keyed off style and the Archive's off form.
//
// Consequently there is no "archetype" concept here at all, and inventing one to match the other
// two folders would have been symmetry for its own sake — the shared abstraction is the
// choreography contract, not the way each tier happens to pick a model.
import type { ReferenceSpec } from "../engine/obsidianMaterials";

/** Index-marker style. `bar` is an applied baton, `dot` a round applied marker in a surround. */
export type IndexStyle = "bar" | "dot";

export interface ObsidianReference extends ReferenceSpec {
  /** Display name, shown in the reveal's own HUD. */
  name: string;
  /** One-line description of the execution. */
  sub: string;
  index: IndexStyle;
}

export const OBSIDIAN_REFERENCES: ObsidianReference[] = [
  {
    id: "nocturne",
    name: "Obsidian Nocturne",
    sub: "Blackened steel · onyx dial",
    metal: { color: 0x34363b, roughness: 0.2, metalness: 0.92 },
    brush: { color: 0x24262a, roughness: 0.44, metalness: 0.85 },
    dial: { color: 0x06070a, roughness: 0.46, metalness: 0.1 },
    accent: "gold",
    ring: "gold",
    index: "bar",
  },
  {
    id: "meridian",
    name: "Champagne Meridian",
    sub: "Solid champagne gold · ember dial",
    metal: { color: 0xcfae72, roughness: 0.14, metalness: 1 },
    brush: { color: 0xb3965f, roughness: 0.4, metalness: 1 },
    dial: { color: 0x1b1209, roughness: 0.34, metalness: 0.22 },
    accent: "gold",
    ring: "none",
    index: "bar",
  },
  {
    id: "glacier",
    name: "Glacier Platine",
    sub: "Platinum · glacier lacquer",
    metal: { color: 0xeef2f6, roughness: 0.11, metalness: 0.96 },
    brush: { color: 0xc4cad1, roughness: 0.32, metalness: 0.9 },
    dial: { color: 0xa9b7c0, roughness: 0.28, metalness: 0.14 },
    accent: "noir",
    ring: "steel",
    index: "dot",
  },
  {
    id: "sang",
    name: "Sang Royale",
    sub: "Steel · burgundy lacquer",
    metal: { color: 0xe8edf1, roughness: 0.12, metalness: 0.95 },
    brush: { color: 0xc2c8ce, roughness: 0.34, metalness: 0.92 },
    dial: { color: 0x3a0a14, roughness: 0.18, metalness: 0.2 },
    accent: "gold",
    ring: "gold",
    index: "bar",
  },
  {
    id: "imperial",
    name: "Vert Impérial",
    sub: "Champagne gold · imperial green",
    metal: { color: 0xcfae72, roughness: 0.14, metalness: 1 },
    brush: { color: 0xb3965f, roughness: 0.4, metalness: 1 },
    dial: { color: 0x0a2018, roughness: 0.26, metalness: 0.18 },
    accent: "gold",
    ring: "gold",
    index: "dot",
  },
];

const BY_ID = new Map(OBSIDIAN_REFERENCES.map((r) => [r.id, r]));

/**
 * Dial-colour rules, checked first.
 *
 * Dial colour is the strongest signal in the catalog for which execution a pulled watch should
 * wear, because it is the one column that varies independently of metal — an Apex row in white
 * gold with a green dial should land on Vert Impérial, not on the platinum reference. Ordered and
 * substring-matched for the same reason the other tiers' resolvers are: the column is free text.
 */
const DIAL_RULES: { match: string; id: string }[] = [
  { match: "green", id: "imperial" },
  { match: "burgundy", id: "sang" },
  { match: "wine", id: "sang" },
  { match: "red", id: "sang" },
  { match: "silver", id: "glacier" },
  { match: "white", id: "glacier" },
  { match: "grey", id: "glacier" },
  { match: "gray", id: "glacier" },
  { match: "ice", id: "glacier" },
  { match: "champagne", id: "meridian" },
  { match: "ember", id: "meridian" },
  { match: "brown", id: "meridian" },
  { match: "bronze", id: "meridian" },
  { match: "black", id: "nocturne" },
  { match: "onyx", id: "nocturne" },
  { match: "skeleton", id: "nocturne" },
];

/**
 * Case-material rules, checked when the dial says nothing recognisable.
 *
 * Every case material in the Apex sheet is covered: Stainless Steel, 18K Gold, White Gold,
 * Platinum, Titanium and Carbon Composite (read out of the catalog earlier — the Apex sheet's nine
 * rows use exactly those).
 */
const METAL_RULES: { match: string; id: string }[] = [
  { match: "18k gold", id: "meridian" },
  { match: "yellow gold", id: "meridian" },
  { match: "rose gold", id: "meridian" },
  { match: "platinum", id: "glacier" },
  { match: "white gold", id: "glacier" },
  { match: "carbon", id: "nocturne" },
  { match: "ceramic", id: "nocturne" },
  { match: "titanium", id: "nocturne" },
  { match: "steel", id: "sang" },
];

/**
 * Picks the reference for a real pulled item.
 *
 * Dial first, then case material, then a deterministic fallback. The fallback is *not* a fixed
 * default: with only five executions and a tier that yields Apex 25% of the time, always falling
 * back to the same one would make unrecognised rows visibly repetitive. Hashing the item id spreads
 * them evenly and — importantly — stably, so the same owned watch always presents in the same
 * execution rather than changing every time its detail screen is opened.
 */
export function resolveReference(item: {
  id?: string | null;
  dialColor?: string | null;
  caseMaterial?: string | null;
}): ObsidianReference {
  const dial = (item.dialColor ?? "").trim().toLowerCase();
  if (dial) {
    for (const rule of DIAL_RULES) {
      if (dial.includes(rule.match)) return BY_ID.get(rule.id) as ObsidianReference;
    }
  }

  const metal = (item.caseMaterial ?? "").trim().toLowerCase();
  if (metal) {
    for (const rule of METAL_RULES) {
      if (metal.includes(rule.match)) return BY_ID.get(rule.id) as ObsidianReference;
    }
  }

  return OBSIDIAN_REFERENCES[stableIndex(item.id ?? "", OBSIDIAN_REFERENCES.length)];
}

/** FNV-1a over the id — small, dependency-free, and stable across sessions and devices, which a
 * `Math.random()` fallback would not be. */
function stableIndex(key: string, mod: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % mod;
}

export function referenceById(id: string): ObsidianReference | undefined {
  return BY_ID.get(id);
}
