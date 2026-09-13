// Ports the page's CSS radial-gradient vignette (#vign in
// project/grailhaus-pack.html) onto Skia's declarative <Canvas> — reusing
// the dependency the art layer already needs rather than pulling in
// expo-linear-gradient for one screen-sized background.
import React from 'react';
import { Canvas, Rect, RadialGradient, vec } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';

export function VignetteBackground({ width, height }: { width: number; height: number }) {
  if (width <= 0 || height <= 0) return null;
  return (
    <Canvas style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} color="#060608" />
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width * 0.5, height * 0.4)}
          r={Math.max(width * 0.58, height * 0.44)}
          colors={['rgba(120,70,190,0.20)', 'rgba(6,5,10,0)']}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width * 0.5, height * 1.18)}
          r={Math.max(width * 0.6, height * 0.45)}
          colors={['rgba(216,169,63,0.10)', 'rgba(6,5,10,0)']}
        />
      </Rect>
    </Canvas>
  );
}
