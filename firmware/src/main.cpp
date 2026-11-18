#include <Arduino.h>
#include <ArduinoJson.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <Update.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_task_wdt.h>
#include <esp_ota_ops.h>
#include <mbedtls/sha256.h>
#include <time.h>
#include <unistd.h>

#if __has_include("release-version.h")
#include "release-version.h"
#endif
#ifndef FLEET_VERSION
#define FLEET_VERSION "usb-dev"
#endif

extern const uint8_t caBundle[] asm("_binary_x509_crt_bundle_start");
extern "C" bool verifyRollbackLater() { return true; }
constexpr int TouchPin = 4;
constexpr size_t LogLimit = 256;
constexpr uint32_t PortalLifetime = 15 * 60 * 1000UL;

Preferences settings;
WebServer portal(80);
DNSServer dns;
JsonDocument config;
String nodeId;
String formToken;
bool storageReady, portalActive, touched, ntpStarted;
bool pendingVerification;
uint32_t touchStarted, portalStarted, restartAt, nextSample, nextUpload, nextWifi, nextOta;
uint32_t retryDelay = 5000;
uint64_t nextSequence = 1;

bool due(uint32_t now, uint32_t target) {
  return static_cast<int32_t>(now - target) >= 0;
}

String randomHex(size_t count) {
  String output;
  for (size_t i = 0; i < count; ++i) {
    char byte[3];
    snprintf(byte, sizeof(byte), "%02x", static_cast<unsigned>(esp_random() & 255));
    output += byte;
  }
  return output;
}

bool https(const String &url) {
  return url.startsWith("https://") && url.length() > 8 && url.length() <= 300 &&
    url.indexOf('@') < 0 && url.indexOf(' ') < 0 && url.indexOf('\r') < 0 &&
    url.indexOf('\n') < 0 && url.indexOf('#') < 0;
}

bool configureHttp(HTTPClient &http, WiFiClientSecure &tls, const String &url) {
  if (!https(url)) return false;
  tls.setCACertBundle(caBundle);
  tls.setHandshakeTimeout(12);
  http.setConnectTimeout(7000);
  http.setTimeout(10000);
  return http.begin(tls, url);
}

const char PortalPage[] PROGMEM = R"HTML(
<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ESP32 setup</title><style>
body{font:16px system-ui;max-width:36rem;margin:2rem auto;padding:0 1rem}
label{display:block;margin:1rem 0}input{display:block;width:100%;padding:.5rem;box-sizing:border-box}
button{padding:.6rem 1rem}a{display:inline-block;margin-right:1rem}
</style><h1>ESP32 setup</h1><p id="node"></p>
<form method="post" action="/settings">
<input type="hidden" name="token">
<label>Wi-Fi SSID<input name="ssid" maxlength="32" required></label>
<label>Wi-Fi password<input name="password" type="password" maxlength="64"></label>
<label><input style="display:inline;width:auto" name="openWifi" type="checkbox" value="1"> Use an open Wi-Fi network</label>
<label>Backend base URL<input name="base" placeholder="https://your-project.vercel.app" required></label>
<label>Ingest endpoint<input name="endpoint" required></label>
<label>Node API secret<input name="secret" type="password" maxlength="128"></label>
<label>OTA manifest URL<input name="ota" placeholder="https://github.com/.../manifest.json"></label>
<label>Sensitivity<input name="sensitivity" type="number" step="any" min=".01" max="100" required></label>
<label>Touch threshold<input name="touch" type="number" min="1" max="65535" required></label>
<label>Sample interval (seconds)<input name="interval" type="number" min="10" max="86400" required></label>
<p>Leave passwords blank to keep the saved values.</p><button>Save and restart</button></form>
<p><a href="/log">Download local log</a></p>
<script>
fetch('/settings').then(r=>r.json()).then(s=>{
  document.querySelector('#node').textContent=s.node+' / '+s.version;
  for(const field of document.forms[0].elements) if(field.name in s) field.value=s[field.name];
});
</script>
)HTML";

void saveSettings() {
  if (portal.arg("token") != formToken || restartAt) {
    portal.send(403, "text/plain", "Open the setup page again.");
    return;
  }
  String ssid = portal.arg("ssid"), password = portal.arg("password");
  String base = portal.arg("base"), path = portal.arg("endpoint"), ota = portal.arg("ota");
  String secret = portal.arg("secret");
  if (portal.hasArg("openWifi")) password = "";
  else if (!password.length() && ssid == config["ssid"].as<String>()) password = config["password"].as<String>();
  if (!secret.length()) secret = config["secret"].as<String>();
  while (base.endsWith("/")) base.remove(base.length() - 1);
  float sensitivity = portal.arg("sensitivity").toFloat();
  long threshold = portal.arg("touch").toInt(), interval = portal.arg("interval").toInt();
  if (!ssid.length() || ssid.length() > 32 ||
      (password.length() && (password.length() < 8 || password.length() > 64)) ||
      (!password.length() && !portal.hasArg("openWifi") && ssid != config["ssid"].as<String>()) ||
      !https(base) || base.indexOf('/', 8) >= 0 || base.indexOf('?') >= 0 ||
      !path.startsWith("/") || path.startsWith("//") || path.length() > 100 ||
      path.indexOf(' ') >= 0 || path.indexOf('\r') >= 0 || path.indexOf('\n') >= 0 ||
      secret.length() < 24 || secret.length() > 128 || secret.indexOf('\r') >= 0 || secret.indexOf('\n') >= 0 ||
      (ota.length() && !https(ota)) || !(sensitivity >= .01 && sensitivity <= 100) ||
      threshold < 1 || threshold > 65535 || interval < 10 || interval > 86400) {
    portal.send(400, "text/plain", "Invalid settings. Go back and check each field.");
    return;
  }
  JsonDocument updated;
  updated["ssid"] = ssid;
  updated["password"] = password;
  updated["base"] = base;
  updated["endpoint"] = path;
  updated["secret"] = secret;
  updated["ota"] = ota;
  updated["sensitivity"] = sensitivity;
  updated["touch"] = threshold;
  updated["interval"] = interval;
  String data;
  serializeJson(updated, data);
  if (settings.putString("config", data) != data.length()) {
    portal.send(500, "text/plain", "Could not persist settings.");
    return;
  }
  portal.send(200, "text/plain", "Settings saved. Restarting.");
  restartAt = millis() + 1000;
}

struct LogState {
  String pending, acknowledged;
  uint64_t pendingSequence = UINT64_MAX, acknowledgedSequence = UINT64_MAX, maxSequence = 0;
  size_t count = 0;
};

LogState scanLog() {
  LogState result;
  File dir = LittleFS.open("/");
  for (File f = dir.openNextFile(); f; f = dir.openNextFile()) {
    String name = f.path();
    if (!name.startsWith("/p-") && !name.startsWith("/s-")) continue;
    uint64_t sequence = strtoull(name.c_str() + 3, nullptr, 10);
    result.maxSequence = max(result.maxSequence, sequence);
    ++result.count;
    if (name.startsWith("/p-") && sequence < result.pendingSequence) {
      result.pending = name;
      result.pendingSequence = sequence;
    }
    if (name.startsWith("/s-") && sequence < result.acknowledgedSequence) {
      result.acknowledged = name;
      result.acknowledgedSequence = sequence;
    }
    esp_task_wdt_reset();
  }
  return result;
}

void saveSample() {
  if (!storageReady) return;
  auto log = scanLog();
  if (log.count >= LogLimit && (!log.acknowledged.length() || !LittleFS.remove(log.acknowledged))) {
    Serial.println("Log full; unsent records preserved");
    return;
  }
  JsonDocument event;
  event["nodeId"] = nodeId;
  event["eventId"] = randomHex(16);
  event["uptimeMs"] = millis();
  time_t now = time(nullptr);
  if (now >= 1577836800) event["sampledAt"] = now;
  float sensitivity = config["sensitivity"] | 1.0f;
  event["value"] = touchRead(TouchPin) * sensitivity; // Replace with the actual sensor reading.
  event["sensitivity"] = sensitivity;
  event["resetReason"] = static_cast<int>(esp_reset_reason());
  event["version"] = FLEET_VERSION;
  String line;
  serializeJson(event, line);
  FILE *file = fopen("/littlefs/new.tmp", "w");
  if (!file) { Serial.println("Cannot open local log"); return; }
  bool complete = fwrite(line.c_str(), 1, line.length(), file) == line.length() &&
    fflush(file) == 0 && fsync(fileno(file)) == 0;
  complete = fclose(file) == 0 && complete;
  char path[32];
  snprintf(path, sizeof(path), "/p-%020llu", static_cast<unsigned long long>(nextSequence++));
  if (!complete || !LittleFS.rename("/new.tmp", path)) Serial.println("Cannot commit local log record");
}

void uploadOne() {
  if (!storageReady || !config["base"].is<const char *>()) return;
  String path = scanLog().pending;
  if (!path.length()) { nextUpload = millis() + 2000; return; }
  File entry = LittleFS.open(path);
  if (!entry) { nextUpload = millis() + 10000; return; }
  String line = entry.readString();
  entry.close();
  WiFiClientSecure tls;
  HTTPClient request;
  int status = -1;
  if (configureHttp(request, tls, config["base"].as<String>() + config["endpoint"].as<String>())) {
    request.addHeader("Content-Type", "application/json");
    request.addHeader("Authorization", "Bearer " + config["secret"].as<String>());
    status = request.POST(line);
    request.end();
  }
  String acknowledged = "/s-" + path.substring(3);
  if (status >= 200 && status < 300 && LittleFS.rename(path, acknowledged)) {
    retryDelay = 5000;
    nextUpload = millis() + 500;
    return;
  }
  Serial.printf("Upload deferred (HTTP %d)\n", status);
  nextUpload = millis() + retryDelay + esp_random() % 3000;
  retryDelay = min(300000UL, static_cast<unsigned long>(retryDelay) * 2);
}

void exportLog() {
  if (!storageReady) { portal.send(503, "text/plain", "Local log unavailable"); return; }
  portal.sendHeader("Content-Disposition", "attachment; filename=esp32-log.ndjson");
  portal.setContentLength(CONTENT_LENGTH_UNKNOWN);
  portal.send(200, "application/x-ndjson", "");
  File dir = LittleFS.open("/");
  for (File entry = dir.openNextFile(); entry; entry = dir.openNextFile()) {
    String path = entry.path();
    if (path.startsWith("/p-") || path.startsWith("/s-")) portal.sendContent(entry.readString() + "\n");
    esp_task_wdt_reset();
  }
  portal.sendContent("");
}

void startPortal() {
  WiFi.disconnect();
  WiFi.mode(WIFI_AP);
  String name = "ESP32-Setup-" + nodeId.substring(12);
  String password = randomHex(8);
  if (!WiFi.softAP(name.c_str(), password.c_str(), 1, false, 1)) {
    WiFi.mode(WIFI_STA);
    return;
  }
  formToken = randomHex(16);
  Serial.printf("Setup Wi-Fi %s password %s, open http://192.168.4.1\n", name.c_str(), password.c_str());
  dns.start(53, "*", WiFi.softAPIP());
  portal.begin();
  portalActive = true;
  portalStarted = millis();
}

void checkTouch(uint32_t now) {
  if (touchRead(TouchPin) >= (config["touch"] | 30)) {
    touched = false;
    return;
  }
  if (!touched) { touched = true; touchStarted = now; }
  if (!portalActive && now - touchStarted >= 4000) startPortal();
}

// GitHub asset redirects may change hosts. Every hop must use verified HTTPS.
bool assetGet(HTTPClient &http, WiFiClientSecure &tls, String url) {
  for (int hop = 0; hop < 5; ++hop) {
    if (!configureHttp(http, tls, url)) return false;
    const char *headers[] = {"Location"};
    http.collectHeaders(headers, 1);
    http.useHTTP10(true);
    int status = http.GET();
    if (status == 200) return true;
    url = http.header("Location");
    http.end();
    if (status != 301 && status != 302 && status != 307 && status != 308) return false;
    esp_task_wdt_reset();
  }
  return false;
}

bool checkOta() {
  String manifest = config["ota"].as<String>();
  if (!manifest.length()) return true;
  WiFiClientSecure tls;
  HTTPClient http;
  if (!assetGet(http, tls, manifest)) return false;
  JsonDocument data;
  // Parse through a small fixed buffer so an invalid manifest cannot exhaust RAM.
  char json[2048];
  int manifestSize = http.getSize();
  if (manifestSize <= 0 || manifestSize >= static_cast<int>(sizeof(json)) ||
      http.getStream().readBytes(json, manifestSize) != static_cast<size_t>(manifestSize)) return false;
  auto error = deserializeJson(data, json, manifestSize);
  http.end();
  if (error || data["board"].as<String>() != "esp32dev") return false;
  String version = data["version"].as<String>(), hash = data["sha256"].as<String>();
  if (version == FLEET_VERSION) return true;
  if (version == settings.getString("attempted", "")) return false;
  if (version.length() != 40 || hash.length() != 64 || !assetGet(http, tls, data["url"].as<String>())) return false;
  int size = http.getSize();
  if (size <= 0 || size != (data["size"] | 0) || !Update.begin(size)) return false;
  mbedtls_sha256_context digest;
  mbedtls_sha256_init(&digest);
  mbedtls_sha256_starts_ret(&digest, 0);
  uint8_t block[1024], actual[32];
  int remaining = size;
  while (remaining) {
    size_t requested = min(remaining, static_cast<int>(sizeof(block)));
    size_t received = http.getStream().readBytes(block, requested);
    if (received != requested || Update.write(block, received) != received) break;
    mbedtls_sha256_update_ret(&digest, block, received);
    remaining -= received;
    esp_task_wdt_reset();
  }
  mbedtls_sha256_finish_ret(&digest, actual);
  mbedtls_sha256_free(&digest);
  char hex[65];
  for (size_t i = 0; i < sizeof(actual); ++i) snprintf(hex + 2 * i, 3, "%02x", actual[i]);
  if (remaining || hash != hex || !Update.end()) {
    Update.abort();
    return false;
  }
  settings.putString("attempted", version);
  ESP.restart();
  return true;
}

void setup() {
  Serial.begin(115200);
  esp_task_wdt_init(45, true);
  esp_task_wdt_add(nullptr);
  char id[20];
  snprintf(id, sizeof(id), "esp32-%012llx", static_cast<unsigned long long>(ESP.getEfuseMac()));
  nodeId = id;
  Serial.printf("Node %s, firmware %s, reset %d\n", id, FLEET_VERSION, esp_reset_reason());
  settings.begin("fleet", false);
  deserializeJson(config, settings.getString("config", "{}"));
  storageReady = LittleFS.begin(false);
  esp_ota_img_states_t state;
  pendingVerification = esp_ota_get_state_partition(esp_ota_get_running_partition(), &state) == ESP_OK &&
    state == ESP_OTA_IMG_PENDING_VERIFY;
  if (storageReady) nextSequence = scanLog().maxSequence + 1;
  else Serial.println("LittleFS unavailable; see first-flash instructions");
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  portal.on("/", HTTP_GET, [] { portal.send_P(200, "text/html", PortalPage); });
  portal.on("/settings", HTTP_GET, [] {
    JsonDocument view;
    for (auto key : {"ssid", "base", "ota"}) view[key] = config[key] | "";
    view["endpoint"] = config["endpoint"] | "/v1/telemetry";
    view["sensitivity"] = config["sensitivity"] | 1.0f;
    view["touch"] = config["touch"] | 30;
    view["interval"] = config["interval"] | 60;
    view["token"] = formToken;
    view["node"] = nodeId;
    view["version"] = FLEET_VERSION;
    String body;
    serializeJson(view, body);
    portal.sendHeader("Cache-Control", "no-store");
    portal.send(200, "application/json", body);
  });
  portal.on("/settings", HTTP_POST, saveSettings);
  portal.on("/log", HTTP_GET, exportLog);
  portal.onNotFound([] {
    portal.sendHeader("Location", "http://192.168.4.1/");
    portal.send(302, "text/plain", "");
  });
  if (!config["ssid"].is<const char *>()) startPortal();
  nextOta = millis() + 20000 + esp_random() % 60000;
}

void loop() {
  esp_task_wdt_reset();
  uint32_t now = millis();
  if (pendingVerification) {
    if (storageReady && WiFi.status() == WL_CONNECTED && time(nullptr) >= 1577836800 && now >= 20000) {
      pendingVerification = esp_ota_mark_app_valid_cancel_rollback() != ESP_OK;
    } else if (now >= 180000) {
      esp_ota_mark_app_invalid_rollback_and_reboot();
    }
  }
  checkTouch(now);
  if (restartAt && due(now, restartAt)) ESP.restart();
  if (due(now, nextSample)) {
    nextSample = now + (config["interval"] | 60UL) * 1000;
    saveSample();
  }
  if (portalActive) {
    dns.processNextRequest();
    portal.handleClient();
    if (now - portalStarted >= PortalLifetime && !restartAt) {
      portal.stop();
      dns.stop();
      WiFi.softAPdisconnect(true);
      WiFi.mode(WIFI_STA);
      portalActive = false;
      touched = false;
      nextWifi = millis();
    }
  } else if (WiFi.status() == WL_CONNECTED) {
    if (!ntpStarted) { configTime(0, 0, "pool.ntp.org", "time.google.com"); ntpStarted = true; }
    if (time(nullptr) >= 1577836800) {
      if (due(now, nextUpload)) uploadOne();
      esp_task_wdt_reset();
      if (!pendingVerification && due(now, nextOta)) {
        bool ok = checkOta();
        nextOta = millis() + (ok ? 900000UL : 60000UL) + esp_random() % 30000;
      }
    }
  } else if (due(now, nextWifi) && config["ssid"].is<const char *>()) {
    WiFi.begin(config["ssid"].as<const char *>(), config["password"] | "");
    nextWifi = now + 30000;
  }
  delay(20);
}
