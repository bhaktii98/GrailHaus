import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import GameButton from '../components/GameButton';
import { ODDS } from '../data/packs';
import { fmt } from '../lib/money';
import { accent, ink } from '../theme';

const TINT = {
  Common: 'rgba(255,255,255,0.34)', Uncommon: 'rgba(255,255,255,0.5)',
  Rare: '#8FA9FF', Holo: '#C99BFF', Chase: '#FFD75E',
  Entry: 'rgba(255,255,255,0.34)', Signature: 'rgba(242,196,107,0.55)',
  'Rare ref.': '#E0B25E', Grail: '#FFD75E',
};

// A required stop before the first purchase, not a link buried in a footer.
// Chase at 0.4 percent gets a 1.4 percent bar so it stays visible.
export default function OddsScreen({ gate, onAccept }) {
  const [ok, setOk] = React.useState(false);

  return (
    <Screen glow={accent.cards.glow} intensity={0.2}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>{gate ? 'BEFORE YOU BUY' : 'PUBLISHED ODDS'}</Text>
        <Text style={styles.title}>{'Every chance is\npublished.'}</Text>
        <Text style={styles.para}>
          Contents are rolled on our server the moment you pay, and the seed is
          yours to verify afterwards.
        </Text>

        <Table data={ODDS.cards} tint="#C99BFF" />
        <Table data={ODDS.watches} tint="#F2C46B" />

        <View style={styles.verify}>
          <Text style={styles.verifyTitle}>Verify any pull</Text>
          <Text style={styles.verifyBody}>
            We commit a hashed seed at purchase and reveal it after the rip.
          </Text>
          <Text style={styles.hash}>sha256 - 9f2c...a41b</Text>
        </View>
      </ScrollView>

      {gate ? (
        <View style={styles.gate}>
          <Pressable style={styles.check} onPress={() => setOk(!ok)}>
            <View style={[styles.box, ok && { backgroundColor: accent.cards.c1 }]}>
              {ok ? <Text style={styles.tick}>OK</Text> : null}
            </View>
            <Text style={styles.checkText}>
              I understand the odds and that pack contents are random.
            </Text>
          </Pressable>
          <GameButton
            label="TAKE ME TO THE SHELF"
            accent={ok ? accent.cards : accent.danger}
            onPress={() => ok && onAccept && onAccept()}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function Table({ data, tint }) {
  return (
    <View style={styles.table}>
      <Text style={[styles.tableLabel, { color: tint }]}>{data.label}</Text>
      {data.rows.map((r) => (
        <View key={r.tier} style={styles.oddsRow}>
          <Text style={styles.oddsTier}>{r.tier}</Text>
          <View style={styles.oddsTrack}>
            <View style={[
              styles.oddsFill,
              // Floor the bar so a sub-1% row is still readable.
              { width: Math.max(r.pct, 1.4) + '%', backgroundColor: TINT[r.tier] || tint },
            ]} />
          </View>
          <Text style={styles.oddsPct}>{r.pct.toFixed(1) + '%'}</Text>
        </View>
      ))}
      <Text style={styles.ev}>
        {'Expected contents ' + fmt(data.evCents) + ' - price ' + fmt(data.priceCents) + ' - house edge ' + data.edge}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 24 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2.9, color: ink.textMeta },
  title: {
    fontSize: 32, fontWeight: '900', color: '#fff',
    lineHeight: 35, letterSpacing: -0.9, marginTop: 12,
  },
  para: { fontSize: 13, lineHeight: 21, color: ink.textSoft, marginTop: 10 },
  table: { marginTop: 24 },
  tableLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  oddsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  oddsTier: { width: 80, fontSize: 12.5, fontWeight: '700', color: '#fff' },
  oddsTrack: {
    flex: 1, height: 7, borderRadius: 4, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  oddsFill: { height: '100%', borderRadius: 4 },
  oddsPct: { width: 48, textAlign: 'right', fontSize: 12.5, fontWeight: '800', color: '#fff' },
  ev: { fontSize: 11, fontWeight: '500', color: ink.textMeta, marginTop: 8 },
  verify: {
    marginTop: 26, padding: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  verifyTitle: { fontSize: 13, fontWeight: '800', color: '#fff' },
  verifyBody: { fontSize: 12, lineHeight: 19, color: ink.textMeta, marginTop: 5 },
  hash: { fontSize: 11, fontWeight: '600', color: '#C99BFF', marginTop: 10 },
  gate: { paddingHorizontal: 24, paddingBottom: 30, gap: 16 },
  check: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  box: {
    width: 24, height: 24, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  tick: { fontSize: 9, fontWeight: '900', color: '#fff' },
  checkText: { flex: 1, fontSize: 12, lineHeight: 19, color: ink.textMeta },
});
