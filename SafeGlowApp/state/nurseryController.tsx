import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { decodeFrame } from '@/transport/frameCodec';
import { SimulatedCribChannel, type SimulationScenario } from '@/transport/simulatedCribChannel';
import { SoftApCribChannel } from '@/transport/softApCribChannel';
import { SAFEGLOW_SOFTAP } from '@/transport/softApConfig';
import { playEscalationFeedback } from '@/feedback/escalationFeedback';
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
  softAp: typeof SAFEGLOW_SOFTAP;
  reconnect: () => void;
  simulate: (scenario: SimulationScenario) => void;
  acknowledgePrompt: () => void;
};

const NurseryContext = createContext<NurseryController | null>(null);

const CLOCK_TICK_MS = 1000;
const USE_SOFTAP = process.env.EXPO_PUBLIC_SAFEGLOW_TRANSPORT === 'softap';

export function NurseryProvider({ children }: { children: ReactNode }) {
  const softApChannel = useMemo(() => new SoftApCribChannel(), []);
  const simChannel = useMemo(() => new SimulatedCribChannel(), []);
  const [state, setState] = useState<NurseryState>(INITIAL_NURSERY_STATE);
  const [now, setNow] = useState(() => Date.now());
  const activeSim = useRef(true);

  useEffect(() => {
    const onRaw = (raw: string) => {
      const frame = decodeFrame(raw);
      if (!frame) return;
      setState((previous) => applyFrame(previous, frame, Date.now()));
    };

    const unsubSoft = softApChannel.subscribe(onRaw);
    const unsubSim = simChannel.subscribe(onRaw);

    if (USE_SOFTAP) {
      softApChannel.connect();
      activeSim.current = !softApChannel.isConnected;
      if (activeSim.current) {
        simChannel.connect();
      }
    } else {
      activeSim.current = true;
      simChannel.connect();
    }

    return () => {
      unsubSoft();
      unsubSim();
      softApChannel.disconnect();
      simChannel.disconnect();
    };
  }, [softApChannel, simChannel]);

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
    setState((previous) => ({ ...previous, connection: 'reconnecting' }));
    softApChannel.disconnect();
    simChannel.disconnect();

    if (USE_SOFTAP) {
      softApChannel.connect();
      activeSim.current = !softApChannel.isConnected;
      if (activeSim.current) simChannel.connect();
    } else {
      activeSim.current = true;
      simChannel.connect();
    }
  }, [softApChannel, simChannel]);

  const simulate = useCallback(
    (scenario: SimulationScenario) => {
      setState((previous) => ({ ...previous, inactivitySince: null, promptAcknowledged: false }));
      if (!activeSim.current) {
        activeSim.current = true;
        softApChannel.disconnect();
        simChannel.connect();
      }
      simChannel.setScenario(scenario);
    },
    [simChannel, softApChannel],
  );

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
    softAp: SAFEGLOW_SOFTAP,
    reconnect,
    simulate,
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
