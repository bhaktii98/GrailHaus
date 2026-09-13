// The 3D half of the reveal: jeweller's-box lighting (one warm key, a
// violet rim, no flat ambient wash — ported from the <script type=module>
// block in project/grailhaus-pack.html, not three-d-stage.js's neutral
// studio defaults, since the prototype page deliberately overrode them),
// the pack object itself, an invisible hit-plane that turns r3f's raycast
// pointer events into the tear gesture, and the per-frame wiring into the
// engine's setProgress/react/setTime.
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { SkImage } from '@shopify/react-native-skia';
import { buildPackObject, type BuiltPack } from '../engine/buildPackObject';
import type { CategoryPersonality } from '../config/types';
import { useTearGesture } from '../gesture/useTearGesture';

export interface PackSceneHandle {
  /** Hard reset to sealed — used by the "Reseal" button, distinct from the
   * gesture's own spring-back (which only fires from a live drag). */
  reseal: () => void;
}

export interface PackSceneProps {
  personality: CategoryPersonality;
  logo: SkImage | null;
  onShownChange?: (shown: number) => void;
}

export const PackScene = forwardRef<PackSceneHandle, PackSceneProps>(function PackScene(
  { personality, logo, onShownChange },
  ref,
) {
  const pack = useMemo<BuiltPack>(() => buildPackObject(personality, logo), [personality, logo]);
  const lastShown = useRef(-1);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const pointerId = useRef<number | null>(null);

  const tear = useTearGesture(
    { width: pack.size.W, height: pack.size.H, seamY: pack.seamY },
    personality.haptics,
  );

  useEffect(() => {
    const l = keyLightRef.current;
    if (l) {
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.bias = -0.0004;
      Object.assign(l.shadow.camera, { left: -0.12, right: 0.12, top: 0.12, bottom: -0.12 });
      l.shadow.camera.updateProjectionMatrix();
    }
  }, []);

  useEffect(() => () => pack.dispose(), [pack]);

  useImperativeHandle(ref, () => ({
    reseal: () => {
      tear.reset();
      pack.setProgress(0);
      lastShown.current = -1;
      onShownChange?.(0);
    },
  }), [pack, tear, onShownChange]);

  // Local-space X/Y from an r3f pointer event fired on a mesh that is a
  // child of pack.group — .point is world space, so it must be converted
  // back into the group's local frame (the same frame seamY/W live in)
  // before handing it to the gesture hook.
  const localXY = (e: ThreeEvent<PointerEvent>) => {
    const p = pack.group.worldToLocal(e.point.clone());
    return { x: p.x, y: p.y };
  };

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    const { x, y } = localXY(e);
    if (tear.onPointerDown(x, y)) {
      pointerId.current = e.pointerId;
      (e.target as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);
      e.stopPropagation();
    }
  };
  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (pointerId.current !== e.pointerId) return;
    tear.onPointerMove(localXY(e).x);
    e.stopPropagation();
  };
  const handleUp = (e: ThreeEvent<PointerEvent>) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    tear.onPointerUp();
    e.stopPropagation();
  };

  useFrame((state, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const t = tear.update(dt);
    pack.react(dt, t.pullX, t.dragging);
    pack.setProgress(t.shown);
    pack.setTime(state.clock.elapsedTime, t.energy);

    // gentle dolly-in as the pack opens
    state.camera.position.z = 0.205 - t.shown * 0.012;
    state.camera.position.y = 0.006 + t.shown * 0.012;
    state.camera.lookAt(0, t.shown * 0.012, 0);

    if (onShownChange && Math.abs(t.shown - lastShown.current) > 0.001) {
      lastShown.current = t.shown;
      onShownChange(t.shown);
    }
  });

  // Hit-plane: covers the whole pack footprint (not just the visible tear
  // strip), centered on the pack, so a drag that started in the strip
  // keeps tracking even if the finger wanders — matching the web version,
  // which only gated on pointerdown, never on move. Fully transparent but
  // visible=true, since r3f's raycasting skips invisible objects.
  return (
    <>
      <hemisphereLight args={[0x2a1b47, 0x090610, 0.7]} />
      <directionalLight
        ref={keyLightRef}
        color={0xfff0d8}
        intensity={3.0}
        position={[0.16, 0.3, 0.28]}
        castShadow
      />
      <directionalLight color={0x8f5cff} intensity={1.6} position={[-0.28, 0.1, -0.24]} />
      <mesh rotation-x={-Math.PI / 2} position-y={-pack.size.H / 2} receiveShadow>
        <planeGeometry args={[pack.size.W * 6, pack.size.H * 6]} />
        <shadowMaterial opacity={0.4} transparent />
      </mesh>
      <primitive object={pack.group}>
        <mesh
          position={[0, 0, pack.size.T * 3]}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        >
          <planeGeometry args={[pack.size.W * 1.4, pack.size.H * 1.6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
        </mesh>
      </primitive>
    </>
  );
});
