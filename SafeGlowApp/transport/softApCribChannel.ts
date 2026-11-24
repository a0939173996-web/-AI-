import { SAFEGLOW_SOFTAP } from './softApConfig';

type RawFrameListener = (raw: string) => void;

/**
 * TCP client for firmware status push on softAP (:4211).
 *
 * Expo web / managed Expo Go cannot open raw TCP sockets, so connect()
 * stays a no-op there until a native TCP module (prebuild) is added.
 * nurseryController falls back to SimulatedCribChannel when this channel
 * reports !isConnected after connect().
 */
export class SoftApCribChannel {
  private listeners = new Set<RawFrameListener>();
  private connected = false;
  private socket: { destroy?: () => void; write?: (data: string) => void } | null = null;
  private buffer = '';

  get isConnected() {
    return this.connected;
  }

  get endpoint() {
    return `${SAFEGLOW_SOFTAP.host}:${SAFEGLOW_SOFTAP.tcpPort}`;
  }

  connect() {
    // Placeholder for native TCP (react-native-tcp-socket / expo prebuild).
    // SoftAP join itself is done in the phone Wi-Fi settings.
    console.info(
      `[SafeGlow] softAP target ${this.endpoint} (SSID ${SAFEGLOW_SOFTAP.ssid}) — ` +
        'raw TCP requires a native build; using simulation fallback in Expo Go / web.',
    );
    this.connected = false;
  }

  disconnect() {
    this.socket?.destroy?.();
    this.socket = null;
    this.connected = false;
    this.buffer = '';
  }

  subscribe(listener: RawFrameListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Feed a raw TCP chunk (tests / future native socket onData). */
  ingestChunk(chunk: string) {
    this.buffer += chunk;
    let newline = this.buffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '').trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line.length > 0) {
        this.listeners.forEach((listener) => listener(line));
      }
      newline = this.buffer.indexOf('\n');
    }
  }
}
