/**
 * SafeGlow AI — MR60BHA2 板載夜燈韌體
 *
 * 硬體：Seeed Studio MR60BHA2 60GHz 呼吸心跳套件
 *        （XIAO ESP32C6 + 板載 1 顆 WS2812 RGB LED @ D1）
 *
 * 依賴函式庫（Arduino Library Manager）：
 *   - Seeed Arduino mmWave
 *   - Adafruit NeoPixel
 *
 * 開發板設定：
 *   Board: XIAO_ESP32C6
 *   USB CDC On Boot: Enabled（建議）
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <math.h>

#include <Adafruit_NeoPixel.h>
#include "Seeed_Arduino_mmWave.h"

// ---------------------------------------------------------------------------
// 使用者設定（請改成家裡的 Wi-Fi；僅連區網，不連外網雲端）
// ---------------------------------------------------------------------------
static const char *WIFI_SSID = "YOUR_WIFI_SSID";
static const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";

static const uint16_t UDP_PORT = 4210;   // UDP 廣播埠
static const uint16_t TCP_PORT = 4211;   // TCP 狀態伺服器埠
static const uint32_t BROADCAST_INTERVAL_MS = 1000;

// 體動速度門檻（cm/s）。翻身等大幅體動通常遠高於此值。
// 速度 = |dop_index| * RANGE_STEP（RANGE_STEP = 17.28）
static const float LARGE_MOTION_SPEED_CMS = 35.0f;  // ~2 Doppler bins
static const float QUIET_MOTION_SPEED_CMS = 17.0f;  // ~1 Doppler bin

// 大幅體動後，短暫鎖定「active」狀態，避免抖動
static const uint32_t ACTIVE_HOLD_MS = 3000;

// ---------------------------------------------------------------------------
// 硬體：雷達 UART + 板載 WS2812
// ---------------------------------------------------------------------------
#ifdef ESP32
#include <HardwareSerial.h>
HardwareSerial mmWaveSerial(0);  // XIAO ESP32C6 板載 UART0 ↔ mmWave
#else
#define mmWaveSerial Serial1
#endif

SEEED_MR60BHA2 mmWave;

// 板載單顆 WS2812：資料腳 D1（GPIO1），GRB 順序
static const uint8_t LED_PIN = D1;
static const uint16_t LED_COUNT = 1;
Adafruit_NeoPixel pixel(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

// 暖橘（安靜呼吸脈動）/ 柔和暖白（大幅體動）
static const uint8_t WARM_ORANGE_R = 255;
static const uint8_t WARM_ORANGE_G = 159;
static const uint8_t WARM_ORANGE_B = 67;

static const uint8_t WARM_WHITE_R = 255;
static const uint8_t WARM_WHITE_G = 220;
static const uint8_t WARM_WHITE_B = 180;

// ---------------------------------------------------------------------------
// 區網廣播
// ---------------------------------------------------------------------------
WiFiUDP udp;
WiFiServer tcpServer(TCP_PORT);
WiFiClient tcpClients[4];

// ---------------------------------------------------------------------------
// 執行時狀態（去醫療化用語）
// ---------------------------------------------------------------------------
enum class SleepMotionState : uint8_t {
  Absent = 0,
  Quiet,
  Active,
};

enum class LightMode : uint8_t { Auto = 0, Manual };

static SleepMotionState g_motionState = SleepMotionState::Absent;
static bool g_humanPresent = false;
static float g_breathRateBpm = 0.0f;
static float g_lastValidBreathBpm = 0.0f;
static float g_breathPhase = 0.0f;  // 優先用雷達相位；否則用時間合成
static bool g_breathPhaseValid = false;
static bool g_pauseBreathRate = false;
static float g_moveSpeedCms = 0.0f;
static float g_distanceM = -1.0f;
static int g_signalQuality = 0;
static uint32_t g_activeUntilMs = 0;
static uint32_t g_lastBroadcastMs = 0;
static uint32_t g_lastPresenceMs = 0;
static uint32_t g_bootMs = 0;

// 夜燈遠端控制（TCP 指令；預設 auto 跟隨雷達）
static LightMode g_lightMode = LightMode::Auto;
static float g_manualBrightness = 0.55f;  // 0..1
static uint8_t g_manualR = WARM_ORANGE_R;
static uint8_t g_manualG = WARM_ORANGE_G;
static uint8_t g_manualB = WARM_ORANGE_B;
static char g_manualColorName[24] = "warm_orange";
static char g_tcpLineBuf[4][256];
static size_t g_tcpLineLen[4] = {0, 0, 0, 0};

// isHumanDetected() 為「有新幀才有效」的一次性讀取；用逾時推斷離場
static const uint32_t PRESENCE_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// 工具函式
// ---------------------------------------------------------------------------
static const char *motionStateToString(SleepMotionState s) {
  switch (s) {
    case SleepMotionState::Quiet:
      return "quiet";
    case SleepMotionState::Active:
      return "active";
    default:
      return "absent";
  }
}

static const char *lightModeToString(LightMode m) {
  return (m == LightMode::Manual) ? "manual" : "auto";
}

static float clampf(float v, float lo, float hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

static bool extractJsonString(const char *json, const char *key, char *out,
                              size_t outLen) {
  char pattern[48];
  snprintf(pattern, sizeof(pattern), "\"%s\"", key);
  const char *p = strstr(json, pattern);
  if (!p) return false;
  p = strchr(p + strlen(pattern), ':');
  if (!p) return false;
  p++;
  while (*p == ' ' || *p == '\t') p++;
  if (*p != '"') return false;
  p++;
  size_t i = 0;
  while (*p && *p != '"' && i + 1 < outLen) {
    out[i++] = *p++;
  }
  out[i] = '\0';
  return i > 0;
}

static bool extractJsonNumber(const char *json, const char *key, float *out) {
  char pattern[48];
  snprintf(pattern, sizeof(pattern), "\"%s\"", key);
  const char *p = strstr(json, pattern);
  if (!p) return false;
  p = strchr(p + strlen(pattern), ':');
  if (!p) return false;
  p++;
  while (*p == ' ' || *p == '\t') p++;
  char *end = nullptr;
  const float v = strtof(p, &end);
  if (end == p) return false;
  *out = v;
  return true;
}

static void applyNamedColor(const char *name) {
  if (strcmp(name, "warm_white") == 0) {
    g_manualR = WARM_WHITE_R;
    g_manualG = WARM_WHITE_G;
    g_manualB = WARM_WHITE_B;
    strncpy(g_manualColorName, "warm_white", sizeof(g_manualColorName) - 1);
  } else if (strcmp(name, "soft_amber") == 0) {
    g_manualR = 255;
    g_manualG = 191;
    g_manualB = 105;
    strncpy(g_manualColorName, "soft_amber", sizeof(g_manualColorName) - 1);
  } else if (strcmp(name, "off") == 0) {
    g_manualBrightness = 0.0f;
    strncpy(g_manualColorName, "off", sizeof(g_manualColorName) - 1);
  } else {
    // 預設／warm_orange
    g_manualR = WARM_ORANGE_R;
    g_manualG = WARM_ORANGE_G;
    g_manualB = WARM_ORANGE_B;
    strncpy(g_manualColorName, "warm_orange", sizeof(g_manualColorName) - 1);
  }
  g_manualColorName[sizeof(g_manualColorName) - 1] = '\0';
}

static void handleControlCommand(const char *line) {
  // 協定（一行一筆 JSON，區網 TCP）：
  // {"cmd":"light","mode":"manual","brightness":0.65,"color":"warm_orange"}
  // {"cmd":"light","mode":"manual","brightness":0.5,"r":255,"g":159,"b":67}
  // {"cmd":"light","mode":"auto"}
  char cmd[24] = {0};
  if (!extractJsonString(line, "cmd", cmd, sizeof(cmd))) {
    return;
  }
  if (strcmp(cmd, "light") != 0) {
    return;
  }

  char mode[16] = {0};
  if (extractJsonString(line, "mode", mode, sizeof(mode))) {
    if (strcmp(mode, "auto") == 0) {
      g_lightMode = LightMode::Auto;
      Serial.println(F("[light] mode=auto"));
      return;
    }
    if (strcmp(mode, "manual") == 0) {
      g_lightMode = LightMode::Manual;
    }
  } else {
    g_lightMode = LightMode::Manual;
  }

  float brightness = g_manualBrightness;
  if (extractJsonNumber(line, "brightness", &brightness)) {
    g_manualBrightness = clampf(brightness, 0.0f, 1.0f);
  }

  char color[24] = {0};
  if (extractJsonString(line, "color", color, sizeof(color))) {
    applyNamedColor(color);
  }

  float r = -1, g = -1, b = -1;
  const bool hasR = extractJsonNumber(line, "r", &r);
  const bool hasG = extractJsonNumber(line, "g", &g);
  const bool hasB = extractJsonNumber(line, "b", &b);
  if (hasR && hasG && hasB) {
    g_manualR = static_cast<uint8_t>(constrain(lroundf(r), 0, 255));
    g_manualG = static_cast<uint8_t>(constrain(lroundf(g), 0, 255));
    g_manualB = static_cast<uint8_t>(constrain(lroundf(b), 0, 255));
    snprintf(g_manualColorName, sizeof(g_manualColorName), "custom");
  }

  Serial.printf("[light] mode=manual brightness=%.2f rgb=(%u,%u,%u) color=%s\n",
                g_manualBrightness, g_manualR, g_manualG, g_manualB,
                g_manualColorName);
}

static void pollTcpCommands() {
  for (size_t i = 0; i < (sizeof(tcpClients) / sizeof(tcpClients[0])); i++) {
    if (!tcpClients[i] || !tcpClients[i].connected()) {
      g_tcpLineLen[i] = 0;
      continue;
    }
    while (tcpClients[i].available() > 0) {
      const char c = static_cast<char>(tcpClients[i].read());
      if (c == '\r') {
        continue;
      }
      if (c == '\n') {
        g_tcpLineBuf[i][g_tcpLineLen[i]] = '\0';
        if (g_tcpLineLen[i] > 0) {
          handleControlCommand(g_tcpLineBuf[i]);
        }
        g_tcpLineLen[i] = 0;
        continue;
      }
      if (g_tcpLineLen[i] + 1 < sizeof(g_tcpLineBuf[i])) {
        g_tcpLineBuf[i][g_tcpLineLen[i]++] = c;
      } else {
        g_tcpLineLen[i] = 0;  // 溢位：丟棄此行
      }
    }
  }
}

static uint8_t scaleChannel(uint8_t base, float brightness) {
  if (brightness < 0.0f) brightness = 0.0f;
  if (brightness > 1.0f) brightness = 1.0f;
  return static_cast<uint8_t>(lroundf(base * brightness));
}

static void setPixelRgb(uint8_t r, uint8_t g, uint8_t b, float brightness) {
  pixel.setPixelColor(0, pixel.Color(scaleChannel(r, brightness),
                                     scaleChannel(g, brightness),
                                     scaleChannel(b, brightness)));
  pixel.show();
}

/**
 * 信號品質指數（0–100）：以存在偵測、距離、呼吸率有效性合成，
 * 僅供區網夜燈／環境感知使用，非臨床指標。
 */
static int computeSignalQuality(bool human, bool breathOk, float distanceM,
                                float moveSpeedAbs) {
  int score = 0;
  if (human) score += 45;
  if (breathOk && !g_pauseBreathRate) score += 35;
  if (distanceM > 0.2f && distanceM <= 1.5f) {
    score += 15;
  } else if (distanceM > 1.5f && distanceM <= 3.0f) {
    score += 8;
  }
  if (moveSpeedAbs < QUIET_MOTION_SPEED_CMS) {
    score += 5;
  }
  return constrain(score, 0, 100);
}

static void connectWiFiLocalFirst() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.printf("[wifi] connecting to local AP \"%s\" ...\n", WIFI_SSID);
  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < 20000) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] connected  ip=%s  rssi=%d\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    udp.begin(UDP_PORT);
    tcpServer.begin();
    tcpServer.setNoDelay(true);
    Serial.printf("[net] UDP broadcast :%u  TCP server :%u\n", UDP_PORT,
                  TCP_PORT);
  } else {
    Serial.println(
        "[wifi] not connected — Serial JSON still runs; retry in loop");
  }
}

static void acceptTcpClients() {
  // ESP32 Arduino：available() 回傳新連線客戶端
  WiFiClient incoming = tcpServer.available();
  if (!incoming) {
    return;
  }
  for (size_t i = 0; i < (sizeof(tcpClients) / sizeof(tcpClients[0])); i++) {
    if (!tcpClients[i] || !tcpClients[i].connected()) {
      tcpClients[i] = incoming;
      Serial.printf("[tcp] client slot %u from %s\n", static_cast<unsigned>(i),
                    tcpClients[i].remoteIP().toString().c_str());
      return;
    }
  }
  incoming.println("{\"device_status\":\"busy\"}");
  incoming.stop();
}

static void buildStatusJson(char *buf, size_t buflen) {
  // 嚴禁醫療警示用語；僅中性環境狀態
  const char *deviceStatus =
      (WiFi.status() == WL_CONNECTED) ? "monitoring" : "local_only";

  // 大幅體動期間暫停回報即時呼吸率（輸出上次安靜時的穩定值，或 0）
  float breathOut = 0.0f;
  if (!g_pauseBreathRate && g_lastValidBreathBpm > 0.0f) {
    breathOut = g_lastValidBreathBpm;
  } else if (g_pauseBreathRate) {
    breathOut = 0.0f;  // 暫停計算／回報，避免體動誤報
  }

  snprintf(buf, buflen,
           "{\"device_status\":\"%s\","
           "\"signal_quality_index\":%d,"
           "\"sleep_motion_state\":\"%s\","
           "\"breathing_rate_bpm\":%.1f,"
           "\"light_mode\":\"%s\","
           "\"brightness\":%.2f,"
           "\"color\":\"%s\","
           "\"rgb\":[%u,%u,%u]}",
           deviceStatus, g_signalQuality, motionStateToString(g_motionState),
           breathOut, lightModeToString(g_lightMode),
           (g_lightMode == LightMode::Manual) ? g_manualBrightness : -1.0f,
           (g_lightMode == LightMode::Manual) ? g_manualColorName : "auto",
           (g_lightMode == LightMode::Manual) ? g_manualR : 0,
           (g_lightMode == LightMode::Manual) ? g_manualG : 0,
           (g_lightMode == LightMode::Manual) ? g_manualB : 0);
}

static void broadcastStatusJson() {
  char json[320];
  buildStatusJson(json, sizeof(json));

  // 1) 序列埠
  Serial.println(json);

  // 2) UDP 區網廣播（Local-First）
  if (WiFi.status() == WL_CONNECTED) {
    IPAddress bcast = WiFi.localIP();
    bcast[3] = 255;
    udp.beginPacket(bcast, UDP_PORT);
    udp.write(reinterpret_cast<const uint8_t *>(json), strlen(json));
    udp.endPacket();

    // 3) TCP：推給已連線的本機客戶端
    acceptTcpClients();
    for (size_t i = 0; i < (sizeof(tcpClients) / sizeof(tcpClients[0])); i++) {
      if (tcpClients[i] && tcpClients[i].connected()) {
        tcpClients[i].println(json);
      }
    }
  }
}

static void updateNightLight() {
  const uint32_t now = millis();

  // 遠端手動覆寫：亮度滑桿／顏色按鈕優先於雷達聯動
  if (g_lightMode == LightMode::Manual) {
    if (g_manualBrightness <= 0.001f || strcmp(g_manualColorName, "off") == 0) {
      pixel.clear();
      pixel.show();
    } else {
      setPixelRgb(g_manualR, g_manualG, g_manualB, g_manualBrightness);
    }
    return;
  }

  if (g_motionState == SleepMotionState::Absent) {
    pixel.clear();
    pixel.show();
    return;
  }

  if (g_motionState == SleepMotionState::Active || g_pauseBreathRate) {
    // 大幅體動：穩定柔和暖白
    setPixelRgb(WARM_WHITE_R, WARM_WHITE_G, WARM_WHITE_B, 0.55f);
    return;
  }

  // 安靜：暖橘 + 隨呼吸節奏柔和明暗
  float periodSec = 4.0f;  // 預設 ~15 bpm
  if (g_lastValidBreathBpm >= 6.0f && g_lastValidBreathBpm <= 40.0f) {
    periodSec = 60.0f / g_lastValidBreathBpm;
  }

  float phase01;
  if (g_breathPhaseValid) {
    // breath_phase 為雷達相位；映射到 0..1 脈動
    phase01 = 0.5f + 0.5f * sinf(g_breathPhase);
  } else {
    const float t = (now - g_bootMs) / 1000.0f;
    phase01 = 0.5f + 0.5f * sinf((2.0f * PI * t) / periodSec);
  }

  // 亮度落在約 18%–70%，避免刺眼
  const float brightness = 0.18f + 0.52f * clampf(phase01, 0.0f, 1.0f);
  setPixelRgb(WARM_ORANGE_R, WARM_ORANGE_G, WARM_ORANGE_B, brightness);
}

static float maxAbsMoveSpeedCms(const PeopleCounting &info) {
  float maxAbs = 0.0f;
  for (size_t i = 0; i < info.targets.size(); i++) {
    const float speed = fabsf(info.targets[i].dop_index * RANGE_STEP);
    if (speed > maxAbs) {
      maxAbs = speed;
    }
  }
  return maxAbs;
}

static void notePresence(uint32_t now) {
  g_lastPresenceMs = now;
  g_humanPresent = true;
}

static void ingestRadarSample() {
  const uint32_t now = millis();

  // --- 人體存在（官方 API 為有新幀才回傳；true = 有人）---
  if (mmWave.isHumanDetected()) {
    notePresence(now);
  }

  // --- 目標多普勒 → 體動速度 ---
  PeopleCounting targetInfo;
  const bool gotTargets = mmWave.getPeopleCountingTargetInfo(targetInfo);
  if (gotTargets) {
    g_moveSpeedCms = maxAbsMoveSpeedCms(targetInfo);
    if (!targetInfo.targets.empty()) {
      notePresence(now);
    } else {
      g_moveSpeedCms = 0.0f;
    }
  }

  // --- 距離（輔助信號品質與存在判斷）---
  float distanceM = 0.0f;
  const bool gotDistance = mmWave.getDistance(distanceM);
  if (gotDistance) {
    g_distanceM = distanceM;
    // 官方說明：回傳非 0 表示偵測範圍內有生命跡象
    if (distanceM > 0.05f) {
      notePresence(now);
    }
  }

  // --- 呼吸相位（驅動燈珠脈動）---
  float totalPhase = 0.0f, breathPhase = 0.0f, heartPhase = 0.0f;
  if (mmWave.getHeartBreathPhases(totalPhase, breathPhase, heartPhase)) {
    g_breathPhase = breathPhase;
    g_breathPhaseValid = true;
    notePresence(now);
  }

  // --- 呼吸頻率：大幅體動時暫停更新 ---
  float breathRate = 0.0f;
  const bool gotBreath = mmWave.getBreathRate(breathRate);
  if (gotBreath && breathRate > 0.0f) {
    notePresence(now);
  }

  // 逾時無任何存在跡象 → absent
  if (g_lastPresenceMs == 0 ||
      (now - g_lastPresenceMs) > PRESENCE_TIMEOUT_MS) {
    g_humanPresent = false;
  }

  const bool largeMotion = (g_moveSpeedCms >= LARGE_MOTION_SPEED_CMS);
  if (largeMotion && g_humanPresent) {
    g_activeUntilMs = now + ACTIVE_HOLD_MS;
    g_pauseBreathRate = true;
  }

  if (g_humanPresent && now < g_activeUntilMs) {
    g_pauseBreathRate = true;
    g_motionState = SleepMotionState::Active;
  } else if (!g_humanPresent) {
    g_pauseBreathRate = false;
    g_motionState = SleepMotionState::Absent;
    g_breathPhaseValid = false;
    g_moveSpeedCms = 0.0f;
  } else {
    // 安靜微動／平穩狀態（含門檻間過渡）
    g_pauseBreathRate = false;
    g_motionState = SleepMotionState::Quiet;
  }

  if (!g_pauseBreathRate && gotBreath && breathRate > 0.0f) {
    // 合理範圍過濾，避免毛刺
    if (breathRate >= 6.0f && breathRate <= 40.0f) {
      g_breathRateBpm = breathRate;
      g_lastValidBreathBpm = breathRate;
    }
  }

  const bool breathOk =
      (!g_pauseBreathRate && g_lastValidBreathBpm >= 6.0f &&
       g_lastValidBreathBpm <= 40.0f);
  g_signalQuality = computeSignalQuality(g_humanPresent, breathOk, g_distanceM,
                                         g_moveSpeedCms);
}

// ---------------------------------------------------------------------------
// Arduino 進入點
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(800);
  g_bootMs = millis();

  Serial.println();
  Serial.println(F("SafeGlow MR60BHA2 onboard night-light"));
  Serial.println(F("Local-First — no cloud uplink"));

  pixel.begin();
  pixel.setBrightness(255);
  pixel.clear();
  pixel.show();

  // 開機自檢：短暫暖橘閃爍
  setPixelRgb(WARM_ORANGE_R, WARM_ORANGE_G, WARM_ORANGE_B, 0.4f);
  delay(200);
  pixel.clear();
  pixel.show();

  mmWave.begin(&mmWaveSerial);
  Serial.println(F("[radar] MR60BHA2 UART ready"));

  connectWiFiLocalFirst();
  g_lastBroadcastMs = millis();
}

void loop() {
  // 持續抽雷達幀（timeout 100 ms，與官方範例一致）
  if (mmWave.update(100)) {
    ingestRadarSample();
  }

  updateNightLight();

  // Wi-Fi 斷線時偶爾重試（不阻塞雷達）
  static uint32_t lastWifiAttemptMs = 0;
  if (WiFi.status() != WL_CONNECTED &&
      (millis() - lastWifiAttemptMs) > 15000) {
    lastWifiAttemptMs = millis();
    Serial.println(F("[wifi] retry..."));
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASS);
  }

  if (WiFi.status() == WL_CONNECTED) {
    acceptTcpClients();
    pollTcpCommands();
  }

  const uint32_t now = millis();
  if ((now - g_lastBroadcastMs) >= BROADCAST_INTERVAL_MS) {
    g_lastBroadcastMs = now;
    broadcastStatusJson();
  }
}
