import { useEffect } from "react";
import { Dimensions, Text, View } from "react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from "react-native-svg";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { fonts } from "../theme/tokens";

/** Shared drop-screen palette — a "live drop" (DropDetailScreen, and Home's Featured Drop card)
 * always reads gold (not-yet-live/live alike) with a pink accent reserved for the live pulse
 * itself, so the two screens read as the same product rather than two different designs. */
export const GOLD = "#F6C040";
export const GOLD_DEEP = "#E0A51C";
export const PINK = "#FF3D71";

const { width: SCREEN_W } = Dimensions.get("window");

/** Renders a "Series: Drop Name" title as two gradient-filled lines (plain white→grey lead-in,
 * gold payoff on its own line) — an SVG text mask, same technique the original design reference
 * used (there via @react-native-masked-view, which this app doesn't otherwise depend on; this
 * gets the identical look off react-native-svg, already a dependency everywhere else in the app,
 * so it doesn't add a new native module just for two lines of gradient text). A name with no
 * colon renders as one plain gradient line. `muted` (e.g. a closed drop) skips the gradient
 * entirely — a plain muted line reads better than a gold treatment on something no longer live.
 *
 * `fontSize`/`width` default to DropDetailScreen's own full-screen-hero sizing; pass smaller
 * values to reuse this inside a compact card (see HomeScreen's Featured Drop card).
 */
export function DropTitle({
  name,
  muted,
  fontSize = 35,
  width = SCREEN_W - 48,
}: {
  name: string;
  muted?: boolean;
  fontSize?: number;
  width?: number;
}) {
  const splitAt = name.indexOf(":");
  const lead = splitAt === -1 ? name : name.slice(0, splitAt + 1);
  const payoff = splitAt === -1 ? null : name.slice(splitAt + 1).trim();
  const lineHeight = fontSize + 9;
  const baseline = fontSize - 1;

  if (muted) {
    return (
      <Text
        style={{
          fontFamily: fonts.black,
          fontSize,
          letterSpacing: -0.5,
          lineHeight,
          color: "rgba(255,255,255,0.62)",
        }}
      >
        {lead}
        {payoff ? `\n${payoff}` : ""}
      </Text>
    );
  }

  return (
    <View>
      <Svg width={width} height={lineHeight}>
        <Defs>
          <SvgLinearGradient id="titleLead" x1="0" y1="0" x2="1" y2="0.4">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#CFC6D6" />
          </SvgLinearGradient>
        </Defs>
        <SvgText x="0" y={baseline} fontSize={fontSize} fontFamily={fonts.black} letterSpacing={-0.5} fill="url(#titleLead)">
          {lead}
        </SvgText>
      </Svg>
      {payoff && (
        <Svg width={width} height={lineHeight} style={{ marginTop: -6 }}>
          <Defs>
            <SvgLinearGradient id="titlePayoff" x1="0" y1="0" x2="1" y2="0.4">
              <Stop offset="0" stopColor={GOLD} />
              <Stop offset="0.5" stopColor="#FFE9A3" />
              <Stop offset="1" stopColor="#E3A520" />
            </SvgLinearGradient>
          </Defs>
          <SvgText x="0" y={baseline} fontSize={fontSize} fontFamily={fonts.black} letterSpacing={-0.5} fill="url(#titlePayoff)">
            {payoff}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

const LIVE_DOT_STYLE = {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: PINK,
  shadowColor: PINK,
  shadowOpacity: 1,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 0 },
} as const;

/** The pulsing dot next to "LIVE NOW" — opacity+scale breathing loop. */
export function LiveDot() {
  const t = useSharedValue(1);
  useEffect(() => {
    t.value = withRepeat(withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: t.value }] }));
  return <Animated.View style={[LIVE_DOT_STYLE, style]} />;
}
