/**
 * Grailhaus — Home screen (React Native)
 *
 * deps:  expo install expo-linear-gradient react-native-svg
 *        (fonts) expo-font + @expo-google-fonts/playfair-display @expo-google-fonts/manrope
 *
 * Swap the IMAGES entries for your own assets (require('../assets/x.png') works too).
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, Pressable, StatusBar,
  StyleSheet, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

const W = Dimensions.get('window').width;
const PINK = '#ff2d73';
const GOLD = '#e3c176';
const DIM = 'rgba(255,255,255,0.55)';

const IMAGES = {
  heroBg: require('./app/assets/hero-art.jpg'),
  colCards: require('./app/assets/trading-cards-art.jpg'),
  colWatch: require('./app/assets/watches-art.jpg'),
  pulls: [
    { uri: 'https://placehold.co/200x260/3a1206/3a1206' },
    { uri: 'https://placehold.co/200x260/2c0a3a/2c0a3a' },
    { uri: 'https://placehold.co/200x260/0d2237/0d2237' },
    { uri: 'https://placehold.co/200x260/2e2a10/2e2a10' },
  ],
  avatars: [
    { uri: 'https://i.pravatar.cc/64?img=12' },
    { uri: 'https://i.pravatar.cc/64?img=45' },
    { uri: 'https://i.pravatar.cc/64?img=33' },
    { uri: 'https://i.pravatar.cc/64?img=68' },
  ],
};

const PULLS = [
  { name: 'Charizard ex', handle: '@alex.r',   ago: '2m ago',  price: '$947', tier: 'GRAIL', border: 'rgba(214,168,70,0.85)', badge: ['#f3d48a', '#c69a33'], badgeFg: '#2a1a03', priceColor: '#e8c264' },
  { name: 'Mewtwo ex',    handle: '@sarah.k',  ago: '12m ago', price: '$182', tier: 'PRIME', border: 'rgba(168,86,232,0.60)', badge: ['#e13ea6', '#a51ecb'], badgeFg: '#ffffff', priceColor: '#ff5c9d' },
  { name: 'Lugia V',      handle: '@jordan.p', ago: '18m ago', price: '$28',  tier: 'CORE',  border: 'rgba(255,255,255,0.16)', badge: ['#d9dce2', '#9aa0ab'], badgeFg: '#1b1b20', priceColor: '#ffffff' },
  { name: 'Eevee',        handle: '@mike.t',   ago: '21m ago', price: '$12',  tier: 'CORE',  border: 'rgba(255,255,255,0.16)', badge: ['#d9dce2', '#9aa0ab'], badgeFg: '#1b1b20', priceColor: '#ffffff' },
];

const pad = (n) => String(n).padStart(2, '0');

/* ------------------------------- icons ------------------------------- */
const IconChevron = ({ size = 12, color = '#fff', w = 2.2 }) => (
  <Svg width={size} height={size} viewBox="0 0 14 14"><Path d="M4.5 1.5 10 7l-5.5 5.5" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
);
const IconCards = () => (
  <Svg width={13} height={13} viewBox="0 0 16 16"><G stroke="#d9ab52" strokeWidth={1.3} fill="none"><Rect x={2.5} y={2.5} width={7} height={11} rx={1.2} /><Path d="M11 4.2l2.3.8-2.6 8.4" /></G></Svg>
);
const IconShield = () => (
  <Svg width={13} height={13} viewBox="0 0 16 16"><Path d="M8 1.6 13.4 4v4.3c0 3-2.3 5.2-5.4 6.1-3.1-.9-5.4-3.1-5.4-6.1V4L8 1.6Z" stroke="#d9ab52" strokeWidth={1.3} fill="none" /></Svg>
);
const IconBox = () => (
  <Svg width={13} height={13} viewBox="0 0 16 16"><Path d="M8 1.8 14 5v6l-6 3.2L2 11V5l6-3.2ZM2 5l6 3.2L14 5M8 8.2V14" stroke="#d9ab52" strokeWidth={1.3} fill="none" /></Svg>
);
const IconHome = ({ c, active }) => (
  <Svg width={23} height={23} viewBox="0 0 24 24"><Path d="M3.6 10.3 12 3.6l8.4 6.7V19.4a1.2 1.2 0 0 1-1.2 1.2H4.8a1.2 1.2 0 0 1-1.2-1.2V10.3Z" stroke={c} strokeWidth={1.7} strokeLinejoin="round" fill={active ? c : 'none'} /></Svg>
);
const IconCompass = ({ c }) => (
  <Svg width={23} height={23} viewBox="0 0 24 24"><G stroke={c} strokeWidth={1.6} fill="none" strokeLinejoin="round"><Circle cx={12} cy={12} r={8.6} /><Path d="M15.4 8.6 13.7 13.7 8.6 15.4 10.3 10.3Z" /></G></Svg>
);
const IconCase = ({ c }) => (
  <Svg width={23} height={23} viewBox="0 0 24 24"><G stroke={c} strokeWidth={1.6} fill="none" strokeLinejoin="round"><Rect x={3.2} y={7.4} width={17.6} height={12.6} rx={2.2} /><Path d="M8.8 7.4V5.8a1.7 1.7 0 0 1 1.7-1.7h3a1.7 1.7 0 0 1 1.7 1.7v1.6M3.2 12.6h17.6" /></G></Svg>
);
const IconStore = ({ c }) => (
  <Svg width={23} height={23} viewBox="0 0 24 24"><Path d="M3.4 9.3 5.1 4.5h13.8l1.7 4.8M3.4 9.3h17.2M4.6 9.3v10.2h14.8V9.3M9 19.5v-5.4h4.4v5.4" stroke={c} strokeWidth={1.6} fill="none" strokeLinejoin="round" /></Svg>
);
const IconReveal = () => (
  <Svg width={29} height={29} viewBox="0 0 26 26"><G stroke="#fff" strokeWidth={1.6} fill="none" strokeLinejoin="round"><Rect x={6.2} y={5.4} width={13.6} height={16.4} rx={2.2} /><Path d="M9.2 5.6V3.7a1 1 0 0 1 1.2-1l7.6 1.3" /><Circle cx={13} cy={13.6} r={3} /></G></Svg>
);

/* ------------------------------- screen ------------------------------ */
export default function GrailhausHome() {
  const [t, setT] = useState(6 * 3600 + 22 * 60 + 18);
  const [tab, setTab] = useState('Home');
  const [balance, setBalance] = useState(24350);

  useEffect(() => {
    const id = setInterval(() => setT((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const hrs = pad(Math.floor(t / 3600));
  const mins = pad(Math.floor((t % 3600) / 60));
  const secs = pad(t % 60);
  const tabColor = (n) => (tab === n ? PINK : DIM);
  const tabIndex = ['Home', 'Discover', '', 'Collection', 'Marketplace'].indexOf(tab);
  const navW = W - 24;
  const pillLeft = (tabIndex < 0 ? 0 : tabIndex) * (navW / 5) + navW / 10 - 32;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0d0616', '#0a0412', '#100722']} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* status bar */}
        <View style={s.statusBar}>
          <Text style={s.statusTime}>9:41</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Svg width={18} height={12} viewBox="0 0 18 12"><G fill="#fff"><Rect x={0} y={8} width={3} height={4} rx={1} /><Rect x={5} y={5.5} width={3} height={6.5} rx={1} /><Rect x={10} y={3} width={3} height={9} rx={1} /><Rect x={15} y={0} width={3} height={12} rx={1} /></G></Svg>
            <Svg width={17} height={12} viewBox="0 0 17 12"><G fill="#fff"><Path d="M8.5 11.5 6 8.8a3.6 3.6 0 0 1 5 0l-2.5 2.7Z" /><Path d="M12.3 6.6a5.6 5.6 0 0 0-7.6 0L3 4.8a8 8 0 0 1 11 0l-1.7 1.8Z" /><Path d="M15.6 3.1a10.3 10.3 0 0 0-14.2 0L0 1.6a12.3 12.3 0 0 1 17 0l-1.4 1.5Z" /></G></Svg>
            <View style={s.battery}><View style={s.batteryFill} /></View>
          </View>
        </View>

        {/* header */}
        <View style={s.header}>
          <View style={s.logoMark}>
            <View style={s.logoDiamond} />
            <View style={s.logoRing} />
            <Text style={s.logoG}>G</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
            <Text style={s.wordmark}>GRAILHAUS</Text>
            <Text style={s.tagline}>COLLECT  OWN  TRADE</Text>
          </View>
          <View style={s.balancePill}>
            <Text style={s.balanceText}>$ {balance.toLocaleString('en-US')}</Text>
            <Pressable onPress={() => setBalance((b) => b + 500)}>
              <LinearGradient colors={['#f0d284', '#c79730']} style={s.plusBtn}>
                <Svg width={13} height={13} viewBox="0 0 14 14"><Path d="M7 1.6v10.8M1.6 7h10.8" stroke="#241505" strokeWidth={2.4} strokeLinecap="round" /></Svg>
              </LinearGradient>
            </Pressable>
          </View>
          <View style={s.avatarBtn}>
            <Svg width={18} height={18} viewBox="0 0 20 20"><G fill="#e9e4ef"><Circle cx={10} cy={6.4} r={3.6} /><Path d="M2.6 18c.5-4 3.6-6 7.4-6s6.9 2 7.4 6H2.6Z" /></G></Svg>
          </View>
        </View>

        {/* hero */}
        <View style={s.hero}>
          <View style={s.heroCardWrap}>
            <Image source={IMAGES.heroBg} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
          <LinearGradient
            colors={['rgba(14,5,12,0.96)', 'rgba(14,5,12,0.96)', 'transparent']}
            locations={[0, 0.5, 0.6]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill} pointerEvents="none"
          />

          <View style={s.heroContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={s.liveDot} />
              <Text style={s.liveLabel}>FEATURED DROP · LIVE</Text>
            </View>

            <Text style={s.eyebrow}>CARDS · BLACK LABEL</Text>
            <Text style={s.heroTitle}>MIDNIGHT{'\n'}DROP</Text>
            <Text style={s.heroSub}>RARE FINDS. HIGHER STAKES.</Text>

            <View style={s.metaRow}>
              <View style={s.metaItem}><IconCards /><Text style={s.metaText}>7 Cards</Text></View>
              <View style={s.metaDivider} />
              <View style={s.metaItem}><IconShield /><Text style={s.metaText}>$250</Text></View>
              <View style={s.metaDivider} />
              <View style={s.metaItem}><IconBox /><Text style={s.metaText}>15 <Text style={s.metaSmall}>REMAINING</Text></Text></View>
            </View>

            <View style={s.dots}>
              <View style={s.dot} /><View style={[s.dot, s.dotActive]} /><View style={s.dot} />
            </View>

            <View style={s.heroFooter}>
              <Pressable style={{ flex: 1 }} onPress={() => {}}>
                <LinearGradient colors={['#ff2f6e', '#d80f57']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cta}>
                  <Text style={s.ctaText}>VIEW THE DROP</Text>
                  <IconChevron size={14} />
                </LinearGradient>
              </Pressable>
              <View style={{ alignItems: 'center' }}>
                <Text style={s.endsIn}>ENDS IN</Text>
                <View style={s.clock}>
                  <View style={{ alignItems: 'center' }}><Text style={s.clockNum}>{hrs}</Text><Text style={s.clockUnit}>HRS</Text></View>
                  <Text style={s.colon}>:</Text>
                  <View style={{ alignItems: 'center' }}><Text style={s.clockNum}>{mins}</Text><Text style={s.clockUnit}>MINS</Text></View>
                  <Text style={s.colon}>:</Text>
                  <View style={{ alignItems: 'center' }}><Text style={s.clockNum}>{secs}</Text><Text style={s.clockUnit}>SECS</Text></View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* explore collections */}
        <SectionHeader title="EXPLORE COLLECTIONS" style={{ paddingTop: 24, paddingBottom: 11 }} />
        <View style={s.collRow}>
          <CollectionCard
            image={IMAGES.colCards}
            scrim={['rgba(40,8,88,0.97)', 'rgba(40,8,88,0.15)']}
            bg={['#3a0f7a', '#1c0640']}
            kicker={<Text style={s.collKicker}><Text style={{ color: '#b98cff' }}>TRADING </Text><Text style={{ color: '#fff' }}>CARDS</Text></Text>}
            title={'CHASE\nLEGENDS'}
            meta="3 TIERS · FROM $25"
            ring="rgba(185,140,255,0.7)"
          />
          <CollectionCard
            image={IMAGES.colWatch}
            scrim={['rgba(24,14,3,0.97)', 'rgba(24,14,3,0.10)']}
            bg={['#4a3308', '#160d02']}
            kicker={<Text style={[s.collKicker, { color: '#e5bc63' }]}>WATCHES</Text>}
            title={'TIMELESS\nICONS'}
            meta="3 TIERS · FROM $750"
            ring="rgba(229,188,99,0.75)"
          />
        </View>

        {/* recently revealed */}
        <SectionHeader title="RECENTLY REVEALED" style={{ paddingTop: 22, paddingBottom: 2 }} />
        <View style={s.liveRow}>
          <View style={s.greenDot} />
          <Text style={s.liveText}>Live pulls from the community</Text>
        </View>

        <View style={s.pullRow}>
          {PULLS.map((p, i) => (
            <View key={p.name} style={[s.pullCard, { borderColor: p.border }]}>
              <View style={s.pullImgWrap}>
                <Image source={IMAGES.pulls[i]} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <LinearGradient colors={p.badge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tierBadge}>
                  <Text style={[s.tierText, { color: p.badgeFg }]}>{p.tier}</Text>
                </LinearGradient>
              </View>
              <View style={{ padding: 7 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Image source={IMAGES.avatars[i]} style={s.pullAvatar} />
                  <Text style={s.pullHandle} numberOfLines={1}>{p.handle}</Text>
                </View>
                <View style={s.pullFooter}>
                  <Text style={s.pullAgo}>{p.ago}</Text>
                  <Text style={[s.pullPrice, { color: p.priceColor }]}>{p.price}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* bottom nav */}
      <View style={s.navWrap} pointerEvents="box-none">
        <LinearGradient colors={['rgba(10,4,16,0)', '#0c0518']} locations={[0, 0.34]} style={s.navFade} pointerEvents="none" />
        <View style={s.navBar}>
          <View style={[s.navPill, { left: pillLeft }]} />
          <View style={s.navItems}>
            <NavItem label="Home" color={tabColor('Home')} onPress={() => setTab('Home')}
              icon={<IconHome c={tabColor('Home')} active={tab === 'Home'} />} bold />
            <NavItem label="Discover" color={tabColor('Discover')} onPress={() => setTab('Discover')}
              icon={<IconCompass c={tabColor('Discover')} />} />
            <View style={s.navItem}><Text style={[s.navLabel, { color: '#fff', fontWeight: '700' }]}>Reveal</Text></View>
            <NavItem label="Collection" color={tabColor('Collection')} onPress={() => setTab('Collection')}
              icon={<IconCase c={tabColor('Collection')} />} />
            <NavItem label="Marketplace" color={tabColor('Marketplace')} onPress={() => setTab('Marketplace')}
              icon={<IconStore c={tabColor('Marketplace')} />} />
          </View>

          <Pressable onPress={() => {}} style={s.fabWrap}>
            <LinearGradient colors={['#ff3d7c', '#c60d52']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fab}>
              <IconReveal />
            </LinearGradient>
          </Pressable>
        </View>
        <View style={s.homeIndicatorWrap}><View style={s.homeIndicator} /></View>
      </View>
    </View>
  );
}

/* ---------------------------- sub components ---------------------------- */
function SectionHeader({ title, style }) {
  return (
    <View style={[s.sectionHeader, style]}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={s.seeAll}>See All</Text>
        <IconChevron size={11} color="rgba(255,255,255,0.6)" w={2} />
      </Pressable>
    </View>
  );
}

function CollectionCard({ image, scrim, bg, kicker, title, meta, ring }) {
  return (
    <View style={s.collCard}>
      <LinearGradient colors={bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Image source={image} style={s.collImg} resizeMode="cover" />
      {/* Opaque up to 42% (left of the 52%-106% photo box), fully clear by 52% so the whole
          photo shows with no tint over it, instead of fading gradually across its own width. */}
      <LinearGradient
        colors={[scrim[0], scrim[0], 'transparent']}
        locations={[0, 0.42, 0.52]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={{ padding: 11 }}>
        {kicker}
        <Text style={s.collTitle}>{title}</Text>
        <Text style={s.collMeta}>{meta}</Text>
      </View>
      <View style={[s.collArrow, { borderColor: ring }]}><IconChevron size={10} w={2} /></View>
    </View>
  );
}

function NavItem({ label, icon, color, onPress, bold }) {
  return (
    <Pressable style={s.navItem} onPress={onPress}>
      {icon}
      <Text style={[s.navLabel, { color, fontWeight: bold ? '700' : '600' }]}>{label}</Text>
    </Pressable>
  );
}

/* -------------------------------- styles -------------------------------- */
const SERIF = Platform.select({ ios: 'PlayfairDisplay-SemiBold', android: 'PlayfairDisplay-SemiBold', default: 'serif' });
const SANS = Platform.select({ ios: 'Manrope-Bold', android: 'Manrope-Bold', default: 'sans-serif' });

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08040d' },

  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 6 },
  statusTime: { color: '#fff', fontSize: 16, fontWeight: '700' },
  battery: { width: 25, height: 12, borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.55)', borderRadius: 3.5, padding: 1.4 },
  batteryFill: { flex: 1, backgroundColor: '#fff', borderRadius: 1.5 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  logoMark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  logoDiamond: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderWidth: 1.4, borderColor: '#8d6b25', borderRadius: 6, transform: [{ rotate: '45deg' }] },
  logoRing: { position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderWidth: 1, borderColor: 'rgba(212,175,55,0.55)', borderRadius: 22 },
  logoG: { fontFamily: SERIF, fontSize: 20, color: GOLD },
  wordmark: { fontFamily: SERIF, fontSize: 21, letterSpacing: 1.1, color: '#eccf8c' },
  tagline: { fontSize: 7.5, letterSpacing: 2.6, color: 'rgba(255,255,255,0.42)', fontWeight: '600', marginTop: 3 },

  balancePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 10, padding: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.04)' },
  balanceText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  plusBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

  hero: { marginHorizontal: 16, height: 282, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(196,140,60,0.5)', overflow: 'hidden', backgroundColor: '#150a12' },
  heroCardWrap: { position: 'absolute', left: '62%', top: 10, width: '32%', height: 148, borderRadius: 10, overflow: 'hidden', transform: [{ rotate: '6deg' }], shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  heroContent: { ...StyleSheet.absoluteFillObject, padding: 14, paddingHorizontal: 16 },

  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: PINK },
  liveLabel: { color: '#fff', fontSize: 11.5, fontWeight: '800', letterSpacing: 2.2 },
  eyebrow: { fontSize: 9.5, fontWeight: '700', letterSpacing: 2.6, color: 'rgba(255,255,255,0.55)', marginTop: 13 },
  heroTitle: { fontFamily: SERIF, fontSize: 36, lineHeight: 37, color: '#fbe6ea', letterSpacing: 0.5, marginTop: 5 },
  heroSub: { fontSize: 10.5, fontWeight: '700', letterSpacing: 2.2, color: 'rgba(255,255,255,0.72)', marginTop: 11 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '600' },
  metaSmall: { fontSize: 9.5, letterSpacing: 1.2 },
  metaDivider: { width: 1, height: 13, backgroundColor: 'rgba(255,255,255,0.2)' },

  dots: { flexDirection: 'row', gap: 5, alignSelf: 'center', marginTop: 'auto', marginBottom: 0, paddingRight: 60 },
  dot: { width: 14, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)' },
  dotActive: { width: 20, backgroundColor: '#fff' },

  heroFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 16 },
  cta: { height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#d80f57', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.9 },
  endsIn: { fontSize: 9.5, fontWeight: '700', letterSpacing: 2, color: 'rgba(255,255,255,0.72)' },
  clock: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 5 },
  clockNum: { color: '#fff', fontSize: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  clockUnit: { fontSize: 8, letterSpacing: 1.4, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  colon: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  sectionTitle: { color: '#fff', fontSize: 13.5, fontWeight: '800', letterSpacing: 2.6 },
  seeAll: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5 },

  collRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  collCard: { flex: 1, height: 135, borderRadius: 12, overflow: 'hidden' },
  collImg: { position: 'absolute', right: -6, top: 0, bottom: 0, width: '48%' },
  collKicker: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.4 },
  collTitle: { fontFamily: SERIF, fontSize: 19, lineHeight: 21, color: '#fff', marginTop: 5 },
  collMeta: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.78)', marginTop: 6 },
  collArrow: { position: 'absolute', left: 12, bottom: 10, width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingBottom: 12 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2fd66a' },
  liveText: { color: 'rgba(255,255,255,0.66)', fontSize: 12.5 },

  pullRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  pullCard: { flex: 1, borderRadius: 10, borderWidth: 1, overflow: 'hidden', backgroundColor: '#120a1c' },
  pullImgWrap: { height: 118 },
  tierBadge: { position: 'absolute', bottom: 8, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 5 },
  tierText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2 },
  pullAvatar: { width: 16, height: 16, borderRadius: 8 },
  pullHandle: { flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.82)' },
  pullFooter: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 },
  pullAgo: { fontSize: 10, color: 'rgba(255,255,255,0.45)' },
  pullPrice: { fontSize: 12.5, fontWeight: '800' },

  navWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  navFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  navBar: { marginHorizontal: 12, height: 74, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(18,9,30,0.94)' },
  navPill: { position: 'absolute', top: -1, height: 2, width: 64, borderRadius: 2, backgroundColor: PINK, shadowColor: PINK, shadowOpacity: 0.9, shadowRadius: 8, elevation: 4 },
  navItems: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 12 },
  navItem: { flex: 1, alignItems: 'center', gap: 5 },
  navLabel: { fontSize: 11.5 },
  fabWrap: { position: 'absolute', left: '50%', marginLeft: -37, top: -36, width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: '#0c0518', overflow: 'hidden' },
  fab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  homeIndicatorWrap: { backgroundColor: '#0c0518', paddingTop: 10, paddingBottom: 9, alignItems: 'center' },
  homeIndicator: { width: 134, height: 5, borderRadius: 3, backgroundColor: '#fff' },
});
