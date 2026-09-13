import * as Haptics from "expo-haptics";
import { playSfx } from "../../lib/sfx";
import type { HapticStep } from "./types";

const play: Record<HapticStep["kind"], () => Promise<void> | void> = {
  light: () => {
    playSfx("light");
    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  medium: () => {
    playSfx("medium");
    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  heavy: () => {
    playSfx("heavy");
    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
  success: () => {
    playSfx("success");
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
};

/** Schedules a sequenced haptic track (not a single buzz-on-success). Returns a canceller. */
export function playHapticTrack(steps: HapticStep[]): () => void {
  const timers = steps.map((step) => setTimeout(() => play[step.kind](), step.atMs));
  return () => timers.forEach(clearTimeout);
}
