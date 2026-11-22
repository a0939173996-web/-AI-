import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LAMP_COLORS, type LampColorKey } from '@/state/nightlightStateMachine';

type ColorSwatchesProps = {
  selected: LampColorKey;
  onSelect: (key: LampColorKey) => void;
};

export function ColorSwatches({ selected, onSelect }: ColorSwatchesProps) {
  return (
    <View style={styles.row}>
      {LAMP_COLORS.map((lamp) => {
        const active = lamp.key === selected;
        return (
          <Pressable
            key={lamp.key}
            onPress={() => onSelect(lamp.key)}
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={lamp.name}>
            <View style={[styles.swatchRing, active && styles.swatchRingActive]}>
              <View style={[styles.swatch, { backgroundColor: lamp.hex }]} />
            </View>
            <Text style={[styles.name, active && styles.nameActive]}>{lamp.name}</Text>
            <Text style={styles.hint}>{lamp.hint}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 16,
  },
  optionPressed: {
    opacity: 0.7,
  },
  swatchRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchRingActive: {
    borderColor: '#2F7D5B',
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EADFD2',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A443D',
  },
  nameActive: {
    color: '#24513D',
  },
  hint: {
    fontSize: 12,
    color: '#5E5850',
  },
});
