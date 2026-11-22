import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

type BrightnessSliderProps = {
  value: number;
  disabled: boolean;
  onChange: (percent: number) => void;
};

const KNOB_SIZE = 28;

export function BrightnessSlider({ value, disabled, onChange }: BrightnessSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);

  const update = (locationX: number) => {
    if (disabled || trackWidth <= 0) return;
    const percent = Math.round(Math.min(Math.max(locationX / trackWidth, 0), 1) * 100);
    onChange(percent);
  };

  return (
    <View
      style={[styles.hitArea, disabled && styles.disabled]}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderGrant={(event) => update(event.nativeEvent.locationX)}
      onResponderMove={(event) => update(event.nativeEvent.locationX)}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max: 100, now: value }}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${value}%` }]} pointerEvents="none" />
      </View>
      <View style={[styles.knob, { left: `${value}%` }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    height: KNOB_SIZE + 16,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EFE6DA',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#F4A261',
  },
  knob: {
    position: 'absolute',
    top: 8,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    marginLeft: -KNOB_SIZE / 2,
    backgroundColor: '#FFFDF9',
    borderWidth: 2,
    borderColor: '#F4A261',
    shadowColor: '#7A5C3E',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
