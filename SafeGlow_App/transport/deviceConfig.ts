/** Local-First 區網裝置設定 — 不連外網雲端 */

export const DEFAULT_TCP_PORT = 4211;
export const DEFAULT_UDP_PORT = 4210;

export const DEVICE_HOST_STORAGE_KEY = 'safeglow.device.host';
export const DEVICE_TCP_PORT_STORAGE_KEY = 'safeglow.device.tcpPort';

/** 請改成 Serial／路由器上看到的開發板區網 IP */
export const DEVICE_HOST_PLACEHOLDER = '192.168.x.x';

export type DeviceEndpoint = {
  host: string;
  tcpPort: number;
  udpPort: number;
};

export function normalizeHost(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, '').split('/')[0] ?? '';
}

export function isValidLanHost(host: string): boolean {
  const value = normalizeHost(host);
  if (!value || value.includes(DEVICE_HOST_PLACEHOLDER)) return false;
  // 允許 IPv4 或區網 hostname（如 esp32.local）
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return value.split('.').every((part) => {
      const n = Number(part);
      return n >= 0 && n <= 255;
    });
  }
  return /^[a-z0-9.-]+$/i.test(value);
}
