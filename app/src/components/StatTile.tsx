import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, ink } from "../theme/tokens";

/**
 * One number a collector should be able to read without interpreting: an icon chip that says what
 * kind of number it is, the figure itself, and a supporting line underneath.
 *
 * Distinct from `StatBox` (label-over-value, used inside pack/purchase surfaces where the
 * surrounding card already provides the context): these are freestanding tiles on the portfolio's
 * own ground, so each one has to identify itself. The icon does the identifying — a wallet, a
 * cart, a price tag — because a grid of four all-caps labels reads as a form, not a dashboard.
 */
export function StatTile({
  icon,
  iconColor = colors.goldTop,
  label,
  value,
  sub,
  valueColor = ink.text,
  footer,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  /** Anything richer than a line of text — a `PnlPill`, typically. Replaces `sub` when given. */
  footer?: ReactNode;
}) {
  return (
    <View style={styles.tile}>
      <View style={styles.head}>
        <View style={[styles.iconChip, { backgroundColor: `${iconColor}22`, borderColor: `${iconColor}44` }]}>
          <Ionicons name={icon} size={13} color={iconColor} />
        </View>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {footer ?? (sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    padding: 13,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.11)",
    gap: 7,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 7 },
  iconChip: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1, fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 1.3, color: "rgba(255,255,255,0.55)" },
  // Tabular figures: these tick, and proportional digits make the whole tile twitch when they do.
  value: { fontFamily: fonts.black, fontSize: 21, color: ink.text, fontVariant: ["tabular-nums"] },
  sub: { fontFamily: fonts.medium, fontSize: 10.5, color: "rgba(255,255,255,0.5)" },
});
