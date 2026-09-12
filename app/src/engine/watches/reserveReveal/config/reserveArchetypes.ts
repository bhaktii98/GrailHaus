// The Reserve's watch archetypes — ported from the design handoff's own `ARCHETYPE_BY_STYLE`
// table and `specFor()` resolver (heritage-case-watch-reveal/project/watch-catalog.js, lines
// 24-102).
//
// WHY THIS IS A SEPARATE TABLE FROM THE ARCHIVE'S, NOT A REUSE OF IT
//
// Both watch tiers resolve a pulled item's catalog columns onto an archetype, and it would be
// tempting to share one resolver. They must not, because the two designs define genuinely
// different archetype *vocabularies*, each one coupled to its own builder's branches:
//
//   The Archive — monolith / abyss / aurum / cathedral / meridian. Five named, curated pieces,
//                 each with a fixed metal and a fixed character. An archetype IS a specific watch.
//   The Reserve — dress / diver / chronograph / rectangular / integrated. Five *case
//                 constructions*. An archetype is a shape, and every real catalog row's own
//                 material and dial columns then dress it.
//
// Sharing a resolver would mean one of the two builders receiving archetype names it has no branch
// for. Sharing the *pattern* — an ordered rule list over free text, a documented fallback, and a
// test over every real catalog string — is the actual reuse, and that is what this does.
//
// The Reserve's model is also more data-driven than the Archive's by design: where an Archive
// archetype hardcodes `caseMat: "platinum"`, a Reserve spec derives its case metal, dial colour,
// dial finish, complications and strap type from the pulled row itself. That is why this file
// exports a `resolveReserveSpec` that returns a fully-derived spec rather than a table lookup.
import {
  resolveCaseMetalHex,
  resolveDialColorHex,
} from "../../../components/watchCatalogColors";
import type { DialVariant } from "../art/reserveTextures";

/** The five case constructions the Reserve's builder branches on. */
export type ReserveArchetype = "dress" | "diver" | "chronograph" | "rectangular" | "integrated";

/** What wraps the wrist. `link` is a segmented metal bracelet, `integrated` a bracelet whose links
 * taper straight out of the case, `leather` a stitched strap with a buckle. */
export type ReserveStrap = "link" | "integrated" | "leather";

/**
 * Everything the Reserve's geometry and texture builders need for one pulled watch. Mirrors the
 * source's own `specFor()` return shape.
 */
export interface ReserveWatchSpec {
  archetype: ReserveArchetype;
  /** Case radius in metres, derived from the catalog's own size column (41mm -> 0.0205). */
  caseR: number;
  /** Resolved case metal, as a hex string for the builder to tint its steel materials with. */
  metalHex: string;
  /** Polished and brushed roughness for this metal — softer metals read glossier. */
  polish: number;
  brushed: number;
  /** Dial colour and, when the catalog row names two, the accent/bezel colour. */
  dialHex: string;
  accentHex: string | null;
  /** True when the dial is light enough that its furniture must be drawn dark. */
  lightDial: boolean;
  dialVariant: DialVariant;
  strap: ReserveStrap;
  /** A square or rectangular case rather than a round one. */
  squareCase: boolean;
  /** Reverso-style fluted ridges on the case flank. */
  godrons: boolean;
  subdials: boolean;
  dateWindow: boolean;
  lume: boolean;
  romanIndices: boolean;
  /**
   * Radius of the bracelet/strap loop, in metres. Set by the *scene* rather than derived here,
   * because it is a property of the case the watch sits in rather than of the watch itself: the
   * design assigns `spec.loopR = cushionR + clearance` at mount time (heritage-case.js's
   * `mountWatch`) so the band stands just clear of the bolster it wraps. Optional — the builder
   * falls back to a proportion of the case radius when no case is involved (a detail-screen
   * viewer showing the watch on its own, say).
   */
  loopR?: number;
}

/**
 * Ordered style -> archetype rules.
 *
 * Substring-matched and ordered rather than an exact-key map, for the same reason the Archive's
 * resolver is: the catalog's `style` column is free text with real overlap, and a future
 * spreadsheet import can introduce a string this build has never seen. Order encodes precedence.
 *
 * Derived from the source's own ARCHETYPE_BY_STYLE, extended to cover the styles that table has no
 * entry for. The source falls back to `dress` for anything unmapped, which quietly sent 6 of the
 * 13 Icon-sheet rows and most of Apex to the wrong shape — acceptable in a prototype that only
 * ever showed the 14 Heritage rows, not here, since a Reserve pack can contain Icon and Apex
 * watches too (PRD §16: 75% / 22% / 3%).
 *
 * Every style string across all three rarity sheets, mapped:
 *   Diver, Professional Diver, Luxury Diver        -> diver
 *   Chronograph, Statement/High-Performance Chrono -> chronograph
 *   Dress (plain), Dual Time                       -> rectangular  (the source's own mapping:
 *                                                     Tank and Reverso are its "Dress" rows)
 *   Classic Dress, Everyday Luxury, Dress / Sport  -> dress
 *   Luxury Sport, Ultra-Light Sport                -> integrated
 *   Tool / Explorer                                -> dress        (the source's own choice)
 *   GMT / Travel, GMT / Luxury Sport               -> diver        (see note below)
 *   Grand Complication, Astronomical Complication  -> dress        (see note below)
 */
const STYLE_RULES: { match: string; archetype: ReserveArchetype }[] = [
  // Divers before any "sport" rule, so "Luxury Diver" is not read as luxury sport.
  { match: "diver", archetype: "diver" },
  { match: "dive", archetype: "diver" },
  // A GMT's defining feature is a 24-hour rotating bezel, which of the five constructions only the
  // diver case carries. Closer than putting it on a plain dress case.
  { match: "gmt", archetype: "diver" },
  { match: "travel", archetype: "diver" },
  { match: "chronograph", archetype: "chronograph" },
  { match: "chrono", archetype: "chronograph" },
  // Dual Time sits with the rectangular dress cases — the catalog's example is a Reverso.
  { match: "dual time", archetype: "rectangular" },
  // Complications: the Reserve has no openworked/tourbillon construction (that is the Archive's
  // Cathedral). A high complication renders as the most formal shape available rather than
  // pretending to a mechanism this builder cannot show.
  { match: "complication", archetype: "dress" },
  // More specific dress forms before the bare "dress" substring, which they all contain.
  { match: "classic dress", archetype: "dress" },
  { match: "dress / sport", archetype: "dress" },
  { match: "dress/sport", archetype: "dress" },
  { match: "everyday", archetype: "dress" },
  { match: "luxury sport", archetype: "integrated" },
  { match: "sport", archetype: "integrated" },
  { match: "tool", archetype: "dress" },
  { match: "explorer", archetype: "dress" },
  // Bare "dress" last among the dress family: the source maps plain "Dress" to its rectangular
  // case (Tank, Reverso), which only applies once the compound forms above have been excluded.
  { match: "dress", archetype: "rectangular" },
];

/** Metal roughness pairs, from the source's own METALS table. Colour comes from the shared
 * `watchCatalogColors` resolver (itself ported from this same design's table), so the two cannot
 * drift; only the finish values live here. */
const METAL_FINISH: Record<string, { polish: number; brushed: number }> = {
  oystersteel: { polish: 0.09, brushed: 0.22 },
  "stainless steel": { polish: 0.1, brushed: 0.24 },
  titanium: { polish: 0.2, brushed: 0.34 },
  "high-intensity titanium": { polish: 0.2, brushed: 0.34 },
  "18k gold": { polish: 0.18, brushed: 0.34 },
  "white gold": { polish: 0.12, brushed: 0.28 },
  platinum: { polish: 0.17, brushed: 0.32 },
  // Not in the source's table — the catalog's two non-metals, given plausible finishes rather
  // than being silently treated as steel.
  ceramic: { polish: 0.24, brushed: 0.4 },
  "carbon composite": { polish: 0.38, brushed: 0.55 },
};

const DEFAULT_FINISH = METAL_FINISH["stainless steel"];

/** The source's own size aliases — the catalog uses words for some case sizes. */
const SIZE_ALIAS: Record<string, number> = { medium: 37, large: 40 };

export function resolveReserveArchetype(style: string | null | undefined): ReserveArchetype {
  if (!style) return "dress";
  const needle = style.trim().toLowerCase();
  if (!needle) return "dress";
  for (const rule of STYLE_RULES) {
    if (needle.includes(rule.match)) return rule.archetype;
  }
  // Same defensive posture as every other resolver in this app: an unrecognised catalog string
  // produces a plausible watch, never a blank screen on a paid reveal. `dress` is the right
  // default because it is the plainest of the five.
  return "dress";
}

/** Millimetres from the catalog's free-text size column ("41mm", "Medium"). */
function resolveCaseRadius(caseSize: string | null | undefined): number {
  const fallbackMm = 40;
  if (!caseSize) return fallbackMm / 2000;
  const parsed = parseFloat(caseSize);
  if (Number.isFinite(parsed) && parsed > 0) return parsed / 2000;
  const alias = SIZE_ALIAS[caseSize.trim().toLowerCase()];
  return (alias ?? fallbackMm) / 2000;
}

/** Relative luminance test matching the source's own `spec.dialColor > 0x999999` threshold, but
 * computed properly rather than by integer comparison — that comparison treats a saturated blue
 * as "light" purely because of where its bits land. */
function isLightHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
}

/**
 * Derives the full spec for one pulled watch from its own catalog columns.
 *
 * `watchName` is used only for the date-window heuristic, exactly as the source's
 * `/Datejust|Oyster Perpetual|Seamaster/` test does — the catalog has no explicit complication
 * column, so the model name is the only available signal.
 */
export function resolveReserveSpec(item: {
  style?: string | null;
  caseMaterial?: string | null;
  dialColor?: string | null;
  caseSize?: string | null;
  watchName?: string | null;
}): ReserveWatchSpec {
  const archetype = resolveReserveArchetype(item.style);

  const metalHex = resolveCaseMetalHex(item.caseMaterial, "#dae0e4");
  const finish = item.caseMaterial
    ? METAL_FINISH[item.caseMaterial.trim().toLowerCase()] ?? DEFAULT_FINISH
    : DEFAULT_FINISH;

  // The catalog's dial column can carry two colours ("Black / Burgundy Bezel"): the first is the
  // dial, the second becomes the bezel insert or chronograph accent.
  const tokens = (item.dialColor ?? "").split("/");
  const dialHex = resolveDialColorHex(tokens[0] ?? null, "#14161a");
  const accentHex = tokens[1] ? resolveDialColorHex(tokens[1], dialHex) : null;

  const style = (item.style ?? "").toLowerCase();
  const name = item.watchName ?? "";

  // Square/rectangular cases and Reverso godrons are properties of specific models, which the app
  // catalog (unlike the design's own hand-authored HERITAGE array) has no columns for. Matched by
  // model name — the same approach the source already uses for the date window.
  const squareCase = /Monaco|Santos|Ingenieur/i.test(name);
  const godrons = /Reverso/i.test(name);

  const dialVariant: DialVariant =
    /white birch|birch/i.test(item.dialColor ?? "") || /Grand Seiko|Evolution/i.test(name)
      ? "birch"
      : archetype === "chronograph"
        ? "matte"
        : "sunburst";

  const strap: ReserveStrap =
    archetype === "rectangular"
      ? "leather"
      : archetype === "integrated"
        ? "integrated"
        : archetype === "chronograph" && squareCase
          ? "leather"
          : "link";

  return {
    archetype,
    caseR: resolveCaseRadius(item.caseSize),
    metalHex,
    polish: finish.polish,
    brushed: finish.brushed,
    dialHex,
    accentHex,
    lightDial: isLightHex(dialHex),
    dialVariant,
    strap,
    squareCase,
    godrons,
    subdials: archetype === "chronograph",
    dateWindow: /Datejust|Oyster Perpetual|Seamaster/i.test(name),
    lume: archetype === "diver" || /tool/.test(style),
    romanIndices: archetype === "rectangular",
  };
}
