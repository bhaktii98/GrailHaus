// The APEX watch — ported from the design's own `buildWatch()`
// (the-obsidian-vault/project/apex-vault.html, lines 439-541).
//
// One architecture, five executions. Unlike the Reserve (five case constructions) or The Archive
// (five distinct pieces), every reference here shares this exact geometry and differs only in
// material — see ../config/obsidianReferences.ts for why that is the right structure for the top
// tier rather than a shortcut.
//
// The construction is a thin dress-sport case at true scale (R = 20.5mm, so a 41mm watch): a
// tapered mid-case with a polished flank, an exhibition caseback with three wheels and a bridge, a
// stepped bezel, a dial with applied indices and a subdial recess, three hands plus a running
// seconds, a lathe-domed crystal, a knurled crown, four lugs, and a 19-link bracelet wrapping the
// velvet bolster.
import * as THREE from "three";
import { ObsidianBin, put, slab } from "./obsidianGeometry";
import {
  createReferenceMaterials,
  obsidianMaterialFor,
  type ObsidianPalette,
} from "./obsidianMaterials";
import type { ObsidianReference } from "../config/obsidianReferences";

/** Case radius — 41mm. The design's own `R`. */
const R = 0.0205;

export interface ObsidianWatch {
  group: THREE.Group;
  /** The running seconds hand, advanced every frame so the watch reads as alive. */
  secondHand: THREE.Mesh;
  dispose(): void;
}

export function buildObsidianWatch(
  reference: ObsidianReference,
  palette: ObsidianPalette
): ObsidianWatch {
  const bin = new ObsidianBin();
  const P = createReferenceMaterials(reference, palette);
  const crystal = obsidianMaterialFor(palette, "crystal");

  const group = new THREE.Group();
  group.name = `WATCH_${reference.id}`;

  const caseAsm = new THREE.Group();
  caseAsm.name = "Case";
  // Lifts the case off the bolster the bracelet wraps.
  caseAsm.position.y = 0.0222;
  group.add(caseAsm);

  // ---- case middle ---------------------------------------------------------
  put(caseAsm, bin.cyl(R, R * 0.95, 0.0088, 64), P.metal, "CaseMid").castShadow = true;
  put(caseAsm, bin.cyl(R * 1.004, R * 1.004, 0.0024, 64), P.brush, "CaseFlank", [0, 0.0004, 0]);

  // ---- exhibition caseback -------------------------------------------------
  // Every reference gets one: at this tier a solid back would be a downgrade, and it is what makes
  // the "movement" inspection preset meaningful.
  put(caseAsm, bin.cyl(R * 0.87, R * 0.87, 0.0026, 48), P.brush, "Caseback", [0, -0.0062, 0]);
  put(caseAsm, bin.cyl(R * 0.58, R * 0.58, 0.0014, 48), crystal, "CasebackCrystal", [0, -0.0076, 0]);
  for (const [gx, gz, gr] of [
    [0, 0.004, 0.0052],
    [0.0078, -0.0042, 0.004],
    [-0.0088, -0.0018, 0.0033],
  ] as [number, number, number][]) {
    put(caseAsm, bin.cyl(gr, gr, 0.0016, 28), P.trim, "MovementWheel", [gx, -0.0072, gz]);
  }
  put(caseAsm, bin.torus(R * 0.44, 0.0008, 8, 56), P.accent, "MovementBridge", [0, -0.007, 0], [
    Math.PI / 2,
    0,
    0,
  ]);

  // ---- bezel ---------------------------------------------------------------
  put(caseAsm, bin.cyl(R, R * 0.984, 0.0022, 72, true), P.metal, "BezelFlank", [0, 0.0055, 0]);
  put(caseAsm, bin.ring(R * 0.848, R * 0.998, 72), P.metal, "BezelTop", [0, 0.0066, 0], [
    -Math.PI / 2,
    0,
    0,
  ]);
  // The optional ring is what most distinguishes the executions at a glance — a gold fillet on the
  // warm references, the case metal itself on Glacier, absent on Meridian.
  if (P.ring) {
    put(caseAsm, bin.torus(R * 0.9, 0.0009, 10, 84), P.ring, "BezelRing", [0, 0.0066, 0], [
      Math.PI / 2,
      0,
      0,
    ]);
  }

  // ---- dial ----------------------------------------------------------------
  const dialGrp = new THREE.Group();
  dialGrp.name = "Dial";
  dialGrp.position.y = 0.0058;
  caseAsm.add(dialGrp);

  put(dialGrp, bin.cyl(R * 0.845, R * 0.845, 0.0009, 64), P.dial, "DialPlate");
  put(dialGrp, bin.torus(R * 0.8, 0.0004, 8, 72), P.trim, "DialChapterRing", [0, 0.0007, 0], [
    Math.PI / 2,
    0,
    0,
  ]);

  // Twelve applied markers, every third one larger. Two styles: a baton, or a round marker in a
  // surround ring (which reads as more formal and is used by the two cooler references).
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rr = R * 0.7;
    const big = i % 3 === 0;
    const x = Math.sin(a) * rr;
    const z = Math.cos(a) * rr;
    if (reference.index === "dot") {
      const rad = big ? 0.0013 : 0.0008;
      put(dialGrp, bin.cyl(rad, rad, 0.0007, 20), P.accent, `DialIndex${i}`, [x, 0.0008, z]);
      put(dialGrp, bin.torus(big ? 0.0016 : 0.0011, 0.00025, 6, 24), P.trim, `DialIndexSurround${i}`, [
        x,
        0.0008,
        z,
      ], [Math.PI / 2, 0, 0]);
    } else {
      put(
        dialGrp,
        bin.slab(big ? 0.0018 : 0.001, big ? 0.0052 : 0.0034, 0.0007, 0.0003, 0.0002),
        P.accent,
        `DialIndex${i}`,
        [x, 0.0008, z],
        [0, a, 0]
      );
    }
  }

  // A recessed subdial at 12 — the one complication, kept subtle.
  put(dialGrp, bin.cyl(R * 0.28, R * 0.28, 0.0006, 48), P.dial, "SubdialRecess", [0, 0.001, R * 0.4]);
  put(dialGrp, bin.torus(R * 0.28, 0.00035, 8, 56), P.trim, "SubdialRing", [0, 0.0013, R * 0.4], [
    Math.PI / 2,
    0,
    0,
  ]);

  // ---- hands ---------------------------------------------------------------
  // Each hand's geometry is translated forward along +Z so it pivots about the dial centre rather
  // than its own midpoint. Built individually (not via the bin's slab helper) because each needs
  // `translate` applied to its own geometry before use.
  const hands = new THREE.Group();
  hands.name = "Hands";
  hands.position.y = 0.0016;
  dialGrp.add(hands);

  const hourGeo = bin.add(slab(0.0018, 0.0096, 0.0006, 0.0004, 0.0002));
  hourGeo.translate(0, 0, 0.0046);
  const hHour = put(hands, hourGeo, P.accent, "HandHour");
  hHour.rotation.y = -Math.PI * 2 * (10.1 / 12);

  const minGeo = bin.add(slab(0.0013, 0.0136, 0.0006, 0.0003, 0.0002));
  minGeo.translate(0, 0, 0.0064);
  const hMin = put(hands, minGeo, P.accent, "HandMinute", [0, 0.0008, 0]);
  hMin.rotation.y = -Math.PI * 2 * (2 / 12) + Math.PI;

  const secGeo = bin.add(slab(0.0007, 0.0166, 0.0004, 0.0002, 0.0001));
  secGeo.translate(0, 0, 0.0054);
  const hSec = put(hands, secGeo, P.trim, "HandSecond", [0, 0.0016, 0]);
  hSec.rotation.y = Math.PI * 0.72;

  put(hands, bin.cyl(0.0013, 0.0013, 0.002, 24), P.accent, "HandCap", [0, 0.0016, 0]);

  // ---- crystal -------------------------------------------------------------
  // A lathe profile rather than a sphere cap: the design samples a `pow(t, 1.7)` curve, which
  // gives a box-dome that is nearly flat across the centre and falls away sharply at the rim —
  // the characteristic profile of a modern sapphire, and quite different from a spherical bulge.
  const dome: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    dome.push(new THREE.Vector2(Math.max(R * 0.845 * (1 - t), 0.00002), Math.pow(t, 1.7) * 0.0021));
  }
  put(caseAsm, bin.lathe(dome, 64), crystal, "Crystal", [0, 0.007, 0]);
  put(caseAsm, bin.cyl(R * 0.847, R * 0.847, 0.0018, 64, true), crystal, "CrystalFlank", [0, 0.0076, 0]);

  // ---- crown ---------------------------------------------------------------
  const crown = new THREE.Group();
  crown.name = "Crown";
  crown.position.set(R + 0.003, 0, 0);
  caseAsm.add(crown);

  put(crown, bin.cyl(0.0038, 0.0042, 0.0044, 26), P.metal, "CrownBody", undefined, [0, 0, Math.PI / 2]);
  put(crown, bin.cyl(0.0026, 0.0026, 0.0016, 20), P.accent, "CrownCap", [0.0028, 0, 0], [0, 0, Math.PI / 2]);
  // Fourteen knurls around the crown — small, and the kind of detail the inspection zoom exists
  // for.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    put(crown, bin.slab(0.0044, 0.0006, 0.0006, 0.0002, 0.0001), P.brush, "CrownKnurl", [
      0,
      Math.sin(a) * 0.0039,
      Math.cos(a) * 0.0039,
    ]);
  }

  // ---- lugs ----------------------------------------------------------------
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      put(caseAsm, bin.slab(0.0056, 0.0115, 0.0048, 0.0016, 0.0007), P.brush, "Lug", [
        sx * 0.0072,
        -0.0016,
        sz * (R * 0.8),
      ]);
    }
  }

  // ---- bracelet ------------------------------------------------------------
  // Nineteen links swept around an arc, gapped at the top where the case sits, tapering toward the
  // clasp. Each link is a centre plate flanked by two outer links, plus an optional gold inlay on
  // the references that have a bezel ring — so the bracelet echoes the case's own finish.
  const bracelet = new THREE.Group();
  bracelet.name = "Bracelet";
  group.add(bracelet);

  const NLINK = 19;
  const arcR = 0.0188;
  for (let i = 0; i < NLINK; i++) {
    const t = i / (NLINK - 1);
    const ang = 0.58 + (Math.PI * 2 - 0.58 - 0.58) * t;
    const g = new THREE.Group();
    g.name = `BraceletLink${i}`;
    g.position.set(0, Math.cos(ang) * arcR, Math.sin(ang) * arcR);
    g.rotation.x = ang;
    bracelet.add(g);

    const taper = 1 - 0.14 * Math.min(1, (Math.abs(ang - Math.PI) / 2.6) * 1.2);
    put(g, bin.slab(0.0112 * taper, 0.0078, 0.003, 0.0009, 0.0004), P.metal, "LinkCenter").castShadow = true;
    put(g, bin.slab(0.0052 * taper, 0.0072, 0.0032, 0.0009, 0.0004), P.brush, "LinkOuterL", [
      -0.0082 * taper,
      0.0001,
      0,
    ]);
    put(g, bin.slab(0.0052 * taper, 0.0072, 0.0032, 0.0009, 0.0004), P.brush, "LinkOuterR", [
      0.0082 * taper,
      0.0001,
      0,
    ]);
    if (P.ring) {
      put(g, bin.slab(0.0046 * taper, 0.002, 0.0012, 0.0004, 0.0002), P.ring, "LinkInlay", [0, 0.0017, 0]);
    }
  }

  const clasp = new THREE.Group();
  clasp.name = "Clasp";
  clasp.position.set(0, -arcR * 0.99, 0);
  clasp.rotation.x = Math.PI;
  bracelet.add(clasp);
  put(clasp, bin.slab(0.0206, 0.021, 0.0032, 0.0012, 0.0006), P.brush, "ClaspBody");
  put(clasp, bin.slab(0.015, 0.013, 0.0014, 0.0008, 0.0004), P.accent, "ClaspPlate", [0, 0.0022, 0]);
  put(clasp, bin.torus(0.0042, 0.0007, 8, 40), P.trim, "ClaspEmblem", [0, 0.0032, 0], [Math.PI / 2, 0, 0]);

  // A few degrees off square, so the presented watch never looks mechanically aligned to the case.
  group.rotation.y = -Math.PI * 0.06;

  return {
    group,
    secondHand: hSec,
    dispose: () => {
      bin.dispose();
      P.dispose();
    },
  };
}
