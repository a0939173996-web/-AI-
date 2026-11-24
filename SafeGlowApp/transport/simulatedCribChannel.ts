import { encodeFrame, type NurseryFrame, type SleepMotionState } from './frameCodec';

export type SimulationScenario = SleepMotionState;

type RawFrameListener = (raw: string) => void;

const FRAME_INTERVAL_MS = 3000;
const BASE_BPM = 28.5;
const BPM_SWING = 0.5;
const BPM_PERIOD_FRAMES = 6;

export class SimulatedCribChannel {
  private listeners = new Set<RawFrameListener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private scenario: SimulationScenario = 'quiet';
  private frameCount = 0;

  get isConnected() {
    return this.timer !== null;
  }

  connect() {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.emit(), FRAME_INTERVAL_MS);
    this.emit();
  }

  disconnect() {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  subscribe(listener: RawFrameListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setScenario(scenario: SimulationScenario) {
    this.scenario = scenario;
    if (this.isConnected) this.emit();
  }

  private emit() {
    this.frameCount += 1;
    const frame = this.buildFrame();
    const raw = encodeFrame(frame);
    this.listeners.forEach((listener) => listener(raw));
  }

  private buildFrame(): NurseryFrame {
    const phase = (this.frameCount % BPM_PERIOD_FRAMES) / BPM_PERIOD_FRAMES;
    const wave = Math.sin(phase * Math.PI * 2) * BPM_SWING;

    switch (this.scenario) {
      case 'movement':
        return {
          device_status: 'monitoring',
          signal_quality_index: 35,
          sleep_motion_state: 'movement',
          breathing_rate_bpm: BASE_BPM,
        };
      case 'inactivity':
        return {
          device_status: 'monitoring',
          signal_quality_index: 90,
          sleep_motion_state: 'inactivity',
          breathing_rate_bpm: 0.0,
        };
      case 'quiet':
      default:
        return {
          device_status: 'monitoring',
          signal_quality_index: 95,
          sleep_motion_state: 'quiet',
          breathing_rate_bpm: Number((BASE_BPM + wave).toFixed(1)),
        };
    }
  }
}
