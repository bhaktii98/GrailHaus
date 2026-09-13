import * as Haptics from 'expo-haptics';
import type { HapticTrackConfig } from '../config/types';

// Haptics as a designed track (instructions.md, Deliverable 1): a light
// tick per unit of tear progress while dragging, a sharper "give" impact
// once the foil has visibly started to separate, a heavy "commit" impact
// the instant a flick/drag decides the tear will complete (fires at the
// decision, not when the settle animation finishes drawing), and a success
// notification if the user drags all the way through without releasing.
// Sequenced-platform-haptics baseline (expo-haptics) per the P0 bar — the
// richer CoreHaptics/VibrationEffect composition track is called out in
// the README as unbuilt P1 scope.
export function createHapticTrack(config: HapticTrackConfig) {
  let lastTick = -1;
  let gaveImpact = false;
  let completed = false;

  const fire = (p: Promise<void>) => { p.catch(() => {}); };

  return {
    onProgress(progress: number, dragging: boolean) {
      if (!dragging) return;
      const tick = Math.floor(progress * config.tickCount);
      if (tick !== lastTick) {
        lastTick = tick;
        fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      }
      if (!gaveImpact && progress >= config.giveAt) {
        gaveImpact = true;
        fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
      }
      if (!completed && progress >= config.completeAt) {
        completed = true;
        fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      }
    },
    /** Fired once, at the instant a release/flick commits the tear to
     * completion (not when the spring finishes animating to it). */
    onCommit() {
      if (completed) return;
      fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    },
    reset() {
      lastTick = -1; gaveImpact = false; completed = false;
    },
  };
}

export type HapticTrack = ReturnType<typeof createHapticTrack>;
