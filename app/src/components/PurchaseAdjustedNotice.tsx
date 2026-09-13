import { StyleSheet, Text, View } from "react-native";
import { GameButton } from "./GameButton";
import { accent, fonts, ink } from "../theme/tokens";

/**
 * The "we couldn't fill the whole request" screen from the mockup — shown
 * when a bulk (×10) purchase is only partially satisfiable because stock ran
 * out mid-request, and the customer is charged only for what was actually
 * delivered.
 *
 * NOT wired into any live flow yet: `PurchaseResult` (services/purchaseService.ts)
 * only reports the quantity that was fulfilled, with no `requestedQuantity` —
 * the backend's `/purchase` endpoint is currently all-or-nothing per the
 * comments in usePackFlowViewModel.ts, so this state can't actually occur today.
 * Built to match the design exactly and ready to wire in once the API grows
 * partial-fulfilment support.
 */
export function PurchaseAdjustedNotice({
  requestedQuantity,
  fulfilledQuantity,
  unitPriceCents,
  onRip,
}: {
  requestedQuantity: number;
  fulfilledQuantity: number;
  unitPriceCents: number;
  onRip: () => void;
}) {
  const unclaimed = requestedQuantity - fulfilledQuantity;
  const unit = `$${(unitPriceCents / 100).toFixed(2)}`;
  const chargedCents = fulfilledQuantity * unitPriceCents;
  const packWord = (n: number) => `pack${n === 1 ? "" : "s"}`;

  return (
    <View style={styles.fill}>
      <Text style={styles.eyebrow}>PURCHASE ADJUSTED</Text>
      <Text style={styles.heading}>
        Only {fulfilledQuantity} {packWord(fulfilledQuantity)}{"\n"}were left.
      </Text>
      <Text style={styles.body}>
        You asked for {requestedQuantity}. We fulfilled {fulfilledQuantity} and charged for {fulfilledQuantity} — the
        other {unclaimed} were claimed while your request was in flight.
      </Text>

      <View style={styles.breakdown}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Requested</Text>
          <Text style={styles.rowValueStruck}>
            {requestedQuantity} × {unit}
          </Text>
        </View>
        <View style={styles.rowDivided}>
          <Text style={styles.rowLabel}>Fulfilled</Text>
          <Text style={styles.rowValue}>
            {fulfilledQuantity} × {unit}
          </Text>
        </View>
        <View style={styles.rowDivided}>
          <Text style={styles.rowLabelStrong}>Charged</Text>
          <Text style={styles.rowValueCharged}>${(chargedCents / 100).toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          One transaction, {fulfilledQuantity} {packWord(fulfilledQuantity)}
        </Text>
        <Text style={styles.infoBody}>
          Debit, stock decrement and all {fulfilledQuantity} {packWord(fulfilledQuantity)}' contents were written
          together. There is no state where you paid and a pack is missing.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Retried safely</Text>
        <Text style={styles.infoBody}>
          If your connection drops mid-purchase and the app retries on the same idempotency key, you're only ever
          charged once.
        </Text>
      </View>

      <GameButton
        label={`RIP ${fulfilledQuantity} ${packWord(fulfilledQuantity).toUpperCase()}`}
        accent={accent.cards}
        onPress={onRip}
        style={styles.ripButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: 22, paddingTop: 12 },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 2.86, color: "rgba(255,255,255,0.5)" },
  heading: {
    fontFamily: fonts.black,
    fontSize: 36,
    letterSpacing: -1.08,
    lineHeight: 38,
    color: ink.text,
    marginTop: 12,
  },
  body: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 22.4,
    color: "rgba(255,255,255,0.6)",
    marginTop: 16,
  },
  breakdown: {
    marginTop: 24,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    gap: 12,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowDivided: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  rowLabel: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.55)" },
  rowLabelStrong: { fontFamily: fonts.extrabold, fontSize: 14, color: ink.text },
  rowValue: { fontFamily: fonts.bold, fontSize: 14, color: ink.text },
  rowValueStruck: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textDecorationLine: "line-through",
  },
  rowValueCharged: { fontFamily: fonts.black, fontSize: 26, color: "#8BF285" },
  infoCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  infoTitle: { fontFamily: fonts.extrabold, fontSize: 12, color: ink.text },
  infoBody: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 18.4, color: "rgba(255,255,255,0.55)", marginTop: 6 },
  ripButton: { marginTop: "auto", marginBottom: 8 },
});
