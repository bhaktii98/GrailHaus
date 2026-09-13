import React from 'react';
import {
  View, Text, Pressable, StyleSheet, Image, Dimensions, StatusBar,
} from 'react-native';
import Animated, {
  useSharedValue, withRepeat, withTiming, Easing, useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs, RadialGradient, LinearGradient as SvgLinear, Stop, Rect, Polygon, G, Mask,
} from 'react-native-svg';

// GrailHaus title screen, self-contained.
//
//   expo install react-native-reanimated react-native-svg expo-linear-gradient
//   babel.config.js -> plugins: ['react-native-reanimated/plugin']
//   put the mark at assets/logo.png
//
// Fourteen animations run at once, all transform/opacity only so everything
// stays on the compositor. Nothing waits on a tap.

const { width: W, height: H } = Dimensions.get('window');

// Ten cards at four depths. Near ones large and bright, far ones small and
// dim, every duration prime-ish so nothing ever falls into phase.
const DRIFT = [
  { x: 0.06, y: 0.09, w: 62, rot: -13, op: 0.26, dur: 7500, delay: 0,
    art: ['#DCE8FF', '#6C8BF5', '#2B2F86'] },
  { x: 0.33, y: 0.04, w: 70, rot: 8, op: 0.32, dur: 9000, delay: 1200,
    art: ['#FFB3F0', '#C64BFF', '#6420C8', '#2E0B63'] },
  { x: 0.62, y: 0.11, w: 58, rot: 15, op: 0.22, dur: 8200, delay: 3000,
    art: ['#D6F5B4', '#6FB758', '#2C5A2A'] },
  { x: 0.84, y: 0.05, w: 66, rot: -9, op: 0.28, dur: 10000, delay: 2000,
    art: ['#FFF3D6', '#D8B26A', '#6B4E1E', '#1A1206'] },
  { x: 0.02, y: 0.30, w: 84, rot: -18, op: 0.50, dur: 8600, delay: 600,
    art: ['#C9DCE8', '#6C8AA3', '#33455C'] },
  { x: 0.78, y: 0.27, w: 92, rot: 14, op: 0.55, dur: 9400, delay: 4000,
    art: ['#FFF6D8', '#FFC94A', '#E0761A', '#7A2C06'] },
  { x: 0.04, y: 0.62, w: 74, rot: 11, op: 0.30, dur: 9800, delay: 2600,
    art: ['#F2CDA8', '#B87A4E', '#5E3722'] },
  { x: 0.70, y: 0.66, w: 96, rot: -12, op: 0.60, dur: 8000, delay: 5000,
    art: ['#DCE8FF', '#6C8BF5', '#2B2F86'] },
  { x: 0.30, y: 0.74, w: 66, rot: 17, op: 0.26, dur: 10400, delay: 1800,
    art: ['#E4FBFF', '#59D8FF', '#1668D8', '#062E68'] },
  { x: 0.52, y: 0.84, w: 56, rot: -7, op: 0.20, dur: 7800, delay: 3600,
    art: ['#2A2340', '#171126'] },
];

const SPECKS = [
  { x: 0.17, y: 0.15, s: 4, op: 0.7, dur: 3200, delay: 0 },
  { x: 0.88, y: 0.19, s: 3, op: 0.5, dur: 4000, delay: 1000 },
  { x: 0.09, y: 0.48, s: 3, op: 0.6, dur: 3600, delay: 2000 },
  { x: 0.93, y: 0.52, s: 4, op: 0.45, dur: 4400, delay: 700 },
  { x: 0.24, y: 0.90, s: 3, op: 0.55, dur: 3800, delay: 2600 },
  { x: 0.66, y: 0.94, s: 4, op: 0.40, dur: 4200, delay: 1400 },
];

export default function TitleScreen({ onStart }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Ground: violet core falling to near-black. */}
      <LinearGradient
        colors={['#3A1470', '#1C0938', '#0A0416', '#04010A']}
        locations={[0, 0.34, 0.68, 1]}
        style={StyleSheet.absoluteFill}
      />

      <RayBurst />

      {/* Warm bloom right under the mark. */}
      <View style={styles.bloom} pointerEvents="none">
        <Svg width={520} height={520}>
          <Defs>
            <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFD078" stopOpacity="0.28" />
              <Stop offset="0.42" stopColor="#A050FF" stopOpacity="0.16" />
              <Stop offset="0.7" stopColor="#A050FF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width={520} height={520} fill="url(#bloom)" />
        </Svg>
      </View>

      {DRIFT.map((d, i) => <Drifter key={i} d={d} />)}
      {SPECKS.map((s, i) => <Speck key={i} s={s} />)}

      <View style={styles.head}>
        <View>
          <Text style={styles.meta}>Ver. 1.0.4</Text>
          <Text style={styles.meta}>Support ID: 7fq2Ka9Rn4</Text>
        </View>
        <Pressable style={styles.menu} hitSlop={8}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </Pressable>
      </View>

      <Pressable style={styles.center} onPress={onStart}>
        <Breathe>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Breathe>

        <Text style={styles.wordmark}>GRAILHAUS</Text>

        <LinearGradient
          colors={['#FFD678', '#C48A2A']}
          style={styles.plate}
        >
          <Text style={styles.plateText}>SEALED PACKS</Text>
        </LinearGradient>
      </Pressable>

      <Pulse>
        <Text style={styles.start}>TAP TO START</Text>
      </Pulse>

      <View style={styles.foot}>
        <View style={styles.footMark}>
          <Svg width={22} height={22} viewBox="0 0 48 48">
            <Polygon
              points="24,9 37,16.5 37,31.5 24,39 11,31.5 11,16.5"
              fill="none" stroke="#2A1440" strokeWidth={3} strokeLinejoin="round"
            />
            <Polygon
              points="24,17.5 30.5,21.2 30.5,27.8 24,31.5 17.5,27.8 17.5,21.2"
              fill="#2A1440"
            />
          </Svg>
        </View>
        <View>
          <Text style={styles.footText}>(c) GrailHaus - paper USD only</Text>
          <Text style={styles.footText}>No real money moves</Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Rays. CSS conic-gradient does not exist in RN, so each ray is a triangle on
// one rotating group, radially masked so they fade before the screen edge.
// 22 polygons in a single Svg — one node to animate, not 22.
// ---------------------------------------------------------------------------
function RayBurst() {
  const SIZE = W * 2.6;
  const COUNT = 22;
  const rot = useSharedValue(0);

  React.useEffect(() => {
    rot.value = withRepeat(
      withTiming(360, { duration: 90000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: rot.value + 'deg' }],
  }));

  const half = SIZE / 2;
  const rad = (deg) => (deg * Math.PI) / 180;
  const rays = [];

  for (let i = 0; i < COUNT; i++) {
    const a = (360 / COUNT) * i;
    const w = i % 2 === 0 ? 3.2 : 2.0;              // alternating ray width
    const tip = half + ',' + half;
    const l = (half + half * Math.cos(rad(a - w))) + ',' +
              (half + half * Math.sin(rad(a - w)));
    const r = (half + half * Math.cos(rad(a + w))) + ',' +
              (half + half * Math.sin(rad(a + w)));
    rays.push(
      <Polygon
        key={i}
        points={tip + ' ' + l + ' ' + r}
        fill={i % 2 === 0 ? '#C878FF' : '#FFC45A'}   // violet, then gold
        fillOpacity={i % 2 === 0 ? 0.34 : 0.20}
      />
    );
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.rayWrap, style]}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <RadialGradient id="rayFade" cx="50%" cy="50%" r="50%">
            <Stop offset="0.08" stopColor="#fff" stopOpacity="0" />
            <Stop offset="0.28" stopColor="#fff" stopOpacity="1" />
            <Stop offset="0.58" stopColor="#fff" stopOpacity="1" />
            <Stop offset="0.82" stopColor="#fff" stopOpacity="0" />
          </RadialGradient>
          <Mask id="rayMask">
            <Rect width={SIZE} height={SIZE} fill="url(#rayFade)" />
          </Mask>
        </Defs>
        <G mask="url(#rayMask)">{rays}</G>
      </Svg>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// A drifting card. Rotation is baked into the same transform array as the
// float so the two never fight — reanimated replaces the whole array.
// ---------------------------------------------------------------------------
function Drifter({ d }) {
  const t = useSharedValue(0);

  React.useEffect(() => {
    const id = setTimeout(() => {
      t.value = withRepeat(
        withTiming(1, { duration: d.dur, easing: Easing.inOut(Easing.sin) }),
        -1,
        true      // reverse, so it drifts up and back down
      );
    }, d.delay);
    return () => clearTimeout(id);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -22 * t.value },
      { rotate: d.rot + 'deg' },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.drifter,
        { left: W * d.x, top: H * d.y, opacity: d.op },
        style,
      ]}
    >
      <CardFace art={d.art} width={d.w} height={Math.round(d.w * 1.4)} />
    </Animated.View>
  );
}

// A card back: radial artwork, specular sheen, crimped foil head.
function CardFace({ art, width, height }) {
  const offs = art.length === 4 ? [0, 0.34, 0.72, 1]
    : art.length === 3 ? [0, 0.48, 1]
    : [0, 1];

  return (
    <View style={[styles.card, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="cf" cx="50%" cy="40%" rx="60%" ry="44%">
            {art.map((c, i) => (
              <Stop key={i} offset={offs[i]} stopColor={c} stopOpacity="1" />
            ))}
          </RadialGradient>
          <SvgLinear id="cs" x1="0" y1="0" x2="1" y2="0.55">
            <Stop offset="0.32" stopColor="#fff" stopOpacity="0" />
            <Stop offset="0.46" stopColor="#fff" stopOpacity="0.36" />
            <Stop offset="0.60" stopColor="#fff" stopOpacity="0" />
          </SvgLinear>
        </Defs>
        <Rect width={width} height={height} rx={7} fill="url(#cf)" />
        <Rect width={width} height={height} rx={7} fill="url(#cs)" />
      </Svg>
      <View style={[styles.crimp, { height: Math.round(height * 0.15) }]} />
    </View>
  );
}

function Speck({ s }) {
  const t = useSharedValue(0.15);

  React.useEffect(() => {
    const id = setTimeout(() => {
      t.value = withRepeat(
        withTiming(1, { duration: s.dur, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
    }, s.delay);
    return () => clearTimeout(id);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: t.value * s.op,
    transform: [{ scale: 0.7 + 0.6 * t.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.speck,
        { left: W * s.x, top: H * s.y, width: s.s, height: s.s, borderRadius: s.s },
        style,
      ]}
    />
  );
}

// The mark breathes 3.5% on a 5s cycle.
function Breathe({ children }) {
  const s = useSharedValue(1);
  React.useEffect(() => {
    s.value = withRepeat(
      withTiming(1.035, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function Pulse({ children }) {
  const o = useSharedValue(0.45);
  React.useEffect(() => {
    o.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.startWrap, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04010A' },

  rayWrap: {
    position: 'absolute',
    left: W / 2 - W * 1.3,
    top: H * 0.46 - W * 1.3,
  },
  bloom: {
    position: 'absolute',
    left: W / 2 - 260,
    top: H * 0.46 - 260,
  },

  drifter: { position: 'absolute' },
  card: {
    overflow: 'hidden',
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.34)',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  crimp: {
    position: 'absolute', left: 0, right: 0, top: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.4)',
    borderStyle: 'dashed',
  },
  speck: {
    position: 'absolute',
    backgroundColor: '#FFE9B8',
    shadowColor: '#FFE096',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },

  head: {
    paddingTop: 52, paddingHorizontal: 22,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  meta: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  menu: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 9,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  menuLine: { width: 20, height: 2.4, borderRadius: 2, backgroundColor: '#2A1440' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  logo: {
    width: 236, height: 236,
    shadowColor: '#FFC45A', shadowOpacity: 0.4, shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
  },
  wordmark: {
    fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: 0.4,
    textShadowColor: 'rgba(255,200,100,0.55)',
    textShadowRadius: 32,
    textShadowOffset: { width: 0, height: 3 },
  },
  plate: {
    paddingHorizontal: 18, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1.5, borderColor: 'rgba(255,240,200,0.7)',
  },
  plateText: { fontSize: 12, fontWeight: '800', letterSpacing: 2.9, color: '#2A1706' },

  startWrap: { alignItems: 'center', paddingBottom: 20 },
  start: {
    fontSize: 22, fontWeight: '700', letterSpacing: 2.2,
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(255,214,140,0.7)', textShadowRadius: 24,
  },

  foot: {
    paddingHorizontal: 22, paddingBottom: 26,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  footMark: {
    width: 40, height: 40, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  footText: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.62)', marginTop: 2 },
});
