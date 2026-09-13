// The vault scene: mounts the geometry, the prefiltered environment and the light rig, then binds
// them to the choreography and hands the engine back plain `pose(t)` / `lights(t)` closures.
//
// This file is the whole reason `ChoreographyMode` is shaped the way it is (see core/types.ts).
// The choreography's own functions are typed against `VaultScene` — a concrete thing with a vault,
// a watch, a palette and three lights — but `CategoryRevealConfig` is one non-generic interface
// shared by every category, so that type cannot survive at the config boundary. Binding here, in
// the category's own module, lets the engine drive a fully-typed timeline while never learning
// what a vault is. A handbag with a completely different scene shape binds its own the same way.
//
// WHY THE LIGHTS ARE PLAIN NUMBERS IN A MUTABLE OBJECT
//
// The choreography writes light intensities into `scene.lights.*` as ordinary numbers, and this
// component copies them onto the real THREE light objects each frame. That indirection is
// deliberate: it keeps the choreography a pure function of `t` with no THREE imports and no
// knowledge of r3f refs, which is what makes it unit-testable and what makes scrubbing safe. The
// copy is a handful of property writes per frame — immaterial next to the draw calls.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber/native";
import * as THREE from "three";
import type { ItemDetail } from "@grailhaus/shared";
import { buildVaultObject } from "../engine/buildVaultObject";
import { buildArchiveWatch } from "../engine/buildArchiveWatch";
import { createVaultPalette } from "../engine/vaultMaterials";
import { buildVaultEnvironment, VAULT_ENV_INTENSITY } from "../art/vaultEnv";
import { resolveArchetype } from "../config/watchArchetypes";
import { lightVault, poseVault, type VaultScene } from "../config/vaultChoreography";

/** Mutable frame state the driver writes and this component reads. One object, created once, so
 * neither side allocates per frame. */
export interface VaultClock {
  /** Absolute seconds on the choreography's timeline. */
  t: number;
  /** True while the user is dragging — the driver poses without lighting in that case, and the
   * camera snaps instead of easing. */
  scrubbing: boolean;
}

/**
 * Builds the scene for one pulled item. Returns the R3F node plus the bound choreography closures.
 *
 * Called once per mount by the config's `mount` (see watchVault.config.ts). The returned `dispose`
 * releases the geometry, the per-item tinted material clones, the palette and the PMREM target —
 * all real GPU allocations, and this app remounts reveal Canvases repeatedly within a session.
 */
export function mountVaultScene(item: ItemDetail, opts: { tierColor: string }) {
  const clock: VaultClock = { t: 0, scrubbing: false };

  // The scene object is assembled lazily inside the component, because the environment needs the
  // live renderer and the lights need refs. `sceneRef` is the handoff: the component fills it on
  // mount, and the bound closures below no-op until it is populated. That ordering is safe — the
  // engine's driver only calls pose/lights from its own useFrame, which cannot run before the
  // component that owns it has mounted.
  const sceneRef: { current: VaultScene | null } = { current: null };

  const node = <VaultRevealScene item={item} tierColor={opts.tierColor} clock={clock} sceneRef={sceneRef} />;

  return {
    node,
    clock,
    pose: (t: number) => {
      const s = sceneRef.current;
      if (s) poseVault(s, t);
    },
    lights: (t: number) => {
      const s = sceneRef.current;
      if (s) lightVault(s, t);
    },
    dispose: () => {
      // The component's own effect cleanup does the real work (it owns what it created); this is
      // the belt-and-braces path for a caller that tears down without ever mounting.
      sceneRef.current = null;
    },
  };
}

function VaultRevealScene({
  item,
  tierColor,
  clock,
  sceneRef,
}: {
  item: ItemDetail;
  tierColor: string;
  clock: VaultClock;
  sceneRef: { current: VaultScene | null };
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  const keySpotRef = useRef<THREE.SpotLight>(null);
  const keyTargetRef = useRef<THREE.Object3D>(null);
  const rimRef = useRef<THREE.SpotLight>(null);
  const rimTargetRef = useRef<THREE.Object3D>(null);
  const presRef = useRef<THREE.SpotLight>(null);
  const presTargetRef = useRef<THREE.Object3D>(null);

  // Geometry and materials are built once per mount. `tierColor` is intentionally unused for the
  // watch itself: an Icon pull's identity comes from its archetype and its own catalog columns, not
  // from the pack's rarity-tier hex — tinting a platinum tourbillon with a tier colour would erase
  // the archetype. It stays in the signature because the engine passes it to every category and a
  // future tier-specific accent (the rarity word's colour, say) belongs to the overlay.
  const built = useMemo(() => {
    const { palette, dispose: disposePalette } = createVaultPalette();
    const vault = buildVaultObject(palette);
    const archetype = resolveArchetype(item.style);
    const watch = buildArchiveWatch({
      archetype,
      palette,
      caseMaterial: item.caseMaterial,
      dialColor: item.dialColor,
    });
    return { palette, vault, watch, archetype, disposePalette };
  }, [item.style, item.caseMaterial, item.dialColor]);

  useEffect(
    () => () => {
      built.vault.dispose();
      built.watch.dispose();
      built.disposePalette();
    },
    [built]
  );

  // The prefiltered environment — the single piece that makes every metalness-1.0 material in the
  // palette read as metal rather than near-black. Built once per renderer, assigned to the scene,
  // and released on unmount.
  useEffect(() => {
    const env = buildVaultEnvironment(gl as THREE.WebGLRenderer);
    const previous = scene.environment;
    scene.environment = env.texture;
    scene.environmentIntensity = VAULT_ENV_INTENSITY;
    return () => {
      scene.environment = previous;
      env.dispose();
    };
  }, [gl, scene]);

  // Assemble the mutable scene object the choreography writes into, and publish it.
  const vaultScene = useMemo<VaultScene>(
    () => ({
      vault: built.vault,
      watch: built.watch,
      palette: built.palette,
      lights: {
        keySpot: { intensity: 0, angle: 0.46, penumbra: 0.78, position: [0.045, 0.62, 0.16], targetY: 0, targetZ: 0 },
        rim: { intensity: 0, targetY: 0 },
        presentation: { intensity: 0, position: [0.16, 0.1, 0.3], targetY: 0, targetZ: 0 },
      },
      env: { intensity: VAULT_ENV_INTENSITY },
      overlay: { vignette: 0.55, sweepFired: false, rarityShown: false },
    }),
    [built]
  );

  useEffect(() => {
    sceneRef.current = vaultScene;
    // Pose the resting state immediately, so the very first rendered frame shows a sealed vault
    // rather than whatever the builders' own local positions happened to be.
    poseVault(vaultScene, 0);
    lightVault(vaultScene, 0);
    return () => {
      sceneRef.current = null;
    };
  }, [vaultScene, sceneRef]);

  // Copy the choreography's light numbers onto the real lights, and its exposure onto the scene.
  // Runs after the driver's own useFrame (which advances `clock.t` and calls pose/lights) because
  // the driver is mounted above this in the tree — r3f runs useFrame callbacks in subscription
  // order, and a parent subscribes first.
  // A SpotLight aims at its own `target` Object3D, and that target must be in the scene graph.
  // Binding it via a JSX `target` prop cannot work: on the first render the ref is still null, so
  // the light would permanently keep its default target at the origin. Bound imperatively once the
  // refs exist instead — this is the same reason the design source calls `scene.add(spot,
  // spot.target)` explicitly rather than relying on parenting.
  useEffect(() => {
    const pairs: [THREE.SpotLight | null, THREE.Object3D | null][] = [
      [keySpotRef.current, keyTargetRef.current],
      [rimRef.current, rimTargetRef.current],
      [presRef.current, presTargetRef.current],
    ];
    for (const [light, target] of pairs) {
      if (light && target) light.target = target;
    }
  }, []);

  useFrame(() => {
    const s = sceneRef.current;
    if (!s) return;

    const key = keySpotRef.current;
    if (key) {
      key.intensity = s.lights.keySpot.intensity;
      key.angle = s.lights.keySpot.angle;
      key.penumbra = s.lights.keySpot.penumbra;
      key.position.set(...s.lights.keySpot.position);
      if (keyTargetRef.current) {
        keyTargetRef.current.position.set(0, s.lights.keySpot.targetY, s.lights.keySpot.targetZ);
        keyTargetRef.current.updateMatrixWorld();
      }
    }

    const rim = rimRef.current;
    if (rim) {
      rim.intensity = s.lights.rim.intensity;
      if (rimTargetRef.current) {
        rimTargetRef.current.position.set(0, s.lights.rim.targetY, 0);
        rimTargetRef.current.updateMatrixWorld();
      }
    }

    const pres = presRef.current;
    if (pres) {
      pres.intensity = s.lights.presentation.intensity;
      pres.position.set(...s.lights.presentation.position);
      if (presTargetRef.current) {
        presTargetRef.current.position.set(0, s.lights.presentation.targetY, s.lights.presentation.targetZ);
        presTargetRef.current.updateMatrixWorld();
      }
    }

    scene.environmentIntensity = s.env.intensity;
  });

  return (
    <>
      {/* The vault's own ambient pair, matching the design's stage: a dim cool hemisphere and a
          weak key. Everything dramatic comes from the three spots below, which the choreography
          drives from zero. */}
      {/* Raised well above the design's own 0.35 / 0.5 / 0.18. Those values were composed for a
          desktop browser in a dark room, where the vault's piano-black lacquer and charcoal
          alcantara still separate from the background. On a phone — smaller, often held in
          daylight, and with a display that flattens the bottom of the tonal range — the same
          numbers read as a black rectangle with a few highlights. The lift is applied to the
          ambient/fill layer rather than to the dramatic spots so the choreography's own escalation
          (dark vault → interior activation → lit presentation) still reads as a change; brightening
          the spots instead would have flattened that arc by starting it already bright.
          A third fill light was added from the front-left, where the design had none: its rig
          assumes the viewer can orbit freely to find a flattering angle, but this reveal is
          camera-scripted for most of its duration, so the faces the user actually sees need to be
          lit rather than relying on them being turned toward a light. */}
      <hemisphereLight args={[0x3d4552, 0x0b0d12, 0.95]} />
      <directionalLight position={[3, 6, 4]} intensity={1.25} color={0xe8eef8} />
      <directionalLight position={[-5, 2.5, -4]} intensity={0.55} color={0x9fb2cc} />
      <directionalLight position={[1.5, 2, 5]} intensity={0.45} color={0xfff2e2} />

      {/* Key spot — the vault's main light, narrowing for the rarity moment. Shadows are left off
          deliberately: the design casts a 1024px shadow from this one light, but r3f's shadow
          pipeline is disabled on this app's reveal Canvases (they declare only
          `gl={{ antialias: false, alpha: true }}`), and turning it on for a ~340-mesh scene on a
          mid-range phone is exactly the kind of cost this branch exists to avoid. The scene reads
          correctly without it because the vault's interior is lit by its own emissive strips. */}
      <spotLight
        ref={keySpotRef}
        position={[0.045, 0.62, 0.16]}
        intensity={0}
        distance={3.2}
        angle={0.46}
        penumbra={0.78}
        decay={1.6}
        color={0xfff4e4}
      />
      <object3D ref={keyTargetRef} />

      {/* Cool rim, opposite the key — separates the vault's black lacquer from a black background. */}
      <spotLight
        ref={rimRef}
        position={[-0.34, 0.2, -0.3]}
        intensity={0}
        distance={3}
        angle={0.7}
        penumbra={0.9}
        decay={1.4}
        color={0x9dbdf0}
      />
      <object3D ref={rimTargetRef} />

      {/* Front presentation light — comes up only once the watch floats free, so the dial stays
          readable when it is no longer inside the lit case. */}
      <spotLight
        ref={presRef}
        position={[0.16, 0.1, 0.3]}
        intensity={0}
        distance={1.4}
        angle={0.55}
        penumbra={0.9}
        decay={1.5}
        color={0xffeedd}
      />
      <object3D ref={presTargetRef} />

      <primitive object={built.vault.group} />
      {/* The watch is a sibling of the vault, not a child of the platform: it has to float free of
          the case during presentation, which a parented transform would fight. `pose` tracks the
          platform's height for it instead (see watchRestY). */}
      <primitive object={built.watch.group} />
    </>
  );
}
