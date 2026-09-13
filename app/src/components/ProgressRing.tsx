import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { fonts, ink } from "../theme/tokens";

/**
 * A simple circular progress indicator that fills over `durationMs` and
 * calls `onComplete` once. Plain React state on a ~50ms tick rather than a
 * Reanimated worklet — this only ever runs once for a couple of seconds
 * (Pack/Vault processing), so the extra plumbing isn't worth it.
 */
export function ProgressRing({
  size = 134,
  strokeWidth = 5,
  durationMs,
  color,
  onComplete,
}: {
  size?: number;
  strokeWidth?: number;
  durationMs: number;
  color: string;
  onComplete?: () => void;
}) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - start) / durationMs) * 100));
      setPercent(p);
      if (p >= 100) {
        clearInterval(id);
        onComplete?.();
      }
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          fill="none"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={[styles.label, { color: ink.text }]}>{percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  label: { position: "absolute", fontFamily: fonts.black, fontSize: 26 },
});
