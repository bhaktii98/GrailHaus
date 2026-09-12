// The Collector's Vault as a *category reveal configuration* — the file that makes this whole
// reveal a config entry rather than a fourth hardcoded screen.
//
// Everything category-specific about the vault lives in this object: its palette, camera, gesture
// feel, timing, haptic beats, and (the new part) its choreography. `RevealEngine` consumes it
// through the same `CategoryRevealConfig` interface it already uses for cards, tier-1 watches and
// handbags — it has no branch for "vault", no import from this folder, and no knowledge that a
// timeline reveal is what it happens to be running.
//
// HOW THIS RELATES TO THE BACKEND-DRIVEN CATEGORY ROW
//
// A category's personality normally comes from the `categories` table (see
// server/scripts/seedCategories.ts and core/categoryRevealConfig.ts), and that remains true: this
// file does not replace that row, it *decorates* it. `withVaultChoreography` takes whatever the
// admin configured for watches and attaches the choreography mode, so palette/camera/lighting
// edits made in the admin dashboard still flow through. Only the choreography itself is code,
// for the same reason `meshArchetype` is code: no config system invents 3D topology or motion
// curves from numbers alone.
//
// That is also the answer to "wire in a third category live." A handbag reveal with its own
// timeline writes one of these — a scene builder, a set of curves, a phase list — and appends one
// registry entry. Nothing in core/ changes.
import type { CategoryRevealConfig } from "../../../core/types";
import { mountVaultScene } from "../scene/VaultRevealScene";
import { vaultTiming } from "./vaultChoreography";

/**
 * The vault's own visual identity, from the design source's HTML (collectors-vault.html's CSS
 * custom properties and the stage's background attribute).
 *
 * Deliberately darker and cooler than the tier-1 watch palette (#0a0908 / #c9a24b — a warm walnut
 * and brass presentation case). The Archive is a machined black-lacquer-and-titanium vault, and its
 * accent is the design's own champagne `--icon` rather than tier 1's brass, so the two tiers read
 * as genuinely different objects rather than a re-skin.
 */
export const VAULT_PALETTE = {
  background: "#08090b",
  accent: "#c9a96b",
};

/**
 * Attaches the vault choreography to a category config.
 *
 * The gesture block is overridden rather than inherited, because this reveal's drag means something
 * different from tier 1's: it scrubs a 4.1-second stretch of timeline rather than driving a 0..1
 * lid angle, and the design's own pointer handling uses a 260px pull span (vault.js:749). The
 * `travelDistance` below matches that span so the drag covers lock-plus-lid in one natural pull,
 * and `velocityThreshold` is lowered from tier 1's 500 because a flick here should commit the
 * sequence readily — the reveal continues on its own once committed, so an over-eager threshold
 * costs the user nothing, while a sticky one makes an expensive purchase feel unresponsive.
 */
export function withVaultChoreography(base: CategoryRevealConfig): CategoryRevealConfig {
  return {
    ...base,
    palette: VAULT_PALETTE,
    camera: {
      // Position is immediately overwritten by the choreography's own keyframes (see
      // vaultChoreography's CAM_KEYS) — it only matters for the single frame before the driver's
      // first tick, so it is set to the sequence's own opening key rather than the seeded
      // tier-1 value, which would otherwise show one frame of a wildly different framing.
      position: [0.45, 0.3, 0.54],
      // Wider than the seeded 40. That value frames the tier-1 presentation case, a compact object
      // shot from 3.2 units away; this vault is 0.26m wide and seen from ~0.5m, and on a portrait
      // phone the binding constraint is horizontal fit. 52 buys back enough width to hold the whole
      // vault without the edge distortion a much wider angle would introduce — the rest of the
      // framing is handled by camera distance, which preserves the design's proportions.
      fov: 52,
      // The design source sets near = 0.004 (vault.js:823) precisely because this scene is modelled
      // at true scale: bezel flutes are 0.8mm and the user can pinch in to look at them. r3f's
      // default 0.1 near plane would clip the entire watch away at inspection distance.
      near: 0.004,
      far: 60,
    },
    gesture: {
      mode: "lift-lid",
      velocityThreshold: 380,
      travelDistance: 260,
    },
    // The opening hold is the choreography's own business now — its 12.6s timeline replaces the
    // engine's `commonBeatMs`/`rareHoldMs` wait entirely (the driver calls `onComplete` when the
    // timeline ends). These stay populated because `CategoryRevealConfig` requires them and a
    // resumed-from-disk flow can still read them, but they no longer pace this reveal.
    timing: base.timing,
    // Superseded by the choreography's own absolute-time beats (vaultTiming.haptics), which are
    // pinned to the motion rather than to a phase start. Returning an empty track keeps the engine
    // from firing a second, unsynchronised set on top of them.
    hapticTrack: () => [],
    // The choreography publishes its own phase labels through the driver, so the engine's
    // phase-relative narration would duplicate them one beat out of step.
    openingBeats: undefined,
    choreographyMode: {
      mount: mountVaultScene,
      timing: vaultTiming,
    },
  };
}

// Which packs get this reveal is NOT decided here — see engine/core/choreographyRegistry.ts, which
// owns the single (category, tier) -> reveal mapping for every tier. This module used to export its
// own `usesVaultChoreography` gate; that was fine while The Archive was the only timeline reveal
// and became a duplicate the moment The Reserve arrived, since two independent gating paths can
// disagree. One registry, one call site.
