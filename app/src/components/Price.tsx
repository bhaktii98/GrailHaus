import { Text } from "react-native";
import { colors, typography } from "../theme/tokens";

export function Price({ cents, color = colors.textPrimary }: { cents: number; color?: string }) {
  return <Text style={[typography.price, { color }]}>${(cents / 100).toFixed(2)}</Text>;
}
