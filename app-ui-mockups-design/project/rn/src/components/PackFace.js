import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect } from 'react-native-svg';
import { font } from '../theme';

// A pack or card face. CSS radial-gradient has no RN equivalent, so the
// artwork is an SVG RadialGradient with a specular band layered over it.
export default function PackFace(props) {
  const { art, width, height, radius, label, tier, crimp, children } = props;
  const r = radius == null ? 16 : radius;
  const stops = art || ['#FFB3F0', '#C64BFF', '#6420C8', '#2E0B63'];
  const offs = stops.length === 4 ? [0, 0.34, 0.72, 1] : [0, 0.48, 1];

  return (
    <View style={[styles.wrap, { width, height, borderRadius: r }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="face" cx="50%" cy="40%" rx="60%" ry="44%">
            {stops.map((c, i) => (
              <Stop key={i} offset={offs[i]} stopColor={c} stopOpacity="1" />
            ))}
          </RadialGradient>
          <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0.55">
            <Stop offset="0.30" stopColor="#fff" stopOpacity="0" />
            <Stop offset="0.46" stopColor="#fff" stopOpacity="0.4" />
            <Stop offset="0.60" stopColor="#fff" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="foot" x1="0" y1="0.5" x2="0" y2="1">
            <Stop offset="0" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.5" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} rx={r} fill="url(#face)" />
        <Rect width={width} height={height} rx={r} fill="url(#sheen)" />
        <Rect width={width} height={height} rx={r} fill="url(#foot)" />
      </Svg>

      {crimp ? (
        <View style={[styles.crimp, { height: Math.round(height * 0.11) }]} />
      ) : null}

      {tier ? (
        <View style={styles.tierWrap}>
          <Text style={[styles.tier, font.bold && null]}>{tier}</Text>
        </View>
      ) : null}

      {label ? <Text style={styles.label}>{label}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.34)',
    justifyContent: 'flex-end',
  },
  // The crimped foil head and its dashed tear line.
  crimp: {
    position: 'absolute', left: 0, right: 0, top: 0,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.42)',
    borderStyle: 'dashed',
  },
  tierWrap: {
    position: 'absolute', left: 12, bottom: 44,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  tier: { fontSize: 9, letterSpacing: 1.5, color: 'rgba(255,255,255,0.9)', fontWeight: '800' },
  label: {
    position: 'absolute', left: 12, right: 12, bottom: 14,
    fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 2 },
  },
});
