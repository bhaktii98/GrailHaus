// Ports #vign's three layered CSS radial-gradients from
// grailhaus-vault-break.html onto Skia's declarative <Canvas> — same
// technique as ../../reveal/ui/VignetteBackground.tsx. The opacity boost
// during the rarity moment (`vign.style.opacity = 1 + dim*0.5` in the
// original) is applied by the caller wrapping this in an Animated.View
// rather than re-rendering the canvas every frame — see
// VaultBreakScreen.tsx.
import React from 'react';
import { Canvas, Rect, RadialGradient, vec } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';

export function VaultVignette({ width, height }: { width: number; height: number }) {
  if (width <= 0 || height <= 0) return null;
  return (
    <Canvas style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} color="#05030a" />
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width * 0.5, height * 0.38)}
          r={Math.max(width * 0.26, height * 0.2) / 0.64}
          colors={['rgba(92,52,158,0.20)', 'rgba(5,3,10,0)']}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width * 0.5, height * 1.16)}
          r={Math.max(width * 0.6, height * 0.45) / 0.58}
          colors={['rgba(232,207,162,0.07)', 'rgba(5,3,10,0)']}
        />
      </Rect>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width * 0.5, height * 0.5)}
          r={Math.max(width * 0.65, height * 0.55)}
          colors={['rgba(5,3,10,0)', 'rgba(5,3,10,0)', 'rgba(3,2,6,0.86)']}
          positions={[0, 0.42, 1]}
        />
      </Rect>
    </Canvas>
  );
}
