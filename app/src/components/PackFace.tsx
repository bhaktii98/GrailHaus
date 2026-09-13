import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect } from "react-native-svg";
import { shadow, typography } from "../theme/tokens";

/**
 * Direct port of rn/src/components/PackFace.js — a pack or card face. CSS
 * radial-gradient has no RN <style> equivalent, so the artwork is an SVG
 * RadialGradient with a specular sheen band and a foot-shadow layered over
 * it. Used for the onboarding hero pack and the title screen's drifting cards.
 *
 * `imageUrl` layers a real photo underneath that same sheen/foot-shadow instead of the flat
 * gradient — the flat gradient becomes purely a fallback for callers with no real art (still
 * every other caller today: onboarding, title screen, etc.), not something drawn over a photo.
 */
export function PackFace({
  art,
  imageUrl,
  width,
  height,
  radius = 16,
  label,
  tier,
  crimp,
  borderColor,
  glowColor,
  children,
}: {
  art?: string[];
  /** A real photo (e.g. Pokémon TCG API artwork) — when present, replaces the flat gradient
   * background entirely; the sheen/foot-shadow overlay still applies on top for cohesion. */
  imageUrl?: string | null;
  width: number;
  height: number;
  radius?: number;
  label?: string;
  tier?: string;
  crimp?: boolean;
  /** Overrides the default neutral white border — used where a specific
   * card (e.g. a "chase"-tier pull) needs to read as visually distinct. */
  borderColor?: string;
  /** Adds a soft cast glow behind the face, in the same spirit as `shadow.glow` —
   * only the rare/standout cards in a set get this, not every face. */
  glowColor?: string;
  children?: ReactNode;
}) {
  const stops = art ?? ["#FFB3F0", "#C64BFF", "#6420C8", "#2E0B63"];
  const offs = stops.length === 4 ? [0, 0.34, 0.72, 1] : [0, 0.48, 1];

  return (
    <View
      style={[
        styles.wrap,
        { width, height, borderRadius: radius },
        borderColor && { borderColor },
        glowColor && shadow.glow(glowColor),
      ]}
    >
      {imageUrl ? (
        <Image
          source={imageUrl}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
      ) : null}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {!imageUrl && (
            <RadialGradient id="face" cx="50%" cy="40%" rx="60%" ry="44%">
              {stops.map((c, i) => (
                <Stop key={i} offset={offs[i]} stopColor={c} stopOpacity="1" />
              ))}
            </RadialGradient>
          )}
          <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0.55">
            <Stop offset="0.3" stopColor="#fff" stopOpacity="0" />
            <Stop offset="0.46" stopColor="#fff" stopOpacity="0.4" />
            <Stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="foot" x1="0" y1="0.5" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.5" />
          </LinearGradient>
        </Defs>
        {!imageUrl && <Rect width={width} height={height} rx={radius} fill="url(#face)" />}
        <Rect width={width} height={height} rx={radius} fill="url(#sheen)" />
        <Rect width={width} height={height} rx={radius} fill="url(#foot)" />
      </Svg>

      {crimp ? <View style={[styles.crimp, { height: Math.round(height * 0.11) }]} /> : null}

      {tier ? (
        <View style={styles.tierWrap}>
          <Text style={styles.tier}>{tier}</Text>
        </View>
      ) : null}

      {label ? <Text style={styles.label}>{label}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.34)",
    justifyContent: "flex-end",
  },
  crimp: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderBottomWidth: 2,
    borderBottomColor: "rgba(255,255,255,0.42)",
    borderStyle: "dashed",
  },
  tierWrap: {
    position: "absolute",
    left: 12,
    bottom: 44,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  tier: typography.tierPill,
  label: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 14,
    ...typography.cardLabel,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 2 },
  },
});
