/**
 * SoftAP endpoint for SafeGlow_MR60BHA2 firmware.
 * Join Wi-Fi SSID / password, then talk to the fixed AP IP.
 */
export const SAFEGLOW_SOFTAP = {
  ssid: 'SafeGlow_Nightlight',
  password: '12345678',
  host: '192.168.4.1',
  udpPort: 4210,
  tcpPort: 4211,
} as const;
