import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type RingTone = 'calm' | 'paused' | 'gentle';

type RhythmRingProps = {
  tone: RingTone;
  pulseMs: number;
  value: string;
  unit: string;
  label: string;
};

const RING_SIZE = 248;
const GLOW_PULSE_MS = 1800;
const GLOW_FLOOR = 0.35;

export function RhythmRing({ tone, pulseMs, value, unit, label }: RhythmRingProps) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(scale);
    if (tone === 'paused') {
      scale.value = withTiming(1, { duration: 600 });
      return;
    }
    scale.value = withRepeat(
      withTiming(1.06, { duration: pulseMs / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [tone, pulseMs, scale]);

  useEffect(() => {
    cancelAnimation(glow);
    if (tone !== 'gentle') {
      glow.value = withTiming(0, { duration: 600 });
      return;
    }
    glow.value = GLOW_FLOOR;
    glow.value = withRepeat(
      withTiming(1, { duration: GLOW_PULSE_MS / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [tone, glow]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.ring, ringStyle]}>
        <View style={[styles.layer, styles.calmLayer, tone === 'paused' && styles.pausedLayer]} />
        <Animated.View style={[styles.layer, styles.glowLayer, glowStyle]} />
        <View style={styles.core}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.unit}>{unit}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: RING_SIZE + 32,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RING_SIZE / 2,
  },
  calmLayer: {
    backgroundColor: '#B7D8CA',
  },
  pausedLayer: {
    backgroundColor: '#E4DED5',
  },
  glowLayer: {
    backgroundColor: '#F4A261',
  },
  core: {
    width: RING_SIZE - 56,
    height: RING_SIZE - 56,
    borderRadius: (RING_SIZE - 56) / 2,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7A5C3E',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  value: {
    fontSize: 52,
    fontWeight: '700',
    color: '#2B2A28',
    lineHeight: 58,
  },
  unit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5E5850',
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    color: '#7A736B',
    marginTop: 6,
  },
});
