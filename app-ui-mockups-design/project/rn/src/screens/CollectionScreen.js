import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import PackFace from '../components/PackFace';
import TabBar from '../components/TabBar';
import { fmt } from '../lib/money';
import { accent, ink, gain } from '../theme';

const OWNED = [
  { n: 'ARCHIVIST', t: 'CHASE', v: 412000, art: ['#FFF6D8', '#FFC94A', '#E0761A', '#7A2C06'], ring: '#FFD75E' },
  { n: 'STORMBIND', t: 'RARE', v: 91000, art: ['#DCE8FF', '#6C8BF5', '#2B2F86'], ring: '#8FA9FF' },
  { n: 'THORNWAKE', t: 'UNCOMMON', v: 2400, art: ['#D6F5B4', '#6FB758', '#2C5A2A'], ring: 'rgba(255,255,255,0.22)' },
  { n: 'CINDERLING', t: 'COMMON', v: 900, art: ['#F2CDA8', '#B87A4E', '#5E3722'], ring: 'rgba(255,255,255,0.22)' },
  { n: 'TIDECALLER', t: 'COMMON', v: 600, art: ['#C9DCE8', '#6C8AA3', '#33455C'], ring: 'rgba(255,255,255,0.22)' },
  { n: '???', t: 'LOCKED', v: null, art: ['#241E33', '#150F22'], ring: 'rgba(255,255,255,0.1)' },
];

// The completionist hook is the locked slot. Set progress is the headline,
// portfolio value the supporting number.
export default function CollectionScreen({ onTab }) {
  const total = OWNED.reduce((s, c) => s + (c.v || 0), 0);
  const held = OWNED.filter((c) => c.v != null).length;

  return (
    <Screen glow={accent.cards.glow} intensity={0.26}>
      <View style={styles.head}>
        <Text style={styles.title}>Collection</Text>
        <View style={styles.purse}>
          <View style={styles.coin} />
          <Text style={styles.purseText}>2,500</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryLabel}>TOTAL VALUE</Text>
              <Text style={styles.summaryValue}>{fmt(2086715, { compact: true })}</Text>
            </View>
            <View style={styles.delta}>
              <Text style={styles.deltaText}>+1.84%</Text>
            </View>
          </View>

          {/* Allocation across both categories. */}
          <View style={styles.alloc}>
            <View style={[styles.allocSeg, { flex: 58, backgroundColor: accent.cards.c1 }]} />
            <View style={[styles.allocSeg, { flex: 42, backgroundColor: accent.watches.c1 }]} />
          </View>
          <View style={styles.legend}>
            <Text style={styles.legendText}>{'62 items - 2 categories'}</Text>
            <Text style={styles.legendLink}>Sell items</Text>
          </View>
        </View>

        <View style={styles.setHead}>
          <Text style={styles.setName}>{'PRISM CORE  ' + held + ' / ' + OWNED.length}</Text>
          <Text style={styles.setLink}>All sets</Text>
        </View>

        <View style={styles.grid}>
          {OWNED.map((c) => (
            <View key={c.n} style={[styles.cell, c.v == null && { opacity: 0.45 }]}>
              <View style={{ borderRadius: 13, borderWidth: 2, borderColor: c.ring, overflow: 'hidden' }}>
                <PackFace art={c.art} width={100} height={139} radius={11} />
              </View>
              <Text style={styles.cellName}>{c.n}</Text>
              <View style={styles.cellFoot}>
                <Text style={styles.cellTier}>{c.t}</Text>
                <Text style={styles.cellValue}>
                  {c.v == null ? '-' : fmt(c.v, { compact: true })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <TabBar active="Portfolio" onChange={onTab} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingTop: 56, paddingHorizontal: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.9 },
  purse: {
    height: 34, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row',
    alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)',
  },
  coin: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFD75E' },
  purseText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  scroll: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 20 },
  summary: {
    borderRadius: 20, padding: 18,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)',
  },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2.2, color: ink.textMeta },
  summaryValue: { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -1.2, marginTop: 6 },
  delta: {
    height: 28, paddingHorizontal: 11, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(99,232,92,0.2)',
    borderWidth: 1, borderColor: 'rgba(99,232,92,0.4)',
  },
  deltaText: { fontSize: 12.5, fontWeight: '800', color: gain },
  alloc: { flexDirection: 'row', gap: 3, height: 8, marginTop: 16, borderRadius: 5, overflow: 'hidden' },
  allocSeg: { height: '100%' },
  legend: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 11,
  },
  legendText: { fontSize: 11.5, fontWeight: '600', color: ink.textMeta },
  legendLink: { fontSize: 11.5, fontWeight: '700', color: '#C99BFF' },
  setHead: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 22,
  },
  setName: { fontSize: 13, fontWeight: '800', letterSpacing: 1.3, color: '#fff' },
  setLink: { fontSize: 12, fontWeight: '700', color: ink.textMeta },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 14 },
  cell: { width: 104 },
  cellName: { fontSize: 10.5, fontWeight: '800', color: '#fff', marginTop: 7 },
  cellFoot: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 3,
  },
  cellTier: { fontSize: 8, fontWeight: '700', letterSpacing: 1, color: ink.textMeta },
  cellValue: { fontSize: 10.5, fontWeight: '800', color: '#FFD75E' },
});
