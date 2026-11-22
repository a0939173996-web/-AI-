import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Cable, Radio, RefreshCw } from 'lucide-react-native';
import { DEVICE_HOST_PLACEHOLDER } from '@/transport/deviceConfig';
import { useDeviceConnection } from '@/state/deviceConnection';

const STATE_LABEL: Record<string, string> = {
  idle: '尚未連線',
  connecting: '連線中…',
  connected: '區網已連線',
  error: '連線失敗',
};

export function DeviceConnectionPanel() {
  const { host, tcpPort, udpPort, lanState, detail, setHost, setTcpPort, connect, reconnect } =
    useDeviceConnection();
  const displayHost = host === DEVICE_HOST_PLACEHOLDER ? '' : host;

  return (
    <View style={styles.panel}>
      <View style={styles.headingRow}>
        <Radio size={18} color="#24513D" strokeWidth={2} />
        <Text style={styles.heading}>實體開發板區網連線</Text>
      </View>
      <Text style={styles.caption}>
        Local-First：僅連 MR60BHA2 的 TCP {tcpPort}／UDP {udpPort}，不連外網雲端。
      </Text>

      <Text style={styles.label}>開發板 IP</Text>
      <TextInput
        value={displayHost}
        onChangeText={setHost}
        placeholder={DEVICE_HOST_PLACEHOLDER}
        placeholderTextColor="#A89F94"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        style={styles.input}
        accessibilityLabel="開發板區網 IP"
      />

      <Text style={styles.label}>TCP 埠</Text>
      <TextInput
        value={String(tcpPort)}
        onChangeText={(text) => setTcpPort(Number(text.replace(/[^\d]/g, '') || 4211))}
        keyboardType="number-pad"
        style={styles.input}
        accessibilityLabel="TCP 通訊埠"
      />

      <View style={styles.statusRow}>
        <View
          style={[
            styles.dot,
            lanState === 'connected'
              ? styles.dotOk
              : lanState === 'connecting'
                ? styles.dotWait
                : styles.dotBad,
          ]}
        />
        <Text style={styles.statusText}>{STATE_LABEL[lanState] ?? lanState}</Text>
      </View>
      {!!detail && lanState !== 'connected' ? <Text style={styles.detail}>{detail}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          onPress={connect}
          style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
          accessibilityRole="button">
          <Cable size={16} color="#FFFFFF" strokeWidth={2.2} />
          <Text style={styles.primaryText}>連線開發板</Text>
        </Pressable>
        <Pressable
          onPress={reconnect}
          style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button">
          <RefreshCw size={16} color="#24513D" strokeWidth={2.2} />
          <Text style={styles.secondaryText}>重新連線</Text>
        </Pressable>
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
    gap: 8,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2B2A28',
  },
  caption: {
    fontSize: 13,
    color: '#7A736B',
    lineHeight: 18,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5E5850',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0D6C9',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2B2A28',
    backgroundColor: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOk: { backgroundColor: '#2F7D5B' },
  dotWait: { backgroundColor: '#C9852C' },
  dotBad: { backgroundColor: '#A35432' },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#24513D',
  },
  detail: {
    fontSize: 12,
    color: '#7A3E12',
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primary: {
    backgroundColor: '#24513D',
  },
  secondary: {
    backgroundColor: '#E6F1EC',
    borderWidth: 1,
    borderColor: '#B7D8CA',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryText: {
    color: '#24513D',
    fontWeight: '700',
    fontSize: 14,
  },
});
