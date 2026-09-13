import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import Screen from '../components/Screen';
import RayBurst from '../components/RayBurst';
import PackFace from '../components/PackFace';
import GameButton from '../components/GameButton';
import Dots from '../components/Dots';
import TabBar from '../components/TabBar';
import { PACKS } from '../data/packs';
import { fmt } from '../lib/money';
import { tap } from '../lib/haptics';
import { accent, ink, spring } from '../theme';

const { width: W } = Dimensions.get('window');

// The hero screen. Packs fan in 3D; the whole screen recolours to the
// selected one — wash, glow, button gradient and price plate together.
export default function PackSelectScreen({ category, onOpen, onTab }) {
  const cat = category || 'cards';
  const list = PACKS[cat];
  const acc = accent[cat];
  const [sel, setSel] = React.useState(1);
  const cur = list[sel];

  const pick = (i) => { tap(); setSel(i); };

  return (
    <Screen glow={acc.glow} intensity={0.34}>
      <RayBurst size={W * 2.4} tint={['#ffffff', '#ffffff']} spin={100} count={20} opacity={0.55} />

      <View style={styles.head}>
        <Text style={styles.brand}>GRAILHAUS</Text>
        <View style={styles.purse}>
          <View style={styles.coin} />
          <Text style={styles.purseText}>2,500</Text>
        </View>
      </View>

      <Text style={styles.kicker}>CHOOSE YOUR PACK</Text>

      <View style={styles.stage}>
        {list.map((p, i) => (
          <FannedPack key={p.id} pack={p} offset={i - sel} onPress={() => pick(i)} />
        ))}
      </View>

      <View style={styles.foot}>
        <Dots count={list.length} index={sel} onPick={pick} />
        <Text style={styles.name}>{cur.name}</Text>
        <Text style={styles.sub}>{cur.sub}</Text>
        <GameButton
          label="OPEN PACK"
          accent={acc}
          dark={cat === 'watches'}
          onPress={() => onOpen && onOpen(cur)}
          style={{ marginTop: 18, alignSelf: 'stretch' }}
          right={
            <View style={styles.priceTag}>
              <View style={styles.coin} />
              <Text style={styles.priceText}>{fmt(cur.priceCents, { compact: true }).slice(1)}</Text>
            </View>
          }
        />
        <Pressable><Text style={styles.odds}>View odds for this pack</Text></Pressable>
      </View>

      <TabBar active="Packs" onChange={onTab} />
    </Screen>
  );
}

// Depth is expressed four ways at once: x offset, Y-rotation, scale and a
// brightness dim. Only the front pack is at full luminance.
function FannedPack({ pack, offset, onPress }) {
  const d = Math.abs(offset);
  const style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1100 },
      { translateX: withSpring(offset * 116, spring.cards) },
      { translateY: withSpring(d * 16, spring.cards) },
      { rotateY: withSpring(offset * -19, spring.cards) + 'deg' },
      { scale: withSpring(d === 0 ? 1 : d === 1 ? 0.82 : 0.66, spring.cards) },
    ],
    opacity: withTiming(d > 2 ? 0 : d === 2 ? 0.5 : 1, { duration: 320 }),
    zIndex: 10 - d,
  }));

  return (
    <Animated.View style={[styles.fanned, style]}>
      <Pressable onPress={onPress}>
        <View style={[
          d === 0 ? {
            shadowColor: '#000', shadowOpacity: 0.5,
            shadowRadius: 24, shadowOffset: { width: 0, height: 20 }, elevation: 16,
          } : null,
          d > 0 ? { opacity: 0.62 } : null,
        ]}>
          <PackFace
            art={pack.art}
            width={196}
            height={272}
            radius={16}
            label={pack.name}
            tier={pack.tier}
            crimp
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingTop: 56, paddingHorizontal: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  brand: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  purse: {
    height: 34, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row',
    alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.24)',
  },
  coin: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFD75E' },
  purseText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  kicker: {
    textAlign: 'center', marginTop: 24, fontSize: 11,
    fontWeight: '700', letterSpacing: 3.3, color: ink.textMeta,
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fanned: { position: 'absolute' },
  foot: { paddingHorizontal: 26, alignItems: 'center' },
  name: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.6, marginTop: 20 },
  sub: { fontSize: 13, fontWeight: '500', color: ink.textMeta, marginTop: 5 },
  priceTag: {
    height: 28, paddingHorizontal: 12, borderRadius: 999, flexDirection: 'row',
    alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.32)',
  },
  priceText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  odds: { marginTop: 12, fontSize: 12, fontWeight: '600', color: ink.textMeta },
});
