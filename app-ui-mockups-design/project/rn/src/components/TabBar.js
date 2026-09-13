import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { accent } from '../theme';

const TABS = ['Packs', 'Portfolio', 'Market', 'You'];

// Floating pill bar. Only the active tab shows its label — that is what keeps
// four items from crowding at this width.
export default function TabBar({ active, onChange }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {TABS.map((t) => {
          const on = t === active;
          const inner = (
            <>
              <View style={[styles.icon, { borderColor: on ? '#fff' : 'rgba(255,255,255,0.45)' }]} />
              {on ? <Text style={styles.label}>{t}</Text> : null}
            </>
          );
          return (
            <Pressable key={t} style={styles.slot} onPress={() => onChange && onChange(t)}>
              {on ? (
                <LinearGradient colors={[accent.cards.c1, accent.cards.c2]} style={styles.pill}>
                  {inner}
                </LinearGradient>
              ) : (
                <View style={styles.pill}>{inner}</View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 26 },
  bar: {
    height: 62, borderRadius: 999, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 7, backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)',
  },
  slot: { flex: 1 },
  pill: {
    height: 48, borderRadius: 999, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { width: 15, height: 15, borderRadius: 5, borderWidth: 2.2 },
  label: { marginLeft: 7, fontSize: 12, fontWeight: '800', color: '#fff' },
});
