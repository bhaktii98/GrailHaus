import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Screen from '../components/Screen';
import RayBurst from '../components/RayBurst';
import PackFace from '../components/PackFace';
import GameButton from '../components/GameButton';
import { PULL } from '../data/packs';
import { fmt } from '../lib/money';
import { accent, ink, gain } from '../theme';

const { width: W } = Dimensions.get('window');

// Leads with the number. The card comes second, the arithmetic third.
export default function ResultScreen({ paidCents, onAgain, onCollection }) {
  const paid = paidCents == null ? 4500 : paidCents;
  const pulled = PULL.reduce((s, c) => s + c.valueCents, 0);
  const net = pulled - paid;
  const best = PULL[PULL.length - 1];

  return (
    <Screen glow={accent.gold.glow} intensity={0.4}>
      <RayBurst size={W * 2.2} tint={['#FFE196', '#FFC94A']} spin={40} count={24} opacity={0.72} />

      <View style={styles.head}>
        <Text style={styles.kicker}>CHASE PULL - 0.4%</Text>
        <Text style={styles.big}>{fmt(net, { signed: true, compact: true })}</Text>
        <Text style={styles.on}>{'on a ' + fmt(paid, { compact: true }) + ' pack'}</Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroShadow}>
          <PackFace
            art={best.art}
            width={198}
            height={276}
            radius={16}
            tier={best.tier}
            label={best.name}
          />
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="PAID" value={fmt(paid, { compact: true })} />
        <Stat label="PULLED" value={fmt(pulled, { compact: true })} />
        <View style={styles.statHero}>
          <LinearGradient colors={[accent.gold.c1, accent.gold.c2]} style={styles.statFill}>
            <Text style={styles.statHeroLabel}>RESULT</Text>
            <Text style={styles.statHeroValue}>
              {'+' + Math.round((net / paid) * 100).toLocaleString('en-US') + '%'}
            </Text>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.foot}>
        <GameButton label="OPEN ANOTHER" accent={accent.cards} onPress={onAgain} />
        <Pressable onPress={onCollection}>
          <Text style={styles.secondary}>Add to collection</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: 64, paddingHorizontal: 26, alignItems: 'center' },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 3.3, color: '#FFD75E' },
  big: {
    fontSize: 56, fontWeight: '900', color: '#fff', letterSpacing: -2.2, marginTop: 14,
    textShadowColor: 'rgba(255,201,74,0.7)', textShadowRadius: 40,
  },
  on: { fontSize: 13, fontWeight: '600', color: ink.textMeta, marginTop: 8 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroShadow: {
    shadowColor: '#FFC94A', shadowOpacity: 0.55, shadowRadius: 34,
    shadowOffset: { width: 0, height: 20 }, elevation: 18,
    transform: [{ rotate: '-3deg' }],
  },
  stats: { flexDirection: 'row', gap: 9, paddingHorizontal: 24 },
  stat: {
    flex: 1, minWidth: 0, borderRadius: 16, padding: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)',
  },
  statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, color: ink.textMeta },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 5 },
  statHero: { flex: 1.15, minWidth: 0 },
  statFill: { flex: 1, borderRadius: 16, padding: 13 },
  statHeroLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, color: 'rgba(0,0,0,0.5)' },
  statHeroValue: { fontSize: 18, fontWeight: '800', color: '#2A1706', marginTop: 5 },
  foot: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 30, alignItems: 'center' },
  secondary: { marginTop: 13, fontSize: 13, fontWeight: '700', color: ink.textMeta },
});
