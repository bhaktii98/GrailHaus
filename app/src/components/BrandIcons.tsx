import Svg, { Circle, G, Path, Rect } from "react-native-svg";

/**
 * GrailHaus's own hand-drawn icon set (ported from GrailhausHome.js, the authoritative reference
 * for this screen) — used in place of the generic Ionicons glyphs previously standing in for
 * them, in the nav bar (PillTabBar.tsx) and the Featured Drop card's meta row (HomeScreen.tsx).
 * Deliberately not a generic icon library wrapper: each glyph here is this brand's specific line
 * art, not a lookup into a shared catalog.
 */

export function IconChevron({ size = 12, color = "#fff", w = 2.2 }: { size?: number; color?: string; w?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path d="M4.5 1.5 10 7l-5.5 5.5" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function IconCards() {
  return (
    <Svg width={13} height={13} viewBox="0 0 16 16">
      <G stroke="#d9ab52" strokeWidth={1.3} fill="none">
        <Rect x={2.5} y={2.5} width={7} height={11} rx={1.2} />
        <Path d="M11 4.2l2.3.8-2.6 8.4" />
      </G>
    </Svg>
  );
}

export function IconShield() {
  return (
    <Svg width={13} height={13} viewBox="0 0 16 16">
      <Path d="M8 1.6 13.4 4v4.3c0 3-2.3 5.2-5.4 6.1-3.1-.9-5.4-3.1-5.4-6.1V4L8 1.6Z" stroke="#d9ab52" strokeWidth={1.3} fill="none" />
    </Svg>
  );
}

export function IconBox() {
  return (
    <Svg width={13} height={13} viewBox="0 0 16 16">
      <Path d="M8 1.8 14 5v6l-6 3.2L2 11V5l6-3.2ZM2 5l6 3.2L14 5M8 8.2V14" stroke="#d9ab52" strokeWidth={1.3} fill="none" />
    </Svg>
  );
}

export function IconHome({ c, active }: { c: string; active?: boolean }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path
        d="M3.6 10.3 12 3.6l8.4 6.7V19.4a1.2 1.2 0 0 1-1.2 1.2H4.8a1.2 1.2 0 0 1-1.2-1.2V10.3Z"
        stroke={c}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill={active ? c : "none"}
      />
    </Svg>
  );
}

export function IconCompass({ c }: { c: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <G stroke={c} strokeWidth={1.6} fill="none" strokeLinejoin="round">
        <Circle cx={12} cy={12} r={8.6} />
        <Path d="M15.4 8.6 13.7 13.7 8.6 15.4 10.3 10.3Z" />
      </G>
    </Svg>
  );
}

export function IconCase({ c }: { c: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <G stroke={c} strokeWidth={1.6} fill="none" strokeLinejoin="round">
        <Rect x={3.2} y={7.4} width={17.6} height={12.6} rx={2.2} />
        <Path d="M8.8 7.4V5.8a1.7 1.7 0 0 1 1.7-1.7h3a1.7 1.7 0 0 1 1.7 1.7v1.6M3.2 12.6h17.6" />
      </G>
    </Svg>
  );
}

export function IconStore({ c }: { c: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path
        d="M3.4 9.3 5.1 4.5h13.8l1.7 4.8M3.4 9.3h17.2M4.6 9.3v10.2h14.8V9.3M9 19.5v-5.4h4.4v5.4"
        stroke={c}
        strokeWidth={1.6}
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconReveal({ size = 29 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26">
      <G stroke="#fff" strokeWidth={1.6} fill="none" strokeLinejoin="round">
        <Rect x={6.2} y={5.4} width={13.6} height={16.4} rx={2.2} />
        <Path d="M9.2 5.6V3.7a1 1 0 0 1 1.2-1l7.6 1.3" />
        <Circle cx={13} cy={13.6} r={3} />
      </G>
    </Svg>
  );
}
