import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { accents, colors, radii, shadow, spacing, typography } from "../theme/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const VARIANTS = {
  violet: accents.cards,
  gold: accents.watches,
};

export function GlossyButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "violet",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: keyof typeof VARIANTS;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const palette = VARIANTS[variant];
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      style={[shadow.glow(palette.glow), animatedStyle, isDisabled && styles.disabled]}
      onPressIn={() => !isDisabled && (scale.value = withSpring(0.96, { damping: 15 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 15 }))}
      onPress={onPress}
      disabled={isDisabled}
    >
      <LinearGradient colors={[palette.top, palette.bottom]} style={styles.wrap}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
    borderBottomWidth: 4,
    borderBottomColor: "rgba(0,0,0,0.38)",
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...typography.buttonLabel,
    color: "#fff",
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.32)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  disabled: { opacity: 0.5 },
});
