import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ink } from '../theme';

// Every screen sits on a washed ground: the category glow bled in at the top,
// falling to near-black. One component so the wash is identical everywhere.
export default function Screen(props) {
  const { glow, children, intensity } = props;
  const i = intensity == null ? 0.3 : intensity;
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {glow ? (
        <LinearGradient
          colors={['rgba(' + glow + ',' + i + ')', ink.ground, ink.groundDeep]}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ink.ground },
});
