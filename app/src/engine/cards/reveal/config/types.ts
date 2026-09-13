// A "category personality" is the unit of configuration the reveal engine
// composes over — per instructions.md's architecture requirement, a new
// category (e.g. watches, or the "handbags" example given on the review
// call) should be a new object shaped like this, not a forked screen.
//
// Only the cards personality is implemented in this pass (see README —
// scope was deliberately narrowed to the pack-tear reveal). The shape below
// is kept deliberately generic so a second personality can be dropped in
// without touching the engine, gesture hook, or scene component.

export interface PackSize {
  /** pack width, in real-world meters (three.js scene units) */
  width: number;
  height: number;
  thickness: number;
}

export interface PackPalette {
  ink: string;
  gold: string;
  goldHi: string;
  goldDark: string;
  bone: string;
  violet: string;
  violetDeep: string;
}

export interface PackCopy {
  wordmark: string;
  subline: string;
  sealedWord: string;
  codeBadge: string;
  footer: string;
  backHeaderLine1: string;
  backHeaderLine2: string;
  backBullets: string[];
  kicker: string;
  title: string;
  titleEmphasis: string;
  meta: string[];
}

export interface CardFaceCopy {
  rarityRibbon: string;
  name: string;
  category: string;
  heldSince: string;
  estValueLabel: string;
  estValue: string;
  changeLabel: string;
  changePct: string;
  footerLeft: string;
  footerRight: string;
}

/** Timing thresholds along progress ∈ [0,1] — the same curve shape the web
 * prototype used, kept as named constants so a category can retune pacing
 * without touching the deformation math. */
export interface PackTiming {
  /** progress at which the peel of the lid completes (foil fully detached) */
  peelEnd: number;
  /** progress at which the body's mouth starts gaping open */
  gapeStart: number;
  /** progress at which cards start rising */
  riseStart: number;
  /** progress at which cards finish fanning */
  fanStart: number;
  /** progress at which the torn strip releases and the reseal button appears */
  releaseStart: number;
}

export interface HapticTrackConfig {
  /** number of light ticks across the full tear, evenly spaced */
  tickCount: number;
  /** progress at which the foil "gives" with a sharper impact */
  giveAt: number;
  /** progress at which the completion/success notification fires */
  completeAt: number;
}

export interface CategoryPersonality {
  id: string;
  size: PackSize;
  seamFrac: number;
  flapFrac: number;
  palette: PackPalette;
  copy: PackCopy;
  cardFace: CardFaceCopy;
  timing: PackTiming;
  haptics: HapticTrackConfig;
  cardCount: number;
}
