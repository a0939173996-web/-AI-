import type { NurseryFrame } from '@/transport/frameCodec';

export type ConnectionStatus = 'connected' | 'reconnecting';
export type EscalationLevel = 0 | 1 | 2;

export type NurseryState = {
  connection: ConnectionStatus;
  frame: NurseryFrame | null;
  paused: boolean;
  inactivitySince: number | null;
  promptAcknowledged: boolean;
};

export const INITIAL_NURSERY_STATE: NurseryState = {
  connection: 'connected',
  frame: null,
  paused: false,
  inactivitySince: null,
  promptAcknowledged: false,
};

const PROMPT_AFTER_MS = 10000;
const MOVEMENT_SIGNAL_THRESHOLD = 40;

export function applyFrame(state: NurseryState, frame: NurseryFrame, now: number): NurseryState {
  const isMoving = frame.sleep_motion_state === 'movement';
  const isInactive = frame.sleep_motion_state === 'inactivity';

  return {
    connection: 'connected',
    frame,
    paused: isMoving && frame.signal_quality_index < MOVEMENT_SIGNAL_THRESHOLD,
    inactivitySince: isInactive ? (state.inactivitySince ?? now) : null,
    promptAcknowledged: isInactive ? state.promptAcknowledged : false,
  };
}

export function escalationLevelAt(state: NurseryState, now: number): EscalationLevel {
  if (state.inactivitySince === null) return 0;
  return now - state.inactivitySince > PROMPT_AFTER_MS ? 2 : 1;
}

export function shouldShowPrompt(state: NurseryState, level: EscalationLevel): boolean {
  return level === 2 && !state.promptAcknowledged;
}

export function displayedMotionRate(state: NurseryState): number | null {
  if (!state.frame || state.paused) return null;
  if (state.frame.breathing_rate_bpm <= 0) return null;
  return state.frame.breathing_rate_bpm;
}

export function describeNursery(state: NurseryState, level: EscalationLevel) {
  if (state.connection === 'reconnecting') {
    return {
      title: '重新連線中',
      detail: '請確認手機已加入 SafeGlow_Nightlight，並連向 192.168.4.1',
    };
  }
  if (!state.frame) {
    return { title: '等待資料', detail: '正在接收寶寶房裝置的第一筆訊號' };
  }
  if (state.paused) {
    return { title: '寶寶翻身中，暫停觀察', detail: '訊號暫時受動作影響，穩定後會自動恢復' };
  }
  if (level === 2) {
    return { title: '寶寶已靜止超過 10 秒', detail: '請前往確認寶寶的狀況' };
  }
  if (level === 1) {
    return { title: '觀察到持續靜止...', detail: '畫面以溫和的暖橘光持續留意' };
  }
  return { title: '安穩睡眠中', detail: '寶寶目前狀態平穩' };
}

export function pillLabelFor(state: NurseryState): { label: string; tone: 'ready' | 'paused' | 'reconnecting' } {
  if (state.connection === 'reconnecting') return { label: '重新連線中', tone: 'reconnecting' };
  if (state.paused) return { label: '寶寶翻身中，暫停觀察', tone: 'paused' };
  return { label: 'SoftAP 區網監護中', tone: 'ready' };
}
