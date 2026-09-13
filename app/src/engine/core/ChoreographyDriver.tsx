// The timeline driver — the engine-side half of the `choreographyMode` seam (see core/types.ts).
//
// This is written once, against `RevealChoreography`, and knows nothing about vaults, watches or
// handbags. It owns exactly four things a category should never have to reimplement:
//
//   1. The clock. Advances `t` while playing, holds it while scrubbing, springs it back on an
//      abandoned drag.
//   2. The gesture hand-off. Maps the shared GestureLayer's 0..1 `openProgress` onto the first
//      `gestureEndS` seconds of the timeline so a drag scrubs the reveal 1:1 with the finger, then
//      hands to the clock once the drag commits.
//   3. Haptics. Fires each beat exactly once as the clock passes it, and never while scrubbing
//      backwards.
//   4. The camera. Applies whatever pose the choreography asks for — snapping while scrubbing,
//      easing while playing.
//
// Everything category-specific arrives as the two bound closures (`pose`, `lights`) plus plain
// data (`timing`). That division is what makes a third category a config change: a new reveal
// supplies its own scene and its own curves, and reuses this entire file unchanged.
//
// WHY POSE AND LIGHTS ARE CALLED DIFFERENTLY WHILE SCRUBBING
//
// A drag is reversible — the user can pull the lid halfway open and let go, and the reveal must
// return to sealed. Geometry can follow that freely because `pose` is a pure function of `t`. The
// *lighting* cannot: the interior illumination coming up is a one-way dramatic beat, and flickering
// it on and off as a thumb wavers looks broken. So a scrub poses only, and the lighting starts
// tracking the timeline the moment the gesture commits. Below `gestureCommitS` the lights stay at
// their resting values, which is exactly where `lights(0)` already put them.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber/native";
import * as THREE from "three";
import { runOnJS, useAnimatedReaction, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { playSfx } from "../../lib/sfx";
import type { HapticStep, RevealChoreography } from "./types";

/** How fast an abandoned drag rewinds to sealed, in timeline-seconds per real second. From the
 * design source's own spring-back rate (vault.js:886 — `T - dt * 3.2`). */
const SPRING_BACK_RATE = 3.2;

/** Per-frame camera approach rate while playing. The design applies a 0.12 lerp per frame
 * (vault.js:662); kept identical so the dolly reads as the same unhurried move. */
const CAMERA_EASE = 0.12;

const playHaptic: Record<HapticStep["kind"], () => void> = {
  light: () => {
    playSfx("light");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  medium: () => {
    playSfx("medium");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  heavy: () => {
    playSfx("heavy");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  success: () => {
    playSfx("success");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};

export type ChoreographyRunState = "scrubbing" | "playing" | "settled";

export interface ChoreographyDriverProps {
  timing: Omit<RevealChoreography, "pose" | "lights">;
  pose: (t: number) => void;
  lights: (t: number) => void;
  /** The shared gesture's 0..1 progress. Read on the UI thread, mirrored to JS only as a scrub
   * position — never as a per-frame React state write. */
  openProgress: SharedValue<number>;
  /** True while the opening gesture is still live (the engine's `phase === "idle"`). */
  gestureActive: boolean;
  /** True once the gesture has committed and the clock should play the remainder. */
  playing: boolean;
  /** Fired when the timeline reaches its end, so the engine can advance to its settled phase. */
  onComplete: () => void;
  /** Optional per-phase label callback, for the engine's own HUD. Called only when the label
   * actually changes, not every frame. */
  onPhaseChange?: (label: string, index: number) => void;
  /** Pacing multiplier. 1 = the choreography's declared duration; >1 compresses it. This is the
   * whole of "bulk mode is a pacing configuration" for a timeline reveal — a 10-pack batch passes
   * a higher scale and the same curves play faster, with no second implementation and no separate
   * batch code path. */
  timeScale?: number;
  /**
   * Hands the camera over to the user.
   *
   * Once a reveal has settled, `ExploreOrbitSurface` lets the user drag to orbit and pinch to zoom,
   * and `ExploreOrbitGroup` applies that as a rotation on the scene. A scripted camera still
   * lerping toward its final keyframe every frame fights that directly — the user rotates the
   * piece and the camera keeps hauling the framing back. The design source has the same hand-off
   * (it flips `controls.enabled` on and stops calling its own `scriptCamera` once inspection
   * begins); this is that flag. Pose and lights keep running, so the piece stays lit and alive
   * while the user inspects it.
   */
  cameraReleased?: boolean;
  /**
   * Fired when a multi-stage reveal moves to a new opening gesture (see
   * `RevealChoreography.gestureStages`).
   *
   * The engine needs this because the *axis* a drag is read on lives in `GestureLayer`, which
   * derives it from the category's `gesture.mode` — one value for the whole reveal. A reveal whose
   * first gesture is horizontal and second vertical has to re-key that layer between stages, and
   * this callback is what tells it when. Single-stage reveals never fire it.
   *
   * Also carries the stage's prompt copy, so the HUD can change its instruction without the engine
   * knowing what any particular reveal's stages are.
   */
  onStageChange?: (stage: { id: string; axis: "x" | "y"; prompt?: string; index: number }) => void;
}

export function ChoreographyDriver({
  timing,
  pose,
  lights,
  openProgress,
  gestureActive,
  playing,
  onComplete,
  onPhaseChange,
  timeScale = 1,
  cameraReleased = false,
  onStageChange,
}: ChoreographyDriverProps) {
  // All mutable per-frame state lives in refs: this component renders nothing and must never
  // re-render from the animation, or a 12-second reveal would cost ~750 React commits.
  const t = useRef(0);
  const scrubT = useRef(0);
  const firedHaptics = useRef<Set<number>>(new Set());
  const phaseIndex = useRef(-1);
  const completed = useRef(false);
  const springingBack = useRef(false);
  const camPos = useRef(new THREE.Vector3());
  const camTarget = useRef(new THREE.Vector3());
  const camInitialised = useRef(false);
  /** Which opening gesture is live. Always 0 for a single-stage reveal. */
  const stageIndex = useRef(0);
  /** Seconds spent in the current auto-advancing (gesture-less) stage. */
  const autoElapsed = useRef(0);
  const announcedStage = useRef(-1);

  /**
   * The stage list, normalised so the rest of this component has exactly one code path.
   *
   * A single-stage reveal is expressed as one synthetic stage covering `0..gestureEndS` with the
   * config's own commit point. That is what keeps the Reserve and The Archive bit-for-bit
   * unchanged by the addition of stages: they take the same branch, with one entry in it.
   */
  const stages = useMemo(() => {
    if (timing.gestureStages && timing.gestureStages.length > 0) return timing.gestureStages;
    return [
      {
        id: "open",
        axis: "y" as const,
        fromS: 0,
        toS: timing.gestureEndS,
        commitS: timing.gestureCommitS,
        travelDistance: 0,
        velocityThreshold: 0,
      },
    ];
  }, [timing]);

  // Mirror the UI-thread gesture value into a JS ref. `useAnimatedReaction` is the same bridge
  // RevealEngine already uses for its lift-lid drag watcher — it runs on the UI thread and hands
  // JS only the values it asks for, rather than driving React state from a worklet.
  useAnimatedReaction(
    () => openProgress.value,
    (value) => {
      if (!gestureActive) return;
      runOnJS(setScrub)(value);
    },
    [gestureActive]
  );

  function setScrub(value: number) {
    // The drag maps onto the ACTIVE stage's own span, not the whole timeline — so a second gesture
    // scrubs its own slice starting from where the first one left off, rather than rewinding.
    const stage = stages[Math.min(stageIndex.current, stages.length - 1)];
    const u = Math.max(0, Math.min(1, value));
    scrubT.current = stage.fromS + (stage.toS - stage.fromS) * u;
  }

  // A committed gesture stops the spring-back and lets the clock take over from wherever the drag
  // left the timeline, rather than restarting the sequence from zero.
  useEffect(() => {
    if (playing) {
      springingBack.current = false;
      t.current = Math.max(t.current, scrubT.current);
    }
  }, [playing]);

  // Reset when the gesture becomes live again (a fresh item, or a reveal re-entered).
  useEffect(() => {
    if (!gestureActive) return;
    completed.current = false;
    firedHaptics.current.clear();
    phaseIndex.current = -1;
    t.current = 0;
    scrubT.current = 0;
    springingBack.current = false;
    stageIndex.current = 0;
    autoElapsed.current = 0;
    announcedStage.current = -1;
  }, [gestureActive]);

  // Announce the active stage so the engine can re-key its GestureLayer onto the right axis. In an
  // effect rather than inside useFrame, because it drives React state upstream and must not run
  // per frame.
  useEffect(() => {
    if (!onStageChange) return;
    if (announcedStage.current === stageIndex.current) return;
    announcedStage.current = stageIndex.current;
    const stage = stages[Math.min(stageIndex.current, stages.length - 1)];
    onStageChange({ id: stage.id, axis: stage.axis, prompt: stage.prompt, index: stageIndex.current });
  });

  useFrame((state, rawDelta) => {
    // Capped exactly as every other useFrame in this app caps it — a stuttering frame's large
    // delta would otherwise jump the timeline past a haptic beat or a phase boundary.
    const dt = Math.min(0.05, rawDelta) * timeScale;

    let now: number;
    let scrubbing = false;

    const lastStage = stages.length - 1;
    const stage = stages[Math.min(stageIndex.current, lastStage)];
    const isFinalStage = stageIndex.current >= lastStage;
    // A gesture-less stage plays itself: the design's own watched pause while the ribbon settles.
    const autoStage = stage.autoAdvanceAfterS != null;

    if (autoStage && !completed.current) {
      // Play forward across this stage's span with no gesture, then hand to the next stage. The
      // timeline is driven from the stage's own start rather than accumulated, so this cannot
      // drift out of step with the pose functions.
      autoElapsed.current = Math.min(stage.autoAdvanceAfterS as number, autoElapsed.current + dt);
      const u = (stage.autoAdvanceAfterS as number) > 0 ? autoElapsed.current / (stage.autoAdvanceAfterS as number) : 1;
      t.current = stage.fromS + (stage.toS - stage.fromS) * Math.min(1, u);
      now = t.current;
      if (u >= 1) {
        if (isFinalStage) {
          completed.current = true;
          onComplete();
        } else {
          stageIndex.current += 1;
          autoElapsed.current = 0;
          scrubT.current = stages[stageIndex.current].fromS;
        }
      }
    } else if (playing) {
      // `playing` means the active stage's gesture has committed. For a non-final stage that only
      // carries the timeline to that stage's end — the next gesture owns the span after it, and
      // running past would skip a gesture the user has not made yet. Only the last stage plays on
      // to the full duration.
      const ceiling = isFinalStage ? timing.durationS : stage.toS;
      t.current = Math.min(ceiling, t.current + dt);
      now = t.current;
      if (now >= ceiling) {
        if (isFinalStage) {
          if (!completed.current) {
            completed.current = true;
            onComplete();
          }
        } else {
          stageIndex.current += 1;
          autoElapsed.current = 0;
          scrubT.current = stages[stageIndex.current].fromS;
        }
      }
    } else if (gestureActive) {
      // While the finger is down the timeline is the drag's position. On release below the commit
      // point, `playing` never becomes true and the drag value returns to 0 via GestureLayer's own
      // spring — which this follows, so the vault re-seals rather than snapping shut.
      scrubbing = true;
      t.current = scrubT.current;
      now = t.current;
    } else {
      now = t.current;
    }

    pose(now);
    // See the header: lighting only tracks the timeline once the reveal has committed, so a
    // wavering thumb cannot strobe the interior lights.
    if (!scrubbing) lights(now);

    // ---- phase label ---------------------------------------------------------
    if (onPhaseChange) {
      let idx = 0;
      for (let i = timing.phases.length - 1; i >= 0; i--) {
        if (now >= timing.phases[i].fromS) {
          idx = i;
          break;
        }
      }
      if (idx !== phaseIndex.current) {
        phaseIndex.current = idx;
        onPhaseChange(timing.phases[idx].label, idx);
      }
    }

    // ---- haptics -------------------------------------------------------------
    // Only while playing: a scrub that sweeps past four bolt beats in one flick would fire them as
    // an indistinguishable buzz, which is worse than silence. Each beat fires at most once per
    // reveal, tracked by index.
    if (playing && timing.haptics) {
      for (let i = 0; i < timing.haptics.length; i++) {
        const beat = timing.haptics[i];
        if (now >= beat.atS && !firedHaptics.current.has(i)) {
          firedHaptics.current.add(i);
          playHaptic[beat.kind]();
        }
      }
    }

    // ---- camera --------------------------------------------------------------
    // Skipped entirely once released (see `cameraReleased`) — the user's orbit owns the framing
    // from that point, and a scripted lerp would undo every drag.
    const want = cameraReleased ? null : timing.camera?.(now);
    if (want) {
      camPos.current.set(want.position[0], want.position[1], want.position[2]);
      camTarget.current.set(want.target[0], want.target[1], want.target[2]);
      // The first frame snaps rather than easing in from wherever the Canvas's declared camera
      // happened to start — otherwise every reveal opens with an unrequested swoop.
      const ease = !camInitialised.current || scrubbing ? 1 : CAMERA_EASE;
      camInitialised.current = true;
      state.camera.position.lerp(camPos.current, ease);
      state.camera.lookAt(camTarget.current);
    }
  });

  return null;
}
