import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import PackFace from '../components/PackFace';
import GameButton from '../components/GameButton';
import { accent, ink } from '../theme';

const UNITS = 12;
const FEED = [
  { who: '@heirloom', unit: 12, ago: 'now' },
  { who: '@vaultrat', unit: 11, ago: '4s' },
  { who: '@toploader', unit: 10, ago: '9s' },
  { who: '@slabbed', unit: 9, ago: '15s' },
  { who: '@fifthgen', unit: 8, ago: '22s' },
];

// One SKU, three states. Scarcity gets its own chrome — no tab bar.
export default function DropScreen({ state, onClaim, onShelf }) {
  const s = state || 'live';
  const [left, setLeft] = React.useState(7);
  const [secs, setSecs] = React.useState(9 * 3600 + 42 * 60 + 18);

  // Countdown lives in its own interval so it never re-renders the shelf.
  React.useEffect(() => {
    if (s !== 'soon') return;
    const t = setInterval(() => setSecs((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [s]);

  React.useEffect(() => {
    if (s !== 'live') return;
    const t = setInterval(() => {
      setLeft((v) => (v > 1 && Math.random() > 0.72 ? v - 1 : v));
    }, 1000);
    return () => clearInterval(t);
  }, [s]);

  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  const clock = pad(secs / 3600) + ':' + pad((secs % 3600) / 60) + ':' + pad(secs % 60);

  if (s === 'closed') {
    return (
      <Screen glow="0,0,0" intensity={0}>
        <View style={styles.body}>
          <Text style={styles.kickerDim}>DROP 004 - CLOSED</Text>
          <Text style={styles.titleDim}>{'THE PLATINUM\nTWELVE'}</Text>
          <View style={styles.center}>
            <View style={styles.grey} />
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sold out in 41 seconds</Text>
            <Text style={styles.cardBody}>
              All 12 claimed. You were not charged - nothing left your balance.
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.kicker}>NEXT DROP</Text>
          <View style={styles.nextRow}>
            <View>
              <Text style={styles.nextName}>NEO GENESIS</Text>
              <Text style={styles.nextSub}>Cards - 500 units</Text>
            </View>
            <Text style={styles.nextTime}>2d 04h</Text>
          </View>
          <GameButton label="BROWSE THE SHELF" accent={accent.cards} onPress={onShelf} />
        </View>
      </Screen>
    );
  }

  const live = s === 'live';

  return (
    <Screen glow={live ? accent.danger.glow : accent.watches.glow} intensity={0.26}>
      <View style={styles.body}>
        <View style={styles.liveRow}>
          {live ? <View style={styles.dot} /> : null}
          <Text style={[styles.kicker, live && { color: '#FF8DA1' }]}>
            {live ? 'LIVE NOW' : 'DROP 004 - NOT YET LIVE'}
          </Text>
          {live ? <Text style={styles.watching}>1,842 watching</Text> : null}
        </View>

        <Text style={styles.title}>{'THE PLATINUM\nTWELVE'}</Text>
        {!live ? (
          <Text style={styles.para}>
            Twelve boxes. Each holds one watch from the archive. Nothing restocks.
          </Text>
        ) : null}

        <View style={styles.center}>
          <PackFace
            art={['#FFF8E4', '#EBC87E', '#7A5A22', '#120C04']}
            width={live ? 150 : 180}
            height={live ? 150 : 180}
            radius={16}
          />
        </View>

        {!live ? (
          <View style={styles.countdownCard}>
            <Text style={styles.cdLabel}>OPENS IN</Text>
            <Text style={styles.clock}>{clock}</Text>
            <View style={styles.cdFoot}>
              <View>
                <Text style={styles.price}>$5,000</Text>
                <Text style={styles.priceSub}>12 units - 1 per account</Text>
              </View>
              <View style={styles.notify}>
                <Text style={styles.notifyText}>NOTIFY ME</Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.remainRow}>
              <Text style={styles.cdLabel}>REMAINING</Text>
              <Text style={styles.remain}>
                {left}<Text style={styles.remainOf}>{' / ' + UNITS}</Text>
              </Text>
            </View>
            <View style={styles.pips}>
              {Array.from({ length: UNITS }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pip,
                    { backgroundColor: i < left ? '#F2C46B' : 'rgba(255,255,255,0.12)' },
                  ]}
                />
              ))}
            </View>

            <Text style={[styles.kicker, { marginTop: 20 }]}>CLAIMS</Text>
            <View style={{ flex: 1 }}>
              {FEED.map((c, i) => (
                <View key={c.who} style={[styles.feedRow, { opacity: 1 - i * 0.16 }]}>
                  <View style={styles.avatar} />
                  <Text style={styles.feedText}>
                    {c.who + ' claimed unit ' + c.unit}
                  </Text>
                  <Text style={styles.feedAgo}>{c.ago}</Text>
                </View>
              ))}
            </View>

            <GameButton
              label="CLAIM ONE - $5,000"
              accent={accent.watches}
              dark
              onPress={onClaim}
            />
            <Text style={styles.fine}>
              If two of you tap at once, exactly one gets it. You are not charged for a loss.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingTop: 56, paddingHorizontal: 24, paddingBottom: 34 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5C7A' },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2.9, color: ink.textMeta },
  kickerDim: { fontSize: 11, fontWeight: '800', letterSpacing: 2.9, color: 'rgba(255,255,255,0.4)' },
  watching: { marginLeft: 'auto', fontSize: 12, fontWeight: '600', color: ink.textMeta },
  title: {
    fontSize: 36, fontWeight: '900', color: '#fff',
    lineHeight: 38, letterSpacing: -1.1, marginTop: 12,
  },
  titleDim: {
    fontSize: 34, fontWeight: '900', color: 'rgba(255,255,255,0.42)',
    lineHeight: 36, letterSpacing: -1, marginTop: 12,
  },
  para: { fontSize: 13.5, lineHeight: 22, color: ink.textSoft, marginTop: 10 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 22 },
  grey: {
    width: 150, height: 150, borderRadius: 16, backgroundColor: '#1D1A16',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)',
  },
  countdownCard: {
    borderRadius: 20, padding: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5, borderColor: 'rgba(242,196,107,0.28)',
  },
  cdLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2.4, color: ink.textMeta },
  clock: {
    fontSize: 40, fontWeight: '500', color: '#F2C46B',
    letterSpacing: -1, marginTop: 10, fontVariant: ['tabular-nums'],
  },
  cdFoot: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between', marginTop: 16,
  },
  price: { fontSize: 26, fontWeight: '900', color: '#fff' },
  priceSub: { fontSize: 11, fontWeight: '600', color: ink.textMeta, marginTop: 3 },
  notify: {
    height: 46, paddingHorizontal: 20, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(242,196,107,0.16)',
    borderWidth: 1.5, borderColor: 'rgba(242,196,107,0.5)',
  },
  notifyText: { fontSize: 13.5, fontWeight: '800', color: '#F2C46B' },
  remainRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  remain: { fontSize: 32, fontWeight: '900', color: '#F2C46B' },
  remainOf: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
  pips: { flexDirection: 'row', gap: 4, marginTop: 11 },
  pip: { flex: 1, height: 6, borderRadius: 4 },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(242,196,107,0.5)' },
  feedText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' },
  feedAgo: { fontSize: 10.5, fontWeight: '600', color: ink.textMeta },
  card: {
    borderRadius: 20, padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  cardTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  cardBody: { fontSize: 13, lineHeight: 21, color: ink.textSoft, marginTop: 6 },
  nextRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 12, marginBottom: 16,
  },
  nextName: { fontSize: 20, fontWeight: '900', color: '#fff' },
  nextSub: { fontSize: 11, fontWeight: '600', color: ink.textMeta, marginTop: 3 },
  nextTime: { fontSize: 16, fontWeight: '800', color: '#C99BFF' },
  fine: { textAlign: 'center', marginTop: 11, fontSize: 11.5, fontWeight: '500', color: ink.textMeta },
});
