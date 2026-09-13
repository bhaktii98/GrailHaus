import { StyleSheet, Text, View } from "react-native";
import { computePriceDrift } from "@grailhaus/shared";
import type { OwnedItem } from "@grailhaus/shared";
import { PnlPill } from "./PnlPill";
import { useDriftClock } from "../lib/driftClock";
import { money } from "../lib/money";
import { colors, fonts, ink } from "../theme/tokens";
import { itemDetail } from "../content/copy";

const copy = itemDetail.position;

/**
 * What one specific copy has done for its owner: what it cost, what it's worth on this tick, and
 * the difference.
 *
 * A detail screen already says what the item is worth — that figure is about the item. This is
 * about the *position*: the same number only becomes good or bad news once you know what was
 * paid, and until now that context lived nowhere in the app, so a collector could look at a $12
 * card with no way to tell whether it came out of a $25 pack or a $5 trade.
 *
 * Follows the app's two-register convention (see theme/tokens.ts): cards shout in heavy weights
 * on violet, watches speak quietly in light weights on cream, so this block never looks bolted on
 * to whichever screen hosts it.
 */
export function PositionCard({ owned, register }: { owned: OwnedItem; register: "cards" | "watches" }) {
  const now = useDriftClock();
  const watches = register === "watches";
  const { currentValueCents } = computePriceDrift(owned.item, now);
  const basis = owned.costBasisCents;
  const pnlCents = basis == null ? null : currentValueCents - basis;
  const pnlPercent = basis == null || basis === 0 ? null : ((currentValueCents - basis) / basis) * 100;

  const heldSince = new Date(owned.heldSinceAt);
  const heldDays = Math.max(0, Math.floor((now.getTime() - heldSince.getTime()) / 86_400_000));
  const heldDate = heldSince.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const sourceLine = owned.acquiredVia === "marketplace" ? copy.viaMarketplace(heldDate) : copy.viaPack(heldDate);

  return (
    <View style={[styles.card, watches ? styles.cardWatches : styles.cardCards]}>
      <Text style={[styles.label, watches && styles.labelWatches]}>{copy.label}</Text>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={[styles.colLabel, watches && styles.colLabelWatches]}>{copy.cost}</Text>
          <Text style={[styles.colValue, watches && styles.colValueWatches]}>
            {basis == null ? copy.unknownCost : money(basis)}
          </Text>
        </View>
        <View style={[styles.divider, watches && styles.dividerWatches]} />
        <View style={styles.col}>
          <Text style={[styles.colLabel, watches && styles.colLabelWatches]}>{copy.valueNow}</Text>
          <Text style={[styles.colValue, watches && styles.colValueWatches]}>{money(currentValueCents)}</Text>
        </View>
        <View style={[styles.divider, watches && styles.dividerWatches]} />
        <View style={styles.col}>
          <Text style={[styles.colLabel, watches && styles.colLabelWatches]}>{copy.pnl}</Text>
          <View style={styles.pnlWrap}>
            <PnlPill cents={pnlCents} percent={pnlPercent} size="sm" />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footNote, watches && styles.footNoteWatches]}>{sourceLine}</Text>
        <Text style={[styles.footNote, watches && styles.footNoteWatches]}>{copy.held(heldDays)}</Text>
      </View>

      {owned.activeListing && (
        <Text style={[styles.listedNote, watches && styles.listedNoteWatches]}>
          {copy.listedAt(money(owned.activeListing.priceCents))}
        </Text>
      )}
      {basis == null && (
        <Text style={[styles.footNote, watches && styles.footNoteWatches, styles.unpricedNote]}>
          {copy.unpricedNote}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 15, borderRadius: 18, borderWidth: 1.5 },
  cardCards: { backgroundColor: "rgba(177,75,255,0.1)", borderColor: "rgba(177,75,255,0.34)" },
  cardWatches: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(242,196,107,0.28)" },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 3, color: ink.textMeta },
  labelWatches: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 2.6, color: "rgba(242,196,107,0.7)" },
  row: { flexDirection: "row", alignItems: "flex-start", marginTop: 13 },
  col: { flex: 1, minWidth: 0, gap: 5 },
  colLabel: { fontFamily: fonts.bold, fontSize: 8.5, letterSpacing: 1.2, color: "rgba(255,255,255,0.5)" },
  colLabelWatches: { fontFamily: fonts.medium, fontSize: 9, letterSpacing: 1.4, color: "rgba(246,243,236,0.55)" },
  colValue: { fontFamily: fonts.black, fontSize: 16, color: ink.text, fontVariant: ["tabular-nums"] },
  colValueWatches: { fontFamily: fonts.semibold, fontSize: 16, color: ink.textOnWatches },
  pnlWrap: { marginTop: -1 },
  divider: { width: 1, alignSelf: "stretch", marginHorizontal: 10, backgroundColor: "rgba(255,255,255,0.12)" },
  dividerWatches: { backgroundColor: "rgba(242,196,107,0.22)" },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 13 },
  footNote: { fontFamily: fonts.medium, fontSize: 10.5, color: "rgba(255,255,255,0.5)" },
  footNoteWatches: { fontFamily: fonts.regular, color: "rgba(246,243,236,0.55)" },
  listedNote: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.goldTop, marginTop: 6 },
  listedNoteWatches: { fontFamily: fonts.medium, color: "#F2C46B" },
  unpricedNote: { marginTop: 6, lineHeight: 15 },
});
