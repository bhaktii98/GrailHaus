// Top-level screen — the RN equivalent of project/grailhaus-vault-break.html.
// Loads the logo, mounts the 3D scene, and lays the same overlay chrome
// (kicker/title/meta, seam-drag hint, card-note, Orbit/Reseal/Add-to-
// collection pills) over it that the prototype's #frame/#card-note/.pill
// elements did. See ../../reveal/PackRevealScreen.tsx for the Tier 1
// precedent this follows.
//
// One deliberate simplification vs the original: its #vign vignette had a
// `vign.style.opacity = String(1 + dim*0.5)` line meant to intensify
// during the rarity moment — but the element's baseline opacity is
// already 1 (unset in its CSS rule), so pushing it past 1 is clamped by
// the browser and has no visible effect there either. Reproducing that
// no-op wasn't worth an Animated.Value wire-up, so VaultVignette here
// just renders at a constant opacity.
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
import * as Haptics from 'expo-haptics';
import { vaultBreakPersonality } from './config/vaultBreak.config';
import { VaultScene, type VaultSceneHandle, type VaultStateSnapshot } from './scene/VaultScene';
import { loadLogoImage } from '../reveal/engine/textures';
import { VaultVignette } from './ui/VaultVignette';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LOGO_ASSET = require('../../assets/grailhaus-logo.png');

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export function VaultBreakScreen() {
  const { width, height } = useWindowDimensions();
  const [logo, setLogo] = useState<SkImage | null>(null);
  const [ready, setReady] = useState(false);
  const [orbit, setOrbit] = useState(false);
  const [collectLabel, setCollectLabel] = useState('Add to collection');
  const [snapshot, setSnapshot] = useState<VaultStateSnapshot>({
    phase: 'idle', hero: -1, ready: false, running: false, dim: 0, shown: 0, heroLabel: null,
  });
  const sceneRef = useRef<VaultSceneHandle>(null);
  const personality = vaultBreakPersonality;

  useEffect(() => {
    let mounted = true;
    loadLogoImage(LOGO_ASSET).then((img) => {
      if (!mounted) return;
      setLogo(img);
      setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={personality.palette.champagne} />
      </View>
    );
  }

  const noteOn = snapshot.heroLabel !== null;
  const showCollect = snapshot.hero >= 0;
  const showReseal = snapshot.shown > 0.96;

  let hint = personality.copy.hintDrag;
  let hintOpacity = 1;
  if (snapshot.phase === 'ready') {
    hint = personality.copy.hintInspect;
    hintOpacity = snapshot.hero >= 0 ? 0 : 1;
  } else if (snapshot.running) {
    hintOpacity = 0;
  } else {
    hintOpacity = Math.max(0, 1 - snapshot.shown * 1.6);
  }

  const handleReseal = () => {
    sceneRef.current?.reseal();
    setCollectLabel('Add to collection');
  };
  const handleOrbitToggle = () => setOrbit((o) => !o);
  const handleCollect = () => {
    if (!snapshot.heroLabel) return;
    setCollectLabel(`Added · ${snapshot.heroLabel.serial}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setTimeout(() => setCollectLabel('Add to collection'), 2200);
  };

  return (
    <View style={styles.root}>
      <VaultVignette width={width} height={height} />

      <ThreeCanvas
        style={styles.canvas}
        camera={{ position: [0, 0.006, 0.214], fov: 45, near: 0.01, far: 2 }}
        shadows
        gl={{ antialias: true, alpha: true }}
      >
        <VaultScene ref={sceneRef} personality={personality} logo={logo} orbit={orbit} onSnapshot={setSnapshot} />
      </ThreeCanvas>

      <View pointerEvents="none" style={styles.frame}>
        <View>
          <View style={styles.kickerRow}>
            <View style={styles.kickerRule} />
            <Text style={styles.kicker}>{personality.copy.kicker}</Text>
          </View>
          <Text style={styles.title}>
            {personality.copy.title}
            <Text style={styles.titleEmphasis}>{personality.copy.titleEmphasis}</Text>
          </Text>
          <View style={styles.metaRow}>
            {personality.copy.meta.map((m, i) => (
              <React.Fragment key={m}>
                {i > 0 ? <Text style={styles.metaDot}>/</Text> : null}
                <Text style={styles.meta}>{m}</Text>
              </React.Fragment>
            ))}
          </View>
        </View>
        <View />
        <Text style={[styles.hint, { opacity: hintOpacity }]}>{hint}</Text>
      </View>

      {noteOn && snapshot.heroLabel ? (
        <View pointerEvents="none" style={styles.cardNote}>
          <Text style={styles.cardNoteRarity}>{snapshot.heroLabel.rarity}</Text>
          <Text style={styles.cardNoteName}>{snapshot.heroLabel.name}</Text>
          <Text style={styles.cardNoteValue}>{snapshot.heroLabel.value} · {snapshot.heroLabel.serial}</Text>
        </View>
      ) : null}

      <Pressable style={styles.modeButton} onPress={handleOrbitToggle}>
        <Text style={styles.pillText}>{orbit ? 'Close orbit' : 'Orbit'}</Text>
      </Pressable>

      {showReseal ? (
        <Pressable style={styles.againButton} onPress={handleReseal}>
          <Text style={styles.pillText}>Reseal</Text>
        </Pressable>
      ) : null}

      {showCollect ? (
        <Pressable style={styles.collectButton} onPress={handleCollect}>
          <Text style={styles.pillTextCollect}>{collectLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05030a' },
  loading: { flex: 1, backgroundColor: '#05030a', alignItems: 'center', justifyContent: 'center' },
  canvas: { flex: 1, backgroundColor: 'transparent' },
  frame: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    padding: 24, paddingBottom: 32,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  kickerRule: { width: 26, height: 1, backgroundColor: 'rgba(232,207,162,0.5)' },
  kicker: {
    fontFamily: mono, fontSize: 10, letterSpacing: 3.4, color: '#b99b57', textTransform: 'uppercase',
  },
  title: { marginTop: 10, fontSize: 30, fontWeight: '500', color: '#f4ece0', alignSelf: 'flex-start' },
  titleEmphasis: { fontStyle: 'italic', color: '#e8cf9a' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignSelf: 'flex-start' },
  meta: { fontFamily: mono, fontSize: 10, letterSpacing: 1.4, color: '#9d8fb8' },
  metaDot: { fontFamily: mono, fontSize: 10, color: 'rgba(232,207,162,0.45)' },
  hint: {
    fontFamily: mono, fontSize: 10, letterSpacing: 2.6, textTransform: 'uppercase',
    color: 'rgba(244,236,224,0.5)', textAlign: 'center',
  },
  cardNote: { position: 'absolute', left: 24, bottom: 88 },
  cardNoteRarity: { fontFamily: mono, fontSize: 9, letterSpacing: 3.2, color: '#e8cf9a' },
  cardNoteName: { marginTop: 6, fontSize: 20, color: '#f4ece0' },
  cardNoteValue: { marginTop: 4, fontFamily: mono, fontSize: 11, letterSpacing: 1.6, color: 'rgba(157,143,184,0.9)' },
  modeButton: {
    position: 'absolute', right: 24, top: 24,
    paddingVertical: 11, paddingHorizontal: 20, borderRadius: 2,
    borderWidth: 1, borderColor: 'rgba(232,207,162,0.4)', backgroundColor: 'rgba(16,8,32,0.76)',
  },
  againButton: {
    position: 'absolute', left: 24, bottom: 32,
    paddingVertical: 11, paddingHorizontal: 20, borderRadius: 2,
    borderWidth: 1, borderColor: 'rgba(232,207,162,0.4)', backgroundColor: 'rgba(16,8,32,0.76)',
  },
  collectButton: {
    position: 'absolute', left: '50%', marginLeft: -84, bottom: 32,
    paddingVertical: 11, paddingHorizontal: 20, borderRadius: 2,
    borderWidth: 1, borderColor: 'rgba(232,207,162,0.7)', backgroundColor: 'rgba(232,207,162,0.1)',
  },
  pillText: {
    color: '#f4ece0', fontSize: 10, letterSpacing: 2.2, textTransform: 'uppercase', fontWeight: '600',
    fontFamily: mono,
  },
  pillTextCollect: {
    color: '#fbf0d4', fontSize: 10, letterSpacing: 2.2, textTransform: 'uppercase', fontWeight: '600',
    fontFamily: mono,
  },
});
