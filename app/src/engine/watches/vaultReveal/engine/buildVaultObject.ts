// The Collector's Vault body — ported from the design handoff's own vault construction
// (the-collector-s-vault/project/vault.js, lines 39-168). Every dimension below is in metres at
// true scale, exactly as the source models it: a 260mm x 200mm case, 70mm deep body, 52mm lid.
//
// WHAT THIS FILE OWNS, AND WHAT THE CHOREOGRAPHY OWNS
//
// This builds a vault posed *closed* and returns handles to the four things that move: the lid,
// the elevating platform, and the lock bolts (as groups, plus their pins separately, because the
// bolts both retract and twist). It sets no animated value itself — `pose(t)` in the choreography
// is the single source of truth for where everything sits at a given instant, and it is a pure
// function of `t`, so the resting state this file leaves behind is immediately overwritten by
// `pose(0)` on the first frame. That split is deliberate: it means a scrubbed drag and a played
// sequence cannot disagree about the vault's shape.
//
// ON MESH COUNT
//
// This is ~90 meshes. That is a lot, and it is the design's own structure rather than an
// embellishment I added — the walls, linings, rim, chamfer frame and seam lights are four meshes
// each because a box cannot be a hollow shell. They all share the small palette in
// ./vaultMaterials.ts, which is what keeps the shader-program count in single digits. The repeated
// furniture that genuinely warrants instancing lives in the watch builder (bezel teeth, strap
// links), not here.
import * as THREE from "three";
import { materialFor, type VaultPalette } from "./vaultMaterials";

/** Exterior footprint and structural dimensions — source lines 40-44. */
export const VAULT_W = 0.26;
export const VAULT_D = 0.2;
const WALL = 0.017;
const BODY_H = 0.07;
const PLINTH_H = 0.01;
/** The lid/body parting line. Everything about the seam — rim, lights, bolts — keys off this. */
export const SEAM_Y = PLINTH_H + BODY_H; // 0.080
const LID_H = 0.052;

/** Platform resting height and total lift, from the choreography's own constants (source line
 * 546). Exported because `pose` needs them and they describe geometry, not timing. */
export const PLATFORM_Y0 = 0.018;
export const PLATFORM_LIFT = 0.078;

/**
 * The bolts' closed X offset from the case centre, and how far they retract. The source computes
 * the retraction inline in `pose` (`W / 2 - 0.004 - 0.0155 * draw`); split out here so the
 * geometry's resting position and the animation's travel cannot drift apart.
 */
export const BOLT_X_CLOSED = VAULT_W / 2 - 0.004;
export const BOLT_DRAW = 0.0155;

/** Lid closed pose, and its travel — the lid lifts slightly and back before tilting open, so it
 * clears the rim rather than scraping through it. Source lines 576-580. */
export const LID_CLOSED_Y = SEAM_Y;
export const LID_CLOSED_Z = -VAULT_D / 2;
export const LID_RISE = 0.0215;
export const LID_SLIDE = 0.0035;
export const LID_TILT = 1.235;

export interface VaultObject {
  /** The whole vault, to add to the scene. */
  group: THREE.Group;
  /** Hinged at the rear edge — the choreography lifts, slides and tilts this. */
  lid: THREE.Group;
  /** Rises to present the watch; carries the telescoping column with it. */
  platform: THREE.Group;
  /** The four lock bolts — these retract outward along X. */
  boltGroups: THREE.Group[];
  /** Each bolt's pin, which twists a quarter turn before the bolt draws back. Separate handles
   * because the two motions overlap rather than sequence. */
  boltPins: THREE.Mesh[];
  dispose(): void;
}

export function buildVaultObject(palette: VaultPalette): VaultObject {
  const M = (key: string) => materialFor(palette, key);
  const disposeGeo: THREE.BufferGeometry[] = [];

  // Geometry helpers mirroring the source's own `box`/`cyl`/`put` shorthands, with every created
  // geometry registered for disposal. Materials are never created here — they come from the shared
  // palette, which owns its own disposal.
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
  const torus = (r: number, t: number, rs: number, ts: number, arc?: number) => {
    const g = new THREE.TorusGeometry(r, t, rs, ts, arc);
    disposeGeo.push(g);
    return g;
  };
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

  const group = new THREE.Group();
  group.name = "grailhaus_vault";

  // ---- body ------------------------------------------------------------------
  const body = new THREE.Group();
  body.name = "vault_body";
  group.add(body);

  put(body, box(VAULT_W - 0.01, PLINTH_H, VAULT_D - 0.01), M("gunmetal"), "machined_plinth", [0, PLINTH_H / 2, 0]);
  put(body, box(VAULT_W - 0.03, 0.004, VAULT_D - 0.03), M("forged"), "plinth_recess", [0, PLINTH_H + 0.0005, 0]);

  // Hollow shell: four walls plus a floor. A single box would have no interior for the lid to
  // reveal, and the alcantara lining below sits just inside these.
  const wy = PLINTH_H + BODY_H / 2;
  put(body, box(VAULT_W, BODY_H, WALL), M("lacquer"), "shell_wall_front", [0, wy, VAULT_D / 2 - WALL / 2]);
  put(body, box(VAULT_W, BODY_H, WALL), M("lacquer"), "shell_wall_back", [0, wy, -VAULT_D / 2 + WALL / 2]);
  put(body, box(WALL, BODY_H, VAULT_D - WALL * 2), M("lacquer"), "shell_wall_right", [VAULT_W / 2 - WALL / 2, wy, 0]);
  put(body, box(WALL, BODY_H, VAULT_D - WALL * 2), M("lacquer"), "shell_wall_left", [-VAULT_W / 2 + WALL / 2, wy, 0]);
  put(body, box(VAULT_W - WALL * 2, 0.01, VAULT_D - WALL * 2), M("lacquer"), "shell_floor", [0, PLINTH_H + 0.005, 0]);

  // Forged-composite inlays, standing a fraction proud of each outer face.
  put(body, box(VAULT_W - 0.072, BODY_H - 0.024, 0.0022), M("forged"), "inlay_front", [0, wy, VAULT_D / 2 + 0.0002]);
  put(body, box(VAULT_W - 0.072, BODY_H - 0.024, 0.0022), M("forged"), "inlay_back", [0, wy, -VAULT_D / 2 - 0.0002]);
  put(body, box(0.0022, BODY_H - 0.024, VAULT_D - 0.072), M("forged"), "inlay_right", [VAULT_W / 2 + 0.0002, wy, 0]);
  put(body, box(0.0022, BODY_H - 0.024, VAULT_D - 0.072), M("forged"), "inlay_left", [-VAULT_W / 2 - 0.0002, wy, 0]);

  // Titanium rim frame at the seam — the bright line that reads as the vault's parting plane.
  const rimY = SEAM_Y - 0.0035;
  put(body, box(VAULT_W + 0.0015, 0.007, 0.012), M("titanium"), "rim_front", [0, rimY, VAULT_D / 2 - 0.006]);
  put(body, box(VAULT_W + 0.0015, 0.007, 0.012), M("titanium"), "rim_back", [0, rimY, -VAULT_D / 2 + 0.006]);
  put(body, box(0.012, 0.007, VAULT_D - 0.024), M("titanium"), "rim_right", [VAULT_W / 2 - 0.006, rimY, 0]);
  put(body, box(0.012, 0.007, VAULT_D - 0.024), M("titanium"), "rim_left", [-VAULT_W / 2 + 0.006, rimY, 0]);

  // Seam light: a thin emissive frame just under the lid. Starts dark (the material's own
  // emissiveIntensity is 0) and is driven up by the choreography as the locks disengage.
  const sy = SEAM_Y + 0.0008;
  put(body, box(VAULT_W - 0.004, 0.0016, 0.003), M("seam"), "seam_light_front", [0, sy, VAULT_D / 2 - 0.004]);
  put(body, box(VAULT_W - 0.004, 0.0016, 0.003), M("seam"), "seam_light_back", [0, sy, -VAULT_D / 2 + 0.004]);
  put(body, box(0.003, 0.0016, VAULT_D - 0.012), M("seam"), "seam_light_right", [VAULT_W / 2 - 0.004, sy, 0]);
  put(body, box(0.003, 0.0016, VAULT_D - 0.012), M("seam"), "seam_light_left", [-VAULT_W / 2 + 0.004, sy, 0]);

  // Alcantara interior lining — floor pad plus four walls.
  put(body, box(VAULT_W - 0.046, 0.004, VAULT_D - 0.046), M("alcantara"), "interior_floor_pad", [0, PLINTH_H + 0.012, 0]);
  put(body, box(VAULT_W - 0.046, 0.044, 0.003), M("alcantara"), "liner_front", [0, PLINTH_H + 0.036, VAULT_D / 2 - WALL - 0.002]);
  put(body, box(VAULT_W - 0.046, 0.044, 0.003), M("alcantara"), "liner_back", [0, PLINTH_H + 0.036, -VAULT_D / 2 + WALL + 0.002]);
  put(body, box(0.003, 0.044, VAULT_D - 0.052), M("alcantara"), "liner_right", [VAULT_W / 2 - WALL - 0.002, PLINTH_H + 0.036, 0]);
  put(body, box(0.003, 0.044, VAULT_D - 0.052), M("alcantara"), "liner_left", [-VAULT_W / 2 + WALL + 0.002, PLINTH_H + 0.036, 0]);

  // Machined interior architecture: two buttresses flanking the platform well, each capped, each
  // carrying an inward-facing illumination strip that comes up during "Interior Activation".
  [-1, 1].forEach((s, i) => {
    const side = i ? "r" : "l";
    put(body, box(0.03, 0.03, VAULT_D - 0.06), M("gunmetal"), `interior_buttress_${side}`, [s * 0.086, PLINTH_H + 0.029, 0]);
    put(body, box(0.022, 0.0025, VAULT_D - 0.076), M("forged"), `buttress_cap_${side}`, [s * 0.086, PLINTH_H + 0.0445, 0]);
    put(body, box(0.0025, 0.006, VAULT_D - 0.09), M("strip"), `interior_strip_${side}`, [s * 0.0705, PLINTH_H + 0.04, 0]);
  });

  // ---- lock bolts (four, machined, in the seam) -------------------------------
  // Each bolt is a group so the choreography can slide the whole assembly outward, with the pin as
  // a child so its quarter-turn twist composes with that slide rather than fighting it.
  const boltGroups: THREE.Group[] = [];
  const boltPins: THREE.Mesh[] = [];
  const boltLayout: [number, number][] = [
    [1, 0.058],
    [1, -0.058],
    [-1, 0.058],
    [-1, -0.058],
  ];
  boltLayout.forEach(([sx, z], i) => {
    const g = new THREE.Group();
    g.name = `lock_bolt_${i}`;
    g.position.set(sx * BOLT_X_CLOSED, SEAM_Y - 0.0035, z);
    g.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;

    const pin = new THREE.Mesh(cyl(0.0042, 0.0042, 0.012, 24), M("titanium"));
    pin.name = `lock_pin_${i}`;
    pin.position.y = 0.0045;
    g.add(pin);

    // The key rides the pin, so it visibly rotates with the twist — this is the detail that makes
    // the bolt read as unlocking rather than merely sliding.
    const key = new THREE.Mesh(box(0.0095, 0.0022, 0.0022), M("gunmetal"));
    key.name = `lock_key_${i}`;
    key.position.y = 0.0035;
    pin.add(key);

    put(g, cyl(0.0062, 0.0062, 0.0025, 24), M("gunmetal"), `lock_flange_${i}`, [0, 0.0005, 0]);
    body.add(g);
    boltGroups.push(g);
    boltPins.push(pin);
  });

  // ---- lid (pivots at the rear edge) -----------------------------------------
  // The group sits on the hinge line and the shell is offset forward inside it by half the depth,
  // so rotating the group swings the lid about its own back edge — the same offset-mesh-inside-a-
  // hinged-group approach the tier-1 watch case and the handbag flap both use.
  const lid = new THREE.Group();
  lid.name = "lid_assembly";
  lid.position.set(0, LID_CLOSED_Y, LID_CLOSED_Z);
  group.add(lid);
  const lz = VAULT_D / 2;

  put(lid, box(VAULT_W, LID_H, VAULT_D), M("lacquer"), "lid_shell", [0, LID_H / 2, lz]);
  put(lid, box(VAULT_W - 0.026, 0.0035, VAULT_D - 0.026), M("forged"), "lid_top_panel", [0, LID_H + 0.0005, lz]);
  put(lid, box(VAULT_W - 0.062, 0.0018, VAULT_D - 0.062), M("forged"), "lid_top_recess", [0, LID_H + 0.0026, lz]);

  // Titanium chamfer frame on the lid crown.
  put(lid, box(VAULT_W - 0.006, 0.0035, 0.013), M("titanium"), "lid_chamfer_front", [0, LID_H - 0.0008, lz + VAULT_D / 2 - 0.0075]);
  put(lid, box(VAULT_W - 0.006, 0.0035, 0.013), M("titanium"), "lid_chamfer_back", [0, LID_H - 0.0008, lz - VAULT_D / 2 + 0.0075]);
  put(lid, box(0.013, 0.0035, VAULT_D - 0.032), M("titanium"), "lid_chamfer_right", [VAULT_W / 2 - 0.0075, LID_H - 0.0008, lz]);
  put(lid, box(0.013, 0.0035, VAULT_D - 0.032), M("titanium"), "lid_chamfer_left", [-VAULT_W / 2 + 0.0075, LID_H - 0.0008, lz]);

  put(lid, box(VAULT_W - 0.036, 0.005, VAULT_D - 0.036), M("alcantara"), "lid_liner", [0, 0.0064, lz]);

  // Sockets the bolts withdraw from, mirrored from each bolt's own closed position.
  boltGroups.forEach((g, i) => {
    put(
      lid,
      cyl(0.0068, 0.0068, 0.006, 20),
      M("gunmetal"),
      `lock_socket_${i}`,
      [g.position.x, 0.004, lz + g.position.z],
      [0, 0, g.position.x > 0 ? -Math.PI / 2 : Math.PI / 2]
    );
  });

  // Illuminated emblem on the lid crown — two concentric rings, a keystone and an axis bar. Lit
  // via the shared `emblem` material, which the choreography drives (it glows as the vault wakes,
  // dims as the lid opens, then returns for the rarity moment).
  const emblem = new THREE.Group();
  emblem.name = "grailhaus_emblem";
  emblem.position.set(0, LID_H + 0.0036, lz);
  lid.add(emblem);
  put(emblem, torus(0.0195, 0.0011, 12, 64), M("emblem"), "emblem_ring", [0, 0, 0], [Math.PI / 2, 0, 0]);
  put(emblem, torus(0.0128, 0.0007, 10, 48), M("emblem"), "emblem_ring_inner", [0, 0, 0], [Math.PI / 2, 0, 0]);
  put(emblem, box(0.0085, 0.0012, 0.0085), M("emblem"), "emblem_keystone", [0, 0, 0], [0, Math.PI / 4, 0]);
  put(emblem, box(0.0016, 0.0012, 0.026), M("titanium"), "emblem_axis", [0, -0.0002, 0]);

  // Latch tongue on the body's front face (the source puts this on the body, not the lid).
  put(body, box(0.026, 0.012, 0.0035), M("gunmetal"), "latch_base", [0, SEAM_Y - 0.008, VAULT_D / 2 + 0.0012]);

  // ---- elevating platform -----------------------------------------------------
  // A separate child of the root rather than of the body, because it travels vertically past the
  // seam during "Platform Elevation" and must not inherit the body's static transform.
  const platform = new THREE.Group();
  platform.name = "watch_platform";
  platform.position.set(0, PLATFORM_Y0, 0);
  group.add(platform);

  put(platform, cyl(0.056, 0.06, 0.013, 64), M("gunmetal"), "platform_disc", [0, 0, 0]);
  put(platform, torus(0.0575, 0.0016, 12, 72), M("titanium"), "platform_ring", [0, 0.0068, 0], [Math.PI / 2, 0, 0]);
  put(platform, cyl(0.0525, 0.0525, 0.0035, 64), M("alcantara"), "platform_pad", [0, 0.008, 0]);
  put(platform, cyl(0.0125, 0.0142, 0.042, 48), M("alcantara"), "presentation_post", [0, 0.0308, 0]);
  put(platform, cyl(0.0148, 0.0148, 0.0022, 48), M("titanium"), "post_collar", [0, 0.0518, 0]);
  // Telescoping column beneath, revealed as the platform rises out of the well.
  put(platform, cyl(0.024, 0.024, 0.07, 32), M("gunmetal"), "lift_column_outer", [0, -0.042, 0]);
  put(platform, cyl(0.014, 0.014, 0.09, 24), M("titanium"), "lift_column_inner", [0, -0.06, 0]);

  return {
    group,
    lid,
    platform,
    boltGroups,
    boltPins,
    dispose: () => {
      for (const g of disposeGeo) g.dispose();
    },
  };
}
