import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

type StatusTileProps = {
  icon: LucideIcon;
  title: string;
  detail: string;
  active?: boolean;
  tone?: 'orange' | 'blue' | 'green' | 'peach';
};

const TONES = {
  orange: { icon: '#FFE0BD', iconText: '#9A520E' },
  blue: { icon: '#DCE8FF', iconText: '#2B5797' },
  green: { icon: '#D9F3E8', iconText: '#087F5B' },
  peach: { icon: '#FBE0D0', iconText: '#A35432' },
};

export function StatusTile({ icon: Icon, title, detail, active = false, tone = 'blue' }: StatusTileProps) {
  const palette = TONES[tone];
  return (
    <View style={[styles.tile, active && styles.activeTile]}>
      <View style={[styles.icon, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : palette.icon }]}>
        <Icon size={19} color={active ? '#FFFFFF' : palette.iconText} strokeWidth={2} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, active && styles.activeText]}>{title}</Text>
        <Text style={[styles.detail, active && styles.activeDetail]}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 82,
    padding: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#B8A99B',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  activeTile: {
    backgroundColor: '#FF9F43',
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#26221E',
  },
  detail: {
    fontSize: 12,
    color: '#756B62',
    lineHeight: 17,
  },
  activeText: {
    color: '#FFFFFF',
  },
  activeDetail: {
    color: '#FFF4E7',
  },
});
