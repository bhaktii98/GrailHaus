// The 2D fallback for the tear beat, shared by every card-category tier that reaches for one
// (Street Rip and Black Label via CardFlowEngine, Vault Break via VaultTearStage) — same
// `{ openProgress }` signature as PackTearMesh, so each caller's own GestureLayer (via
// Renderer3DBoundary) can swap this in without touching gesture physics at all. Nothing about
// "gesture physics, not gesture detection" changes here: GestureLayer already owns 1:1 tracking,
// reversible mid-drag, velocity-aware completion, and interruption — this component only ever
// *reads* the shared value it's handed, exactly like PackTearMesh does inside its own useFrame.
// What changes is purely how the tear is drawn: plain RN Views + Reanimated instead of a real
// mesh in a GPU-accelerated 3D scene. Branding (colors/wordmark/badge) is a prop, not baked in —
// each tier's own config already owns those, this component has no opinion on which tier it is.
//
// The illusion: PackFace (the same foil face every other flat screen in this app already uses)
// tears free and flies off — translate, rotate, scale, fade, all driven directly by
// `openProgress.value` on the UI thread via useAnimatedStyle, so it tracks the finger at the same
// 1:1 fidelity the 3D mesh does. A revealed card-stack silhouette sits underneath, a jagged tear
// seam flashes at the moment of separation, and a diagonal sheen sweeps the foil as it goes — a
// 2D read of "the foil catches light as it turns," not a literal one.
import { useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { PackFace } from "../../../components/PackFace";

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export function PackTear2D({
  openProgress,
  topColor,
  bottomColor,
  wordmark,
  badge,
}: {
  openProgress: SharedValue<number>;
  topColor: string;
  bottomColor: string;
  wordmark: string;
  badge: string;
}) {
  const { width } = useWindowDimensions();

  const packW = Math.min(240, width * 0.62);
  const packH = packW * (1200 / 800);

  const foilStyle = useAnimatedStyle(() => {
    const p = openProgress.value;
    return {
      opacity: interpolate(p, [0, 0.55, 1], [1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(p, [0, 1], [0, packW * 1.5], Extrapolation.CLAMP) },
        { translateY: interpolate(p, [0, 1], [0, -packH * 0.18], Extrapolation.CLAMP) },
        { rotateZ: `${interpolate(p, [0, 1], [0, 22], Extrapolation.CLAMP)}deg` },
        { scale: interpolate(p, [0, 1], [1, 0.82], Extrapolation.CLAMP) },
      ],
    };
  });

  // A brief flash right as the seam gives — reads as the moment of separation, not a slide.
  const seamStyle = useAnimatedStyle(() => {
    const p = openProgress.value;
    return { opacity: interpolate(p, [0.04, 0.16, 0.32], [0, 1, 0], Extrapolation.CLAMP) };
  });

  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0.3, 0.75], [0, 1], Extrapolation.CLAMP),
  }));

  // Diagonal sheen sweeping across the still-sealed foil — the 2D read of "the foil catches a
  // highlight as it turns," cheap since it's just a translated gradient strip, not real lighting.
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(openProgress.value, [0, 0.5], [-packW, packW * 1.4], Extrapolation.CLAMP) }],
  }));

  const tearTeeth = useMemo(() => Array.from({ length: 14 }), []);

  return (
    <View style={styles.root}>
      {/* Revealed layer: what's "inside" once the foil is gone — a simple stacked-card
          silhouette, not a literal render of the actual pulled cards (those aren't known here,
          this is purely the tear beat; CardFlowEngine's own card-by-card step handles reveal). */}
      <Animated.View style={[styles.reveal, { width: packW, height: packH }, revealStyle]}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.stackCard,
              {
                width: packW * 0.66,
                height: packH * 0.5,
                backgroundColor: i % 2 ? topColor : bottomColor,
                transform: [
                  { translateY: -i * 6 },
                  { rotate: `${(i - 1) * 4}deg` },
                ],
              },
            ]}
          />
        ))}
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.seam,
          { width: packW * 1.1, top: packH * 0.36 },
          seamStyle,
        ]}
      >
        {tearTeeth.map((_, i) => (
          <View key={i} style={[styles.tooth, i % 2 ? styles.toothUp : styles.toothDown]} />
        ))}
      </Animated.View>

      <Animated.View style={[styles.foilWrap, { width: packW, height: packH }, foilStyle]}>
        <PackFace
          art={[topColor, bottomColor]}
          width={packW}
          height={packH}
          radius={16}
          crimp
          tier={badge}
          label={wordmark}
        />
        <AnimatedGradient
          pointerEvents="none"
          colors={["transparent", "rgba(255,255,255,0.5)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={[styles.sheen, { width: packW * 0.4, height: packH }, sheenStyle]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  reveal: { position: "absolute", alignItems: "center", justifyContent: "center" },
  stackCard: {
    position: "absolute",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(232,207,162,0.3)",
  },
  foilWrap: { position: "absolute" },
  sheen: { position: "absolute", left: 0, top: 0 },
  seam: {
    position: "absolute",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tooth: {
    width: 6,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  toothUp: { marginTop: -5 },
  toothDown: { marginTop: 5 },
});
