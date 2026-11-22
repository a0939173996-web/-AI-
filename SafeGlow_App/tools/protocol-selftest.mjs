/**
 * 協定自測：韌體 JSON ↔ App decode／夜燈指令編碼
 * 不連外網；可在 CI／本機執行。
 */
import assert from 'node:assert/strict';

const FIRMWARE_MOTION_MAP = {
  quiet: 'quiet',
  active: 'movement',
  absent: 'inactivity',
  movement: 'movement',
  inactivity: 'inactivity',
};

function decodeFrame(raw) {
  const parsed = JSON.parse(raw);
  const mapped = FIRMWARE_MOTION_MAP[parsed.sleep_motion_state];
  if (!mapped) return null;
  if (typeof parsed.device_status !== 'string') return null;
  if (typeof parsed.signal_quality_index !== 'number') return null;
  if (typeof parsed.breathing_rate_bpm !== 'number') return null;
  return {
    device_status: parsed.device_status,
    signal_quality_index: parsed.signal_quality_index,
    sleep_motion_state: mapped,
    breathing_rate_bpm: parsed.breathing_rate_bpm,
  };
}

function encodeDeviceLightCommand(command) {
  if (command.smart_link && command.power) {
    return JSON.stringify({ cmd: 'light', mode: 'auto' });
  }
  if (!command.power || command.brightness_percent <= 0) {
    return JSON.stringify({ cmd: 'light', mode: 'manual', brightness: 0, color: 'off' });
  }
  const hex = command.color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return JSON.stringify({
    cmd: 'light',
    mode: 'manual',
    brightness: command.brightness_percent / 100,
    color: 'custom',
    r,
    g,
    b,
  });
}

const quiet = decodeFrame(
  '{"device_status":"monitoring","signal_quality_index":95,"sleep_motion_state":"quiet","breathing_rate_bpm":14.2}',
);
assert.equal(quiet.sleep_motion_state, 'quiet');
assert.equal(quiet.breathing_rate_bpm, 14.2);

const active = decodeFrame(
  '{"device_status":"monitoring","signal_quality_index":35,"sleep_motion_state":"active","breathing_rate_bpm":0}',
);
assert.equal(active.sleep_motion_state, 'movement');

const absent = decodeFrame(
  '{"device_status":"monitoring","signal_quality_index":10,"sleep_motion_state":"absent","breathing_rate_bpm":0}',
);
assert.equal(absent.sleep_motion_state, 'inactivity');

const autoCmd = encodeDeviceLightCommand({
  power: true,
  brightness_percent: 40,
  color: '#FF9F43',
  breathing: true,
  smart_link: true,
});
assert.equal(autoCmd, '{"cmd":"light","mode":"auto"}');

const manualCmd = JSON.parse(
  encodeDeviceLightCommand({
    power: true,
    brightness_percent: 65,
    color: '#FF9F43',
    breathing: false,
    smart_link: false,
  }),
);
assert.equal(manualCmd.mode, 'manual');
assert.equal(manualCmd.brightness, 0.65);
assert.equal(manualCmd.r, 255);
assert.equal(manualCmd.g, 159);
assert.equal(manualCmd.b, 67);

const offCmd = JSON.parse(
  encodeDeviceLightCommand({
    power: false,
    brightness_percent: 50,
    color: '#FF9F43',
    breathing: false,
  }),
);
assert.equal(offCmd.color, 'off');
assert.equal(offCmd.brightness, 0);

console.log('protocol-selftest: ok');
