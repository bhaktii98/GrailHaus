import { StyleSheet, Text, View } from "react-native";
import type { PackSku } from "@grailhaus/shared";
import { useTierOdds } from "../viewmodels/useTierOdds";
import { typography, ink } from "../theme/tokens";

/**
 * The published-odds bars every tier is required to show before purchase —
 * "POSSIBLE RARITIES" / "RARITY POSSIBILITIES" / "WHAT IS INSIDE" depending
 * on the screen, same bars underneath. Pulled out of DropDetailScreen (which
 * had this inlined) so Pack/Vault Detail can render the identical thing.
 */
export function OddsBarList({ sku, title }: { sku: PackSku | null; title: string }) {
  const rows = useTierOdds(sku);
  if (rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {rows.map(({ tier, percent }) => (
        <View key={tier.level} style={styles.row}>
          <Text style={[styles.percent, { color: tier.colorHex }]}>{percent.toFixed(1)}%</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(percent, 1.5)}%`, backgroundColor: tier.colorHex }]} />
          </View>
          <Text style={styles.tierName} numberOfLines={1}>
            {tier.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  title: typography.eyebrow,
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  percent: { ...typography.body, width: 46 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  tierName: { ...typography.body, color: ink.text, width: 82, textAlign: "right" },
});
