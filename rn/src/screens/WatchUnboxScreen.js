import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS,
  interpolate, Extrapolation, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Screen from '../components/Screen';
import { soft, give } from '../lib/haptics';
import { accent, ink, timing } from '../theme';

const { width: W } = Dimensions.get('window');

const LID_TRAVEL = 260;
const LID_COMMIT = 0.62;
const RESIST_FROM = 0.85;   // last 15 percent needs 40 percent more distance

// The tonal opposite of the card rip. No overshoot anywhere, one beam,
// dead air on the velvet, and exactly one glint.
const EASE = Easing.bezier(0.22, 0.61, 0.36, 1);

export default function WatchUnboxScreen({ onDone }) {
  const [stage, setStage] = React.useState(0); // 0 closed 1 velvet 2 rising 3 rest
  const lid = useSharedValue(0);

  const commit = () => {
    soft();
    setStage(1);
    // 1.1s of nothing but the interior. Deliberate.
    setTimeout(() => setStage(2), timing.watchBeat);
    setTimeout(() => { setStage(3); give(); }, timing.watchBeat + timing.watchRise);
  };

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      const raw = -e.translationY / LID_TRAVEL;
      // Resistance near the top of the hinge travel.
      const t = raw < RESIST_FROM ? raw : RESIST_FROM + (raw - RESIST_FROM) * 0.6;
      lid.value = Math.max(0, Math.min(1, t));
    })
    .onEnd((e) => {
      if (lid.value > LID_COMMIT || -e.velocityY > 700) {
        lid.value = withTiming(1, { duration: 1100, easing: EASE });
        runOnJS(commit)();
      } else {
        // Falls closed under gravity, not a spring.
        lid.value = withTiming(0, { duration: 620, easing: Easing.in(Easing.quad) });
      }
    })
    .enabled(stage === 0);

  const lidStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateX: interpolate(lid.value, [0, 1], [0, -104], Extrapolation.CLAMP) + 'deg' },
    ],
  }));

  const beamStyle = useAnimatedStyle(() => ({
    opacity: withTiming(stage >= 2 ? 0.46 : 0.08 + lid.value * 0.2, { duration: 1400, easing: EASE }),
  }));

  const watchStyle = useAnimatedStyle(() => ({
    opacity: withTiming(stage >= 1 ? 1 : lid.value * 0.5, { duration: 1200 }),
    transform: [
      { translateY: withTiming(stage >= 2 ? -34 : 4, { duration: timing.watchRise, easing: EASE }) },
    ],
  }));

  const glintStyle = useAnimatedStyle(() => ({
    opacity: withTiming(stage >= 3 ? 0.9 : 0, { duration: 500 }),
  }));

  const caseStyle = useAnimatedStyle(() => ({
    opacity: withTiming(stage >= 3 ? 1 : 0, { duration: 1400, easing: EASE }),
  }));

  const label = stage === 0 ? 'LIFT THE LID'
    : stage === 1 ? 'VELVET'
    : stage === 2 ? 'RISING'
    : 'TAP TO CLOSE';

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.beam, beamStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(255,238,206,0.5)', 'rgba(255,238,206,0)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.head}>
        <Text style={styles.stage}>{'WATCHES - ' + label}</Text>
        <View style={styles.steps}>
          {[0, 1, 2, 3].map((k) => (
            <View
              key={k}
              style={[
                styles.step,
                { width: k === stage ? 26 : 8 },
                { backgroundColor: k <= stage ? '#F2C46B' : 'rgba(255,255,255,0.14)' },
              ]}
            />
          ))}
        </View>
      </View>

      <GestureDetector gesture={gesture}>
        <View style={styles.stageArea}>
          <View style={styles.box}>
            {/* The watch, rising out of the case. */}
            <Animated.View style={[styles.watch, watchStyle]}>
              <LinearGradient
                colors={['#F2ECE0', '#8E8677', '#FFFAF0', '#7D7669']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={styles.dial}
              />
              <Animated.View style={[styles.glint, glintStyle]} />
              <View style={styles.strap} />
            </Animated.View>

            {/* Case shell and velvet pillow. */}
            <View style={styles.shell}>
              <View style={styles.velvet} />
            </View>

            {/* Hinged lid. */}
            <Animated.View style={[styles.lid, lidStyle]}>
              <LinearGradient colors={['#4A3826', '#241B11']} style={StyleSheet.absoluteFill} />
              <View style={styles.lidMark} />
            </Animated.View>

            <View style={styles.contact} />
          </View>
        </View>
      </GestureDetector>

      <View style={styles.footer}>
        <Animated.View style={caseStyle}>
          <Text style={styles.name}>Submariner Date</Text>
          <Text style={styles.ref}>REF. 126610LN - GRAIL</Text>
          <Text style={styles.price}>$11,400</Text>
        </Animated.View>
        <Text style={styles.hint}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050403' },
  beam: {
    position: 'absolute', left: W / 2 - 150, top: -60, width: 300, height: 640,
  },
  head: {
    paddingTop: 56, paddingHorizontal: 26,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  stage: { fontSize: 10, fontWeight: '600', letterSpacing: 3.4, color: 'rgba(242,240,236,0.62)' },
  steps: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  step: { height: 3, borderRadius: 2 },
  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  box: { width: 230, height: 230, alignItems: 'center', justifyContent: 'flex-end' },
  watch: { position: 'absolute', top: 46, width: 68, alignItems: 'center' },
  dial: { width: 68, height: 68, borderRadius: 34 },
  glint: {
    position: 'absolute', left: 14, top: 12, width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  strap: {
    width: 22, height: 30, borderRadius: 3, marginTop: -3,
    backgroundColor: 'rgba(150,144,132,0.6)',
  },
  shell: {
    position: 'absolute', bottom: 38, width: 168, height: 74, borderRadius: 3,
    backgroundColor: '#221A10', borderTopWidth: 1, borderTopColor: 'rgba(242,196,107,0.18)',
    padding: 10,
  },
  velvet: { flex: 1, borderRadius: 2, backgroundColor: '#4E161C' },
  lid: {
    position: 'absolute', bottom: 112, width: 168, height: 52,
    borderTopLeftRadius: 3, borderTopRightRadius: 3, overflow: 'hidden',
    borderBottomWidth: 1, borderBottomColor: 'rgba(242,196,107,0.14)',
  },
  lidMark: {
    position: 'absolute', left: 73, top: 20, width: 22, height: 14,
    borderRadius: 3, backgroundColor: 'rgba(242,196,107,0.4)',
  },
  contact: {
    position: 'absolute', bottom: 26, width: 192, height: 16, borderRadius: 96,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  footer: { paddingHorizontal: 26, paddingBottom: 42, gap: 18, alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '400', color: '#F6F3EC', textAlign: 'center' },
  ref: {
    fontSize: 11, fontWeight: '500', letterSpacing: 2.2,
    color: 'rgba(242,196,107,0.75)', marginTop: 7, textAlign: 'center',
  },
  price: { fontSize: 26, fontWeight: '600', color: '#fff', marginTop: 12, textAlign: 'center' },
  hint: { fontSize: 11, fontWeight: '600', letterSpacing: 3.3, color: 'rgba(242,240,236,0.62)' },
});
