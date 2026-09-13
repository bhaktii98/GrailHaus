import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Polygon, G, Mask, Rect, Circle } from 'react-native-svg';
import Animated, { useSharedValue, withRepeat, withTiming, Easing, useAnimatedStyle } from 'react-native-reanimated';

// CSS conic-gradient does not exist in RN. Rays are individual polygons on a
// rotating group, radially masked so they fade before the edges.
export default function RayBurst(props) {
  const { size, tint, spin, count, opacity } = props;
  const n = count || 18;
  const rot = useSharedValue(0);

  React.useEffect(() => {
    rot.value = withRepeat(
      withTiming(360, { duration: (spin || 90) * 1000, easing: Easing.linear }),
      -1,
      false
    );
  }, [spin]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: rot.value + 'deg' }],
  }));

  const half = size / 2;
  const rays = [];
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i;
    const w = i % 2 === 0 ? 3.2 : 2.0;
    const rad = (deg) => (deg * Math.PI) / 180;
    const p1 = half + ',' + half;
    const p2 = (half + half * Math.cos(rad(a - w))) + ',' + (half + half * Math.sin(rad(a - w)));
    const p3 = (half + half * Math.cos(rad(a + w))) + ',' + (half + half * Math.sin(rad(a + w)));
    rays.push(
      <Polygon
        key={i}
        points={p1 + ' ' + p2 + ' ' + p3}
        fill={i % 2 === 0 ? tint[0] : tint[1]}
        fillOpacity={i % 2 === 0 ? 0.34 : 0.2}
      />
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { alignItems: 'center', justifyContent: 'center', opacity: opacity == null ? 1 : opacity },
        style,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="fade" cx="50%" cy="50%" r="50%">
            <Stop offset="0.08" stopColor="#000" stopOpacity="0" />
            <Stop offset="0.28" stopColor="#000" stopOpacity="1" />
            <Stop offset="0.58" stopColor="#000" stopOpacity="1" />
            <Stop offset="0.82" stopColor="#000" stopOpacity="0" />
          </RadialGradient>
          <Mask id="m">
            <Rect width={size} height={size} fill="url(#fade)" />
          </Mask>
        </Defs>
        <G mask="url(#m)">{rays}</G>
      </Svg>
    </Animated.View>
  );
}
