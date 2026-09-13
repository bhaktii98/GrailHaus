import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaskedView from '@react-native-masked-view/masked-view';
import Ionicons from 'react-native-vector-icons/Ionicons';

/* ------------------------------------------------------------------ *
 * Deps:
 *   expo install expo-linear-gradient react-native-safe-area-context
 *   npm i @react-native-masked-view/masked-view react-native-vector-icons
 *
 * Drop the hero render at ./assets/mystery-box.png
 * ------------------------------------------------------------------ */

const GOLD = '#f6c040';
const GOLD_DEEP = '#e0a51c';
const PINK = '#ff3d71';

const AVATARS = {
  heirloom: ['#d9a43c', '#8a5f14'],
  vaultrat: ['#3f7fd8', '#1d4a95'],
  toploader: ['#3f9b5c', '#1c5c33'],
  slabbed: ['#c4666e', '#7d3138'],
  fifthgen: ['#9a9aa2', '#54545c'],
  casebound: ['#7d5334', '#3f2718'],
  you: ['#f6c040', '#b4791a'],
};

const ago = (ms) => {
  const s = Math.floor(ms / 1000);
  if (s < 3) return 'now';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
};

/* ---------- gradient text ---------- */
function GradientText({ colors, style, children }) {
  return (
    <MaskedView maskElement={<Text style={style}>{children}</Text>}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }}>
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

/* ---------- live dot ---------- */
function LiveDot() {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 0.35, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(a, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [a]);
  return <Animated.View style={[styles.liveDot, { opacity: a, transform: [{ scale: a }] }]} />;
}

export default function MidnightDropScreen({
  title = ['Black Label:', 'Midnight Drop'],
  subtitle = 'Exclusive pieces. Limited claims.\nOnce it’s gone, it’s gone.',
  price = 250,
  totalUnits = 15,
  initialRemaining = 14,
  onBack = () => {},
  onSettings = () => {},
}) {
  const t0 = useRef(Date.now()).current;
  const [now, setNow] = useState(t0);
  const [watching, setWatching] = useState(1842);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [claimed, setClaimed] = useState(false);
  const [claims, setClaims] = useState([
    { id: 1, user: '@heirloom', unit: 1, at: t0 },
    { id: 2, user: '@vaultrat', unit: 0, at: t0 - 4000 },
    { id: 3, user: '@toploader', unit: 0, at: t0 - 9000 },
    { id: 4, user: '@slabbed', unit: 0, at: t0 - 15000 },
    { id: 5, user: '@fifthgen', unit: 0, at: t0 - 22000 },
    { id: 6, user: '@casebound', unit: 0, at: t0 - 31000 },
  ]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      setWatching((w) => Math.max(1500, w + Math.round((Math.random() - 0.45) * 12)));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const press = useRef(new Animated.Value(1)).current;

  const claim = () => {
    if (remaining <= 0 || claimed) return;
    const at = Date.now();
    setClaimed(true);
    setRemaining((r) => r - 1);
    setClaims((c) =>
      [{ id: at, user: '@you', unit: totalUnits - remaining + 1, at }, ...c].slice(0, 7),
    );
  };

  const segments = useMemo(
    () => Array.from({ length: totalUnits }, (_, i) => i < remaining),
    [totalUnits, remaining],
  );

  const ctaLabel =
    remaining <= 0 ? 'SOLD OUT' : claimed ? 'CLAIMED • UNIT SECURED' : `CLAIM ONE • $${price}`;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#2a1236', '#170b23', '#0a0610']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, { left: -60, top: 120, backgroundColor: 'rgba(150,40,190,0.22)' }]} />
      <View style={[styles.blob, { right: -70, top: 200, backgroundColor: 'rgba(190,50,150,0.18)' }]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* header */}
        <View style={styles.headerRow}>
          <Pressable onPress={onBack} style={styles.circleBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.block}>
          <View style={styles.metaRow}>
            <View style={styles.liveWrap}>
              <LiveDot />
              <Text style={styles.liveText}>LIVE NOW</Text>
            </View>
            <View style={styles.watchWrap}>
              <Ionicons name="people" size={15} color="rgba(255,255,255,0.72)" />
              <Text style={styles.watchText}>{watching.toLocaleString('en-US')} watching</Text>
            </View>
          </View>

          <View style={{ marginTop: 8 }}>
            <GradientText colors={['#ffffff', '#cfc6d6']} style={styles.title}>
              {title[0]}
            </GradientText>
            <GradientText colors={[GOLD, '#ffe9a3', '#e3a520']} style={styles.title}>
              {title[1]}
            </GradientText>
          </View>

          <Text style={styles.subtitle}>{subtitle}</Text>

          <Pressable onPress={onSettings} style={styles.gearBtn} hitSlop={8}>
            <Ionicons name="settings-sharp" size={19} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>

        {/* hero */}
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Image
            source={require('./assets/mystery-box.png')}
            style={styles.heroImg}
            resizeMode="contain"
          />
        </View>

        {/* remaining */}
        <View style={styles.block}>
          <Text style={styles.kicker}>REMAINING</Text>
          <View style={styles.countRow}>
            <Text style={styles.count}>{remaining}</Text>
            <Text style={styles.countTotal}>/{totalUnits}</Text>
          </View>
          <View style={styles.segRow}>
            {segments.map((on, i) => (
              <LinearGradient
                key={i}
                colors={on ? [GOLD, GOLD_DEEP] : ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.10)']}
                style={styles.seg}
              />
            ))}
          </View>
        </View>

        {/* claims */}
        <View style={[styles.block, styles.claimsBlock]}>
          <Text style={styles.kicker}>CLAIMS</Text>
          <View style={styles.claimsCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {claims.map((c, i) => (
                <View
                  key={c.id}
                  style={[styles.claimRow, { opacity: Math.max(0.34, 1 - i * 0.13) }]}
                >
                  <LinearGradient
                    colors={AVATARS[c.user.slice(1)] || AVATARS.you}
                    style={styles.avatar}
                  />
                  <Text style={styles.claimText} numberOfLines={1}>
                    <Text style={styles.claimUser}>{c.user}</Text> claimed unit {c.unit}
                  </Text>
                  <Text style={styles.claimAgo}>{ago(now - c.at)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* cta */}
        <View style={styles.ctaBlock}>
          <Animated.View style={{ transform: [{ scale: press }] }}>
            <Pressable
              onPress={claim}
              onPressIn={() =>
                Animated.spring(press, { toValue: 0.985, useNativeDriver: true }).start()
              }
              onPressOut={() =>
                Animated.spring(press, { toValue: 1, useNativeDriver: true }).start()
              }
            >
              <LinearGradient
                colors={['#ffd863', '#f0b52c', '#e2a41e']}
                locations={[0, 0.55, 1]}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>{ctaLabel}</Text>
                <View style={styles.ctaArrow}>
                  <Ionicons name="arrow-forward" size={18} color={GOLD} />
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
          <Text style={styles.footnote}>
            If two of you tap at once, exactly one gets it. You are not charged for a loss.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c0713' },
  safe: { flex: 1 },
  blob: { position: 'absolute', width: 290, height: 330, borderRadius: 165, opacity: 0.9 },

  headerRow: { paddingHorizontal: 22, paddingTop: 12 },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  block: { paddingHorizontal: 22, paddingTop: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PINK,
    shadowColor: PINK,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  liveText: { color: PINK, fontSize: 11, fontWeight: '700', letterSpacing: 2.4 },
  watchWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  watchText: { color: 'rgba(255,255,255,0.72)', fontSize: 13 },

  title: {
    fontSize: 35,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: '#fff',
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Bitter-ExtraBold', android: 'Bitter-ExtraBold' }),
  },
  subtitle: {
    marginTop: 7,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.68)',
    maxWidth: 250,
  },
  gearBtn: {
    position: 'absolute',
    right: 22,
    top: 62,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: { height: 196, marginTop: -6, alignItems: 'center', justifyContent: 'center' },
  heroGlow: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 98,
    backgroundColor: 'rgba(246,192,64,0.16)',
  },
  heroImg: { width: '100%', height: '100%' },

  kicker: { fontSize: 10.5, fontWeight: '600', letterSpacing: 2.6, color: 'rgba(255,255,255,0.55)' },
  countRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
  count: { fontSize: 31, lineHeight: 34, fontWeight: '800', color: GOLD },
  countTotal: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: 'rgba(255,255,255,0.42)' },
  segRow: { flexDirection: 'row', gap: 4, marginTop: 9 },
  seg: { flex: 1, height: 7, borderRadius: 4 },

  claimsBlock: { flex: 1, minHeight: 0 },
  claimsCard: {
    flex: 1,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  avatar: { width: 22, height: 22, borderRadius: 11 },
  claimText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.62)' },
  claimUser: { fontWeight: '600', color: '#fff' },
  claimAgo: { fontSize: 12, color: 'rgba(255,255,255,0.42)' },

  ctaBlock: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 8 },
  cta: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  ctaText: { fontSize: 17, fontWeight: '700', letterSpacing: 0.4, color: '#1a1005' },
  ctaArrow: {
    position: 'absolute',
    right: 7,
    top: 7,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#120b04',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.55)',
  },
});
