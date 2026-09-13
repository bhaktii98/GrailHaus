// The Heritage Case — the Reserve's presentation box. Ported from the design handoff's own case
// construction (heritage-case-watch-reveal/project/heritage-case.js, lines 209-398).
//
// Dimensions are the design's own, in metres at true scale: a 176mm x 132mm case, 56mm body,
// 34mm lid, 10mm walls. That is a real watch box, and modelling it at true size is what lets the
// watch inside (built at its own true size, ~41mm) sit in it at a believable proportion — the
// previous tier-1 build modelled the case in arbitrary units and then scaled the whole thing by
// 0.42 to fit the frame, which is why its watch looked like a toy in a crate.
//
// WHAT THIS FIXES RELATIVE TO THE PREVIOUS TIER-1 BUILD
//
// Every part below that uses `ringBox` is a part the previous build approximated with a solid box:
//   - the body shell      — now a walled ring with a real cavity you can see into
//   - the lid rim         — now a matching walled ring, so the closed case has a visible seam
//   - both brass inlays   — now thin rings framing the openings, not four separate strips
// It also had no grain texture, no velvet lining walls (only a floor), no hinge knuckles, no
// latch, no feet, and an abstract mark in place of the engraved medallion. All present here.
//
// ON THE VELVET LINING BEING FIVE PARTS
//
// Floor plus four walls, each inset a fraction from the walnut it lines. Two reasons, both
// load-bearing: a single box would show walnut where the lining should turn up the wall, and the
// inset avoids z-fighting between two coplanar surfaces — at true scale, two faces nominally in
// the same plane will flicker against each other as the camera moves, which reads as a rendering
// fault rather than a material change.
import * as THREE from "three";
import {
  GeometryBin,
  put,
  ringBox,
  roundedBox,
} from "./reserveGeometry";
import { reserveMaterialFor, type ReservePalette } from "./reserveMaterials";

// ---- dimensions (source lines 211-214) -------------------------------------
export const CASE_W = 0.176;
export const CASE_D = 0.132;
export const BODY_H = 0.056;
export const LID_H = 0.034;
const WALL = 0.01;
const FLOOR = 0.012;
const INNER_W = CASE_W - WALL * 2;
const INNER_D = CASE_D - WALL * 2;

/** The lid's own split: a walled rim that meets the body, plus a solid top panel above it. */
const LID_TOP = 0.014;
const LID_RIM = LID_H - LID_TOP;

/** Interior floor height of the velvet lining. */
const LINING_FLOOR_Y = FLOOR;

/**
 * THE BOLSTER, restored to the design's own figures.
 *
 * This went through four wrong passes before I went back and read `mountWatch` properly
 * (heritage-case.js:306-327). The history is worth keeping because each failure had a different
 * cause and the last one was self-inflicted:
 *
 *   0.0212 (the design's value) — the dial was hidden behind the pillow.
 *   0.0125                      — still occluding.
 *   0.0125, shortened capsule   — still occluding.
 *   bolster deleted, flat pad   — the dial was finally visible, and THE STRAP DISAPPEARED,
 *                                 because a wrapped loop with nothing to wrap sits entirely
 *                                 inside the case's own silhouette.
 *
 * The mistake was fixing occlusion at this layer at all. The design has exactly the same geometry
 * and its dial is not hidden, because it tilts the whole piece toward the lens
 * (`watchPivot.rotation.x = 0.30`, which this port already applies in reserveChoreography). The
 * bolster is meant to be this size — the band has to wrap something — and the tilt is what presents
 * the dial. Shrinking or deleting the bolster was treating the symptom.
 *
 * So these are the design's numbers, unmodified:
 *   CUSHION_R = 0.0212     the bolster the band wraps
 *   CUSHION_Y = floor + 0.019
 * and the scene derives `loopR = CUSHION_R + 0.0038` and the case lift exactly as `mountWatch`
 * does. Nothing here is re-derived any more.
 */
export const CUSHION_R = 0.0212;
export const CUSHION_Y = LINING_FLOOR_Y + 0.019;

/** The whole case rests on its feet, lifted so the feet are not buried in the ground plane. */
export const CASE_REST_Y = 0.004;

/** Lid hinge line — the lid group's origin, at the body's top rear edge. */
export const LID_PIVOT_Y = BODY_H;
export const LID_PIVOT_Z = -CASE_D / 2 + 0.006;

/** Full open angle, ~110°, from the source's own LID_MAX (heritage-case.js:452). */
export const LID_MAX_RAD = 1.92;

/** How far the cushion-and-watch platform rises during the emergence beat (source RISE = 0.055). */
export const PLATFORM_RISE = 0.055;

export interface ReserveCase {
  /** The whole case, to add to the scene. */
  group: THREE.Group;
  /** Hinged at the rear — the choreography rotates this about X. */
  lid: THREE.Group;
  /** The tray pad and watch rise together on this (source: `platform`). */
  platform: THREE.Group;
  /** Where the watch mounts — a child of `platform`, at the pad's top surface. The hero tilt
   * rotates this, so its origin is directly under the watch rather than offset into a bolster. */
  watchPivot: THREE.Group;
  dispose(): void;
}

export function buildReserveCase(palette: ReservePalette): ReserveCase {
  const bin = new GeometryBin();
  const M = (key: string) => reserveMaterialFor(palette, key);

  const group = new THREE.Group();
  group.name = "GrailHaus_HeritageCase";
  group.position.y = CASE_REST_Y;

  // ---- body ----------------------------------------------------------------
  const body = new THREE.Group();
  body.name = "case_body";
  group.add(body);

  // The shell: one extruded walled ring. This is the part that makes the case read as a box with
  // 10mm walnut walls rather than a solid block.
  put(body, bin.add(ringBox(CASE_W, BODY_H, CASE_D, 0.008, INNER_W, INNER_D, 0.005)), M("walnut"), "body_walls");

  put(body, bin.box(CASE_W - 0.007, 0.005, CASE_D - 0.007), M("walnut"), "body_base", [0, 0.0026, 0]);
  put(
    body,
    bin.box(INNER_W + 0.002, 0.004, INNER_D + 0.002),
    M("walnut"),
    "body_inner_floor",
    [0, FLOOR - 0.002, 0]
  );

  // Interior velvet lining — floor plus four walls (see the header on why five parts).
  const lining = new THREE.Group();
  lining.name = "velvet_lining";
  body.add(lining);

  put(lining, bin.box(INNER_W, 0.003, INNER_D), M("velvet"), "lining_floor", [0, LINING_FLOOR_Y + 0.0015, 0]);

  const wallH = BODY_H - FLOOR - 0.001;
  [-1, 1].forEach((sz, i) => {
    put(
      lining,
      bin.box(INNER_W, wallH, 0.003),
      M("velvet"),
      `lining_wall_${i === 0 ? "back" : "front"}`,
      [0, FLOOR + wallH / 2, sz * (INNER_D / 2 - 0.0015)]
    );
  });
  [-1, 1].forEach((sx, i) => {
    put(
      lining,
      bin.box(0.003, wallH, INNER_D),
      M("velvet"),
      `lining_wall_${i === 0 ? "left" : "right"}`,
      [sx * (INNER_W / 2 - 0.0015), FLOOR + wallH / 2, 0]
    );
  });

  // Brass inlay line around the body's top edge — a single thin ring following the opening, not
  // four butted strips. A 1.2mm-thick extrusion, so it catches the environment's horizon band as
  // a continuous golden line around the rim.
  put(
    body,
    bin.add(ringBox(CASE_W - 0.005, 0.0012, CASE_D - 0.005, 0.006, CASE_W - 0.011, CASE_D - 0.011, 0.005, 0.0003)),
    M("brassDark"),
    "brass_inlay",
    [0, BODY_H - 0.0004, 0]
  );

  // Feet — slightly tapered brass cylinders at the four corners.
  ([
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as [number, number][]).forEach(([sx, sz], i) => {
    put(
      body,
      bin.cyl(0.006, 0.007, 0.004, 20),
      M("brassDark"),
      `foot_${i}`,
      [sx * (CASE_W / 2 - 0.02), -0.002, sz * (CASE_D / 2 - 0.02)]
    );
  });

  // ---- tray pad + watch mount ----------------------------------------------
  // `platform` is what rises; the pad and `watchPivot` are its children, so the tray and the watch
  // travel together as one piece — which is what makes the emergence read as the case presenting
  // the watch rather than the watch levitating out of it.
  const platform = new THREE.Group();
  platform.name = "WatchPlatform";
  body.add(platform);

  // THE BOLSTER IS FIXED TO THE BOX, not to the rising platform.
  //
  // The design parents it to `platform` so "cushion and watch rise together" (its own comment).
  // That is a deliberate divergence here: a pillow that travels upward out of the case reads as
  // the whole tray levitating, and it also means the bolster stays permanently in front of the
  // watch at this port's more oblique camera. Fixing it to the body and lifting only the watch
  // gives the beat it should have — the case holds still, the piece rises out of it.
  const cushion = new THREE.Group();
  cushion.name = "watch_cushion";
  body.add(cushion);

  // The bolster: a capsule lying along X, at the design's own radius and length. This is what the
  // bracelet wraps — see CUSHION_R's note on why it is back at full size rather than shrunk.
  const pill = put(cushion, bin.capsule(CUSHION_R, 0.062, 16, 40), M("leather"), "cushion_leather", [
    0,
    CUSHION_Y,
    0,
  ]);
  pill.rotation.z = Math.PI / 2;

  // Stitched seam along the bolster's front upper quarter — the detail that keeps leather from
  // reading as moulded rubber at inspection distance.
  for (let i = 0; i < 26; i++) {
    const t = -0.042 + (i / 25) * 0.084;
    put(cushion, bin.sphere(0.0005, 8, 6), M("thread"), `stitch_${i}`, [
      t,
      CUSHION_Y + 0.0158,
      0.0143,
    ]);
  }

  // The watch's mount, at the bolster's TRUE CENTRE — the design's `watchPivot.position.y =
  // cushionY`, not its top surface.
  //
  // The pivot is what the hero tilt rotates, and a group rotates about its own origin. Putting the
  // origin at the bolster's centre is what keeps the band wrapped around the bolster as the piece
  // turns: the bracelet is placed exactly here (see the scene's mount), so the loop stays
  // concentric with the cylinder it encircles through the whole tilt. An origin at the bolster's
  // surface instead would swing the loop out from under the bolster as it rotated.
  const watchPivot = new THREE.Group();
  watchPivot.name = "WatchPivot";
  watchPivot.position.y = CUSHION_Y;
  platform.add(watchPivot);

  // ---- hinges + latch ------------------------------------------------------
  // Two barrels, each flanked by two knuckles in the brighter brass — the alternating dark/bright
  // pattern is what makes a hinge read as interleaved leaves rather than a single rod.
  [-1, 1].forEach((s, i) => {
    put(
      group,
      bin.cyl(0.0034, 0.0034, 0.02, 24),
      M("brassDark"),
      `hinge_barrel_${i}`,
      [s * 0.048, BODY_H - 0.0012, -CASE_D / 2 - 0.0026],
      [0, 0, Math.PI / 2]
    );
    [-1, 1].forEach((k, j) => {
      put(
        group,
        bin.cyl(0.0042, 0.0042, 0.005, 24),
        M("brass"),
        `hinge_knuckle_${i}${j}`,
        [s * 0.048 + k * 0.0122, BODY_H - 0.0012, -CASE_D / 2 - 0.0026],
        [0, 0, Math.PI / 2]
      );
    });
  });

  put(body, bin.box(0.026, 0.012, 0.0035), M("brass"), "latch_base", [0, BODY_H - 0.008, CASE_D / 2 + 0.0012]);

  // ---- lid -----------------------------------------------------------------
  // Positioned on the hinge line with its parts offset forward by half the depth, so rotating the
  // group swings the lid about its own rear edge.
  const lid = new THREE.Group();
  lid.name = "lid";
  lid.position.set(0, LID_PIVOT_Y, LID_PIVOT_Z);
  group.add(lid);
  const lz = CASE_D / 2 - 0.006;

  put(
    lid,
    bin.add(ringBox(CASE_W, LID_RIM, CASE_D, 0.008, INNER_W, INNER_D, 0.005)),
    M("walnut"),
    "lid_rim",
    [0, 0.0012, lz]
  );
  put(lid, bin.add(roundedBox(CASE_W, LID_TOP, CASE_D, 0.008)), M("walnut"), "lid_top", [
    0,
    0.0012 + LID_RIM - 0.0006,
    lz,
  ]);

  // Cream velvet on the lid's interior — a different tone from the body's burgundy, as the design
  // specifies, so the open case shows two materials rather than one.
  put(lid, bin.box(INNER_W - 0.001, 0.003, INNER_D - 0.001), M("velvetCream"), "lid_lining", [
    0,
    0.0012 + LID_RIM - 0.0022,
    lz,
  ]);
  [-1, 1].forEach((sz, i) => {
    put(
      lid,
      bin.box(INNER_W - 0.001, LID_RIM - 0.004, 0.0025),
      M("velvetCream"),
      `lid_lining_${i === 0 ? "back" : "front"}`,
      [0, 0.0012 + (LID_RIM - 0.004) / 2, lz + sz * (INNER_D / 2 - 0.0013)]
    );
  });

  put(
    lid,
    bin.add(ringBox(CASE_W - 0.005, 0.0012, CASE_D - 0.005, 0.006, CASE_W - 0.011, CASE_D - 0.011, 0.005, 0.0003)),
    M("brassDark"),
    "lid_inlay",
    [0, 0.0006, lz]
  );

  put(lid, bin.box(0.018, 0.011, 0.0035), M("brassDark"), "latch_tongue", [0, 0.0072, CASE_D - 0.0102]);

  // ---- engraved emblem on the lid crown ------------------------------------
  // The brass plate carries the baked "GH / GRAILHAUS" engraving (see ../art/reserveTextures.ts).
  // The previous tier-1 build substituted an abstract diamond-and-bar mark on the grounds that 3D
  // text needs a glyph library — true for geometry, but never true for a baked texture, which is
  // what the design actually uses here.
  const emblem = new THREE.Group();
  emblem.name = "emblem";
  emblem.position.set(0, LID_H + 0.0004, lz);
  lid.add(emblem);

  const plate = put(emblem, bin.cyl(0.019, 0.019, 0.0012, 64), M("emblem"), "emblem_plate");
  // The source rotates the plate so the engraving's UVs face up rather than edge-on.
  plate.rotation.y = Math.PI / 2;

  put(emblem, bin.torus(0.0188, 0.001, 10, 64), M("brassDark"), "emblem_ring", [0, 0.0002, 0], [
    Math.PI / 2,
    0,
    0,
  ]);

  return {
    group,
    lid,
    platform,
    watchPivot,
    dispose: () => bin.dispose(),
  };
}
