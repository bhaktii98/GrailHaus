import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated';
import Screen from '../components/Screen';
import RayBurst from '../components/RayBurst';
import PackFace from '../components/PackFace';
import { PULL } from '../data/packs';
import { fmt } from '../lib/money';
import { tap, give, chase, ladder } from '../lib/haptics';
import { accent, ink, spring } from '../theme';

const { width: W } = Dimensions.get('window');

const TEAR_TRAVEL = 190;   // px of drag that equals a full tear
const TEAR_COMMIT = 0.5;   // release past this and it completes
const FLICK_V = 800;       // px/s that completes at any travel
const SWIPE_X = -85;       // px to throw a card off
const SWIPE_V = 580;
const GATE_MS = 1500;      // the chase card holds the screen this long

export default function CardRipScreen({ onDone }) {
  const [idx, setIdx] = React.useState(-1);   // -1 = still sealed
  const [gated, setGated] = React.useState(false);

  const peel = useSharedValue(0);   // 0..1 wrapper travel
  const dx = useSharedValue(0);     // current card horizontal drag

  const sealed = idx < 0;
  const card = PULL[Math.max(0, Math.min(PULL.length - 1, idx))];
  const rarity = sealed ? 0 : card.rarity;
  const isChase = rarity >= 1;

  const commitTear = () => {
    give();
    setIdx(0);
  };

  const advance = () => {
    const next = idx + 1;
    if (next >= PULL.length) { onDone && onDone(); return; }
    setIdx(next);
    if (PULL[next].rarity >= 1) {
      // The slow burn: input is absorbed, not queued, for GATE_MS.
      setGated(true);
      ladder(7, GATE_MS);
      setTimeout(() => { setGated(false); chase(); }, GATE_MS);
    } else {
      tap();
    }
  };

  // Wrapper peel. 1:1 with the thumb, springs back under half travel.
  const tearGesture = Gesture.Pan()
    .onUpdate((e) => {
      peel.value = Math.max(0, Math.min(1, -e.translationY / TEAR_TRAVEL));
    })
    .onEnd((e) => {
      const done = peel.value > TEAR_COMMIT || -e.velocityY > FLICK_V;
      if (done) {
        peel.value = withTiming(1, { duration: 180 });
        runOnJS(commitTear)();
      } else {
        peel.value = withSpring(0, spring.cards);
      }
    })
    .enabled(sealed);

  // Card advance. Tracks the thumb, throws off past threshold or velocity.
  const swipeGesture = Gesture.Pan()
    .onUpdate((e) => { dx.value = Math.min(0, e.translationX); })
    .onEnd((e) => {
      if (dx.value < SWIPE_X || -e.velocityX > SWIPE_V) {
        dx.value = withTiming(-W, { duration: 220 }, () => { dx.value = 0; });
        runOnJS(advance)();
      } else {
        dx.value = withSpring(0, spring.cards);
      }
    })
    .enabled(!sealed && !gated);

  const gesture = sealed ? tearGesture : swipeGesture;

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(peel.value, [0, 1], [-14, -364], Extrapolation.CLAMP) }],
    opacity: sealed ? 1 : 0,
  }));

  const seamStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, peel.value * 5),
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx.value },
      { rotate: dx.value * 0.05 + 'deg' },
      { scale: withSpring(isChase ? 1.06 : 1, spring.cards) },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isChase ? 0.95 : rarity > 0.5 ? 0.4 : 0, { duration: 500 }),
  }));

  const stage = sealed
    ? (peel.value > 0 ? 'TEARING' : 'SEALED')
    : isChase ? 'CHASE PULL' : (idx + 1) + ' OF ' + PULL.length;

  const hint = sealed ? 'SWIPE UP TO TEAR'
    : gated ? 'HOLD'
    : 'SWIPE LEFT';

  return (
    <Screen glow={isChase ? accent.gold.glow : accent.cards.glow} intensity={isChase ? 0.5 : 0.22}>
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]} pointerEvents="none">
        <RayBurst
          size={W * 2.6}
          tint={isChase ? ['#FFE196', '#FFC94A'] : ['#BED2FF', '#8FA9FF']}
          spin={26}
          count={26}
        />
      </Animated.View>

      <View style={styles.head}>
        <Text style={styles.stage}>{'CARDS - ' + stage}</Text>
        <View style={styles.pips}>
          {PULL.map((_, i) => (
            <View
              key={i}
              style={[
                styles.pip,
                { width: !sealed && i === idx ? 26 : 8 },
                {
                  backgroundColor: sealed ? 'rgba(255,255,255,0.16)'
                    : i < idx ? 'rgba(255,255,255,0.5)'
                    : i === idx ? '#fff' : 'rgba(255,255,255,0.16)',
                },
              ]}
            />
          ))}
        </View>
      </View>

      <GestureDetector gesture={gesture}>
        <View style={styles.stageArea}>
          {/* Cards still in the stack, behind the top one. */}
          {!sealed && idx < PULL.length - 1 ? (
            <>
              <View style={[styles.deck, { transform: [{ translateX: 13 }, { translateY: 15 }, { rotate: '4deg' }] }]} />
              <View style={[styles.deck, { transform: [{ translateX: 6 }, { translateY: 7 }, { rotate: '2deg' }] }]} />
            </>
          ) : null}

          <Animated.View style={cardStyle}>
            <PackFace
              art={sealed ? ['#2A2438', '#151020'] : card.art}
              width={214}
              height={298}
              radius={16}
              tier={sealed ? null : card.tier}
              label={sealed ? null : card.name}
            >
              {!sealed ? (
                <View style={styles.value}>
                  <View style={styles.coin} />
                  <Text style={styles.valueText}>
                    {fmt(card.valueCents, { compact: true }).slice(1)}
                  </Text>
                </View>
              ) : null}
            </PackFace>
          </Animated.View>

          {/* The foil wrapper, riding on the thumb. */}
          <Animated.View style={[styles.wrapper, wrapperStyle]} pointerEvents="none">
            <PackFace
              art={['#FFB3F0', '#C64BFF', '#6420C8', '#2E0B63']}
              width={236}
              height={320}
              radius={18}
              crimp
            >
              <View style={styles.wrapMark}>
                <Text style={styles.wrapText}>GRAILHAUS</Text>
              </View>
              <Animated.View style={[styles.seam, seamStyle]} />
            </PackFace>
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.footer}>
        <Text style={styles.hint}>{hint}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: ((sealed ? 0 : (idx + 1) / PULL.length) * 100) + '%' }]} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingTop: 56, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  stage: { fontSize: 11, fontWeight: '800', letterSpacing: 2.9, color: ink.textMeta },
  pips: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  pip: { height: 8, borderRadius: 5 },
  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  deck: {
    position: 'absolute', width: 214, height: 298, borderRadius: 16,
    backgroundColor: '#251E36', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
  },
  wrapper: { position: 'absolute' },
  wrapMark: { position: 'absolute', left: 0, right: 0, top: 140, alignItems: 'center' },
  wrapText: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  seam: {
    position: 'absolute', left: 0, right: 0, top: 0, height: 4,
    backgroundColor: '#fff',
  },
  value: { position: 'absolute', right: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 4 },
  coin: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#FFD75E' },
  valueText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  footer: { paddingHorizontal: 26, paddingBottom: 40, gap: 16 },
  hint: { textAlign: 'center', fontSize: 13, fontWeight: '800', letterSpacing: 2.6, color: ink.textSoft },
  track: {
    height: 8, borderRadius: 5, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  fill: { height: '100%', borderRadius: 5, backgroundColor: '#fff' },
});
