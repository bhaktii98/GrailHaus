import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ink } from "../theme/tokens";

/**
 * Ported from rn/src/components/Screen.js. Every screen sits on the same
 * washed ground: a category glow bled in from the top, falling to near-black
 * — one component so the wash is identical everywhere. The reference version
 * also renders its own <StatusBar>; ours is set once, globally, in App.tsx
 * via expo-status-bar, so it's deliberately omitted here to avoid a second
 * competing status-bar declaration per screen.
 */
export function Screen({
  glow,
  intensity = 0.3,
  children,
}: {
  glow?: string;
  intensity?: number;
  children: ReactNode;
}) {
  return (
    <View style={styles.root}>
      {glow ? (
        <LinearGradient
          colors={[`rgba(${glow},${intensity})`, ink.ground, ink.groundDeep]}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ink.ground },
});
