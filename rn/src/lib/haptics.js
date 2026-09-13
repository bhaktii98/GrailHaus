import * as Haptics from 'expo-haptics';

// Cards spend their haptic budget on frequency. Watches spend it on silence.
export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
export const give = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
export const soft = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);

// The chase-pull beat: two heavy hits 40ms apart.
export function chase() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 40);
}

// Escalating ladder under the slow burn before a rare flip.
export function ladder(steps, ms) {
  const n = steps || 7;
  const gap = (ms || 1600) / n;
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      Haptics.impactAsync(
        i < n - 2 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
      );
    }, i * gap);
  }
}
