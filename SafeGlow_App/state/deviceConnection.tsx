import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_TCP_PORT,
  DEFAULT_UDP_PORT,
  DEVICE_HOST_PLACEHOLDER,
  DEVICE_HOST_STORAGE_KEY,
  DEVICE_TCP_PORT_STORAGE_KEY,
  isValidLanHost,
  normalizeHost,
} from '@/transport/deviceConfig';
import { lanDeviceSession, type LanConnectionState } from '@/transport/lanDeviceSession';

type DeviceConnectionController = {
  host: string;
  tcpPort: number;
  udpPort: number;
  lanState: LanConnectionState;
  detail: string;
  ready: boolean;
  setHost: (host: string) => void;
  setTcpPort: (port: number) => void;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
};

const DeviceConnectionContext = createContext<DeviceConnectionController | null>(null);

export function DeviceConnectionProvider({ children }: { children: ReactNode }) {
  const [host, setHostState] = useState('');
  const [tcpPort, setTcpPortState] = useState(DEFAULT_TCP_PORT);
  const [lanState, setLanState] = useState<LanConnectionState>('idle');
  const [detail, setDetail] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [savedHost, savedPort] = await Promise.all([
          AsyncStorage.getItem(DEVICE_HOST_STORAGE_KEY),
          AsyncStorage.getItem(DEVICE_TCP_PORT_STORAGE_KEY),
        ]);
        if (cancelled) return;
        if (savedHost) setHostState(savedHost);
        if (savedPort) {
          const parsed = Number(savedPort);
          if (Number.isFinite(parsed) && parsed > 0) setTcpPortState(parsed);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => lanDeviceSession.subscribeState((state, message) => {
    setLanState(state);
    setDetail(message ?? '');
  }), []);

  useEffect(() => {
    if (!hydrated) return;
    lanDeviceSession.configure({ host, tcpPort, udpPort: DEFAULT_UDP_PORT });
    if (isValidLanHost(host)) {
      lanDeviceSession.connect(host, tcpPort);
    }
  }, [hydrated, host, tcpPort]);

  const setHost = useCallback((value: string) => {
    const next = normalizeHost(value);
    setHostState(next);
    void AsyncStorage.setItem(DEVICE_HOST_STORAGE_KEY, next);
  }, []);

  const setTcpPort = useCallback((port: number) => {
    const next = Number.isFinite(port) && port > 0 ? Math.floor(port) : DEFAULT_TCP_PORT;
    setTcpPortState(next);
    void AsyncStorage.setItem(DEVICE_TCP_PORT_STORAGE_KEY, String(next));
  }, []);

  const connect = useCallback(() => {
    lanDeviceSession.configure({ host, tcpPort, udpPort: DEFAULT_UDP_PORT });
    lanDeviceSession.connect(host, tcpPort);
  }, [host, tcpPort]);

  const disconnect = useCallback(() => {
    lanDeviceSession.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    lanDeviceSession.disconnect();
    lanDeviceSession.connect(host, tcpPort);
  }, [host, tcpPort]);

  const value = useMemo<DeviceConnectionController>(
    () => ({
      host: host || DEVICE_HOST_PLACEHOLDER,
      tcpPort,
      udpPort: DEFAULT_UDP_PORT,
      lanState,
      detail,
      ready: hydrated,
      setHost,
      setTcpPort,
      connect,
      disconnect,
      reconnect,
    }),
    [host, tcpPort, lanState, detail, hydrated, setHost, setTcpPort, connect, disconnect, reconnect],
  );

  return (
    <DeviceConnectionContext.Provider value={value}>{children}</DeviceConnectionContext.Provider>
  );
}

export function useDeviceConnection(): DeviceConnectionController {
  const controller = useContext(DeviceConnectionContext);
  if (!controller) {
    throw new Error('useDeviceConnection must be used inside DeviceConnectionProvider');
  }
  return controller;
}
