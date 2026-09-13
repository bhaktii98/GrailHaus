import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { shadow, typography } from "../theme/tokens";

interface Accent {
  c1: string;
  c2: string;
  glow: string;
}

/**
 * Watches' opposite number to GameButton: a flat CTA with a soft cast glow
 * instead of a chunky bevelled "sink" shadow, no press-sink translation, no
 * spring overshoot — matching `spring.watches`'/the mockup's "nothing bounces"
 * rule. Kept as its own component rather than a `tone` prop on GameButton so
 * neither button has to branch its very different shadow/press mechanics.
 */
export function QuietButton({
  label,
  accent,
  onPress,
  dark,
  style,
  right,
}: {
  label: string;
  accent: Accent;
  onPress: () => void;
  dark?: boolean;
  style?: ViewStyle;
  right?: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={[shadow.softGlow(accent.glow), style]}>
      <LinearGradient colors={[accent.c1, accent.c2]} style={styles.btn}>
        <Text style={[styles.label, dark ? { color: "#1A1206" } : null]}>{label}</Text>
        {right ? <View style={styles.right}>{right}</View> : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,240,200,0.5)",
  },
  label: typography.quietButtonLabel,
  right: { marginLeft: 12 },
});
