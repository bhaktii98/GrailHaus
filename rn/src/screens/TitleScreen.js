import React from 'react';
import { View, Text, Pressable, StyleSheet, Image, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, withRepeat, withTiming, withSequence, Easing, useAnimatedStyle,
} from 'react-native-reanimated';
import Screen from '../components/Screen';
import RayBurst from '../components/RayBurst';
import PackFace from '../components/PackFace';
import { accent, ink } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

// Ten cards at different depths, speeds and phases. Near ones large and
// bright, far ones small and dim.
const DRIFT = [
  { x: 0.06, y: 0.09, w: 62, rot: -13, op: 0.26, dur: 7500, art: ['#DCE8FF', '#6C8BF5', '#2B2F86'] },
  { x: 0.33, y: 0.04, w: 70, rot: 8, op: 0.32, dur: 9000, art: ['#FFB3F0', '#C64BFF', '#6420C8', '#2E0B63'] },
  { x: 0.62, y: 0.11, w: 58, rot: 15, op: 0.22, dur: 8200, art: ['#D6F5B4', '#6FB758', '#2C5A2A'] },
  { x: 0.84, y: 0.05, w: 66, rot: -9, op: 0.28, dur: 10000, art: ['#FFF3D6', '#D8B26A', '#6B4E1E', '#1A1206'] },
  { x: 0.02, y: 0.30, w: 84, rot: -18, op: 0.5, dur: 8600, art: ['#C9DCE8', '#6C8AA3', '#33455C'] },
  { x: 0.78, y: 0.27, w: 92, rot: 14, op: 0.55, dur: 9400, art: ['#FFF6D8', '#FFC94A', '#E0761A', '#7A2C06'] },
  { x: 0.04, y: 0.62, w: 74, rot: 11, op: 0.3, dur: 9800, art: ['#F2CDA8', '#B87A4E', '#5E3722'] },
  { x: 0.70, y: 0.66, w: 96, rot: -12, op: 0.6, dur: 8000, art: ['#DCE8FF', '#6C8BF5', '#2B2F86'] },
  { x: 0.30, y: 0.74, w: 66, rot: 17, op: 0.26, dur: 10400, art: ['#E4FBFF', '#59D8FF', '#1668D8', '#062E68'] },
  { x: 0.52, y: 0.84, w: 56, rot: -7, op: 0.2, dur: 7800, art: ['#2A2340', '#171126'] },
];

export default function TitleScreen({ onStart }) {
  return (
    <Screen glow="58,20,112" intensity={0.5}>
      <RayBurst size={W * 2.6} tint={['#C878FF', '#FFC45A']} spin={90} count={22} />

      {DRIFT.map((d, i) => <Drifter key={i} d={d} />)}

      <View style={styles.head}>
        <View>
          <Text style={styles.meta}>Ver. 1.0.4</Text>
          <Text style={styles.meta}>Support ID: 7fq2Ka9Rn4</Text>
        </View>
        <Pressable style={styles.menu}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
      </View>

      <Pressable style={styles.center} onPress={onStart}>
        <Breather>
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 236, height: 236 }}
            resizeMode="contain"
          />
        </Breather>
        <Text style={styles.wordmark}>GRAILHAUS</Text>
        <View style={styles.plate}>
          <Text style={styles.plateText}>SEALED PACKS</Text>
        </View>
      </Pressable>

      <Pulse>
        <Text style={styles.start}>TAP TO START</Text>
      </Pulse>

      <View style={styles.foot}>
        <Text style={styles.footText}>(c) GrailHaus - paper USD only</Text>
        <Text style={styles.footText}>No real money moves</Text>
      </View>
    </Screen>
  );
}

function Drifter({ d }) {
  const t = useSharedValue(0);
  React.useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: d.dur, easing: Easing.inOut(Easing.sin) }),
      -1, true
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -22 * t.value }, { rotate: d.rot + 'deg' }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: W * d.x, top: H * d.y, opacity: d.op }, style]}
    >
      <PackFace art={d.art} width={d.w} height={Math.round(d.w * 1.4)} radius={7} crimp />
    </Animated.View>
  );
}

function Breather({ children }) {
  const s = useSharedValue(1);
  React.useEffect(() => {
    s.value = withRepeat(withTiming(1.035, { duration: 2500, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function Pulse({ children }) {
  const o = useSharedValue(0.45);
  React.useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.startWrap, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  head: {
    paddingTop: 52, paddingHorizontal: 22,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  meta: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  menu: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  menuLine: { width: 20, height: 2.4, borderRadius: 2, backgroundColor: '#2A1440' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  wordmark: {
    fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: 0.4,
    textShadowColor: 'rgba(255,200,100,0.55)', textShadowRadius: 32,
    textShadowOffset: { width: 0, height: 3 },
  },
  plate: {
    paddingHorizontal: 18, paddingVertical: 6, borderRadius: 999,
    backgroundColor: 'rgba(255,214,120,0.95)',
    borderWidth: 1.5, borderColor: 'rgba(255,240,200,0.7)',
  },
  plateText: { fontSize: 12, fontWeight: '800', letterSpacing: 2.9, color: '#2A1706' },
  startWrap: { alignItems: 'center', paddingBottom: 20 },
  start: {
    fontSize: 22, fontWeight: '700', letterSpacing: 2.2, color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(255,214,140,0.7)', textShadowRadius: 24,
  },
  foot: { paddingHorizontal: 22, paddingBottom: 26 },
  footText: { fontSize: 11, fontWeight: '500', color: ink.textMeta, marginTop: 2 },
});
