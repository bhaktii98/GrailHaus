import { Text, View, StyleSheet } from "react-native";
import type { PackSku } from "@grailhaus/shared";
import { useExpectedValue } from "../viewmodels/useExpectedValue";
import { fonts } from "../theme/tokens";

/**
 * "Expected contents $X · edge Y%" + a link to the full odds breakdown —
 * the Pack/Vault Detail line that sits just above the buy button. The
 * confirm sheet's own EV note (a longer sentence, "buy the moment not the
 * return") is separate copy but the same underlying `useExpectedValue` math.
 */
export function ExpectedValueNote({
  sku,
  linkLabel,
  onPressLink,
  accentColor,
}: {
  sku: PackSku | null;
  linkLabel: string;
  onPressLink?: () => void;
  accentColor: string;
}) {
  const ev = useExpectedValue(sku);
  if (!ev) return null;

  return (
    <View style={styles.row}>
      <Text style={styles.text}>
        Expected contents ${(ev.expectedCents / 100).toFixed(2)} · edge {ev.houseEdgePercent.toFixed(1)}%
      </Text>
      <Text style={[styles.link, { color: accentColor }]} onPress={onPressLink}>
        {linkLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  text: { fontFamily: fonts.medium, fontSize: 12.5, color: "rgba(255,255,255,0.55)" },
  link: { fontFamily: fonts.bold, fontSize: 12.5 },
});
