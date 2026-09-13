import type { DimensionValue } from "react-native";
import { StyleSheet, View } from "react-native";

/**
 * RN has no radial-gradient primitive. Approximates one with three
 * concentric, decreasing-opacity circles centered on `top`/`left` — close
 * enough to the mockup's `radial-gradient(... at 50% Y%, rgba(...), #0B0716 ...)`
 * washes without pulling in a blur/SVG library for a purely decorative glow.
 */
export function RadialGlow({
  rgb,
  peakOpacity,
  top,
  size,
}: {
  rgb: string;
  peakOpacity: number;
  top: DimensionValue;
  size: number;
}) {
  const rings = [
    { scale: 1, opacity: peakOpacity * 0.35 },
    { scale: 0.66, opacity: peakOpacity * 0.65 },
    { scale: 0.36, opacity: peakOpacity },
  ];
  return (
    <View pointerEvents="none" style={[styles.wrap, { top, left: "50%", marginLeft: -size / 2, width: size, height: size }]}>
      {rings.map((r, i) => {
        const ringSize = size * r.scale;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              top: (size - ringSize) / 2,
              left: (size - ringSize) / 2,
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              backgroundColor: `rgba(${rgb},${r.opacity})`,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute" },
});
