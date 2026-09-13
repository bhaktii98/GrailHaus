import React from 'react';
import { View, Text, Pressable, StyleSheet, Image, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, withTiming, withRepeat, Easing, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import Screen from '../components/Screen';
import RayBurst from '../components/RayBurst';
import PackFace from '../components/PackFace';
import GameButton from '../components/GameButton';
import Dots from '../components/Dots';
import { accent, ink, spring } from '../theme';

const { width: W } = Dimensions.get('window');

// Three pages, each answering one question a new user actually has:
// what is this, what does opening feel like, can I trust it.
const PAGES = [
  {
    eyebrow: 'WHAT THIS IS',
    title: 'Buy a sealed pack.\nSee what you got.',
    body: 'GrailHaus sells mystery packs of trading cards and fine watches. You pay a fixed price, you open it, and whatever is inside is yours - sometimes worth less than you paid, sometimes worth far more.',
    acc: accent.cards, tilt: -7,
    art: ['#FFB3F0', '#C64BFF', '#6420C8', '#2E0B63'],
    beats: [
      ['1', 'Pick a pack', 'Cards from $10, watch boxes from $500.'],
      ['2', 'Rip it open', 'Tear the foil or lift the lid yourself.'],
      ['3', 'Keep or sell', 'It lands in your portfolio at its appraised value.'],
    ],
  },
  {
    eyebrow: 'THE OPENING',
    title: 'The moment is\nthe whole point.',
    body: 'Nothing opens on a tap. You tear the foil with your thumb and pull each card out one at a time. Watch boxes are slower and darker on purpose - a Rolex should not open like a booster pack.',
    acc: accent.warn, tilt: 5,
    art: ['#FFD9B8', '#FF7A2F', '#C42410', '#4A0C04'],
    beats: [
      ['-', 'Cards are fast', 'Swipe to tear, swipe through five cards, 11 seconds.'],
      ['-', 'Watches are slow', 'Lift the lid, velvet, then one glint. 20 seconds.'],
      ['-', 'Rare pulls wait', 'A chase card holds the screen. You cannot rush it.'],
    ],
  },
  {
    eyebrow: 'THE RULES',
    title: 'Odds published.\nNothing rigged.',
    body: 'Every rarity chance is printed before you buy, and contents are decided on our server the instant you pay - not while the animation plays. Close the app mid-rip and the result is unchanged.',
    acc: accent.ok, tilt: -4,
    art: ['#DCFFD4', '#63E85C', '#12864A', '#04381F'],
    beats: [
      ['+', 'Paper money only', 'Balances are simulated. No real funds move.'],
      ['+', 'Verifiable pulls', 'We commit a seed hash at purchase, reveal it after.'],
      ['+', 'Real resale', 'Sell to other collectors at your price, 6% fee.'],
    ],
  },
];

export default function OnboardingScreen({ onDone }) {
  const [i, setI] = React.useState(0);
  const p = PAGES[i];
  const last = i === PAGES.length - 1;

  const next = () => (last ? onDone && onDone() : setI(i + 1));

  return (
    <Screen glow={p.acc.glow} intensity={0.3}>
      <RayBurst size={W * 2.2} tint={['#ffffff', '#ffffff']} spin={120} count={16} opacity={0.5} />

      <View style={styles.head}>
        <View style={styles.brand}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} />
          <Text style={styles.brandText}>GRAILHAUS</Text>
        </View>
        <Text style={styles.count}>
          {'0' + (i + 1)}<Text style={styles.countSoft}>{' / 0' + PAGES.length}</Text>
        </Text>
      </View>

      <View style={styles.hero}>
        <Tilted tilt={p.tilt} key={i}>
          <PackFace art={p.art} width={178} height={246} radius={20} crimp>
            <View style={styles.packMark}>
              <Image source={require('../../assets/logo.png')} style={{ width: 62, height: 62, opacity: 0.9 }} />
            </View>
          </PackFace>
        </Tilted>
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>{p.eyebrow}</Text>
        <Text style={styles.title}>{p.title}</Text>
        <Text style={styles.para}>{p.body}</Text>

        <View style={[styles.rule, { backgroundColor: 'rgba(' + p.acc.glow + ',0.5)' }]} />

        <View style={{ gap: 12 }}>
          {p.beats.map(([k, t, d]) => (
            <View key={t} style={styles.beat}>
              <View style={[styles.key, { backgroundColor: 'rgba(' + p.acc.glow + ',0.18)' }]}>
                <Text style={[styles.keyText, { color: p.acc.c1 }]}>{k}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.beatTitle}>{t}</Text>
                <Text style={styles.beatBody}>{d}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.dotRow}>
          <Dots count={PAGES.length} index={i} onPick={setI} />
          {!last ? (
            <Pressable onPress={onDone}><Text style={styles.skip}>Skip</Text></Pressable>
          ) : null}
        </View>

        <GameButton
          label={last ? 'GET STARTED' : 'NEXT'}
          accent={p.acc}
          onPress={next}
          style={{ marginTop: 16 }}
        />
      </View>
    </Screen>
  );
}

// Page changes remount this, so the pack settles in on a spring each time.
function Tilted({ tilt, children }) {
  const t = useSharedValue(0);
  React.useEffect(() => { t.value = withSpring(1, spring.cards); }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: tilt * t.value + 'deg' }, { scale: 0.94 + 0.06 * t.value }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  head: {
    paddingTop: 52, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: { width: 28, height: 28, borderRadius: 8 },
  brandText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  count: { fontSize: 14, fontWeight: '800', color: '#fff' },
  countSoft: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  hero: { flex: 1, minHeight: 250, alignItems: 'center', justifyContent: 'center' },
  packMark: { position: 'absolute', left: 58, top: 88 },
  body: { paddingHorizontal: 26, paddingBottom: 34 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 3, color: ink.textMeta },
  title: {
    fontSize: 33, fontWeight: '800', color: '#fff', lineHeight: 36,
    letterSpacing: -0.9, marginTop: 11,
  },
  para: { fontSize: 13.5, lineHeight: 22, color: ink.textSoft, marginTop: 11 },
  rule: { height: 1, marginVertical: 18 },
  beat: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  key: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 12, fontWeight: '800' },
  beatTitle: { fontSize: 13.5, fontWeight: '700', color: '#fff', lineHeight: 17 },
  beatBody: { fontSize: 12, lineHeight: 18, color: ink.textMeta, marginTop: 2 },
  dotRow: {
    marginTop: 24, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  skip: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
});
