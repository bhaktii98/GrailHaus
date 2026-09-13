import { useState } from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { buttonShadow, typography } from "../theme/tokens";

interface Accent {
  c1: string;
  c2: string;
  glow: string;
}

/**
 * Direct port of rn/src/components/GameButton.js — the chunky bottom-shadowed
 * button. Press sinks it into its own shadow; the shadow is a sibling view,
 * not a box-shadow, because RN has no inset shadow. Kept as its own
 * component rather than merged into the existing GlossyButton (used by
 * AuthScreen with a different, narrower API) to avoid disturbing that screen.
 */
export function GameButton({
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
  const [down, setDown] = useState(false);

  return (
    <View style={[{ paddingBottom: 6 }, style]}>
      <View style={styles.sink} />
      <Pressable
        onPressIn={() => setDown(true)}
        onPressOut={() => setDown(false)}
        onPress={onPress}
        style={[{ transform: [{ translateY: down ? 6 : 0 }] }, buttonShadow(accent.glow)]}
      >
        <LinearGradient colors={[accent.c1, accent.c2]} style={styles.btn}>
          <Text style={[styles.label, dark ? { color: "#1A1206" } : null]}>{label}</Text>
          {right ? <View style={styles.right}>{right}</View> : null}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sink: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  btn: {
    height: 60,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
  },
  label: {
    ...typography.chunkyButtonLabel,
    textShadowColor: "rgba(0,0,0,0.32)",
    textShadowRadius: 0,
    textShadowOffset: { width: 0, height: 2 },
  },
  right: { marginLeft: 12 },
});
