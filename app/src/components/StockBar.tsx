import { StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme/tokens";

/** Low-stock threshold below which the bar (and its label) turn danger-red —
 * matches the mockup's "the shelf's own stock bar turns red under ~20%". */
const LOW_STOCK_RATIO = 0.2;

/**
 * A depletion bar for anything with a finite `remaining`/`max` — an evergreen
 * shelf tile or a timed drop. Renders nothing if `max` is null (unlimited
 * stock, unused today but part of the real `PackSku` shape).
 */
export function StockBar({
  remaining,
  max,
  label,
  fillColor,
}: {
  remaining: number | null;
  max: number | null;
  label?: string;
  /** Overrides the default white fill when not low-stock — the shelf's tier
   * cards color the bar with the category accent instead of plain white. */
  fillColor?: string;
}) {
  if (remaining == null || max == null || max <= 0) return null;
  const ratio = Math.max(0, Math.min(1, remaining / max));
  const isLow = ratio < LOW_STOCK_RATIO;

  return (
    <View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${ratio * 100}%` },
            fillColor && !isLow && { backgroundColor: fillColor },
            isLow && styles.fillLow,
          ]}
        />
      </View>
      <Text style={[styles.label, isLow && styles.labelLow]}>
        {label ?? `${remaining} of ${max} left`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    marginTop: 10,
  },
  fill: { height: "100%", borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  fillLow: { backgroundColor: colors.danger },
  label: { ...typography.footNote, marginTop: 5 },
  labelLow: { color: colors.danger },
});
