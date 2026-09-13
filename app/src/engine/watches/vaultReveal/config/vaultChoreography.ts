// The Collector's Vault choreography — ported from the design handoff's own sequence
// (the-collector-s-vault/project/vault.js: the easing helpers and PHASES at lines 548-563, `pose`
// at 567-589, `lights` at 618-650, and the camera keyframes at 654-671).
//
// WHY THIS IS A PURE FUNCTION OF `t`
//
// The design's own comment on `pose` calls it "the single source of truth for both the live
// sequence and the exported animation clips," and that property is what this port depends on. The
// reveal has two drivers: a drag that scrubs the timeline 1:1 with the finger, and a clock that
// plays it forward after release. If posing were stateful — accumulating deltas, easing toward a
// target — those two drivers would disagree, and scrubbing backwards would not retrace the path it
// drew going forward. Every value below is therefore computed from `t` alone, with no memory of
// the previous frame.
//
// `lights` is separate for exactly that reason too: a scrub moves geometry only, so dragging the
// lid halfway does not prematurely fire the interior illumination. The engine calls `pose` while
// scrubbing and both together while playing.
//
// TIMELINE, in seconds (total 12.6):
//   0.00-0.16  Vault Closed        — resting, seam light waking
//   0.16-1.35  Lock Disengage      — four bolts twist a quarter turn, then draw outward
//   1.35-4.10  Lid Opening         — lid lifts and slides clear, then tilts open ~71°
//   4.10-5.70  Interior Activation — buttress strips come up, key spot rises, rim light in
//   5.70-8.10  Platform Elevation  — platform rises 78mm, telescoping column revealed
//   8.10-10.30 Watch Presentation  — watch floats free of the post, tilts toward the lens
//   10.30-12.6 Rarity Confirmed    — settle, environment dims, glint sweeps, vignette closes
import type { RevealChoreography } from "../../../core/types";
import {
  BOLT_DRAW,
  BOLT_X_CLOSED,
  LID_CLOSED_Y,
  LID_CLOSED_Z,
  LID_RISE,
  LID_SLIDE,
  LID_TILT,
  PLATFORM_LIFT,
  PLATFORM_Y0,
  type VaultObject,
} from "../engine/buildVaultObject";
import type { ArchiveWatch } from "../engine/buildArchiveWatch";
import type { VaultPalette } from "../engine/vaultMaterials";

export const VAULT_TOTAL_S = 12.6;

/** Where the drag stops scrubbing and the clock takes over (end of "Lid Opening"), and how far in
 * the drag must reach before release commits rather than springing back. Both from the source's
 * own pointer handling (vault.js:760 and 766). */
export const VAULT_GESTURE_END_S = 4.1;
export const VAULT_GESTURE_COMMIT_S = 2.35;

// ---- easing (source lines 548-552) -----------------------------------------
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Normalises absolute time into 0..1 across one segment — the workhorse of this whole file. */
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
/** ease-in-out cubic. */
const eio = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
/** ease-out quartic — a weighted arrival with no overshoot, for the lid's initial lift. */
const eos = (u: number) => 1 - Math.pow(1 - u, 4);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export const VAULT_PHASES = [
  { label: "01 · Vault Closed", fromS: 0, toS: 0.16 },
  { label: "02 · Lock Disengage", fromS: 0.16, toS: 1.35 },
  { label: "03 · Lid Opening", fromS: 1.35, toS: 4.1 },
  { label: "04 · Interior Activation", fromS: 4.1, toS: 5.7 },
  { label: "05 · Platform Elevation", fromS: 5.7, toS: 8.1 },
  { label: "06 · Watch Presentation", fromS: 8.1, toS: 10.3 },
  // Deliberately rarity-neutral, unlike the design source's own hardcoded "Icon Rarity Moment".
  // That prototype is a fixed Icon showcase; a real pull from The Archive can land on Heritage,
  // Icon or Apex (PRD §16: 55% / 35% / 10%), and this label is user-visible — it reaches the HUD
  // through the driver's onPhaseChange. Naming one rarity here would have displayed the wrong word
  // for two thirds of pulls. The actual rarity is announced by RevealEngine's own moment overlay,
  // which prints the pulled tier's real name from the admin-configured rarity_tiers data.
  { label: "07 · Rarity Confirmed", fromS: 10.3, toS: VAULT_TOTAL_S },
];

/** Everything `pose`/`lights` need. Assembled by the scene component, which owns the lifetimes. */
export interface VaultScene {
  vault: VaultObject;
  watch: ArchiveWatch;
  palette: VaultPalette;
  /** Live light handles the choreography drives. Created by the scene rather than the builder
   * because they are scene-level (they sit beside the vault, not inside it). */
  lights: {
    keySpot: { intensity: number; angle: number; penumbra: number; position: [number, number, number]; targetY: number; targetZ: number };
    rim: { intensity: number; targetY: number };
    presentation: { intensity: number; position: [number, number, number]; targetY: number; targetZ: number };
  };
  /** Scene-level exposure, applied by the component to `scene.environmentIntensity`. */
  env: { intensity: number };
  /** 0..1 vignette strength, surfaced to the 2D overlay. */
  overlay: { vignette: number; sweepFired: boolean; rarityShown: boolean };
}

/**
 * The watch's resting height on the platform. Source line 545 — the bracelet's lowest link sits on
 * the platform pad, which is 56.3mm above the platform's own origin. A function rather than a
 * constant because it tracks the platform as it rises.
 */
function watchRestY(platformY: number): number {
  return platformY + 0.0563;
}

/** Poses every animated node for absolute time `t`. Pure; allocates nothing. */
export function poseVault(scene: VaultScene, t: number): void {
  const { vault, watch } = scene;

  // ---- locks: twist, then draw (source 568-575) -----------------------------
  // The two motions deliberately overlap — the twist starts at 0.16 and the draw at 0.55, so a
  // bolt is already turning before it begins to retract. That overlap is what makes it read as a
  // mechanism rather than two sequenced animations.
  const twist = eio(seg(t, 0.16, 0.9)) * (Math.PI / 2);
  const draw = eio(seg(t, 0.55, 1.35));
  for (let i = 0; i < vault.boltGroups.length; i++) {
    const g = vault.boltGroups[i];
    // Recover which side this bolt is on from its own rotation, exactly as the source does — the
    // group's X sign is about to be overwritten, so it cannot be read from position.
    const sx = g.rotation.z < 0 ? 1 : -1;
    g.position.x = sx * (BOLT_X_CLOSED - BOLT_DRAW * draw);
    vault.boltPins[i].rotation.y = twist;
  }

  // ---- lid: lift and slide clear, then tilt (source 576-580) ----------------
  const lift = eos(seg(t, 1.35, 2.2));
  const tilt = eio(seg(t, 1.95, 4.1));
  vault.lid.position.y = LID_CLOSED_Y + LID_RISE * lift;
  vault.lid.position.z = LID_CLOSED_Z - LID_SLIDE * lift;
  vault.lid.rotation.x = -LID_TILT * tilt;

  // ---- platform (source 582-583) -------------------------------------------
  const rise = eio(seg(t, 5.7, 8.1));
  const platformY = PLATFORM_Y0 + PLATFORM_LIFT * rise;
  vault.platform.position.y = platformY;

  // ---- watch: float free, then settle into presentation (source 585-588) ----
  const float = eio(seg(t, 8.15, 10.2));
  const settle = eio(seg(t, 10.3, VAULT_TOTAL_S));
  watch.group.position.set(0, watchRestY(platformY) + 0.048 * float + 0.004 * settle, 0.052 * float);
  // The hero turn keeps rotating a little through the rarity moment, so the piece is still moving
  // as the word lands rather than freezing the instant the sequence "ends".
  watch.group.rotation.set(1.02 * float, 0.4 * float + 0.3 * settle, 0);
}

/** Drives emissive levels, light intensities and exposure for absolute time `t`. Pure. */
export function lightVault(scene: VaultScene, t: number): void {
  const { palette, watch, lights, env, overlay } = scene;

  const on = eio(seg(t, 4.1, 5.7)); // interior activation
  const icon = eio(seg(t, 10.3, VAULT_TOTAL_S)); // the rarity moment

  // ---- emissive surfaces (source 621-623) ----------------------------------
  // Each of the three rises early and then partially retreats, so the vault's own glow hands off
  // to the spot rig rather than competing with it. The seam light in particular fades as the lid
  // opens — once there is a real opening, a glowing seam has nothing left to suggest.
  palette.seam.emissiveIntensity = 0.85 * eio(seg(t, 0.05, 0.8)) * (1 - 0.55 * seg(t, 3.0, 4.4));
  palette.emblem.emissiveIntensity =
    1.4 * eio(seg(t, 0.3, 1.1)) * (1 - 0.7 * seg(t, 2.4, 4.0)) + 0.5 * icon;
  palette.strip.emissiveIntensity = 1.4 * on * (1 - 0.35 * icon);

  // ---- key spot (source 625-630) -------------------------------------------
  // Floor of 0.45 rather than the design's 0: its sequence opens on a vault lit only by its own
  // seam glow, which is striking on a large dark display and nearly invisible on a phone. The
  // spot now starts contributing before "Interior Activation" and still climbs by roughly the
  // same factor, so the beat where the interior wakes up is preserved — it simply starts from a
  // visible baseline instead of from black.
  const ty = watch.group.position.y;
  lights.keySpot.intensity = lerp(0.45, 1.9, on) * lerp(1, 1.45, icon);
  // The cone narrows and hardens for the rarity moment — a tighter, more theatrical pool of light.
  lights.keySpot.angle = lerp(0.46, 0.255, icon);
  lights.keySpot.penumbra = lerp(0.78, 0.62, icon);
  lights.keySpot.position = [0.045 + 0.02 * icon, 0.62, 0.16 - 0.03 * icon];
  lights.keySpot.targetY = ty;
  lights.keySpot.targetZ = watch.group.position.z * 0.6;

  // ---- rim + presentation lights (source 632-636) --------------------------
  // Same reasoning as the key spot's floor: a small standing contribution so the vault's edges are
  // defined from the first frame, rather than the piece emerging from pure black.
  lights.rim.intensity = lerp(0.25, 0.95, eio(seg(t, 4.6, 6.4))) * lerp(1, 0.7, icon);
  lights.rim.targetY = ty;
  lights.presentation.intensity = lerp(0, 0.85, eio(seg(t, 8.2, 10.4))) * lerp(1, 1.45, icon);
  lights.presentation.position = [0.16, ty + 0.1, 0.3];
  lights.presentation.targetY = ty;
  lights.presentation.targetZ = watch.group.position.z;

  // ---- exposure (source 638-639) -------------------------------------------
  // Ambient reflection is pulled down as the rig comes up, so the piece ends up lit by its own
  // spots rather than floating in even light — the single biggest contributor to the "vault" mood,
  // and the reason this is animated rather than fixed.
  //
  // The floor is raised from the design's 0.24 to 0.55 (and the ceiling from 0.78 to 1.05). That
  // 0.24 is what made the finished reveal read as too dark, and it is worth being precise about
  // why: `environmentIntensity` scales the *only* thing a metalness-1.0 surface has to reflect
  // (see ../art/vaultEnv.ts). Cutting it to a quarter does not merely dim the metals, it removes
  // most of what gives them their colour at all — polished steel, platinum and rose gold all
  // converge toward black. Holding it above half keeps every metal in the palette reading as its
  // own alloy through the rarity moment while still darkening noticeably from the opening.
  env.intensity = lerp(1.05, 0.55, Math.max(on * 0.5, icon));

  // ---- crystal glint (source 641-646) --------------------------------------
  // Two passes across the crystal: one as the watch presents itself, a second, dimmer one through
  // the rarity moment.
  const sw = seg(t, 8.6, 10.6);
  const sw2 = seg(t, 10.6, VAULT_TOTAL_S);
  const p = sw < 1 ? sw : sw2;
  const glintMat = watch.glint.material as { opacity: number };
  glintMat.opacity = (sw < 1 ? 0.2 : 0.15) * Math.sin(clamp01(p) * Math.PI) * (t > 8.4 ? 1 : 0);
  watch.glint.position.x = lerp(-0.019, 0.019, clamp01(p));

  // ---- 2D overlay (source 648, 895-896) ------------------------------------
  // Eased back from the design's 0.55→0.94. A vignette that strong is a second darkening pass on
  // top of the exposure fall, and on a small screen the two compounded into the piece being hard
  // to make out at exactly the moment it is meant to be the centre of attention.
  overlay.vignette = lerp(0.35, 0.7, icon);
  // The light sweep across the screen fires once, just after the rarity moment begins.
  overlay.sweepFired = t > 10.55;
  overlay.rarityShown = t > 11.35;
}

/** Scripted camera keyframes (source 654-660), as [timeS, position, target]. */
// Pulled back and raised from the design's own values, which were framed for a desktop viewport.
//
// The source composes for a landscape canvas roughly 16:9, where a 0.26m vault at 0.30m reads as a
// comfortable three-quarter view. A phone is the opposite aspect — tall and narrow — and a
// perspective camera's *horizontal* field of view is what the vault's 0.26m width has to fit
// inside. At portrait aspect that horizontal FOV is far narrower than the vertical one the fov
// number describes, so the same distance that framed the vault on desktop crops both its ends on a
// phone. Every position below is therefore scaled out along the view direction (~1.5x at the start,
// easing to ~1.35x at the end, since the later keys frame the watch rather than the whole vault and
// need less headroom), and the vertical targets are nudged up so the piece sits slightly below
// centre with room for the HUD rather than filling the frame edge to edge.
//
// Distance rather than fov does the work here for a reason: widening fov to fit a wide object into
// a narrow frame introduces obvious perspective distortion at the edges — a rectangular vault
// starts to look keystoned — where moving the camera back preserves the design's own proportions
// exactly. The fov widening in watchVault.config.ts is a smaller, complementary adjustment.
const CAM_KEYS: { atS: number; position: [number, number, number]; target: [number, number, number] }[] = [
  { atS: 0, position: [0.45, 0.3, 0.54], target: [0, 0.085, 0] },
  { atS: 4.1, position: [0.43, 0.33, 0.5], target: [0, 0.095, 0] },
  { atS: 8.1, position: [0.37, 0.34, 0.46], target: [0, 0.125, 0] },
  { atS: 10.3, position: [0.28, 0.36, 0.38], target: [-0.015, 0.2, 0.026] },
  { atS: VAULT_TOTAL_S, position: [0.215, 0.35, 0.31], target: [-0.03, 0.215, 0.04] },
];

/** Where the camera wants to be at time `t`. The engine owns how fast it gets there — see
 * RevealChoreography.camera's own note on why. */
function cameraAt(t: number) {
  let i = 0;
  while (i < CAM_KEYS.length - 2 && t > CAM_KEYS[i + 1].atS) i++;
  const a = CAM_KEYS[i];
  const b = CAM_KEYS[i + 1];
  const u = eio(clamp01((t - a.atS) / (b.atS - a.atS)));
  return {
    position: [
      lerp(a.position[0], b.position[0], u),
      lerp(a.position[1], b.position[1], u),
      lerp(a.position[2], b.position[2], u),
    ] as [number, number, number],
    target: [
      lerp(a.target[0], b.target[0], u),
      lerp(a.target[1], b.target[1], u),
      lerp(a.target[2], b.target[2], u),
    ] as [number, number, number],
  };
}

/**
 * The timing half of the choreography — everything readable without a scene.
 *
 * Haptic beats are pinned to the motion they accompany rather than to phase boundaries: the four
 * bolts landing, the lid seating open, the platform arriving, and the rarity moment. That pinning
 * is why `RevealChoreography.haptics` is keyed in absolute seconds — a beat that fires when the
 * lid *finishes* opening has to know that instant, which no phase-relative offset can express once
 * the user has scrubbed part of the timeline by hand.
 */
export const vaultTiming: Omit<RevealChoreography, "pose" | "lights"> = {
  durationS: VAULT_TOTAL_S,
  phases: VAULT_PHASES,
  gestureEndS: VAULT_GESTURE_END_S,
  gestureCommitS: VAULT_GESTURE_COMMIT_S,
  camera: cameraAt,
  haptics: [
    // Each bolt's draw completing — four distinct taps, not one buzz.
    { atS: 0.95, kind: "light" },
    { atS: 1.1, kind: "light" },
    { atS: 1.22, kind: "light" },
    { atS: 1.35, kind: "medium" },
    // The lid reaching full tilt.
    { atS: 4.1, kind: "medium" },
    // The platform seating at the top of its travel.
    { atS: 8.1, kind: "heavy" },
    // The piece presenting itself, then the rarity confirmation.
    { atS: 10.3, kind: "medium" },
    { atS: 11.35, kind: "success" },
  ],
};
