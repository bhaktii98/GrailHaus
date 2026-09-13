import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

/**
 * A card's art tile — the cards-world equivalent of WatchDial. Approximates the mockup's
 * `radial-gradient(58% 42% at 50% 38%, ...)` card face with a top-to-bottom linear gradient
 * (RN has no radial-gradient primitive) plus the same diagonal shine sweep PackTile uses, so
 * every card face in the app — shelf, binder, listing — reads as one consistent material.
 *
 * `imageUrl` (real Pokémon TCG API artwork, matched by species — see items.repository.ts)
 * replaces the flat gradient background with an actual photo; the shine sweep still layers on
 * top for cohesion with every other card face. Omit it for decorative/non-real-item uses
 * (onboarding's placeholder cards) — the gradient is the correct look there, not a fallback.
 */
export function CardFace({
  gradient,
  imageUrl,
  width,
  height,
  borderColor = "rgba(255,255,255,0.34)",
  badge,
  style,
}: {
  gradient: [string, string, string];
  imageUrl?: string | null;
  width: number;
  height: number;
  borderColor?: string;
  badge?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.face, { width, height, borderColor }, style]}>
      {imageUrl ? (
        <Image
          source={imageUrl}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : (
        <LinearGradient colors={gradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={["transparent", "rgba(255,255,255,0.4)", "transparent"]}
        locations={[0.3, 0.46, 0.58]}
        start={{ x: 0.05, y: 0.28 }}
        end={{ x: 0.95, y: 0.72 }}
        style={StyleSheet.absoluteFill}
      />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    left: 7,
    top: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  badgeText: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 8,
    letterSpacing: 1.4,
    color: "#FFD75E",
  },
});
