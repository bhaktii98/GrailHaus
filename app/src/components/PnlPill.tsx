import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../theme/tokens";
import { signedMoney, signedPercent } from "../lib/money";

/**
 * The one way this app states a gain or a loss — a caret, a signed amount, and (optionally) the
 * percentage, on a tinted plate.
 *
 * Three things carry the direction, not just color: the caret glyph, the explicit +/− in the
 * number, and the tint. Green-vs-red alone fails for the ~8% of men with red-green color vision
 * deficiency, and a portfolio screen where "up" and "down" are indistinguishable is worse than
 * one with no color at all.
 *
 * `cents` of `null` means the cost basis isn't derivable for this holding — rendered as a muted
 * "—" rather than as $0.00, because "we can't price this" and "it broke even" are different
 * claims and only one of them is true.
 */
export function PnlPill({
  cents,
  percent,
  size = "md",
  showPercent = true,
}: {
  cents: number | null;
  percent?: number | null;
  size?: "sm" | "md" | "lg";
  showPercent?: boolean;
}) {
  const small = size === "sm";
  const large = size === "lg";

  if (cents == null) {
    return (
      <View style={[styles.pill, styles.unpriced, small && styles.pillSmall]}>
        <Text style={[styles.text, styles.unpricedText, small && styles.textSmall]}>—</Text>
      </View>
    );
  }

  const up = cents >= 0;
  const tint = up ? colors.success : colors.danger;

  return (
    <View
      style={[
        styles.pill,
        small && styles.pillSmall,
        large && styles.pillLarge,
        { backgroundColor: up ? "rgba(63,203,126,0.16)" : "rgba(240,85,74,0.16)", borderColor: `${tint}55` },
      ]}
    >
      <Ionicons name={up ? "caret-up" : "caret-down"} size={small ? 9 : large ? 14 : 11} color={tint} />
      <Text style={[styles.text, small && styles.textSmall, large && styles.textLarge, { color: tint }]}>
        {signedMoney(cents)}
        {showPercent && percent != null ? `  ${signedPercent(percent)}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillSmall: { paddingHorizontal: 6, paddingVertical: 1.5, gap: 2 },
  pillLarge: { paddingHorizontal: 11, paddingVertical: 5, gap: 5 },
  unpriced: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.14)" },
  // Tabular figures so a column of these doesn't shimmy sideways as the numbers tick every 30s.
  text: { fontFamily: fonts.extrabold, fontSize: 12, fontVariant: ["tabular-nums"] },
  textSmall: { fontSize: 9.5 },
  textLarge: { fontSize: 15 },
  unpricedText: { color: "rgba(255,255,255,0.45)" },
});
