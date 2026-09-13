// The full pointer state machine from grailhaus-vault-break.html's
// `<script type=module>` block — tear-the-seam, then (once sealed → open)
// tap-to-inspect / drag-to-rotate / flip / orbit — re-based onto r3f's own
// raycasted pointer events for the same reason as
// ../../reveal/gesture/useTearGesture.ts (see that file's header): one
// event system per view, not two competing responders.
//
// Differences from the original's mouse/wheel-shaped controls, called out
// here rather than left silent (mirrors the project README's own
// practice):
//   - `wheel` (desktop-only zoom of the inspected card) has no mobile
//     equivalent, so two-finger pinch drives `reveal.zoomHero` instead.
//   - `dblclick` (flip the inspected card) becomes a same-card double-tap,
//     detected here since RN has no native double-tap event on r3f's
//     pointer stream.
//   - free orbit (the "Orbit" pill) used three.js's OrbitControls addon,
//     which is DOM-only. Single-finger drag drives a small hand-rolled
//     spherical orbit here instead; pinch dollies the camera in/out.
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createVaultHapticTrack } from '../haptics/vaultHapticTrack';
import type { BuiltVaultPack } from '../engine/buildVaultPackObject';
import type { VaultBreakPersonality } from '../config/types';

const FLICK_THRESHOLD = 3.0; // fraction-of-seam per second; see useTearGesture.ts's note

export interface VaultFrameState {
  shown: number;
  dragging: boolean;
  energy: number;
  pullX: number;
  orbit: boolean;
  orbitTheta: number;
  orbitPhi: number;
  orbitRadius: number;
}

interface PointerRec {
  localX: number;
  localY: number;
  planeX: number;
  planeY: number;
}

export function useVaultInteraction(pack: BuiltVaultPack, personality: VaultBreakPersonality) {
  const track = useMemo(() => createVaultHapticTrack(personality.haptics), [personality]);
  const s = useRef({
    progress: 0, shown: 0, dragging: false, vel: 0, energy: 0,
    grabStart: 0, lastFrac: 0, lastT: 0, ticks: -1,
    spring: { live: false, target: 0, v: 0 },

    pointers: new Map<number, PointerRec>(),
    tearPid: null as number | null,
    heroPid: null as number | null,
    orbitPid: null as number | null,
    pinchPids: [] as number[],
    pinchStartDist: 0,

    lastTapT: 0, lastTapCard: -1,

    orbit: false,
    orbitTheta: 0, orbitPhi: 0.35, orbitRadius: 0.32,
  }).current;

  const { W, H } = pack.size;
  const seamY = pack.seamY;

  const rawAt = (localX: number) => Math.min(1, Math.max(0, (localX + W / 2) / W));
  const onStripY = (localY: number) => {
    const span = H / 2 - seamY;
    const pad = span * 0.6;
    return localY >= seamY - pad && localY <= H / 2 + pad;
  };

  const toggleOrbit = (on: boolean) => {
    s.orbit = on;
  };

  const reseal = () => {
    s.progress = 0; s.shown = 0; s.dragging = false; s.vel = 0; s.energy = 0;
    s.spring.live = false; s.spring.v = 0; s.spring.target = 0;
    s.heroPid = null;
    pack.reveal.setHero(-1);
    track.reset();
  };

  // ---- pointer lifecycle --------------------------------------------------
  const onPointerDown = (pointerId: number, localXY: { x: number; y: number }, planeXY: { x: number; y: number }, ray: THREE.Ray) => {
    s.pointers.set(pointerId, { localX: localXY.x, localY: localXY.y, planeX: planeXY.x, planeY: planeXY.y });

    if (s.orbit) {
      if (s.pointers.size === 1) {
        s.orbitPid = pointerId;
      } else if (s.pointers.size === 2) {
        s.pinchPids = Array.from(s.pointers.keys());
        s.pinchStartDist = pinchDistance(s);
      }
      return;
    }

    if (s.pointers.size === 2) {
      // second finger down mid-interaction: hand off to pinch (zoom the
      // hero card if one is up, otherwise ignored)
      s.pinchPids = Array.from(s.pointers.keys());
      s.pinchStartDist = pinchDistance(s);
      s.tearPid = null;
      return;
    }

    if (pack.reveal.state.ready) {
      const i = pack.reveal.pick(ray);
      if (i >= 0) {
        const now = Date.now();
        const isDoubleTap = i === s.lastTapCard && now - s.lastTapT < 320;
        s.lastTapT = now; s.lastTapCard = i;
        pack.reveal.setHero(i);
        s.heroPid = pointerId;
        track.onCardPicked();
        if (isDoubleTap) pack.reveal.flipHero();
      } else if (pack.reveal.state.hero >= 0) {
        pack.reveal.setHero(-1);
      }
      return;
    }

    if (s.progress >= 1) return;
    if (!onStripY(localXY.y)) return;
    s.tearPid = pointerId;
    s.dragging = true;
    s.vel = 0;
    s.lastFrac = rawAt(localXY.x);
    s.lastT = Date.now();
    s.grabStart = rawAt(localXY.x);
    s.spring.live = false; s.spring.v = 0;
    track.onGrab();
  };

  const onPointerMove = (pointerId: number, localXY: { x: number; y: number }, planeXY: { x: number; y: number }) => {
    const rec = s.pointers.get(pointerId);
    if (rec) { rec.localX = localXY.x; rec.localY = localXY.y; rec.planeX = planeXY.x; rec.planeY = planeXY.y; }

    if (s.pinchPids.length === 2 && s.pinchPids.includes(pointerId)) {
      const dist = pinchDistance(s);
      if (dist > 0 && s.pinchStartDist > 0) {
        const ratio = dist / s.pinchStartDist;
        s.pinchStartDist = dist;
        const d = -(ratio - 1); // zoomHero(d): negative d zooms in, matching wheel's deltaY sign
        if (s.orbit) {
          s.orbitRadius = Math.min(0.6, Math.max(0.12, s.orbitRadius * (1 - d)));
        } else if (pack.reveal.state.hero >= 0) {
          pack.reveal.zoomHero(d);
        }
      }
      return;
    }

    // Orbit-rotate and hero-card-rotate deltas are computed by the caller
    // (scene/VaultScene.tsx) from its own before/after plane position and
    // applied via dragDelta() — this handler only needs to update the
    // bookkeeping above (for pinch distance) and drive the tear.
    if (s.orbitPid === pointerId || s.heroPid === pointerId) return;

    if (s.tearPid !== pointerId) return;
    const now = Date.now();
    const dtSec = Math.max(0.001, (now - s.lastT) / 1000);
    const frac = rawAt(localXY.x);
    s.vel = (frac - s.lastFrac) / dtSec;
    s.lastFrac = frac; s.lastT = now;

    const raw = Math.max(0, frac - s.grabStart);
    const S = personality.tear.stretch;
    s.progress = S > 0 ? Math.min(1, Math.max(0, (raw - S) / (1 - S))) : Math.min(1, raw);
    pack.setStretch(S > 0 ? Math.min(1, raw / S) * (raw < S ? 1 : 0.25) : 0, s.grabStart + raw);
    s.energy = Math.min(1, s.energy + Math.abs(s.vel) * 0.06);
    track.onProgress(s.progress, true);
  };

  /** Screen-fraction-ish drag delta for orbit rotate / hero rotate,
   * computed by the caller from the interaction plane's own local space
   * (see VaultScene.tsx) so it never depends on ambiguous native pointer
   * fields. */
  const dragDelta = (pointerId: number, dx: number, dy: number) => {
    if (s.orbit && s.orbitPid === pointerId) {
      s.orbitTheta -= dx * 3.2;
      s.orbitPhi = Math.min(1.4, Math.max(-1.4, s.orbitPhi - dy * 2.4));
      return;
    }
    if (s.heroPid === pointerId && pack.reveal.state.hero >= 0) {
      pack.reveal.dragHero(dx, dy);
    }
  };

  const onPointerUp = (pointerId: number) => {
    s.pointers.delete(pointerId);
    if (s.pinchPids.includes(pointerId)) {
      s.pinchPids = s.pinchPids.filter((id) => id !== pointerId);
      s.pinchStartDist = 0;
    }
    if (s.orbitPid === pointerId) s.orbitPid = null;
    if (s.heroPid === pointerId) {
      s.heroPid = null;
      pack.reveal.endDrag();
      return;
    }
    if (s.tearPid !== pointerId) return;
    s.tearPid = null;
    s.dragging = false;
    pack.setStretch(0, 0);
    const flick = Date.now() - s.lastT > 90 ? 0 : s.vel;
    s.spring.v = flick;
    const reach = Math.max(0.12, 1 - s.grabStart);
    const completing = s.progress > personality.tear.releaseFrac * reach || Math.abs(flick) > FLICK_THRESHOLD;
    s.spring.target = completing ? 1 : 0;
    s.spring.live = true;
    if (completing) track.onCommit();
  };

  const onPointerCancel = (pointerId: number) => onPointerUp(pointerId);

  const update = (dt: number): VaultFrameState => {
    if (s.dragging) {
      s.shown = s.progress;
    } else if (s.spring.live) {
      const k = personality.tear.springK;
      const c = 2 * Math.sqrt(k) * personality.tear.damping;
      s.spring.v += ((s.spring.target - s.shown) * k - s.spring.v * c) * dt;
      s.shown += s.spring.v * dt;
      if (Math.abs(s.spring.target - s.shown) < 0.002 && Math.abs(s.spring.v) < 0.02) {
        s.shown = s.spring.target; s.spring.v = 0; s.spring.live = false;
      }
      s.shown = Math.min(1, Math.max(0, s.shown));
      s.progress = s.shown;
    }
    s.energy *= Math.pow(0.02, dt);
    return {
      shown: s.shown,
      dragging: s.dragging,
      energy: s.dragging ? 0.5 + s.energy : s.energy,
      pullX: s.dragging ? Math.max(-1, Math.min(1, s.vel * 0.3)) : 0,
      orbit: s.orbit,
      orbitTheta: s.orbitTheta,
      orbitPhi: s.orbitPhi,
      orbitRadius: s.orbitRadius,
    };
  };

  return {
    onPointerDown, onPointerMove, onPointerUp, onPointerCancel, dragDelta,
    update, toggleOrbit, reseal,
  };
}

function pinchDistance(s: { pinchPids: number[]; pointers: Map<number, PointerRec> }): number {
  if (s.pinchPids.length < 2) return 0;
  const a = s.pointers.get(s.pinchPids[0]);
  const b = s.pointers.get(s.pinchPids[1]);
  if (!a || !b) return 0;
  return Math.hypot(a.planeX - b.planeX, a.planeY - b.planeY);
}

export type VaultInteraction = ReturnType<typeof useVaultInteraction>;
