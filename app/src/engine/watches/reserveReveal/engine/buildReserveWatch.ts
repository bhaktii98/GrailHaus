// The Reserve's watch — ported from the design handoff's own `buildWatch()`
// (heritage-case-watch-reveal/project/watch-builder.js, lines 169-422).
//
// Built at true scale: `caseR` comes from the catalog's own size column, so a 41mm watch really is
// 0.0205m of radius sitting in a 0.176m case. The previous tier-1 build had a single round case at
// an arbitrary size with two box hands, which is the whole of why its watch did not read as a
// watch.
//
// FIVE CONSTRUCTIONS, ONE BUILDER
//
// `spec.archetype` (see ../config/reserveArchetypes.ts) picks the branches:
//   dress        — round case, thin torus bezel, domed crystal, applied indices
//   diver        — round case, 60-tooth rotating bezel with a printed insert, lume plots
//   chronograph  — round case, three subdial registers, pushers flanking the crown
//   rectangular  — extruded rounded-rect case, roman numerals, leather strap, optional godrons
//   integrated   — extruded case with a screwed bezel and a bracelet tapering out of the lugs
//
// Every construction shares the dial/hands/crown/caseback/strap machinery, which is what keeps
// five silhouettes down to one builder rather than five near-duplicate files.
//
// COST
//
// ~150-250 meshes depending on archetype (the diver's 60 bezel teeth and the 46-link bracelet
// dominate). All share the palette's ~17 material instances plus two per-watch baked textures, so
// the shader-program count stays small. The repeated rings are the instancing candidates and are
// marked below; built individually here so this port can be diffed against the source, with
// instancing left as a measured follow-up rather than a speculative rewrite.
import * as THREE from "three";
import {
  GeometryBin,
  extrudeShape,
  frameGeo,
  put,
  roundedRectShape,
} from "./reserveGeometry";
import {
  cloneTinted,
  cloneWithMap,
  reserveMaterialFor,
  type ReservePalette,
} from "./reserveMaterials";
import { bezelInsertTexture, dialTexture } from "../art/reserveTextures";
import type { ReserveWatchSpec } from "../config/reserveArchetypes";

/** Flat-on-the-dial rotation for rings and discs lying in the XZ plane. */
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

export interface ReserveWatch {
  /** The watch, to parent under the case's `watchPivot`. */
  group: THREE.Group;
  /** The additive highlight sweeping the crystal, driven by the choreography. */
  glint: THREE.Mesh;
  /** Mid-case height — the choreography needs it to sit the watch on the cushion. */
  caseHeight: number;
  /** The bracelet group, which the case re-parents so the loop stays concentric with the cushion. */
  bracelet: THREE.Group;
  /**
   * The resolved bracelet loop radius, and the vertical offset the builder has already applied to
   * the bracelet group.
   *
   * Both are exposed because a *case* mounting this watch has to re-seat the band, and cannot do
   * that correctly without knowing what the builder already did. Considered on its own, the watch's
   * band must hang below its case (`braceletOffsetY` = `-loopR - caseHeight*0.08`) — that is right
   * for a detail-screen viewer showing the piece in isolation. Inside a presentation case the band
   * instead has to be concentric with the bolster it wraps, which means cancelling that offset
   * exactly rather than adding another one on top of it.
   *
   * Not exposing these is what produced the "watch visible below the box" bug: the scene applied
   * its own offset without cancelling the builder's, stacking the two and pushing the band roughly
   * 19mm beneath the case's outer floor.
   */
  loopR: number;
  braceletOffsetY: number;
  dispose(): void;
}

export function buildReserveWatch(spec: ReserveWatchSpec, palette: ReservePalette): ReserveWatch {
  const bin = new GeometryBin();
  const disposeMat: THREE.Material[] = [];
  const disposeTex: THREE.Texture[] = [];
  const M = (key: string) => reserveMaterialFor(palette, key);

  // ---- per-watch materials -------------------------------------------------
  // The case metal and dial are the two things that genuinely differ per pulled row, so they are
  // clones rather than shared instances (mutating a shared material would repaint every other
  // mesh naming it). Everything else comes straight from the palette.
  const metal = new THREE.Color(spec.metalHex);
  const brushed = cloneTinted(M("steelBrushed"), metal) as THREE.MeshStandardMaterial;
  brushed.roughness = spec.brushed;
  brushed.metalness = 1;
  disposeMat.push(brushed);

  const polished = cloneTinted(M("steel"), metal) as THREE.MeshStandardMaterial;
  polished.roughness = spec.polish;
  polished.metalness = 1;
  disposeMat.push(polished);

  const dialMap = dialTexture({
    variant: spec.dialVariant,
    colorHex: spec.dialHex,
    lightDial: spec.lightDial,
    subdials: spec.subdials,
    romanIndices: spec.romanIndices,
    dateWindow: spec.dateWindow,
  });
  disposeTex.push(dialMap);
  const dialMat = cloneWithMap(M("dial"), dialMap) as THREE.MeshStandardMaterial;
  // A lacquered dial should bloom a soft highlight; a matte chronograph dial should not.
  dialMat.roughness = spec.dialVariant === "matte" ? 0.78 : 0.66;
  dialMat.metalness = 0;
  disposeMat.push(dialMat);

  const group = new THREE.Group();
  group.name = "Watch";

  const caseGrp = new THREE.Group();
  caseGrp.name = "Case";
  const dialGrp = new THREE.Group();
  dialGrp.name = "Dial";
  const handsGrp = new THREE.Group();
  handsGrp.name = "Hands";
  const crownGrp = new THREE.Group();
  crownGrp.name = "Crown";
  const braceletGrp = new THREE.Group();
  braceletGrp.name = "Bracelet";
  const casebackGrp = new THREE.Group();
  casebackGrp.name = "Caseback";
  const crystalGrp = new THREE.Group();
  crystalGrp.name = "Crystal";
  group.add(caseGrp, dialGrp, handsGrp, crownGrp, braceletGrp, casebackGrp, crystalGrp);

  const R = spec.caseR;
  const rect = spec.archetype === "rectangular";
  const squared = rect || spec.squareCase || spec.archetype === "integrated";
  // Mid-case height: a dress watch is thinner than a tool watch.
  const H = R * (spec.archetype === "dress" ? 0.4 : 0.48);
  const W = rect ? R * 1.62 : R * 2;
  const Dp = rect ? R * 2.16 : R * 2;

  // ---- case middle ---------------------------------------------------------
  if (squared) {
    caseGrp.add(
      new THREE.Mesh(
        bin.add(extrudeShape(roundedRectShape(W, Dp, R * (rect ? 0.16 : 0.3)), H, 0.0007)),
        brushed
      )
    );
    caseGrp.children[caseGrp.children.length - 1].name = "case_mid";
  } else {
    // Slightly tapered, plus a polished flank band — real cases are brushed on top and polished
    // on the side, and that two-finish contrast is most of what makes steel read as steel.
    put(caseGrp, bin.cyl(R, R * 0.955, H, 56), brushed, "case_mid");
    put(caseGrp, bin.cyl(R * 1.005, R * 1.005, H * 0.34, 56), polished, "case_flank");
  }

  const bezelY = H / 2;
  /**
   * Z-FIGHT SEPARATION — the actual cause of the striped, flattened watch.
   *
   * A probe of the dial stack found four pairs of surfaces at *exactly* the same depth (gap
   * 0.000000): the case's top face against the dial plate's underside, the dial's top against the
   * applied markers' underside, the hour hand against the minute hand, and the minute hand against
   * the pinion. Coplanar faces at identical depth is what produces the horizontal banding visible
   * in the render — the GPU has no consistent winner between two surfaces at the same z, so it
   * alternates per pixel row. It reads as a mangled flat sliver rather than a watch, which is why
   * four passes of adjusting the watch's *height* never changed anything: the height was always
   * right, the surfaces were fighting each other.
   *
   * The design gets away with the same nominal numbers because it draws its dial as a disc centred
   * 0.4mm above the case top, so the disc's underside lands flush rather than overlapping — flush
   * is still a tie at this scale. Each layer now gets an explicit lift, small enough to be
   * invisible (10-60 microns) and large enough to break the tie decisively.
   */
  const Z_EPS = 0.00002;
  const dialY = bezelY + 0.0004 + Z_EPS;

  // ---- bezel ---------------------------------------------------------------
  if (spec.archetype === "diver") {
    put(caseGrp, bin.cyl(R, R, H * 0.2, 56, true), polished, "bezel", [0, bezelY + H * 0.1, 0]);

    const insertTex = bezelInsertTexture(spec.accentHex ?? spec.dialHex);
    disposeTex.push(insertTex);
    const insertMat = new THREE.MeshStandardMaterial({
      name: "bezel_insert",
      map: insertTex,
      roughness: 0.28,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });
    disposeMat.push(insertMat);
    put(caseGrp, bin.ring(R * 0.8, R * 0.985, 56), insertMat, "bezel_insert", [0, dialY + H * 0.19, 0], FLAT);

    // INSTANCE CANDIDATE: 60 identical grip teeth.
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      put(
        caseGrp,
        bin.box(R * 0.02, H * 0.2, R * 0.03),
        polished,
        `bezel_grip_${i}`,
        [Math.sin(a) * R * 1.008, bezelY + H * 0.1, Math.cos(a) * R * 1.008],
        [0, a, 0]
      );
    }
  } else if (spec.archetype === "integrated") {
    put(
      caseGrp,
      bin.add(frameGeo(W, Dp, H * 0.28, R * 0.3, R * 1.55, R * 1.55, R * 0.26)),
      polished,
      "bezel",
      [0, bezelY + H * 0.12, 0]
    );
    // Eight exposed screws — the signature of an integrated-bezel sports watch.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      put(
        caseGrp,
        bin.cyl(R * 0.055, R * 0.055, H * 0.32, 14),
        brushed,
        `bezel_screw_${i}`,
        [Math.sin(a) * R * 0.85, bezelY + H * 0.13, Math.cos(a) * R * 0.85]
      );
    }
  } else if (squared) {
    put(
      caseGrp,
      bin.add(frameGeo(W, Dp, H * 0.26, R * (rect ? 0.16 : 0.3), W - R * 0.42, Dp - R * 0.42, R * 0.12)),
      polished,
      "bezel",
      [0, bezelY + H * 0.11, 0]
    );
    if (spec.godrons) {
      // Reverso's fluted ridges across the top of the case.
      for (let i = -1; i <= 1; i++) {
        put(
          caseGrp,
          bin.box(W * 0.86, H * 0.06, Dp * 0.022),
          polished,
          `godron_${i + 1}`,
          [0, bezelY + H * 0.24, i * Dp * 0.055 - Dp * 0.4]
        );
      }
    }
  } else {
    // Dress: a thin polished torus sitting just proud of the dial.
    put(caseGrp, bin.torus(R * 0.935, R * 0.06, 14, 64), polished, "bezel", [0, dialY + H * 0.04, 0], FLAT);
  }

  // ---- dial ----------------------------------------------------------------
  if (squared) {
    // A plane, not an extrusion: ExtrudeGeometry's UVs would scramble the printed dial art. The
    // source makes exactly this note.
    put(dialGrp, bin.plane(W - R * 0.5, Dp - R * 0.5), dialMat, "dial_plate", [0, dialY, 0], FLAT);
  } else {
    const dr = spec.archetype === "diver" ? R * 0.81 : R * 0.9;
    put(dialGrp, bin.cyl(dr, dr, 0.0008, 64), dialMat, "dial_plate", [0, dialY, 0]);
  }

  // Applied hour markers — real geometry standing off the dial, which is what catches a highlight
  // and separates an applied index from a printed one. Skipped for roman numerals, which the dial
  // texture draws instead.
  if (!spec.romanIndices) {
    // INSTANCE CANDIDATE: up to 12 identical markers.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (spec.subdials && (i === 3 || i === 6 || i === 9)) continue;
      if (spec.dateWindow && i === 3) continue;
      const ir = spec.archetype === "diver" ? R * 0.64 : R * 0.7;
      const marker = spec.lume
        ? put(dialGrp, bin.cyl(R * 0.045, R * 0.045, 0.0008, 16), M("lume"), `index_lume_${i}`)
        : put(
            dialGrp,
            bin.box(i % 3 === 0 ? R * 0.06 : R * 0.038, 0.0008, R * 0.15),
            M("index"),
            `index_${i}`
          );
      // +Z_EPS*2: the markers' underside would otherwise be exactly flush with the dial's top
      // face (see Z_EPS). An applied index must sit ON the dial, not in its surface.
      marker.position.set(Math.sin(a) * ir, dialY + 0.0008 + Z_EPS * 2, Math.cos(a) * ir);
      marker.rotation.y = a;
    }
  }

  // ---- hands ---------------------------------------------------------------
  // Each hand's geometry is translated along +Z by roughly a third of its length so it pivots
  // about the dial centre rather than its own middle.
  const handY = dialY + 0.0018;

  const hourGeo = bin.box(R * 0.07, 0.0004, R * 0.52);
  hourGeo.translate(0, 0, R * 0.19);
  const hour = put(handsGrp, hourGeo, M("hand"), "hand_hour", [0, handY, 0]);
  hour.rotation.y = -0.95;

  const minGeo = bin.box(R * 0.055, 0.0004, R * 0.76);
  minGeo.translate(0, 0, R * 0.31);
  // +Z_EPS*2: the hour hand's top face and the minute hand's underside were exactly coincident,
  // so the two hands strobed against each other wherever they crossed.
  const min = put(handsGrp, minGeo, M("hand"), "hand_minute", [0, handY + 0.0004 + Z_EPS * 2, 0]);
  min.rotation.y = 1.86;

  if (spec.subdials) {
    const accent = new THREE.MeshStandardMaterial({
      name: "hand_accent",
      color: new THREE.Color(spec.accentHex ?? "#d8dadb"),
      roughness: 0.3,
      metalness: 0.6,
    });
    disposeMat.push(accent);
    const secGeo = bin.box(R * 0.022, 0.0003, R * 0.88);
    secGeo.translate(0, 0, R * 0.3);
    const sec = put(handsGrp, secGeo, accent, "hand_chrono_seconds", [0, handY + 0.0008, 0]);
    sec.rotation.y = 0.42;
  }

  // +Z_EPS*4: clears both hands, whose tops now sit at handY + 0.0004 + 2*Z_EPS.
  put(handsGrp, bin.cyl(R * 0.05, R * 0.05, 0.0012, 16), polished, "hand_pinion", [
    0,
    handY + 0.0012 + Z_EPS * 4,
    0,
  ]);

  // ---- crystal -------------------------------------------------------------
  const cryY = dialY + H * (spec.archetype === "diver" ? 0.24 : 0.2);
  if (squared) {
    put(
      crystalGrp,
      bin.add(extrudeShape(roundedRectShape(W - R * 0.44, Dp - R * 0.44, R * 0.1), H * 0.12, 0)),
      M("crystal"),
      "crystal",
      [0, cryY, 0]
    );
  } else {
    put(crystalGrp, bin.cyl(R * 0.875, R * 0.875, H * 0.16, 64), M("crystal"), "crystal", [0, cryY, 0]);
    if (spec.archetype !== "diver") {
      // A domed crystal on everything but the diver — the box-dome that gives a dress watch its
      // characteristic edge distortion.
      put(
        crystalGrp,
        bin.dome(R * 0.875, 48, 12, Math.PI * 0.19),
        M("crystal"),
        "crystal_dome",
        [0, cryY + H * 0.08 - R * 0.83, 0]
      );
    }
  }

  // The glint: an additive plane skimming the crystal, swept across it once as the watch rises.
  // Its material is per-watch because the choreography animates its opacity.
  const glintMat = new THREE.MeshBasicMaterial({
    name: "glint",
    color: 0xfff4dd,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  disposeMat.push(glintMat);
  const glint = put(crystalGrp, bin.plane(R * 0.24, R * 1.9), glintMat, "crystal_glint", [
    0,
    cryY + H * 0.14,
    0,
  ]);
  glint.rotation.x = -Math.PI / 2;
  glint.rotation.z = -0.5;
  glint.castShadow = false;

  // ---- crown + pushers ----------------------------------------------------
  const crownX = (squared ? W / 2 : R) + R * 0.07;
  const crown = put(crownGrp, bin.cyl(R * 0.15, R * 0.17, R * 0.2, 20), polished, "crown", [crownX, 0, 0]);
  crown.rotation.z = Math.PI / 2;

  if (spec.archetype === "integrated" || rect) {
    // The blue cabochon on a Cartier-style crown.
    const stone = new THREE.MeshStandardMaterial({
      name: "crown_stone",
      color: 0x1c2a4a,
      roughness: 0.18,
      metalness: 0.2,
    });
    disposeMat.push(stone);
    put(crownGrp, bin.sphere(R * 0.075, 16, 12), stone, "crown_cabochon", [crownX + R * 0.1, 0, 0]);
  }

  if (spec.subdials) {
    [-1, 1].forEach((s, i) => {
      const p = put(
        crownGrp,
        bin.cyl(R * 0.085, R * 0.085, R * 0.17, 16),
        polished,
        `pusher_${i}`,
        [crownX - R * 0.02, 0, s * R * 0.46]
      );
      p.rotation.z = Math.PI / 2;
    });
  }

  // ---- lugs ----------------------------------------------------------------
  const lugSpan = squared ? W * 0.3 : R * 0.58;
  const lugZ = squared ? Dp / 2 - R * 0.04 : R * 0.86;
  [-1, 1].forEach((sz, i) =>
    [-1, 1].forEach((sx, j) => {
      const lug = put(
        caseGrp,
        bin.box(R * 0.12, H * 0.5, R * 0.26),
        brushed,
        `lug_${i}${j}`,
        [sx * lugSpan, -H * 0.12, sz * lugZ]
      );
      lug.rotation.y = sz * sx * (squared ? 0 : 0.16);
    })
  );

  // ---- caseback ------------------------------------------------------------
  if (squared) {
    put(
      casebackGrp,
      bin.add(extrudeShape(roundedRectShape(W - R * 0.16, Dp - R * 0.16, R * 0.14), H * 0.2, 0.0004)),
      brushed,
      "caseback",
      [0, -H / 2 - H * 0.08, 0]
    );
  } else {
    put(casebackGrp, bin.cyl(R * 0.9, R * 0.8, H * 0.24, 48), brushed, "caseback", [0, -H / 2 - H * 0.09, 0]);
    put(
      casebackGrp,
      bin.torus(R * 0.86, R * 0.03, 10, 48),
      polished,
      "caseback_ring",
      [0, -H / 2 - H * 0.04, 0],
      FLAT
    );
  }

  // ---- bracelet / strap ----------------------------------------------------
  // A closed loop wrapping where the cushion sits, gapped at the top where the case is. The loop
  // radius is set by the caller (the scene passes the cushion's radius plus clearance) so the band
  // stands just clear of the bolster rather than intersecting it.
  const LR = spec.loopR ?? R * 1.22;
  braceletGrp.position.y = -LR - H * 0.08;

  if (spec.strap === "leather") {
    // One continuous partial torus, flattened into a strap cross-section. A chain of discrete
    // segments was the previous build's approach and it visibly clumped or thinned depending on
    // the orbit angle; a single swept mesh cannot do that by construction.
    const GAP_A = (62 * Math.PI) / 180;
    const GAP_B = (118 * Math.PI) / 180;
    const tube = R * 0.03;
    const bandGeo = bin.torus(LR, tube, 8, 112, Math.PI * 2 - (GAP_B - GAP_A));
    bandGeo.rotateZ(GAP_B);
    bandGeo.rotateY(-Math.PI / 2);
    const band = put(braceletGrp, bandGeo, M("strapLeather"), "strap");
    // Flatten across the band's width, turning a round tube into a strap.
    band.scale.x = (W * 0.55) / (tube * 2);

    put(braceletGrp, bin.box(W * 0.6, R * 0.05, R * 0.34), M("strapLeather"), "strap_keeper", [
      0,
      -LR * 0.72,
      LR * 0.66,
    ]);
    put(braceletGrp, bin.box(W * 0.64, R * 0.05, R * 0.5), polished, "strap_buckle", [
      0,
      -LR - tube * 0.2,
      0,
    ]);
  } else {
    // A segmented metal bracelet: 46 rows, each a polished centre link flanked by two brushed
    // side links, tapering toward the clasp. The alternating finish is what reads as a real
    // bracelet rather than a ring.
    // INSTANCE CANDIDATE: 46 rows x 3 links.
    const seg = 46;
    const integrated = spec.strap === "integrated";
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const deg = ((a * 180) / Math.PI + 360) % 360;
      if (deg > 62 && deg < 118) continue; // the gap where the case sits
      const taper = 1 - 0.18 * Math.abs(Math.sin(a));
      const row = new THREE.Group();
      row.name = `link_row_${i}`;
      row.position.set(0, Math.sin(a) * LR, Math.cos(a) * LR);
      row.rotation.x = -a;
      braceletGrp.add(row);

      const linkD = ((Math.PI * 2 * LR) / seg) * 0.94;
      put(row, bin.box(R * (integrated ? 0.5 : 0.58) * taper, R * 0.055, linkD), polished, `link_center_${i}`);
      [-1, 1].forEach((s, j) => {
        put(
          row,
          bin.box(R * (integrated ? 0.34 : 0.26) * taper, R * 0.05, linkD),
          brushed,
          `link_side_${i}_${j}`,
          [s * R * (integrated ? 0.4 : 0.42) * taper, 0, 0]
        );
      });
    }
    put(braceletGrp, bin.box(R * 0.98, R * 0.06, R * 0.85), brushed, "clasp", [0, -LR - R * 0.015, 0]);
  }

  // A crystal must never cast a shadow onto its own dial — the classic giveaway of a fake render.
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.Material | undefined;
    if (mat === M("crystal") || mat === glintMat) mesh.castShadow = false;
  });

  return {
    group,
    glint,
    caseHeight: H,
    bracelet: braceletGrp,
    loopR: LR,
    braceletOffsetY: braceletGrp.position.y,
    dispose: () => {
      bin.dispose();
      for (const m of disposeMat) m.dispose();
      for (const t of disposeTex) t.dispose();
    },
  };
}
