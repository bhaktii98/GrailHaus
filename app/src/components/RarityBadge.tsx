import { StyleSheet, Text, View } from "react-native";
import type { RarityTier } from "@grailhaus/shared";
import { radii, spacing, typography } from "../theme/tokens";

/** Colors/names are admin-configurable data (rarity_tiers table) — not a hardcoded theme token. */
export function RarityBadge({ tier }: { tier: RarityTier }) {
  return (
    <View style={[styles.badge, { borderColor: tier.colorHex }]}>
      <Text style={[styles.text, { color: tier.colorHex }]}>{tier.name.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  text: { ...typography.caption },
});
