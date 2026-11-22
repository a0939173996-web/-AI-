import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Activity, Baby, CheckCircle2, CircleDot, CloudSun, Droplets, Eye, Heart, ShieldCheck, Thermometer } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { ConnectionPill } from '@/components/ConnectionPill';
import { EscalationDialog } from '@/components/EscalationDialog';
import { RhythmRing, type RingTone } from '@/components/RhythmRing';
import { DeviceConnectionPanel } from '@/components/DeviceConnectionPanel';
import { StatusTile } from '@/components/StatusTile';
import { TrendChart } from '@/components/TrendChart';
import { useNursery } from '@/state/nurseryController';
import { useDeviceConnection } from '@/state/deviceConnection';

const FALLBACK_PULSE_MS = 4000;
const PULSE_STEP_MS = 250;
const SHAKE_PX = 8;
const SHAKE_STEP_MS = 60;

export default function DashboardScreen() {
  const { state, level, motionRate, copy, pill, showPrompt, reconnect, acknowledgePrompt } = useNursery();
  const { lanState } = useDeviceConnection();
  const tone: RingTone = level > 0 ? 'gentle' : state.paused ? 'paused' : 'calm';
  const pulseMs = motionRate === null ? FALLBACK_PULSE_MS : Math.round(60000 / motionRate / PULSE_STEP_MS) * PULSE_STEP_MS;
  const isGentle = level > 0 && !state.paused;
  const shake = useSharedValue(0);

  useEffect(() => {
    if (level !== 2) return;
    shake.value = withSequence(
      withTiming(-SHAKE_PX, { duration: SHAKE_STEP_MS }),
      withTiming(SHAKE_PX, { duration: SHAKE_STEP_MS }),
      withTiming(-SHAKE_PX / 2, { duration: SHAKE_STEP_MS }),
      withTiming(SHAKE_PX / 2, { duration: SHAKE_STEP_MS }),
      withTiming(0, { duration: SHAKE_STEP_MS }),
    );
  }, [level, shake]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.column, shakeStyle]}>
          <AppHeader pageLabel="Dashboard" />
          <View style={styles.profileRow}>
            <View>
              <Text style={styles.greeting}>沐沐 · 6 個月大 <Text style={styles.greenDot}>●</Text></Text>
              <View style={styles.localLine}>
                <WifiBars />
                <Text style={styles.localText}>非接觸毫米波感知守護中</Text>
              </View>
            </View>
            <View style={styles.nightBadge}>
              <CloudSun size={16} color="#9A520E" strokeWidth={2} />
              <Text style={styles.nightBadgeText}>夜巡暖色</Text>
            </View>
          </View>

          <View style={styles.environmentRow}>
            <MetricCard icon={Thermometer} label="室內溫度" value="23.5°C" note="舒適" tone="orange" />
            <MetricCard icon={Droplets} label="空氣濕度" value="55%" note="理想" tone="blue" />
          </View>

          <View style={styles.rhythmCard}>
            <View style={styles.rhythmTitleRow}>
              <Text style={styles.rhythmOverline}>微動節奏</Text>
              <Text style={styles.rhythmHint}>平穩呼吸 · 沉睡期</Text>
            </View>
            <RhythmRing
              tone={tone}
              pulseMs={pulseMs}
              value={motionRate === null ? '--' : Math.round(motionRate).toString()}
              unit="次 / 分"
              label="持續性自然微動"
            />
            <View style={styles.trendLabelRow}>
              <Text style={styles.sectionHint}>● 近 1 小時微動趨勢</Text>
              <Text style={styles.greenHint}>平穩呼吸 · 沉睡期</Text>
            </View>
            <TrendChart />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>睡眠體動狀態</Text>
            <Text style={styles.sectionHint}>雷達自主感知分析</Text>
          </View>
          <View style={styles.grid}>
            <StatusTile icon={CloudSun} title="安靜睡眠" detail="深度安眠中" active={!state.paused && level === 0} tone="orange" />
            <StatusTile icon={Baby} title="輕微體動" detail="翻身伸展" tone="blue" />
            <StatusTile icon={Eye} title="短暫轉醒" detail="自主接覺中" tone="blue" />
            <StatusTile icon={Heart} title="離床 / 抱起" detail="家長陪伴中" tone="peach" />
          </View>

          <View style={styles.wellnessNote}>
            <CircleDot size={20} color="#A35432" strokeWidth={2} />
            <View style={styles.noteCopy}>
              <Text style={styles.noteTitle}>溫柔陪伴小語</Text>
              <Text style={styles.noteText}>寶寶目前處於黃金深度睡眠期，房內聲響極低，守護感滿滿。</Text>
            </View>
          </View>

          <View style={styles.reassurance}>
            <ShieldCheck size={27} color="#FFFFFF" strokeWidth={2} />
            <View style={styles.noteCopy}>
              <Text style={styles.reassuranceTitle}>{copy.title === '安穩睡眠中' ? '當前狀態平穩，守護安心無虞' : copy.title}</Text>
              <Text style={styles.reassuranceText}>{copy.detail}</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>今晚守護時序</Text>
          </View>
          <ScheduleRow icon={CloudSun} title="進入甜美沉睡" detail="心率起伏降至平穩狀態" time="22:45" tone="green" />
          <ScheduleRow icon={Activity} title="舒眠潮汐聲波播放" detail="智慧自動淡出全夜微風聲" time="22:15" tone="orange" />

          <View style={styles.connectionRow}>
            <ConnectionPill
              label={lanState === 'connected' ? pill.label : '點擊重新連線開發板'}
              tone={lanState === 'connected' ? pill.tone : 'reconnecting'}
              onPress={reconnect}
            />
            <Text style={styles.connectionHint}>資料僅在區網裝置間流動</Text>
          </View>
          <DeviceConnectionPanel />
        </Animated.View>
      </ScrollView>
      <EscalationDialog visible={showPrompt} onAcknowledge={acknowledgePrompt} />
    </SafeAreaView>
  );
}

function WifiBars() {
  return <View style={styles.wifiBars}><View style={styles.barSmall} /><View style={styles.barMedium} /><View style={styles.barLarge} /></View>;
}

function MetricCard({ icon: Icon, label, value, note, tone }: { icon: typeof Thermometer; label: string; value: string; note: string; tone: 'orange' | 'blue' }) {
  return <View style={styles.metricCard}><View style={[styles.metricIcon, tone === 'orange' ? styles.metricOrange : styles.metricBlue]}><Icon size={19} color={tone === 'orange' ? '#A35432' : '#2B5797'} strokeWidth={2} /></View><View><Text style={styles.metricLabel}>{label}</Text><View style={styles.metricValueRow}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricNote}>{note}</Text></View></View></View>;
}

function ScheduleRow({ icon: Icon, title, detail, time, tone }: { icon: typeof CloudSun; title: string; detail: string; time: string; tone: 'green' | 'orange' }) {
  return <View style={styles.scheduleRow}><View style={[styles.scheduleIcon, tone === 'green' ? styles.metricGreen : styles.metricOrange]}><Icon size={18} color={tone === 'green' ? '#087F5B' : '#A35432'} strokeWidth={2} /></View><View style={styles.scheduleCopy}><Text style={styles.scheduleTitle}>{title}</Text><Text style={styles.scheduleDetail}>{detail}</Text></View><Text style={styles.scheduleTime}>{time}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8FF' },
  content: { paddingHorizontal: 22, paddingTop: 15, paddingBottom: 42, alignItems: 'center' },
  column: { width: '100%', maxWidth: 480, gap: 16 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  greeting: { fontSize: 21, fontWeight: '800', color: '#181716' },
  greenDot: { color: '#087F5B', fontSize: 13 },
  localLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  wifiBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  barSmall: { width: 3, height: 5, borderRadius: 2, backgroundColor: '#087F5B' },
  barMedium: { width: 3, height: 9, borderRadius: 2, backgroundColor: '#087F5B' },
  barLarge: { width: 3, height: 13, borderRadius: 2, backgroundColor: '#087F5B' },
  localText: { fontSize: 12, color: '#4F625A' },
  nightBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F0F4FF' },
  nightBadgeText: { fontSize: 12, color: '#9A520E', fontWeight: '600' },
  environmentRow: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, padding: 14, borderRadius: 20, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#A8A0B4', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  metricIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  metricOrange: { backgroundColor: '#FFE0BD' },
  metricBlue: { backgroundColor: '#DCE8FF' },
  metricGreen: { backgroundColor: '#D9F3E8' },
  metricLabel: { fontSize: 11, color: '#756B62' },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  metricValue: { fontSize: 21, color: '#181716', fontWeight: '600' },
  metricNote: { fontSize: 11, color: '#087F5B', fontWeight: '600' },
  rhythmCard: { padding: 18, borderRadius: 27, backgroundColor: '#FFFDFB', shadowColor: '#E4B98F', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  rhythmTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rhythmOverline: { fontSize: 14, fontWeight: '800', color: '#4B2B15' },
  rhythmHint: { fontSize: 12, color: '#087F5B', fontWeight: '600' },
  trendLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  sectionHint: { fontSize: 12, color: '#756B62' },
  greenHint: { fontSize: 12, color: '#087F5B' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#181716' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wellnessNote: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 17, borderRadius: 20, backgroundColor: '#FFF1E9' },
  noteCopy: { flex: 1, gap: 4 },
  noteTitle: { fontSize: 14, fontWeight: '800', color: '#A35432' },
  noteText: { fontSize: 13, lineHeight: 19, color: '#4F3A2E' },
  reassurance: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 17, borderRadius: 22, backgroundColor: '#D8F4EA' },
  reassuranceTitle: { fontSize: 15, fontWeight: '800', color: '#087F5B' },
  reassuranceText: { fontSize: 12, color: '#28735D', marginTop: 3 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF', shadowColor: '#A8A0B4', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  scheduleIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  scheduleCopy: { flex: 1, gap: 4 },
  scheduleTitle: { fontSize: 14, fontWeight: '700', color: '#26221E' },
  scheduleDetail: { fontSize: 12, color: '#756B62' },
  scheduleTime: { fontSize: 13, color: '#756B62', fontWeight: '600' },
  connectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 },
  connectionHint: { fontSize: 11, color: '#8A8178' },
});
