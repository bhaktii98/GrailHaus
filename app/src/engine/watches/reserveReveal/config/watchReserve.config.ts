// The Reserve as a category reveal configuration — the tier-1 counterpart to
// ../../vaultReveal/config/watchVault.config.ts.
//
// Everything tier-specific lives in this object: palette, camera, gesture feel, and the
// choreography. `RevealEngine` consumes it through the same `CategoryRevealConfig` interface it
// uses for cards, handbags and The Archive, with no branch for "reserve" anywhere.
import type { CategoryRevealConfig } from "../../../core/types";
import { mountReserveScene } from "../scene/ReserveRevealScene";
import { reserveTiming } from "./reserveChoreography";

/**
 * The Reserve's visual identity, from the design source's own CSS custom properties
 * (heritage-case.html: `--ink: #efe6d8`, `--brass: #c39b57`, body background `#100d0b`).
 *
 * Warm where The Archive is cold — a lamplit walnut room against a machined black vault. That
 * contrast is the main thing that makes the two tiers read as different products rather than one
 * reveal in two colourways.
 */
export const RESERVE_PALETTE = {
  background: "#100d0b",
  accent: "#c39b57",
};

/**
 * Attaches the Heritage Case choreography to a category config.
 *
 * The gesture block is overridden because this reveal's drag means something specific: it scrubs
 * the lid open against a two-stage resistance curve over 2.6 seconds of timeline, and the design's
 * own hint reads "Slow and steady". `travelDistance` is raised well above tier 1's previous 140px
 * so the full lid travel takes a deliberate pull rather than a flick, and `velocityThreshold` is
 * raised to match — a Reserve lid should not fly open on a careless swipe, which is the tactile
 * difference between a friction-fit wooden hinge and a spring-loaded vault.
 */
export function withReserveChoreography(base: CategoryRevealConfig): CategoryRevealConfig {
  return {
    ...base,
    palette: RESERVE_PALETTE,
    camera: {
      // Overwritten immediately by the choreography's own keyframes; set to the sequence's opening
      // key so the single frame before the driver's first tick is already correctly framed.
      position: [0.3, 0.235, 0.42],
      // Wider than the seeded 40, for the same portrait-aspect reason The Archive's is 52: a
      // 176mm case has to fit a narrow frame's horizontal field of view. Slightly tighter than the
      // Archive's because this case is smaller than the vault.
      fov: 48,
      // True-scale modelling: the case is 0.176m and the user can pinch in to inspect a 0.8mm
      // applied index, so r3f's default 0.1 near plane would clip the subject away.
      near: 0.004,
      far: 60,
    },
    gesture: {
      mode: "lift-lid",
      velocityThreshold: 620,
      travelDistance: 300,
    },
    timing: base.timing,
    // Superseded by the choreography's own absolute-time beats, which are pinned to the motion
    // (the detent, the lid seating, the rise beginning, the settle) rather than to a phase start.
    hapticTrack: () => [],
    // The choreography publishes its own phase labels, which are exactly the five the engine's
    // LID_STATES list already renders for lift-lid categories.
    openingBeats: undefined,
    choreographyMode: {
      mount: mountReserveScene,
      timing: reserveTiming,
    },
  };
}
