import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import type { SharedValue } from 'react-native-reanimated';
import type { CategoryPersonality } from '../../reveal/config/types';
import { buildTenPack } from './buildTenPack';

/**
 * Drives `buildTenPack`'s scene from the same `openProgress` shared value every other category's
 * tear mesh reads (see `PackTearMesh`'s own header) — `setZip` is a pure function of that one
 * number, same drop-in shape.
 *
 * `setSpill` reads that *same* live value, not a separate timer that only starts once the drag
 * finishes — the ten packs rise and tear in real time as the seam passes them, while the finger
 * is still moving, because unzipping the bundle is what tears them, not something that happens
 * afterward as its own animation. Each pack's own built-in stagger (`buildTenPack`'s per-pack
 * `delay`) still spreads them out across the gesture; it just rides the live drag now instead of
 * a fixed post-completion clock. `onSpillComplete` fires once `openProgress` reaches 1 — at that
 * exact value every pack's own interpolation resolves to fully risen regardless of delay, so
 * "the zip finished" and "all ten are torn" land on the same frame.
 *
 * The camera is framed here at runtime, not with hand-picked coordinates: the source design's own
 * camera numbers (tenpack-art.js / the DC file's `cam.position.set(...)`) were tuned against a
 * 1180×760 *landscape* preview — `fov` in three.js is vertical, so on a portrait phone the same
 * numbers leave far too little horizontal room and crop the pouch down to a close-up of one
 * panel, no matter how those specific numbers get adjusted.
 */
export function TenPackMesh({
  openProgress,
  personality,
  onSpillComplete,
}: {
  openProgress: SharedValue<number>;
  personality: CategoryPersonality;
  onSpillComplete: () => void;
}) {
  const scene = useMemo(() => buildTenPack(personality), [personality]);
  const { camera, size } = useThree();
  const spillDone = useRef(false);

  useEffect(() => () => scene.dispose(), [scene]);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (!cam.isPerspectiveCamera) return;

    // Fixed, hand-checked bounds rather than a runtime Box3 measurement of the live scene — a
    // measured fit kept coming out wrong in ways that pointed at the measurement itself being
    // unreliable (the likeliest culprit: Box3.expandByObject walks every child of the group, and
    // the four point lights sit 3-4 units out from center, well past the pouch/packs themselves,
    // silently dragging the "content" bounds out to wherever the light rig happens to be placed).
    // Worked out by hand instead, from the real geometry constants in buildTenPack.ts: the sealed
    // pouch spans roughly x:[-1.42,1.42] y:[0,1.3] z:[-0.63,0.63], and the ten packs at full spill
    // stay inside that same footprint — center ~= (0, 0.6, 0), bounding radius ~= 1.7. What still
    // has to be computed live is the device's own aspect ratio — that's the one thing a fixed,
    // reference-design camera position can never get right on a phone (see this file's own header
    // for why) — so that part is worked out fresh for whatever screen this actually runs on.
    const center = new THREE.Vector3(0, 0.6, 0);
    const radius = 1.7;
    const aspect = size.width / Math.max(1, size.height);
    const vFov = (cam.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    // Distance to fit a sphere of this radius inside a cone of this half-angle — sin, not tan, is
    // the correct relation for fitting a sphere (tan is only exact for a flat plane at that
    // distance). Whichever axis is tighter (usually the horizontal one, on a portrait screen)
    // sets the real distance, with a little headroom so nothing sits right at the frame's edge.
    const distV = radius / Math.sin(vFov / 2);
    const distH = radius / Math.sin(hFov / 2);
    const dist = Math.min(14, Math.max(3, Math.max(distV, distH) * 1.15));

    // The reference's own heading, unchanged (not a guess of mine) — tenpack-art.js's own layout
    // comment is explicit about why it has to be this steep: the packs stand with "torn tops
    // facing up so every rip is visible from above," and the open front lip swings *toward* the
    // camera as it falls open (closer to camera, and nearly as tall as it was sealed) — only a
    // real overhead angle looks past it into the mouth instead of straight into its back. A
    // shallower, more eye-level angle (tried in an earlier pass) looked calmer, but from that
    // height the open lip hides most of what's actually supposed to be the payoff: the ten torn
    // packs themselves.
    const dir = new THREE.Vector3(1, 0.55, 1.25).normalize();
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(center);
    cam.near = Math.max(dist / 100, 0.01);
    cam.far = dist * 10;
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useFrame((state) => {
    scene.tick(state.clock.elapsedTime);

    const zipP = openProgress.value;
    scene.setZip(zipP);
    scene.setSpill(zipP);

    if (zipP >= 1 && !spillDone.current) {
      spillDone.current = true;
      onSpillComplete();
    }
  });

  return <primitive object={scene.group} />;
}
