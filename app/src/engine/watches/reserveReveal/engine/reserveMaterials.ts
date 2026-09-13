// The Reserve's material palette — ported from the design handoff's own `M` table
// (heritage-case-watch-reveal/project/heritage-case.js, lines 111-155) plus the per-watch
// materials from `watch-builder.js` (lines 171-180).
//
// Same shared-instance discipline as the Archive's palette: ~20 material instances shared across
// several hundred meshes, never cloned per mesh, because three.js keys shader programs by material
// and per-mesh clones are the fastest way to turn this scene into a compile stall on a phone. The
// one sanctioned exception is per-item tinting (`cloneTinted`).
//
// THREE DELIBERATE DEPARTURES FROM THE SOURCE, EACH A MOBILE-GL COST DECISION
//
// 1. `clearcoat` on the walnut (source: 0.85). Kept. Clearcoat is what makes a lacquered
//    presentation case look lacquered rather than like matte timber, it is the single most
//    identity-defining property in this palette, and `MeshPhysicalMaterial`'s clearcoat is a
//    per-material shader feature — it costs one extra lobe in the lighting loop for the meshes
//    that use it, not a scene-wide pass. Affordable, and load-bearing.
//
// 2. `sheen` on the velvet (source: 0.8). Kept, for the same shape of reason: sheen is exactly the
//    retroreflective rim-brightening that makes velvet read as velvet, and it applies only to the
//    lining meshes.
//
// 3. `transmission: 0.94` on the crystal (source). DROPPED, replaced by a faint dark tint with
//    low opacity. This is the one that genuinely cannot be afforded: transmission forces the
//    renderer to resolve a copy of the scene's back-buffer for every transmissive object so it can
//    refract what is behind it — a full extra render target and pass, not a shader lobe. The
//    Archive's own sapphire took the same approach (its design source had already made that
//    choice), and a watch crystal reads correctly as a faint dark sheen plus the moving glint
//    highlight, which is what the eye actually uses to identify glass.
import * as THREE from "three";
import { grainTexture, emblemTexture } from "../art/reserveTextures";

/** Every material key the Reserve's builders may name. Closed union so a typo is a compile error
 * rather than a silently-black mesh. */
export type ReserveMaterialKey =
  // --- presentation case ---
  | "walnut"
  | "brass"
  | "brassDark"
  | "velvet"
  | "velvetCream"
  | "leather"
  | "thread"
  | "emblem"
  // --- watch ---
  | "steel"
  | "steelBrushed"
  | "crystal"
  | "dial"
  | "gold"
  | "hand"
  | "lume"
  | "index"
  | "strapLeather";

export type ReservePalette = Record<ReserveMaterialKey, THREE.Material>;

export interface ReservePaletteHandle {
  palette: ReservePalette;
  /** Releases every material AND the two baked textures the case materials own. */
  dispose: () => void;
}

/**
 * Builds the palette. Once per scene mount, disposed with the scene.
 *
 * A factory rather than module-level singletons because the choreography mutates material state
 * (the Reserve animates nothing emissive, unlike the Archive, but the per-item dial clone and the
 * glint's opacity are both per-mount), and because the two baked textures inside are real GPU
 * allocations whose lifetime must match the scene's.
 */
export function createReservePalette(): ReservePaletteHandle {
  const grain = grainTexture();
  const emblemMap = emblemTexture();

  const walnut = new THREE.MeshPhysicalMaterial({
    name: "walnut_lacquer",
    color: 0x4b2a1e,
    map: grain,
    roughness: 0.34,
    metalness: 0.04,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  });

  const brass = new THREE.MeshStandardMaterial({
    name: "brushed_brass",
    color: 0xb9924f,
    roughness: 0.32,
    metalness: 1.0,
  });

  const brassDark = new THREE.MeshStandardMaterial({
    name: "aged_brass",
    color: 0x8a6c39,
    roughness: 0.5,
    metalness: 0.95,
  });

  const velvet = new THREE.MeshPhysicalMaterial({
    name: "burgundy_velvet",
    color: 0x33101a,
    roughness: 0.98,
    metalness: 0,
    sheen: 0.8,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(0x50131f),
  });

  const velvetCream = new THREE.MeshPhysicalMaterial({
    name: "cream_velvet",
    color: 0x3a1220,
    roughness: 0.98,
    metalness: 0,
    sheen: 0.75,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(0x5a1927),
  });

  const leather = new THREE.MeshPhysicalMaterial({
    name: "stitched_leather",
    color: 0x1f110c,
    roughness: 0.88,
    metalness: 0.02,
    sheen: 0.25,
    sheenColor: new THREE.Color(0x5a3a28),
    envMapIntensity: 0.4,
  });

  const thread = new THREE.MeshStandardMaterial({
    name: "thread",
    color: 0x9c8a6a,
    roughness: 0.9,
    envMapIntensity: 0.4,
  });

  const emblem = new THREE.MeshStandardMaterial({
    name: "engraved_brass_plate",
    color: 0xffffff,
    map: emblemMap,
    roughness: 0.34,
    metalness: 0.95,
  });

  const steel = new THREE.MeshStandardMaterial({
    name: "polished_steel",
    color: 0xd6dade,
    roughness: 0.14,
    metalness: 1.0,
  });

  const steelBrushed = new THREE.MeshStandardMaterial({
    name: "brushed_steel",
    color: 0xc4cace,
    roughness: 0.3,
    metalness: 0.9,
  });

  // See departure 3 in the header: the source's transmission/ior/thickness are replaced by a
  // faint tinted transparency. `depthWrite: false` so the dial and hands behind it are never
  // depth-rejected — a crystal that occludes its own dial is the classic giveaway of a fake
  // watch render.
  const crystal = new THREE.MeshPhysicalMaterial({
    name: "sapphire_crystal",
    color: 0xdfe7ee,
    roughness: 0.02,
    metalness: 0,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  });

  const dial = new THREE.MeshStandardMaterial({
    name: "lacquer_dial",
    color: 0xcfc6b2,
    roughness: 0.36,
    metalness: 0.08,
  });

  const gold = new THREE.MeshStandardMaterial({
    name: "yellow_gold",
    color: 0xc9a44c,
    roughness: 0.2,
    metalness: 1.0,
  });

  // From watch-builder.js's own per-watch MAT table.
  const hand = new THREE.MeshStandardMaterial({
    name: "hand_metal",
    color: 0xe7e9ea,
    roughness: 0.18,
    metalness: 1,
    envMapIntensity: 0.8,
  });

  // Lume genuinely emits rather than reflects, so this emissive is physical — not the kind of
  // emissive-as-brightness-hack the previous tier-1 build used to compensate for a missing
  // environment.
  const lume = new THREE.MeshStandardMaterial({
    name: "lume",
    color: 0xd8d2b4,
    roughness: 0.75,
    emissive: 0x2a2a18,
    metalness: 0,
  });

  const index = new THREE.MeshStandardMaterial({
    name: "applied_index",
    color: 0xe3e6e8,
    roughness: 0.2,
    metalness: 1,
    envMapIntensity: 0.9,
  });

  const strapLeather = new THREE.MeshPhysicalMaterial({
    name: "strap_leather",
    color: 0x38211a,
    roughness: 0.74,
    metalness: 0.02,
    sheen: 0.35,
    sheenColor: new THREE.Color(0x8a6045),
  });

  const palette: ReservePalette = {
    walnut,
    brass,
    brassDark,
    velvet,
    velvetCream,
    leather,
    thread,
    emblem,
    steel,
    steelBrushed,
    crystal,
    dial,
    gold,
    hand,
    lume,
    index,
    strapLeather,
  };

  return {
    palette,
    dispose: () => {
      for (const key of Object.keys(palette) as ReserveMaterialKey[]) palette[key].dispose();
      grain.dispose();
      emblemMap.dispose();
    },
  };
}

/** Clones one palette material and re-tints it, for per-item personalisation. The caller owns the
 * clone and must register it for disposal. */
export function cloneTinted(source: THREE.Material, color: THREE.Color): THREE.Material {
  const clone = source.clone() as THREE.MeshStandardMaterial;
  clone.color = color.clone();
  clone.name = `${source.name}_tinted`;
  return clone;
}

/** Attaches a baked map to a clone of a palette material — used for the dial, whose art is
 * per-watch (archetype, subdials, date window) and so cannot live on a shared instance. */
export function cloneWithMap(source: THREE.Material, map: THREE.Texture): THREE.Material {
  const clone = source.clone() as THREE.MeshStandardMaterial;
  // White base colour so the baked art shows its own colours rather than being multiplied by the
  // palette default's cream tint.
  clone.color = new THREE.Color(0xffffff);
  clone.map = map;
  clone.name = `${source.name}_mapped`;
  return clone;
}

export function reserveMaterialFor(palette: ReservePalette, key: string): THREE.Material {
  const hit = (palette as Record<string, THREE.Material | undefined>)[key];
  if (!hit) throw new Error(`[grailhaus] unknown reserve material key: ${key}`);
  return hit;
}
