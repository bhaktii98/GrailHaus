import { vaultBreakPersonality } from "../vaultReveal/config/vaultBreak.config";
import { cardPackPersonality } from "../reveal/config/cardPack.config";
import { BLACK_LABEL_PALETTE, BLACK_LABEL_KICKER } from "../blackLabelReveal/config/blackLabel.palette";

/**
 * Each card tier's reveal *identity*, in the one shape the bulk run's stages need.
 *
 * The single-pack rip already gives every tier a distinct visual signature — Street Rip's violet
 * and gold, Vault Break's violet-and-champagne vault, Black Label's ember-and-bronze fire. Before
 * this module the bulk run ignored all of it and rendered every tier in the same generic accent,
 * so ripping ten Black Labels looked nothing like ripping one. That inconsistency is what this
 * fixes: the Grail Hunt, prime grid and core list now read as the same product as the tier's own
 * single-pack reveal.
 *
 * The values are pulled from each tier's *existing* personality config wherever one exists
 * (`blackLabel.config.ts`, `vaultBreak.config.ts`, `cardPack.config.ts`) rather than re-typed, so
 * a palette change in the single-pack reveal follows through to the bulk run automatically and
 * the two can't drift apart. The handful of literals below are the accents each tier's
 * `HoldToOpenFanReveal` wrapper already passes as its `HoldToOpenPalette` — the same values, kept
 * deliberately in step with those wrappers (VaultCardFanReveal, BlackLabelFanReveal,
 * CardPackFanReveal).
 *
 * `ambience` is the one genuinely new concept, and it is a *characterisation* rather than a port:
 * it says what a tier's atmosphere should feel like in 2D, so the stages can express fire, vault
 * or foil without any of them mounting a 3D particle system. See `GrailAmbience` in
 * GrailHuntStage for how each is drawn.
 */
export type TierAmbience = "foil" | "vault" | "ember";

/** How a tier's reveal *feels* under the thumb. Ported from each tier's own `haptics` config and
 * the character of its tear: Black Label's foil is heavier-gauge and resists a beat longer before
 * it gives (`tear.stretch` 0.07, `springK` 44), so its beats land harder and denser than Vault
 * Break's, which in turn out-weighs the base pack's. */
export interface TierHaptics {
  /** The impact used for a grail's landing. */
  land: "medium" | "heavy";
  /** Extra pre-beats during the anticipation — how much the tier "builds". */
  buildSteps: number;
  /** Whether the climax earns a doubled success note (Black Label's release-burst). */
  climaxDouble: boolean;
}

export interface TierRevealIdentity {
  /** Card border / chip tint — the tier's metal. */
  accentHex: string;
  /** Same colour as an "r,g,b" triple, for building rgba() strings. */
  accentRGB: string;
  /** The "room" colour behind the card — Vault Break's violet, Black Label's ember. */
  vignetteGlow: string;
  /** Small caps label above the run, matching the tier's own sealed-pack kicker. */
  kicker: string;
  /** Which atmospheric treatment the grail reveal draws. */
  ambience: TierAmbience;
  /** The grail moment's hot core colour — the brightest point of a reveal. Black Label's fire
   * palette peaks at champagne-white, Vault Break's at pale champagne, Street Rip's at gold. */
  hotHex: string;
  /** Background the stage paints. Black Label is near-black so its embers carry; the others keep
   * the app's standard reveal ground. */
  backgroundHex: string;
  /**
   * The tier's card-back gradient — what a face-down grail shows before it turns, and the wash
   * behind its prime/core tiles. Taken from each tier's sealed-pack palette so a face-down card in
   * the bulk run is the same material as the pack it came out of.
   */
  cardBackGradient: [string, string];
  /** The gradient behind the whole stage — the tier's "room". Deep, low-contrast, never competing
   * with the card. */
  backdropGradient: [string, string];
  haptics: TierHaptics;
}

/**
 * Black Label's numbers come from its fire system (`art/fire.ts`), whose palette is documented
 * there as "crimson at the tail, molten orange through the body, champagne-white only at the
 * core" — HOT `0xfff1cf`, MID `0xff7a1e`, COOL `0x7a0f06`. The ember rim `#ff7a1e` is also this
 * tier's configured `lighting.rim`, so the 2D ambience below is lit by the same colour the 3D
 * scene is.
 */
const BLACK_LABEL: TierRevealIdentity = {
  accentHex: "#c9a24a",
  accentRGB: "201,162,74",
  vignetteGlow: "rgba(180,140,60,0.20)",
  kicker: BLACK_LABEL_KICKER,
  ambience: "ember",
  hotHex: "#fff1cf",
  backgroundHex: "#08060a",
  // The sealed Black Label pack itself: near-black graphite over ink, with the bronze crimp.
  cardBackGradient: [BLACK_LABEL_PALETTE.graphite, BLACK_LABEL_PALETTE.ink],
  // The fire's own heat pushed into the room — crimson tail bleeding into near-black.
  backdropGradient: ["#1a0705", "#08060a"],
  // Heaviest foil of the three: a longer resist, then a harder give.
  haptics: { land: "heavy", buildSteps: 2, climaxDouble: true },
};

/** Vault Break's violet rim (`lighting.rim` = `0x7d4ce0`) over champagne. */
const VAULT_BREAK: TierRevealIdentity = {
  accentHex: "#e8cf9a",
  accentRGB: "232,207,154",
  vignetteGlow: "rgba(92,52,158,0.20)",
  kicker: vaultBreakPersonality.copy.kicker,
  ambience: "vault",
  hotHex: "#fbf0d4",
  backgroundHex: "#0a0413",
  // The sealed Vault Break pack: violet over plum.
  cardBackGradient: [vaultBreakPersonality.palette.violet, vaultBreakPersonality.palette.plum],
  backdropGradient: ["#1a0d33", "#0a0413"],
  // Lighter foil than Black Label, still substantial.
  haptics: { land: "medium", buildSteps: 1, climaxDouble: true },
};

/** Tier 1 — the plain sealed pack. GrailHaus violet with a gold foil accent. */
const STREET_RIP: TierRevealIdentity = {
  accentHex: "#d8a93f",
  accentRGB: "216,169,63",
  vignetteGlow: "rgba(177,75,255,0.18)",
  kicker: "Sealed · Series I",
  ambience: "foil",
  hotHex: "#ffe9b0",
  backgroundHex: "#0b0b10",
  // The base sealed pack: GrailHaus violet over its deep shade.
  cardBackGradient: [cardPackPersonality.palette.violet, cardPackPersonality.palette.violetDeep],
  backdropGradient: ["#160a2c", "#0b0b10"],
  // The quietest tier — one clean beat, no extended build.
  haptics: { land: "medium", buildSteps: 0, climaxDouble: false },
};

const BY_TIER: Record<string, TierRevealIdentity> = {
  black_label: BLACK_LABEL,
  vault_break: VAULT_BREAK,
  street_rip: STREET_RIP,
};

/**
 * The reveal identity for a pack tier. Unknown tiers (a new SKU added in the admin dashboard
 * before it has its own personality) fall back to Street Rip's rather than rendering colourless —
 * the same "degrade to the base tier" default `ART_GRADIENT` already uses in PackTile.
 */
export function tierRevealIdentity(tier: string): TierRevealIdentity {
  return BY_TIER[tier] ?? STREET_RIP;
}

/** Street Rip's own palette, referenced so a change there is picked up here rather than this
 * module quietly disagreeing with the pack art. */
export const streetRipPalette = cardPackPersonality.palette;
