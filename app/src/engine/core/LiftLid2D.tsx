// The 2D fallback for the "lift-lid" gesture mode, RevealEngine's own counterpart to
// PackTear2D (engine/cards/reveal/PackTear2D.tsx) — same job (Renderer3DBoundary swaps this in
// when the 3D Canvas throws, or is already known-broken this session), same contract (only ever
// *reads* `openProgress`, never touches gesture physics — GestureLayer already owns 1:1 tracking,
// reversible mid-drag, velocity-aware completion, interruption). What changes is purely how the
// lift is drawn: a hinged lid rectangle rotating open in plain RN Views + Reanimated, via the
// same perspective/rotateX + pivot-shift technique the card flip elsewhere in this app already
// uses, instead of a real 3D mesh.
//
// Deliberately generic (no watch-specific silhouette) — RevealEngine is shared by every
// non-"cards" category (today: watches; a category added later that also picks a `lift-lid`
// archetype gets this for free), so the only per-category input is color, matching PackTear2D's
// own "branding is a prop, not baked in" rule.
import { useWindowDimensions } from "react-native";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

export function LiftLid2D({
  openProgress,
  accentColor,
  caseColor,
}: {
  openProgress: SharedValue<number>;
  /** The category's own configured palette accent — the interior glow and lid trim. */
  accentColor: string;
  /** The category's configured background — the case body itself is a shade of this, not a
   * hardcoded color, so a category with a very different palette doesn't get an oddly mismatched
   * fallback box. */
  caseColor: string;
}) {
  const { width } = useWindowDimensions();
  const caseW = Math.min(240, width * 0.62);
  const caseH = caseW * 0.62;
  const lidH = caseH * 0.42;

  // Rotates around the lid's own back/bottom edge (the hinge line), not its center — the
  // standard translate/rotate/translate trick for an off-center pivot in a transform list that
  // has no native `transformOrigin`: shift down by half the lid's height so that edge sits at
  // the local origin, rotate, then shift back.
  const lidStyle = useAnimatedStyle(() => {
    const angle = interpolate(openProgress.value, [0, 1], [0, -108], Extrapolation.CLAMP);
    return {
      transform: [
        { perspective: 500 },
        { translateY: lidH / 2 },
        { rotateX: `${angle}deg` },
        { translateY: -lidH / 2 },
      ],
    };
  });

  // The interior glow only reads once the lid has actually swung clear of the opening — matches
  // the 3D mesh's own "light spills in" beat (see WatchMesh's interior point light).
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0.2, 0.55], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.root}>
      <View style={[styles.caseWrap, { width: caseW, height: caseH }]}>
        <View
          style={[
            styles.caseBody,
            { width: caseW, height: caseH - lidH, borderColor: `${accentColor}66`, backgroundColor: caseColor },
          ]}
        >
          <Animated.View style={[styles.glow, { backgroundColor: `${accentColor}33` }, glowStyle]} />
        </View>
        <Animated.View
          style={[
            styles.lid,
            { width: caseW, height: lidH, borderColor: `${accentColor}88`, backgroundColor: caseColor },
            lidStyle,
          ]}
        >
          <View style={[styles.lidTrim, { backgroundColor: accentColor }]} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  caseWrap: { alignItems: "center" },
  caseBody: {
    position: "absolute",
    bottom: 0,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    width: "70%",
    height: "70%",
    borderRadius: 999,
  },
  lid: {
    position: "absolute",
    top: 0,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  lidTrim: {
    width: "40%",
    height: 4,
    borderRadius: 2,
    opacity: 0.8,
  },
});
