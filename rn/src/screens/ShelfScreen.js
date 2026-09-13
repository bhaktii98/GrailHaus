import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Screen from '../components/Screen';
import PackFace from '../components/PackFace';
import GameButton from '../components/GameButton';
import TabBar from '../components/TabBar';
import { PACKS } from '../data/packs';
import { fmt } from '../lib/money';
import { tap } from '../lib/haptics';
import { accent, ink } from '../theme';

// Tapping the switch changes the whole register, not just the accent: cards
// get violet and a bulk button, watches get gold and no bulk buy at all.
export default function ShelfScreen({ onBuy, onTab }) {
  const [cat, setCat] = React.useState('cards');
  const acc = accent[cat];
  const list = PACKS[cat];
  const cards = cat === 'cards';

  const swap = (c) => { tap(); setCat(c); };

  return (
    <Screen glow={acc.glow} intensity={0.26}>
      <View style={styles.head}>
        <Text style={styles.brand}>GRAILHAUS</Text>
        <View style={styles.purse}>
          <View style={styles.coin} />
          <Text style={styles.purseText}>2,500</Text>
        </View>
      </View>

      <View style={styles.switchWrap}>
        <View style={styles.switchTrack}>
          <Seg label="TRADING CARDS" on={cards} acc={accent.cards} onPress={() => swap('cards')} />
          <Seg label="WATCHES" on={!cards} acc={accent.watches} dark onPress={() => swap('watches')} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{cards ? 'Trading Cards' : 'Watches'}</Text>
        <Text style={styles.sub}>
          {cards ? 'Three tiers - $10 to $180' : 'Three tiers - $500 to $5,000'}
        </Text>

        {list.map((p) => {
          const low = p.stock / p.cap < 0.2;
          return (
            <View
              key={p.id}
              style={[
                styles.row,
                p.hero && {
                  borderColor: 'rgba(' + acc.glow + ',0.6)',
                  shadowColor: 'rgb(' + acc.glow + ')',
                  shadowOpacity: 0.3, shadowRadius: 22,
                  shadowOffset: { width: 0, height: 12 }, elevation: 10,
                },
              ]}
            >
              <View style={p.hero ? styles.heroArt : styles.rowArt}>
                <PackFace
                  art={p.art}
                  width={p.hero ? 138 : 76}
                  height={p.hero ? 190 : 104}
                  radius={12}
                  crimp
                />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.tierChip}>
                  <Text style={styles.tierText}>{p.tier}</Text>
                </View>
                <Text style={[styles.name, p.hero && { fontSize: 24 }]}>{p.name}</Text>
                <Text style={styles.rowSub}>{p.sub}</Text>

                {/* Finite stock, shown depleting. */}
                <View style={styles.stockTrack}>
                  <View style={[
                    styles.stockFill,
                    { width: Math.round((p.stock / p.cap) * 100) + '%' },
                    { backgroundColor: low ? accent.danger.c1 : acc.c1 },
                  ]} />
                </View>
                <Text style={styles.stockText}>
                  {p.stock + ' of ' + p.cap + ' in stock'}
                </Text>

                <View style={styles.buyRow}>
                  <GameButton
                    label={'BUY 1  ' + fmt(p.priceCents, { compact: true })}
                    accent={acc}
                    dark={!cards}
                    onPress={() => onBuy && onBuy(p, 1)}
                    style={{ flex: 1 }}
                  />
                  {p.bulk ? (
                    <Pressable style={styles.bulk} onPress={() => onBuy && onBuy(p, 10)}>
                      <Text style={styles.bulkText}>x10</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}

        <View style={styles.note}>
          <Text style={styles.noteText}>
            {cards ? 'Bulk x10 on Casual and Mid only' : 'No bulk on watches - one box at a time'}
          </Text>
          <Text style={[styles.noteLink, { color: acc.c1 }]}>Odds</Text>
        </View>
      </ScrollView>

      <TabBar active="Packs" onChange={onTab} />
    </Screen>
  );
}

function Seg({ label, on, acc, dark, onPress }) {
  const body = <Text style={[styles.segText, on && dark && { color: '#1A1206' }, on && !dark && { color: '#fff' }]}>{label}</Text>;
  return (
    <Pressable style={styles.seg} onPress={onPress}>
      {on ? (
        <LinearGradient colors={[acc.c1, acc.c2]} style={styles.segFill}>{body}</LinearGradient>
      ) : (
        <View style={styles.segFill}>{body}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingTop: 56, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  brand: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  purse: {
    height: 34, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row',
    alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)',
  },
  coin: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFD75E' },
  purseText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  switchWrap: { paddingHorizontal: 20, paddingTop: 20 },
  switchTrack: {
    height: 52, borderRadius: 16, padding: 5, flexDirection: 'row', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)',
  },
  seg: { flex: 1 },
  segFill: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 13.5, fontWeight: '800', letterSpacing: 0.6, color: 'rgba(255,255,255,0.5)' },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, gap: 12 },
  title: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.9 },
  sub: { fontSize: 12.5, fontWeight: '500', color: ink.textMeta, marginTop: 4, marginBottom: 4 },
  row: {
    borderRadius: 20, padding: 14, flexDirection: 'row', gap: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)',
  },
  rowArt: {},
  heroArt: {},
  tierChip: {
    alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tierText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 1.6, color: 'rgba(255,255,255,0.8)' },
  name: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.2, marginTop: 8 },
  rowSub: { fontSize: 11.5, fontWeight: '500', color: ink.textMeta, marginTop: 4 },
  stockTrack: {
    height: 5, borderRadius: 3, marginTop: 10, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  stockFill: { height: '100%', borderRadius: 3 },
  stockText: { fontSize: 10, fontWeight: '600', color: ink.textMeta, marginTop: 5 },
  buyRow: { flexDirection: 'row', gap: 9, marginTop: 12, alignItems: 'center' },
  bulk: {
    height: 44, paddingHorizontal: 16, borderRadius: 13, marginBottom: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  bulkText: { fontSize: 13.5, fontWeight: '900', color: '#fff' },
  note: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  noteText: { fontSize: 11.5, fontWeight: '600', color: ink.textMeta, flex: 1 },
  noteLink: { fontSize: 12, fontWeight: '800' },
});
