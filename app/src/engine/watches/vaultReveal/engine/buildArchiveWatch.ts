// The watch presented by The Archive (watch pack tier 2) — ported from the design handoff's own
// watch builder
// (the-collector-s-vault/project/vault.js, lines 236-540: buildBezel, buildDial, buildHands,
// buildCrown, buildBack, buildStrap and the buildWatch assembly).
//
// Modelled at true scale in metres: a `caseR` of 0.0205 is a 41mm watch. Every offset below is
// the designer's, including the sub-millimetre ones — a dial sitting 0.0005 above the case top and
// its markers 0.0008 above that is what stops z-fighting between stacked flat surfaces at this
// scale, so the precision is functional rather than fussy.
//
// The archetype names (Monolith, Abyss, Aurum, Cathedral, Meridian) are the design's own and are
// unrelated to rarity: any of the five can be built for a Heritage, Icon or Apex pull, since the
// archetype is chosen by the watch's *form* (its catalog `style`) while rarity is chosen by the
// reward engine. See ../config/watchArchetypes.ts's own note on the two meanings of "tier".
//
// FIVE ARCHETYPES, ONE BUILDER
//
// The archetype table (../config/watchArchetypes.ts) selects which branch each sub-builder takes:
// a dive bezel or a fluted one, lume plots or applied indices, a bracelet or a rubber strap. That
// is the design's own structure and it is why five visibly different watches cost one builder
// rather than five. A real pull resolves to one archetype by its catalog `style`, then optionally
// re-tints the case metal and dial from its own columns — see the archetype module for which
// archetypes accept a re-tint and why the signature-metal ones do not.
//
// COST, STATED HONESTLY
//
// Built faithfully this is ~250 meshes per watch, dominated by repeated furniture: 40 bezel
// flutes, 36 dive-bezel grips, 24 tachymètre ticks, 59 minute ticks, 24 strap links each carrying
// 2-3 parts. They all share the palette's material instances, so the shader-program count stays
// tiny, but the draw-call count does not. The repeated rings are the obvious instancing targets
// and are marked `INSTANCE CANDIDATE` below; they are built as individual meshes here so this port
// can be diffed against the source, with instancing applied as a measured follow-up rather than
// a speculative rewrite.
import * as THREE from "three";
import {
  cloneTinted,
  materialFor,
  type VaultPalette,
} from "./vaultMaterials";
import {
  resolveCaseMaterialKey,
  resolveDialOverride,
  type WatchArchetype,
} from "../config/watchArchetypes";

/** Flat-on-the-dial rotation, applied to every RingGeometry and disc that lies in the XZ plane. */
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

export interface ArchiveWatch {
  /** The assembled watch. The choreography positions and rotates this as one unit. */
  group: THREE.Group;
  /** The additive highlight plane that sweeps the crystal. Driven by `lights(t)`. */
  glint: THREE.Mesh;
  /** Half the mid-case height — the dial plane's own Y, needed by the choreography's rest-height
   * calculation. */
  top: number;
  dispose(): void;
}

export interface ArchiveWatchOptions {
  archetype: WatchArchetype;
  palette: VaultPalette;
  /** The pulled row's own case material, e.g. "Oystersteel". Applied only to archetypes whose
   * identity is construction rather than a signature metal. */
  caseMaterial?: string | null;
  /** The pulled row's own dial colour, e.g. "Black / Burgundy Bezel". */
  dialColor?: string | null;
}

export function buildArchiveWatch({
  archetype: spec,
  palette,
  caseMaterial,
  dialColor,
}: ArchiveWatchOptions): ArchiveWatch {
  const disposeGeo: THREE.BufferGeometry[] = [];
  const disposeMat: THREE.Material[] = [];

  const box = (x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(x, y, z);
    disposeGeo.push(g);
    return g;
  };
  const cyl = (r1: number, r2: number, h: number, s = 48, open = false) => {
    const g = new THREE.CylinderGeometry(r1, r2, h, s, 1, open);
    disposeGeo.push(g);
    return g;
  };
  const cylPartial = (r1: number, r2: number, h: number, s: number, start: number, len: number) => {
    const g = new THREE.CylinderGeometry(r1, r2, h, s, 1, false, start, len);
    disposeGeo.push(g);
    return g;
  };
  const cone = (r: number, h: number, s: number) => {
    const g = new THREE.CylinderGeometry(0, r, h, s);
    disposeGeo.push(g);
    return g;
  };
  const torus = (r: number, t: number, rs: number, ts: number, arc?: number) => {
    const g = new THREE.TorusGeometry(r, t, rs, ts, arc);
    disposeGeo.push(g);
    return g;
  };
  const ring = (ri: number, ro: number, s = 72) => {
    const g = new THREE.RingGeometry(ri, ro, s);
    disposeGeo.push(g);
    return g;
  };
  const lathe = (points: THREE.Vector2[], s: number) => {
    const g = new THREE.LatheGeometry(points, s);
    disposeGeo.push(g);
    return g;
  };
  const v2 = (x: number, y: number) => new THREE.Vector2(x, y);

  const group = new THREE.Group();
  // Named for the pack tier that presents it, not for a rarity. The design source calls this node
  // "watch_icon" because its prototype is a fixed Icon showcase and its exported animation clips
  // target that string; this port drives the timeline directly rather than replaying those clips,
  // so nothing depends on the old name and it would only mislead a reader into thinking the node
  // is rarity-specific.
  group.name = "watch_archive";

  const put = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
    pos?: [number, number, number],
    rot?: [number, number, number]
  ) => {
    const m = new THREE.Mesh(geo, material);
    m.name = name;
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(m);
    return m;
  };

  // ---- material resolution ---------------------------------------------------
  // The case metal may come from the pulled row rather than the archetype (see the archetype
  // module). The dial may be re-tinted, which requires a clone — mutating the shared dial material
  // would repaint every other mesh naming it.
  const caseKey = resolveCaseMaterialKey(spec, caseMaterial);
  const cm = materialFor(palette, caseKey);
  const bezelMat = materialFor(palette, spec.bezelMat === spec.caseMat ? caseKey : spec.bezelMat);
  const linkMat = materialFor(palette, spec.linkMat === spec.caseMat ? caseKey : spec.linkMat);
  const ac = materialFor(palette, spec.accentMat);

  const dialTint = resolveDialOverride(spec, dialColor);
  const baseDial = materialFor(palette, spec.dialMat);
  const dm = dialTint ? cloneTinted(baseDial, dialTint) : baseDial;
  if (dialTint) disposeMat.push(dm);

  const steel = materialFor(palette, "steel");
  const titanium = materialFor(palette, "titanium");
  const gunmetal = materialFor(palette, "gunmetal");
  const goldAcc = materialFor(palette, "goldAcc");
  const platinum = materialFor(palette, "platinum");
  const applied = materialFor(palette, "applied");
  const sapphire = materialFor(palette, "sapphire");
  const insert = materialFor(palette, "insert");
  const chapterRing = materialFor(palette, "chapterRing");
  const goldRing = materialFor(palette, "goldRing");
  const dialSlateRing = materialFor(palette, "dialSlateRing");
  const leather = materialFor(palette, "leather");
  const rubber = materialFor(palette, "rubber");

  const R = spec.caseR;
  const top = spec.bandH / 2;

  // ---- case ------------------------------------------------------------------
  put(group, cyl(R, R, spec.bandH, 64, true), cm, "case_band");
  put(group, torus(R - 0.0006, 0.0011, 10, 64), cm, "case_chamfer_top", [0, top, 0], FLAT);
  put(group, torus(R - 0.0006, 0.0011, 10, 64), cm, "case_chamfer_bottom", [0, -top, 0], FLAT);

  // ---- bezel -----------------------------------------------------------------
  if (spec.bezel === "fluted") {
    // A lathed profile rather than a torus: a fluted bezel has a distinct stepped cross-section
    // (inner shoulder, rise, outer lip) that a tube cannot express.
    put(
      group,
      lathe(
        [
          v2(R - 0.0029, top - 0.0003),
          v2(R - 0.0029, top + 0.0031),
          v2(R - 0.0009, top + 0.0033),
          v2(R + 0.0011, top + 0.0015),
          v2(R + 0.0011, top - 0.0005),
          v2(R - 0.0029, top - 0.0003),
        ],
        72
      ),
      bezelMat,
      "bezel"
    );
    // INSTANCE CANDIDATE: 40 identical flutes.
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      put(group, box(0.0008, 0.0024, 0.0012), titanium, `bezel_flute_${i}`, [
        Math.sin(a) * (R + 0.0004),
        top + 0.0016,
        Math.cos(a) * (R + 0.0004),
      ], [0, a, 0]);
    }
  } else if (spec.bezel === "dive") {
    put(group, cyl(R + 0.001, R + 0.001, 0.0038, 72, true), bezelMat, "dive_bezel_ring", [0, top + 0.0019, 0]);
    put(group, ring(R - 0.0032, R + 0.001), insert, "dive_bezel_insert", [0, top + 0.0038, 0], FLAT);
    // INSTANCE CANDIDATE: 36 identical grips.
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      put(group, box(0.0013, 0.004, 0.002), bezelMat, `bezel_grip_${i}`, [
        Math.sin(a) * (R + 0.0014),
        top + 0.0019,
        Math.cos(a) * (R + 0.0014),
      ], [0, a, 0]);
    }
    // INSTANCE CANDIDATE: 11 identical minute markers.
    for (let i = 1; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      put(group, box(0.0011, 0.0006, 0.003), ac, `bezel_minute_${i}`, [
        Math.sin(a) * (R - 0.0012),
        top + 0.004,
        Math.cos(a) * (R - 0.0012),
      ], [0, a, 0]);
    }
    // The lume pip at 12 — a dive bezel's orientation mark.
    put(group, cyl(0.0026, 0.0026, 0.0012, 24), ac, "bezel_lume_pip", [0, top + 0.0042, R - 0.0012]);
    put(group, torus(0.0026, 0.0004, 8, 24), bezelMat, "pip_surround", [0, top + 0.0042, R - 0.0012], FLAT);
  } else if (spec.bezel === "thin") {
    put(
      group,
      lathe(
        [
          v2(R - 0.0022, top + 0),
          v2(R - 0.0022, top + 0.0016),
          v2(R - 0.0004, top + 0.002),
          v2(R + 0.0008, top + 0.001),
          v2(R + 0.0008, top - 0.0004),
          v2(R - 0.0022, top + 0),
        ],
        72
      ),
      bezelMat,
      "bezel"
    );
  } else if (spec.bezel === "sapphire_ring") {
    put(
      group,
      lathe(
        [
          v2(R - 0.0026, top + 0.0002),
          v2(R - 0.0026, top + 0.0026),
          v2(R + 0.0006, top + 0.0026),
          v2(R + 0.001, top + 0.0008),
          v2(R + 0.001, top - 0.0004),
          v2(R - 0.0026, top + 0.0002),
        ],
        72
      ),
      bezelMat,
      "bezel"
    );
    put(group, torus(R - 0.0018, 0.0006, 10, 64), ac, "bezel_gold_fillet", [0, top + 0.0028, 0], FLAT);
  } else {
    // tachymètre
    put(group, cyl(R + 0.0008, R + 0.0008, 0.0026, 72, true), bezelMat, "tachy_bezel_ring", [0, top + 0.0013, 0]);
    put(group, ring(R - 0.0034, R + 0.0008), insert, "tachymetre_insert", [0, top + 0.0026, 0], FLAT);
    // INSTANCE CANDIDATE: 24 ticks, alternating size, every 6th in gold.
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      put(
        group,
        box(i % 2 ? 0.0008 : 0.0011, 0.0005, i % 2 ? 0.002 : 0.0032),
        i % 6 === 0 ? goldAcc : chapterRing,
        `tachy_tick_${i}`,
        [Math.sin(a) * (R - 0.0016), top + 0.0028, Math.cos(a) * (R - 0.0016)],
        [0, a, 0]
      );
    }
  }

  // ---- crystal ---------------------------------------------------------------
  put(group, cyl(R - 0.0027, R - 0.0027, 0.0024, 64), sapphire, "crystal", [0, top + 0.0025, 0]);

  // ---- dial ------------------------------------------------------------------
  const dR = R - 0.0029;
  if (spec.openDial) {
    // Cathedral: no solid plate. A chapter ring around the rim, then the movement itself read from
    // the dial side — bridges, gears and a flying tourbillon.
    put(group, ring(dR - 0.0086, dR), dialSlateRing, "dial_chapter_plate", [0, top + 0.0005, 0], FLAT);
    put(group, ring(dR - 0.0098, dR - 0.009), goldRing, "dial_inner_fillet", [0, top + 0.0005, 0], FLAT);
    put(group, box(0.0026, 0.0011, dR * 1.62), dm, "openwork_bridge_main", [0, top - 0.0006, 0], [0, 0.42, 0]);
    put(group, box(0.0022, 0.0011, dR * 1.3), dm, "openwork_bridge_cross", [0, top - 0.0008, 0], [0, -1.16, 0]);
    ([
      [0.0062, 0.0042, 0.0058],
      [-0.0058, 0.0034, -0.0046],
      [0.0006, 0.003, -0.0078],
    ] as [number, number, number][]).forEach((g, i) => {
      put(group, cyl(g[1], g[1], 0.0009, 28), goldAcc, `openwork_gear_${i}`, [g[0], top - 0.0009, g[2]]);
      put(group, torus(g[1] * 0.44, 0.0004, 8, 20), dm, `gear_hub_${i}`, [g[0], top - 0.0004, g[2]], FLAT);
    });
    put(group, torus(0.0052, 0.0009, 10, 40), platinum, "tourbillon_cage", [-0.0004, top - 0.0002, -0.0062], FLAT);
    put(group, box(0.001, 0.0008, 0.01), platinum, "tourbillon_bridge", [-0.0004, top + 0.0003, -0.0062], [0, 0.8, 0]);
  } else {
    put(group, cyl(dR, dR, 0.0009, 64), dm, "dial", [0, top + 0.0005, 0]);
  }
  put(group, torus(dR - 0.0018, 0.0006, 8, 64), titanium, "dial_flange", [0, top + 0.001, 0], FLAT);

  // ---- dial furniture --------------------------------------------------------
  const my = top + 0.0013;
  if (spec.markers === "applied") {
    put(group, torus(0.0092, 0.0004, 8, 48), ac, "dial_inner_ring", [0, top + 0.001, 0], FLAT);
    put(group, box(0.003, 0.0009, 0.003), ac, "dial_emblem", [0, top + 0.0012, 0.0092], [0, Math.PI / 4, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = dR - 0.0038;
      const twelve = i === 0;
      put(
        group,
        box(twelve ? 0.0028 : 0.0016, 0.0009, twelve ? 0.0048 : 0.0042),
        i % 3 === 0 ? applied : ac,
        `hour_marker_${i}`,
        [Math.sin(a) * r, my, Math.cos(a) * r],
        [0, a, 0]
      );
    }
  } else if (spec.markers === "lume") {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = dR - 0.0042;
      if (i === 0) {
        // The triangle at 12 — a cone with zero top radius, matching the source's own
        // CylinderGeometry(0, r, h, 3).
        put(group, cone(0.0038, 0.0011, 3), ac, "lume_triangle_12", [0, my, r], [0, Math.PI, 0]);
      } else if (i === 3 || i === 6 || i === 9) {
        put(group, box(0.0022, 0.0011, 0.0068), ac, `lume_bar_${i}`, [Math.sin(a) * r, my, Math.cos(a) * r], [0, a, 0]);
      } else {
        put(group, cyl(0.0016, 0.0016, 0.0011, 24), ac, `lume_dot_${i}`, [Math.sin(a) * r, my, Math.cos(a) * r]);
        put(group, torus(0.0019, 0.0003, 8, 20), steel, `marker_surround_${i}`, [
          Math.sin(a) * r,
          my - 0.0002,
          Math.cos(a) * r,
        ], FLAT);
      }
    }
    put(group, box(0.006, 0.0008, 0.0026), gunmetal, "date_frame", [dR - 0.0058, my, 0], [0, Math.PI / 2, 0]);
  } else if (spec.markers === "baton_slim") {
    put(group, ring(dR - 0.0016, dR - 0.0008), goldRing, "minute_track", [0, top + 0.0011, 0], FLAT);
    // INSTANCE CANDIDATE: 48 minute ticks (60 less the 12 on-hour positions).
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue;
      const a = (i / 60) * Math.PI * 2;
      put(group, box(0.0004, 0.0004, 0.0014), ac, `minute_tick_${i}`, [
        Math.sin(a) * (dR - 0.0024),
        top + 0.0011,
        Math.cos(a) * (dR - 0.0024),
      ], [0, a, 0]);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = dR - 0.0046;
      put(
        group,
        box(i % 3 === 0 ? 0.0012 : 0.0008, 0.0008, i % 3 === 0 ? 0.0058 : 0.0044),
        ac,
        `applied_baton_${i}`,
        [Math.sin(a) * r, my, Math.cos(a) * r],
        [0, a, 0]
      );
    }
    put(group, torus(0.006, 0.0004, 8, 40), ac, "subsidiary_seconds_ring", [0, top + 0.0011, -0.0074], FLAT);
  } else if (spec.markers === "skeleton") {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = dR - 0.0042;
      put(
        group,
        box(i % 3 === 0 ? 0.0013 : 0.0008, 0.0009, i % 3 === 0 ? 0.0044 : 0.003),
        ac,
        `chapter_index_${i}`,
        [Math.sin(a) * r, my, Math.cos(a) * r],
        [0, a, 0]
      );
    }
  } else {
    // chrono
    put(group, ring(dR - 0.0014, dR - 0.0006), chapterRing, "minute_track", [0, top + 0.0011, 0], FLAT);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = dR - 0.0044;
      put(
        group,
        box(i === 0 ? 0.0026 : 0.0015, 0.0009, i === 0 ? 0.0046 : 0.004),
        i % 3 === 0 ? applied : chapterRing,
        `hour_marker_${i}`,
        [Math.sin(a) * r, my, Math.cos(a) * r],
        [0, a, 0]
      );
    }
    // Three chronograph counters, each a recess, a ring, 12 ticks and its own little hand.
    ([
      [-0.0086, 0],
      [0.0086, 0],
      [0, -0.0092],
    ] as [number, number][]).forEach((c, i) => {
      put(group, ring(0, 0.005), insert, `counter_recess_${i}`, [c[0], top + 0.0011, c[1]], FLAT);
      put(group, torus(0.005, 0.0005, 8, 40), i === 2 ? goldAcc : chapterRing, `counter_ring_${i}`, [
        c[0],
        top + 0.0013,
        c[1],
      ], FLAT);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        put(group, box(0.0004, 0.0004, 0.001), chapterRing, `counter_tick_${i}_${k}`, [
          c[0] + Math.sin(a) * 0.004,
          top + 0.0014,
          c[1] + Math.cos(a) * 0.004,
        ], [0, a, 0]);
      }
      put(group, box(0.0005, 0.0005, 0.0036), i === 2 ? goldAcc : applied, `counter_hand_${i}`, [
        c[0],
        top + 0.0017,
        c[1],
      ], [0, 0.7 + i * 1.6, 0]);
      put(group, cyl(0.0007, 0.0007, 0.0012, 16), chapterRing, `counter_pinion_${i}`, [c[0], top + 0.0017, c[1]]);
    });
  }

  // ---- hands -----------------------------------------------------------------
  // Each hand's geometry is offset along +Z by roughly a third of its length so it pivots about
  // the dial centre rather than its own midpoint; the source does this via geometry.translate,
  // reproduced here as a position offset on the mesh inside the hand group.
  const hands = new THREE.Group();
  hands.name = "hand_stack";
  hands.position.set(0, top + 0.0016, 0);
  group.add(hands);

  if (spec.hands === "sword") {
    put(hands, box(0.0028, 0.0009, 0.0092), ac, "hour_hand", [0, 0, 0.0032], [0, 0.62, 0]);
    put(hands, box(0.0024, 0.0009, 0.0132), ac, "minute_hand", [0, 0.001, 0.005], [0, -1.9, 0]);
    put(hands, box(0.0008, 0.0007, 0.0152), steel, "seconds_hand", [0, 0.0019, 0.0044], [0, 2.7, 0]);
    put(hands, cyl(0.0028, 0.0028, 0.0026, 20), ac, "seconds_lollipop", [0, 0.0019, 0.0106], [0, 2.7, 0]);
    put(hands, cyl(0.002, 0.002, 0.0028, 20), gunmetal, "hand_pinion", [0, 0.0012, 0]);
  } else if (spec.hands === "leaf") {
    put(hands, box(0.0013, 0.0006, 0.0094), ac, "hour_hand", [0, 0, 0.0034], [0, 0.62, 0]);
    put(hands, box(0.001, 0.0006, 0.0138), ac, "minute_hand", [0, 0.0008, 0.0054], [0, -1.9, 0]);
    put(hands, cyl(0.0014, 0.0014, 0.0022, 20), ac, "hand_pinion", [0, 0.0009, 0]);
  } else if (spec.hands === "skeleton") {
    // Openworked hands: two thin rails with a solid tip, so the dial shows through them.
    [-1, 1].forEach((s, i) => {
      put(hands, box(0.0004, 0.0006, 0.009), ac, `hour_hand_rail_${i}`, [s * 0.0007, 0, 0.0032], [0, 0.62, 0]);
      put(hands, box(0.0004, 0.0006, 0.0132), ac, `minute_hand_rail_${i}`, [s * 0.0006, 0.0009, 0.0052], [0, -1.9, 0]);
    });
    put(hands, box(0.0018, 0.0006, 0.0009), ac, "hour_hand_tip", [0, 0, 0.0074], [0, 0.62, 0]);
    put(hands, box(0.0016, 0.0006, 0.0009), ac, "minute_hand_tip", [0, 0.0009, 0.0114], [0, -1.9, 0]);
    put(hands, cyl(0.0016, 0.0016, 0.0024, 20), platinum, "hand_pinion", [0, 0.001, 0]);
  } else if (spec.hands === "chrono") {
    put(hands, box(0.0019, 0.0007, 0.0086), applied, "hour_hand", [0, 0, 0.003], [0, 0.62, 0]);
    put(hands, box(0.0016, 0.0007, 0.0126), applied, "minute_hand", [0, 0.0009, 0.0048], [0, -1.9, 0]);
    put(hands, box(0.0007, 0.0006, 0.015), goldAcc, "chrono_seconds_hand", [0, 0.0018, 0.0046], [0, 2.35, 0]);
    put(hands, box(0.0009, 0.0006, 0.003), goldAcc, "chrono_counterweight", [0, 0.0018, -0.003], [0, 2.35, 0]);
    put(hands, cyl(0.0018, 0.0018, 0.0026, 20), goldAcc, "hand_pinion", [0, 0.0011, 0]);
  } else {
    // baton
    put(hands, box(0.0018, 0.0007, 0.0098), applied, "hour_hand", [0, 0, 0.0034], [0, 0.62, 0]);
    put(hands, box(0.0015, 0.0007, 0.0136), applied, "minute_hand", [0, 0.0009, 0.0052], [0, -1.9, 0]);
    put(hands, box(0.0007, 0.0006, 0.015), goldAcc, "seconds_hand", [0, 0.0017, 0.0046], [0, 2.7, 0]);
    put(hands, cyl(0.0018, 0.0018, 0.0026, 20), goldAcc, "hand_pinion", [0, 0.001, 0]);
  }

  // ---- crown (and pushers) ---------------------------------------------------
  if (spec.crown === "oversize") {
    put(group, cyl(0.005, 0.005, 0.0058, 32), cm, "crown", [R + 0.0026, 0, 0], [0, 0, Math.PI / 2]);
    // INSTANCE CANDIDATE: 16 knurls.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      put(group, box(0.0058, 0.001, 0.001), gunmetal, `crown_knurl_${i}`, [
        R + 0.0026,
        Math.sin(a) * 0.005,
        Math.cos(a) * 0.005,
      ], [a, 0, 0]);
    }
    put(group, cyl(0.0034, 0.0034, 0.0018, 24), titanium, "crown_cap", [R + 0.0062, 0, 0], [0, 0, Math.PI / 2]);
    [-1, 1].forEach((s, i) => {
      put(group, box(0.006, 0.0044, 0.0062), cm, `crown_guard_${i}`, [R - 0.0006, 0, s * 0.0064]);
    });
  } else if (spec.crown === "slim") {
    put(group, cyl(0.003, 0.003, 0.0034, 28), cm, "crown", [R + 0.0014, 0, 0], [0, 0, Math.PI / 2]);
    put(group, cyl(0.0022, 0.0022, 0.0012, 20), ac, "crown_cap", [R + 0.0034, 0, 0], [0, 0, Math.PI / 2]);
  } else if (spec.crown === "pushers") {
    put(group, cyl(0.0038, 0.0038, 0.0042, 32), gunmetal, "crown", [R + 0.0018, 0, 0], [0, 0, Math.PI / 2]);
    put(group, cyl(0.0028, 0.0028, 0.0016, 24), titanium, "crown_cap", [R + 0.0042, 0, 0], [0, 0, Math.PI / 2]);
    ([
      [1, 0.0092],
      [-1, 0.0092],
    ] as [number, number][]).forEach(([s, off], i) => {
      put(group, cyl(0.0026, 0.0026, 0.0044, 24), gunmetal, `chrono_pusher_${i}`, [
        R * 0.86 + 0.0012,
        0,
        s * off,
      ], [0, 0, Math.PI / 2]);
      put(group, cyl(0.003, 0.003, 0.0016, 24), cm, `pusher_shoulder_${i}`, [R * 0.82, 0, s * off], [0, 0, Math.PI / 2]);
    });
  } else {
    // guarded
    put(group, cyl(0.0038, 0.0038, 0.0042, 32), gunmetal, "crown", [R + 0.0018, 0, 0], [0, 0, Math.PI / 2]);
    put(group, cyl(0.0028, 0.0028, 0.0016, 24), titanium, "crown_cap", [R + 0.0042, 0, 0], [0, 0, Math.PI / 2]);
    [-1, 1].forEach((s, i) => {
      put(group, box(0.0044, 0.003, 0.0052), cm, `crown_guard_${i}`, [R - 0.0004, 0, s * 0.0056]);
    });
  }

  // ---- caseback --------------------------------------------------------------
  const bR = R - 0.0029;
  put(group, torus(bR, 0.0018, 12, 64), cm, "case_back_ring", [0, -top - 0.0007, 0], FLAT);
  if (spec.exhibition) {
    // A sapphire window showing the movement — the reason `movement` is one of the inspection
    // presets. The rotor is a half-torus plus a half-cylinder web, matching the source.
    put(group, cyl(bR - 0.0006, bR - 0.0006, 0.0014, 64), sapphire, "case_back_crystal", [0, -top - 0.0009, 0]);
    put(group, cyl(bR - 0.0018, bR - 0.0018, 0.0012, 64), titanium, "movement_plate", [0, -top + 0.0013, 0]);
    put(group, torus(0.0112, 0.0016, 10, 48, Math.PI), goldAcc, "movement_rotor", [0, -top + 0.0001, 0], [
      Math.PI / 2,
      0,
      0.5,
    ]);
    put(group, cylPartial(0.0112, 0.0112, 0.0012, 40, 0.4, Math.PI), gunmetal, "rotor_web", [0, -top + 0.0001, 0]);
    ([
      [0.007, 0.005, 0.0082],
      [-0.0062, 0.0038, -0.005],
      [0.0014, 0.0034, -0.0088],
    ] as [number, number, number][]).forEach((g, i) => {
      put(group, cyl(g[1], g[1], 0.001, 28), goldAcc, `movement_gear_${i}`, [g[0], -top - 0.0001, g[2]]);
    });
    put(group, box(0.0024, 0.001, 0.018), titanium, "movement_bridge", [-0.0028, -top + 0.0003, 0], [0, 0.5, 0]);
  } else {
    put(group, cyl(bR - 0.0006, bR - 0.0006, 0.0016, 64), cm, "screw_down_caseback", [0, -top - 0.0009, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      put(group, box(0.003, 0.0014, 0.0012), gunmetal, `caseback_notch_${i}`, [
        Math.sin(a) * (bR - 0.0016),
        -top - 0.0014,
        Math.cos(a) * (bR - 0.0016),
      ], [0, a, 0]);
    }
    put(group, torus(0.0086, 0.0005, 8, 48), titanium, "caseback_engraving", [0, -top - 0.0018, 0], FLAT);
  }

  // ---- lugs ------------------------------------------------------------------
  [-1, 1].forEach((s, i) => {
    put(group, box(R * 0.88, 0.0048, 0.0086), cm, `lug_${i}`, [0, -0.0014, s * (R * 0.81)], [s * 0.3, 0, 0]);
    put(group, cyl(0.0011, 0.0011, R * 0.95, 16), titanium, `spring_bar_${i}`, [
      0,
      -0.0038,
      s * (R * 0.96),
    ], [0, 0, Math.PI / 2]);
  });

  // ---- strap / bracelet ------------------------------------------------------
  // A closed elliptical loop of 24 segments wrapping where a wrist would be, gapped at the top
  // where the case sits. Each segment is rotated to the loop's local tangent so the band reads as
  // articulated rather than as a smooth tube, and tapers toward the 6-o'clock side.
  // INSTANCE CANDIDATE: 24 segments x 2-3 parts each.
  {
    const strapGroup = new THREE.Group();
    strapGroup.name = spec.strap === "bracelet" ? "bracelet" : "strap";
    group.add(strapGroup);

    const cY = -0.0205;
    const rY = 0.026;
    const rZ = 0.0168;
    const GAP = 0.62;
    const N = 24;

    for (let i = 0; i < N; i++) {
      const th = GAP + (i / (N - 1)) * (Math.PI * 2 - GAP * 2);
      const y = cY + rY * Math.cos(th);
      const z = rZ * Math.sin(th);
      const a = Math.atan2(rY * Math.sin(th), rZ * Math.cos(th));
      const t = Math.abs(Math.cos(th * 0.5));
      const w = spec.strapW - 0.003 * (1 - t);
      const centre = Math.abs(th - Math.PI) < 0.18;

      const link = new THREE.Group();
      link.name = (spec.strap === "bracelet" ? "bracelet_link_" : "strap_segment_") + i;
      link.position.set(0, y, z);
      link.rotation.x = a;
      strapGroup.add(link);

      if (spec.strap === "bracelet") {
        put(link, box(w, 0.003, 0.0062), i % 2 ? cm : linkMat, `link_plate_${i}`);
        put(link, box(w * 0.42, 0.0034, 0.0044), i % 2 ? linkMat : cm, `link_centre_${i}`, [0, 0.0004, 0]);
        if (centre) put(link, box(w * 1.06, 0.0018, 0.01), titanium, "clasp_cover", [0, -0.0022, 0]);
      } else if (spec.strap === "leather") {
        put(link, box(w, 0.0024, 0.0076), leather, `leather_section_${i}`);
        [-1, 1].forEach((s, k) => {
          put(link, box(0.0005, 0.0006, 0.0068), ac, `stitch_${i}_${k}`, [s * (w / 2 - 0.0018), 0.0013, 0]);
        });
        if (centre) {
          put(link, box(w * 1.12, 0.0022, 0.0128), cm, "deployant_buckle", [0, -0.0024, 0]);
          put(link, box(w * 0.52, 0.0014, 0.006), ac, "buckle_plate", [0, -0.0038, 0]);
        }
      } else {
        put(link, box(w, 0.0034, 0.0074), rubber, `rubber_section_${i}`);
        put(link, box(w * 0.88, 0.0012, 0.0028), rubber, `rubber_rib_${i}`, [0, 0.0021, 0]);
        if (centre) {
          put(link, box(w * 1.08, 0.0024, 0.012), cm, "rubber_clasp", [0, -0.0028, 0]);
          put(link, box(w * 0.46, 0.0016, 0.0056), gunmetal, "clasp_release", [0, -0.0042, 0]);
        }
      }
    }
  }

  // ---- crystal glint ---------------------------------------------------------
  // An additive plane skimming the crystal, swept across it by `lights(t)`. Its own material is a
  // per-watch clone rather than a palette entry because the choreography animates its opacity —
  // sharing one instance across two mounted reveals would make them fight over it.
  const glintGeo = new THREE.PlaneGeometry(0.0042, 0.02);
  disposeGeo.push(glintGeo);
  const glintMat = new THREE.MeshBasicMaterial({
    color: 0xfff6e6,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  glintMat.name = "crystal_reflection_mat";
  disposeMat.push(glintMat);
  const glint = new THREE.Mesh(glintGeo, glintMat);
  glint.name = "crystal_reflection";
  glint.rotation.x = -Math.PI / 2;
  glint.rotation.z = 0.42;
  glint.position.y = top + 0.0039;
  glint.castShadow = false;
  group.add(glint);

  // Neither the crystal nor the glint should cast a shadow: a transparent cover casting an opaque
  // silhouette onto its own dial is the single most obvious tell of a fake watch render.
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && (mesh.material === sapphire || (mesh.material as THREE.Material)?.name === "crystal_reflection_mat")) {
      mesh.castShadow = false;
    }
  });

  return {
    group,
    glint,
    top,
    dispose: () => {
      for (const g of disposeGeo) g.dispose();
      for (const m of disposeMat) m.dispose();
    },
  };
}
