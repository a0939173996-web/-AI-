/**
 * SafeGlow AI — softAP network & night-light tuning
 *
 * The board hosts its own Wi-Fi hotspot (softAP). Clients join
 * WIFI_AP_SSID / WIFI_AP_PASSWORD and talk to the fixed AP IP.
 * This firmware stays Local-First: it never phones home or hits a cloud API.
 */

#pragma once

// ---- SoftAP hotspot (XIAO ESP32C6) ----
#ifndef WIFI_AP_SSID
#define WIFI_AP_SSID "SafeGlow_Nightlight"
#endif

#ifndef WIFI_AP_PASSWORD
#define WIFI_AP_PASSWORD "12345678"
#endif

// Fixed softAP gateway IP octets (ESP32 Arduino default 192.168.4.1)
static const uint8_t SAFEGLOW_AP_IP0 = 192;
static const uint8_t SAFEGLOW_AP_IP1 = 168;
static const uint8_t SAFEGLOW_AP_IP2 = 4;
static const uint8_t SAFEGLOW_AP_IP3 = 1;

// UDP broadcast + TCP push ports on the softAP LAN
static const uint16_t SAFEGLOW_UDP_PORT = 4210;
static const uint16_t SAFEGLOW_TCP_PORT = 4211;

// How often to emit the neutral JSON status (ms)
static const uint32_t STATUS_BROADCAST_INTERVAL_MS = 1000;

// Doppler speed above this (cm/s) counts as large body motion (e.g. rolling over)
static const float LARGE_MOTION_SPEED_CM_S = 35.0f;

// Keep "active" state this long after the last large-motion sample (debounce)
static const uint32_t ACTIVE_HOLD_MS = 4000;

// Quiet micromotion: |speed| at or below this (cm/s)
static const float QUIET_SPEED_CM_S = 12.0f;

// Onboard WS2812 (MR60BHA2 kit — single pixel on XIAO D1 / GPIO1)
static const int LED_PIN = D1;
static const int LED_COUNT = 1;

// Warm orange for quiet breathing pulse  RGB(255, 159, 67)
static const uint8_t COLOR_QUIET_R = 255;
static const uint8_t COLOR_QUIET_G = 159;
static const uint8_t COLOR_QUIET_B = 67;

// Soft warm white for large motion (stable, no pulse)
static const uint8_t COLOR_ACTIVE_R = 255;
static const uint8_t COLOR_ACTIVE_G = 230;
static const uint8_t COLOR_ACTIVE_B = 200;
static const uint8_t COLOR_ACTIVE_BRIGHTNESS = 140;  // 0–255 overall scale

// Breathing-pulse brightness envelope (quiet mode)
static const float PULSE_BRIGHTNESS_MIN = 0.18f;  // floor of the sine envelope
static const float PULSE_BRIGHTNESS_MAX = 1.00f;
static const float DEFAULT_BREATH_BPM = 14.0f;    // fallback cadence when rate unknown
