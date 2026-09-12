// The Reserve's scene: mounts the Heritage Case, the watch, the warm environment and the light
// rig, then binds them to the choreography and hands the engine plain `pose(t)` / `lights(t)`
// closures.
//
// Structurally identical to the Archive's scene component (../../vaultReveal/scene/
// VaultRevealScene.tsx) and deliberately so — that similarity is the evidence the framework seam
// works. Two reveals with completely different geometry, materials, lighting rigs, gesture feel and
// pacing both reach the engine through the same `ChoreographyMode.mount` contract, and the engine
// distinguishes them not at all.
//
// The one genuinely different piece is the watch's parenting, below: the Reserve mounts its watch
// *inside* the case (on a pivot at the cushion's centre) where the Archive's floats free above an
// open vault. That is a property of each design, and it lives in the scene rather than the engine.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber/native";
import * as THREE from "three";
import type { ItemDetail } from "@grailhaus/shared";
import { buildReserveCase, CUSHION_R, CUSHION_Y } from "../engine/buildReserveCase";
import { buildReserveWatch } from "../engine/buildReserveWatch";
import { createReservePalette } from "../engine/reserveMaterials";
import { buildReserveEnvironment, RESERVE_ENV_INTENSITY } from "../art/reserveEnv";
import { resolveReserveSpec } from "../config/reserveArchetypes";
import { lightReserve, poseReserve, type ReserveScene } from "../config/reserveChoreography";

/**
 * Builds the scene for one pulled item and binds it to the choreography.
 *
 * Called once per mount by the config's `mount`. The returned `dispose` releases geometry, the
 * per-item material and texture clones, the palette (including its two baked maps) and the PMREM
 * target — all real GPU allocations, and this app remounts reveal Canvases repeatedly per session.
 */
export function mountReserveScene(item: ItemDetail, opts: { tierColor: string }) {
  const sceneRef: { current: ReserveScene | null } = { current: null };

  const node = <ReserveRevealScene item={item} tierColor={opts.tierColor} sceneRef={sceneRef} />;

  return {
    node,
    pose: (t: number) => {
      const s = sceneRef.current;
      if (s) poseReserve(s, t);
    },
    lights: (t: number) => {
      const s = sceneRef.current;
      if (s) lightReserve(s, t);
    },
    dispose: () => {
      // The component's own effect cleanup does the real work (it owns what it created); this is
      // the path for a caller that tears down without ever mounting.
      sceneRef.current = null;
    },
  };
}

function ReserveRevealScene({
  item,
  tierColor,
  sceneRef,
}: {
  item: ItemDetail;
  tierColor: string;
  sceneRef: { current: ReserveScene | null };
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  const interiorRef = useRef<THREE.PointLight>(null);
  const keyRef = useRef<THREE.SpotLight>(null);
  const keyTargetRef = useRef<THREE.Object3D>(null);
  const watchKeyRef = useRef<THREE.SpotLight>(null);
  const watchKeyTargetRef = useRef<THREE.Object3D>(null);

  // Geometry, materials and baked textures are built once per mount.
  //
  // `tierColor` is intentionally unused for the watch: a Reserve pull's appearance comes from its
  // own catalog columns (case material, dial colour, size, style) — which is exactly what the
  // previous tier-1 build got wrong, rendering every watch in the pack's flat rarity-tier hex so
  // all 14 Heritage watches looked identical. It stays in the signature because the engine passes
  // it to every category and the rarity word in the overlay legitimately uses it.
  const built = useMemo(() => {
    const { palette, dispose: disposePalette } = createReservePalette();
    const heritageCase = buildReserveCase(palette);

    const spec = resolveReserveSpec({
      style: item.style,
      caseMaterial: item.caseMaterial,
      dialColor: item.dialColor,
      caseSize: item.caseSize,
      watchName: item.watchName,
    });
    // MOUNTING, ported verbatim from the design's own `mountWatch`
    // (heritage-case-watch-reveal/project/heritage-case.js:306-327). Four earlier passes at this
    // were improvised arithmetic and each broke something different — the last one lost the strap
    // entirely — so every line below now mirrors one line of the source rather than deriving its
    // own value.
    //
    //   design: spec.loopR = 0.0212 + 0.0038
    // The band wraps the bolster, standing 3.8mm clear of it.
    spec.loopR = CUSHION_R + 0.0038;

    const watch = buildReserveWatch(spec, palette);

    //   design: caseY = cushionY + 0.0212 + caseHeight * 0.55
    //   design: watch.position.y = caseY - cushionY
    // The case sits a full bolster-radius above the bolster's centre, plus a little over half its
    // own thickness — i.e. resting on top of the bolster.
    //
    // SEATING MARGIN added on top of the design's formula. `caseHeight * 0.55` leaves the case's
    // underside only 0.4-0.5mm above the bolster's crown for every one of the 14 Heritage rows
    // (checked for all of them, not extrapolated from one). The design gets away with that because
    // its camera stays level with the case; at this port's more oblique framing a 21mm-radius
    // bolster whose near flank rises in front of a case seated 0.4mm above it occludes the watch
    // almost entirely — which is what "the cushion is not proper with the watch" was showing.
    //
    // 5mm lifts the piece clear of the bolster's silhouette from every angle the reveal and the
    // orbit reach, while still reading as a watch resting on a pillow rather than hovering over
    // one. Deliberately a named constant rather than folded into the multiplier, so the design's
    // own formula stays visible and this port's one divergence from it is explicit.
    const CASE_SEATING_MARGIN = 0.005;
    const caseAbovePivot = CUSHION_R + watch.caseHeight * 0.55 + CASE_SEATING_MARGIN;
    watch.group.position.y = caseAbovePivot;

    //   design: watch.getObjectByName('Bracelet').position.y = -(caseY - cushionY)
    // The band goes back to EXACTLY the pivot, which is the bolster's centre. That is the whole
    // trick: the bracelet's torus is centred on its group's origin, so putting that origin at the
    // bolster's centre makes the loop encircle the bolster — which is what makes a wrapped strap
    // visible at all. My previous pass placed it just above a flat pad instead, where its entire
    // 17mm diameter sat inside the case's own silhouette and nothing showed.
    watch.bracelet.position.y = -caseAbovePivot;

    heritageCase.watchPivot.add(watch.group);

    return { palette, heritageCase, watch, spec, disposePalette };
  }, [item.style, item.caseMaterial, item.dialColor, item.caseSize, item.watchName]);

  useEffect(
    () => () => {
      built.heritageCase.dispose();
      built.watch.dispose();
      built.disposePalette();
    },
    [built]
  );

  // The warm walnut/brass environment. Without it every metalness-1.0 material in the palette —
  // the brass inlay, the polished case, the steel bracelet — renders near-black. See
  // ../art/reserveEnv.ts.
  useEffect(() => {
    const env = buildReserveEnvironment(gl as THREE.WebGLRenderer);
    const previous = scene.environment;
    scene.environment = env.texture;
    scene.environmentIntensity = RESERVE_ENV_INTENSITY;
    return () => {
      scene.environment = previous;
      env.dispose();
    };
  }, [gl, scene]);

  const reserveScene = useMemo<ReserveScene>(
    () => ({
      heritageCase: built.heritageCase,
      watch: built.watch,
      palette: built.palette,
      lights: {
        interior: { intensity: 0.18 },
        key: { intensity: 1.15, targetY: CUSHION_Y },
        watchKey: { intensity: 0, targetY: CUSHION_Y + CUSHION_R },
      },
      env: { intensity: RESERVE_ENV_INTENSITY },
      overlay: { vignette: 0.3, momentShown: false },
    }),
    [built]
  );

  useEffect(() => {
    sceneRef.current = reserveScene;
    // Pose the resting state immediately so the first rendered frame shows a closed case rather
    // than whatever the builders' own local transforms happened to be.
    poseReserve(reserveScene, 0);
    lightReserve(reserveScene, 0);
    return () => {
      sceneRef.current = null;
    };
  }, [reserveScene, sceneRef]);

  // SpotLights aim at a `target` Object3D that must itself be in the scene graph, and a JSX
  // `target` prop cannot work because the ref is null on first render. Bound imperatively once.
  useEffect(() => {
    if (keyRef.current && keyTargetRef.current) keyRef.current.target = keyTargetRef.current;
    if (watchKeyRef.current && watchKeyTargetRef.current) {
      watchKeyRef.current.target = watchKeyTargetRef.current;
    }
  }, []);

  // Copy the choreography's plain numbers onto the real lights. Keeping the choreography free of
  // THREE imports and r3f refs is what makes it unit-testable and scrub-safe.
  useFrame(() => {
    const s = sceneRef.current;
    if (!s) return;

    if (interiorRef.current) interiorRef.current.intensity = s.lights.interior.intensity;

    if (keyRef.current) {
      keyRef.current.intensity = s.lights.key.intensity;
      if (keyTargetRef.current) {
        keyTargetRef.current.position.set(0, s.lights.key.targetY, 0);
        keyTargetRef.current.updateMatrixWorld();
      }
    }

    if (watchKeyRef.current) {
      watchKeyRef.current.intensity = s.lights.watchKey.intensity;
      if (watchKeyTargetRef.current) {
        watchKeyTargetRef.current.position.set(0, s.lights.watchKey.targetY, 0);
        watchKeyTargetRef.current.updateMatrixWorld();
      }
    }

    scene.environmentIntensity = s.env.intensity;
  });

  return (
    <>
      {/* A warm lit room rather than the Archive's dark vault. The hemisphere is warm-over-cool
          (a lamplit interior above a wooden floor), and both directionals are warm — the whole
          tier's identity is walnut, brass and burgundy, and a cool rig would fight every material
          in the palette. Brighter than the design's own stage values for the same reason the
          Archive's were raised: the source composed for a large display in a dark room. */}
      <hemisphereLight args={[0xfff1dc, 0x3a2b1f, 0.85]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.15} color={0xfff4e4} />
      <directionalLight position={[-3, 1.5, -2.5]} intensity={0.4} color={0xbcd0e8} />

      {/* The interior glow — a point light just inside the opening, which breathes in with the lid
          and is the whole of the design's "light spills in" beat. This is the one bespoke light
          this tier adds beyond its ambient pair, and the cheapest possible way to sell it. */}
      <pointLight
        ref={interiorRef}
        position={[0, CUSHION_Y + 0.03, 0.005]}
        intensity={0.18}
        distance={0.6}
        decay={1.6}
        color={0xffc98a}
      />

      {/* The key spot over the case. No shadows: r3f's shadow pipeline is off on this app's reveal
          Canvases, and the design's own 2048px shadow map is not a cost this branch should take on
          for a ~400-mesh scene. The interior glow plus the environment carry the sense of depth. */}
      <spotLight
        ref={keyRef}
        position={[0.06, 0.62, 0.22]}
        intensity={1.15}
        distance={0}
        angle={0.44}
        penumbra={0.9}
        decay={1.4}
        color={0xffd9a0}
      />
      <object3D ref={keyTargetRef} />

      {/* A tighter spot that comes up on the watch once it has risen, so the piece reads as the
          subject rather than as part of the case's interior. */}
      <spotLight
        ref={watchKeyRef}
        position={[0.05, 0.3, 0.14]}
        intensity={0}
        distance={0.5}
        angle={0.7}
        penumbra={0.75}
        decay={1.2}
        color={0xfff0d6}
      />
      <object3D ref={watchKeyTargetRef} />

      <primitive object={built.heritageCase.group} />
    </>
  );
}
