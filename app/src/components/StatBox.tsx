import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, ink } from "../theme/tokens";

/**
 * A label+value pair used all over the Pack/Vault Detail and summary
 * screens (PRICE/CARDS/VALUE RANGE, UNLOCK PRICE/YOU RECEIVE, NEW/DUPLICATE/
 * COLLECTION VALUE, ...). Two ways screens compose it, both seen in the
 * mockups:
 *  - Several `StatBox`es side by side, each with its own border — wrap in a
 *    row with a gap.
 *  - One shared border with `StatBox`es divided by hairlines inside —
 *    use `<StatBoxGroup>` instead, which renders unbordered `StatBox`es.
 */
export function StatBox({
  label,
  value,
  valueColor,
  bordered = true,
  align = "left",
  style,
}: {
  label: string;
  value: ReactNode;
  valueColor?: string;
  bordered?: boolean;
  align?: "left" | "right";
  style?: object;
}) {
  return (
    <View style={[styles.box, bordered && styles.boxBordered, style]}>
      <Text style={[styles.label, align === "right" && styles.alignRight]}>{label}</Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text style={[styles.value, valueColor && { color: valueColor }, align === "right" && styles.alignRight]}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/**
 * One shared bordered container holding 2-3 `StatBox`es separated by
 * vertical hairlines — the Pack Ready "INSIDE / GUARANTEED / TAKES" row.
 */
export function StatBoxGroup({ children }: { children: ReactNode[] }) {
  return (
    <View style={styles.group}>
      {children.map((child, i) => (
        <View key={i} style={[styles.groupItem, i > 0 && styles.groupDivider]}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 12, borderRadius: 14, gap: 6 },
  boxBordered: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  label: { fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 1.4, color: "rgba(255,255,255,0.55)" },
  value: { fontFamily: fonts.black, fontSize: 18, color: ink.text },
  alignRight: { textAlign: "right" },
  group: {
    flexDirection: "row",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  groupItem: { flex: 1, padding: 12, gap: 6 },
  groupDivider: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.12)" },
});
