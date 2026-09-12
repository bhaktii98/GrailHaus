// The vault's shared material palette — ported from the design handoff's own two material blocks
// (the-collector-s-vault/project/vault.js: the vault shell set at lines 13-25, the archetype set
// at lines 171-184). Every colour, roughness, metalness, emissive and side value is the
// designer's.
//
// WHY ONE SHARED PALETTE RATHER THAN PER-MESH MATERIALS
//
// The design source builds a vault out of roughly 90 meshes and each watch out of another ~250,
// and it survives that count because almost every one of those meshes points at one of the ~25
// material instances below. three.js keys its shader programs by material, so N meshes sharing one
// material compile one program and (given the same geometry-less state) batch far better than N
// meshes with N clones would. Cloning per mesh is the single easiest way to turn this scene from
// "heavy but fine" into a shader-compilation stall on a mid-range phone, so the builders below
// always look materials up here and never clone.
//
// The one deliberate exception is per-item tinting (a pulled row's own case metal or dial colour).
// That cannot mutate a shared instance — every other mesh naming it would change too — so the
// builder clones exactly those one or two materials per reveal and registers the clones for
// disposal. See `cloneTinted` at the bottom.
//
// THE ENVIRONMENT IS WHAT MAKES THESE READ AS METAL
//
// Nearly half of these declare `metalness` at or near 1.0. That is only viable because the scene
// supplies a prefiltered environment (see ../art/vaultEnv.ts) — a metalness-1.0 surface with no
// environment reflects nothing and renders near-black, which is exactly the trap the tier-1
// procedural watch fell into and then papered over with emissive floors. Do not add emissive here
// to "brighten" a metal; if a metal looks dark, the environment or its intensity is the thing to
// check.
import * as THREE from "three";

/** Every material key an archetype or builder may name. A closed union rather than `string` so a
 * typo in the archetype table is a compile error, not a silently-black mesh at runtime. */
export type MaterialKey =
  // --- vault shell ---
  | "lacquer"
  | "forged"
  | "titanium"
  | "gunmetal"
  | "alcantara"
  | "steel"
  | "dialSlate"
  | "applied"
  | "sapphire"
  | "goldAcc"
  | "emblem"
  | "seam"
  | "strip"
  // --- archetype metals + dials ---
  | "dlc"
  | "roseGold"
  | "platinum"
  | "satinTi"
  | "rubber"
  | "leather"
  | "lume"
  | "dialSilver"
  | "dialBlue"
  | "dialSkel"
  | "insert"
  | "chapterRing"
  | "goldRing"
  | "dialSlateRing";

export type VaultPalette = Record<MaterialKey, THREE.MeshStandardMaterial>;

/**
 * Materials whose `emissiveIntensity` the choreography animates rather than leaving fixed.
 *
 * These three are the vault's own light sources as *surfaces* — the seam glow under the lid, the
 * illuminated emblem on the lid crown, and the interior strips that come up as the lid opens. The
 * design drives all three from `lights(t)` (vault.js:621-623), starting every one at 0 so a closed
 * vault is genuinely dark. Named here so the choreography can reach them without re-walking the
 * scene graph every frame.
 */
export const ANIMATED_EMISSIVE_KEYS = ["seam", "emblem", "strip"] as const;

/**
 * Builds the palette. Call once per scene mount and dispose with the scene — these are GPU
 * resources, and this app remounts reveal Canvases repeatedly within a session (a 10-pack batch
 * remounts per pack).
 *
 * Deliberately a factory rather than module-level singletons: the choreography *mutates*
 * `emissiveIntensity` on three of these every frame, so two concurrently-mounted reveals sharing
 * one module-level palette would fight over the same values. A factory keeps each mount's
 * animation state its own.
 */
export function createVaultPalette(): { palette: VaultPalette; dispose: () => void } {
  const mat = (name: string, o: THREE.MeshStandardMaterialParameters) =>
    Object.assign(new THREE.MeshStandardMaterial(o), { name });

  const palette: VaultPalette = {
    // --- vault shell (vault.js:13-25) ---
    lacquer: mat("piano_black_lacquer", { color: 0x0b0c0e, roughness: 0.1, metalness: 0.42 }),
    forged: mat("forged_carbon", { color: 0x15181d, roughness: 0.46, metalness: 0.55 }),
    titanium: mat("brushed_titanium", { color: 0x9ea2a8, roughness: 0.36, metalness: 0.95 }),
    gunmetal: mat("polished_gunmetal", { color: 0x565c64, roughness: 0.22, metalness: 0.95 }),
    alcantara: mat("charcoal_alcantara", { color: 0x1a1c20, roughness: 0.97, metalness: 0 }),
    steel: mat("polished_steel", { color: 0xd9dde2, roughness: 0.07, metalness: 1 }),
    dialSlate: mat("dial_slate", { color: 0x05070a, roughness: 0.82, metalness: 0.06 }),
    // The one shell material carrying a standing emissive: applied indices catch light at angles a
    // dial plate cannot, and the design gives them a low self-lit floor so they never vanish
    // against a near-black dial. Unlike the three animated keys above, this one is constant.
    applied: mat("applied_index", {
      color: 0xc6cad0,
      roughness: 0.24,
      metalness: 0.9,
      emissive: 0x8e959e,
      emissiveIntensity: 0.16,
    }),
    // Sapphire as a near-invisible dark tint rather than real transmission. The design's own
    // choice, and the right one here: `transmission` on MeshPhysicalMaterial forces a scene
    // back-buffer resolve per transmissive object, which is a cost this scene cannot pay on a
    // phone for a crystal that reads correctly as a faint dark sheen plus the moving glint plane.
    // `side` is set to DoubleSide by the builder (the design does it at vault.js:829) so the
    // caseback crystal reads from inside the case too.
    sapphire: mat("sapphire_crystal", {
      color: 0x0b1015,
      roughness: 0.06,
      metalness: 0.1,
      transparent: true,
      opacity: 0.035,
    }),
    goldAcc: mat("champagne_gold", { color: 0xc9a96b, roughness: 0.16, metalness: 1 }),
    emblem: mat("emblem_light", {
      color: 0x14171b,
      roughness: 0.3,
      metalness: 0.6,
      emissive: 0xe6d9bd,
      emissiveIntensity: 0,
    }),
    seam: mat("seam_light", {
      color: 0x05060a,
      roughness: 0.9,
      metalness: 0,
      emissive: 0xcfe0f2,
      emissiveIntensity: 0,
    }),
    strip: mat("interior_light", {
      color: 0x0a0c10,
      roughness: 0.9,
      metalness: 0,
      emissive: 0xf0e9dc,
      emissiveIntensity: 0,
    }),

    // --- archetype metals + dials (vault.js:171-184) ---
    dlc: mat("blackened_dlc", { color: 0x1b1e22, roughness: 0.34, metalness: 0.92 }),
    roseGold: mat("rose_gold", { color: 0xc2825f, roughness: 0.13, metalness: 1 }),
    platinum: mat("polished_platinum", { color: 0xdfe2e6, roughness: 0.09, metalness: 1 }),
    satinTi: mat("satin_titanium", { color: 0x8d9299, roughness: 0.48, metalness: 0.92 }),
    rubber: mat("vulcanised_rubber", { color: 0x101215, roughness: 0.9, metalness: 0 }),
    leather: mat("cordovan_leather", { color: 0x241512, roughness: 0.74, metalness: 0.02 }),
    // Lume is the one genuinely self-lit material in the scene — a dive watch's markers glow
    // rather than reflect, so this emissive is physical, not a workaround.
    lume: mat("lume_teal", {
      color: 0xbfe8dc,
      roughness: 0.42,
      metalness: 0,
      emissive: 0x35c6a6,
      emissiveIntensity: 0.55,
    }),
    dialSilver: mat("dial_silver_grain", { color: 0xb9bec6, roughness: 0.44, metalness: 0.4 }),
    dialBlue: mat("dial_midnight_blue", { color: 0x0d1a30, roughness: 0.46, metalness: 0.34 }),
    dialSkel: mat("dial_openwork", { color: 0x1c2025, roughness: 0.4, metalness: 0.72 }),
    // The four DoubleSide materials below are all applied to RingGeometry / flat inserts, which
    // are single-sided planes — without DoubleSide they disappear entirely when the reveal's
    // camera or the user's orbit passes below their plane.
    insert: mat("bezel_insert_matte", {
      color: 0x0a0c0f,
      roughness: 0.66,
      metalness: 0.14,
      side: THREE.DoubleSide,
    }),
    chapterRing: mat("chapter_ring", {
      color: 0x9fa5ad,
      roughness: 0.34,
      metalness: 0.86,
      side: THREE.DoubleSide,
    }),
    goldRing: mat("champagne_gold_ring", {
      color: 0xc9a96b,
      roughness: 0.16,
      metalness: 1,
      side: THREE.DoubleSide,
    }),
    dialSlateRing: mat("dial_slate_ring", {
      color: 0x05070a,
      roughness: 0.82,
      metalness: 0.06,
      side: THREE.DoubleSide,
    }),
  };

  return {
    palette,
    dispose: () => {
      for (const key of Object.keys(palette) as MaterialKey[]) palette[key].dispose();
    },
  };
}

/**
 * Clones one palette material and re-tints it, for per-item personalisation.
 *
 * The caller owns the clone and must register it for disposal — see the builder's own dispose
 * list. Kept here beside the palette so the "never mutate a shared material" rule and its one
 * sanctioned escape hatch live in the same file.
 */
export function cloneTinted(
  source: THREE.MeshStandardMaterial,
  color: THREE.Color
): THREE.MeshStandardMaterial {
  const clone = source.clone();
  clone.color = color.clone();
  clone.name = `${source.name}_tinted`;
  return clone;
}

/** Resolves a material key that came from the archetype table, which types its fields as plain
 * strings (it is a data table with no import of this module). Throws on an unknown key rather than
 * falling back silently: an unmapped key means the archetype table and this palette have drifted,
 * which is a programming error worth surfacing loudly in development, and the closed `MaterialKey`
 * union above means it cannot happen for any key written in TypeScript. */
export function materialFor(palette: VaultPalette, key: string): THREE.MeshStandardMaterial {
  const hit = (palette as Record<string, THREE.MeshStandardMaterial | undefined>)[key];
  if (!hit) throw new Error(`[grailhaus] unknown vault material key: ${key}`);
  return hit;
}
