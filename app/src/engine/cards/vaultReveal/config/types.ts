// Ported from card-pack-reveal-prototype/src/vault/config/types.ts — originally just Tier 2
// "Vault Break". Kept as its own type module rather than folding into
// ../../reveal/config/types.ts: a CategoryPersonality (Tier 1) is a palette/copy/timing swap
// over one shared tear-only engine, but this shape adds a second engine stage Tier 1 has no room
// for — a staged card reveal (stack -> hold -> rise -> separate -> settle -> notice -> approach
// -> reveal -> present -> ready) with its own per-card spring targets, a metallic inner liner,
// and post-reveal card inspection (tap/drag/pinch/flip).
//
// `VaultBreakPersonality`'s `id` is now a union of both premium-tier ids it actually describes —
// Vault Break AND Black Label (../../blackLabelReveal/config/blackLabel.config.ts) reuse this
// exact shape and the engine/scene/gesture code built against it unchanged, since Black Label
// turned out to need the identical staged-reveal machinery, just its own palette/copy/timing.
// The name stays `VaultBreakPersonality` rather than a generic rename (a bigger, riskier diff
// across every file that imports it) — read it as "premium 3D card-tier personality," not as
// scoped to one tier, now that a second tier is using it. `lighting` is new for the same reason:
// VaultScene.tsx's light colors were hardcoded JSX literals (a fixed warm-champagne/violet rig)
// until Black Label needed its own onyx/bronze rig — pulling them into the personality was less
// code than forking the scene component.
//
// One deliberate change from the prototype: `VaultBreakPersonality` no longer carries `deck`.
// The prototype's own deck was six hardcoded fictional cards (fake names, fake ownership
// history, fake price history) for a standalone demo with no real pull to show — real or empty,
// a deck is passed into buildVaultPackObject as its own argument now, not baked into the
// personality. In the app's current integration it's always empty: the staged card-fan reveal
// this type shape exists for moved out of the 3D scene entirely (see VaultTearStage.tsx's
// header for why) in favor of a flat-2D screen reusing CardFlowEngine's own per-card views.

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

export type CardRarity = "CORE" | "PRIME" | "GRAIL";

export interface VaultCardData {
  name: string;
  rarity: CardRarity;
  /** The real, admin-configurable rarity tier name (e.g. from `rarityTiers`) — drawn on the
   * card's ribbon instead of the hardcoded CORE/PRIME/GRAIL label so a renamed tier shows its
   * real name. `rarity` above still drives styling (glow/metalness) by ordinal bucket. */
  rarityLabel: string;
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

  // Optional theme hooks — see art/cardArt.ts's header. Vault Break's real-data adapter
  // (engine/adaptRealDeck.ts) leaves all of these undefined and gets the original look; Black
  // Label's (../../blackLabelReveal/engine/adaptBlackLabelDeck.ts) sets them.
  /** Card-stock background gradient, top/mid/bottom. */
  stock?: [string, string, string];
  /** Rarity-ribbon gradient, overriding the ordinal-rarity default. */
  ribbon?: [string, string, string];
  accent?: string;
  accentRGB?: string;
  /** Which abstract art window function fills the card's art window when no real catalog photo
   * exists — 'vault' (default) or 'pyro'. */
  windowArt?: "vault" | "pyro";
  /** Replaces the held-since line with an italic pull-quote (Black Label's Grail card, per the
   * design) — the two are mutually exclusive, not stacked. */
  tagline?: string;
  /** Shown as bordered chips in the flat-2D fan reveal's inspect sheet. */
  traits?: string[];
  /** Free-text category shown in the inspect sheet's meta line (e.g. "Fire"). */
  type?: string;
}

export interface HapticTrackConfig {
  tickCount: number;
  giveAt: number;
  completeAt: number;
}

/** VaultScene.tsx's light rig colors — three.js 0xRRGGBB numeric colors, not CSS strings,
 * matching how they're passed to <directionalLight color={...}>/<hemisphereLight args={...}>
 * etc. directly. */
export interface VaultLighting {
  key: number;
  rim: number;
  hemiSky: number;
  hemiGround: number;
  spot: number;
}

export interface VaultBreakPersonality {
  id: "vault-break" | "black-label";
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
  lighting: VaultLighting;
}
