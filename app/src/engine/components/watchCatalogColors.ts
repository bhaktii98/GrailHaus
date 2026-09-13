/**
 * Resolves the free-text `dial_color`/`case_material` catalog columns (imported straight from the
 * same spreadsheet the design source's own watch-catalog.js reads — see e.g. "Turquoise Blue",
 * "Slate Grey / Green", "Oystersteel") into an actual hex value WatchMesh can hand to a
 * `meshStandardMaterial`. Every table entry and the parsing rule below (first token before "/" is
 * the dial itself, the rest is bezel/accent flavor text this simplified single-archetype mesh
 * doesn't render) is copied directly from watch-catalog.js's own `DIAL_COLORS`/`METALS` tables and
 * `colorFor` function, so a real catalog row resolves to the same color family the source itself
 * would have shown, not a re-guessed palette.
 *
 * Falls back to the caller's own color (the pack's rarity-tier hex, same as before this file
 * existed) whenever the text is missing or matches nothing recognized — never blocks the reveal
 * on unrecognized catalog data, and never has to change if a future spreadsheet row uses different
 * wording (worst case: it renders exactly as it did before this fix, not broken).
 */

const DIAL_COLOR_HEX: Record<string, string> = {
  "turquoise blue": "#3fb8c4",
  "slate grey": "#4d5257",
  green: "#1f4632",
  black: "#14161a",
  blue: "#1b3a63",
  silver: "#cdd0d2",
  white: "#e8e8e6",
  "silver white": "#d9dcdc",
  burgundy: "#4e1520",
  orange: "#d2691a",
  "khaki green": "#5a5f3c",
  skeleton: "#2a2c30",
};

const CASE_METAL_HEX: Record<string, string> = {
  oystersteel: "#dfe4e8",
  "stainless steel": "#dae0e4",
  titanium: "#bcc1c5",
  "18k gold": "#c9a44c",
  "white gold": "#dcdfe2",
  platinum: "#cfd2d2",
};

export function resolveDialColorHex(dialColor: string | null | undefined, fallback: string): string {
  if (!dialColor) return fallback;
  // "Black / Burgundy Bezel" — first token is the dial itself, matching watch-catalog.js's own
  // `row.dial.split('/')` convention; the second token (bezel/accent) isn't rendered here.
  const token = dialColor
    .split("/")[0]
    ?.trim()
    .toLowerCase()
    .replace(/\s*bezel\s*$/, "");
  if (!token) return fallback;
  if (DIAL_COLOR_HEX[token]) return DIAL_COLOR_HEX[token];
  const hit = Object.keys(DIAL_COLOR_HEX).find((key) => token.includes(key));
  return hit ? DIAL_COLOR_HEX[hit] : fallback;
}

export function resolveCaseMetalHex(caseMaterial: string | null | undefined, fallback: string): string {
  if (!caseMaterial) return fallback;
  const key = caseMaterial.trim().toLowerCase();
  return CASE_METAL_HEX[key] ?? fallback;
}

/**
 * Hands/markers/logo used to be a single fixed dark grey, which read fine against the mesh's old
 * always-gold-or-tierColor dial but effectively vanished once real per-item dial colors (above)
 * could land on something dark ("Black", "Blue", "Burgundy") — a dark-on-dark dial looks like a
 * blank disc, not a watch face. Mirrors watch-builder.js's own `const light = spec.dialColor >
 * 0x999999` convention: pick the hand/marker tone from the dial's actual luminance so it's always
 * legible, instead of hardcoding one that only works for some dials.
 */
export function contrastHexFor(dialHex: string): string {
  const n = parseInt(dialHex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 140 ? "#eceef0" : "#1c1e22";
}
