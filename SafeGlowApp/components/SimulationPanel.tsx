import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Activity, Moon, TimerReset } from 'lucide-react-native';
import type { SimulationScenario } from '@/transport/simulatedCribChannel';

type SimulationPanelProps = {
  onSimulate: (scenario: SimulationScenario) => void;
};

const SCENARIOS: { scenario: SimulationScenario; label: string; hint: string; Icon: typeof Moon }[] = [
  { scenario: 'quiet', label: '模擬安靜睡眠', hint: '回到平穩的微動節奏', Icon: Moon },
  { scenario: 'movement', label: '模擬翻身踢腳', hint: '觸發暫停觀察的門控', Icon: Activity },
  { scenario: 'inactivity', label: '模擬連續15秒無動作', hint: '先出現暖橘光，10 秒後顯示確認提示', Icon: TimerReset },
];

export function SimulationPanel({ onSimulate }: SimulationPanelProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>測試模擬</Text>
      <Text style={styles.caption}>點擊後，上方畫面會立即反映對應的寶寶狀態</Text>
      <View style={styles.list}>
        {SCENARIOS.map(({ scenario, label, hint, Icon }) => (
          <Pressable
            key={scenario}
            onPress={() => onSimulate(scenario)}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            accessibilityRole="button">
            <View style={styles.iconWrap}>
              <Icon size={18} color="#24513D" strokeWidth={2} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.buttonLabel}>{label}</Text>
              <Text style={styles.buttonHint}>{hint}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#EADFD2',
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2B2A28',
  },
  caption: {
    fontSize: 13,
    color: '#7A736B',
    marginTop: 4,
    marginBottom: 12,
  },
  list: {
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F4F8F6',
    borderWidth: 1,
    borderColor: '#D5E7DF',
  },
  buttonPressed: {
    backgroundColor: '#E6F1EC',
    transform: [{ scale: 0.99 }],
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#24513D',
  },
  buttonHint: {
    fontSize: 12,
    color: '#5E5850',
    marginTop: 2,
  },
});
