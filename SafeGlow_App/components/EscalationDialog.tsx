import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type EscalationDialogProps = {
  visible: boolean;
  onAcknowledge: () => void;
};

export function EscalationDialog({ visible, onAcknowledge }: EscalationDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onAcknowledge}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>寶寶已靜止超過 10 秒</Text>
          <Text style={styles.body}>請前往確認寶寶的狀況</Text>
          <Pressable
            onPress={onAcknowledge}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            accessibilityRole="button">
            <Text style={styles.buttonLabel}>我知道了</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 42, 40, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#FFFDF9',
    gap: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2B2A28',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5E5850',
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#2F7D5B',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
