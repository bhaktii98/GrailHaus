// The Obsidian Vault as a category reveal configuration — the tier-3 counterpart to
// ../../reserveReveal/config/watchReserve.config.ts and ../../vaultReveal/config/watchVault.config.ts.
//
// Same contract, same shape, third personality. `RevealEngine` consumes this through the identical
// `CategoryRevealConfig` interface it uses for cards, handbags and the other two watch tiers, with
// no branch for "obsidian" anywhere in core/.
import type { CategoryRevealConfig } from "../../../core/types";
import { mountObsidianScene } from "../scene/ObsidianRevealScene";
import { obsidianTiming } from "./obsidianChoreography";

/**
 * From the design's own CSS (apex-vault.html: `body{background:#040405}`, the gold `#cbb27e` used
 * for the wordmark and tier label, `--ink: #d9cfbe`).
 *
 * The darkest ground of the three tiers by a clear margin — the Reserve is #100d0b (warm near-
 * black), The Archive #08090b (cool near-black), this #040405 (almost true black). That progression
 * is deliberate in the designs and is most of why the three read as an escalating series.
 */
export const OBSIDIAN_PALETTE = {
  background: "#040405",
  accent: "#cbb27e",
};

/**
 * Attaches the Obsidian Vault choreography to a category config.
 *
 * THE GESTURE MODE, which is the one genuinely awkward part of this wiring
 *
 * `CategoryRevealConfig.gesture.mode` is a single value for the whole reveal, and `GestureLayer`
 * derives its drag axis from it. This reveal has two gestures on different axes: the ribbon is
 * drawn horizontally, the lid lifted vertically. So `mode` here declares the axis of the *first*
 * stage ("tear" = x-axis), and the driver re-announces the axis as stages advance via its
 * `onStageChange` callback, which the engine uses to re-key the gesture layer.
 *
 * That is a slightly uncomfortable split — one field describing the first stage while a callback
 * describes the rest — and it is the honest minimum: widening `gesture` into a per-stage structure
 * would have forced every existing category to describe stages it does not have. The stage list on
 * the choreography is the real source of truth; `mode` is the bootstrap value for frame one.
 *
 * `travelDistance`/`velocityThreshold` likewise mirror the first stage's own values (see
 * OBSIDIAN_GESTURE_STAGES), so the initial layer is configured correctly before any stage change
 * has been announced.
 */
export function withObsidianChoreography(base: CategoryRevealConfig): CategoryRevealConfig {
  return {
    ...base,
    palette: OBSIDIAN_PALETTE,
    camera: {
      // The sequence's own opening key, so the single frame before the driver's first tick is
      // already correctly framed.
      position: [0.6, 0.45, 0.72],
      // The design uses fov 34 — a long lens, which flatters a large object and is part of why its
      // renders look photographed rather than rendered. Widened to 46 for portrait aspect (a 340mm
      // case is the widest object in the product), but kept tighter than the Reserve's 48 and The
      // Archive's 52 so this tier retains more of that long-lens character.
      fov: 46,
      // True-scale modelling plus a pinch-to-zoom inspection: r3f's default 0.1 near plane would
      // clip the watch away entirely at inspection distance. The design itself uses 0.02; 0.004
      // matches the other two tiers and allows a closer approach to the crown knurls.
      near: 0.004,
      far: 60,
    },
    gesture: {
      // The FIRST stage's axis — see the note above. Horizontal, for drawing the ribbon.
      mode: "tear",
      velocityThreshold: 900,
      travelDistance: 200,
    },
    timing: base.timing,
    // Superseded by the choreography's own absolute-time beats, pinned to the motion (the seal
    // giving, the lid seating, the APEX moment) rather than to a phase start.
    hapticTrack: () => [],
    // The choreography publishes its own eight phase labels through the driver.
    openingBeats: undefined,
    choreographyMode: {
      mount: mountObsidianScene,
      timing: obsidianTiming,
    },
  };
}
