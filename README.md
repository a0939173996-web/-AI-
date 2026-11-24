# SafeGlow AI

Local-first nursery companion: MR60BHA2 night-light firmware + Expo phone app.

## Firmware (`SafeGlow_MR60BHA2/`)

XIAO ESP32C6 softAP hotspot:

- SSID / password: `SafeGlow_Nightlight` / `12345678`
- AP IP: `192.168.4.1`
- UDP status broadcast `:4210`, TCP status push `:4211`

See PR that lands the sketch under `SafeGlow_MR60BHA2/`.

## App (`SafeGlowApp/`)

Expo Router companion UI (Bolt export). Default transport is a local simulator.
Frame codec accepts firmware JSON (`quiet` / `active` / `absent`, nullable `breathing_rate_bpm`).

```bash
cd SafeGlowApp
npm install
npm run dev
```

Optional: `EXPO_PUBLIC_SAFEGLOW_TRANSPORT=softap` prefers the softAP TCP target (native TCP still requires a prebuild module; Expo Go / web keep using the simulator).
