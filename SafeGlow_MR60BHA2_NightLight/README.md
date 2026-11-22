# SafeGlow — MR60BHA2 板載夜燈韌體

給 **Seeed Studio MR60BHA2 60GHz 呼吸心跳套件**（XIAO ESP32C6 + 板載 1× WS2812）的 Arduino 韌體。  
**不接外接燈環**，直接驅動板載單顆 WS2812 模擬夜燈；區網 Local-First JSON 廣播，不連外網雲端。

## 功能摘要

| 模組 | 行為 |
| --- | --- |
| 60GHz 雷達 | `Seeed Arduino mmWave` 讀取呼吸率、呼吸相位、人體存在、多普勒體動 |
| 安靜微動 | 板載燈珠暖橘 `RGB(255,159,67)`，隨呼吸節奏柔和明暗 |
| 大幅體動（翻身） | 穩定柔和暖白，並**暫停**呼吸率更新／回報（防誤報） |
| 區網廣播 | 每秒 Serial + UDP 廣播 + TCP 推送中性 JSON |

### JSON 格式（去醫療化）

```json
{"device_status":"monitoring","signal_quality_index":95,"sleep_motion_state":"quiet","breathing_rate_bpm":14.2}
```

- `sleep_motion_state`：`absent` / `quiet` / `active`
- 大幅體動期間 `breathing_rate_bpm` 固定回報 `0`（暫停計算）
- 嚴禁 `apnea`、`alarm` 等字眼

## 硬體腳位

| 元件 | 腳位 |
| --- | --- |
| mmWave UART | XIAO ESP32C6 `HardwareSerial(0)`（板載已接好） |
| 板載 WS2812 | `D1`（GPIO1），GRB，1 顆 |

## Arduino IDE 設定

1. 安裝開發板：`esp32` by Espressif（選 **XIAO_ESP32C6**）
2. 函式庫（Library Manager）：
   - **Seeed Arduino mmWave**
   - **Adafruit NeoPixel**
3. 開啟 `SafeGlow_MR60BHA2_NightLight.ino`
4. 修改檔案頂部 Wi-Fi：

```cpp
static const char *WIFI_SSID = "YOUR_WIFI_SSID";
static const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";
```

5. 上傳後開啟 Serial Monitor（115200）

> 若人體偵測／目標資訊無資料，請將 MR60BHA2 模組韌體升級到支援 Human Detection 的版本（見 [Seeed Wiki](https://wiki.seeedstudio.com/getting_started_with_mr60bha2_mmwave_kit/)）。

## 區網收聽範例

- **UDP**：訂閱本機廣播埠 `4210`（目的為區網 `x.x.x.255`）
- **TCP**：連線至裝置 IP 埠 `4211`，每秒會收到一行 JSON

```bash
# 範例：用 socat 聽 UDP
socat - UDP-RECV:4210,reuseaddr
```

## 可調參數

| 常數 | 預設 | 說明 |
| --- | --- | --- |
| `LARGE_MOTION_SPEED_CMS` | 35 | 判定翻身／大幅體動（cm/s） |
| `QUIET_MOTION_SPEED_CMS` | 17 | 安靜微動上限（cm/s） |
| `ACTIVE_HOLD_MS` | 3000 | 體動後維持暖白＋暫停呼吸率的時間 |
| `UDP_PORT` / `TCP_PORT` | 4210 / 4211 | 區網埠號 |

速度換算：`|dop_index| * RANGE_STEP`，其中 `RANGE_STEP = 17.28`（函式庫定義）。
