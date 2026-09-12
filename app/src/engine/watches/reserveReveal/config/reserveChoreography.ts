// The Heritage Case choreography — ported from the design handoff's own sequence
// (heritage-case-watch-reveal/project/heritage-case.js: POSES at 474-480, the drag resistance at
// 522-539, and the `step()` loop at 585-658).
//
// WHY THIS IS SHAPED DIFFERENTLY FROM THE ARCHIVE'S CHOREOGRAPHY
//
// The Archive is a *scripted* reveal: a 12.6-second timeline that plays itself, where the drag only
// scrubs the opening. The Reserve is not. Its design is a hand-operated case — the lid answers the
// finger continuously, with mechanical resistance that changes partway through the travel, and the
// sequence only takes over once the lid is actually open. That difference is the tier's whole
// character: The Reserve is the entry tier and feels like opening a box you own, where The Archive
// is ceremonial and feels like a vault presenting something to you.
//
// Both nonetheless express themselves through the *same* `RevealChoreography` contract, which is
// the point of that seam. This one simply spends most of its duration in the gesture-scrub region
// (`gestureEndS` is over half the total) where the Archive spends almost none.
//
// TIMELINE, in seconds (total 6.4). The five phases map 1:1 onto the engine's existing LID_STATES
// list — "Closed / Lid opening / Lid fully open / Watch emergence / Inspection" — which
// RevealEngine already renders for every lift-lid category, so this tier needs no new HUD.
//
//   0.00-0.10  Closed           — resting, a slow camera drift the design runs while sealed
//   0.10-2.60  Lid opening      — the lid follows the finger; resisted off the seat, freer after
//   2.60-3.05  Lid fully open   — dead air. Nothing moves. The design's own DWELL beat
//   3.05-4.60  Watch emergence  — cushion and watch rise together, hero tilt, one glint
//   4.60-6.40  Inspection       — settled, the ceremonial dolly finishes, ambient sparkle begins
import type { RevealChoreography } from "../../../core/types";
import {
  CUSHION_R,
  CUSHION_Y,
  LID_MAX_RAD,
  PLATFORM_RISE,
  type ReserveCase,
} from "../engine/buildReserveCase";
import type { ReserveWatch } from "../engine/buildReserveWatch";
import type { ReservePalette } from "../engine/reserveMaterials";

export const RESERVE_TOTAL_S = 6.4;

/**
 * Where the drag stops scrubbing, and how far it must reach to commit.
 *
 * `gestureEndS` covers the whole lid-opening stretch, so the lid genuinely tracks the finger for
 * 2.6 of the 6.4 seconds rather than the Archive's brief scrub-then-play. `gestureCommitS` is the
 * design's own release threshold (`lidTarget > LID_MAX * 0.42`, heritage-case.js:534) expressed in
 * timeline seconds: past ~42% of the lid's travel the case commits and swings open, below it the
 * lid settles back down and the reveal re-seals.
 */
export const RESERVE_GESTURE_END_S = 2.6;
export const RESERVE_GESTURE_COMMIT_S = 0.1 + 0.42 * 2.5;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
/** ease-out cubic — the design's own weighted arrival for the rise, with no bounce anywhere. */
const eoc = (u: number) => 1 - Math.pow(1 - u, 3);
const eio = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export const RESERVE_PHASES = [
  { label: "Closed", fromS: 0, toS: 0.1 },
  { label: "Lid opening", fromS: 0.1, toS: 2.6 },
  { label: "Lid fully open", fromS: 2.6, toS: 3.05 },
  { label: "Watch emergence", fromS: 3.05, toS: 4.6 },
  { label: "Inspection", fromS: 4.6, toS: RESERVE_TOTAL_S },
];

/** Everything `pose`/`lights` need. Assembled by the scene, which owns the lifetimes. */
export interface ReserveScene {
  heritageCase: ReserveCase;
  watch: ReserveWatch;
  palette: ReservePalette;
  /** Live light values the choreography writes and the scene copies onto real lights. */
  lights: {
    /** The warm glow inside the case, which breathes in with the lid. */
    interior: { intensity: number };
    /** The main key spot over the case. */
    key: { intensity: number; targetY: number };
    /** A tighter spot that comes up on the watch once it has risen. */
    watchKey: { intensity: number; targetY: number };
  };
  env: { intensity: number };
  overlay: { vignette: number; momentShown: boolean };
}

/**
 * The lid's resistance curve — the single most characterful thing in this reveal.
 *
 * The design does not map drag distance linearly onto lid angle. It applies one resistance factor
 * while the lid is still near its seat (`lidTarget < 0.14` → 0.0022 per pixel) and a much freer one
 * past that detent (0.0052), so the case feels heavy for the first few degrees and then gives.
 * That is a real hinge with a friction fit, and it is most of why the source's own hint reads
 * "Slow and steady".
 *
 * Reproduced here as a curve over normalised drag rather than an accumulator, because `pose` must
 * stay a pure function of `t` (see the Archive choreography's own note on why). The piecewise
 * mapping below is the integral of those two rates: the first 30% of the drag covers only the
 * first ~12% of the lid's travel, and the remaining 70% covers the rest.
 */
function lidAngleForScrub(u: number): number {
  const DETENT_U = 0.3;
  const DETENT_ANGLE = 0.12;
  if (u <= DETENT_U) return (u / DETENT_U) * DETENT_ANGLE * LID_MAX_RAD;
  const after = (u - DETENT_U) / (1 - DETENT_U);
  return (DETENT_ANGLE + (1 - DETENT_ANGLE) * after) * LID_MAX_RAD;
}

/** Poses every animated node for absolute time `t`. Pure; allocates nothing. */
export function poseReserve(scene: ReserveScene, t: number): void {
  const { heritageCase, watch } = scene;

  // ---- lid -----------------------------------------------------------------
  // Driven by the resistance curve across the gesture region, then held fully open.
  const lidU = seg(t, 0.1, RESERVE_GESTURE_END_S);
  heritageCase.lid.rotation.x = -lidAngleForScrub(lidU);

  // ---- the dwell -----------------------------------------------------------
  // Between 2.60 and 3.05 nothing moves at all. That stillness is deliberate and is a beat the
  // previous tier-1 build also had — it is what makes the rise that follows feel like a decision
  // rather than a continuation.

  // ---- cushion + watch rise ------------------------------------------------
  const rise = eoc(seg(t, 3.05, 4.6));
  // Only the watch rises. The bolster is parented to the body now (see buildReserveCase), so the
  // platform carries the watch alone — the case and its pillow stay put and the piece lifts clear
  // of them, which is both the clearer read and what keeps the bolster from tracking the watch up
  // and staying in front of it.
  heritageCase.platform.position.y = PLATFORM_RISE * rise;

  // The hero move: tilt the dial toward the lens and turn it a few degrees. Applied to
  // `watchPivot`, whose origin is the cushion's true centre, so the bracelet stays wrapped around
  // the bolster as it turns (see buildReserveCase's own note on why that origin matters).
  heritageCase.watchPivot.rotation.x = 0.3 * rise;
  heritageCase.watchPivot.rotation.y = 0.22 * rise;

  // A last small settle once inspection begins — the piece keeps easing a touch rather than
  // freezing the instant the sequence ends.
  const settle = eio(seg(t, 4.6, RESERVE_TOTAL_S));
  watch.group.position.y = 0.0008 * settle;
}

/** Drives lighting and exposure for absolute time `t`. Pure. */
export function lightReserve(scene: ReserveScene, t: number): void {
  const { watch, lights, env, overlay, heritageCase } = scene;

  const openness = clamp01(-heritageCase.lid.rotation.x / LID_MAX_RAD);
  const rise = eoc(seg(t, 3.05, 4.6));
  const inspection = eio(seg(t, 4.6, RESERVE_TOTAL_S));

  // ---- interior glow ------------------------------------------------------
  // Breathes in with the lid, well before the watch moves — the design's "light spills in" beat.
  // A small non-zero floor even while sealed: not physically accurate for a closed box, but a case
  // that is genuinely pitch black at rest reads as broken rather than as sealed, and on a phone
  // screen the difference between 0 and a faint glow is the difference between "a dark object" and
  // "nothing rendered".
  lights.interior.intensity = 0.18 + 1.35 * Math.max(0, openness - 0.1) + 0.5 * rise;

  // ---- key spot -----------------------------------------------------------
  // Rises gently as the case opens, then a touch more as the watch presents itself. Floored well
  // above the design's own value for the same small-screen reason the Archive's was: this is a warm
  // lit room, and the source composed it for a large display in a dark one.
  lights.key.intensity = lerp(1.15, 1.95, openness) + 0.3 * rise;
  lights.key.targetY = CUSHION_Y + PLATFORM_RISE * rise;

  // ---- watch key ----------------------------------------------------------
  // Comes up only once the piece has risen, so the watch is lit as a subject rather than as part
  // of the case's interior.
  lights.watchKey.intensity = 0.25 * openness + 0.95 * rise;
  // Aimed at the watch itself, which sits a bolster-radius above the pivot.
  lights.watchKey.targetY = CUSHION_Y + CUSHION_R + PLATFORM_RISE * rise;

  // ---- exposure -----------------------------------------------------------
  // Held roughly steady rather than collapsed. The Archive dims hard for its rarity moment; the
  // Reserve is the warm entry tier and has no equivalent beat, so the environment stays generous
  // throughout — which is also what keeps the brass inlay and polished steel reading as metal
  // (see ../art/reserveEnv.ts on why environment intensity is what gives a metal its colour).
  env.intensity = lerp(0.95, 1.05, openness);

  // ---- the glint ----------------------------------------------------------
  // One highlight crossing the crystal as the watch rises, then a slower ambient sparkle once
  // inspection begins — so the piece never goes visually static while the user lingers, but the
  // one-shot reveal glint is never cheapened by repeating on a timer during the reveal itself.
  const glintMat = watch.glint.material as { opacity: number };
  // Travel spans roughly the crystal's own width, in world metres — the glint plane is a child of
  // the watch group, so these are local offsets either side of the dial centre.
  const GLINT_X = 0.013;
  if (t < 4.6) {
    const g = seg(t, 3.6, 4.45);
    glintMat.opacity = Math.sin(clamp01(g) * Math.PI) * 0.55;
    watch.glint.position.x = lerp(-GLINT_X, GLINT_X, clamp01(g));
  } else {
    // 4.5s period ambient sparkle, matching the design's IDLE_GLINT_PERIOD_S.
    const phase = ((t - 4.6) % 4.5) / 4.5;
    const sweep = phase < 0.2 ? phase / 0.2 : 0;
    glintMat.opacity = (phase < 0.2 ? Math.sin(sweep * Math.PI) : 0) * 0.4;
    watch.glint.position.x = lerp(-GLINT_X, GLINT_X, sweep);
  }

  // ---- overlay ------------------------------------------------------------
  // A gentler vignette than the Archive's — this is a lit room, not a dark vault, and the same
  // small-screen compounding applies.
  overlay.vignette = lerp(0.3, 0.42, openness);
  // The "Heritage moment": the design shows one word and a brass hairline as the piece settles.
  // RevealEngine already renders exactly this for every lift-lid category, printing the pulled
  // item's real rarity name — so this flag only says *when*, never what.
  overlay.momentShown = inspection > 0.25;
}

/**
 * Scripted camera.
 *
 * Two distinct moves, both from the design: a slow drift while the case is still closed (it orbits
 * gently at 0.06 rad/s so a sealed case is never a static photo), then a ceremonial dolly in as the
 * watch presents itself. The drift is expressed as a function of `t` rather than wall-clock time so
 * it stays pure and scrub-safe — dragging the lid back and forth moves the camera back and forth
 * with it, which is correct: the framing belongs to the timeline position, not to elapsed time.
 */
const CAM_KEYS: { atS: number; position: [number, number, number]; target: [number, number, number] }[] = [
  // Pulled back from the design's own 0.30/0.20/0.40 for the portrait-aspect reason all three
  // tiers needed (a 176mm case has to fit a narrow frame's horizontal FOV).
  //
  // TARGETS ARE THE DESIGN'S, and that correction matters more than the distances. An earlier pass
  // ramped the target up to 0.09 on the theory that a higher aim shows more of the open interior.
  // It does the opposite for this subject: the watch's case centre sits at ~0.057, so aiming at
  // 0.09 points the camera 34mm ABOVE the watch, which tips the view steeply enough that the
  // bolster's near flank — a 21mm-radius cylinder standing directly in front of the case — fills
  // the foreground and occludes the piece. The design holds its target at 0.055, level with the
  // case itself, which is what keeps the bolster reading as something the watch sits on rather
  // than something in front of it.
  { atS: 0, position: [0.3, 0.225, 0.42], target: [0, 0.05, 0] },
  { atS: 2.6, position: [0.27, 0.235, 0.39], target: [0, 0.052, 0] },
  { atS: 3.05, position: [0.25, 0.238, 0.365], target: [0, 0.055, 0] },
  // The emergence and settle keys come in closer and stay level with the risen watch. The design's
  // own inspection framing is `(0.115, wy + 0.055, 0.215)` looking at `(0, wy, 0)` where `wy` is
  // the watch's own height — i.e. slightly above the piece, aimed straight at it. These mirror
  // that relationship at this port's pulled-back distance.
  { atS: 4.6, position: [0.2, 0.152, 0.3], target: [0, 0.062, 0] },
  { atS: RESERVE_TOTAL_S, position: [0.175, 0.142, 0.27], target: [0, 0.064, 0] },
];

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
 * The timing half — everything readable without a scene.
 *
 * Haptics are sparse and soft compared with the Archive's eight-beat track, deliberately: this is a
 * wooden case with a friction hinge, not a machined vault with four lock bolts. A light tick as the
 * lid passes its detent, a medium as it seats fully open, a light as the cushion starts to rise,
 * and a success note as the piece settles.
 */
export const reserveTiming: Omit<RevealChoreography, "pose" | "lights"> = {
  durationS: RESERVE_TOTAL_S,
  phases: RESERVE_PHASES,
  gestureEndS: RESERVE_GESTURE_END_S,
  gestureCommitS: RESERVE_GESTURE_COMMIT_S,
  camera: cameraAt,
  haptics: [
    { atS: 0.85, kind: "light" },
    { atS: RESERVE_GESTURE_END_S, kind: "medium" },
    { atS: 3.05, kind: "light" },
    { atS: 4.6, kind: "success" },
  ],
};
