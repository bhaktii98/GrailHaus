// The Obsidian Vault's scene: mounts the case, the ribbon, the watch, the mist and the light rig,
// then binds them to the choreography and hands the engine plain `pose(t)` / `lights(t)` closures.
//
// The third scene component in this system, and structurally the same as the other two — which is
// the point. Three reveals with entirely different geometry, gesture counts, durations, particle
// systems and lighting rigs all reach the engine through one `ChoreographyMode.mount` contract, and
// the engine distinguishes them not at all.
//
// What is genuinely new here, and lives in the scene rather than the engine:
//   - a particle system whose progress is driven by the choreography (the mist)
//   - tone-mapping exposure as animated scene state, not a fixed renderer setting
//   - a running seconds hand, advanced per frame independently of the timeline
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber/native";
import * as THREE from "three";
import type { ItemDetail } from "@grailhaus/shared";
import { buildObsidianVault, FLOOR_Y, VAULT_D, VAULT_W } from "../engine/buildObsidianVault";
import { buildObsidianRibbon } from "../engine/buildObsidianRibbon";
import { buildObsidianWatch } from "../engine/buildObsidianWatch";
import { buildObsidianMist } from "../engine/buildObsidianMist";
import { createObsidianPalette, obsidianMaterialFor } from "../engine/obsidianMaterials";
import {
  buildObsidianEnvironment,
  OBSIDIAN_ENV_INTENSITY,
  OBSIDIAN_EXPOSURE_REST,
} from "../art/obsidianEnv";
import { resolveReference } from "../config/obsidianReferences";
import { lightObsidian, poseObsidian, type ObsidianScene } from "../config/obsidianChoreography";

/** Interior dimensions the mist needs — the vault's own wall thickness is 15mm a side. */
const INTERIOR_W = VAULT_W - 0.03;
const INTERIOR_D = VAULT_D - 0.03;

export function mountObsidianScene(item: ItemDetail, opts: { tierColor: string }) {
  const sceneRef: { current: ObsidianScene | null } = { current: null };

  const node = <ObsidianRevealScene item={item} tierColor={opts.tierColor} sceneRef={sceneRef} />;

  return {
    node,
    pose: (t: number) => {
      const s = sceneRef.current;
      if (s) poseObsidian(s, t);
    },
    lights: (t: number) => {
      const s = sceneRef.current;
      if (s) lightObsidian(s, t);
    },
    dispose: () => {
      sceneRef.current = null;
    },
  };
}

function ObsidianRevealScene({
  item,
  tierColor,
  sceneRef,
}: {
  item: ItemDetail;
  tierColor: string;
  sceneRef: { current: ObsidianScene | null };
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  const keyRef = useRef<THREE.SpotLight>(null);
  const keyTargetRef = useRef<THREE.Object3D>(null);
  const rimRef = useRef<THREE.SpotLight>(null);
  const rimTargetRef = useRef<THREE.Object3D>(null);
  const chamberRef = useRef<THREE.PointLight>(null);
  const chamber2Ref = useRef<THREE.PointLight>(null);
  const revealRef = useRef<THREE.SpotLight>(null);
  const revealTargetRef = useRef<THREE.Object3D>(null);
  const sweepRef = useRef<THREE.SpotLight>(null);
  const sweepTargetRef = useRef<THREE.Object3D>(null);
  const apexRef = useRef<THREE.PointLight>(null);

  // Built once per mount. `tierColor` is unused for the object itself: which of the five
  // executions a pull presents in comes from its own catalog columns (see
  // ../config/obsidianReferences.ts), not from the pack's rarity hex.
  const built = useMemo(() => {
    const { palette, dispose: disposePalette } = createObsidianPalette();
    const vault = buildObsidianVault(palette);
    const ribbon = buildObsidianRibbon(palette);
    const reference = resolveReference({
      id: item.id,
      dialColor: item.dialColor,
      caseMaterial: item.caseMaterial,
    });
    const watch = buildObsidianWatch(reference, palette);
    const mist = buildObsidianMist(INTERIOR_W, INTERIOR_D);

    // The watch mounts on the cushion's anchor, so it rides the cushion's rise without needing the
    // choreography to track two positions.
    vault.anchor.add(watch.group);
    vault.group.add(ribbon.group);

    return { palette, vault, ribbon, watch, mist, reference, disposePalette };
  }, [item.id, item.dialColor, item.caseMaterial]);

  useEffect(
    () => () => {
      built.vault.dispose();
      built.ribbon.dispose();
      built.watch.dispose();
      built.mist.dispose();
      built.disposePalette();
    },
    [built]
  );

  // The environment. Without it every metalness-1.0 material in the palette — the champagne gold
  // inlay, the polished case, the steel bracelet — renders near-black, and the obsidian lacquer
  // (whose entire appearance is reflection) renders as flat charcoal.
  useEffect(() => {
    const env = buildObsidianEnvironment(gl as THREE.WebGLRenderer);
    const previousEnv = scene.environment;
    const renderer = gl as THREE.WebGLRenderer;
    const previousToneMapping = renderer.toneMapping;
    const previousExposure = renderer.toneMappingExposure;

    scene.environment = env.texture;
    scene.environmentIntensity = OBSIDIAN_ENV_INTENSITY;
    // ACES filmic is what lets this scene carry a hot specular highlight on near-black lacquer
    // without the highlight clipping to a flat white blob. The design sets it explicitly, and it
    // matters more here than in either other tier because of that contrast range.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = OBSIDIAN_EXPOSURE_REST;

    return () => {
      scene.environment = previousEnv;
      renderer.toneMapping = previousToneMapping;
      renderer.toneMappingExposure = previousExposure;
      env.dispose();
    };
  }, [gl, scene]);

  const obsidianScene = useMemo<ObsidianScene>(
    () => ({
      vault: built.vault,
      ribbon: built.ribbon,
      watch: built.watch,
      mist: built.mist,
      lights: {
        key: { intensity: 10.5, driftX: 0, driftZ: 0 },
        rim: { intensity: 3.2 },
        chamber: { intensity: 0 },
        chamber2: { intensity: 0 },
        reveal: { intensity: 0, angle: 0.3, targetY: 0.122 },
        sweep: { intensity: 0 },
        apex: { intensity: 0 },
      },
      env: { intensity: OBSIDIAN_ENV_INTENSITY, exposure: OBSIDIAN_EXPOSURE_REST },
      overlay: { vignette: 0.34, apexShown: false, metaShown: false },
      clock: { time: 0 },
    }),
    [built]
  );

  useEffect(() => {
    sceneRef.current = obsidianScene;
    // Pose the sealed state immediately, so the first rendered frame is a closed ribboned vault
    // rather than whatever the builders' local transforms happened to be.
    poseObsidian(obsidianScene, 0);
    lightObsidian(obsidianScene, 0);
    return () => {
      sceneRef.current = null;
    };
  }, [obsidianScene, sceneRef]);

  // SpotLights aim at a target Object3D that must be in the scene graph; a JSX `target` prop
  // cannot work because the ref is null on first render. Bound imperatively once.
  useEffect(() => {
    const pairs: [THREE.SpotLight | null, THREE.Object3D | null][] = [
      [keyRef.current, keyTargetRef.current],
      [rimRef.current, rimTargetRef.current],
      [revealRef.current, revealTargetRef.current],
      [sweepRef.current, sweepTargetRef.current],
    ];
    for (const [light, target] of pairs) {
      if (light && target) light.target = target;
    }
  }, []);

  useFrame((state, rawDelta) => {
    const s = sceneRef.current;
    if (!s) return;
    const dt = Math.min(0.05, rawDelta);

    // The choreography reads this for its idle drift and the mist's own animation. Kept on the
    // scene rather than passed into pose/lights so those stay pure functions of `t`.
    s.clock.time = state.clock.elapsedTime;

    // The running seconds hand — the one motion independent of the timeline, so the watch reads as
    // alive for however long the user lingers in inspection.
    built.watch.secondHand.rotation.y += dt * 0.28;

    const key = keyRef.current;
    if (key) {
      key.intensity = s.lights.key.intensity;
      key.position.set(0.42 + s.lights.key.driftX, 0.86, 0.52 + s.lights.key.driftZ);
      if (keyTargetRef.current) {
        keyTargetRef.current.position.set(0, 0.06, 0);
        keyTargetRef.current.updateMatrixWorld();
      }
    }
    if (rimRef.current) rimRef.current.intensity = s.lights.rim.intensity;
    if (chamberRef.current) chamberRef.current.intensity = s.lights.chamber.intensity;
    if (chamber2Ref.current) chamber2Ref.current.intensity = s.lights.chamber2.intensity;

    const reveal = revealRef.current;
    if (reveal) {
      reveal.intensity = s.lights.reveal.intensity;
      reveal.angle = s.lights.reveal.angle;
      if (revealTargetRef.current) {
        revealTargetRef.current.position.set(0, s.lights.reveal.targetY, 0);
        revealTargetRef.current.updateMatrixWorld();
      }
    }
    if (sweepRef.current) sweepRef.current.intensity = s.lights.sweep.intensity;
    if (apexRef.current) apexRef.current.intensity = s.lights.apex.intensity;

    scene.environmentIntensity = s.env.intensity;
    // Exposure is animated scene state here, not a fixed setting — it is the design's single most
    // cinematic device (the whole frame darkens through the vapour, then opens up as the watch is
    // discovered).
    (gl as THREE.WebGLRenderer).toneMappingExposure = s.env.exposure;
  });

  return (
    <>
      {/* A near-black gallery. The hemisphere is barely present (0.14 in the design, raised only
          slightly here) because this tier's identity is darkness — almost everything visible comes
          from the four directed lights below and the environment's own reflections. */}
      <hemisphereLight args={[0xb9c4d6, 0x0a0a0c, 0.3]} />

      {/* Key — high and to the front-right, with a gentle drift while the vault is sealed so the
          lacquer always has a moving highlight to catch. Shadows deliberately off, as in both
          other tiers: r3f's shadow pipeline is disabled on this app's reveal Canvases and a
          ~700-mesh scene cannot afford a second geometry pass on a phone. */}
      <spotLight
        ref={keyRef}
        position={[0.42, 0.86, 0.52]}
        intensity={10.5}
        distance={3.2}
        angle={0.62}
        penumbra={0.62}
        decay={1.4}
        color={0xfff1dc}
      />
      <object3D ref={keyTargetRef} />

      {/* Warm rim from behind-left, which separates black lacquer from a black background. */}
      <spotLight
        ref={rimRef}
        position={[-0.62, 0.42, -0.52]}
        intensity={3.2}
        distance={2.4}
        angle={0.8}
        penumbra={0.8}
        decay={1.6}
        color={0xffd9a8}
      />
      <object3D ref={rimTargetRef} />

      <directionalLight position={[-0.5, 0.3, 0.8]} intensity={0.22} color={0x9fb0c8} />

      {/* The two chamber lights, inside the case. These are what escape as the lid lifts — the
          reason the opening reads as light spilling out of a lit interior rather than a lid
          revealing a hole. */}
      <pointLight ref={chamberRef} position={[0, 0.045, -0.03]} intensity={0} distance={0.42} decay={2.1} color={0xffcf94} />
      <pointLight ref={chamber2Ref} position={[0, 0.07, 0.055]} intensity={0} distance={0.3} decay={2.2} color={0xffe3bd} />

      {/* The reveal spot — the single light that discovers the watch once the vapour thins. Held
          at zero until then on purpose: lighting it earlier would show a silhouette through the
          mist and spoil the discovery. */}
      <spotLight
        ref={revealRef}
        position={[0.09, 0.3, 0.13]}
        intensity={0}
        distance={0.9}
        angle={0.3}
        penumbra={0.92}
        decay={1.5}
        color={0xfff0d8}
      />
      <object3D ref={revealTargetRef} />

      {/* The sweep — travels across the case finishing during the final approach. */}
      <spotLight
        ref={sweepRef}
        position={[0.26, 0.3, 0.2]}
        intensity={0}
        distance={0.8}
        angle={0.16}
        penumbra={0.88}
        decay={1.4}
        color={0xfff6e8}
      />
      <object3D ref={sweepTargetRef} />

      {/* The warm accent behind the APEX moment. */}
      <pointLight ref={apexRef} position={[0, 0.11, 0.22]} intensity={0} distance={0.5} decay={2.4} color={0xd8b478} />

      {/* The studio floor. A plain dark plane — it exists so the vault has something to sit on and
          so the fallen ribbon has a surface to rest against, not as a shadow catcher. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <primitive object={obsidianMaterialFor(built.palette, "floor")} attach="material" />
      </mesh>

      <primitive object={built.vault.group} />
      <primitive object={built.mist.group} />
    </>
  );
}
