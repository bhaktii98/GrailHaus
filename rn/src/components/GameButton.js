import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { buttonShadow } from '../theme';

// The chunky bottom-shadowed button. Press sinks it into its own shadow —
// the shadow is a sibling view, not a box-shadow, because RN has no inset.
export default function GameButton(props) {
  const { label, accent, onPress, dark, style, right } = props;
  const [down, setDown] = React.useState(false);

  return (
    <View style={[{ paddingBottom: 6 }, style]}>
      <View style={styles.sink} />
      <Pressable
        onPressIn={() => setDown(true)}
        onPressOut={() => setDown(false)}
        onPress={onPress}
        style={[
          { transform: [{ translateY: down ? 6 : 0 }] },
          buttonShadow(accent.glow),
        ]}
      >
        <LinearGradient
          colors={[accent.c1, accent.c2]}
          style={styles.btn}
        >
          <Text style={[styles.label, dark && { color: '#1A1206' }]}>{label}</Text>
          {right ? <View style={styles.right}>{right}</View> : null}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sink: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 60,
    borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.38)',
  },
  btn: {
    height: 60, borderRadius: 18, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.28)',
  },
  label: {
    fontSize: 16, fontWeight: '900', letterSpacing: 1.4, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.32)', textShadowRadius: 0,
    textShadowOffset: { width: 0, height: 2 },
  },
  right: { marginLeft: 12 },
});
