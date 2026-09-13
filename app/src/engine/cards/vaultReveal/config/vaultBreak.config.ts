import type { VaultBreakPersonality } from "./types";

// Numbers carried over unchanged from the Claude Design handoff (the original prototype's
// tiers.js 'vault-break' entry) so the geometry/art/timing layers below reproduce the approved
// design rather than reinterpreting it. `deck` is deliberately not part of this file — see
// types.ts's header for why.
const BASE_W = 0.068;

export const vaultBreakPersonality: VaultBreakPersonality = {
  id: "vault-break",
  size: { width: BASE_W * 1.03, height: BASE_W * 1.03 * (1200 / 800), thickness: 0.0185 },
  seamFrac: 0.222,
  flapFrac: 0.074,
  palette: {
    violet: "#3a1a6e",
    plum: "#1b0a33",
    ink: "#0a0413",
    champagne: "#e8cf9a",
    champagneHi: "#fbf0d4",
    champagneMid: "#b99b57",
    champagneDark: "#6f5a2c",
    graphite: "#3a3742",
    ivory: "#f4ece0",
  },
  copy: {
    kicker: "Tier II · Sealed",
    title: "Vault ",
    titleEmphasis: "Break",
    meta: ["6 CARDS", "1 PRIME OR ABOVE", "SERIES I · S·1a"],
    hintDrag: "Drag along the seam",
    hintInspect: "Tap a card to inspect",
  },
  material: { roughness: 0.19, metalness: 0.62, peel: 0.46 },
  // releaseFrac: a release past this fraction of the reachable drag distance commits to the full
  // tear (spring.target = 1, see useVaultInteraction.ts); a release short of it springs the strip
  // back to sealed (spring.target = 0) instead — the "revert to original state" half of the same
  // check. 0.75 means the drag has to be genuinely most of the way through before it commits (a
  // fast flick still completes it regardless of distance, via FLICK_THRESHOLD).
  tear: { stretch: 0.05, releaseFrac: 0.75, springK: 40, damping: 0.72, glint: 0.72 },
  liner: { enabled: true, metalness: 0.95, roughness: 0.22 },
  riseY: 0.045,
  fan: {
    stepX: 0.0285, angle: 0.155, arcDrop: 0.0045, liftY: 0.024,
    heroZ: 0.026, heroScale: 1.16, grailZ: 0.018,
  },
  reveal: {
    stack: 1.0, hold: 0.6, rise: 0.85, separate: 1.6, settle: 0.8,
    notice: 2.3, approach: 1.7, reveal: 1.5, present: 1.9,
  },
  haptics: { tickCount: 16, giveAt: 0.05, completeAt: 0.97 },
  // Carried over unchanged from VaultScene.tsx's previously-hardcoded JSX light colors —
  // see config/types.ts's VaultLighting doc comment for why these moved here.
  lighting: { key: 0xfff3dc, rim: 0x7d4ce0, hemiSky: 0x231540, hemiGround: 0x05030a, spot: 0xfff2d8 },
};
