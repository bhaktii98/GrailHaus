import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { spring } from '../theme';

// Page dots where the active one stretches into a bar.
export default function Dots({ count, index, onPick }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <Pressable key={i} onPress={() => onPick && onPick(i)} hitSlop={10}>
          <Dot on={i === index} />
        </Pressable>
      ))}
    </View>
  );
}

function Dot({ on }) {
  const style = useAnimatedStyle(() => ({
    width: withSpring(on ? 28 : 9, spring.cards),
    backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.24)',
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 7 },
  dot: { height: 9, borderRadius: 5 },
});
