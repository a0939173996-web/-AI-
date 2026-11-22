import type { SleepMotionState } from '@/transport/frameCodec';

export type LampColorKey = 'warm' | 'soft' | 'night';

export type LampColor = {
  key: LampColorKey;
  name: string;
  hint: string;
  hex: string;
};

export const LAMP_COLORS: readonly LampColor[] = [
  { key: 'warm', name: '暖橘光', hint: '溫柔日常', hex: '#FF9F43' },
  { key: 'soft', name: '柔白光', hint: '柔和均勻', hex: '#FFF4E6' },
  { key: 'night', name: '暗紅光', hint: '深夜夜巡', hex: '#9B2226' },
];

export const SMART_QUIET_BRIGHTNESS = 20;
export const SMART_MOVEMENT_BRIGHTNESS = 60;

export type NightlightSettings = {
  power: boolean;
  manualBrightness: number;
  colorKey: LampColorKey;
  smartLink: boolean;
};

export const DEFAULT_NIGHTLIGHT_SETTINGS: NightlightSettings = {
  power: true,
  manualBrightness: 50,
  colorKey: 'warm',
  smartLink: false,
};

export type EffectiveLight = {
  power: boolean;
  brightness: number;
  color: string;
  breathing: boolean;
};

export function colorFor(key: LampColorKey): LampColor {
  const match = LAMP_COLORS.find((lamp) => lamp.key === key);
  return match ?? LAMP_COLORS[0];
}

export function resolveEffectiveLight(
  settings: NightlightSettings,
  sleep: SleepMotionState | null,
): EffectiveLight {
  const color = colorFor(settings.colorKey).hex;

  if (!settings.power) {
    return { power: false, brightness: 0, color, breathing: false };
  }
  if (!settings.smartLink || sleep === null) {
    return { power: true, brightness: settings.manualBrightness, color, breathing: false };
  }
  if (sleep === 'movement') {
    return { power: true, brightness: SMART_MOVEMENT_BRIGHTNESS, color, breathing: false };
  }
  return {
    power: true,
    brightness: SMART_QUIET_BRIGHTNESS,
    color,
    breathing: sleep === 'quiet',
  };
}

export function describeLamp(settings: NightlightSettings, sleep: SleepMotionState | null): string {
  if (!settings.power) return '夜燈已關閉';
  if (!settings.smartLink) return '夜燈開啟中，由您手動調整';
  if (sleep === 'movement') return '寶寶翻身中，夜燈已溫和亮起';
  if (sleep === 'quiet') return '寶寶安穩睡眠中，夜燈緩慢呼吸調暗';
  if (sleep === 'inactivity') return '寶寶靜止中，夜燈維持低亮度';
  return '等待寶寶房的第一筆訊號';
}
