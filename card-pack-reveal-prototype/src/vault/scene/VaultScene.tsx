// The 3D half of Vault Break: the "private collector space" lighting rig
// (warm champagne key, violet rim, champagne kick, dim hemi, a focused
// rarity spot — ported from grailhaus-vault-break.html's script, which
// deliberately strips three-d-stage.js's neutral studio defaults and
// replaces them with this jeweller's-box setup), the floor + back wall the
// original adds once the pack mounts, the pack object itself, the
// interaction plane that turns r3f's raycast pointer events into the tear/
// inspect/orbit gesture (see ../gesture/useVaultInteraction.ts), and the
// per-frame camera + lighting choreography across the reveal's phases.
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { SkImage } from '@shopify/react-native-skia';
import { buildVaultPackObject, type BuiltVaultPack } from '../engine/buildVaultPackObject';
import { useVaultInteraction } from '../gesture/useVaultInteraction';
import type { VaultBreakPersonality } from '../config/types';
import type { RevealPhase } from '../engine/buildReveal';

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
  logo: SkImage | null;
  orbit: boolean;
  onSnapshot?: (s: VaultStateSnapshot) => void;
}

const CENTER_Y = 0;
const BASE_Z = 0.214;

export const VaultScene = forwardRef<VaultSceneHandle, VaultSceneProps>(function VaultScene(
  { personality, logo, orbit, onSnapshot },
  ref,
) {
  const pack = useMemo<BuiltVaultPack>(() => buildVaultPackObject(personality, logo), [personality, logo]);
  const interaction = useVaultInteraction(pack, personality);

  const keyRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const kickRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const spotTargetRef = useRef<THREE.Object3D>(null);

  const touching = useRef(0);
  const reframeNext = useRef(false);
  const camAim = useRef({ x: 0, y: CENTER_Y + 0.006, z: BASE_Z, tx: 0, ty: CENTER_Y });
  const lookAt = useRef(new THREE.Vector3(0, CENTER_Y, 0));
  const lastPhase = useRef<RevealPhase>('idle');
  const lastSnapshot = useRef<VaultStateSnapshot | null>(null);
  const lastPlanePos = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    interaction.toggleOrbit(orbit);
    if (!orbit) reframeNext.current = true;
  }, [orbit, interaction]);

  useEffect(() => {
    const l = keyRef.current;
    if (l) {
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.bias = -0.0004;
      Object.assign(l.shadow.camera, { left: -0.16, right: 0.16, top: 0.16, bottom: -0.16 });
      l.shadow.camera.updateProjectionMatrix();
    }
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
    // Original only pulses the kick-light "touching" cue for a tear grab,
    // not every tap during card inspection — approximated here by gating
    // on the pack still being sealed/opening rather than re-deriving
    // useVaultInteraction's private onStripY() check.
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
    const dim = st.dim;
    const phaseLight = st.hero >= 0 ? 2.4
      : st.ready ? 2.9
        : st.running ? 2.6
          : 2.0 + touching.current * 0.35 + f.shown * 0.5;
    const lerp1 = Math.min(1, dt * 3);
    if (keyRef.current) keyRef.current.intensity += (phaseLight * (1 - dim * 0.42) - keyRef.current.intensity) * lerp1;
    if (rimRef.current) rimRef.current.intensity += ((1.15 - dim * 0.5 + f.energy * 0.25) - rimRef.current.intensity) * lerp1;
    if (kickRef.current) kickRef.current.intensity += ((0.5 + f.shown * 0.3 + touching.current * 0.2) - kickRef.current.intensity) * lerp1;
    if (hemiRef.current) hemiRef.current.intensity += ((0.42 - dim * 0.2) - hemiRef.current.intensity) * lerp1;
    const spotWant = st.hero >= 0 ? 3.4 : dim > 0.05 ? 5.0 * dim : 0;
    if (spotRef.current) {
      spotRef.current.intensity += (spotWant - spotRef.current.intensity) * Math.min(1, dt * 3.2);
      if (st.hero >= 0) spotRef.current.position.set(0.012, st.focus.y + 0.05, st.focus.z + 0.19);
      else spotRef.current.position.set(st.focus.x * 0.5 + 0.02, st.focus.y + 0.14, st.focus.z + 0.14);
    }
    if (spotTargetRef.current) spotTargetRef.current.position.lerp(st.focus, Math.min(1, dt * 4));

    // ---- camera choreography --------------------------------------------
    if (f.orbit) {
      const target = new THREE.Vector3(0, CENTER_Y, 0);
      camera.position.set(
        target.x + f.orbitRadius * Math.sin(f.orbitPhi) * Math.sin(f.orbitTheta),
        target.y + f.orbitRadius * Math.cos(f.orbitPhi),
        target.z + f.orbitRadius * Math.sin(f.orbitPhi) * Math.cos(f.orbitTheta),
      );
      camera.lookAt(target);
    } else {
      if (reframeNext.current) {
        reframeNext.current = false;
        camera.position.set(0, CENTER_Y + 0.006, BASE_Z);
        lookAt.current.set(0, CENTER_Y, 0);
        camera.lookAt(lookAt.current);
        camAim.current = { x: 0, y: CENTER_Y + 0.006, z: BASE_Z, tx: 0, ty: CENTER_Y };
      }
      const a = camAim.current;
      if (st.hero >= 0) {
        const h = pack.reveal.heroCard!.obj.position;
        a.z = 0.204; a.y = h.y * 0.9; a.x = 0;
        a.tx = 0; a.ty = h.y * 0.92;
      } else if (st.phase === 'notice' || st.phase === 'approach' || st.phase === 'reveal' || st.phase === 'present') {
        a.z = 0.266 - dim * 0.03;
        a.x = st.focus.x * 0.42;
        a.y = st.focus.y * 0.82 + 0.004;
        a.tx = st.focus.x * 0.5; a.ty = st.focus.y * 0.88;
      } else if (st.running || st.ready) {
        a.z = 0.264; a.x = 0; a.y = CENTER_Y + 0.022; a.tx = 0; a.ty = CENTER_Y + 0.022;
      } else {
        a.z = BASE_Z - f.shown * 0.014;
        a.x = 0;
        a.y = CENTER_Y + 0.006 + f.shown * 0.012;
        a.tx = 0; a.ty = CENTER_Y + f.shown * 0.012;
      }
      const slow = st.phase === 'notice' || st.phase === 'approach' || st.phase === 'reveal' || st.phase === 'present';
      const sp = Math.min(1, dt * (slow ? 1.1 : 2.6));
      camera.position.x += (a.x - camera.position.x) * sp;
      camera.position.y += (a.y - camera.position.y) * sp;
      camera.position.z += (a.z - camera.position.z) * sp;
      lookAt.current.set(
        lookAt.current.x + (a.tx - lookAt.current.x) * sp,
        lookAt.current.y + (a.ty - lookAt.current.y) * sp,
        0,
      );
      camera.lookAt(lookAt.current);
    }

    // ---- overlay snapshot (throttled to real changes) --------------------
    if (onSnapshot) {
      const heroCard = pack.reveal.heroCard;
      const grail = pack.reveal.cards.find((c) => c.isGrail);
      const labelCard = heroCard ?? (st.phase === 'present' ? grail : null);
      const changed = !lastSnapshot.current
        || lastSnapshot.current.phase !== st.phase
        || lastSnapshot.current.hero !== st.hero
        || lastSnapshot.current.ready !== st.ready
        || Math.abs(lastSnapshot.current.dim - dim) > 0.02
        || Math.abs(lastSnapshot.current.shown - f.shown) > 0.01;
      if (changed) {
        const snap: VaultStateSnapshot = {
          phase: st.phase, hero: st.hero, ready: st.ready, running: st.running, dim, shown: f.shown,
          heroLabel: labelCard ? {
            rarity: `${labelCard.data.rarity} · ${labelCard.data.edition}`,
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
      <hemisphereLight ref={hemiRef} args={[0x231540, 0x05030a, 0.42]} />
      <directionalLight ref={keyRef} color={0xfff3dc} intensity={2.0} position={[0.17, 0.3, 0.3]} castShadow />
      <directionalLight ref={rimRef} color={0x7d4ce0} intensity={1.15} position={[-0.3, 0.12, -0.22]} />
      <directionalLight ref={kickRef} color={0xe8cf9a} intensity={0.5} position={[-0.16, -0.08, 0.26]} />
      <spotLight
        ref={spotRef}
        color={0xfff2d8}
        intensity={0}
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

      {/* Deliberately NOT a child of pack.group (contrast with
          ../../reveal/scene/PackScene.tsx's tear plane): the pack leans a
          few degrees during a tear-reaction and, later, cards fan out to
          the sides — a plane parented to the pack would tilt/track with
          it, moving the touch target under the user's finger. Sitting the
          plane in fixed world space keeps the hit region predictable;
          pack.group.worldToLocal() below still correctly accounts for any
          lean when converting a hit into the pack's own local space. */}
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
});
