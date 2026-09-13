import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PackRevealScreen } from './src/reveal/PackRevealScreen';
import { VaultBreakScreen } from './src/vault/VaultBreakScreen';

type Tier = 'street-rip' | 'vault-break';

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export default function App() {
  // Both tiers share one screen so a reviewer can flip between the Tier 1
  // (street-rip) and Tier 2 (vault-break) reveals without a separate
  // build — not part of the original design handoff, just a convenience
  // for this patch. Vault Break is the default since it's the tier this
  // patch adds.
  const [tier, setTier] = useState<Tier>('vault-break');

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.root}>
        {tier === 'vault-break' ? <VaultBreakScreen /> : <PackRevealScreen />}
        <View pointerEvents="box-none" style={styles.switcher}>
          <Pressable
            style={[styles.tab, tier === 'street-rip' && styles.tabActive]}
            onPress={() => setTier('street-rip')}
          >
            <Text style={styles.tabText}>Street Rip</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tier === 'vault-break' && styles.tabActive]}
            onPress={() => setTier('vault-break')}
          >
            <Text style={styles.tabText}>Vault Break</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  switcher: {
    position: 'absolute',
    top: 58,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(8,4,16,0.6)',
    borderRadius: 999,
    padding: 3,
  },
  tab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  tabActive: { backgroundColor: 'rgba(232,207,162,0.22)' },
  tabText: { fontFamily: mono, fontSize: 9, letterSpacing: 1.2, color: '#f4ece0' },
});
