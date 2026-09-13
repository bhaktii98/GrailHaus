// Touch-driven "look at it from every side" exploration — RevealEngine's own generic add-on
// (not a watches-specific feature), active once a reveal has actually settled: drag to orbit the
// piece around its own center (1:1 with the finger, exactly like every other gesture in this
// app — no easing/snapping the drag itself, see instructions.md's own gesture-physics bar),
// pinch to zoom in on it, and double-tap to step through fixed zoom stops (and back out again —
// see ZOOM_STOPS for why pinch alone can't cover the useful range on a phone). Distinct from
// GestureLayer's own Pan (which drives the tear/lift gesture and is only meaningful before a
// reveal settles) — this is a second, separate gesture scoped to after that, never active at the
// same time.
import { type ReactNode, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { useFrame } from "@react-three/fiber/native";
import type { Group } from "three";

const YAW_SENSITIVITY = 0.008;
const PITCH_SENSITIVITY = 0.008;
// Clamped short of ±90° — past that the piece would flip past vertical and read as "broken," not
// "rotated." A real orbit rig would re-derive up-vector; this is a display piece sitting on a
// fixed base, not a free-floating object, so a bounded tilt is the honest range. Opened up from
// ±0.6 rad (±34°) to ±1.15 rad (±66°), which is what makes it possible to look down into an open
// case or up at a watch's caseback — the previous limit stopped well short of both.
const PITCH_LIMIT = 1.15;
// A genuine inspection range, widened from 0.7-1.7.
//
// Two things were wrong with the old bounds. The floor of 0.7 meant a reveal that already framed
// its subject tightly could barely be pulled back at all — there was no way to see a whole object
// at once if the scripted camera had moved in on part of it. And the ceiling of 1.7 is simply not
// a magnification: at 1.7x a 0.8mm bezel flute is still 1.4mm, so "pinch to zoom" produced a
// slightly larger version of the same view rather than letting anyone actually look at the
// finishing. 0.35-6.0 covers both ends — a full pull-back to the whole piece in frame, and a close
// enough approach to read dial furniture and case chamfers.
//
// This is safe to widen for every category rather than just the vault: the scale applies to the
// reveal's own group, and each category's mesh already establishes its own base scale (see e.g.
// WatchMesh's CASE_SCALE), so the multiplier composes with whatever framing that category chose.
// Close approach does require a camera whose near plane allows it — a category modelling at true
// real-world scale should declare `camera.near` (see CategoryRevealConfig.camera).
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 6.0;
// Pinch alone tops out at whatever span a thumb and finger can travel in one gesture, which on a
// phone is well short of a 17x range. Double-tap steps through a few fixed stops so the far end of
// that range is reachable without a dozen repeated pinches — and so a user who has zoomed in and
// lost their bearings has one obvious way back out.
const ZOOM_STOPS = [1, 2.2, 4.2];
const ZOOM_RESET_EPSILON = 0.02;

export interface ExploreOrbitHandle {
  yaw: SharedValue<number>;
  pitch: SharedValue<number>;
  zoom: SharedValue<number>;
}

export function useExploreOrbit(): ExploreOrbitHandle {
  const yaw = useSharedValue(0);
  const pitch = useSharedValue(0);
  const zoom = useSharedValue(1);
  return { yaw, pitch, zoom };
}

/** The touch surface — rendered as a sibling *on top of* the Canvas (same reason GestureLayer's
 * own Pan gesture had to move to an overlay-sibling instead of a wrapping parent: an r3f native
 * Canvas hardcodes its own PanResponder internally, which wins the touch-responder race over an
 * ancestor GestureDetector every time). Only ever mounted while `active`, so it never contests
 * GestureLayer's own tear/lift gesture beforehand. */
export function ExploreOrbitSurface({ handle, active }: { handle: ExploreOrbitHandle; active: boolean }) {
  const { yaw, pitch, zoom } = handle;
  const baseYaw = useSharedValue(0);
  const basePitch = useSharedValue(0);
  const baseZoom = useSharedValue(1);

  if (!active) return null;

  const pan = Gesture.Pan()
    .onStart(() => {
      "worklet";
      baseYaw.value = yaw.value;
      basePitch.value = pitch.value;
    })
    .onUpdate((e) => {
      "worklet";
      yaw.value = baseYaw.value + e.translationX * YAW_SENSITIVITY;
      pitch.value = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, basePitch.value - e.translationY * PITCH_SENSITIVITY));
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      "worklet";
      baseZoom.value = zoom.value;
    })
    .onUpdate((e) => {
      "worklet";
      zoom.value = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, baseZoom.value * e.scale));
    });

  // Double-tap steps through ZOOM_STOPS and then back to 1 (see those constants' own note on why
  // pinch alone cannot cover the full range on a phone). Written with `withTiming` rather than a
  // bare assignment because this is the one zoom change the user does not drive frame by frame —
  // a pinch should track the fingers exactly, but a tap has no ongoing input to track, so an
  // instant jump would read as a glitch rather than a move.
  //
  // Also the way back: from anywhere at or past the last stop, the next double-tap returns to 1,
  // so a user who has zoomed deep into a dial always has a single gesture back to the whole piece
  // without having to pinch out repeatedly.
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(260)
    .onEnd((_e, success) => {
      "worklet";
      if (!success) return;
      const current = zoom.value;
      let next = 1;
      for (let i = 0; i < ZOOM_STOPS.length; i++) {
        // The epsilon guards against floating-point drift leaving `zoom` a hair under a stop it
        // has effectively reached, which would otherwise make one tap appear to do nothing.
        if (current < ZOOM_STOPS[i] - ZOOM_RESET_EPSILON) {
          next = ZOOM_STOPS[i];
          break;
        }
      }
      zoom.value = withTiming(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next)), { duration: 260 });
    });

  return (
    // The double-tap is composed with `Exclusive` against the pan so a tap is never also read as a
    // zero-distance drag; pinch stays simultaneous with both, since a two-finger pinch and a
    // one-finger orbit genuinely can overlap.
    <GestureDetector gesture={Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, pan))}>
      <View style={StyleSheet.absoluteFill} />
    </GestureDetector>
  );
}

/** Goes *inside* the Canvas, wrapping whatever `config.buildMesh` returned, applying the
 * gesture's current yaw/pitch/zoom every frame — a plain ref + useFrame, the same
 * read-a-shared-value-from-the-JS-thread-render-loop pattern this file's sibling meshes already
 * use, not a second animation system. Doesn't touch anything inside `children` — a mesh's own
 * internal scale (e.g. WatchMesh's CASE_SCALE) composes with this rather than being replaced by it. */
export function ExploreOrbitGroup({ handle, children }: { handle: ExploreOrbitHandle; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.rotation.y = handle.yaw.value;
    ref.current.rotation.x = handle.pitch.value;
    ref.current.scale.setScalar(handle.zoom.value);
  });
  return <group ref={ref}>{children}</group>;
}
