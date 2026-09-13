// Gesture physics for the tear. Ported from the pointer handlers in
// project/grailhaus-pack.html, but re-based onto react-three-fiber's own
// raycasted pointer events instead of screen-space camera projection.
//
// Why: @react-three/fiber's native Canvas (see scene/PackScene.tsx) already
// raycasts pointer input against the scene and hands handlers a 3D
// intersection point — react-native-gesture-handler would be a second,
// competing touch-responder system layered on the same view (the native
// Canvas installs its own PanResponder internally), so this reads the
// pack-local X directly off r3f's pointer events instead. That also means
// the "seam span" maths the web version needed (mapping a 3D line to
// screen pixels via camera projection) collapses to a single division by
// the pack's own width — the intersection point is already in the pack's
// local units.
//
// The four hard requirements from instructions.md map onto the state
// machine below:
//   - 1:1 finger tracking       → `progress` is set directly from the
//                                  local-space fraction while dragging,
//                                  no smoothing.
//   - reversible mid-gesture    → onPointerUp picks target 0 or 1; the
//                                  underdamped spring can carry the tear
//                                  either direction.
//   - velocity-aware completion → release velocity feeds the spring's
//                                  initial velocity AND lowers the distance
//                                  bar for "did this count as a tear".
//   - interruptible             → onPointerDown cancels any live spring
//                                  outright, so a new touch takes over
//                                  instantly.
import { useMemo, useRef } from 'react';
import { createHapticTrack, type HapticTrack } from '../haptics/hapticTrack';
import type { HapticTrackConfig } from '../config/types';

export interface TearGeometry {
  /** pack width, local units (same space as buildPackObject's SIZE.W) */
  width: number;
  /** pack height */
  height: number;
  /** y of the tear seam, local units */
  seamY: number;
}

export interface TearFrameState {
  shown: number;
  dragging: boolean;
  energy: number;
  /** -1..1, fed into the pack's react() lean */
  pullX: number;
}

// The web prototype's flick threshold was 0.9 screen-px/ms, tuned against
// a ~280px seam span (see its travel()) — roughly 3.2x that span per
// second. Re-expressed directly in "fraction of the seam per second" so it
// doesn't depend on screen size at all.
const FLICK_THRESHOLD = 3.0;

export function useTearGesture(geometry: TearGeometry, hapticsConfig: HapticTrackConfig) {
  const track = useMemo<HapticTrack>(() => createHapticTrack(hapticsConfig), [hapticsConfig]);
  const s = useRef({
    progress: 0,
    shown: 0,
    dragging: false,
    vel: 0, // fraction of seam per second
    energy: 0,
    grabStart: 0,
    lastFrac: 0,
    lastT: 0,
    spring: { live: false, target: 0, v: 0 },
  }).current;

  const rawAt = (localX: number) => Math.min(1, Math.max(0, (localX + geometry.width / 2) / geometry.width));

  // The rip can only start on the tear strip at the top of the pack, not
  // anywhere over the card panel below it. Padding is wider than the web
  // prototype's 0.5x (a mouse pointer is a pixel; a thumbtip isn't — HIG/
  // Material both want a touch target closer to the strip's own height in
  // slack, not half of it).
  const onStripY = (localY: number) => {
    const span = geometry.height / 2 - geometry.seamY;
    const pad = span * 0.6;
    return localY >= geometry.seamY - pad && localY <= geometry.height / 2 + pad;
  };

  const reset = () => {
    s.progress = 0;
    s.shown = 0;
    s.dragging = false;
    s.vel = 0;
    s.energy = 0;
    s.spring.live = false;
    s.spring.v = 0;
    s.spring.target = 0;
    track.reset();
  };

  /** @returns whether the down event started a valid drag */
  const onPointerDown = (localX: number, localY: number): boolean => {
    if (s.progress >= 1) return false;
    if (!onStripY(localY)) return false;
    s.dragging = true;
    s.vel = 0;
    s.lastFrac = rawAt(localX);
    s.lastT = Date.now();
    s.grabStart = rawAt(localX);
    // a new touch takes over instantly, mid-settle or not
    s.spring.live = false;
    s.spring.v = 0;
    return true;
  };

  const onPointerMove = (localX: number) => {
    if (!s.dragging) return;
    const now = Date.now();
    const dtSec = Math.max(0.001, (now - s.lastT) / 1000);
    const frac = rawAt(localX);
    s.vel = (frac - s.lastFrac) / dtSec;
    s.lastFrac = frac;
    s.lastT = now;
    // cut follows the thumb: whatever point of the seam it is over, rips
    s.progress = Math.min(1, Math.max(0, frac - s.grabStart));
    s.energy = Math.min(1, s.energy + Math.abs(s.vel) * 0.02);
    track.onProgress(s.progress, true);
  };

  const onPointerUp = () => {
    if (!s.dragging) return;
    s.dragging = false;
    const flick = s.vel; // fraction/sec
    // carry the gesture's own velocity into the settle; nothing snaps
    s.spring.v = flick;
    const reach = Math.max(0.12, 1 - s.grabStart);
    const completing = s.progress > 0.88 * reach || Math.abs(flick) > FLICK_THRESHOLD;
    s.spring.target = completing ? 1 : 0;
    s.spring.live = true;
    if (completing) track.onCommit();
  };

  /** Advance the settle spring / idle glint decay by dt seconds. Call once
   * per rendered frame from the scene's useFrame. */
  const update = (dt: number): TearFrameState => {
    if (s.dragging) {
      s.shown = s.progress; // 1:1 with the finger
    } else if (s.spring.live) {
      const k = 46;
      const c = 2 * Math.sqrt(k) * 0.62; // underdamped, foil-light
      s.spring.v += ((s.spring.target - s.shown) * k - s.spring.v * c) * dt;
      s.shown += s.spring.v * dt;
      if (Math.abs(s.spring.target - s.shown) < 0.002 && Math.abs(s.spring.v) < 0.02) {
        s.shown = s.spring.target;
        s.spring.v = 0;
        s.spring.live = false;
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
    };
  };

  return { onPointerDown, onPointerMove, onPointerUp, update, reset };
}
