// Top-level screen — the RN equivalent of project/grailhaus-pack.html.
// Loads the logo, builds the scene once ready, and lays the same overlay
// text (kicker / title / meta) and Reseal control over the 3D canvas that
// the prototype's #frame div did.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Canvas as ThreeCanvas } from '@react-three/fiber/native';
import type { SkImage } from '@shopify/react-native-skia';
import { cardPackPersonality } from './config/cardPack.config';
import { PackScene, type PackSceneHandle } from './scene/PackScene';
import { loadLogoImage } from './engine/textures';
import { VignetteBackground } from './ui/VignetteBackground';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LOGO_ASSET = require('../../assets/grailhaus-logo.png');

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export function PackRevealScreen() {
  const { width, height } = useWindowDimensions();
  const [logo, setLogo] = useState<SkImage | null>(null);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(0);
  const sceneRef = useRef<PackSceneHandle>(null);
  const personality = cardPackPersonality;

  useEffect(() => {
    let mounted = true;
    loadLogoImage(LOGO_ASSET).then((img) => {
      if (!mounted) return;
      setLogo(img);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={personality.palette.gold} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <VignetteBackground width={width} height={height} />

      <ThreeCanvas
        style={styles.canvas}
        camera={{ position: [0, 0.006, 0.205], fov: 45, near: 0.01, far: 2 }}
        shadows
        gl={{ antialias: true, alpha: true }}
      >
        <PackScene ref={sceneRef} personality={personality} logo={logo} onShownChange={setShown} />
      </ThreeCanvas>

      <View pointerEvents="none" style={styles.frame}>
        <View>
          <Text style={styles.kicker}>{personality.copy.kicker}</Text>
          <Text style={styles.title}>
            {personality.copy.title}
            <Text style={styles.titleEmphasis}>{personality.copy.titleEmphasis}</Text>
          </Text>
          <View style={styles.metaRow}>
            {personality.copy.meta.map((m) => (
              <Text key={m} style={styles.meta}>{m}</Text>
            ))}
          </View>
        </View>
      </View>

      {shown > 0.96 ? (
        <Pressable style={styles.resealButton} onPress={() => sceneRef.current?.reseal()}>
          <Text style={styles.resealText}>Reseal</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060608' },
  loading: { flex: 1, backgroundColor: '#060608', alignItems: 'center', justifyContent: 'center' },
  canvas: { flex: 1, backgroundColor: 'transparent' },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: 3.2,
    color: '#a98a4e',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: '500',
    color: '#f0e8d8',
  },
  titleEmphasis: {
    fontStyle: 'italic',
    color: '#d8a93f',
  },
  metaRow: { flexDirection: 'row', gap: 18, marginTop: 10 },
  meta: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8, color: '#9a8bb5' },
  resealButton: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 36,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(216,169,63,0.45)',
    backgroundColor: 'rgba(24,12,44,0.78)',
  },
  resealText: {
    color: '#f6eeda',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});
