// Ported from card-pack-reveal-prototype/src/vault/scene/VaultScene.tsx — the "private
// collector space" lighting rig (warm champagne key, violet rim, dim hemi, a focused rarity
// spot), the floor + back wall the pack sits on, the pack object itself, the interaction plane
// that turns r3f's raycast pointer events into the tear/inspect/orbit gesture (see
// ../gesture/useVaultInteraction.ts), and the per-frame camera + lighting choreography across
// the reveal's phases.
//
// Changes vs. the prototype:
//   - `deck` is a separate parameter now rather than read off `personality.deck`. In the app's
//     actual integration (VaultTearStage) it's always an empty array — this scene is only ever
//     used for the tear itself now, not the staged card-fan reveal buildReveal.ts also builds;
//     see VaultTearStage.tsx's header for why that reveal was split into its own, flat-2D screen
//     instead of running here. `deck`/the card-reveal machinery stayed generic (not deleted)
//     since buildVaultPackObject/buildReveal still work correctly with a real one, if a lighter-
//     weight in-3D card moment is ever worth revisiting.
//   - The prototype's fourth light (a champagne "kick" fill, always on) is dropped. Tier 1's
//     own reveal runs 3 lights total (hemi + key + rim, see CardFlowEngine.tsx); this scene
//     already runs a 4th (the rarity-moment spotlight) on top of that, and a per-material
//     lighting evaluation cost applies to every light regardless of how subtle its
//     contribution.
//   - Wrapped in `memo()`. The parent stage re-renders on every reveal snapshot update (which
//     happens whenever anything visible moves), and every one of this component's props
//     (`personality`, `deck`, `logo`, `orbit`, the stable `setSnapshot` reference) is already
//     referentially stable across those re-renders — without memo, React was re-running this
//     whole component's body anyway, including re-invoking
//     useVaultInteraction and rebuilding its returned callbacks, for no reason.
//   - Every light target is pushed past Tier 1's own flat key=3/rim=1.6 (see
//     CardFlowEngine.tsx), deliberately — Vault Break is the pricier tier and should read as
//     more lavish than Tier 1's tear, not merely as bright. The rim also gets a slow sinusoidal
//     "breathing" shimmer Tier 1's flat rim doesn't have, and the spotlight now holds a soft
//     always-on baseline instead of sitting at 0 until a rarity moment — a focused "jewel box"
//     highlight throughout the tear, not just during the (now rarely-reached, since the deck is
//     empty) notice/present phases. `introDolly` (VaultScene prop, set from VaultTearStage) adds
//     a slow camera dolly-in on mount instead of appearing already framed. None of this costs
//     anything extra to render — it's all just where numbers start and how they move over time.
import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber/native";
import type { ThreeEvent } from "@react-three/fiber";
import type { SkImage } from "@shopify/react-native-skia";
import { buildVaultPackObject, type BuiltVaultPack } from "../engine/buildVaultPackObject";
import { useVaultInteraction } from "../gesture/useVaultInteraction";
import type { VaultBreakPersonality, VaultCardData } from "../config/types";
import type { RevealPhase } from "../engine/buildReveal";

export interface VaultSceneHandle {
  reseal: () => void;
  setOrbit: (on: boolean) => void;
}

export interface VaultStateSnapshot {
  phase: RevealPhase;
  hero: number;
  ready: boolean;
  running: boolean;
  dim: number;
  shown: number;
  heroLabel: { rarity: string; edition: string; name: string; value: string; serial: string } | null;
}

export interface VaultSceneProps {
  personality: VaultBreakPersonality;
  deck: VaultCardData[];
  logo: SkImage | null;
  orbit: boolean;
  onSnapshot?: (s: VaultStateSnapshot) => void;
  /** Skips the usual instant camera snap on mount, letting the camera ease in from wherever the
   * Canvas's own declared starting position is instead — a slow cinematic dolly-in rather than
   * appearing already framed. Only affects the *first* reframe; a later orbit-exit still snaps
   * back instantly as before. */
  introDolly?: boolean;
  /** Swaps which art gets baked onto the pack shell/cards — defaults to Vault Break's own
   * buildVaultPackObject. Black Label (../../blackLabelReveal/scene's own thin wrapper) passes
   * buildBlackLabelPackObject instead; everything else about this scene — lighting rig
   * *behavior* (not color, see `personality.lighting`), camera choreography, gesture handling —
   * is shared, so this stayed one component with a swappable builder rather than a fork. */
  buildPack?: (personality: VaultBreakPersonality, deck: VaultCardData[], logo: SkImage | null) => BuiltVaultPack;
}

const CENTER_Y = 0;
const BASE_Z = 0.214;

// The orbit branch of useFrame below looks at this fixed point every frame. Allocating it inside
// the loop handed the GC a Vector3 per frame for a value that never changes — module-level here
// so the frame loop allocates nothing. (Same reason PackTearMesh keeps its scratch buffers.)
const ORBIT_TARGET = new THREE.Vector3(0, CENTER_Y, 0);

export const VaultScene = memo(forwardRef<VaultSceneHandle, VaultSceneProps>(function VaultScene(
  { personality, deck, logo, orbit, onSnapshot, introDolly, buildPack = buildVaultPackObject },
  ref
) {
  const pack = useMemo<BuiltVaultPack>(() => buildPack(personality, deck, logo), [buildPack, personality, deck, logo]);
  const interaction = useVaultInteraction(pack, personality);

  const keyRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const spotTargetRef = useRef<THREE.Object3D>(null);

  const touching = useRef(0);
  const reframeNext = useRef(false);
  const hasReframedOnce = useRef(false);
  const camAim = useRef({ x: 0, y: CENTER_Y + 0.006, z: BASE_Z, tx: 0, ty: CENTER_Y });
  const lookAt = useRef(new THREE.Vector3(0, CENTER_Y, 0));
  const lastPhase = useRef<RevealPhase>("idle");
  const lastSnapshot = useRef<VaultStateSnapshot | null>(null);
  const lastPlanePos = useRef(new Map<number, { x: number; y: number }>());

  // Deliberately depends on `orbit` only, not `interaction`: useVaultInteraction returns a
  // fresh object every render (its methods close over a stable ref/pack/personality, but the
  // wrapper object itself isn't memoized), and VaultScene re-renders often — this component
  // reports a state snapshot up to its parent whenever anything in the reveal moves. With
  // `interaction` in the dependency array, this effect fired on nearly every render, not just
  // when `orbit` actually changed — and `reframeNext.current = true` snaps the camera straight
  // back to the sealed-pack framing every time it fires, which the next frame's smooth
  // approach-toward-target logic then drifts back out from. That's what read as the camera
  // "zooming in and out" for no reason: it was being reset dozens of times a second.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    interaction.toggleOrbit(orbit);
    if (!orbit) reframeNext.current = true;
  }, [orbit]);

  useEffect(() => {
    if (spotRef.current && spotTargetRef.current) spotRef.current.target = spotTargetRef.current;
  }, []);

  useEffect(() => () => pack.dispose(), [pack]);

  useImperativeHandle(ref, () => ({
    reseal: () => {
      interaction.reseal();
      pack.setProgress(0);
    },
    setOrbit: (on: boolean) => interaction.toggleOrbit(on),
  }), [pack, interaction]);

  // ---- pointer plumbing ---------------------------------------------------
  const localXY = (e: ThreeEvent<PointerEvent>) => {
    const p = pack.group.worldToLocal(e.point.clone());
    return { x: p.x, y: p.y };
  };
  const planeXY = (e: ThreeEvent<PointerEvent>) => ({ x: e.point.x, y: e.point.y });

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    // Original only pulses this "touching" cue (feeds the key light below) for a tear grab, not
    // every tap during card inspection — approximated here by gating on the pack still being
    // sealed/opening rather than re-deriving useVaultInteraction's private onStripY() check.
    if (!pack.reveal.state.ready) touching.current = 1;
    lastPlanePos.current.set(e.pointerId, planeXY(e));
    interaction.onPointerDown(e.pointerId, localXY(e), planeXY(e), e.ray);
    (e.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
  };
  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    const p = planeXY(e);
    const last = lastPlanePos.current.get(e.pointerId);
    if (last) {
      const dx = (p.x - last.x) / pack.size.W;
      const dy = (p.y - last.y) / pack.size.H;
      interaction.dragDelta(e.pointerId, dx, dy);
    }
    lastPlanePos.current.set(e.pointerId, p);
    interaction.onPointerMove(e.pointerId, localXY(e), p);
    e.stopPropagation();
  };
  const handleUp = (e: ThreeEvent<PointerEvent>) => {
    lastPlanePos.current.delete(e.pointerId);
    interaction.onPointerUp(e.pointerId);
    e.stopPropagation();
  };
  const handleCancel = (e: ThreeEvent<PointerEvent>) => {
    lastPlanePos.current.delete(e.pointerId);
    interaction.onPointerCancel(e.pointerId);
    e.stopPropagation();
  };

  useFrame((state, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const f = interaction.update(dt);
    pack.react(dt, f.pullX, f.dragging);
    pack.setProgress(f.shown);
    pack.setTime(state.clock.elapsedTime, f.dragging ? 0.5 + f.energy : f.energy);
    touching.current *= Math.pow(0.05, dt);

    const st = pack.reveal.state;
    const camera = state.camera as THREE.PerspectiveCamera;

    // ---- lighting choreography -----------------------------------------
    // Pushed well past Tier 1's own flat key=3/rim=1.6 (see CardFlowEngine.tsx), deliberately —
    // Vault Break is the pricier, higher tier and is meant to read as more lavish than Tier 1's
    // tear, not merely as bright. The rim also gets a slow sinusoidal "breathing" shimmer that
    // Tier 1's flat rim doesn't have, a small living/jewel-box touch — a single extra sin() per
    // frame, no added draw calls or materials.
    const dim = st.dim;
    const phaseLight = st.hero >= 0 ? 3.8
      : st.ready ? 4.3
        : st.running ? 4.0
          : 3.5 + touching.current * 0.4 + f.shown * 0.6;
    const lerp1 = Math.min(1, dt * 3);
    if (keyRef.current) keyRef.current.intensity += (phaseLight * (1 - dim * 0.42) - keyRef.current.intensity) * lerp1;
    const rimShimmer = 0.22 * Math.sin(state.clock.elapsedTime * 0.85);
    if (rimRef.current) rimRef.current.intensity += ((2.1 + rimShimmer - dim * 0.5 + f.energy * 0.25) - rimRef.current.intensity) * lerp1;
    // Bumped from the ported 0.42 baseline to compensate for the removed "kick" fill light
    // (see this file's header) — hemisphere light is ambient/omnidirectional and costs nothing
    // extra per-object the way a fourth directional light did, so this is a free way to
    // recover most of the brightness that light was contributing without its performance cost.
    if (hemiRef.current) hemiRef.current.intensity += ((0.95 - dim * 0.2) - hemiRef.current.intensity) * lerp1;
    // A soft always-on baseline (rather than 0 while sealed/tearing) gives the pack a focused
    // "jewel box" highlight throughout, not just during the rarity moments.
    const spotWant = st.hero >= 0 ? 3.4 : dim > 0.05 ? 5.0 * dim : 0.7 + touching.current * 0.4;
    if (spotRef.current) {
      spotRef.current.intensity += (spotWant - spotRef.current.intensity) * Math.min(1, dt * 3.2);
      if (st.hero >= 0) spotRef.current.position.set(0.012, st.focus.y + 0.05, st.focus.z + 0.19);
      else spotRef.current.position.set(st.focus.x * 0.5 + 0.02, st.focus.y + 0.14, st.focus.z + 0.14);
    }
    if (spotTargetRef.current) spotTargetRef.current.position.lerp(st.focus, Math.min(1, dt * 4));

    // ---- camera choreography --------------------------------------------
    if (f.orbit) {
      const target = ORBIT_TARGET;
      camera.position.set(
        target.x + f.orbitRadius * Math.sin(f.orbitPhi) * Math.sin(f.orbitTheta),
        target.y + f.orbitRadius * Math.cos(f.orbitPhi),
        target.z + f.orbitRadius * Math.sin(f.orbitPhi) * Math.cos(f.orbitTheta)
      );
      camera.lookAt(target);
    } else {
      if (reframeNext.current) {
        reframeNext.current = false;
        // On the very first reframe, `introDolly` skips the instant snap so the camera instead
        // eases in from wherever the Canvas's own declared starting position is (a slow
        // cinematic dolly-in) — camAim.current already targets BASE_Z below, so the normal
        // per-frame smoothing pulls it the rest of the way in on its own. A later reframe
        // (orbit toggled off) still snaps instantly, same as before.
        if (!introDolly || hasReframedOnce.current) {
          camera.position.set(0, CENTER_Y + 0.006, BASE_Z);
          lookAt.current.set(0, CENTER_Y, 0);
          camera.lookAt(lookAt.current);
        }
        camAim.current = { x: 0, y: CENTER_Y + 0.006, z: BASE_Z, tx: 0, ty: CENTER_Y };
        hasReframedOnce.current = true;
      }
      // The prototype's fixed distances for the "cards fanned out" phases (below) were tuned on
      // a wider preview than a portrait phone actually gives you — three.js scales the
      // *horizontal* frustum by the viewport's aspect ratio, so a portrait screen's real
      // horizontal field of view at a given distance is much narrower than it looks on a wide
      // preview, and the six-card fan clips off both edges. This is the real minimum distance
      // (this viewport's actual aspect ratio, this camera's actual FOV, the fan's actual
      // geometric width) the spread phases below are clamped to never sit closer than.
      const aspect = state.size.width / state.size.height;
      const vFovRad = (camera.fov * Math.PI) / 180;
      const spreadMargin = 1.15; // breathing room so the outermost cards aren't flush with the edge
      const minSpreadZ = (pack.reveal.spreadWidth * spreadMargin) / (2 * Math.tan(vFovRad / 2) * aspect);
      const a = camAim.current;
      if (st.hero >= 0) {
        const h = pack.reveal.heroCard!.obj.position;
        a.z = 0.204; a.y = h.y * 0.9; a.x = 0;
        a.tx = 0; a.ty = h.y * 0.92;
      } else if (st.phase === "notice" || st.phase === "approach" || st.phase === "reveal" || st.phase === "present") {
        a.z = Math.max(0.266 - dim * 0.03, minSpreadZ);
        a.x = st.focus.x * 0.42;
        a.y = st.focus.y * 0.82 + 0.004;
        a.tx = st.focus.x * 0.5; a.ty = st.focus.y * 0.88;
      } else if (st.running || st.ready) {
        a.z = Math.max(0.264, minSpreadZ); a.x = 0; a.y = CENTER_Y + 0.022; a.tx = 0; a.ty = CENTER_Y + 0.022;
      } else {
        a.z = BASE_Z - f.shown * 0.014;
        a.x = 0;
        a.y = CENTER_Y + 0.006 + f.shown * 0.012;
        a.tx = 0; a.ty = CENTER_Y + f.shown * 0.012;
      }
      const slow = st.phase === "notice" || st.phase === "approach" || st.phase === "reveal" || st.phase === "present";
      const sp = Math.min(1, dt * (slow ? 1.1 : 2.6));
      camera.position.x += (a.x - camera.position.x) * sp;
      camera.position.y += (a.y - camera.position.y) * sp;
      camera.position.z += (a.z - camera.position.z) * sp;
      lookAt.current.set(
        lookAt.current.x + (a.tx - lookAt.current.x) * sp,
        lookAt.current.y + (a.ty - lookAt.current.y) * sp,
        0
      );
      camera.lookAt(lookAt.current);
    }

    // ---- overlay snapshot (throttled to real changes) --------------------
    if (onSnapshot) {
      // The `changed` test comes first and the card lookup second, deliberately: this block runs
      // every frame but only passes the test occasionally, and `cards.find(...)` was scanning the
      // whole deck on every frame in between just to build a value that was then thrown away.
      const changed = !lastSnapshot.current
        || lastSnapshot.current.phase !== st.phase
        || lastSnapshot.current.hero !== st.hero
        || lastSnapshot.current.ready !== st.ready
        || Math.abs(lastSnapshot.current.dim - dim) > 0.02
        || Math.abs(lastSnapshot.current.shown - f.shown) > 0.01;
      if (changed) {
        const heroCard = pack.reveal.heroCard;
        const labelCard = heroCard
          ?? (st.phase === "present" ? pack.reveal.cards.find((c) => c.isGrail) : null);
        const snap: VaultStateSnapshot = {
          phase: st.phase, hero: st.hero, ready: st.ready, running: st.running, dim, shown: f.shown,
          heroLabel: labelCard ? {
            rarity: `${labelCard.data.rarityLabel} · ${labelCard.data.edition}`,
            edition: labelCard.data.edition,
            name: labelCard.data.name,
            value: labelCard.data.value,
            serial: labelCard.data.serial,
          } : null,
        };
        lastSnapshot.current = snap;
        onSnapshot(snap);
      }
    }
    lastPhase.current = st.phase;
  });

  const floorY = -pack.size.H / 2;

  return (
    <>
      <hemisphereLight ref={hemiRef} args={[personality.lighting.hemiSky, personality.lighting.hemiGround, 0.95]} />
      <directionalLight ref={keyRef} color={personality.lighting.key} intensity={3.5} position={[0.17, 0.3, 0.3]} />
      <directionalLight ref={rimRef} color={personality.lighting.rim} intensity={2.1} position={[-0.3, 0.12, -0.22]} />
      <spotLight
        ref={spotRef}
        color={personality.lighting.spot}
        intensity={0.7}
        distance={0.6}
        angle={0.5}
        penumbra={0.92}
        decay={1.2}
        position={[0.02, 0.16, 0.16]}
      />
      <object3D ref={spotTargetRef} position={[0, 0, 0]} />

      <mesh rotation-x={-Math.PI / 2} position={[0, floorY - 0.0004, 0]} receiveShadow>
        <planeGeometry args={[0.62, 0.62]} />
        <meshStandardMaterial name="vaultFloor" color={0x050310} roughness={0.58} metalness={0.22} />
      </mesh>
      <mesh position={[0, floorY + 0.24, -0.26]}>
        <planeGeometry args={[0.9, 0.62]} />
        <meshStandardMaterial name="vaultWall" color={0x040209} roughness={0.92} metalness={0.05} />
      </mesh>

      <primitive object={pack.group} />

      {/* Deliberately NOT a child of pack.group: the pack leans a few degrees during a
          tear-reaction and, later, cards fan out to the sides — a plane parented to the pack
          would tilt/track with it, moving the touch target under the user's finger. Sitting the
          plane in fixed world space keeps the hit region predictable; pack.group.worldToLocal()
          above still correctly accounts for any lean when converting a hit into the pack's own
          local space. */}
      <mesh
        position={[0, CENTER_Y, pack.size.T * 3]}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleCancel}
      >
        <planeGeometry args={[pack.size.W * 6, pack.size.H * 3]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>
    </>
  );
}));
