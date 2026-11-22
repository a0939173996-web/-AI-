# SafeGlow Local App

Expo（React Native）陪伴 App：**區網 Local-First** 直連 Seeed MR60BHA2（ESP32-C6）開發板。  
假數據模擬器已停用；雷達 JSON 來自 TCP `4211`，夜燈亮度／顏色指令回寫同一條 TCP。

## 連線方式

1. 手機開熱點，開發板已連上並取得 `192.168.x.x`
2. 本機執行 `npx expo run:android`（或 iOS）— 需開發建置以使用 TCP socket  
   （純瀏覽器／Expo Go 無法開原始 TCP）
3. Dashboard 底部「實體開發板區網連線」填入開發板 IP、TCP 埠 `4211`
4. 連線成功後，主畫面顯示實機 JSON；夜燈頁滑桿／色票會下發指令

### 夜燈指令（App → 板）

```json
{"cmd":"light","mode":"manual","brightness":0.65,"color":"warm_orange","r":255,"g":159,"b":67}
{"cmd":"light","mode":"auto"}
```

- 手動亮度／顏色 → `mode:manual`
- 「AI 智慧聯動」開啟 → `mode:auto`（交由韌體雷達聯動）

### 狀態串流（板 → App）

```json
{"device_status":"monitoring","signal_quality_index":95,"sleep_motion_state":"quiet","breathing_rate_bpm":14.2}
```

韌體 `active`／`absent` 會對應 App 的 `movement`／`inactivity`。

## 指令

```bash
npm install
npm run typecheck
npm run test:protocol
npm run mock-device   # 本機假 TCP 裝置，僅驗證協定
EXPO_NO_TELEMETRY=1 npx expo start
```

## Local-First 約束

- 不連外網雲端（已移除 Supabase 依賴）
- 資料只在手機 ↔ 開發板區網流動
- UDP `4210` 為韌體廣播埠（App 目前以 TCP 為主通道）
