import Svg, { Path } from "react-native-svg";

/** GrailhausPacks.js's own crown glyph, ported exactly (same path data) — used on the tier
 * chips and the "MOST POPULAR" badge. */
export function Crown({ w = 16, h = 9, fill = "#e8b93c" }: { w?: number; h?: number; fill?: string }) {
  return (
    <Svg width={w} height={h} viewBox="0 0 22 12">
      <Path d="M1 11 0 2l5.5 3.4L11 0l5.5 5.4L22 2l-1 9H1Z" fill={fill} />
    </Svg>
  );
}
