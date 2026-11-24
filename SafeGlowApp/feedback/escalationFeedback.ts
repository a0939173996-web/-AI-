import { Platform, Vibration } from 'react-native';

const HUM_NOTES_HZ = [110, 164.81];
const FADE_IN_S = 2.5;
const HOLD_S = 1.5;
const FADE_OUT_S = 2.5;
const PEAK_GAIN = 0.1;

type WebAudioWindow = Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };

export function playEscalationFeedback() {
  if (Platform.OS === 'web') {
    vibrateOnWeb();
    playLowHumOnWeb();
  } else {
    Vibration.vibrate([0, 400, 300, 400]);
  }
}

function vibrateOnWeb() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([400, 300, 400]);
  }
}

function playLowHumOnWeb() {
  const win = globalThis as unknown as WebAudioWindow;
  const AudioCtor = win.AudioContext ?? win.webkitAudioContext;
  if (!AudioCtor) return;

  const context = new AudioCtor();
  const start = context.currentTime;
  const duration = FADE_IN_S + HOLD_S + FADE_OUT_S;

  HUM_NOTES_HZ.forEach((frequency) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, start + FADE_IN_S);
    gain.gain.setValueAtTime(PEAK_GAIN, start + FADE_IN_S + HOLD_S);
    gain.gain.linearRampToValueAtTime(0, start + duration);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  });

  setTimeout(() => void context.close(), duration * 1000 + 200);
}
