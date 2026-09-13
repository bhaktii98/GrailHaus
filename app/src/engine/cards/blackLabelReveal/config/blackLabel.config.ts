import type { VaultBreakPersonality } from "../../vaultReveal/config/types";
import { SEAM_FRAC, FLAP_FRAC } from "../art/blackLabelArt";
// Palette/kicker live in their own dependency-free module so consumers that need only this tier's
// colours (the bulk run's tierPersonality.ts) don't pull the Skia art chain in with them.
import { BLACK_LABEL_PALETTE, BLACK_LABEL_KICKER } from "./blackLabel.palette";

// Tier 3 — "Black Label". Numbers below are carried over from the actual Claude Design handoff
// (grailhaus-vault-break.html's "Black Label" canvas + apex-art.js/fire.js) rather than the
// GrailHaus PRD's own §6/§11 text — the two disagree on card count and the guarantee wording
// (PRD: 7 cards, "at least 2 Prime-or-Grail"; the shipped design: 6 cards, "1 Prime or above",
// "Grail 1 in 25 packs" per its own copy and its apexDeck() — 6 entries). Since the ask here was
// explicitly to match the design canvas exactly, this follows the design, not the PRD text; the
// discrepancy is worth resolving with product before this ships for real, but isn't this file's
// call to make silently.
//
// Reuses Vault Break's personality shape (see ../../vaultReveal/config/types.ts's header) — same
// engine, same staged-reveal machinery, same tap/drag/pinch/flip inspection. `seamFrac`/
// `flapFrac` are re-exported from the ported art module rather than duplicated, since the art and
// the geometry have to agree on where the crimp/seam actually are.
const BASE_W = 0.068;

export const blackLabelPersonality: VaultBreakPersonality = {
  id: "black-label",
  size: { width: BASE_W * 1.06, height: BASE_W * 1.06 * (1200 / 800), thickness: 0.02 },
  seamFrac: SEAM_FRAC,
  flapFrac: FLAP_FRAC,
  palette: { ...BLACK_LABEL_PALETTE },
  copy: {
    kicker: BLACK_LABEL_KICKER,
    title: "Black Label",
    titleEmphasis: "",
    meta: ["6 CARDS", "1 PRIME OR ABOVE", "GRAIL 1 IN 25"],
    hintDrag: "Tap and drag to open",
    hintInspect: "Tap a card to inspect · drag to rotate",
  },
  // Stiffer, denser foil than Vault Break (lower roughness/higher metalness) — reads as a
  // heavier-gauge material under the thumb, matching "something serious could happen here."
  material: { roughness: 0.15, metalness: 0.7, peel: 0.44 },
  // A longer pre-tear stretch (0.07 vs. Vault Break's 0.05) and a stiffer spring (springK 44 vs.
  // 40) — the foil resists a beat longer before it gives, and settles with less bounce once it
  // does.
  tear: { stretch: 0.07, releaseFrac: 0.75, springK: 44, damping: 0.76, glint: 0.8 },
  liner: { enabled: true, metalness: 0.97, roughness: 0.18 },
  riseY: 0.048,
  fan: {
    stepX: 0.026, angle: 0.14, arcDrop: 0.0042, liftY: 0.024,
    heroZ: 0.026, heroScale: 1.16, grailZ: 0.02,
  },
  // Every stage runs a little longer than Vault Break's — this tier is meant to be sat with, not
  // rushed through; `notice`/`present` in particular (the rarity moment itself) get the biggest
  // bump, since the design's own "Grail" reveal word (BlackLabelScene.tsx) needs room to land
  // after the fire's release-burst.
  reveal: {
    stack: 1.1, hold: 0.7, rise: 0.9, separate: 1.75, settle: 0.85,
    notice: 2.7, approach: 1.9, reveal: 1.7, present: 2.3,
  },
  haptics: { tickCount: 18, giveAt: 0.06, completeAt: 0.97 },
  // The base rig from the design's own script — key 0xfff0d6 (vs. Vault Break's warmer
  // 0xfff3dc), an "ember rim" at 0xff7a1e standing in for Vault Break's violet rim, a dim
  // near-black hemisphere (0x2a1610/0x050306) so the fire itself does most of the lighting, and
  // the same 0xfff2d8 spot. BlackLabelScene.tsx adds the crimson fill, gold kick, and the fire's
  // own point lights directly (see that file) — VaultLighting's shape only covers the five
  // fields both tiers share.
  lighting: { key: 0xfff0d6, rim: 0xff7a1e, hemiSky: 0x2a1610, hemiGround: 0x050306, spot: 0xfff2d8 },
};
