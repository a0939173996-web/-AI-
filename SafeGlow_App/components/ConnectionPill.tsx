import { Pressable, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native';
import { RefreshCw } from 'lucide-react-native';

export type PillTone = 'ready' | 'paused' | 'reconnecting';

type ConnectionPillProps = {
  label: string;
  tone: PillTone;
  onPress: () => void;
};

const TONE_STYLES: Record<PillTone, { pill: ViewStyle; text: TextStyle; accent: string }> = {
  ready: { pill: { backgroundColor: '#E6F1EC', borderColor: '#B7D8CA' }, text: { color: '#24513D' }, accent: '#2F7D5B' },
  paused: { pill: { backgroundColor: '#FCE9D9', borderColor: '#F4A261' }, text: { color: '#7A3E12' }, accent: '#B5651D' },
  reconnecting: { pill: { backgroundColor: '#F1EEE9', borderColor: '#D9D2C7' }, text: { color: '#4A443D' }, accent: '#4A443D' },
};

export function ConnectionPill({ label, tone, onPress }: ConnectionPillProps) {
  const palette = TONE_STYLES[tone];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pill, palette.pill, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="重新連線">
      {tone === 'reconnecting' ? (
        <RefreshCw size={14} color={palette.accent} strokeWidth={2.4} />
      ) : (
        <Text style={[styles.dot, { color: palette.accent }]}>●</Text>
      )}
      <Text style={[styles.text, palette.text]}>{label}</Text>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  dot: {
    fontSize: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
