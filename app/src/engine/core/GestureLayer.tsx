import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import type { CategoryRevealConfig } from "./types";

interface GestureLayerProps {
  gesture: CategoryRevealConfig["gesture"];
  onComplete: () => void;
  children: (openProgress: SharedValue<number>) => ReactNode;
  /** True by default. Once a caller has its own reason to stop listening for this gesture (e.g.
   * RevealEngine, once the tear/lift is done and a *different* gesture — ExploreOrbit's own drag-
   * to-rotate — takes over the same screen region), pass false to drop just the touch-catching
   * overlay below, not `children` itself: unmounting `children` here would tear down and rebuild
   * the whole Canvas subtree (losing every ref/animation-state the 3D mesh was holding, since it's
   * a fresh instance in a fresh position in the tree), where all that's actually needed is for
   * this gesture to stop competing for the same touches as whatever comes after it. */
  enabled?: boolean;
}

/**
 * The one gesture implementation every category shares: 1:1 tracking (the
 * object follows the finger directly, never animates to a preset),
 * reversible mid-drag (progress is always derived from current translation,
 * never accumulated), velocity-aware completion (a flick finishes even
 * short of full travel), and interruptible (a new gesture simply starts
 * driving `openProgress` again, overriding any in-flight settle animation).
 * `config.gesture.mode` only changes which axis it reads — the physics are
 * identical across categories.
 *
 * The `GestureDetector` used to *wrap* `children` as a parent — correct-looking, but wrong
 * whenever `children` is (or contains) an `@react-three/fiber` native `<Canvas>`: that component
 * hardcodes its own `PanResponder` directly in its GL-context-creation callback (confirmed by
 * reading the installed library's own source — nothing about this is gated behind its `events`
 * prop, so there's no config-level way to turn it off) and spreads those handlers onto an overlay
 * `View` sitting on top of the GL surface, *inside* the Canvas's own tree. As a descendant of the
 * GestureDetector's view, that inner PanResponder view could still win the RN touch-responder
 * race for itself, and once RN's legacy responder system claims a touch that way, RNGH's native
 * recognizer on the ancestor never gets it — the drag "genuinely never reached it," not a canvas
 * config problem. Rendering the GestureDetector's own transparent view as a *sibling on top of*
 * `children` instead (last in this View's stacking order, so it's frontmost) means RNGH claims
 * every touch in this region for itself before it can ever reach whatever the Canvas does
 * internally beneath it — nothing below it is deep enough in the responder chain to contest that.
 */
export function GestureLayer({ gesture, onComplete, children, enabled = true }: GestureLayerProps) {
  const openProgress = useSharedValue(0);
  const axis = gesture.mode === "tear" ? "x" : "y";

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      "worklet";
      const raw = axis === "x" ? event.translationX : -event.translationY;
      openProgress.value = Math.max(0, Math.min(1, raw / gesture.travelDistance));
    })
    .onEnd((event) => {
      "worklet";
      const velocity = axis === "x" ? event.velocityX : -event.velocityY;
      const completed = velocity > gesture.velocityThreshold || openProgress.value >= 1;
      if (completed) {
        openProgress.value = withTiming(1, { duration: 180 });
        runOnJS(onComplete)();
      } else {
        openProgress.value = withSpring(0);
      }
    });

  return (
    <View style={{ flex: 1 }}>
      {children(openProgress)}
      {enabled && (
        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      )}
    </View>
  );
}
