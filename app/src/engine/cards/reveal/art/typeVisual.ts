// The single per-Pokémon-type color/motion table for the hold-to-open reveal's type-driven
// visuals (see engine/cards/reveal/holdToOpen/HoldToOpenFanReveal.tsx's TypeGlow/TypeWordOverlay,
// vaultReveal/art/cardArt.ts's baked face tint, and VaultVignette's optional recolor). Ported
// from the original design prototype's own `TYPES`/`typeOf()` table — same 18 canonical types,
// same fx bucket per type — but colors are plain hardcoded hex, not live oklch(L,C,H) math (no
// color-space conversion dependency exists in this codebase, and none is needed since every real
// pull's type is known at adapt/bake time, not computed interactively).
//
// Colors for the 9 types `content/cardArt.ts`'s TYPE_GRADIENTS already covers (Electric, Fire,
// Water, Grass, Psychic, Metal, Steel, Dragon, Ground, Ice) reuse that file's own mid-stop hex —
// so a Fire-type pull's reveal-screen glow matches the same Fire color the user already sees on
// Discover/Vault detail/Marketplace for that same item, rather than a second, inconsistent
// palette. `Metal`/`Steel` share one color there, aliased the same way here. The remaining 9
// (Fairy, Flying, Fighting, Rock, Bug, Ghost, Dark, Poison, Normal) are hand-picked hex anchored
// to the prototype's own oklch hue numbers.
export type MoteFx = "rise" | "fall" | "burst" | "drift";

export interface TypeVisual {
  hex: string;
  /** Same color as `hex`, as an "r,g,b" triple for building rgba() strings. */
  rgb: string;
  fx: MoteFx;
}

function tv(hex: string, r: number, g: number, b: number, fx: MoteFx): TypeVisual {
  return { hex, rgb: `${r},${g},${b}`, fx };
}

export const TYPE_VISUALS: Record<string, TypeVisual> = {
  // Reused from content/cardArt.ts's TYPE_GRADIENTS mid-stop.
  Fire: tv("#E0761A", 224, 118, 26, "rise"),
  Grass: tv("#6FB758", 111, 183, 88, "rise"),
  Water: tv("#59D8FF", 89, 216, 255, "fall"),
  Ice: tv("#8FA9FF", 143, 169, 255, "fall"),
  Electric: tv("#FFC94A", 255, 201, 74, "burst"),
  Ground: tv("#B87A4E", 184, 122, 78, "burst"),
  Steel: tv("#6C8BF5", 108, 139, 245, "burst"),
  Metal: tv("#6C8BF5", 108, 139, 245, "burst"), // real catalog data uses "Metal" — same look as Steel.
  Dragon: tv("#8A2CE0", 138, 44, 224, "burst"),
  Psychic: tv("#C64BFF", 198, 75, 255, "drift"),

  // Hand-picked, anchored to the prototype's own oklch hues — no equivalent in content/cardArt.ts.
  Fairy: tv("#FF8FC4", 255, 143, 196, "rise"),
  Flying: tv("#A8A8E8", 168, 168, 232, "rise"),
  Fighting: tv("#E0642E", 224, 100, 46, "burst"),
  Rock: tv("#B8A560", 184, 165, 96, "burst"),
  Bug: tv("#8BC34A", 139, 195, 74, "burst"),
  Ghost: tv("#9B59D0", 155, 89, 208, "drift"),
  Dark: tv("#6B5B7A", 107, 91, 122, "drift"),
  Poison: tv("#C44FC4", 196, 79, 196, "drift"),
  Normal: tv("#B8AEC2", 184, 174, 194, "drift"),
};

/** The catalog's `pokemonType` is sometimes a dual type ("Water / Dark") — only the first listed
 * type decides the visual, matching the prototype's own `typeOf()`. Unknown/missing types fall
 * back to Normal (the prototype's own fallback). */
export function typeVisualOf(pokemonType: string | null | undefined): TypeVisual {
  if (!pokemonType) return TYPE_VISUALS.Normal;
  const first = pokemonType.split("/")[0].trim();
  // Case-insensitive match against the canonical keys above — real catalog casing is consistent,
  // but this costs nothing and is cheap defensiveness against a stray casing mismatch.
  const key = Object.keys(TYPE_VISUALS).find((k) => k.toLowerCase() === first.toLowerCase());
  return key ? TYPE_VISUALS[key] : TYPE_VISUALS.Normal;
}
