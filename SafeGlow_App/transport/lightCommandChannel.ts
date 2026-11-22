export type LightCommand = {
  power: boolean;
  brightness_percent: number;
  color: string;
  breathing: boolean;
  /** true = 交由開發板雷達自動聯動（mode:auto） */
  smart_link?: boolean;
};

export type DeviceLightPayload =
  | { cmd: 'light'; mode: 'auto' }
  | {
      cmd: 'light';
      mode: 'manual';
      brightness: number;
      color: string;
      r?: number;
      g?: number;
      b?: number;
    };

type CommandListener = (command: LightCommand) => void;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

function namedColorForHex(hex: string): string {
  const upper = hex.trim().toUpperCase();
  if (upper === '#FF9F43') return 'warm_orange';
  if (upper === '#FFF4E6') return 'warm_white';
  if (upper === '#9B2226') return 'custom';
  return 'custom';
}

/** 將 App 夜燈指令編成開發板 TCP 一行 JSON */
export function encodeDeviceLightCommand(command: LightCommand): string {
  if (command.smart_link && command.power) {
    const payload: DeviceLightPayload = { cmd: 'light', mode: 'auto' };
    return JSON.stringify(payload);
  }

  if (!command.power || command.brightness_percent <= 0) {
    const payload: DeviceLightPayload = {
      cmd: 'light',
      mode: 'manual',
      brightness: 0,
      color: 'off',
    };
    return JSON.stringify(payload);
  }

  const rgb = hexToRgb(command.color);
  const payload: DeviceLightPayload = {
    cmd: 'light',
    mode: 'manual',
    brightness: clamp01(command.brightness_percent / 100),
    color: namedColorForHex(command.color),
    ...(rgb ?? {}),
  };
  return JSON.stringify(payload);
}

/**
 * @deprecated 僅保留型別相容；實際寫入請走 LanDeviceSession。
 * 假數據模擬器已停用。
 */
export class SimulatedLightChannel {
  private listeners = new Set<CommandListener>();

  subscribe(listener: CommandListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  write(command: LightCommand) {
    const delivered = { ...command };
    this.listeners.forEach((listener) => listener(delivered));
  }
}
