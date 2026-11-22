/**
 * SafeGlow AI — MR60BHA2 night-light firmware
 *
 * Hardware: Seeed Studio MR60BHA2 kit (XIAO ESP32C6 + onboard WS2812)
 * Libraries: Seeed Arduino mmWave, Adafruit NeoPixel
 *
 * Behaviour
 *  - Host a local Wi-Fi softAP for phone / tablet clients
 *  - Read breath rate + presence / micromotion from the 60 GHz module
 *  - Quiet micromotion  → warm-orange LED with breath-synced soft pulse
 *  - Large body motion  → soft warm-white LED; freeze breath-rate updates
 *  - Every second: Serial + LAN UDP broadcast + TCP push of neutral JSON
 *    (no clinical / alert vocabulary)
 *
 * Board: Tools → Board → XIAO_ESP32C6
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <math.h>

#include <Adafruit_NeoPixel.h>
#include "Seeed_Arduino_mmWave.h"

#include "config.h"

// ---------------------------------------------------------------------------
// mmWave UART — XIAO ESP32C6 uses HardwareSerial(0) to the MR60BHA2 module
// ---------------------------------------------------------------------------
#ifdef ESP32
#include <HardwareSerial.h>
HardwareSerial mmWaveSerial(0);
#else
#define mmWaveSerial Serial1
#endif

SEEED_MR60BHA2 mmWave;
Adafruit_NeoPixel pixels(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

WiFiUDP udp;
WiFiServer tcpServer(SAFEGLOW_TCP_PORT);

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static const int MAX_TCP_CLIENTS = 4;
static WiFiClient tcpClients[MAX_TCP_CLIENTS];
static bool g_apReady = false;

// ---------------------------------------------------------------------------
// Runtime state (LAN-facing fields stay deliberately neutral)
// ---------------------------------------------------------------------------
enum class MotionState : uint8_t {
  Absent = 0,
  Quiet,
  Active,
};

static MotionState g_motion = MotionState::Absent;
static bool g_humanPresent = false;
static float g_breathBpm = 0.0f;
static bool g_breathValid = false;
static bool g_breathPaused = false;       // true while large motion freezes updates
static float g_frozenBreathBpm = 0.0f;    // last good rate before pause
static float g_moveSpeedCmS = 0.0f;
static float g_distanceM = 0.0f;
static bool g_distanceValid = false;
static uint8_t g_signalQuality = 0;

static uint32_t g_lastLargeMotionMs = 0;
static uint32_t g_lastBroadcastMs = 0;
static uint32_t g_pulseEpochMs = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
static const char* motionStateToString(MotionState s) {
  switch (s) {
    case MotionState::Quiet:
      return "quiet";
    case MotionState::Active:
      return "active";
    case MotionState::Absent:
    default:
      return "absent";
  }
}

static uint8_t scaleChannel(uint8_t base, float envelope) {
  float v = static_cast<float>(base) * envelope;
  if (v < 0.0f) {
    v = 0.0f;
  }
  if (v > 255.0f) {
    v = 255.0f;
  }
  return static_cast<uint8_t>(v + 0.5f);
}

static void setLedRgb(uint8_t r, uint8_t g, uint8_t b) {
  pixels.setPixelColor(0, pixels.Color(r, g, b));
  pixels.show();
}

static void ledOff() {
  pixels.clear();
  pixels.show();
}

/**
 * Quiet mode: warm orange whose brightness follows a sine envelope at the
 * measured (or fallback) breathing cadence. One full inhale–exhale ≈ one sine.
 */
static void updateQuietBreathPulse() {
  const float bpm =
      (g_breathValid && g_breathBpm > 0.5f) ? g_breathBpm : DEFAULT_BREATH_BPM;
  const float periodMs = (60.0f / bpm) * 1000.0f;
  const float phase =
      fmodf(static_cast<float>(millis() - g_pulseEpochMs), periodMs) / periodMs;
  // 0.5 + 0.5*sin → 0..1, then remap to [MIN, MAX]
  const float wave = 0.5f + 0.5f * sinf(phase * 2.0f * static_cast<float>(M_PI));
  const float envelope =
      PULSE_BRIGHTNESS_MIN +
      (PULSE_BRIGHTNESS_MAX - PULSE_BRIGHTNESS_MIN) * wave;

  setLedRgb(scaleChannel(COLOR_QUIET_R, envelope),
            scaleChannel(COLOR_QUIET_G, envelope),
            scaleChannel(COLOR_QUIET_B, envelope));
}

static void updateActiveWarmWhite() {
  const float scale = COLOR_ACTIVE_BRIGHTNESS / 255.0f;
  setLedRgb(scaleChannel(COLOR_ACTIVE_R, scale),
            scaleChannel(COLOR_ACTIVE_G, scale),
            scaleChannel(COLOR_ACTIVE_B, scale));
}

static void updateNightLight() {
  switch (g_motion) {
    case MotionState::Quiet:
      updateQuietBreathPulse();
      break;
    case MotionState::Active:
      updateActiveWarmWhite();
      break;
    case MotionState::Absent:
    default:
      ledOff();
      break;
  }
}

/**
 * Build a 0–100 signal_quality_index from presence, range, and breath validity.
 * Purely engineering telemetry — not a clinical score.
 */
static uint8_t computeSignalQuality() {
  int score = 0;

  if (g_humanPresent) {
    score += 40;
  }

  if (g_distanceValid) {
    // Breath / micro-motion band is strongest inside ~1.5 m
    if (g_distanceM > 0.2f && g_distanceM <= 1.5f) {
      score += 35;
    } else if (g_distanceM > 1.5f && g_distanceM <= 3.0f) {
      score += 20;
    } else if (g_distanceM > 0.0f) {
      score += 10;
    }
  }

  if (!g_breathPaused && g_breathValid && g_breathBpm > 0.5f) {
    score += 25;
  } else if (g_breathPaused && g_frozenBreathBpm > 0.5f) {
    score += 10;  // rate frozen; still some prior confidence
  }

  if (score < 0) {
    score = 0;
  }
  if (score > 100) {
    score = 100;
  }
  return static_cast<uint8_t>(score);
}

/**
 * Compose the Local-First status JSON.
 * breathing_rate_bpm is null while large motion freezes updates, or when no rate.
 */
static size_t buildStatusJson(char* buf, size_t buflen) {
  const char* deviceStatus =
      (g_motion == MotionState::Absent) ? "idle" : "monitoring";
  const char* motion = motionStateToString(g_motion);

  if (g_breathPaused || !g_breathValid || g_breathBpm <= 0.0f) {
    return snprintf(buf, buflen,
                    "{\"device_status\":\"%s\",\"signal_quality_index\":%u,"
                    "\"sleep_motion_state\":\"%s\",\"breathing_rate_bpm\":null}",
                    deviceStatus, static_cast<unsigned>(g_signalQuality),
                    motion);
  }

  return snprintf(buf, buflen,
                  "{\"device_status\":\"%s\",\"signal_quality_index\":%u,"
                  "\"sleep_motion_state\":\"%s\",\"breathing_rate_bpm\":%.1f}",
                  deviceStatus, static_cast<unsigned>(g_signalQuality), motion,
                  g_breathBpm);
}

/**
 * Start a local softAP so phones join this board instead of an external router.
 * SoftAP IP is the ESP32 default 192.168.4.1 (also mirrored in config.h).
 */
static void wifiStartSoftAp() {
  const IPAddress apIp(SAFEGLOW_AP_IP0, SAFEGLOW_AP_IP1, SAFEGLOW_AP_IP2,
                       SAFEGLOW_AP_IP3);
  const IPAddress netmask(255, 255, 255, 0);

  WiFi.mode(WIFI_AP);
  WiFi.setHostname("safeglow-mr60bha2");
  // softAPConfig must run before softAP so the board keeps 192.168.4.1.
  WiFi.softAPConfig(apIp, apIp, netmask);

  const bool ok = WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD);
  if (!ok) {
    g_apReady = false;
    Serial.println(
        "[SafeGlow] softAP failed — Serial JSON still runs; "
        "check config.h and reflash.");
    return;
  }

  g_apReady = true;
  Serial.printf("[SafeGlow] softAP SSID \"%s\" ready\n", WIFI_AP_SSID);
  Serial.print("[SafeGlow] softAP IP: ");
  Serial.println(WiFi.softAPIP());
  Serial.printf("[SafeGlow] UDP broadcast :%u  TCP push :%u\n",
                SAFEGLOW_UDP_PORT, SAFEGLOW_TCP_PORT);
}

static void broadcastUdp(const char* json) {
  if (!g_apReady) {
    return;
  }

  IPAddress bcast = WiFi.softAPIP();
  bcast[3] = 255;  // softAP subnet directed broadcast (typical /24)

  udp.beginPacket(bcast, SAFEGLOW_UDP_PORT);
  udp.write(reinterpret_cast<const uint8_t*>(json), strlen(json));
  udp.endPacket();

  // Also try limited broadcast
  udp.beginPacket(IPAddress(255, 255, 255, 255), SAFEGLOW_UDP_PORT);
  udp.write(reinterpret_cast<const uint8_t*>(json), strlen(json));
  udp.endPacket();
}

static void acceptTcpClients() {
  if (!g_apReady) {
    return;
  }

  WiFiClient incoming = tcpServer.available();
  if (!incoming) {
    return;
  }

  for (int i = 0; i < MAX_TCP_CLIENTS; ++i) {
    if (!tcpClients[i] || !tcpClients[i].connected()) {
      tcpClients[i].stop();
      tcpClients[i] = incoming;
      Serial.printf("[SafeGlow] TCP client slot %d connected\n", i);
      return;
    }
  }
  // No free slot — refuse
  incoming.println("{\"device_status\":\"busy\"}");
  incoming.stop();
}

static void pushTcpClients(const char* json) {
  if (!g_apReady) {
    return;
  }

  for (int i = 0; i < MAX_TCP_CLIENTS; ++i) {
    if (tcpClients[i] && tcpClients[i].connected()) {
      tcpClients[i].println(json);
    }
  }
}

static void emitStatusBroadcast() {
  char json[192];
  buildStatusJson(json, sizeof(json));

  Serial.println(json);
  broadcastUdp(json);
  pushTcpClients(json);
}

/**
 * Refresh presence, Doppler motion, and breath rate from the module.
 * Large motion enters Active, freezes breath-rate acceptance, and holds
 * for ACTIVE_HOLD_MS after the last fast Doppler sample.
 */
static void pollRadar() {
  if (!mmWave.update(100)) {
    return;
  }

  g_humanPresent = mmWave.isHumanDetected();

  float distance = 0.0f;
  if (mmWave.getDistance(distance)) {
    g_distanceM = distance;
    g_distanceValid = (distance > 0.0f);
  }

  // Peak |speed| among reported targets this frame
  float peakSpeed = 0.0f;
  PeopleCounting targets;
  if (mmWave.getPeopleCountingTargetInfo(targets)) {
    for (size_t i = 0; i < targets.targets.size(); ++i) {
      const float speed =
          fabsf(static_cast<float>(targets.targets[i].dop_index) * RANGE_STEP);
      if (speed > peakSpeed) {
        peakSpeed = speed;
      }
    }
  }
  g_moveSpeedCmS = peakSpeed;

  const uint32_t now = millis();
  if (peakSpeed >= LARGE_MOTION_SPEED_CM_S) {
    g_lastLargeMotionMs = now;
  }

  const bool inActiveHold =
      (g_lastLargeMotionMs != 0) && (now - g_lastLargeMotionMs < ACTIVE_HOLD_MS);

  if (!g_humanPresent) {
    g_motion = MotionState::Absent;
    g_breathPaused = false;
    g_breathValid = false;
    g_breathBpm = 0.0f;
  } else if (inActiveHold) {
    // Large motion / roll-over: stable warm white, stop accepting new rates
    if (!g_breathPaused) {
      g_frozenBreathBpm = g_breathBpm;
      g_breathPaused = true;
      Serial.println(
          "[SafeGlow] motion=active — breath rate updates paused");
    }
    g_motion = MotionState::Active;
  } else {
    if (g_breathPaused) {
      g_breathPaused = false;
      g_pulseEpochMs = now;  // restart pulse phase cleanly
      Serial.println(
          "[SafeGlow] motion=quiet — breath rate updates resumed");
    }
    g_motion = MotionState::Quiet;

    float rate = 0.0f;
    if (mmWave.getBreathRate(rate) && rate > 0.0f) {
      g_breathBpm = rate;
      g_breathValid = true;
    }
  }

  // While paused, keep JSON rate null (do not surface possibly noisy samples)
  if (g_breathPaused) {
    g_breathValid = false;
    g_breathBpm = 0.0f;
  }

  g_signalQuality = computeSignalQuality();
}

// ---------------------------------------------------------------------------
// Arduino entry points
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println();
  Serial.println("[SafeGlow] MR60BHA2 night-light starting");

  pixels.begin();
  pixels.setBrightness(255);
  ledOff();

  mmWave.begin(&mmWaveSerial);
  g_pulseEpochMs = millis();

  wifiStartSoftAp();
  udp.begin(SAFEGLOW_UDP_PORT);
  tcpServer.begin();

  Serial.println("[SafeGlow] ready");
}

void loop() {
  pollRadar();
  updateNightLight();
  acceptTcpClients();

  const uint32_t now = millis();
  if (now - g_lastBroadcastMs >= STATUS_BROADCAST_INTERVAL_MS) {
    g_lastBroadcastMs = now;
    emitStatusBroadcast();
  }
}
