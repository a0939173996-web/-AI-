/**
 * @deprecated 假數據模擬器已停用。
 * 請改用 `lanDeviceSession`（區網 TCP:4211）接收實體 MR60BHA2 JSON 數據流。
 */
export type SimulationScenario = 'quiet' | 'movement' | 'inactivity';

type RawFrameListener = (raw: string) => void;

/** 保留空殼以免舊 import 崩潰；不再產生假數據。 */
export class SimulatedCribChannel {
  private listeners = new Set<RawFrameListener>();

  get isConnected() {
    return false;
  }

  connect() {
    // no-op — 模擬器已替換為區網實機連線
  }

  disconnect() {
    // no-op
  }

  subscribe(listener: RawFrameListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setScenario(_scenario: SimulationScenario) {
    // no-op
  }
}
