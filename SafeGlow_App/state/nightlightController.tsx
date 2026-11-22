import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LightCommand } from '@/transport/lightCommandChannel';
import { lanDeviceSession } from '@/transport/lanDeviceSession';
import { throttle } from '@/utils/throttle';
import { displayedMotionRate } from './nurseryStateMachine';
import { useNursery } from './nurseryController';
import {
  DEFAULT_NIGHTLIGHT_SETTINGS,
  describeLamp,
  resolveEffectiveLight,
  type EffectiveLight,
  type LampColorKey,
  type NightlightSettings,
} from './nightlightStateMachine';

const LIGHT_WRITE_INTERVAL_MS = 200;
const DEFAULT_BREATH_MS = 2100;
const BREATH_STEP_MS = 250;

type NightlightController = {
  settings: NightlightSettings;
  effective: EffectiveLight;
  breathMs: number;
  caption: string;
  confirmed: LightCommand | null;
  setPower: (power: boolean) => void;
  setBrightness: (percent: number) => void;
  setColor: (key: LampColorKey) => void;
  setSmartLink: (enabled: boolean) => void;
};

const NightlightContext = createContext<NightlightController | null>(null);

export function NightlightProvider({ children }: { children: ReactNode }) {
  const { state: nursery } = useNursery();
  const sleep = nursery.frame?.sleep_motion_state ?? null;
  const motionRate = displayedMotionRate(nursery);

  const [settings, setSettings] = useState<NightlightSettings>(DEFAULT_NIGHTLIGHT_SETTINGS);
  const [confirmed, setConfirmed] = useState<LightCommand | null>(null);

  const sendThrottled = useMemo(
    () =>
      throttle((command: LightCommand) => {
        const ok = lanDeviceSession.writeLightCommand(command);
        if (ok) setConfirmed(command);
      }, LIGHT_WRITE_INTERVAL_MS),
    [],
  );

  const effective = resolveEffectiveLight(settings, sleep);

  useEffect(() => {
    sendThrottled({
      power: effective.power,
      brightness_percent: effective.brightness,
      color: effective.color,
      breathing: effective.breathing,
      smart_link: settings.smartLink,
    });
  }, [
    effective.power,
    effective.brightness,
    effective.color,
    effective.breathing,
    settings.smartLink,
    sendThrottled,
  ]);

  const breathMs = motionRate
    ? Math.round(60000 / motionRate / BREATH_STEP_MS) * BREATH_STEP_MS
    : DEFAULT_BREATH_MS;

  const value: NightlightController = {
    settings,
    effective,
    breathMs,
    caption: describeLamp(settings, sleep),
    confirmed,
    setPower: (power) => setSettings((previous) => ({ ...previous, power })),
    setBrightness: (percent) =>
      setSettings((previous) => ({ ...previous, manualBrightness: percent })),
    setColor: (colorKey) => setSettings((previous) => ({ ...previous, colorKey })),
    setSmartLink: (smartLink) => setSettings((previous) => ({ ...previous, smartLink })),
  };

  return <NightlightContext.Provider value={value}>{children}</NightlightContext.Provider>;
}

export function useNightlight(): NightlightController {
  const controller = useContext(NightlightContext);
  if (!controller) {
    throw new Error('useNightlight must be used inside NightlightProvider');
  }
  return controller;
}
