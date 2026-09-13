import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { accent, fonts, ink, spacing } from "../theme/tokens";
import { GameButton } from "./GameButton";
import { addFunds as copy } from "../content/copy";

const PRESETS_CENTS = [1000, 2500, 5000, 10000, 25000];

/**
 * "Add Funds" — the wallet's one credit path, same receipt-style shape ConfirmPurchaseSheet
 * already established for its one debit path (restate balance-before/after, never a surprise),
 * just with an amount picker instead of a fixed price. A sandbox balance, stated plainly (see
 * copy.body) — there's no real payment processor anywhere in this stack, and pretending
 * otherwise here would be the one dishonest screen in the app.
 */
export function AddFundsSheet({
  visible,
  balanceCents,
  isToppingUp,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  balanceCents: number | null;
  isToppingUp: boolean;
  onClose: () => void;
  onConfirm: (amountCents: number) => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(PRESETS_CENTS[1]);
  const [customText, setCustomText] = useState("");

  const customCents = customText.trim() === "" ? null : Math.round(parseFloat(customText) * 100);
  const amountCents = customText.trim() !== "" ? customCents : selectedPreset;
  const validAmount = amountCents != null && Number.isFinite(amountCents) && amountCents >= 100 && amountCents <= 100_000_000;
  const balanceAfter = validAmount && balanceCents != null ? balanceCents + amountCents : null;

  function handlePreset(cents: number) {
    setSelectedPreset(cents);
    setCustomText("");
  }

  function handleConfirm() {
    if (!isToppingUp && validAmount) onConfirm(amountCents);
  }

  function handleClose() {
    setCustomText("");
    setSelectedPreset(PRESETS_CENTS[1]);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.wrap}>
        <Pressable style={styles.scrim} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          <View style={styles.presetRow}>
            {PRESETS_CENTS.map((cents) => {
              const active = customText.trim() === "" && selectedPreset === cents;
              return (
                <Pressable
                  key={cents}
                  onPress={() => handlePreset(cents)}
                  disabled={isToppingUp}
                  style={[styles.presetChip, active && styles.presetChipActive]}
                >
                  <Text style={[styles.presetChipLabel, active && styles.presetChipLabelActive]}>
                    ${(cents / 100).toFixed(0)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.customLabel}>{copy.customLabel}</Text>
          <View style={styles.customRow}>
            <Text style={styles.customPrefix}>$</Text>
            <TextInput
              value={customText}
              onChangeText={setCustomText}
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="decimal-pad"
              editable={!isToppingUp}
              style={styles.customInput}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.breakdown}>
            {balanceCents != null && <Row label={copy.balanceNow} value={`$${(balanceCents / 100).toFixed(2)}`} />}
            <View style={styles.divider} />
            <Row
              label={copy.balanceAfter}
              value={balanceAfter != null ? `$${(balanceAfter / 100).toFixed(2)}` : "—"}
              emphasize
            />
          </View>

          {customText.trim() !== "" && !validAmount && <Text style={styles.warning}>{copy.invalidAmount}</Text>}

          <View style={styles.actions}>
            <Pressable onPress={handleClose} disabled={isToppingUp} style={styles.cancelBoxed}>
              <Text style={styles.cancelBoxedLabel}>{copy.cancel}</Text>
            </Pressable>
            <GameButton
              label={isToppingUp ? copy.working : copy.confirm(amountCents ?? 0)}
              accent={accent.gold}
              onPress={handleConfirm}
              style={styles.confirmWrap}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={emphasize ? styles.rowLabelBig : styles.rowLabel}>{label}</Text>
      <Text style={emphasize ? styles.rowValueBig : styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(6,3,14,0.72)" },
  sheet: {
    backgroundColor: "#171029",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    borderTopColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.24)",
    alignSelf: "center",
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.5)",
    marginTop: spacing.lg,
  },
  title: { fontFamily: fonts.black, fontSize: 22, color: ink.text, marginTop: 6 },
  body: { fontFamily: fonts.medium, fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginTop: 4, lineHeight: 18 },
  presetRow: { flexDirection: "row", gap: 8, marginTop: spacing.lg },
  presetChip: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  presetChipActive: { backgroundColor: "rgba(255,215,94,0.16)", borderColor: "rgba(255,215,94,0.5)" },
  presetChipLabel: { fontFamily: fonts.extrabold, fontSize: 13, color: "rgba(255,255,255,0.6)" },
  presetChipLabelActive: { color: "#FFD75E" },
  customLabel: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.4)",
    marginTop: spacing.lg,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  customPrefix: { fontFamily: fonts.extrabold, fontSize: 16, color: "rgba(255,255,255,0.55)" },
  customInput: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: ink.text, padding: 0 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginTop: spacing.lg },
  breakdown: { marginTop: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  rowLabel: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.55)" },
  rowLabelBig: { fontFamily: fonts.extrabold, fontSize: 14, color: ink.text },
  rowValue: { fontFamily: fonts.bold, fontSize: 14, color: ink.text },
  rowValueBig: { fontFamily: fonts.black, fontSize: 26, color: ink.text },
  warning: { fontFamily: fonts.bold, fontSize: 12, color: "#F0554A", marginTop: spacing.md, textAlign: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  cancelBoxed: {
    flexBasis: 130,
    height: 62,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBoxedLabel: { fontFamily: fonts.extrabold, fontSize: 13, letterSpacing: 0.6, color: ink.text },
  confirmWrap: { flex: 1 },
});
