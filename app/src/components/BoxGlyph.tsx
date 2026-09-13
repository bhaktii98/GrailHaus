import Svg, { Path } from "react-native-svg";

/** The hexagonal "sealed box" glyph centered on a drop's hero art — traced
 * from the mockup's own exported vector (two paths: an outlined hex ring
 * plus a filled inner hex), not a hand-drawn substitute. */
export function BoxGlyph({ size = 44, color = "#1A1206", opacity = 0.65 }: { size?: number; color?: string; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <Path
        d="M22 10.08 33 16.5v12.83l-11 6.42-11-6.42V16.5L22 10.08Z"
        stroke={color}
        strokeOpacity={opacity * 0.86}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Path d="M22 16.96 27.5 20.17v5.87L22 29.33l-5.5-3.3v-5.87L22 16.96Z" fill={color} fillOpacity={opacity} />
    </Svg>
  );
}
