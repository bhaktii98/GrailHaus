/**
 * Grailhaus — Packs screen (React Native)
 *
 * deps:  expo install expo-linear-gradient react-native-svg
 *        fonts: Cinzel (wordmark) + Manrope (UI) via expo-font
 *
 * Tabs: TRADING CARDS / WATCHES / HANDBAGS.
 * The WATCHES tab has two pack sets — flip WATCH_PACK_MODE between
 * 'tiers' (Reserve / Archive / Obsidian Vault) and 'brands'
 * (Time Starter / Vault Time / Iconic Drop).
 *
 * Swap IMAGES.* for your own pack renders (require('../assets/x.png') works too).
 */
import React, { useState } from 'react';
import {
  View, Text, Image, ScrollView, Pressable, StatusBar,
  StyleSheet, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

const PURPLE = '#a855f7';
const DIM = 'rgba(255,255,255,0.55)';
const WATCH_PACK_MODE = 'tiers'; // 'tiers' | 'brands'

const IMAGES = {
  street:     { uri: 'https://placehold.co/300x360/2a0a5c/2a0a5c' },
  vault:      { uri: 'https://placehold.co/300x360/3a0f7a/3a0f7a' },
  black:      { uri: 'https://placehold.co/300x360/1a1206/1a1206' },
  reserve:    { uri: 'https://placehold.co/300x360/141414/141414' },
  archive:    { uri: 'https://placehold.co/300x360/2a1048/2a1048' },
  obsidian:   { uri: 'https://placehold.co/300x360/241a06/241a06' },
  timestart:  { uri: 'https://placehold.co/300x360/171717/171717' },
  vaulttime:  { uri: 'https://placehold.co/300x360/3a1266/3a1266' },
  iconicdrop: { uri: 'https://placehold.co/300x360/2d2005/2d2005' },
  atelier:    { uri: 'https://placehold.co/300x360/1c1c1c/1c1c1c' },
  maison:     { uri: 'https://placehold.co/300x360/2a1048/2a1048' },
  heirloom:   { uri: 'https://placehold.co/300x360/241a06/241a06' },
};

const CARD_TIERS = [
  { label: 'CORE',  crown: '#9aa0ab', bg: ['#2a2c33', '#15161a'], border: 'rgba(255,255,255,0.22)' },
  { label: 'PRIME', crown: '#c98bff', bg: ['#3d1566', '#1e0838'], border: 'rgba(185,120,255,0.75)' },
  { label: 'GRAIL', crown: '#3a2504', bg: ['#f3d488', '#c2911f'], border: 'rgba(246,220,154,0.9)' },
];
const WATCH_TIERS = [
  { label: 'HERITAGE', crown: '#d6dae1', bg: ['#2a2c33', '#15161a'], border: 'rgba(255,255,255,0.30)', fg: '#e8eaee' },
  { label: 'ICON',     crown: '#c98bff', bg: ['#3d1566', '#1e0838'], border: 'rgba(185,120,255,0.80)', fg: '#e5d2ff' },
  { label: 'APEX',     crown: '#f2d78f', bg: ['#5a4212', '#2a1d04'], border: 'rgba(240,205,119,0.85)', fg: '#f6e3ab' },
];

const WATCH_BRAND_PACKS = [
  { key: 'timestart',  kicker: 'CASUAL',      name: 'Time Starter', count: '1 WATCH', price: '$50',  left: '188 left', blurb: 'Quality brands. Real value.',   popular: false, brands: ['SEIKO', 'TISSOT', 'CITIZEN'] },
  { key: 'vaulttime',  kicker: 'PREMIUM',     name: 'Vault Time',   count: '1 WATCH', price: '$150', left: '97 left',  blurb: 'Bigger brands. Bigger moments.', popular: true,  brands: ['TAG HEUER', 'OMEGA', 'BREITLING'] },
  { key: 'iconicdrop', kicker: 'HIGH-STAKES', name: 'Iconic Drop',  count: '1 WATCH', price: '$500', left: '32 left',  blurb: 'The ultimate chase.',            popular: false, brands: ['ROLEX', 'PATEK PHILIPPE', 'AUDEMARS PIGUET'] },
];

const CATS = {
  'TRADING CARDS': {
    eyebrow: 'EXPLORE PACKS',
    headLead: 'Choose your', headAccent: 'chase.',
    pillar: 'REAL BRANDS. REAL VALUE. REAL THRILL.',
    rule: [PURPLE, 'rgba(168,85,247,0)'],
    tierStyle: 'card',
    packs: [
      { key: 'street', kicker: 'CASUAL',      name: 'Street Rip',  count: '5 CARDS', price: '$25',  left: '190 left', blurb: 'Great way to get started.', popular: false },
      { key: 'vault',  kicker: 'MID',         name: 'Vault Break', count: '6 CARDS', price: '$75',  left: '119 left', blurb: 'More heat. Bigger hits.',   popular: true },
      { key: 'black',  kicker: 'HIGH-STAKES', name: 'Black Label', count: '7 CARDS', price: '$250', left: '59 left',  blurb: 'For serious collectors.',   popular: false },
    ],
  },
  'WATCHES': {
    eyebrow: 'EXPLORE WATCH PACKS',
    headLead: 'Iconic time', headAccent: 'awaits.',
    pillar: 'LEGENDARY. ICONIC. TIMELESS. REAL BRANDS. REAL VALUE.',
    rule: ['#e0aa2e', 'rgba(224,170,46,0)'],
    tierStyle: 'watch',
    packs: [
      { key: 'reserve',  kicker: 'ENTRY',       name: 'Reserve',        count: '1 WATCH', price: '$750',   left: '200 left', blurb: 'Iconic pieces. Real beginnings.', popular: false },
      { key: 'archive',  kicker: 'MID',         name: 'Archive',        count: '1 WATCH', price: '$2,500', left: '120 left', blurb: 'Bigger names. Higher moments.',   popular: true },
      { key: 'obsidian', kicker: 'HIGH-STAKES', name: 'Obsidian Vault', count: '1 WATCH', price: '$7,500', left: '50 left',  blurb: 'The ultimate chase.',             popular: false },
    ],
  },
  'HANDBAGS': {
    eyebrow: 'EXPLORE BAG PACKS',
    headLead: 'Carry the', headAccent: 'grail.',
    pillar: 'RARE HOUSES. REAL LEATHER. REAL VALUE.',
    rule: ['#e0aa2e', 'rgba(224,170,46,0)'],
    tierStyle: 'watch',
    packs: [
      { key: 'atelier',  kicker: 'ENTRY',       name: 'Atelier',  count: '1 BAG', price: '$900',   left: '180 left', blurb: 'Everyday icons.',          popular: false },
      { key: 'maison',   kicker: 'MID',         name: 'Maison',   count: '1 BAG', price: '$3,200', left: '96 left',  blurb: 'Runway heat. Real houses.', popular: true },
      { key: 'heirloom', kicker: 'HIGH-STAKES', name: 'Heirloom', count: '1 BAG', price: '$9,000', left: '42 left',  blurb: 'The ultimate chase.',       popular: false },
    ],
  },
};

/* -------------------------------- icons -------------------------------- */
const Crown = ({ w = 16, h = 9, fill = '#e8b93c' }) => (
  <Svg width={w} height={h} viewBox="0 0 22 12"><Path d="M1 11 0 2l5.5 3.4L11 0l5.5 5.4L22 2l-1 9H1Z" fill={fill} /></Svg>
);
const Chevron = ({ size = 11, color = '#fff', w = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 14 14"><Path d="M4.5 1.5 10 7l-5.5 5.5" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
);
const IconHome = ({ c, active }) => (
  <Svg width={23} height={23} viewBox="0 0 24 24"><Path d="M3.6 10.3 12 3.6l8.4 6.7V19.4a1.2 1.2 0 0 1-1.2 1.2H4.8a1.2 1.2 0 0 1-1.2-1.2V10.3Z" stroke={c} strokeWidth={1.7} strokeLinejoin="round" fill={active ? c : 'none'} /></Svg>
);
const IconCompass = ({ c }) => (
  <Svg width={23} height={23} viewBox="0 0 24 24"><G stroke={c} strokeWidth={1.6} fill="none" strokeLinejoin="round"><Circle cx={12} cy={12} r={8.6} /><Path d="M15.4 8.6 13.7 13.7 8.6 15.4 10.3 10.3Z" /></G></Svg>
);
const IconStore = ({ c }) => (
  <Svg width={23} height={23} viewBox="0 0 24 24"><Path d="M3.4 9.3 5.1 4.5h13.8l1.7 4.8M3.4 9.3h17.2M4.6 9.3v10.2h14.8V9.3M9 19.5v-5.4h4.4v5.4" stroke={c} strokeWidth={1.6} fill="none" strokeLinejoin="round" /></Svg>
);
const IconProfile = ({ c }) => (
  <Svg width={23} height={23} viewBox="0 0 24 24"><G stroke={c} strokeWidth={1.6} fill="none" strokeLinejoin="round"><Circle cx={12} cy={8} r={3.8} /><Path d="M4.6 20.4c.6-4 3.6-6.2 7.4-6.2s6.8 2.2 7.4 6.2" /></G></Svg>
);
const IconRevealCards = () => (
  <Svg width={28} height={28} viewBox="0 0 26 26">
    <Rect x={5.6} y={6.4} width={9.4} height={13.4} rx={1.8} fill="#c08a2a" stroke="#f0cd77" strokeWidth={1.2} />
    <Rect x={10.4} y={4.6} width={9.6} height={15} rx={1.8} fill="#e0a83a" stroke="#f7dd9c" strokeWidth={1.2} />
  </Svg>
);
const IconShield = () => (
  <Svg width={22} height={24} viewBox="0 0 20 22">
    <Path d="M10 1.4 18 4.6v6.2c0 4.3-3.3 7.6-8 9-4.7-1.4-8-4.7-8-9V4.6l8-3.2Z" stroke="#d9ab52" strokeWidth={1.3} fill="rgba(217,171,82,0.1)" />
    <Path d="M6.6 10.9 9 13.4l4.6-4.8" stroke="#e8c264" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);

/* -------------------------------- screen ------------------------------- */
export default function GrailhausPacks() {
  const [cat, setCat] = useState('TRADING CARDS');
  const [tab, setTab] = useState('Home');

  const c = CATS[cat];
  const isCard = c.tierStyle === 'card';
  const brandMode = cat === 'WATCHES' && WATCH_PACK_MODE === 'brands';
  const packs = brandMode ? WATCH_BRAND_PACKS : c.packs;
  const tiers = isCard ? CARD_TIERS : WATCH_TIERS;
  const navColor = (n) => (tab === n ? PURPLE : DIM);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#150a24', '#0b0513', '#080310', '#150a24']} locations={[0, 0.26, 0.7, 1]} style={StyleSheet.absoluteFill} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={s.statusBar}>
          <Text style={s.statusTime}>11:52</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Svg width={18} height={12} viewBox="0 0 18 12"><G fill="#fff"><Rect x={0} y={8} width={3} height={4} rx={1} /><Rect x={5} y={5.5} width={3} height={6.5} rx={1} /><Rect x={10} y={3} width={3} height={9} rx={1} /><Rect x={15} y={0} width={3} height={12} rx={1} /></G></Svg>
            <Svg width={17} height={12} viewBox="0 0 17 12"><G fill="#fff"><Path d="M8.5 11.5 6 8.8a3.6 3.6 0 0 1 5 0l-2.5 2.7Z" /><Path d="M12.3 6.6a5.6 5.6 0 0 0-7.6 0L3 4.8a8 8 0 0 1 11 0l-1.7 1.8Z" /><Path d="M15.6 3.1a10.3 10.3 0 0 0-14.2 0L0 1.6a12.3 12.3 0 0 1 17 0l-1.4 1.5Z" /></G></Svg>
            <View style={s.battery}><View style={s.batteryFill} /></View>
          </View>
        </View>

        {/* header */}
        <View style={s.header}>
          <View style={s.logoMark}>
            <View style={{ position: 'absolute', top: 0 }}><Crown w={20} h={11} fill="#dfae3f" /></View>
            <Text style={s.logoG}>G</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, marginLeft: 9 }}>
            <Text style={s.wordmark}>GRAILHAUS</Text>
            <Text style={s.tagline}>COLLECT MORE THAN THINGS</Text>
          </View>
          <View style={s.coinPill}>
            <LinearGradient colors={['#ffeaa0', '#d79b21', '#96650d']} style={s.coin} />
            <Text style={s.coinText}>802.6</Text>
          </View>
          <View style={s.avatar}>
            <Svg width={26} height={24} viewBox="0 0 24 24"><G fill="rgba(220,190,255,0.85)"><Circle cx={12} cy={8.4} r={4.2} /><Path d="M2.8 24c.7-5 4.4-7.6 9.2-7.6s8.5 2.6 9.2 7.6H2.8Z" /></G></Svg>
          </View>
        </View>

        {/* category tabs */}
        <View style={s.tabs}>
          {['TRADING CARDS', 'WATCHES', 'HANDBAGS'].map((n) => {
            const on = cat === n;
            return (
              <Pressable key={n} style={{ flex: 1 }} onPress={() => setCat(n)}>
                {on ? (
                  <LinearGradient colors={['#fbe08f', '#e0aa2e', '#b9821a']} locations={[0, 0.52, 1]} style={[s.tab, s.tabOn]}>
                    <Text style={[s.tabText, { color: '#1b1205' }]}>{n}</Text>
                  </LinearGradient>
                ) : (
                  <View style={s.tab}><Text style={[s.tabText, { color: 'rgba(255,255,255,0.66)' }]}>{n}</Text></View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* hero copy */}
        <View style={s.hero}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.eyebrow}>{c.eyebrow}</Text>
            <Text style={s.head}>
              {c.headLead} <Text style={s.headAccent}>{c.headAccent}</Text>
            </Text>
            <Text style={s.subline}>Every tier. Published odds. No hidden rules.</Text>
          </View>
          <View style={s.pillar}>
            <Text style={s.pillarText}>{c.pillar}</Text>
            <LinearGradient colors={c.rule} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.pillarRule} />
          </View>
        </View>

        {/* packs */}
        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          {packs.map((p) => (
            <View
              key={p.key}
              style={[
                s.pack,
                p.popular && s.packPopular,
              ]}
            >
              {p.popular && (
                <LinearGradient colors={['#3a1263', '#22093f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.badge}>
                  <Crown />
                  <Text style={s.badgeText}>MOST POPULAR</Text>
                </LinearGradient>
              )}

              <View style={s.packImgWrap}>
                <Image source={IMAGES[p.key]} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>

              <View style={s.packBody}>
                <View style={s.packTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.kicker}>{p.kicker}</Text>
                    <Text style={s.packName} numberOfLines={1}>{p.name}</Text>
                  </View>
                  <View style={s.circleBtn}><Chevron /></View>
                </View>

                <View style={s.packRow}>
                  <View>
                    <Text style={s.count}>{p.count}</Text>
                    <Text style={s.price}>{p.price}</Text>
                    <Text style={s.left}>{p.left}</Text>
                  </View>

                  <View style={s.tierGroup}>
                    {p.brands
                      ? p.brands.map((b) => (
                          <View key={b} style={s.brandCol}><Text style={s.brandText}>{b}</Text></View>
                        ))
                      : tiers.map((t) => (
                          <View key={t.label} style={[s.tierCol, { width: 30 }]}>
                            <LinearGradient colors={t.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                              style={[s.chip, { width: isCard ? 18 : 30, height: isCard ? 25 : 30, borderColor: t.border }]}>
                              <Crown w={13} h={8} fill={t.crown} />
                              {!isCard && <Text style={[s.chipLabel, { color: t.fg }]}>{t.label}</Text>}
                            </LinearGradient>
                            {isCard && <Text style={s.tierLabel}>{t.label}</Text>}
                          </View>
                        ))}
                  </View>

                  <Text style={s.blurb}>{p.blurb}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* odds banner */}
        <View style={s.odds}>
          <IconShield />
          <Text style={s.oddsText}>Published odds &amp; expected value before you buy.</Text>
          <Chevron size={12} color="rgba(255,255,255,0.5)" />
        </View>
      </ScrollView>

      {/* bottom nav */}
      <View style={s.navWrap} pointerEvents="box-none">
        <LinearGradient colors={['rgba(8,3,16,0)', '#0a0414']} locations={[0, 0.4]} style={s.navFade} pointerEvents="none" />
        <View style={s.navBar}>
          <View style={s.navItems}>
            <Pressable style={s.navItem} onPress={() => setTab('Home')}>
              <IconHome c={navColor('Home')} active={tab === 'Home'} />
              <Text style={[s.navLabel, { color: navColor('Home'), fontWeight: '700' }]}>Home</Text>
            </Pressable>
            <Pressable style={s.navItem} onPress={() => setTab('Discover')}>
              <IconCompass c={navColor('Discover')} />
              <Text style={[s.navLabel, { color: navColor('Discover') }]}>Discover</Text>
            </Pressable>
            <View style={s.navItem} />
            <Pressable style={s.navItem} onPress={() => setTab('Market')}>
              <IconStore c={navColor('Market')} />
              <Text style={[s.navLabel, { color: navColor('Market') }]}>Market</Text>
            </Pressable>
            <Pressable style={s.navItem} onPress={() => setTab('Profile')}>
              <IconProfile c={navColor('Profile')} />
              <Text style={[s.navLabel, { color: navColor('Profile') }]}>Profile</Text>
            </Pressable>
          </View>

          <Pressable style={s.fab} onPress={() => {}}>
            <LinearGradient colors={['#2a1044', '#160726']} style={s.fabInner}>
              <IconRevealCards />
              <Text style={s.fabText}>REVEAL</Text>
            </LinearGradient>
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

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  logoMark: { width: 42, height: 44, alignItems: 'center', justifyContent: 'flex-end' },
  logoG: { fontFamily: SERIF, fontSize: 27, color: '#e8c574', lineHeight: 32 },
  wordmark: { fontFamily: SERIF, fontSize: 21, letterSpacing: 2.6, color: '#eccf8c' },
  tagline: { fontSize: 7, letterSpacing: 2.2, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 4 },

  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 8, paddingRight: 16, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  coin: { width: 21, height: 21, borderRadius: 11 },
  coinText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  avatar: { width: 38, height: 38, borderRadius: 19, marginLeft: 9, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(168,85,247,0.45)', backgroundColor: '#3a1566', alignItems: 'center', justifyContent: 'flex-end' },

  tabs: { flexDirection: 'row', gap: 2, marginHorizontal: 16, marginTop: 6, padding: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.035)' },
  tab: { height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabOn: { shadowColor: '#d8a42e', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5, borderWidth: 1, borderColor: '#f6dc9a' },
  tabText: { fontSize: 13, fontWeight: '800' },

  hero: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingTop: 22, paddingBottom: 14 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 3.2, color: 'rgba(255,255,255,0.62)' },
  head: { fontSize: 27, fontWeight: '800', color: '#fff', marginTop: 9, letterSpacing: -0.6 },
  headAccent: { color: '#e8bb4e' },
  subline: { fontSize: 12.5, color: 'rgba(255,255,255,0.66)', marginTop: 8 },
  pillar: { width: 72, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.14)', paddingLeft: 9 },
  pillarText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.9, lineHeight: 18.5, color: 'rgba(255,255,255,0.4)' },
  pillarRule: { width: 44, height: 2, borderRadius: 2, marginTop: 7 },

  pack: { minHeight: 134, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.035)', paddingLeft: 120, paddingRight: 10, paddingTop: 14, paddingBottom: 16 },
  packPopular: { borderColor: PURPLE, backgroundColor: 'rgba(40,16,66,0.9)', shadowColor: PURPLE, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8 },
  packImgWrap: { position: 'absolute', left: -4, top: -8, bottom: -8, width: 112, borderRadius: 10, overflow: 'hidden' },
  packBody: { flex: 1 },
  badge: { position: 'absolute', right: -8, top: -15, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#b26bf5', zIndex: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },

  packTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 2.6, color: 'rgba(255,255,255,0.55)' },
  packName: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -0.4 },
  circleBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },

  packRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginTop: 6 },
  count: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: 'rgba(255,255,255,0.5)' },
  price: { fontSize: 23, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -0.5 },
  left: { fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 5 },

  tierGroup: { flexDirection: 'row', gap: 2, paddingBottom: 2 },
  tierCol: { alignItems: 'center', gap: 5 },
  chip: { borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  chipLabel: { fontSize: 6.5, fontWeight: '800', letterSpacing: 0.4 },
  tierLabel: { fontSize: 7, fontWeight: '800', letterSpacing: 0.4, color: 'rgba(255,255,255,0.72)' },
  brandCol: { width: 44, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 12 },

  blurb: { flex: 1, minWidth: 46, fontSize: 10.5, lineHeight: 14, color: 'rgba(255,255,255,0.62)' },

  odds: { marginHorizontal: 16, marginTop: 20, minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(216,170,60,0.28)', backgroundColor: 'rgba(255,255,255,0.03)', flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14 },
  oddsText: { flex: 1, fontSize: 12.5, color: 'rgba(255,255,255,0.82)' },

  navWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  navFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 130 },
  navBar: { marginHorizontal: 16, height: 74, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(20,10,32,0.94)' },
  navItems: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 11 },
  navItem: { flex: 1, alignItems: 'center', gap: 5 },
  navLabel: { fontSize: 11.5, fontWeight: '600' },
  fab: { position: 'absolute', left: '50%', marginLeft: -39, top: -26, width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: PURPLE, overflow: 'hidden', shadowColor: PURPLE, shadowOpacity: 0.7, shadowRadius: 14, elevation: 10 },
  fabInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  fabText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: '#fff' },

  homeIndicatorWrap: { paddingTop: 11, paddingBottom: 9, alignItems: 'center' },
  homeIndicator: { width: 134, height: 5, borderRadius: 3, backgroundColor: '#fff' },
});
