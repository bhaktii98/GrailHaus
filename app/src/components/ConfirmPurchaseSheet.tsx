import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { PackSku } from "@grailhaus/shared";
import { accent, fonts, ink, spacing } from "../theme/tokens";
import { PackFace } from "./PackFace";
import { WatchDial } from "./WatchDial";
import { GameButton } from "./GameButton";
import { QuietButton } from "./QuietButton";
import { ART_GRADIENT, tierLabel } from "./PackTile";
import { useExpectedValue } from "../viewmodels/useExpectedValue";
import { confirmPurchase as copy, packTile as packTileCopy } from "../content/copy";

/**
 * The receipt-style confirm step between "tap a tier" and the real purchase
 * call — restates price and balance-after before the tap (never a surprise
 * charge), and states the expected-contents math so a buyer sees the house
 * edge before paying, not after. Bulk ripping (PRD §46): a 1/10 toggle is
 * offered when the caller marks the sku `bulkEligible` (evergreen card tiers
 * other than Vault Break — see PackDetailScreen for exactly where that's
 * decided; watches and timed drops never set it, matching the "one case at a
 * time" / "1 per account" rules those already have). `quantity` is otherwise
 * always 1 and the sheet renders exactly as it always has.
 */
export function ConfirmPurchaseSheet({
  visible,
  sku,
  balanceCents,
  isPurchasing,
  quantity = 1,
  bulkEligible = false,
  onQuantityChange,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  sku: PackSku | null;
  balanceCents: number | null;
  isPurchasing: boolean;
  quantity?: 1 | 10;
  bulkEligible?: boolean;
  onQuantityChange?: (quantity: 1 | 10) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ev = useExpectedValue(sku);

  if (!sku) return null;
  // Cards is the one genuinely distinct treatment (multi-item tear); every other category
  // (watches, handbags, anything added after) shares the "vault" single-item styling below —
  // same fallback rule as ShelfScreen's REGISTER and the Home doors.
  const isCards = sku.category === "cards";
  const totalPriceCents = sku.priceCents * quantity;
  const balanceAfter = balanceCents != null ? balanceCents - totalPriceCents : null;
  const insufficient = balanceAfter != null && balanceAfter < 0;
  const art = ART_GRADIENT[sku.tier] ?? ART_GRADIENT.street_rip;
  const tone = isCards ? accent.cards : accent.watches;
  const priceLabel = `$${(totalPriceCents / 100).toFixed(2)}`;
  const confirmLabel = isPurchasing ? copy.working : `${copy.pay} ${priceLabel}`;

  function handleConfirm() {
    if (!isPurchasing && !insufficient) onConfirm();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: isCards ? "#171029" : "#12100C" }]}>
          <View style={styles.grabber} />
          <Text style={styles.eyebrow}>{isCards ? copy.eyebrowCards : copy.eyebrowVault}</Text>

          <View style={styles.itemRow}>
            {isCards ? (
              <PackFace art={art} width={66} height={90} radius={10} crimp />
            ) : (
              <WatchDial art={art} size={60} />
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemTier}>{tierLabel(sku)}</Text>
              <Text style={[isCards ? styles.itemName : styles.itemNameWatches]} numberOfLines={1}>
                {sku.name}
              </Text>
            </View>
          </View>

          {bulkEligible && onQuantityChange && (
            <View style={styles.quantityToggle}>
              {([1, 10] as const).map((q) => (
                <Pressable
                  key={q}
                  onPress={() => onQuantityChange(q)}
                  disabled={isPurchasing}
                  style={[styles.quantityOption, quantity === q && styles.quantityOptionActive]}
                >
                  <Text style={[styles.quantityOptionLabel, quantity === q && styles.quantityOptionLabelActive]}>
                    {q === 1 ? "1 PACK" : "10 PACKS"}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.breakdown}>
            <Row
              label={!isCards ? copy.unlockPrice : quantity > 1 ? `${quantity} × pack` : copy.lineItem}
              value={priceLabel}
            />
            <Row
              label={copy.youReceive}
              value={
                !isCards
                  ? copy.oneItem
                  : packTileCopy.countLabel(sku.category, sku.itemCount * quantity) +
                    (quantity > 1 ? ` across ${quantity} packs` : "")
              }
            />
            {balanceCents != null && <Row label={copy.balanceNow} value={`$${(balanceCents / 100).toFixed(2)}`} />}
            <View style={styles.divider} />
            <Row
              label={copy.balanceAfter}
              value={balanceAfter != null ? `$${(balanceAfter / 100).toFixed(2)}` : "—"}
              emphasize
            />
          </View>

          {ev && (
            <View style={styles.evNote}>
              <Text style={styles.evNoteText}>
                {copy.evNote(ev.expectedCents * quantity, totalPriceCents, !isCards)}
              </Text>
            </View>
          )}

          {insufficient && <Text style={styles.warning}>{copy.insufficientBalance}</Text>}

          <View style={styles.actions}>
            {isCards ? (
              <>
                <Pressable onPress={onClose} disabled={isPurchasing} style={styles.cancelBoxed}>
                  <Text style={styles.cancelBoxedLabel}>{copy.cancel}</Text>
                </Pressable>
                <GameButton label={confirmLabel} accent={tone} onPress={handleConfirm} style={styles.payWrapFlex} />
              </>
            ) : (
              <>
                <Pressable onPress={onClose} disabled={isPurchasing} style={styles.cancelPlain}>
                  <Text style={styles.cancelPlainLabel}>{copy.cancel}</Text>
                </Pressable>
                <QuietButton label={confirmLabel} accent={tone} onPress={handleConfirm} dark style={styles.payWrap} />
              </>
            )}
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
  itemRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: spacing.md },
  quantityToggle: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.lg,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  quantityOption: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityOptionActive: { backgroundColor: "rgba(255,255,255,0.14)" },
  quantityOptionLabel: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 0.8, color: "rgba(255,255,255,0.5)" },
  quantityOptionLabelActive: { color: ink.text },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTier: { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 1.3, color: "rgba(255,255,255,0.55)" },
  itemName: { fontFamily: fonts.black, fontSize: 22, letterSpacing: -0.2, color: ink.text, marginTop: 4 },
  itemNameWatches: { fontFamily: fonts.regular, fontSize: 22, color: ink.textOnWatches, marginTop: 4 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginTop: spacing.lg },
  breakdown: { marginTop: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  rowLabel: { fontFamily: fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.55)" },
  rowLabelBig: { fontFamily: fonts.extrabold, fontSize: 14, color: ink.text },
  rowValue: { fontFamily: fonts.bold, fontSize: 14, color: ink.text },
  rowValueBig: { fontFamily: fonts.black, fontSize: 26, color: ink.text },
  evNote: {
    marginTop: spacing.lg,
    padding: 15,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  evNoteText: { fontFamily: fonts.medium, fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 18.5 },
  warning: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#F0554A",
    marginTop: spacing.md,
    textAlign: "center",
  },
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
  cancelPlain: { paddingHorizontal: 4 },
  cancelPlainLabel: { fontFamily: fonts.semibold, fontSize: 14, color: "rgba(255,255,255,0.6)" },
  payWrap: { flex: 1 },
  payWrapFlex: { flex: 1 },
});
