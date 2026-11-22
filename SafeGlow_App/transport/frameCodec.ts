export type SleepMotionState = 'quiet' | 'movement' | 'inactivity';

export type NurseryFrame = {
  device_status: string;
  signal_quality_index: number;
  sleep_motion_state: SleepMotionState;
  breathing_rate_bpm: number;
};

const APP_MOTION_STATES: readonly SleepMotionState[] = ['quiet', 'movement', 'inactivity'];

/** 韌體 sleep_motion_state → App 內部狀態 */
const FIRMWARE_MOTION_MAP: Record<string, SleepMotionState> = {
  quiet: 'quiet',
  active: 'movement',
  absent: 'inactivity',
  // 相容舊模擬器／舊字串
  movement: 'movement',
  inactivity: 'inactivity',
};

export function mapFirmwareMotionState(raw: unknown): SleepMotionState | null {
  if (typeof raw !== 'string') return null;
  return FIRMWARE_MOTION_MAP[raw] ?? null;
}

export function encodeFrame(frame: NurseryFrame): string {
  return JSON.stringify(frame);
}

export function decodeFrame(raw: string): NurseryFrame | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const candidate = parsed as Record<string, unknown>;
  const { device_status, signal_quality_index, sleep_motion_state, breathing_rate_bpm } = candidate;

  if (typeof device_status !== 'string') return null;
  if (typeof signal_quality_index !== 'number' || !Number.isFinite(signal_quality_index)) return null;
  if (typeof breathing_rate_bpm !== 'number' || !Number.isFinite(breathing_rate_bpm)) return null;

  const mapped = mapFirmwareMotionState(sleep_motion_state);
  if (!mapped || !APP_MOTION_STATES.includes(mapped)) return null;

  return {
    device_status,
    signal_quality_index,
    sleep_motion_state: mapped,
    breathing_rate_bpm,
  };
}
