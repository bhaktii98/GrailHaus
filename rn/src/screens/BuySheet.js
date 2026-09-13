import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import GameButton from '../components/GameButton';
import PackFace from '../components/PackFace';
import { fmt } from '../lib/money';
import { tap } from '../lib/haptics';
import { accent, ink } from '../theme';

// Balance-after is stated before the tap, every time. The partial-fulfilment
// rule is disclosed here rather than discovered afterwards.
export default function BuySheet({ visible, pack, qty, balanceCents, onClose, onConfirm }) {
  const [n, setN] = React.useState(qty || 1);
  React.useEffect(() => setN(qty || 1), [qty, visible]);

  if (!pack) return null;
  const acc = pack.priceCents >= 50000 ? accent.watches : accent.cards;
  const total = pack.priceCents * n;
  const after = (balanceCents || 250000) - total;
  const short = after < 0;
  const max = Math.min(pack.stock, pack.bulk ? 10 : 1);

  const step = (d) => {
    const v = Math.max(1, Math.min(max, n + d));
    if (v !== n) { tap(); setN(v); }
  };

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />

        <View style={styles.item}>
          <PackFace art={pack.art} width={58} height={80} radius={10} crimp />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{pack.name}</Text>
            <Text style={styles.sub}>{pack.sub}</Text>
          </View>
        </View>

        {pack.bulk ? (
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.step} onPress={() => step(-1)}>
                <Text style={styles.stepText}>-</Text>
              </Pressable>
              <Text style={styles.qty}>{n}</Text>
              <Pressable style={[styles.step, styles.stepUp]} onPress={() => step(1)}>
                <Text style={[styles.stepText, { color: '#fff' }]}>+</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <Line label={n + ' x ' + fmt(pack.priceCents)} value={fmt(total)} />
          <Line label="Balance now" value={fmt(balanceCents || 250000)} />
          <View style={styles.hr} />
          <View style={styles.lineRow}>
            <Text style={styles.afterLabel}>Balance after</Text>
            <Text style={[styles.afterValue, short && { color: accent.danger.c1 }]}>
              {fmt(after)}
            </Text>
          </View>
        </View>

        {n > 1 ? (
          <View style={styles.warn}>
            <Text style={styles.warnTitle}>If stock runs out mid-purchase</Text>
            <Text style={styles.warnBody}>
              We fulfil what is left and charge only for that. Ask for {n} with fewer
              remaining and you are charged for the smaller number.
            </Text>
          </View>
        ) : null}

        <GameButton
          label={short ? 'NOT ENOUGH BALANCE' : 'CONFIRM  ' + fmt(total)}
          accent={short ? accent.danger : acc}
          dark={!short && acc === accent.watches}
          onPress={() => !short && onConfirm && onConfirm(pack, n, total)}
          style={{ marginTop: 4 }}
        />
      </View>
    </Modal>
  );
}

function Line({ label, value }) {
  return (
    <View style={styles.lineRow}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(6,3,14,0.72)' },
  sheet: {
    backgroundColor: '#171029', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1.5, borderTopColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30, gap: 16,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 3, alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  item: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  name: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.2 },
  sub: { fontSize: 11.5, fontWeight: '500', color: ink.textMeta, marginTop: 3 },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 13, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  qtyLabel: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  step: {
    width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  stepUp: { backgroundColor: 'rgba(255,255,255,0.16)' },
  stepText: { fontSize: 19, fontWeight: '800', color: 'rgba(255,255,255,0.6)' },
  qty: { fontSize: 20, fontWeight: '900', color: '#fff', minWidth: 26, textAlign: 'center' },
  lineRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  lineLabel: { fontSize: 13, fontWeight: '500', color: ink.textSoft },
  lineValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
  hr: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  afterLabel: { fontSize: 14, fontWeight: '800', color: '#fff' },
  afterValue: { fontSize: 26, fontWeight: '900', color: '#fff' },
  warn: {
    padding: 13, borderRadius: 14,
    backgroundColor: 'rgba(255,92,122,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(255,92,122,0.32)',
  },
  warnTitle: { fontSize: 12, fontWeight: '800', color: '#FF8DA1' },
  warnBody: { fontSize: 11.5, lineHeight: 18, color: ink.textMeta, marginTop: 4 },
});
