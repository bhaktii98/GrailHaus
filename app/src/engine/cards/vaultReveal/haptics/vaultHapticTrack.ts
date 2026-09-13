import * as Haptics from "expo-haptics";
import { playSfx } from "../../../../lib/sfx";
import type { HapticTrackConfig } from "../config/types";

// Ported from card-pack-reveal-prototype/src/vault/haptics/vaultHapticTrack.ts — the original
// web prototype's navigator.vibrate(ms) calls, re-expressed as expo-haptics' sequenced platform
// track. Mapping from the original's vibrate(ms) durations to expo-haptics styles: 5-6ms ->
// Light (per-tick / grab), 8ms -> Medium (card picked up for inspection), 20ms -> Medium (added
// to collection), 38ms -> Heavy (tear commits to completion).
export function createVaultHapticTrack(config: HapticTrackConfig) {
  let lastTick = -1;
  let committed = false;

  const fire = (p: Promise<void>) => { p.catch(() => {}); };

  return {
    onGrab() {
      playSfx("light");
      fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    },
    onProgress(progress: number, dragging: boolean) {
      if (!dragging) return;
      const tick = Math.floor(progress * config.tickCount);
      if (tick !== lastTick) {
        lastTick = tick;
        playSfx("light");
        fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      }
    },
    /** Fired once, at the instant a release/flick commits the tear to completion (not when the
     * settle spring finishes animating to it). */
    onCommit() {
      if (committed) return;
      committed = true;
      playSfx("heavy");
      fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    },
    onCardPicked() {
      playSfx("medium");
      fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    },
    onCollected() {
      playSfx("medium");
      fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    },
    reset() {
      lastTick = -1; committed = false;
    },
  };
}

export type VaultHapticTrack = ReturnType<typeof createVaultHapticTrack>;
