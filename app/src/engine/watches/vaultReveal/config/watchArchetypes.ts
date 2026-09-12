// The five watch archetypes for The Archive (watch pack tier 2), ported verbatim from the design
// handoff's own ARCHETYPES
// table (the-collector-s-vault/project/vault.js, lines 195-231) — every dimension, material
// assignment and feature flag is the designer's, not re-derived here.
//
// WHAT AN ARCHETYPE IS, AND WHAT IT ISN'T
//
// NAMING, because two different things are both called "tier" in this product and mixing them up
// puts wrong words on screen (PRD §14-16): the *pack* tiers are The Reserve, The Archive and The
// Obsidian Vault, while the *rarity* tiers a pull can land on are Heritage, Icon and Apex. This
// reveal belongs to The Archive, and its pulls can be any of the three rarities — so nothing in
// this folder should describe itself as an "Icon" anything. The design prototype could, because it
// is a fixed Icon showcase; the app cannot.
//
// In the design prototype these five are a showcase switcher: a sidebar that swaps between them so
// the viewer can admire the variety the builder supports. In the app they are something different
// and more constrained — a *rendering vocabulary* for the real catalog. A pull produces one
// specific watch row (Submariner, Royal Oak, Cosmograph Daytona...), and the reveal has to show
// something faithful to it without the app shipping 36 hand-built models. So each archetype is the
// shared silhouette for a family of real watches, and the pulled row's own catalog columns
// (`caseMaterial`, `dialColor`) still tint it — the same division of labour the tier-1 watch
// already uses via engine/components/watchCatalogColors.ts.
//
// That is why `resolveArchetype` below keys off `item.style`: it is the one catalog column that
// actually describes a watch's *form* rather than its finish, and it is confirmed to reach the
// client on a real pull (server: items.repository.ts selects `i.style`, items.service.ts maps it,
// and purchase.service.ts's own enrichItems() runs every pulled row through that same
// toItemDetail, so a pull carries it exactly like a catalog browse does).
import * as THREE from "three";
import { resolveDialColorHex } from "../../../components/watchCatalogColors";

/** Which bezel construction an archetype gets. Each maps to one branch of buildBezel. */
export type BezelKind = "fluted" | "dive" | "thin" | "sapphire_ring" | "tachy";
/** Which dial furniture — markers, tracks, subdials, openworked movement. */
export type MarkerKind = "applied" | "lume" | "baton_slim" | "skeleton" | "chrono";
/** Which hand stack shape. */
export type HandKind = "baton" | "sword" | "leaf" | "skeleton" | "chrono";
/** Crown treatment, including whether chronograph pushers flank it. */
export type CrownKind = "guarded" | "oversize" | "slim" | "pushers";
/** What wraps the cushion — drives both geometry and material in buildStrap. */
export type StrapKind = "bracelet" | "rubber" | "leather";

/**
 * One archetype's full specification. Materials are named rather than embedded as THREE.Material
 * instances so this module stays a pure data table with no GPU allocation at import time — the
 * geometry builder owns the material palette and looks each name up. That separation matters for
 * two reasons: this file is safely importable from a test or a config with no GL context, and a
 * single material instance gets shared across every mesh that names it (the design source relies
 * on exactly that sharing — it declares ~20 materials and reuses them across hundreds of meshes,
 * which is most of why its draw-call count is survivable).
 */
export interface WatchArchetype {
  id: string;
  /** Roman numeral the design shows beside the name — kept for the reveal's own HUD. */
  numeral: string;
  name: string;
  /** Reference code and edition, e.g. "GH·V07" / "04 / 12". Display-only. */
  ref: string;
  edition: string;
  /** One-line description of the construction, shown as the archetype's subtitle. */
  line: string;
  /** Accent colour for the HUD swatch. */
  swatch: string;
  /** Material palette keys — resolved by the builder (see vaultMaterials.ts). */
  caseMat: string;
  linkMat: string;
  bezelMat: string;
  accentMat: string;
  dialMat: string;
  bezel: BezelKind;
  markers: MarkerKind;
  hands: HandKind;
  crown: CrownKind;
  strap: StrapKind;
  /** Case radius in metres — the design models at true scale (≈20mm half-width ⇒ a 40mm watch). */
  caseR: number;
  /** Mid-case height (the "band"). */
  bandH: number;
  /** Strap/bracelet width at the lugs. */
  strapW: number;
  /** Whether the caseback is a sapphire exhibition window (showing rotor + gears) or solid. */
  exhibition: boolean;
  /** Cathedral only — an openworked dial with a visible tourbillon instead of a solid plate. */
  openDial?: boolean;
}

export const WATCH_ARCHETYPES: WatchArchetype[] = [
  {
    id: "monolith",
    numeral: "I",
    name: "Monolith",
    ref: "GH·V07",
    edition: "04 / 12",
    line: "Integrated steel · fluted gunmetal bezel",
    swatch: "#c9a96b",
    caseMat: "steel",
    linkMat: "gunmetal",
    bezelMat: "gunmetal",
    accentMat: "goldAcc",
    dialMat: "dialSlate",
    bezel: "fluted",
    markers: "applied",
    hands: "baton",
    crown: "guarded",
    strap: "bracelet",
    caseR: 0.0205,
    bandH: 0.0086,
    strapW: 0.0182,
    exhibition: true,
  },
  {
    id: "abyss",
    numeral: "II",
    name: "Abyss",
    ref: "GH·V11",
    edition: "02 / 08",
    line: "Blackened DLC · 300m dive bezel · lume",
    swatch: "#35c6a6",
    caseMat: "dlc",
    linkMat: "gunmetal",
    bezelMat: "dlc",
    accentMat: "lume",
    dialMat: "dialSlate",
    bezel: "dive",
    markers: "lume",
    hands: "sword",
    crown: "oversize",
    strap: "rubber",
    caseR: 0.0222,
    bandH: 0.0104,
    strapW: 0.0196,
    exhibition: false,
  },
  {
    id: "aurum",
    numeral: "III",
    name: "Aurum",
    ref: "GH·V02",
    edition: "01 / 05",
    line: "Rose gold dress · grained silver dial",
    swatch: "#c2825f",
    caseMat: "roseGold",
    linkMat: "roseGold",
    bezelMat: "roseGold",
    accentMat: "roseGold",
    dialMat: "dialSilver",
    bezel: "thin",
    markers: "baton_slim",
    hands: "leaf",
    crown: "slim",
    strap: "leather",
    caseR: 0.0188,
    bandH: 0.0062,
    strapW: 0.0166,
    exhibition: true,
  },
  {
    id: "cathedral",
    numeral: "IV",
    name: "Cathedral",
    ref: "GH·V19",
    edition: "01 / 03",
    line: "Platinum openwork · flying tourbillon",
    swatch: "#dfe2e6",
    caseMat: "platinum",
    linkMat: "platinum",
    bezelMat: "platinum",
    accentMat: "goldAcc",
    dialMat: "dialSkel",
    bezel: "sapphire_ring",
    markers: "skeleton",
    hands: "skeleton",
    crown: "slim",
    strap: "leather",
    caseR: 0.02,
    bandH: 0.0094,
    strapW: 0.0172,
    exhibition: true,
    openDial: true,
  },
  {
    id: "meridian",
    numeral: "V",
    name: "Meridian",
    ref: "GH·V14",
    edition: "06 / 20",
    line: "Satin titanium chronograph · tachymètre",
    swatch: "#0d1a30",
    caseMat: "satinTi",
    linkMat: "titanium",
    bezelMat: "gunmetal",
    accentMat: "applied",
    dialMat: "dialBlue",
    bezel: "tachy",
    markers: "chrono",
    hands: "chrono",
    crown: "pushers",
    strap: "bracelet",
    caseR: 0.0215,
    bandH: 0.0098,
    strapW: 0.0188,
    exhibition: true,
  },
];

const BY_ID = new Map(WATCH_ARCHETYPES.map((a) => [a.id, a]));

/**
 * Ordered style→archetype rules, checked in sequence against the pulled row's `style` column.
 *
 * Substring matching rather than exact keys, and ordered rather than a plain map, because the real
 * catalog's style values are free text with genuine overlap — "GMT / Luxury Sport" contains both
 * "GMT" and "Luxury Sport", and "Statement Chronograph"/"High-Performance Chronograph" both need
 * to reach the chronograph archetype without being enumerated one by one. Order encodes
 * precedence: the more specific form wins.
 *
 * Derived from the actual spreadsheet rather than guessed — every `style` value across the
 * Heritage (14), Icon (13) and Apex (9) sheets was read out and mapped:
 *
 *   Grand Complication, Astronomical Complication  -> cathedral  (6 rows, all Apex)
 *   Diver, Luxury Diver, Professional Diver        -> abyss      (4 rows)
 *   Chronograph, Statement/High-Performance Chrono -> meridian   (8 rows)
 *   GMT / Travel, GMT / Luxury Sport               -> meridian   (2 rows — see note below)
 *   Luxury Sport, Ultra-Light Sport, Dress / Sport -> monolith   (10 rows)
 *   Dress, Classic Dress, Dual Time, Everyday...   -> aurum      (7 rows)
 *   Tool / Explorer                                -> monolith   (1 row)
 *
 * GMT maps to `meridian` rather than getting its own archetype because the design supplies five
 * and a GMT's distinguishing feature (a 24-hour bezel and a fourth hand) is closest to the
 * chronograph's tachymètre bezel and extra-hand furniture. Stated plainly as a mapping decision
 * rather than pretending the design covers GMT: it does not, and inventing a sixth archetype here
 * would be inventing design, not porting it.
 */
const STYLE_RULES: { match: string; archetype: string }[] = [
  // Complications first — "Grand Complication" must not be read as merely "Complication".
  { match: "grand complication", archetype: "cathedral" },
  { match: "astronomical", archetype: "cathedral" },
  { match: "complication", archetype: "cathedral" },
  { match: "openwork", archetype: "cathedral" },
  { match: "skeleton", archetype: "cathedral" },
  // Divers before generic sport — "Luxury Diver" would otherwise fall to "luxury sport".
  { match: "diver", archetype: "abyss" },
  { match: "dive", archetype: "abyss" },
  // Chronographs and GMTs.
  { match: "chronograph", archetype: "meridian" },
  { match: "chrono", archetype: "meridian" },
  { match: "gmt", archetype: "meridian" },
  { match: "travel", archetype: "meridian" },
  // Dress forms before sport, so "Dress / Sport" reads as a dress watch.
  { match: "dual time", archetype: "aurum" },
  { match: "dress", archetype: "aurum" },
  { match: "everyday", archetype: "aurum" },
  // Sport and tool forms.
  { match: "luxury sport", archetype: "monolith" },
  { match: "sport", archetype: "monolith" },
  { match: "tool", archetype: "monolith" },
  { match: "explorer", archetype: "monolith" },
  { match: "integrated", archetype: "monolith" },
];

/**
 * Picks the archetype for a real pulled item.
 *
 * Falls back to `monolith` for an unrecognised or missing style — the same defensive posture
 * `resolveMeshArchetype` already takes for an unknown mesh archetype name, and for the same
 * reason: a mismatched-but-plausible watch beats a blank screen, and a catalog row with a new
 * style string (a future spreadsheet import) must never be able to break a paid reveal. Monolith
 * is the right default specifically because it is the plainest of the five — an integrated steel
 * sports watch reads as "a nice watch" for almost any row, where defaulting to Cathedral's
 * tourbillon would over-promise on a common pull.
 */
export function resolveArchetype(style: string | null | undefined): WatchArchetype {
  const fallback = BY_ID.get("monolith") as WatchArchetype;
  if (!style) return fallback;
  const needle = style.trim().toLowerCase();
  if (!needle) return fallback;
  for (const rule of STYLE_RULES) {
    if (needle.includes(rule.match)) return BY_ID.get(rule.archetype) ?? fallback;
  }
  return fallback;
}

/** Looks an archetype up by id — used by the reveal's own archetype switcher in dev/QA builds and
 * by tests, which need to exercise all five without inventing catalog rows. */
export function archetypeById(id: string): WatchArchetype | undefined {
  return BY_ID.get(id);
}

/**
 * The pulled row's own case metal, when the catalog names one this palette recognises.
 *
 * An archetype declares a *default* case material as part of its identity (Aurum is rose gold,
 * Cathedral is platinum, Abyss is blackened DLC) — that is the designer's intent and must survive.
 * But within an archetype the real catalog genuinely varies: the Icon sheet alone has Submariner
 * in Oystersteel, Big Bang in Titanium, Speedmaster in Ceramic and Evolution 9 in High-Intensity
 * Titanium, all of which would otherwise render identically. So this overrides the archetype's
 * default only for the neutral-metal archetypes (Monolith and Meridian, whose identity is the
 * *construction* rather than a specific precious metal) and leaves the signature-metal archetypes
 * alone — overriding Aurum's rose gold with "Stainless Steel" would erase the archetype rather
 * than personalise it.
 *
 * Two case materials in the catalog have no entry in the design's palette — Ceramic and Carbon
 * Composite — and both are genuinely not metals. They map to the vault's own forged-composite and
 * blackened-DLC materials respectively, which is the closest honest reading of each.
 */
const CASE_MATERIAL_TO_PALETTE: Record<string, string> = {
  oystersteel: "steel",
  "stainless steel": "steel",
  titanium: "titanium",
  "high-intensity titanium": "satinTi",
  "18k gold": "goldAcc",
  "white gold": "platinum",
  platinum: "platinum",
  ceramic: "forged",
  "carbon composite": "dlc",
};

/** Archetypes whose identity is their construction, not a signature metal — safe to re-tint from
 * the catalog row. The other three (Abyss/DLC, Aurum/rose gold, Cathedral/platinum) keep theirs. */
const RETINTABLE = new Set(["monolith", "meridian"]);

export function resolveCaseMaterialKey(
  archetype: WatchArchetype,
  caseMaterial: string | null | undefined
): string {
  if (!RETINTABLE.has(archetype.id) || !caseMaterial) return archetype.caseMat;
  const hit = CASE_MATERIAL_TO_PALETTE[caseMaterial.trim().toLowerCase()];
  return hit ?? archetype.caseMat;
}

/**
 * The pulled row's own dial colour as a THREE.Color, or null to keep the archetype's own dial.
 *
 * Same reasoning as the case metal above, applied to the dial, and reusing the tier-1 watch's
 * existing colour table (engine/components/watchCatalogColors.ts) rather than duplicating it —
 * that table was itself ported from the design source's own DIAL_COLORS and already handles the
 * catalog's two-token values ("Black / Burgundy Bezel" ⇒ the dial is Black).
 *
 * Returns null rather than a fallback colour when the row says nothing, so the caller keeps the
 * archetype's designed dial material (Aurum's grained silver, Meridian's midnight blue) instead
 * of flattening it to a solid tint.
 */
export function resolveDialOverride(
  archetype: WatchArchetype,
  dialColor: string | null | undefined
): THREE.Color | null {
  if (!dialColor) return null;
  // Cathedral's dial is openworked — there is no solid plate to tint, and forcing one would hide
  // the tourbillon that is the entire point of that archetype.
  if (archetype.openDial) return null;
  // A colour the table can never legitimately return, used purely as a "recognised nothing"
  // signal — `resolveDialColorHex` reports failure by handing the fallback straight back.
  const SENTINEL = "__none__";
  const hex = resolveDialColorHex(dialColor, SENTINEL);
  // The table returns the fallback verbatim when it recognises nothing; treat that as "no opinion"
  // rather than painting every unrecognised dial black.
  if (hex === SENTINEL) return null;
  return new THREE.Color(hex);
}
