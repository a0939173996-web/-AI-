import { Platform } from 'react-native';
import {
  DEFAULT_TCP_PORT,
  DEFAULT_UDP_PORT,
  isValidLanHost,
  normalizeHost,
  type DeviceEndpoint,
} from './deviceConfig';
import { encodeDeviceLightCommand, type LightCommand } from './lightCommandChannel';

export type LanConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

type RawFrameListener = (raw: string) => void;
type StateListener = (state: LanConnectionState, detail?: string) => void;

type TcpSocketModule = {
  createConnection: (
    options: { port: number; host: string; reuseAddress?: boolean },
    callback?: () => void,
  ) => TcpSocketClient;
};

type TcpSocketClient = {
  write: (data: string | Uint8Array, encoding?: string) => void;
  destroy: () => void;
  on: (event: string, listener: (...args: any[]) => void) => void;
  off?: (event: string, listener: (...args: any[]) => void) => void;
};

function BufferLikeToString(data: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(data);
  }
  let out = '';
  for (let i = 0; i < data.length; i += 1) out += String.fromCharCode(data[i]!);
  return out;
}

function loadTcpSocket(): TcpSocketModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-tcp-socket') as TcpSocketModule;
  } catch {
    return null;
  }
}

/**
 * 區網 Local-First 連線：TCP:4211 收 JSON 數據流，並回寫夜燈指令。
 * 嚴禁外網／雲端。
 */
export class LanDeviceSession {
  private endpoint: DeviceEndpoint = {
    host: '',
    tcpPort: DEFAULT_TCP_PORT,
    udpPort: DEFAULT_UDP_PORT,
  };
  private client: TcpSocketClient | null = null;
  private buffer = '';
  private frameListeners = new Set<RawFrameListener>();
  private stateListeners = new Set<StateListener>();
  private connectionState: LanConnectionState = 'idle';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private lastError = '';

  get state() {
    return this.connectionState;
  }

  get errorDetail() {
    return this.lastError;
  }

  get isConnected() {
    return this.connectionState === 'connected';
  }

  get currentEndpoint(): DeviceEndpoint {
    return { ...this.endpoint };
  }

  configure(partial: Partial<DeviceEndpoint>) {
    if (partial.host !== undefined) this.endpoint.host = normalizeHost(partial.host);
    if (partial.tcpPort !== undefined) this.endpoint.tcpPort = partial.tcpPort;
    if (partial.udpPort !== undefined) this.endpoint.udpPort = partial.udpPort;
  }

  subscribeFrames(listener: RawFrameListener) {
    this.frameListeners.add(listener);
    return () => {
      this.frameListeners.delete(listener);
    };
  }

  subscribeState(listener: StateListener) {
    this.stateListeners.add(listener);
    listener(this.connectionState, this.lastError);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  connect(host?: string, tcpPort?: number) {
    if (host !== undefined) this.endpoint.host = normalizeHost(host);
    if (tcpPort !== undefined) this.endpoint.tcpPort = tcpPort;
    this.intentionalClose = false;
    this.openSocket();
  }

  disconnect() {
    this.intentionalClose = true;
    this.clearReconnect();
    this.teardownSocket();
    this.setState('idle');
  }

  /** 夜燈控制頁：亮度／顏色／電源 → 開發板 */
  writeLightCommand(command: LightCommand) {
    if (!this.client || this.connectionState !== 'connected') return false;
    const line = `${encodeDeviceLightCommand(command)}\n`;
    try {
      this.client.write(line);
      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : '寫入夜燈指令失敗';
      return false;
    }
  }

  private openSocket() {
    this.clearReconnect();
    this.teardownSocket();

    const host = this.endpoint.host;
    if (!isValidLanHost(host)) {
      this.lastError = `請填入開發板區網 IP（目前：${host || '空白'}）`;
      this.setState('error');
      return;
    }

    if (Platform.OS === 'web') {
      this.lastError =
        '瀏覽器無法建立原始 TCP 區網連線。請在同一熱點的 Android／iOS App（開發建置）使用。';
      this.setState('error');
      return;
    }

    const TcpSocket = loadTcpSocket();
    if (!TcpSocket) {
      this.lastError = '缺少 react-native-tcp-socket，請使用 expo prebuild／開發建置';
      this.setState('error');
      return;
    }

    this.setState('connecting');
    const port = this.endpoint.tcpPort || DEFAULT_TCP_PORT;

    try {
      const client = TcpSocket.createConnection({ port, host, reuseAddress: true }, () => {
        this.buffer = '';
        this.setState('connected');
      });

      client.on('data', (data: string | Uint8Array) => {
        const chunk =
          typeof data === 'string' ? data : BufferLikeToString(data);
        this.buffer += chunk;
        this.drainLines();
      });

      client.on('error', (error: Error) => {
        this.lastError = error?.message || 'TCP 連線錯誤';
        this.setState('error');
        this.scheduleReconnect();
      });

      client.on('close', () => {
        this.client = null;
        if (this.intentionalClose) {
          this.setState('idle');
          return;
        }
        this.lastError = '與開發板的 TCP 連線已中斷';
        this.setState('error');
        this.scheduleReconnect();
      });

      this.client = client;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : '無法建立 TCP 連線';
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  private drainLines() {
    while (true) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) break;
      const line = this.buffer.slice(0, newline).replace(/\r$/, '').trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      this.frameListeners.forEach((listener) => listener(line));
    }
  }

  private scheduleReconnect() {
    if (this.intentionalClose) return;
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      if (!this.intentionalClose) this.openSocket();
    }, 2500);
  }

  private clearReconnect() {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private teardownSocket() {
    if (!this.client) return;
    try {
      this.client.destroy();
    } catch {
      // ignore
    }
    this.client = null;
    this.buffer = '';
  }

  private setState(state: LanConnectionState) {
    this.connectionState = state;
    this.stateListeners.forEach((listener) => listener(state, this.lastError));
  }
}

/** App 單例：雷達串流與夜燈指令共用同一條 TCP */
export const lanDeviceSession = new LanDeviceSession();
