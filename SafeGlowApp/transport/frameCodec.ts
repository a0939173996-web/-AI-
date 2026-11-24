/**
 * Wire format matches SafeGlow_MR60BHA2 JSON status frames.
 *
 * Firmware emits sleep_motion_state: quiet | active | absent
 * and breathing_rate_bpm as a number or null.
 * Product UI maps those to quiet | movement | inactivity.
 */

export type SleepMotionState = 'quiet' | 'movement' | 'inactivity';

export type NurseryFrame = {
  device_status: string;
  signal_quality_index: number;
  sleep_motion_state: SleepMotionState;
  breathing_rate_bpm: number;
};

const PRODUCT_STATES: readonly SleepMotionState[] = ['quiet', 'movement', 'inactivity'];

/** Firmware vocabulary → product vocabulary */
function normalizeMotionState(raw: unknown): SleepMotionState | null {
  if (typeof raw !== 'string') return null;
  switch (raw) {
    case 'quiet':
      return 'quiet';
    case 'active':
    case 'movement':
      return 'movement';
    case 'absent':
    case 'inactivity':
      return 'inactivity';
    default:
      return null;
  }
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

  const motion = normalizeMotionState(sleep_motion_state);
  if (motion === null || !PRODUCT_STATES.includes(motion)) return null;

  // Firmware sends null while large motion freezes breath updates.
  let bpm = 0;
  if (typeof breathing_rate_bpm === 'number' && Number.isFinite(breathing_rate_bpm)) {
    bpm = breathing_rate_bpm;
  } else if (breathing_rate_bpm !== null && breathing_rate_bpm !== undefined) {
    return null;
  }

  return {
    device_status,
    signal_quality_index,
    sleep_motion_state: motion,
    breathing_rate_bpm: bpm,
  };
}
