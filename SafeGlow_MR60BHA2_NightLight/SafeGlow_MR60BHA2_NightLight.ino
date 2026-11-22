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

static float clampf(float v, float lo, float hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
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
           "\"breathing_rate_bpm\":%.1f}",
           deviceStatus, g_signalQuality, motionStateToString(g_motionState),
           breathOut);
}

static void broadcastStatusJson() {
  char json[192];
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
  }

  const uint32_t now = millis();
  if ((now - g_lastBroadcastMs) >= BROADCAST_INTERVAL_MS) {
    g_lastBroadcastMs = now;
    broadcastStatusJson();
  }
}
