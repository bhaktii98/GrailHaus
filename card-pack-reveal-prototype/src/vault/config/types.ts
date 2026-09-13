// Tier 2 — "Vault Break". Kept as its own type module rather than folding
// into ../../reveal/config/types.ts: a CategoryPersonality (Tier 1) is a
// palette/copy/timing swap over one shared tear-only engine, but Vault
// Break adds a second engine stage the Tier 1 shape has no room for — a
// staged card reveal (stack → hold → rise → separate → settle → notice →
// approach → reveal → present → ready) with its own per-card spring
// targets, a metallic inner liner, and post-reveal card inspection
// (tap/drag/pinch/flip). Forcing that into CategoryPersonality would mean
// optional fields nothing else uses; two tiers is not yet a pattern worth
// a shared abstraction over (see project/tiers.js, which the original
// design handoff itself keeps as one config object per tier rather than a
// deeper type hierarchy).

export interface VaultSize {
  width: number;
  height: number;
  thickness: number;
}

export interface VaultPalette {
  violet: string;
  plum: string;
  ink: string;
  champagne: string;
  champagneHi: string;
  champagneMid: string;
  champagneDark: string;
  graphite: string;
  ivory: string;
}

export interface VaultCopy {
  kicker: string;
  title: string;
  titleEmphasis: string;
  meta: string[];
  hintDrag: string;
  hintInspect: string;
}

export interface VaultMaterial {
  roughness: number;
  metalness: number;
  /** width, in UV fraction, of the peel front's stretch/pucker zone */
  peel: number;
}

export interface VaultTear {
  /** fraction of travel the foil visibly stretches before the tear starts */
  stretch: number;
  /** fraction of remaining reach that counts as "committed to tearing" */
  releaseFrac: number;
  springK: number;
  damping: number;
  /** multiplier on the idle/drag crimp-glint opacity, 0..~1 */
  glint: number;
}

export interface VaultLiner {
  enabled: boolean;
  metalness: number;
  roughness: number;
}

export interface VaultFan {
  stepX: number;
  angle: number;
  arcDrop: number;
  liftY: number;
  heroZ: number;
  heroScale: number;
  grailZ: number;
}

/** Duration, in seconds, of each stage of the reveal sequence. */
export interface VaultRevealTiming {
  stack: number;
  hold: number;
  rise: number;
  separate: number;
  settle: number;
  notice: number;
  approach: number;
  reveal: number;
  present: number;
}

export type CardRarity = 'CORE' | 'PRIME' | 'GRAIL';

export interface VaultCardData {
  name: string;
  rarity: CardRarity;
  edition: string;
  finish: string;
  value: string;
  delta: number;
  tint: string;
  glowRGB: string;
  seed: number;
  serial: string;
  held: string;
  spark: number[];
}

export interface HapticTrackConfig {
  tickCount: number;
  giveAt: number;
  completeAt: number;
}

export interface VaultBreakPersonality {
  id: 'vault-break';
  size: VaultSize;
  seamFrac: number;
  flapFrac: number;
  palette: VaultPalette;
  copy: VaultCopy;
  material: VaultMaterial;
  tear: VaultTear;
  liner: VaultLiner;
  fan: VaultFan;
  reveal: VaultRevealTiming;
  haptics: HapticTrackConfig;
  riseY: number;
  deck: VaultCardData[];
}
