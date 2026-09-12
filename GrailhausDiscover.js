/**
 * Grailhaus — Discover screen (React Native)
 *
 * deps:  expo install expo-linear-gradient react-native-svg
 *        fonts: Cinzel (wordmark) + Manrope (UI) via expo-font
 *
 * Swap IMAGES.* for your own category art.
 */
import React, { useState } from 'react';
import {
  View, Text, Image, ScrollView, Pressable, TextInput, StatusBar,
  StyleSheet, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

const PURPLE = '#a855f7';
const OFF = 'rgba(255,255,255,0.58)';

const IMAGES = {
  cards:       { uri: 'https://placehold.co/520x280/2a0a5c/2a0a5c' },
  watches:     { uri: 'https://placehold.co/520x280/1f1603/1f1603' },
  bags:        { uri: 'https://placehold.co/520x280/2a1209/2a1209' },
  collections: { uri: 'https://placehold.co/520x280/2b0f52/2b0f52' },
};

const ROWS = [
  {
    key: 'cards', kicker: 'TRADING CARDS', title: 'Trading Cards', title2: 'Discovery',
    stats: '25 items · 4 tiers · 2 listed now', blurb: 'Iconic cards. Real value. Endless possibilities.',
    accent: '#e8bb4e', kickerColor: '#e0b34a', border: 'rgba(216,170,60,0.55)',
    bg: ['#241804', '#120a02'], scrim: ['rgba(14,9,2,0.97)', 'rgba(14,9,2,0.55)', 'rgba(0,0,0,0)'],
    ring: 'rgba(216,170,60,0.55)',
  },
  {
    key: 'watches', kicker: 'WATCHES', title: 'Watches', title2: 'Discovery',
    stats: '3 items · 3 tiers · 1 listed now', blurb: 'Legendary timepieces. Timeless value.',
    accent: '#f0c247', kickerColor: '#e0b34a', border: 'rgba(216,170,60,0.5)',
    bg: ['#1f1603', '#0f0902'], scrim: ['rgba(12,8,2,0.97)', 'rgba(12,8,2,0.5)', 'rgba(0,0,0,0)'],
    ring: 'rgba(216,170,60,0.55)',
  },
  {
    key: 'bags', kicker: 'HANDBAGS', title: 'Handbags', title2: 'Discovery',
    stats: '1 items · 1 tier · 1 listed now', blurb: 'Iconic pieces. Endless style.',
    accent: '#f0a988', kickerColor: '#e79a78', border: 'rgba(226,140,105,0.45)',
    bg: ['#2a1209', '#150803'], scrim: ['rgba(20,8,4,0.97)', 'rgba(20,8,4,0.5)', 'rgba(0,0,0,0)'],
    ring: 'rgba(226,140,105,0.5)',
  },
  {
    key: 'collections', kicker: 'COLLECTIONS', title: 'Browse', title2: 'Collections', inline: true,
    stats: '24 collections · 252 items · across every category', blurb: 'Curated drops. Iconic brands. All in one place.',
    accent: '#c084fc', kickerColor: '#c9a3ff', border: 'rgba(168,85,247,0.5)',
    bg: ['#2b0f52', '#160727'], scrim: ['rgba(20,7,38,0.97)', 'rgba(20,7,38,0.5)', 'rgba(0,0,0,0)'],
    ring: 'rgba(168,85,247,0.55)',
  },
];

/* -------------------------------- icons -------------------------------- */
const Chevron = ({ color = '#fff' }) => (
  <Svg width={11} height={11} viewBox="0 0 14 14"><Path d="M4.5 1.5 10 7l-5.5 5.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
);
const IconHome = ({ c }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M3.6 10.3 12 3.6l8.4 6.7V19.4a1.2 1.2 0 0 1-1.2 1.2H4.8a1.2 1.2 0 0 1-1.2-1.2V10.3Z" stroke={c} strokeWidth={1.7} strokeLinejoin="round" fill="none" /></Svg>
);
const IconCase = ({ c }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24"><G stroke={c} strokeWidth={1.7} fill="none" strokeLinejoin="round"><Rect x={3.2} y={7.4} width={17.6} height={12.6} rx={2.2} /><Path d="M8.8 7.4V5.8a1.7 1.7 0 0 1 1.7-1.7h3a1.7 1.7 0 0 1 1.7 1.7v1.6M3.2 12.6h17.6" /></G></Svg>
);
const IconStore = ({ c }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M3.4 9.3 5.1 4.5h13.8l1.7 4.8M3.4 9.3h17.2M4.6 9.3v10.2h14.8V9.3M9 19.5v-5.4h4.4v5.4" stroke={c} strokeWidth={1.7} fill="none" strokeLinejoin="round" /></Svg>
);
const IconCompassSolid = ({ c }) => (
  <Svg width={15} height={15} viewBox="0 0 24 24"><G stroke={c} strokeWidth={2} fill="none" strokeLinejoin="round"><Circle cx={12} cy={12} r={9} /><Path d="M15.6 8.4 13.6 13.6 8.4 15.6 10.4 10.4Z" fill={c} /></G></Svg>
);

/* -------------------------------- screen ------------------------------- */
export default function GrailhausDiscover() {
  const [tab, setTab] = useState('Discover');
  const [query, setQuery] = useState('');
  const color = (n) => (tab === n ? PURPLE : OFF);
  const active = tab === 'Discover';

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1a0d2b', '#0b0513', '#07030c', '#0b0513']} locations={[0, 0.2, 0.6, 1]} style={StyleSheet.absoluteFill} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={s.statusBar}>
          <Text style={s.statusTime}>12:46</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Svg width={18} height={12} viewBox="0 0 18 12"><G fill="#fff"><Rect x={0} y={8} width={3} height={4} rx={1} /><Rect x={5} y={5.5} width={3} height={6.5} rx={1} /><Rect x={10} y={3} width={3} height={9} rx={1} /><Rect x={15} y={0} width={3} height={12} rx={1} /></G></Svg>
            <Svg width={17} height={12} viewBox="0 0 17 12"><G fill="#fff"><Path d="M8.5 11.5 6 8.8a3.6 3.6 0 0 1 5 0l-2.5 2.7Z" /><Path d="M12.3 6.6a5.6 5.6 0 0 0-7.6 0L3 4.8a8 8 0 0 1 11 0l-1.7 1.8Z" /><Path d="M15.6 3.1a10.3 10.3 0 0 0-14.2 0L0 1.6a12.3 12.3 0 0 1 17 0l-1.4 1.5Z" /></G></Svg>
            <View style={s.battery}><View style={s.batteryFill} /></View>
          </View>
        </View>

        {/* header */}
        <View style={s.header}>
          <View style={s.logoMark}>
            <View style={{ position: 'absolute', top: 2 }}>
              <Svg width={18} height={10} viewBox="0 0 22 12"><Path d="M1 11 0 2l5.5 3.4L11 0l5.5 5.4L22 2l-1 9H1Z" fill="#dfae3f" /></Svg>
            </View>
            <Text style={s.logoG}>G</Text>
          </View>
          <Text style={s.wordmark}>GRAILHAUS</Text>
          <View style={s.divider} />
          <Text style={s.screenName}>Discover</Text>
          <View style={{ flex: 1 }} />
          <View style={s.coinPill}>
            <LinearGradient colors={['#ffeaa0', '#d79b21', '#96650d']} style={s.coin} />
            <Text style={s.coinText}>802.6</Text>
          </View>
        </View>

        {/* headline */}
        <View style={s.headRow}>
          <Text style={s.head}>
            Find the thing{'\n'}you <Text style={s.headAccent}>already want.</Text>
          </Text>
          <Pressable style={s.gear}>
            <Svg width={21} height={21} viewBox="0 0 24 24"><Path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Zm9 3.6c0 .6-.05 1.2-.14 1.76l2.06 1.6-2.1 3.64-2.44-.98a8.9 8.9 0 0 1-3.04 1.76L14.96 23h-4.2l-.38-2.62a8.9 8.9 0 0 1-3.04-1.76l-2.44.98-2.1-3.64 2.06-1.6a9.6 9.6 0 0 1 0-3.52l-2.06-1.6L4.9 5.6l2.44.98a8.9 8.9 0 0 1 3.04-1.76L10.76 1h4.2l.38 2.62a8.9 8.9 0 0 1 3.04 1.76l2.44-.98 2.1 3.64-2.06 1.6c.09.56.14 1.16.14 1.76Z" fill="rgba(255,255,255,0.78)" /></Svg>
          </Pressable>
        </View>

        <Text style={s.lede}>
          Search the catalogue, then choose how to get it — chase it in a pack, or buy the exact one from someone who has it.
        </Text>

        {/* search */}
        <View style={s.search}>
          <Svg width={19} height={19} viewBox="0 0 20 20"><G stroke="rgba(255,255,255,0.55)" strokeWidth={1.8} fill="none" strokeLinecap="round"><Circle cx={8.6} cy={8.6} r={6.2} /><Path d="m13.4 13.4 4 4" /></G></Svg>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search cards, watches, sets, brands"
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={s.searchInput}
          />
        </View>

        {/* category rows */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
          {ROWS.map((r) => (
            <Pressable key={r.key} style={[s.row, { borderColor: r.border }]}>
              <LinearGradient colors={r.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Image source={IMAGES[r.key]} style={s.rowImg} resizeMode="cover" />
              <LinearGradient
                colors={r.scrim} locations={[0.26, 0.62, 0.88]}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill} pointerEvents="none"
              />

              <View style={s.rowContent} pointerEvents="none">
                <Text style={[s.kicker, { color: r.kickerColor }]}>{r.kicker}</Text>
                <Text style={s.rowTitle}>
                  {r.title}{r.inline ? ' ' : '\n'}
                  <Text style={{ color: r.accent }}>{r.title2}</Text>
                </Text>
                <Text style={s.stats}>{r.stats}</Text>
                <Text style={s.blurb}>{r.blurb}</Text>
              </View>

              <View style={[s.rowArrow, { borderColor: r.ring }]}><Chevron color={r.accent} /></View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* bottom nav */}
      <View style={s.navWrap} pointerEvents="box-none">
        <LinearGradient colors={['rgba(7,3,12,0)', '#080310']} locations={[0, 0.4]} style={s.navFade} pointerEvents="none" />
        <View style={s.navBar}>
          <Pressable style={s.navItem} onPress={() => setTab('Home')}>
            <IconHome c={color('Home')} />
            <Text style={[s.navLabel, { color: color('Home') }]}>Home</Text>
          </Pressable>

          <Pressable style={{ flex: 1 }} onPress={() => setTab('Discover')}>
            {active ? (
              <LinearGradient colors={['#8b3ef0', '#6d28d9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.discoverPill}>
                <View style={[s.discoverIcon, { backgroundColor: '#fff' }]}><IconCompassSolid c="#7c3aed" /></View>
                <Text style={[s.navLabel, { color: '#fff', fontWeight: '700' }]}>Discover</Text>
              </LinearGradient>
            ) : (
              <View style={s.discoverPill}>
                <View style={s.discoverIcon}><IconCompassSolid c={OFF} /></View>
                <Text style={[s.navLabel, { color: OFF }]}>Discover</Text>
              </View>
            )}
          </Pressable>

          <Pressable style={s.navItem} onPress={() => setTab('Portfolio')}>
            <IconCase c={color('Portfolio')} />
            <Text style={[s.navLabel, { color: color('Portfolio') }]}>Portfolio</Text>
          </Pressable>

          <Pressable style={s.navItem} onPress={() => setTab('Marketplace')}>
            <IconStore c={color('Marketplace')} />
            <Text style={[s.navLabel, { color: color('Marketplace') }]}>Marketplace</Text>
          </Pressable>
        </View>
        <View style={s.homeIndicatorWrap}><View style={s.homeIndicator} /></View>
      </View>
    </View>
  );
}

/* -------------------------------- styles ------------------------------- */
const SERIF = Platform.select({ ios: 'Cinzel-SemiBold', android: 'Cinzel-SemiBold', default: 'serif' });

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07030c' },

  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 13, paddingBottom: 4 },
  statusTime: { color: '#fff', fontSize: 16, fontWeight: '700' },
  battery: { width: 25, height: 12, borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.55)', borderRadius: 3.5, padding: 1.4 },
  batteryFill: { flex: 1, backgroundColor: '#fff', borderRadius: 1.5 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  logoMark: { width: 34, height: 38, alignItems: 'center', justifyContent: 'flex-end' },
  logoG: { fontFamily: SERIF, fontSize: 25, color: '#e8c574', lineHeight: 30 },
  wordmark: { fontFamily: SERIF, fontSize: 19, letterSpacing: 1.4, color: '#eccf8c' },
  divider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 5 },
  screenName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 7, paddingRight: 14, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(216,170,60,0.4)', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  coin: { width: 22, height: 22, borderRadius: 11 },
  coinText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingTop: 16 },
  head: { flex: 1, fontSize: 31, fontWeight: '800', color: '#fff', lineHeight: 35, letterSpacing: -1 },
  headAccent: { color: '#e8bb4e' },
  gear: { width: 44, height: 44, borderRadius: 22, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' },
  lede: { paddingHorizontal: 16, paddingTop: 12, fontSize: 14.5, lineHeight: 21, color: 'rgba(255,255,255,0.62)' },

  search: { marginHorizontal: 16, marginTop: 20, height: 58, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.045)', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '500', padding: 0 },

  row: { height: 138, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  rowImg: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '64%' },
  rowContent: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 15, paddingVertical: 13 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 3 },
  rowTitle: { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 23, letterSpacing: -0.5, marginTop: 5 },
  stats: { fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginTop: 7 },
  blurb: { fontSize: 11.5, lineHeight: 15, color: 'rgba(255,255,255,0.66)', marginTop: 5, maxWidth: '54%' },
  rowArrow: { position: 'absolute', right: 12, top: 14, width: 30, height: 30, borderRadius: 15, borderWidth: 1, backgroundColor: 'rgba(10,5,16,0.45)', alignItems: 'center', justifyContent: 'center' },

  navWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  navFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 130 },
  navBar: { marginHorizontal: 16, height: 82, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(20,10,32,0.94)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 6 },
  navLabel: { fontSize: 12.5, fontWeight: '600' },
  discoverPill: { height: 62, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#7c3aed', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  discoverIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  homeIndicatorWrap: { paddingTop: 12, paddingBottom: 9, alignItems: 'center' },
  homeIndicator: { width: 134, height: 5, borderRadius: 3, backgroundColor: '#fff' },
});
