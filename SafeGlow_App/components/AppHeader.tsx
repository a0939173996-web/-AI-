import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CircleUserRound, Sun, Wifi } from 'lucide-react-native';

type AppHeaderProps = {
  pageLabel: string;
  onToggleDisplay?: () => void;
  onOpenProfile?: () => void;
};

export function AppHeader({ pageLabel, onToggleDisplay, onOpenProfile }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.brandGroup}>
        <View style={styles.brandMark}>
          <Sun size={16} color="#FF9F43" strokeWidth={2.3} />
        </View>
        <View>
          <Text style={styles.brand}>SafeGlow</Text>
          <Text style={styles.page}>{pageLabel}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <View style={styles.statusPill}>
          <Wifi size={13} color="#087F5B" strokeWidth={2.4} />
          <Text style={styles.statusText}>安心在線</Text>
        </View>
        <Pressable onPress={onToggleDisplay} style={styles.roundButton} accessibilityRole="button" accessibilityLabel="切換夜間顯示">
          <Sun size={18} color="#9A520E" strokeWidth={2} />
        </Pressable>
        <Pressable onPress={onOpenProfile} style={styles.avatar} accessibilityRole="button" accessibilityLabel="開啟個人紀錄">
          <CircleUserRound size={23} color="#9A520E" strokeWidth={1.8} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 18,
    fontWeight: '700',
    color: '#181716',
    letterSpacing: 0.2,
  },
  page: {
    fontSize: 11,
    color: '#756B62',
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#DDF5EA',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#087F5B',
  },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE7C9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
