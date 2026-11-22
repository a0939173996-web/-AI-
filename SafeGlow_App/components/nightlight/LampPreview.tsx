import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type LampPreviewProps = {
  power: boolean;
  brightness: number;
  color: string;
  breathing: boolean;
  breathMs: number;
};

const LAMP_SIZE = 180;
const COLOR_FADE_MS = 900;
const BRIGHTNESS_FADE_MS = 1200;
const BREATH_FLOOR = 0.55;

export function LampPreview({ power, brightness, color, breathing, breathMs }: LampPreviewProps) {
  const level = useSharedValue(0);
  const breath = useSharedValue(1);
  const colorProgress = useSharedValue(1);
  const [colorPair, setColorPair] = useState({ from: color, to: color });

  useEffect(() => {
    setColorPair((previous) => ({ from: previous.to, to: color }));
    colorProgress.value = 0;
    colorProgress.value = withTiming(1, { duration: COLOR_FADE_MS });
  }, [color, colorProgress]);

  useEffect(() => {
    level.value = withTiming(power ? brightness / 100 : 0, { duration: BRIGHTNESS_FADE_MS });
  }, [power, brightness, level]);

  useEffect(() => {
    cancelAnimation(breath);
    if (!breathing) {
      breath.value = withTiming(1, { duration: 600 });
      return;
    }
    breath.value = withRepeat(
      withTiming(BREATH_FLOOR, { duration: breathMs / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [breathing, breathMs, breath]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: level.value * breath.value * 0.35,
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [colorPair.from, colorPair.to],
    ),
  }));

  const coreStyle = useAnimatedStyle(() => ({
    opacity: Math.max(level.value * breath.value, 0.04),
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [colorPair.from, colorPair.to],
    ),
  }));

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.halo, haloStyle]} />
      <Animated.View style={[styles.core, coreStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: LAMP_SIZE + 64,
    height: LAMP_SIZE + 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: LAMP_SIZE + 64,
    height: LAMP_SIZE + 64,
    borderRadius: (LAMP_SIZE + 64) / 2,
  },
  core: {
    width: LAMP_SIZE,
    height: LAMP_SIZE,
    borderRadius: LAMP_SIZE / 2,
  },
});
