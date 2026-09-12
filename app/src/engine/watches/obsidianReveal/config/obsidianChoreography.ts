// The Obsidian Vault choreography — ported from the design's own state machine, sequence table
// and frame loop (the-obsidian-vault/project/apex-vault.html: SEQ at 799-845, CAM at 775-782,
// lights at 556-582, and the frame loop at 943-1035).
//
// THE MOST STRUCTURALLY DIFFERENT OF THE THREE WATCH REVEALS
//
//   The Reserve  — one gesture (lift the lid), 6.4s, hand-operated throughout.
//   The Archive  — one gesture (lift the lid), 12.6s, scrub then play.
//   The Obsidian — TWO gestures in sequence, then a five-stage cinematic. 24.9s total.
//
// The two gestures are the reason `GestureStage` was added to the shared contract rather than
// hand-rolled here: draw the silk ribbon sideways to break the seal, watch it fall, then lift the
// lid upward. They are different axes with different resistance and a deliberate watched pause
// between them, and no single 0..1 progress value can express that.
//
// TIMELINE, in seconds (total 24.9):
//   0.00- 2.80  Draw the ribbon     — GESTURE 1, x-axis. The band feeds through the fastener.
//   2.80- 4.30  The seal is broken  — the band slips off and settles on the floor. Watched.
//   4.30- 4.85  Pause               — nothing. The design's own beat before the lid is offered.
//   4.85- 7.35  Lift the lid        — GESTURE 2, y-axis. Mist begins escaping as it cracks.
//   7.35- 8.95  Reveal pause        — the chamber is opaque. Nothing is visible yet.
//   8.95-11.75  Vault breath        — the room dims, the chamber glows, exposure falls.
//  11.75-16.55  Mist spill          — the cushion rises UNSEEN inside the vapour.
//  16.55-20.55  Mist clear          — the vapour thins and the watch is simply there.
//  20.55-24.90  Final approach      — dolly in, APEX lands, the sweep light travels the case.
//
// The single most important structural point, and the reason the mist exists: at 11.75-16.55 the
// cushion rises *while hidden*. The watch is never seen to arrive — it is discovered. That is the
// whole dramatic difference between this tier and The Archive's platform elevation, and it only
// works if the mist is genuinely opaque (see ../engine/buildObsidianMist.ts).
import type { GestureStage, RevealChoreography } from "../../../core/types";
import {
  CUSHION_RISE,
  CUSHION_Y0,
  LID_MAX_RAD,
  type ObsidianVault,
} from "../engine/buildObsidianVault";
import type { ObsidianRibbon } from "../engine/buildObsidianRibbon";
import type { ObsidianWatch } from "../engine/buildObsidianWatch";
import type { ObsidianMist } from "../engine/buildObsidianMist";
import { OBSIDIAN_EXPOSURE_DARK, OBSIDIAN_EXPOSURE_REST } from "../art/obsidianEnv";

// Retimed from the design's own 24.9s. The held-then-vent structure (see SEQ below) replaces an
// 8.8s gradual spill with a 1.9s release, and the two held stages are shorter than the design's
// equivalents — a chamber that is genuinely opaque does not need as long to establish itself as one
// the viewer can half-see through.
export const OBSIDIAN_TOTAL_S = 18.6;

// ---- stage boundaries ------------------------------------------------------
const RIBBON_END = 2.8;
const FALL_END = 4.3;
const PAUSE_END = 4.85;
const LID_END = 7.35;
const SEQ_START = LID_END;

/**
 * The cinematic stages.
 *
 * RETIMED from the design's own durations to match the beat order actually wanted:
 *
 *   ribbon untied -> lid opened by the user -> chamber so dense that neither the watch nor its
 *   stand is visible at all -> once the lid is FULLY open, the mist escapes QUICKLY out of the
 *   sides and the watch is revealed.
 *
 * The design's own sequence spread the escape across a 4.8s spill plus a 4.0s clear, with the
 * cushion rising during the spill — a slow dissipation. That reads as fog gradually lifting. What
 * is wanted instead is a held, genuinely opaque chamber followed by a fast release, which is a
 * different dramatic shape: pressure, then vent.
 *
 * So `revealPause` and `vaultBreath` now hold the chamber at FULL opacity (fog is pinned below the
 * point where the mist starts thinning — see `lightObsidian`), the cushion completes its entire
 * rise inside that held window while nothing is visible, and the escape is compressed into a
 * single short `mistEscape` stage. Total duration drops from 24.9s to 18.6s, which also makes the
 * reveal less of an endurance test on a phone.
 */
const SEQ = {
  /** The lid is open; the chamber is a solid wall of vapour. Nothing is visible. */
  revealPause: { from: 7.35, to: 9.15 },
  /** The vault breathes — light builds inside the still-opaque chamber, the room dims. The
   *  cushion and watch rise during this, entirely hidden. */
  vaultBreath: { from: 9.15, to: 13.05 },
  /** The fast vent: vapour pours out of both sides and the watch is discovered. Short on purpose
   *  — this is the beat that should feel like a release, not a dissipation. */
  mistEscape: { from: 13.05, to: 14.95 },
  /** Dolly in, APEX lands, the sweep light travels the case. */
  finalApproach: { from: 14.95, to: OBSIDIAN_TOTAL_S },
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function smooth(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/**
 * The two opening gestures plus the watched pause between them.
 *
 * The ribbon's `travelDistance` is derived from the design's own `unit * .52` where `unit` is the
 * smaller viewport dimension — roughly 200px on a phone, so a deliberate sideways sweep. The lid's
 * is `unit * .60`, slightly longer, and the design additionally softens the first 12% of the lid's
 * travel (`S.lidTarget < .12 ? .72 : 1`) which the choreography's own pose curve reproduces.
 */
export const OBSIDIAN_GESTURE_STAGES: GestureStage[] = [
  {
    id: "ribbon",
    axis: "x",
    fromS: 0,
    toS: RIBBON_END,
    // The design has no partial-commit for the ribbon: reaching 1 releases it (`if(S.ribbon>=1)
    // releaseRibbon()`), and anything less simply holds. Commit is therefore the full span, which
    // makes the seal feel like something that must genuinely be drawn all the way open.
    commitS: RIBBON_END,
    travelDistance: 200,
    velocityThreshold: 900,
    prompt: "Draw the ribbon to break the seal",
  },
  {
    id: "fall",
    axis: "y",
    fromS: RIBBON_END,
    toS: PAUSE_END,
    commitS: RIBBON_END,
    travelDistance: 1,
    velocityThreshold: 0,
    // No gesture: the band's fall and the beat after it are watched, not driven. 2.05s covers the
    // design's own 1.5s fall plus its 0.55s pause.
    autoAdvanceAfterS: PAUSE_END - RIBBON_END,
  },
  {
    id: "lid",
    axis: "y",
    fromS: PAUSE_END,
    toS: LID_END,
    // The design commits the lid at 14% of its travel on release (`if(S.lidTarget<.14)
    // S.lidTarget=0`), i.e. a light pull springs back but a committed one carries.
    commitS: PAUSE_END + (LID_END - PAUSE_END) * 0.14,
    travelDistance: 230,
    velocityThreshold: 520,
    prompt: "Lift the lid",
  },
];

/** Everything `pose`/`lights` need. */
export interface ObsidianScene {
  vault: ObsidianVault;
  ribbon: ObsidianRibbon;
  watch: ObsidianWatch;
  mist: ObsidianMist;
  /** Live light values the choreography writes and the scene copies onto real lights. */
  lights: {
    key: { intensity: number; driftX: number; driftZ: number };
    rim: { intensity: number };
    chamber: { intensity: number };
    chamber2: { intensity: number };
    /** The single spot that discovers the watch. */
    reveal: { intensity: number; angle: number; targetY: number };
    /** Travels across the case during the final approach. */
    sweep: { intensity: number };
    /** The warm accent behind the APEX moment. */
    apex: { intensity: number };
  };
  env: { intensity: number; exposure: number };
  overlay: {
    /** 0..1, drives the 2D vignette. */
    vignette: number;
    /** The APEX word and its rule. */
    apexShown: boolean;
    /** The reference name/description block. */
    metaShown: boolean;
  };
  /** Seconds since mount, for the idle drift and the running seconds hand. */
  clock: { time: number };
}

/** Poses every animated node for absolute time `t`. Pure; allocates nothing beyond the ribbon's
 * own per-frame geometry (see ObsidianRibbon.setState on why that is unavoidable). */
export function poseObsidian(scene: ObsidianScene, t: number): void {
  const { vault, ribbon, watch } = scene;

  // ---- ribbon: draw, then fall --------------------------------------------
  const draw = seg(t, 0, RIBBON_END);
  // The design blends easeIn and easeOut across the fall rather than using either alone, which
  // gives the band a slight hesitation as it slips and then a quicker settle.
  const fallU = seg(t, RIBBON_END, FALL_END);
  const fall = easeIn(fallU) * 0.35 + easeOut(fallU) * 0.65;
  ribbon.setState(draw, fall, draw);

  // ---- lid ----------------------------------------------------------------
  // `pow(p, 1.08)` — very slightly eased, so the lid's first few degrees are marginally slower
  // than linear. Reads as weight without feeling damped.
  const lidP = seg(t, PAUSE_END, LID_END);
  vault.hinge.rotation.x = -Math.pow(lidP, 1.08) * LID_MAX_RAD;

  // ---- cushion rise -------------------------------------------------------
  // Entirely inside the VaultBreath stage, and entirely hidden while it happens — the chamber is
  // at full opacity throughout, so the stand and the watch travel up unseen. This is the beat that
  // makes the watch *discovered* rather than watched-arriving, and it only works because the mist
  // is genuinely opaque here rather than merely thick (see the density window in
  // ../engine/buildObsidianMist.ts).
  //
  // It completes before the vent begins, so by the time vapour clears there is nothing left moving
  // — the watch is simply there, already presented.
  const rise = easeInOut(smooth(0.08, 0.9, seg(t, SEQ.vaultBreath.from, SEQ.vaultBreath.to)));
  vault.cushion.position.y = CUSHION_Y0 + rise * CUSHION_RISE;

  // ---- watch presentation tilt -------------------------------------------
  const tilt = easeInOut(smooth(0.05, 0.65, seg(t, SEQ.finalApproach.from, SEQ.finalApproach.to)));
  watch.group.rotation.x = -tilt * 0.14;
  watch.group.rotation.z = tilt * 0.03;
}

/** Drives lighting, exposure, mist and overlay state for absolute time `t`. Pure. */
export function lightObsidian(scene: ObsidianScene, t: number): void {
  const { lights, env, overlay, mist, vault } = scene;

  const lidP = seg(t, PAUSE_END, LID_END);
  const time = scene.clock.time;

  // ---- fog progress -------------------------------------------------------
  // Fog is monotonic, assembled as a max of per-stage contributions so scrubbing the lid back and
  // forth can never make the chamber re-thicken.
  //
  // The mist's density curve is the design's own: `dense = 1 - smooth(0.44, 0.95, fog)` (see
  // ../engine/buildObsidianMist.ts). So fog at or below 0.44 is FULLY opaque, 0.44-0.95 thins, and
  // 0.95+ is empty. Every value below is chosen against those thresholds.
  //
  // An earlier pass had these capped at 0.55/0.63/0.70 — tuned against a different density window
  // that has since been reverted to the design's. Against the real curve, 0.55 gives dense ≈ 0.75:
  // translucent, and the show-through the dense chamber exists to prevent. They are now held under
  // 0.44 for the whole hold.
  //
  // The lid lift tops out at 0.40 rather than 0 because the particle system hides itself entirely
  // below fog 0.002, and the spill bank's own launch windows (`t0` up to 0.40 in the design's
  // table) must not have opened yet — so vapour is present, churning and completely opaque, with
  // none of it yet escaping.
  let fog = smooth(0.05, 1, lidP) * 0.4;
  if (t >= SEQ.revealPause.from) {
    const u = seg(t, SEQ.revealPause.from, SEQ.revealPause.to);
    fog = Math.max(fog, 0.4 + u * 0.02);
  }
  if (t >= SEQ.vaultBreath.from) {
    // Still under 0.44 at the end of the breath: the cushion completes its entire rise inside a
    // chamber that has never once been less than fully opaque.
    const u = seg(t, SEQ.vaultBreath.from, SEQ.vaultBreath.to);
    fog = Math.max(fog, 0.42 + u * 0.02);
  }
  if (t >= SEQ.mistEscape.from) {
    // The vent: 0.44 -> 1.0 in 1.9s, which carries the chamber through the design's whole
    // translucent band and out the far side to empty. Eased so it starts with a surge.
    const u = easeOut(seg(t, SEQ.mistEscape.from, SEQ.mistEscape.to));
    fog = Math.max(fog, 0.44 + u * 0.56);
  }
  if (t >= SEQ.finalApproach.from) fog = 1;

  // The ceiling vapour may rise to, tracking the lid so nothing appears to pass through it.
  //
  // Raised from `0.076 + 0.076` (= 0.152 at full open), which landed exactly on the risen watch's
  // upper edge: the shader clamps the core particle banks to this value, so the topmost vapour was
  // pinned precisely level with the dial and left no margin above it. The dial was therefore the
  // one part of the piece the visible vapour never covered — which is what made it read as showing
  // through even once the fog body was opaque.
  // How high vapour may rise, tracking the lid so none appears to pass through it.
  //
  // The base term clears the risen watch's upper edge (~0.152) on its own, so the ceiling is above
  // the dial at every lid position rather than only once the lid is fully open — the core banks are
  // clamped to this value, and a ceiling level with the dial leaves the one part of the piece the
  // vapour never covers.
  //
  // Higher than the design's own `0.076 + 0.076` because this port's watch sits higher: the design
  // lifts its cushion 0.042 from a platform at 0.022, and this build's transform chain
  // (platform -> cushion -> anchor -> case) puts the case centre near 0.132 at the top of the rise
  // where the design's sits nearer 0.09.
  const ceil = 0.158 + Math.min(1, lidP * 1.3) * 0.03;
  mist.update(fog, time, ceil, lidP);

  // ---- key + rim ----------------------------------------------------------
  // A breathing drift while the vault is still sealed, so black lacquer never reads flat. The
  // design applies this only before the sequence starts.
  if (t < SEQ_START) {
    lights.key.driftX = Math.sin(time * 0.22) * 0.05;
    lights.key.driftZ = Math.cos(time * 0.19) * 0.04;
  } else {
    lights.key.driftX = 0;
    lights.key.driftZ = 0;
  }

  // The key dims progressively through the sequence — the room goes quiet so the chamber can speak.
  // Raised across the board from the design's own 9 / 7.4 / 6.4 / 6.0 for the same small-screen
  // reason the other two tiers were: composed for a large display in a dark room.
  let key = lerp(10.5, 11.5, smooth(0, 1, lidP));
  if (t >= SEQ.vaultBreath.from) key = lerp(11.5, 9.2, seg(t, SEQ.vaultBreath.from, SEQ.vaultBreath.to));
  if (t >= SEQ.mistEscape.from) key = lerp(9.2, 8.2, seg(t, SEQ.mistEscape.from, SEQ.mistEscape.to));
  if (t >= SEQ.finalApproach.from) key = lerp(8.2, 7.9, seg(t, SEQ.finalApproach.from, SEQ.finalApproach.to));
  lights.key.intensity = key;
  lights.rim.intensity = 3.2;

  // ---- chamber lights -----------------------------------------------------
  // These are the lights that escape as the lid lifts, and the reason the opening chamber reads as
  // lit from within rather than as a dark hole.
  let chamber = smooth(0.18, 0.62, lidP) * 0.12;
  let chamber2 = smooth(0.34, 0.85, lidP) * 0.07;
  if (t >= SEQ.revealPause.from) {
    chamber = Math.max(chamber, 0.11 + 0.04 * easeInOut(seg(t, SEQ.revealPause.from, SEQ.revealPause.to)));
  }
  if (t >= SEQ.vaultBreath.from) {
    const u = seg(t, SEQ.vaultBreath.from, SEQ.vaultBreath.to);
    chamber = lerp(0.15, 0.23, u);
    chamber2 = lerp(0.07, 0.11, u);
  }
  if (t >= SEQ.mistEscape.from) {
    // The chamber lights fall away as the vapour they were illuminating leaves — otherwise the
    // empty interior reads as over-lit once the mist that was diffusing it is gone.
    chamber = lerp(0.23, 0.16, seg(t, SEQ.mistEscape.from, SEQ.mistEscape.to));
  }
  lights.chamber.intensity = chamber;
  lights.chamber2.intensity = chamber2;

  // ---- the reveal spot ----------------------------------------------------
  // Deliberately zero until the mist begins to clear. The design's own comment: "the mist thins to
  // nothing and the watch is simply there, taking the light". Lighting it earlier would show a
  // silhouette through the vapour and spoil the discovery.
  const cushionY = vault.cushion.position.y;
  lights.reveal.angle = 0.3;
  lights.reveal.targetY = 0.122 + (cushionY - CUSHION_Y0);
  let revealI = 0;
  if (t >= SEQ.mistEscape.from) {
    // Held at zero for the first 55% of the vent, then brought up fast. The ordering matters: if
    // this light rises while the chamber is still full, it backlights the vapour and a silhouette
    // reads through — which is exactly the "you can see the watch too early" failure the dense
    // chamber exists to prevent. It comes up as the last of the mist leaves, so the watch is lit
    // at the moment it becomes visible and not a frame before.
    revealI = lerp(0, 0.42, smooth(0.55, 1, seg(t, SEQ.mistEscape.from, SEQ.mistEscape.to)));
  }
  if (t >= SEQ.finalApproach.from) {
    const u = seg(t, SEQ.finalApproach.from, SEQ.finalApproach.to);
    revealI = lerp(0.42, 0.62, easeInOut(clamp01(u / 0.5)));
  }
  lights.reveal.intensity = revealI;

  // ---- sweep + apex accent ------------------------------------------------
  const finalU = t >= SEQ.finalApproach.from ? seg(t, SEQ.finalApproach.from, SEQ.finalApproach.to) : 0;
  lights.sweep.intensity = finalU > 0 ? lerp(0, 0.68, easeInOut(finalU)) : 0;
  lights.apex.intensity = finalU > 0 ? lerp(0, 0.46, smooth(0, 0.5, finalU)) : 0;

  // ---- exposure + environment --------------------------------------------
  // The `dark` term: the whole frame is pulled down through the breath and spill, then opens back
  // up as the watch is discovered. This is the design's single most cinematic device — it makes
  // the reveal feel like a light coming up rather than an object appearing.
  let dark = 0;
  // Darkest at the moment the vent begins — the room is at its quietest just before the release,
  // then opens back up as the watch is discovered.
  if (t >= SEQ.vaultBreath.from) dark = seg(t, SEQ.vaultBreath.from, SEQ.vaultBreath.to) * 0.34;
  if (t >= SEQ.mistEscape.from) dark = lerp(0.34, 0.24, seg(t, SEQ.mistEscape.from, SEQ.mistEscape.to));
  if (t >= SEQ.finalApproach.from) dark = lerp(0.24, 0.18, finalU);
  env.exposure = lerp(OBSIDIAN_EXPOSURE_REST, OBSIDIAN_EXPOSURE_DARK, dark);

  let envI = 0.72;
  if (t >= SEQ.vaultBreath.from) envI = lerp(0.72, 0.6, seg(t, SEQ.vaultBreath.from, SEQ.vaultBreath.to));
  if (t >= SEQ.finalApproach.from) envI = lerp(0.6, 0.78, finalU);
  env.intensity = envI;

  // ---- overlay ------------------------------------------------------------
  overlay.vignette = lerp(0.34, 0.52, dark / 0.34);
  // APEX appears partway into the final approach and fades before it ends, so the word is a beat
  // rather than a label parked on screen.
  overlay.apexShown = finalU > 0.04 && finalU < 0.9;
  overlay.metaShown = t >= SEQ.finalApproach.to - 0.6;
}

/** The camera rig — the design's own six keys, remapped onto absolute time. */
const CAM_KEYS: { atS: number; position: [number, number, number]; target: [number, number, number] }[] = [
  // Pulled back and slightly raised from the design's own values, for the same portrait-aspect
  // reason both other tiers were: a 340mm case is the widest object in the product and has to fit
  // a narrow frame's horizontal field of view. This is the largest adjustment of the three.
  { atS: 0, position: [0.6, 0.45, 0.72], target: [0, 0.055, 0] },
  // In toward the ribbon for the first gesture — the design frames the pull closely so the silk
  // is the subject.
  { atS: RIBBON_END, position: [0.33, 0.29, 0.62], target: [0, 0.046, 0.1] },
  { atS: PAUSE_END, position: [0.33, 0.3, 0.6], target: [0, 0.05, 0.06] },
  // Up and over as the lid opens, looking into the chamber.
  { atS: LID_END, position: [0.28, 0.42, 0.56], target: [0, 0.075, -0.01] },
  // Wide for the breath, so the room's darkening and the full chamber are both visible.
  { atS: SEQ.vaultBreath.to, position: [0.5, 0.46, 0.76], target: [0, 0.058, 0] },
  // Held wide through the vent — the camera does NOT push in while the vapour escapes. The spill
  // throws outward past both sides of the case, and a simultaneous dolly would crop it just as it
  // happens. Moving in afterwards also makes the approach read as a response to the reveal rather
  // than as something that was already underway.
  { atS: SEQ.mistEscape.to, position: [0.44, 0.42, 0.68], target: [0, 0.07, 0] },
  // The final approach: close on the watch.
  { atS: OBSIDIAN_TOTAL_S, position: [0.115, 0.3, 0.2], target: [0, 0.128, 0] },
];

function cameraAt(t: number) {
  let i = 0;
  while (i < CAM_KEYS.length - 2 && t > CAM_KEYS[i + 1].atS) i++;
  const a = CAM_KEYS[i];
  const b = CAM_KEYS[i + 1];
  const u = easeInOut(clamp01((t - a.atS) / (b.atS - a.atS)));
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

export const OBSIDIAN_PHASES = [
  { label: "01 · Sealed", fromS: 0, toS: RIBBON_END },
  { label: "02 · Seal Broken", fromS: RIBBON_END, toS: PAUSE_END },
  { label: "03 · Lid Rising", fromS: PAUSE_END, toS: LID_END },
  { label: "04 · Chamber Sealed", fromS: SEQ.revealPause.from, toS: SEQ.revealPause.to },
  { label: "05 · Vault Breath", fromS: SEQ.vaultBreath.from, toS: SEQ.vaultBreath.to },
  { label: "06 · Vapour Released", fromS: SEQ.mistEscape.from, toS: SEQ.mistEscape.to },
  { label: "07 · Apex", fromS: SEQ.finalApproach.from, toS: OBSIDIAN_TOTAL_S },
];

/**
 * The timing half.
 *
 * Haptics are the richest of the three tiers, which is right for the most ceremonial one — but
 * still restrained: a triple pulse as the seal gives (the design's own `haptic([14,40,22])`), a
 * light tick as the lid seats, then nothing at all through the cinematic until the APEX moment
 * lands. Buzzing through a four-stage light show would cheapen it.
 */
export const obsidianTiming: Omit<RevealChoreography, "pose" | "lights"> = {
  durationS: OBSIDIAN_TOTAL_S,
  phases: OBSIDIAN_PHASES,
  gestureEndS: RIBBON_END,
  gestureCommitS: RIBBON_END,
  gestureStages: OBSIDIAN_GESTURE_STAGES,
  camera: cameraAt,
  haptics: [
    // The seal giving way — three pulses, the design's own pattern.
    { atS: RIBBON_END, kind: "heavy" },
    { atS: RIBBON_END + 0.06, kind: "light" },
    { atS: RIBBON_END + 0.14, kind: "medium" },
    // The lid reaching full open.
    { atS: LID_END, kind: "medium" },
    // Silence through the cinematic, then the rarity moment.
    { atS: SEQ.finalApproach.from, kind: "light" },
    { atS: SEQ.finalApproach.from + 1.2, kind: "success" },
  ],
};
