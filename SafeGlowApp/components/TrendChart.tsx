import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type TrendChartProps = {
  compact?: boolean;
};

export function TrendChart({ compact = false }: TrendChartProps) {
  return (
    <View style={[styles.chart, compact && styles.compact]}>
      <Svg width="100%" height={compact ? 62 : 96} viewBox="0 0 320 96" preserveAspectRatio="none">
        <Path d="M0 64 C22 55 35 70 56 62 S93 45 112 61 S143 82 164 59 S193 31 216 55 S244 75 266 58 S291 49 320 63" fill="none" stroke="#FF9F43" strokeWidth="3" strokeLinecap="round" />
        <Circle cx="316" cy="62" r="4.5" fill="#9A520E" />
      </Svg>
      <View style={styles.labels}>
        <Text style={styles.label}>00:00</Text>
        <Text style={styles.label}>00:20</Text>
        <Text style={styles.label}>00:40</Text>
        <Text style={styles.label}>01:00</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    height: 128,
    borderRadius: 18,
    backgroundColor: '#F0F4FF',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 6,
  },
  compact: {
    height: 94,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 10,
    color: '#8A8178',
  },
});
