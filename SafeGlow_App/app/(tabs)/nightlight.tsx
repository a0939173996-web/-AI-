import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useState } from 'react';
import { Check, ChevronRight, Cloud, Heart, Moon, Sparkles, Sun, TimerReset } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { BrightnessSlider } from '@/components/nightlight/BrightnessSlider';
import { ColorSwatches } from '@/components/nightlight/ColorSwatches';
import { LampPreview } from '@/components/nightlight/LampPreview';
import { useNightlight } from '@/state/nightlightController';
import { useDeviceConnection } from '@/state/deviceConnection';

const SWITCH_COLORS = { false: '#D9D2C7', true: '#FF9F43' };
const QUICK_LEVELS = [10, 35, 70];

export default function NightlightScreen() {
  const { settings, effective, breathMs, caption, setPower, setBrightness, setColor, setSmartLink } = useNightlight();
  const { lanState } = useDeviceConnection();
  const sliderDisabled = !settings.power || settings.smartLink;
  const colorName = settings.colorKey === 'warm' ? '2200K 暖橘護眠光' : settings.colorKey === 'night' ? '暗紅夜巡光' : '柔白自然光';
  const onlineLabel = lanState === 'connected' ? '● 區網在線' : '○ 未連線';
  const onlineColor = lanState === 'connected' ? '#087F5B' : '#A35432';
  const [sleepTimer, setSleepTimer] = useState('45 分鐘');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [wakeEnabled, setWakeEnabled] = useState(true);
  const [sheet, setSheet] = useState<'timer' | 'wake' | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <AppHeader pageLabel="Nightlight" />

          <View style={styles.lightHeader}>
            <View style={styles.lightIdentity}>
              <View style={styles.iconBubble}><Sun size={22} color="#A35432" strokeWidth={2} /></View>
              <View><Text style={styles.lightTitle}>智慧陪伴夜燈 <Text style={[styles.online, { color: onlineColor }]}>{onlineLabel}</Text></Text><Text style={styles.lightSubtitle}>SafeGlow 區網直連 · MR60BHA2 板載夜燈</Text></View>
            </View>
            <Switch value={settings.power} onValueChange={setPower} trackColor={SWITCH_COLORS} thumbColor="#FFFFFF" accessibilityLabel="夜燈電源" />
          </View>

          <View style={styles.hero}>
            <View style={styles.heroVisual}>
              <LampPreview power={effective.power} brightness={effective.brightness} color={effective.color} breathing={effective.breathing} breathMs={breathMs} />
              <View style={styles.cloudIcon}><Cloud size={58} color="#9A520E" strokeWidth={2.2} /></View>
            </View>
            <View style={styles.temperatureBadge}><View style={styles.badgeDot} /><Text style={styles.temperatureText}>{colorName}</Text></View>
            <Text style={styles.heroTitle}>{settings.smartLink ? '夜間微風守護中' : '夜間微風守護中'}</Text>
            <Text style={styles.heroCaption}>{caption}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}><View style={styles.cardTitleRow}><Sparkles size={18} color="#A35432" strokeWidth={2} /><Text style={styles.cardTitle}>亮度微調</Text></View><Text style={styles.brightnessValue}>{effective.brightness}% <Text style={styles.brightnessHint}>適合夜間安穩不刺眼</Text></Text></View>
            <BrightnessSlider value={effective.brightness} disabled={sliderDisabled} onChange={setBrightness} />
            <View style={styles.quickRow}>{QUICK_LEVELS.map((level) => <QuickLevel key={level} level={level} active={effective.brightness === level} disabled={sliderDisabled} onPress={() => setBrightness(level)} />)}</View>
          </View>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>情境色溫選擇</Text><View style={styles.verified}><Check size={13} color="#087F5B" strokeWidth={2.5} /><Text style={styles.verifiedText}>有害藍光檢驗</Text></View></View>
          <ColorSwatches selected={settings.colorKey} onSelect={setColor} />
          <View style={styles.moodGrid}>
            <MoodCard icon={Moon} title="暖橘琥珀光" detail="2200K 護眼深度助眠" color="#FFE0BD" iconColor="#A35432" />
            <MoodCard icon={Sun} title="柔洞象牙白" detail="4000K 溫潤自然純淨" color="#DCE8FF" iconColor="#2B5797" />
            <MoodCard icon={Heart} title="脈動安撫光" detail="模擬母親懷抱心跳韻律" color="#FBE0D0" iconColor="#A35432" />
            <MoodCard icon={Sparkles} title="星空微光" detail="靜謐螢夜草葉雅境" color="#DCE8FF" iconColor="#2B5797" />
          </View>

          <View style={styles.smartCard}>
            <View style={styles.smartHeader}><View style={styles.smartTitleWrap}><View style={styles.smartPill}><Sparkles size={12} color="#087F5B" strokeWidth={2.5} /><Text style={styles.smartPillText}>AI 智慧聯動</Text></View><Text style={styles.smartTitle}>呼吸脈動自動調光</Text></View><Switch value={settings.smartLink} onValueChange={setSmartLink} trackColor={SWITCH_COLORS} thumbColor="#FFFFFF" accessibilityLabel="AI 智慧聯動呼吸脈動自動調光" /></View>
            <Text style={styles.smartBody}>當感測到寶寶側睡到寶寶進入【安靜睡眠】時，夜燈將自動緩慢調暗至 20% 微光；當偵測到寶寶【體動轉醒】時，自動以無藍光暖橘柔和亮起，陪伴安撫情緒，不打擾全家睡眠。</Text>
            <View style={styles.smartFooter}><Check size={15} color="#087F5B" strokeWidth={2.5} /><Text style={styles.smartFooterText}>守護模式已就緒 · 即時感應連線中</Text></View>
          </View>

          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>定時與晨光排程</Text></View>
          <View style={styles.scheduleGrid}>
            <Pressable onPress={() => setSheet('timer')} style={({ pressed }) => [styles.smallSchedule, pressed && styles.schedulePressed]} accessibilityRole="button">
              <View style={styles.scheduleIcon}><TimerReset size={18} color="#A35432" strokeWidth={2} /></View>
              <View style={styles.scheduleCopy}><Text style={styles.scheduleTitle}>自動定時關閉</Text><Text style={styles.scheduleDetail}>{sleepTimer === '關閉' ? '目前不自動關閉' : `已設 ${sleepTimer}`}</Text></View><ChevronRight size={16} color="#A35432" />
            </Pressable>
            <Pressable onPress={() => setSheet('wake')} style={({ pressed }) => [styles.smallSchedule, pressed && styles.schedulePressed]} accessibilityRole="button">
              <View style={[styles.scheduleIcon, !wakeEnabled && styles.scheduleDisabled]}><Sun size={18} color="#A35432" strokeWidth={2} /></View>
              <View style={styles.scheduleCopy}><Text style={styles.scheduleTitle}>日出漸亮喚醒</Text><Text style={styles.scheduleDetail}>{wakeEnabled ? `${wakeTime} 晨光` : '目前已關閉'}</Text></View><ChevronRight size={16} color="#A35432" />
            </Pressable>
          </View>
          <ScheduleSheet type={sheet} sleepTimer={sleepTimer} wakeTime={wakeTime} wakeEnabled={wakeEnabled} onClose={() => setSheet(null)} onTimerChange={(value) => { setSleepTimer(value); setSheet(null); }} onWakeChange={(value) => { setWakeTime(value); setWakeEnabled(true); setSheet(null); }} onWakeToggle={() => setWakeEnabled((value) => !value)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickLevel({ level, active, disabled, onPress }: { level: number; active: boolean; disabled: boolean; onPress: () => void }) {
  return <Text onPress={disabled ? undefined : onPress} style={[styles.quickButton, active && styles.quickButtonActive, disabled && styles.quickDisabled]}>{level}%{level === 10 ? ' 微光' : level === 35 ? ' 安撫睡眠' : ' 暖乳光'}</Text>;
}

function MoodCard({ icon: Icon, title, detail, color, iconColor }: { icon: typeof Moon; title: string; detail: string; color: string; iconColor: string }) {
  return <View style={styles.moodCard}><View style={[styles.moodIcon, { backgroundColor: color }]}><Icon size={20} color={iconColor} strokeWidth={2} /></View><Text style={styles.moodTitle}>{title}</Text><Text style={styles.moodDetail}>{detail}</Text></View>;
}

function ScheduleSheet({ type, sleepTimer, wakeTime, wakeEnabled, onClose, onTimerChange, onWakeChange, onWakeToggle }: { type: 'timer' | 'wake' | null; sleepTimer: string; wakeTime: string; wakeEnabled: boolean; onClose: () => void; onTimerChange: (value: string) => void; onWakeChange: (value: string) => void; onWakeToggle: () => void }) {
  const timerOptions = ['關閉', '15 分鐘', '30 分鐘', '45 分鐘', '60 分鐘'];
  const wakeOptions = ['06:30', '07:00', '07:30', '08:00'];
  return <Modal visible={type !== null} transparent animationType="slide" onRequestClose={onClose}><View style={styles.sheetBackdrop}><View style={styles.sheet}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{type === 'timer' ? '自動定時關閉' : '日出漸亮喚醒'}</Text><Pressable onPress={onClose}><Text style={styles.sheetClose}>關閉</Text></Pressable></View>{type === 'timer' ? timerOptions.map((option) => <Pressable key={option} onPress={() => onTimerChange(option)} style={styles.optionRow}><Text style={styles.optionText}>{option}</Text>{sleepTimer === option && <Check size={18} color="#FF9F43" />}</Pressable>) : <><View style={styles.wakeToggleRow}><View><Text style={styles.optionText}>喚醒功能</Text><Text style={styles.optionHint}>天亮前逐漸調亮夜燈</Text></View><Switch value={wakeEnabled} onValueChange={onWakeToggle} trackColor={SWITCH_COLORS} thumbColor="#FFFFFF" /></View>{wakeOptions.map((option) => <Pressable key={option} onPress={() => onWakeChange(option)} style={styles.optionRow}><Text style={styles.optionText}>{option} 晨光</Text>{wakeTime === option && wakeEnabled && <Check size={18} color="#FF9F43" />}</Pressable>)}</>}</View></View></Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8FF' },
  content: { paddingHorizontal: 22, paddingTop: 15, paddingBottom: 42, alignItems: 'center' },
  column: { width: '100%', maxWidth: 480, gap: 16 },
  lightHeader: { padding: 15, borderRadius: 27, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, shadowColor: '#D5BBA1', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  lightIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconBubble: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFE6CF', alignItems: 'center', justifyContent: 'center' },
  lightTitle: { fontSize: 16, fontWeight: '800', color: '#181716' },
  online: { fontSize: 11, color: '#087F5B' },
  lightSubtitle: { fontSize: 12, color: '#756B62', marginTop: 3 },
  hero: { alignItems: 'center', paddingVertical: 22, borderRadius: 27, backgroundColor: '#EEF2FF', gap: 6 },
  heroVisual: { width: 230, height: 190, alignItems: 'center', justifyContent: 'center' },
  cloudIcon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  temperatureBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFFFFF' },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#A35432' },
  temperatureText: { fontSize: 12, color: '#8B4C18', fontWeight: '600' },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#181716', marginTop: 5 },
  heroCaption: { fontSize: 13, color: '#4F3A2E' },
  card: { padding: 18, borderRadius: 25, backgroundColor: '#FFFFFF', gap: 12, shadowColor: '#A8A0B4', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#26221E' },
  brightnessValue: { fontSize: 21, color: '#A35432', fontWeight: '700' },
  brightnessHint: { fontSize: 10, color: '#756B62', fontWeight: '400' },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickButton: { flex: 1, textAlign: 'center', paddingVertical: 13, borderRadius: 23, backgroundColor: '#E5EDFF', color: '#26221E', fontSize: 14, fontWeight: '700' },
  quickButtonActive: { backgroundColor: '#FF9F43', color: '#FFFFFF' },
  quickDisabled: { opacity: 0.45 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#181716' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: 11, color: '#087F5B', fontWeight: '600' },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moodCard: { width: '48%', minHeight: 105, padding: 14, borderRadius: 22, backgroundColor: '#FFFFFF', gap: 5, shadowColor: '#A8A0B4', shadowOpacity: 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  moodIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  moodTitle: { fontSize: 14, fontWeight: '800', color: '#26221E' },
  moodDetail: { fontSize: 12, color: '#756B62' },
  smartCard: { padding: 18, borderRadius: 25, backgroundColor: '#EEF4FF', gap: 13 },
  smartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  smartTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  smartPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, backgroundColor: '#D4F4E8' },
  smartPillText: { fontSize: 11, color: '#087F5B', fontWeight: '700' },
  smartTitle: { fontSize: 14, fontWeight: '800', color: '#26221E' },
  smartBody: { fontSize: 13, lineHeight: 22, color: '#403831' },
  smartFooter: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  smartFooterText: { fontSize: 12, color: '#4F625A' },
  scheduleGrid: { flexDirection: 'row', gap: 10 },
  smallSchedule: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 20, backgroundColor: '#FFFFFF' },
  schedulePressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  scheduleCopy: { flex: 1, gap: 3 },
  scheduleDisabled: { opacity: 0.45 },
  scheduleIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFE0BD', alignItems: 'center', justifyContent: 'center' },
  scheduleTitle: { fontSize: 12, fontWeight: '700', color: '#26221E' },
  scheduleDetail: { fontSize: 12, color: '#756B62', marginTop: 3 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24, 23, 22, 0.35)' },
  sheet: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFFDF9', gap: 4 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#D9D2C7', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#181716' },
  sheetClose: { fontSize: 13, color: '#A35432', fontWeight: '700' },
  optionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F0E5D8' },
  optionText: { fontSize: 15, fontWeight: '600', color: '#26221E' },
  optionHint: { fontSize: 12, color: '#756B62', marginTop: 4 },
  wakeToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F0E5D8', marginBottom: 3 },
});
