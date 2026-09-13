// Ported from card-pack-reveal-prototype/src/vault/ui/VaultVignette.tsx — three layered
// radial-gradients on Skia's declarative <Canvas>, same technique as the Tier 1 pack reveal's
// own vignette background.
import { Canvas, Rect, RadialGradient, vec } from "@shopify/react-native-skia";
import { StyleSheet } from "react-native";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";

export function VaultVignette({
  width,
  height,
  // Vault Break's own violet glow, by default — Black Label
  // (../../blackLabelReveal/ui/BlackLabelVignette.tsx) passes its bronze equivalent instead.
  // Only this top glow's hue changes between tiers; the bottom champagne-ish glow and the
  // dark edge vignette read as "premium metal on black" regardless of which metal, so they
  // stay fixed.
  glowColor = "rgba(92,52,158,0.20)",
  // Optional: when set (HoldToOpenFanReveal.tsx, for a card whose category carries a real
  // Pokémon type), the top glow recolors to the held/open card's type instead of the fixed
  // per-tier `glowColor` above, ramping in with `strength` (0..1). Additive — every existing
  // caller (VaultTearStage/BlackLabelTearStage, and this screen's own no-type case) passes
  // neither prop and renders exactly as before.
  typeRGB,
  // Deliberately strong — this is meant to read as "the room turns [color]" (a Water pull's
  // background should actually feel like water), not a faint accent. Genuinely additive still:
  // every existing caller that doesn't pass typeRGB is completely unaffected.
  typeAlpha = 0.5,
  strength,
}: {
  width: number;
  height: number;
  glowColor?: string;
  typeRGB?: string;
  typeAlpha?: number;
  strength?: SharedValue<number>;
}) {
  const baseRadius = Math.max(width * 0.26, height * 0.2) / 0.64;
  const wideRadius = Math.max(width, height) * 0.95;

  const topGlowColors = useDerivedValue(() => {
    if (!typeRGB) return [glowColor, "rgba(5,3,10,0)"];
    const alpha = typeAlpha * (strength?.value ?? 1);
    return [`rgba(${typeRGB},${alpha.toFixed(3)})`, "rgba(5,3,10,0)"];
  });
  // Grows from the normal tight top-glow radius out toward a near-full-bleed wash as strength
  // ramps up, so a fully-charged/open type-driven card genuinely washes the whole background,
  // not just a spot near the top.
  const topGlowRadius = useDerivedValue(() => {
    if (!typeRGB) return baseRadius;
    return baseRadius + (wideRadius - baseRadius) * (strength?.value ?? 1);
  });

  if (width <= 0 || height <= 0) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} color="#05030a" />
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient c={vec(width * 0.5, height * 0.38)} r={topGlowRadius} colors={topGlowColors} />
      </Rect>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width * 0.5, height * 1.16)}
          r={Math.max(width * 0.6, height * 0.45) / 0.58}
          colors={["rgba(232,207,162,0.07)", "rgba(5,3,10,0)"]}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width * 0.5, height * 0.5)}
          r={Math.max(width * 0.65, height * 0.55)}
          colors={["rgba(5,3,10,0)", "rgba(5,3,10,0)", "rgba(3,2,6,0.86)"]}
          positions={[0, 0.42, 1]}
        />
      </Rect>
    </Canvas>
  );
}
