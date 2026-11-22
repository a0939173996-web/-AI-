import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { decodeFrame } from '@/transport/frameCodec';
import { lanDeviceSession } from '@/transport/lanDeviceSession';
import { playEscalationFeedback } from '@/feedback/escalationFeedback';
import { useDeviceConnection } from './deviceConnection';
import {
  INITIAL_NURSERY_STATE,
  applyFrame,
  describeNursery,
  displayedMotionRate,
  escalationLevelAt,
  pillLabelFor,
  shouldShowPrompt,
  type EscalationLevel,
  type NurseryState,
} from './nurseryStateMachine';

type NurseryController = {
  state: NurseryState;
  level: EscalationLevel;
  motionRate: number | null;
  copy: { title: string; detail: string };
  pill: ReturnType<typeof pillLabelFor>;
  showPrompt: boolean;
  reconnect: () => void;
  acknowledgePrompt: () => void;
};

const NurseryContext = createContext<NurseryController | null>(null);

const CLOCK_TICK_MS = 1000;

export function NurseryProvider({ children }: { children: ReactNode }) {
  const { reconnect: reconnectDevice, lanState } = useDeviceConnection();
  const [state, setState] = useState<NurseryState>(INITIAL_NURSERY_STATE);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const unsubscribe = lanDeviceSession.subscribeFrames((raw) => {
      const frame = decodeFrame(raw);
      if (!frame) return;
      setState((previous) => applyFrame(previous, frame, Date.now()));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (lanState === 'connected') return;
    setState((previous) => ({ ...previous, connection: 'reconnecting', frame: null }));
  }, [lanState]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const level = escalationLevelAt(state, now);

  const previousLevelRef = useRef<EscalationLevel>(0);
  useEffect(() => {
    if (level === 2 && previousLevelRef.current < 2) {
      playEscalationFeedback();
    }
    previousLevelRef.current = level;
  }, [level]);

  const reconnect = useCallback(() => {
    setState((previous) => ({ ...previous, connection: 'reconnecting', frame: null }));
    reconnectDevice();
  }, [reconnectDevice]);

  const acknowledgePrompt = useCallback(() => {
    setState((previous) => ({ ...previous, promptAcknowledged: true }));
  }, []);

  const value: NurseryController = {
    state,
    level,
    motionRate: displayedMotionRate(state),
    copy: describeNursery(state, level),
    pill: pillLabelFor(state),
    showPrompt: shouldShowPrompt(state, level),
    reconnect,
    acknowledgePrompt,
  };

  return <NurseryContext.Provider value={value}>{children}</NurseryContext.Provider>;
}

export function useNursery(): NurseryController {
  const controller = useContext(NurseryContext);
  if (!controller) {
    throw new Error('useNursery must be used inside NurseryProvider');
  }
  return controller;
}
