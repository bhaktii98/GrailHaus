import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { spring } from "../theme/tokens";

/** Direct port of rn/src/components/Dots.js — page dots where the active one stretches into a bar. */
export function Dots({ count, index, onPick }: { count: number; index: number; onPick?: (i: number) => void }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, i) => (
        <Pressable key={i} onPress={() => onPick?.(i)} hitSlop={10}>
          <Dot on={i === index} />
        </Pressable>
      ))}
    </View>
  );
}

function Dot({ on }: { on: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withSpring(on ? 28 : 9, spring.cards),
    backgroundColor: on ? "#fff" : "rgba(255,255,255,0.24)",
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 7 },
  dot: { height: 9, borderRadius: 5 },
});
