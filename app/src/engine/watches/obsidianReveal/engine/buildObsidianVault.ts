// The Obsidian Vault case — ported from the design's own vault construction
// (the-obsidian-vault/project/apex-vault.html, lines 224-351).
//
// Dimensions are the design's own, in metres at true scale: a 340mm x 260mm case, 86mm body, 28mm
// lid, 15mm walls. Substantially the largest of the three watch cases — the Reserve is 176mm and
// The Archive 260mm — which is correct for the tier: this is a private-client delivery case, not a
// presentation box.
//
// WHAT MAKES THIS CASE DIFFERENT FROM THE OTHER TWO
//
// The Reserve's character is material (walnut grain, velvet, brass). The Archive's is machining
// (lock bolts, rim frames, buttresses). This one's is *ornament*: art-deco stepped corners, a
// four-armed filigree at each corner upright, a double gold border frame on the lid, an eight-ray
// emblem, two gold-lined side compartments. Roughly 120 meshes, most of them thin gold plates
// under a millimetre thick — which is exactly why ./obsidianGeometry.ts's `slab` clamps its bevel
// to a fraction of thickness rather than taking it absolute.
import * as THREE from "three";
import { ObsidianBin, put, type Pt3 } from "./obsidianGeometry";
import { obsidianMaterialFor, type ObsidianPalette } from "./obsidianMaterials";

// ---- dimensions (source line 224-225) --------------------------------------
export const VAULT_W = 0.34;
export const VAULT_D = 0.26;
export const VAULT_H = 0.086;
const T = 0.015;
export const LID_H = 0.028;
const IW = VAULT_W - 2 * T;
const ID = VAULT_D - 2 * T;
export const FLOOR_Y = 0.018;

/** Lid hinge, at the rear of the body's top face. */
export const HINGE_Y = VAULT_H + 0.0005;
export const HINGE_Z = -VAULT_D / 2 + 0.006;
/** Full open angle — the design's own `-Math.pow(p,1.08)*1.80`. */
export const LID_MAX_RAD = 1.8;

/** Cushion rest height and its travel, from the design's `cushion.position.y=.008+S.rise*.042`. */
export const CUSHION_Y0 = 0.008;
export const CUSHION_RISE = 0.042;

/** Where the ribbon's band sits along X — the design offsets the whole wrap to one side so the
 * pull tail hangs clear of the emblem rather than across it. */
export const BAND_X = -0.082;
/** Top of the closed case, which the ribbon wraps over. */
export const VAULT_TOP = VAULT_H + LID_H;

export interface ObsidianVault {
  group: THREE.Group;
  /** Hinged at the rear; the choreography rotates this about X. */
  hinge: THREE.Group;
  /** Rises during the mist sequence, carrying the cushion and watch. */
  cushion: THREE.Group;
  /** Where the watch mounts — a child of the cushion, at bolster height. */
  anchor: THREE.Group;
  /** The two interior chamber lights' nominal positions need the interior's own dimensions. */
  interior: THREE.Group;
  dispose(): void;
}

export function buildObsidianVault(palette: ObsidianPalette): ObsidianVault {
  const bin = new ObsidianBin();
  const M = (key: string) => obsidianMaterialFor(palette, key);

  const group = new THREE.Group();
  group.name = "APEX_VAULT";

  // ---- outer shell ---------------------------------------------------------
  const shell = new THREE.Group();
  shell.name = "OuterShell";
  group.add(shell);

  // The base is one of only four shadow-casting meshes in the whole scene (the design is explicit
  // about this: `castShadow` is set per-mesh, never globally, because a 500-mesh scene rendering a
  // full shadow pass per light would be ruinous).
  put(shell, bin.slab(VAULT_W, VAULT_D, FLOOR_Y, 0.016, 0.005), M("lacquer"), "ShellBase", [
    0,
    FLOOR_Y / 2,
    0,
  ]).castShadow = true;

  const wallH = VAULT_H - FLOOR_Y;
  put(shell, bin.slab(VAULT_W, T, wallH, 0.008, 0.004), M("lacquer"), "WallBack", [
    0,
    FLOOR_Y + wallH / 2,
    -VAULT_D / 2 + T / 2,
  ]);
  put(shell, bin.slab(VAULT_W, T, wallH, 0.008, 0.004), M("lacquer"), "WallFront", [
    0,
    FLOOR_Y + wallH / 2,
    VAULT_D / 2 - T / 2,
  ]);
  put(shell, bin.slab(T, ID, wallH, 0.008, 0.004), M("lacquer"), "WallLeft", [
    -VAULT_W / 2 + T / 2,
    FLOOR_Y + wallH / 2,
    0,
  ]);
  put(shell, bin.slab(T, ID, wallH, 0.008, 0.004), M("lacquer"), "WallRight", [
    VAULT_W / 2 - T / 2,
    FLOOR_Y + wallH / 2,
    0,
  ]);
  put(shell, bin.slab(VAULT_W - 0.03, VAULT_D - 0.03, 0.006, 0.01, 0.002), M("lacquerEdge"), "Plinth", [
    0,
    0.003,
    0,
  ]);

  // ---- exterior gold inlay -------------------------------------------------
  const inlay = new THREE.Group();
  inlay.name = "GoldInlay";
  group.add(inlay);

  // A thin line along one axis. The design's own helper — `axis` selects which dimension carries
  // the length, so one function draws both the front/back and left/right runs.
  const goldLine = (
    len: number,
    axis: "x" | "z",
    pos: Pt3,
    thick: number,
    depth: number,
    matKey: string,
    name: string
  ) => {
    const g =
      axis === "x" ? bin.slab(len, depth, thick, 0.0004, 0.0002) : bin.slab(depth, len, thick, 0.0004, 0.0002);
    return put(inlay, g, M(matKey), name, pos);
  };

  // Seam line just under the lid parting plane, on all four sides.
  goldLine(VAULT_W - 0.004, "x", [0, VAULT_H - 0.006, VAULT_D / 2 + 0.0005], 0.0011, 0.0016, "goldPolish", "SeamLineFront");
  goldLine(VAULT_W - 0.004, "x", [0, VAULT_H - 0.006, -VAULT_D / 2 - 0.0005], 0.0011, 0.0016, "goldPolish", "SeamLineBack");
  goldLine(VAULT_D - 0.004, "z", [VAULT_W / 2 + 0.0005, VAULT_H - 0.006, 0], 0.0011, 0.0016, "goldPolish", "SeamLineRight");
  goldLine(VAULT_D - 0.004, "z", [-VAULT_W / 2 - 0.0005, VAULT_H - 0.006, 0], 0.0011, 0.0016, "goldPolish", "SeamLineLeft");
  // Base rail, brushed rather than polished so the two runs read as different mouldings.
  goldLine(VAULT_W - 0.012, "x", [0, 0.0075, VAULT_D / 2 + 0.0006], 0.0009, 0.0014, "goldBrush", "BaseRailFront");
  goldLine(VAULT_W - 0.012, "x", [0, 0.0075, -VAULT_D / 2 - 0.0006], 0.0009, 0.0014, "goldBrush", "BaseRailBack");

  // Corner filigree — a two-armed bracket plus a stud at each of the four corners.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const c = new THREE.Group();
      c.name = "CornerDetail";
      c.position.set(sx * (VAULT_W / 2 - 0.014), 0, sz * (VAULT_D / 2 - 0.014));
      inlay.add(c);
      put(c, bin.slab(0.026, 0.0012, 0.0009, 0.0003, 0.0002), M("goldPolish"), "CornerArmX", [
        -sx * 0.008,
        FLOOR_Y + 0.012,
        sz * 0.014 + 0.0002,
      ]);
      put(c, bin.slab(0.0012, 0.024, 0.0009, 0.0003, 0.0002), M("goldPolish"), "CornerArmZ", [
        sx * 0.0142,
        FLOOR_Y + 0.012,
        -sz * 0.007,
      ]);
      put(c, bin.cyl(0.0022, 0.0022, 0.0008, 20), M("goldBrush"), "CornerStud", [
        0,
        FLOOR_Y + 0.012,
        sz * 0.0142,
      ]);
    }
  }

  // Front plaque — the engraved nameplate.
  put(inlay, bin.slab(0.052, 0.0018, 0.011, 0.0012, 0.0006), M("goldBrush"), "FrontPlaque", [
    0,
    0.036,
    VAULT_D / 2 + 0.0009,
  ]);
  put(inlay, bin.slab(0.038, 0.0012, 0.0006, 0.0002, 0.0001), M("goldPolish"), "PlaqueEngrave", [
    0,
    0.036,
    VAULT_D / 2 + 0.0019,
  ]);

  // ---- lid + hinge ---------------------------------------------------------
  const hinge = new THREE.Group();
  hinge.name = "HingeSystem";
  hinge.position.set(0, HINGE_Y, HINGE_Z);
  group.add(hinge);

  const lid = new THREE.Group();
  lid.name = "Lid";
  hinge.add(lid);
  // Every lid part is offset forward by half the depth inside the hinge group, so rotating the
  // group swings the lid about its own rear edge.
  const lz = VAULT_D / 2 - 0.006;

  put(lid, bin.slab(VAULT_W, VAULT_D, LID_H, 0.016, 0.006), M("lacquer"), "LidShell", [0, LID_H / 2, lz]).castShadow =
    true;
  put(lid, bin.slab(IW - 0.004, ID - 0.004, 0.004, 0.008, 0.0015), M("leather"), "LidLiner", [0, 0.0015, lz]);
  put(lid, bin.slab(IW + 0.004, ID + 0.004, 0.0014, 0.008, 0.0005), M("goldBrush"), "LidLinerFrame", [
    0,
    0.0032,
    lz,
  ]);

  // A double gold border on the lid crown — an outer polished frame and an inner brushed one.
  const lidTop = LID_H + 0.0004;
  const lidFrame = (w: number, d: number, t: number, matKey: string, nm: string) => {
    put(lid, bin.slab(w, t, 0.0011, 0.0004, 0.0002), M(matKey), `${nm}N`, [0, lidTop, lz - d / 2]);
    put(lid, bin.slab(w, t, 0.0011, 0.0004, 0.0002), M(matKey), `${nm}S`, [0, lidTop, lz + d / 2]);
    put(lid, bin.slab(t, d, 0.0011, 0.0004, 0.0002), M(matKey), `${nm}W`, [-w / 2, lidTop, lz]);
    put(lid, bin.slab(t, d, 0.0011, 0.0004, 0.0002), M(matKey), `${nm}E`, [w / 2, lidTop, lz]);
  };
  lidFrame(VAULT_W - 0.028, VAULT_D - 0.028, 0.0018, "goldPolish", "LidBorderOuter");
  lidFrame(VAULT_W - 0.044, VAULT_D - 0.044, 0.0009, "goldBrush", "LidBorderInner");

  // Art-deco stepped corners: three shortening bars at each corner. This is the ornament that
  // dates the case — a 1930s jewellery-house motif, and the clearest signal that this tier is
  // meant to read as heritage luxury rather than as the Archive's machined modernity.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const l = 0.02 - k * 0.006;
        put(lid, bin.slab(l, 0.0009, 0.0009, 0.0003, 0.0002), M("goldPolish"), "DecoStepX", [
          sx * ((VAULT_W - 0.044) / 2 - l / 2 - 0.0015),
          lidTop,
          lz + sz * ((VAULT_D - 0.044) / 2 - 0.006 - k * 0.0055),
        ]);
      }
    }
  }

  // ---- emblem --------------------------------------------------------------
  // Two concentric rings, a rotated diamond with a dark core, and eight radiating rays.
  const emblem = new THREE.Group();
  emblem.name = "Emblem";
  emblem.position.set(0, lidTop - 0.0002, lz);
  lid.add(emblem);

  put(emblem, bin.torus(0.026, 0.00075, 10, 96), M("goldPolish"), "EmblemRingOuter", [0, 0.0008, 0], [
    Math.PI / 2,
    0,
    0,
  ]);
  put(emblem, bin.torus(0.0185, 0.00045, 10, 84), M("goldBrush"), "EmblemRingInner", [0, 0.0008, 0], [
    Math.PI / 2,
    0,
    0,
  ]);
  put(emblem, bin.slab(0.011, 0.011, 0.0011, 0.0008, 0.0004), M("goldPolish"), "EmblemDiamond", [0, 0.0009, 0], [
    0,
    Math.PI / 4,
    0,
  ]);
  put(emblem, bin.slab(0.0045, 0.0045, 0.0013, 0.0003, 0.0002), M("lacquerEdge"), "EmblemCore", [0, 0.0013, 0], [
    0,
    Math.PI / 4,
    0,
  ]);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    put(emblem, bin.slab(0.0055, 0.0007, 0.0007, 0.0002, 0.0001), M("goldPolish"), `EmblemRay${i}`, [
      Math.sin(a) * 0.0225,
      0.0008,
      Math.cos(a) * 0.0225,
    ], [0, a, 0]);
  }

  // ---- interior ------------------------------------------------------------
  const interior = new THREE.Group();
  interior.name = "Interior";
  group.add(interior);

  const vel = new THREE.Group();
  vel.name = "VelvetLining";
  interior.add(vel);

  put(vel, bin.slab(IW, ID, 0.004, 0.004, 0.0012), M("velvet"), "VelvetFloor", [0, FLOOR_Y + 0.002, 0]).receiveShadow =
    true;
  const linH = VAULT_H - FLOOR_Y - 0.004;
  // Back wall black, the other three wine — the design's own asymmetry, which gives the interior a
  // sense of depth (the far wall recedes, the near ones catch light).
  put(vel, bin.slab(IW, 0.004, linH, 0.002, 0.001), M("velvet"), "VelvetWallBack", [
    0,
    FLOOR_Y + 0.004 + linH / 2,
    -ID / 2 + 0.002,
  ]);
  put(vel, bin.slab(IW, 0.004, linH, 0.002, 0.001), M("velvetWine"), "VelvetWallFront", [
    0,
    FLOOR_Y + 0.004 + linH / 2,
    ID / 2 - 0.002,
  ]);
  put(vel, bin.slab(0.004, ID - 0.008, linH, 0.002, 0.001), M("velvetWine"), "VelvetWallLeft", [
    -IW / 2 + 0.002,
    FLOOR_Y + 0.004 + linH / 2,
    0,
  ]);
  put(vel, bin.slab(0.004, ID - 0.008, linH, 0.002, 0.001), M("velvetWine"), "VelvetWallRight", [
    IW / 2 - 0.002,
    FLOOR_Y + 0.004 + linH / 2,
    0,
  ]);

  // Gold trim capping the interior rim.
  const trim = new THREE.Group();
  trim.name = "GoldInteriorTrim";
  interior.add(trim);
  put(trim, bin.slab(IW + 0.006, 0.0035, 0.0022, 0.0008, 0.0004), M("goldBrush"), "TrimBack", [
    0,
    VAULT_H - 0.0018,
    -ID / 2,
  ]);
  put(trim, bin.slab(IW + 0.006, 0.0035, 0.0022, 0.0008, 0.0004), M("goldBrush"), "TrimFront", [
    0,
    VAULT_H - 0.0018,
    ID / 2,
  ]);
  put(trim, bin.slab(0.0035, ID, 0.0022, 0.0008, 0.0004), M("goldBrush"), "TrimLeft", [
    -IW / 2,
    VAULT_H - 0.0018,
    0,
  ]);
  put(trim, bin.slab(0.0035, ID, 0.0022, 0.0008, 0.0004), M("goldBrush"), "TrimRight", [
    IW / 2,
    VAULT_H - 0.0018,
    0,
  ]);

  // Two recessed side compartments, gold-lined with a felt insert — the detail that makes this a
  // delivery case (room for papers and a spare strap) rather than a single-watch box.
  for (const sx of [-1, 1]) {
    const comp = new THREE.Group();
    comp.name = "Compartment";
    comp.position.set(sx * 0.118, 0, 0);
    interior.add(comp);
    put(comp, bin.slab(0.05, 0.16, 0.0018, 0.004, 0.0006), M("goldBrush"), "CompartmentLining", [
      0,
      FLOOR_Y + 0.0045,
      0,
    ]);
    put(comp, bin.slab(0.044, 0.154, 0.0016, 0.004, 0.0005), M("velvet"), "CompartmentFelt", [
      0,
      FLOOR_Y + 0.0058,
      0,
    ]);
    put(comp, bin.slab(0.052, 0.164, 0.0012, 0.004, 0.0004), M("goldPolish"), "CompartmentEdge", [
      0,
      FLOOR_Y + 0.0038,
      0,
    ]);
  }

  // ---- platform / cushion / anchor ----------------------------------------
  const platform = new THREE.Group();
  platform.name = "WatchPlatform";
  platform.position.set(0, FLOOR_Y + 0.004, 0);
  interior.add(platform);

  put(platform, bin.slab(0.124, 0.104, 0.006, 0.006, 0.002), M("goldBrush"), "PlatformPlate", [0, 0.003, 0]);
  put(platform, bin.slab(0.118, 0.098, 0.0032, 0.006, 0.001), M("goldPolish"), "PlatformEdge", [0, 0.0068, 0]);
  // Two columns hinting at a scissor lift beneath the plate.
  for (const sx of [-1, 1]) {
    put(platform, bin.cyl(0.0022, 0.0022, 0.03, 16), M("steelBrush"), "LiftColumn", [sx * 0.055, -0.012, 0]);
  }

  const cushion = new THREE.Group();
  cushion.name = "PresentationCushion";
  cushion.position.y = CUSHION_Y0;
  platform.add(cushion);

  put(cushion, bin.slab(0.105, 0.086, 0.026, 0.013, 0.007), M("velvet"), "CushionBody", [0, 0.013, 0]).receiveShadow =
    true;
  put(cushion, bin.slab(0.099, 0.08, 0.0026, 0.011, 0.0008), M("velvetWine"), "CushionWelt", [0, 0.0268, 0]);
  // The bolster the bracelet wraps — a cylinder lying along X.
  const bolster = put(cushion, bin.cyl(0.017, 0.017, 0.082, 44), M("velvet"), "CushionBolster", [0, 0.038, 0]);
  bolster.rotation.z = Math.PI / 2;
  bolster.receiveShadow = true;

  const anchor = new THREE.Group();
  anchor.name = "WatchAnchor";
  anchor.position.set(0, 0.038, 0);
  cushion.add(anchor);

  return {
    group,
    hinge,
    cushion,
    anchor,
    interior,
    dispose: () => bin.dispose(),
  };
}
