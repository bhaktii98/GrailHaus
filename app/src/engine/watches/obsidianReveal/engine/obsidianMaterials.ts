// The Obsidian Vault's material palette — ported from the design's own `M` table
// (the-obsidian-vault/project/apex-vault.html, lines 200-221) plus the per-reference watch
// materials built in `buildWatch` (lines 440-451).
//
// Same shared-instance discipline as the other two tiers: a small set of materials shared across
// several hundred meshes, never cloned per mesh. The exception is the five APEX references, whose
// whole point is that they differ — those get per-mount clones, disposed with the scene.
//
// WHAT MAKES THIS TIER'S MATERIALS DIFFERENT
//
// `clearcoat: 1` on the obsidian lacquer, with `clearcoatRoughness: .045`. That is a mirror-finish
// piano lacquer, and it is the single most identity-defining value in the file — the tier is named
// for it. Kept at full strength for the same reason the Reserve's walnut clearcoat was: it is a
// per-material shader feature, not a scene pass, and the surface is meaningless without it.
//
// `envMapIntensity` is used aggressively and unevenly here (steel at 2.4, gold at 1.5, velvet at
// .16, dial at .30). That spread is how the design separates materials that would otherwise all be
// dark: a black dial at .30 stays black while polished steel beside it at 2.4 blazes. Porting those
// values individually rather than normalising them is most of why this reads as five different
// materials rather than one grey.
//
// The crystal drops the design's `ior: 1.77` refraction the same way both other tiers did — see
// ../../reserveReveal/engine/reserveMaterials.ts for the full reasoning on why transmission-style
// refraction is the one physical property that cannot be afforded here. `clearcoat: 1` is kept,
// which is what preserves the hard glassy edge highlight.
import * as THREE from "three";

export type ObsidianMaterialKey =
  // --- vault ---
  | "lacquer"
  | "lacquerEdge"
  | "goldPolish"
  | "goldBrush"
  | "velvet"
  | "velvetWine"
  | "leather"
  | "silk"
  | "steel"
  | "steelBrush"
  | "dial"
  | "crystal"
  | "goldApplied"
  | "floor";

export type ObsidianPalette = Record<ObsidianMaterialKey, THREE.Material>;

export interface ObsidianPaletteHandle {
  palette: ObsidianPalette;
  dispose: () => void;
}

export function createObsidianPalette(): ObsidianPaletteHandle {
  const palette: ObsidianPalette = {
    // The tier's namesake: a mirror clearcoat over near-black. Everything visible on this surface
    // is a reflection of the environment, which is why ../art/obsidianEnv.ts is built the way it
    // is (one hard bright source on a very dark ground).
    lacquer: new THREE.MeshPhysicalMaterial({
      name: "obsidian_lacquer",
      color: 0x07070a,
      roughness: 0.13,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.045,
      envMapIntensity: 1.15,
    }),
    // A slightly duller variant for edges and the plinth, so the silhouette does not read as one
    // continuous mirror — real lacquered furniture has softer break edges.
    lacquerEdge: new THREE.MeshPhysicalMaterial({
      name: "obsidian_lacquer_edge",
      color: 0x0b0b0e,
      roughness: 0.22,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 0.9,
    }),
    goldPolish: new THREE.MeshStandardMaterial({
      name: "champagne_gold_polished",
      color: 0xc8a86d,
      roughness: 0.14,
      metalness: 1,
      envMapIntensity: 1.5,
    }),
    goldBrush: new THREE.MeshStandardMaterial({
      name: "champagne_gold_brushed",
      color: 0xb1955f,
      roughness: 0.42,
      metalness: 1,
      envMapIntensity: 1.1,
    }),
    // Roughness 1 and envMapIntensity .16: velvet is the one material here that must absorb rather
    // than reflect, and that near-zero env contribution is what makes the interior read as a void
    // the watch sits in rather than as another shiny surface.
    velvet: new THREE.MeshPhysicalMaterial({
      name: "black_velvet",
      color: 0x050404,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.16,
      sheen: 0.5,
      sheenRoughness: 0.9,
      sheenColor: new THREE.Color(0x2b2426),
    }),
    velvetWine: new THREE.MeshStandardMaterial({
      name: "burgundy_velvet",
      color: 0x300a14,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.3,
    }),
    leather: new THREE.MeshStandardMaterial({
      name: "black_leather",
      color: 0x161315,
      roughness: 0.72,
      metalness: 0.05,
      envMapIntensity: 0.5,
    }),
    // The ribbon. DoubleSide is mandatory, not stylistic: the band is a zero-thickness swept strip
    // that twists as it is drawn, so its back face is visible for much of the gesture.
    silk: new THREE.MeshPhysicalMaterial({
      name: "wine_silk_ribbon",
      color: 0x480d1c,
      roughness: 0.56,
      metalness: 0,
      sheen: 0.7,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0x8c4a57),
      side: THREE.DoubleSide,
      envMapIntensity: 0.8,
    }),
    steel: new THREE.MeshStandardMaterial({
      name: "polished_steel",
      color: 0xe8edf1,
      roughness: 0.12,
      metalness: 0.95,
      envMapIntensity: 2.4,
    }),
    steelBrush: new THREE.MeshStandardMaterial({
      name: "brushed_steel",
      color: 0xc2c8ce,
      roughness: 0.34,
      metalness: 0.92,
      envMapIntensity: 1.6,
    }),
    dial: new THREE.MeshStandardMaterial({
      name: "obsidian_dial",
      color: 0x06070b,
      roughness: 0.52,
      metalness: 0.12,
      envMapIntensity: 0.3,
    }),
    crystal: new THREE.MeshPhysicalMaterial({
      name: "sapphire_crystal",
      color: 0xffffff,
      roughness: 0.03,
      metalness: 0,
      transparent: true,
      opacity: 0.13,
      envMapIntensity: 1.1,
      depthWrite: false,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    }),
    goldApplied: new THREE.MeshStandardMaterial({
      name: "applied_gold",
      color: 0xd9bd8a,
      roughness: 0.26,
      metalness: 0.55,
      envMapIntensity: 1.0,
    }),
    floor: new THREE.MeshStandardMaterial({
      name: "studio_floor",
      color: 0x090909,
      roughness: 0.55,
      metalness: 0.15,
      envMapIntensity: 0.35,
    }),
  };

  return {
    palette,
    dispose: () => {
      for (const key of Object.keys(palette) as ObsidianMaterialKey[]) palette[key].dispose();
    },
  };
}

export function obsidianMaterialFor(palette: ObsidianPalette, key: string): THREE.Material {
  const hit = (palette as Record<string, THREE.Material | undefined>)[key];
  if (!hit) throw new Error(`[grailhaus] unknown obsidian material key: ${key}`);
  return hit;
}

/**
 * One APEX reference's own material set.
 *
 * The five references share the entire vault and the entire watch *architecture* — the design's own
 * comment says so: "same vault, same architecture, different metal and dial". So unlike the
 * Reserve (five case constructions) or The Archive (five distinct pieces), this tier's variety is
 * purely material. That is the right call for the top tier: at this price the object should read as
 * one designed piece offered in five finishes, not five different watches.
 *
 * Built per mount and disposed with the scene, since every material here is reference-specific.
 */
export interface ReferenceMaterials {
  metal: THREE.MeshStandardMaterial;
  brush: THREE.MeshStandardMaterial;
  dial: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  /** The bezel ring — gold, the reference's own polished metal, or absent. */
  ring: THREE.Material | null;
  /** Secondary trim: gold brush, the blued accent, or the reference's brushed metal. */
  trim: THREE.Material;
  dispose: () => void;
}

export interface ReferenceSpec {
  id: string;
  metal: { color: number; roughness: number; metalness: number };
  brush: { color: number; roughness: number; metalness: number };
  dial: { color: number; roughness: number; metalness: number };
  accent: "gold" | "noir" | "rhodium";
  ring: "gold" | "steel" | "none";
}

export function createReferenceMaterials(
  spec: ReferenceSpec,
  palette: ObsidianPalette
): ReferenceMaterials {
  const metal = new THREE.MeshStandardMaterial({
    name: `${spec.id}_metal_polished`,
    ...spec.metal,
    envMapIntensity: 2.2,
  });
  const brush = new THREE.MeshStandardMaterial({
    name: `${spec.id}_metal_brushed`,
    ...spec.brush,
    envMapIntensity: 1.5,
  });
  const dial = new THREE.MeshStandardMaterial({
    name: `${spec.id}_dial`,
    ...spec.dial,
    envMapIntensity: 0.35,
  });

  // The accent carries the hands and applied indices, and its three variants are what let a
  // platinum reference read as cool and a gold one as warm without changing any geometry.
  const accent =
    spec.accent === "gold"
      ? new THREE.MeshStandardMaterial({
          name: `${spec.id}_applied_gold`,
          color: 0xd9bd8a,
          roughness: 0.26,
          metalness: 0.55,
          envMapIntensity: 1.0,
        })
      : spec.accent === "noir"
        ? new THREE.MeshStandardMaterial({
            name: `${spec.id}_blued_steel`,
            color: 0x2b3138,
            roughness: 0.22,
            metalness: 0.62,
            envMapIntensity: 1.2,
          })
        : new THREE.MeshStandardMaterial({
            name: `${spec.id}_applied_rhodium`,
            color: 0xe6ebef,
            roughness: 0.2,
            metalness: 0.6,
            envMapIntensity: 1.3,
          });

  // `ring` and `trim` deliberately alias shared or already-created materials rather than cloning,
  // exactly as the design does — which is why the dispose list below holds only the four it owns.
  const ring =
    spec.ring === "gold"
      ? obsidianMaterialFor(palette, "goldPolish")
      : spec.ring === "steel"
        ? metal
        : null;
  const trim =
    spec.accent === "gold"
      ? obsidianMaterialFor(palette, "goldBrush")
      : spec.accent === "noir"
        ? accent
        : brush;

  return {
    metal,
    brush,
    dial,
    accent,
    ring,
    trim,
    dispose: () => {
      metal.dispose();
      brush.dispose();
      dial.dispose();
      accent.dispose();
    },
  };
}
