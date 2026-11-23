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
#include <Wire.h>
#include <math.h>
#include <esp_now.h>
#include <mbedtls/md.h>
#include <memory>
#include <atomic>
#include <algorithm>
#include <vector>
#include <esp_crt_bundle.h>
#include <esp_http_client.h>
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
#ifndef FLEET_ALLOW_OTA
#define FLEET_ALLOW_OTA 1
#endif

SET_LOOP_TASK_STACK_SIZE(16384);

extern const uint8_t caBundle[] asm("_binary_x509_crt_bundle_start");
extern "C" esp_err_t esp_crt_bundle_attach(void *conf);
extern "C" bool verifyRollbackLater() { return true; }
constexpr int TouchPin = 4;
constexpr int SensorSda = 21;
constexpr int SensorScl = 22;
constexpr float AccelerationScale = 0.0039f * 9.80665f;
constexpr size_t LogLimit = 256;
constexpr uint32_t PortalLifetime = 15 * 60 * 1000UL;
constexpr int StatusLed = 2;
constexpr uint32_t HeartbeatInterval = 5000;
constexpr uint32_t CloudTimeout = 90000;

SemaphoreHandle_t filesystemMutex, handshakeMutex;
TaskHandle_t networkTaskHandle, heartbeatTaskHandle;
class FilesystemLock {
public:
  FilesystemLock() { xSemaphoreTakeRecursive(filesystemMutex, portMAX_DELAY); }
  ~FilesystemLock() { xSemaphoreGiveRecursive(filesystemMutex); }
};

class TransportBudget {
public:
  bool acquired;
  TransportBudget() : acquired(xSemaphoreTake(handshakeMutex, pdMS_TO_TICKS(15000)) == pdTRUE) {}
  ~TransportBudget() { if (acquired) xSemaphoreGive(handshakeMutex); }
};

// Arduino 2.0.17 rebuilds the global trust bundle on setCACertBundle().
// Initialize it once and serialize TLS handshakes while allowing concurrent transfers.
class VerifiedClient : public WiFiClientSecure {
public:
  VerifiedClient() { _use_ca_bundle = true; }
  int connect(const char *host, uint16_t port, int32_t timeout) override {
    if (xSemaphoreTake(handshakeMutex, pdMS_TO_TICKS(1000)) != pdTRUE) return 0;
    IPAddress address;
    if (!WiFi.hostByName(host, address)) { xSemaphoreGive(handshakeMutex); return 0; }
    esp_task_wdt_reset();
    _timeout = timeout;
    int result = WiFiClientSecure::connect(address, port, host, _CA_cert, _cert, _private_key);
    xSemaphoreGive(handshakeMutex);
    return result;
  }
};

Preferences settings;
WebServer portal(80);
DNSServer dns;
JsonDocument config;
String nodeId;
String formToken;
bool storageReady, touched, ntpStarted;
std::atomic<bool> portalActive{false}, pendingVerification{false}, cloudHealthy{false}, otaActive{false};
std::atomic<uint32_t> lastCloudSuccess{0};
String bootId, apPassword;
uint32_t touchStarted, portalStarted, restartAt, nextSample, nextUpload, nextWifi, nextOta, wifiLostAt;
uint32_t retryDelay = 5000;
uint64_t nextSequence = 1;
uint32_t verificationStarted;
uint8_t sensorAddress = 0;
String serialCommand;
void startPortal();
void closePortal();
void diagnoseStorage();
bool due(uint32_t now, uint32_t target);
uint32_t nextHeartbeat, nextBeacon;
bool radioReady;
struct Neighbor { char id[19]; uint32_t seen; };
Neighbor neighbors[16] = {};
struct Beacon { uint32_t magic; uint32_t timestamp; uint8_t mac[6]; uint8_t digest[32]; };
QueueHandle_t beaconQueue;
portMUX_TYPE readingMux = portMUX_INITIALIZER_UNLOCKED;
struct SensorReading { float x, y, z, delta; bool valid; };
SensorReading latestReading = {};
uint32_t nextSensorRead, lastMovementAt;
bool movementPrimed, movementWarm;
float baselineX, baselineY, baselineZ, pendingMovementPeak;
uint32_t bootMotionReady;

SensorReading currentReading() {
  portENTER_CRITICAL(&readingMux);
  SensorReading result = latestReading;
  portEXIT_CRITICAL(&readingMux);
  return result;
}

String timeInIst(time_t timestamp) {
  if (timestamp < 1577836800) return "Waiting for time sync";
  struct tm local;
  localtime_r(&timestamp, &local);
  char output[40];
  strftime(output, sizeof(output), "%Y-%m-%d %H:%M:%S IST", &local);
  return output;
}

void syncFromServerDate(const String &header) {
  int day, year, hour, minute, second;
  char month[4] = {};
  if (sscanf(header.c_str(), "%*3s, %d %3s %d %d:%d:%d GMT", &day, month, &year, &hour, &minute, &second) != 6) return;
  const char *months = "JanFebMarAprMayJunJulAugSepOctNovDec";
  const char *match = strstr(months, month);
  if (!match || year < 2020 || year > 2037 || day < 1 || day > 31 ||
      hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return;
  struct tm date = {};
  date.tm_year = year - 1900;
  date.tm_mon = (match - months) / 3;
  date.tm_mday = day;
  date.tm_hour = hour;
  date.tm_min = minute;
  date.tm_sec = second;
  // mktime interprets the fields in IST. The HTTP Date fields are GMT.
  time_t server = mktime(&date) + 19800;
  int64_t difference = static_cast<int64_t>(server) - time(nullptr);
  if (difference > 2 || difference < -2) {
    timeval now = { server, 0 };
    settimeofday(&now, nullptr);
    Serial.printf("Time synchronized from server: %s\n", timeInIst(now.tv_sec).c_str());
  }
}

void discoveryDigest(const Beacon &beacon, uint8_t *digest) {
  String key = config["discovery"] | "";
  mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256),
    reinterpret_cast<const uint8_t *>(key.c_str()), key.length(),
    reinterpret_cast<const uint8_t *>(&beacon), offsetof(Beacon, digest), digest);
}

void receiveBeacon(const uint8_t *mac, const uint8_t *data, int length) {
  if (!beaconQueue || length != sizeof(Beacon)) return;
  Beacon beacon;
  memcpy(&beacon, data, sizeof(beacon));
  if (memcmp(mac, beacon.mac, 6) == 0) xQueueSend(beaconQueue, &beacon, 0);
}

void serviceDiscovery() {
  if (WiFi.status() != WL_CONNECTED || String(config["discovery"] | "").length() < 32 ||
      time(nullptr) < 1577836800) return;
  if (!radioReady) {
    if (!beaconQueue) beaconQueue = xQueueCreate(8, sizeof(Beacon));
    if (!beaconQueue || esp_now_init() != ESP_OK) return;
    esp_now_register_recv_cb(receiveBeacon);
    esp_now_peer_info_t peer = {};
    memset(peer.peer_addr, 255, 6);
    peer.ifidx = WIFI_IF_STA;
    if (esp_now_add_peer(&peer) != ESP_OK) { esp_now_deinit(); return; }
    radioReady = true;
  }
  Beacon beacon;
  while (xQueueReceive(beaconQueue, &beacon, 0) == pdTRUE) {
    uint8_t digest[32];
    discoveryDigest(beacon, digest);
    uint8_t difference = 0;
    for (size_t i = 0; i < 32; ++i) difference |= digest[i] ^ beacon.digest[i];
    int64_t age = static_cast<int64_t>(time(nullptr)) - beacon.timestamp;
    if (beacon.magic != 0x464c5431 || difference || age < -10 || age > 30) continue;
    char id[19];
    snprintf(id, sizeof(id), "esp32-%02x%02x%02x%02x%02x%02x",
      beacon.mac[5], beacon.mac[4], beacon.mac[3], beacon.mac[2], beacon.mac[1], beacon.mac[0]);
    for (auto &neighbor : neighbors) {
      portENTER_CRITICAL(&readingMux);
      if (!neighbor.id[0] || !strcmp(neighbor.id, id) || millis() - neighbor.seen > 45000) {
        strncpy(neighbor.id, id, sizeof(neighbor.id));
        neighbor.seen = millis();
        portEXIT_CRITICAL(&readingMux);
        break;
      }
      portEXIT_CRITICAL(&readingMux);
    }
  }
  if (due(millis(), nextBeacon)) {
    nextBeacon = millis() + 5000 + esp_random() % 1000;
    Beacon outgoing = {};
    outgoing.magic = 0x464c5431;
    outgoing.timestamp = time(nullptr);
    WiFi.macAddress(outgoing.mac);
    discoveryDigest(outgoing, outgoing.digest);
    const uint8_t broadcast[6] = {255,255,255,255,255,255};
    esp_now_send(broadcast, reinterpret_cast<uint8_t *>(&outgoing), sizeof(outgoing));
  }
}

bool readRegisters(uint8_t address, uint8_t reg, uint8_t *bytes, size_t count) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0 ||
      Wire.requestFrom(address, static_cast<uint8_t>(count)) != count) return false;
  for (size_t i = 0; i < count; ++i) bytes[i] = Wire.read();
  return true;
}

bool writeRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(sensorAddress);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool beginSensor() {
  Wire.begin(SensorSda, SensorScl, 100000);
  Wire.setTimeOut(50);
  for (uint8_t address : {0x53, 0x1d}) {
    uint8_t id;
    if (readRegisters(address, 0x00, &id, 1) && id == 0xe5) {
      sensorAddress = address;
      bool ok = writeRegister(0x2d, 0x00) && writeRegister(0x31, 0x0b) &&
        writeRegister(0x2c, 0x0a) && writeRegister(0x2d, 0x08);
      uint8_t format, rate, power;
      ok = ok && readRegisters(address, 0x31, &format, 1) && format == 0x0b &&
        readRegisters(address, 0x2c, &rate, 1) && rate == 0x0a &&
        readRegisters(address, 0x2d, &power, 1) && power == 0x08;
      if (ok) {
        Serial.printf("ADXL345 ready: address=0x%02x DEVID=0xe5 SDA=21 SCL=22 full-resolution=16g ODR=100Hz\n", address);
        delay(20);
        return true;
      }
    }
  }
  sensorAddress = 0;
  Serial.println("ADXL345 unavailable: check SDA=21 SCL=22, 3V3, GND, CS high and SDO address strap");
  return false;
}

bool readAcceleration(float &x, float &y, float &z) {
  uint8_t bytes[6];
  if (!sensorAddress || !readRegisters(sensorAddress, 0x32, bytes, sizeof(bytes))) return false;
  x = static_cast<int16_t>(bytes[0] | (bytes[1] << 8)) * AccelerationScale;
  y = static_cast<int16_t>(bytes[2] | (bytes[3] << 8)) * AccelerationScale;
  z = static_cast<int16_t>(bytes[4] | (bytes[5] << 8)) * AccelerationScale;
  return true;
}

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

bool https(const String &url, size_t maximumLength = 300) {
  return url.startsWith("https://") && url.length() > 8 && url.length() <= maximumLength &&
    url.indexOf('@') < 0 && url.indexOf(' ') < 0 && url.indexOf('\r') < 0 &&
    url.indexOf('\n') < 0 && url.indexOf('#') < 0;
}

bool configureHttp(HTTPClient &http, WiFiClientSecure &tls, const String &url, size_t maximumLength = 300) {
  if (!https(url, maximumLength)) return false;
  tls.setHandshakeTimeout(8);
  http.setConnectTimeout(5000);
  http.setTimeout(5000);
  http.setReuse(false);
  http.useHTTP10(true);
  const char *headers[] = {"Date"};
  http.collectHeaders(headers, 1);
  return http.begin(tls, url);
}

int postToCloud(const String &path, const String &body) {
  String url = config["base"].as<String>() + path;
  if (!https(url)) return -1;
  // ESP32 TLS handshakes need a large contiguous allocation. Serialize cloud
  // requests with OTA handshakes so simultaneous handshakes cannot exhaust it.
  if (xSemaphoreTake(handshakeMutex, pdMS_TO_TICKS(15000)) != pdTRUE) return -1;
  String date;
  esp_http_client_config_t options = {};
  options.url = url.c_str();
  options.timeout_ms = 5000;
  options.crt_bundle_attach = esp_crt_bundle_attach;
  options.disable_auto_redirect = true;
  options.user_data = &date;
  options.event_handler = [](esp_http_client_event_t *event) -> esp_err_t {
    if (event->event_id == HTTP_EVENT_ON_HEADER && event->header_key &&
        !strcasecmp(event->header_key, "Date")) {
      *static_cast<String *>(event->user_data) = event->header_value;
    }
    return ESP_OK;
  };
  auto client = esp_http_client_init(&options);
  if (!client) { xSemaphoreGive(handshakeMutex); return -1; }
  String authorization = "Bearer " + config["secret"].as<String>();
  esp_http_client_set_method(client, HTTP_METHOD_POST);
  esp_http_client_set_header(client, "Content-Type", "application/json");
  esp_http_client_set_header(client, "Authorization", authorization.c_str());
  esp_http_client_set_post_field(client, body.c_str(), body.length());
  esp_task_wdt_reset();
  auto result = esp_http_client_perform(client);
  int status = result == ESP_OK ? esp_http_client_get_status_code(client) : -1;
  esp_http_client_cleanup(client);
  xSemaphoreGive(handshakeMutex);
  esp_task_wdt_reset();
  if (status >= 200 && status < 300) {
    syncFromServerDate(date);
    lastCloudSuccess = millis();
  }
  return status;
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
<label>Setup AP password (blank keeps existing)<input name="apPassword" type="password" minlength="8" maxlength="63"></label>
<label><input style="display:inline;width:auto" name="openWifi" type="checkbox" value="1"> Use an open Wi-Fi network</label>
<label>Backend base URL<input name="base" placeholder="https://your-project.vercel.app" required></label>
<label>Ingest endpoint<input name="endpoint" required></label>
<label>Node API secret<input name="secret" type="password" maxlength="128"></label>
<label>Fleet discovery key<input name="discovery" type="password" maxlength="128"></label>
<label>OTA manifest URL<input name="ota" placeholder="https://github.com/.../manifest.json"></label>
<label>Sensitivity<input name="sensitivity" type="number" step="any" min=".01" max="100" required></label>
<label>Touch threshold<input name="touch" type="number" min="1" max="65535" required></label>
<label>Movement threshold (m/s²)<input name="motionThreshold" type="number" step=".1" min=".2" max="100"></label>
<label>Sample interval (seconds)<input name="interval" type="number" min="10" max="86400" required></label>
<p>Leave passwords blank to keep the saved values.</p><button>Save and restart</button></form>
<p><a href="/log">Download local log</a></p>
<h2>Device status and logs</h2><p id="state">Loading…</p><pre id="logs" style="white-space:pre-wrap"></pre>
<script>
async function loadSettings(){const s=await fetch('/settings').then(r=>r.json());
  document.querySelector('#node').textContent=s.node+' / '+s.version;
  for(const field of document.forms[0].elements) if(field.name in s) field.value=s[field.name];
}
async function refreshLogs(){
  try{
    const s=await fetch('/status').then(r=>r.json());
    document.querySelector('#state').textContent=s.nodeId+' | '+s.connection+' | '+s.timeIst+' | '+s.pending+' pending records';
    const records=await fetch('/logs').then(r=>r.json());
    document.querySelector('#logs').textContent=records.map(r=>(r.sampledAt?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'medium'}).format(new Date(r.sampledAt*1000)):'Time pending')+' | '+(r.kind||'sample')+' | '+Number(r.value).toFixed(3)+' m/s²').join('\n')||'No committed records yet.';
  }catch(e){document.querySelector('#state').textContent='Reconnecting to device…';}
  finally{setTimeout(refreshLogs,3000);}
}
loadSettings().catch(()=>{document.querySelector('#node').textContent='Reload this page to retry loading settings.';}).finally(refreshLogs);
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
  String nextApPassword = portal.arg("apPassword");
  if (nextApPassword.length() && (nextApPassword.length() < 8 || nextApPassword.length() > 63)) {
    portal.send(400, "text/plain", "Setup AP password must contain 8 to 63 characters.");
    return;
  }
  String discovery = portal.arg("discovery");
  if (!discovery.length()) discovery = config["discovery"] | "";
  if (portal.hasArg("openWifi")) password = "";
  else if (!password.length() && ssid == config["ssid"].as<String>()) password = config["password"].as<String>();
  if (!secret.length()) secret = config["secret"].as<String>();
  while (base.endsWith("/")) base.remove(base.length() - 1);
  float sensitivity = portal.arg("sensitivity").toFloat();
  float motionThreshold = portal.hasArg("motionThreshold") ? portal.arg("motionThreshold").toFloat() : (config["motionThreshold"] | 1.5f);
  long threshold = portal.arg("touch").toInt(), interval = portal.arg("interval").toInt();
  if (!ssid.length() || ssid.length() > 32 ||
      (password.length() && (password.length() < 8 || password.length() > 64)) ||
      (!password.length() && !portal.hasArg("openWifi") && ssid != config["ssid"].as<String>()) ||
      !https(base) || base.indexOf('/', 8) >= 0 || base.indexOf('?') >= 0 ||
      !path.startsWith("/") || path.startsWith("//") || path.length() > 100 ||
      path.indexOf(' ') >= 0 || path.indexOf('\r') >= 0 || path.indexOf('\n') >= 0 ||
      secret.length() < 24 || secret.length() > 128 || secret.indexOf('\r') >= 0 || secret.indexOf('\n') >= 0 ||
      (discovery.length() && (discovery.length() < 32 || discovery.length() > 128)) ||
      (ota.length() && !https(ota)) || !(sensitivity >= .01 && sensitivity <= 100) ||
      threshold < 1 || threshold > 65535 || interval < 10 || interval > 86400) {
    portal.send(400, "text/plain", "Invalid settings. Go back and check each field.");
    return;
  }
  if (!(motionThreshold >= .2f && motionThreshold <= 100.0f)) {
    portal.send(400, "text/plain", "Movement threshold must be between 0.2 and 100 m/s².");
    return;
  }
  JsonDocument updated;
  updated["ssid"] = ssid;
  updated["password"] = password;
  updated["base"] = base;
  updated["endpoint"] = path;
  updated["secret"] = secret;
  updated["discovery"] = discovery;
  updated["ota"] = ota;
  updated["sensitivity"] = sensitivity;
  updated["touch"] = threshold;
  updated["interval"] = interval;
  updated["motionThreshold"] = motionThreshold;
  String data;
  serializeJson(updated, data);
  if (settings.putString("config", data) != data.length()) {
    portal.send(500, "text/plain", "Could not persist settings.");
    return;
  }
  if (nextApPassword.length() && settings.putString("apKey", nextApPassword) != nextApPassword.length()) {
    portal.send(500, "text/plain", "Could not persist setup AP password. Reopen setup and retry.");
    return;
  }
  portal.send(200, "text/plain", "Settings saved. Restarting.");
  restartAt = millis() + 1000;
}

struct LogState {
  String pending, acknowledged;
  String movement;
  uint64_t pendingSequence = UINT64_MAX, acknowledgedSequence = UINT64_MAX, maxSequence = 0;
  uint64_t movementSequence = UINT64_MAX;
  size_t count = 0;
  size_t pendingCount = 0;
};

std::vector<String> logPaths;
std::vector<size_t> logSizes;
bool logIndexLoaded = false;
bool logDirectoriesReady = false;

const char *recordName(const String &path) {
  const char *slash = strrchr(path.c_str(), '/');
  return slash ? slash + 1 : path.c_str();
}

bool isRecordPath(const String &path) {
  const char *name = recordName(path);
  if (strlen(name) != 22 || name[1] != '-' ||
      (name[0] != 'p' && name[0] != 's' && name[0] != 'm')) return false;
  for (size_t i = 2; i < 22; ++i) if (name[i] < '0' || name[i] > '9') return false;
  return true;
}

uint64_t recordSequence(const String &path) {
  return strtoull(recordName(path) + 2, nullptr, 10);
}

String recordPath(char marker, uint64_t sequence) {
  char path[40];
  if (logDirectoriesReady) snprintf(path, sizeof(path), "/log%u/%c-%020llu",
    static_cast<unsigned>(sequence % 8), marker, static_cast<unsigned long long>(sequence));
  else snprintf(path, sizeof(path), "/%c-%020llu", marker, static_cast<unsigned long long>(sequence));
  return String(path);
}

void loadLogIndex() {
  struct LegacyRecord { String path; size_t size; };
  std::vector<LegacyRecord> legacy;
  {
    File root = LittleFS.open("/");
    for (File file = root.openNextFile(); file; file = root.openNextFile()) {
      if (!file.isDirectory() && isRecordPath(file.path())) legacy.push_back({String(file.path()), file.size()});
      esp_task_wdt_reset();
    }
  }
  logDirectoriesReady = true;
  for (unsigned i = 0; i < 8; ++i) {
    String directory = "/log" + String(i);
    if (!LittleFS.exists(directory) && !LittleFS.mkdir(directory)) logDirectoriesReady = false;
    File dir = LittleFS.open(directory);
    if (dir && dir.isDirectory()) {
      for (File file = dir.openNextFile(); file; file = dir.openNextFile()) {
        if (isRecordPath(file.path())) {
          logPaths.push_back(String(file.path()));
          logSizes.push_back(file.size());
        }
        esp_task_wdt_reset();
      }
    } else logDirectoriesReady = false;
    esp_task_wdt_reset();
  }
  size_t moved = 0;
  for (const auto &entry : legacy) {
    const String &path = entry.path;
    String target = recordPath(recordName(path)[0], recordSequence(path));
    // Never overwrite a collision or delete an original on a failed migration.
    if (logDirectoriesReady && !LittleFS.exists(target) && LittleFS.rename(path, target)) {
      logPaths.push_back(target);
      ++moved;
    } else logPaths.push_back(path);
    logSizes.push_back(entry.size);
    esp_task_wdt_reset();
    if (moved && moved % 32 == 0) Serial.printf("Log layout migration: %u/%u\n", moved, legacy.size());
  }
  Serial.printf("Log index ready: %u records, %u migrated, sharded=%d\n", logPaths.size(), moved, logDirectoriesReady);
  LittleFS.remove("/export.tmp");
  logIndexLoaded = true;
}

void forgetLogPath(const String &path) {
  for (size_t i = 0; i < logPaths.size(); ++i) {
    if (logPaths[i] == path) {
      logPaths.erase(logPaths.begin() + i);
      logSizes.erase(logSizes.begin() + i);
      return;
    }
  }
}

LogState scanLog() {
  FilesystemLock lock;
  LogState result;
  if (!logIndexLoaded) loadLogIndex();
  for (const String &name : logPaths) {
    const char marker = recordName(name)[0];
    uint64_t sequence = recordSequence(name);
    result.maxSequence = max(result.maxSequence, sequence);
    ++result.count;
    if (marker == 'p' || marker == 'm') ++result.pendingCount;
    if (marker == 'm' && sequence < result.movementSequence) {
      result.movement = name;
      result.movementSequence = sequence;
    }
    if (marker == 'p' && sequence < result.pendingSequence) {
      result.pending = name;
      result.pendingSequence = sequence;
    }
    if (marker == 's' && sequence < result.acknowledgedSequence) {
      result.acknowledged = name;
      result.acknowledgedSequence = sequence;
    }
    esp_task_wdt_reset();
  }
  if (result.movement.length()) result.pending = result.movement;
  return result;
}

void saveSample(const char *kind = "sample", float movementDelta = 0) {
  if (!storageReady) return;
  SensorReading reading = currentReading();
  if (!reading.valid) {
    Serial.println("Sensor read failed; sample skipped");
    return;
  }
  float x = reading.x, y = reading.y, z = reading.z;
  FilesystemLock lock;
  auto log = scanLog();
  if (log.count >= LogLimit && (!log.acknowledged.length() || !LittleFS.remove(log.acknowledged))) {
    Serial.println("Log full; unsent records preserved");
    return;
  }
  if (log.count >= LogLimit) forgetLogPath(log.acknowledged);
  JsonDocument event;
  event["nodeId"] = nodeId;
  event["eventId"] = randomHex(16);
  event["bootId"] = bootId;
  event["kind"] = kind;
  event["movementDelta"] = movementDelta;
  event["uptimeMs"] = millis();
  time_t now = time(nullptr);
  if (now >= 1577836800) event["sampledAt"] = now;
  float sensitivity = config["sensitivity"] | 1.0f;
  event["value"] = sqrtf(x * x + y * y + z * z) * sensitivity;
  event["sensor"] = "ADXL345";
  event["unit"] = "m/s2";
  event["acceleration"]["x"] = x;
  event["acceleration"]["y"] = y;
  event["acceleration"]["z"] = z;
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
  String path = recordPath(!strcmp(kind, "movement") ? 'm' : 'p', nextSequence++);
  if (!complete || !LittleFS.rename("/new.tmp", path)) {
    Serial.println("Cannot commit local log record");
  } else {
    logPaths.push_back(String(path));
    logSizes.push_back(line.length());
    Serial.printf("%s committed: x=%.4f y=%.4f z=%.4f magnitude=%.4f m/s2 %s\n", kind, x, y, z, event["value"].as<float>(), timeInIst(now).c_str());
  }
}

void serviceSensor(uint32_t now) {
  if (!due(now, nextSensorRead)) return;
  nextSensorRead = now + 20;
  float x = 0, y = 0, z = 0;
  bool valid = readAcceleration(x, y, z);
  float delta = 0;
  if (valid) {
    if (!movementPrimed) {
      baselineX = x; baselineY = y; baselineZ = z;
      movementPrimed = true;
      bootMotionReady = now + 2000;
    }
    delta = sqrtf(powf(x-baselineX,2) + powf(y-baselineY,2) + powf(z-baselineZ,2));
    baselineX += .05f * (x - baselineX);
    baselineY += .05f * (y - baselineY);
    baselineZ += .05f * (z - baselineZ);
  }
  portENTER_CRITICAL(&readingMux);
  latestReading = {x, y, z, delta, valid};
  portEXIT_CRITICAL(&readingMux);
  if (!movementWarm && movementPrimed && due(now, bootMotionReady)) movementWarm = true;
  if (!valid || !movementWarm) return;
  float threshold = config["motionThreshold"] | 1.5f;
  if (delta >= threshold) {
    pendingMovementPeak = max(pendingMovementPeak, delta);
    if (now - lastMovementAt >= 2000) {
      saveSample("movement", pendingMovementPeak);
      pendingMovementPeak = 0;
      lastMovementAt = now;
    }
  }
}

void serviceSerial() {
  while (Serial.available()) {
    char byte = Serial.read();
    if (byte == '\r') continue;
    if (byte != '\n') {
      if (serialCommand.length() < 2048) serialCommand += byte;
      continue;
    }
    serialCommand.trim();
    if (serialCommand.startsWith("configure ")) {
      JsonDocument incoming;
      auto error = deserializeJson(incoming, serialCommand.substring(10));
      String ssid = incoming["ssid"] | "", password = incoming["password"] | "";
      String secret = incoming["secret"] | "", discovery = incoming["discovery"] | "";
      String base = incoming["base"] | "", endpoint = incoming["endpoint"] | "";
      String ota = incoming["ota"] | "";
      unsigned interval = incoming["interval"] | 60U;
      float sensitivity = incoming["sensitivity"] | 1.0f;
      int threshold = incoming["touch"] | 30;
      if (error || ssid.isEmpty() || ssid.length() > 32 || password.length() < 8 || password.length() > 64 ||
          secret.length() < 24 || secret.length() > 128 || !https(base) || base.indexOf('/', 8) >= 0 ||
          endpoint != "/v1/telemetry" || (ota.length() && !https(ota)) ||
          (discovery.length() && (discovery.length() < 32 || discovery.length() > 128)) ||
          interval < 10 || interval > 86400 || !(sensitivity >= .01 && sensitivity <= 100) ||
          threshold < 1 || threshold > 65535) {
        Serial.println("Configuration rejected");
      } else {
        String stored;
        serializeJson(incoming, stored);
        if (settings.putString("config", stored) == stored.length()) {
          Serial.println("Configuration persisted; restarting");
          restartAt = millis() + 1000;
        } else Serial.println("Configuration persistence failed");
      }
    } else if (serialCommand == "status") {
      JsonDocument status;
      status["nodeId"] = nodeId;
      status["version"] = FLEET_VERSION;
      status["storageReady"] = storageReady;
      status["sensorAddress"] = sensorAddress;
      status["wifiConnected"] = WiFi.status() == WL_CONNECTED;
      status["ssid"] = config["ssid"] | "";
      status["rssi"] = WiFi.RSSI();
      status["ip"] = WiFi.localIP().toString();
      status["portalActive"] = portalActive.load();
      status["touchRaw"] = touchRead(TouchPin);
      status["logRecords"] = storageReady ? scanLog().count : 0;
      status["stackFreeBytes"] = uxTaskGetStackHighWaterMark(nullptr);
      status["freeHeap"] = ESP.getFreeHeap();
      status["pendingVerification"] = pendingVerification.load();
      status["ledOn"] = digitalRead(StatusLed) == HIGH;
      status["timeIst"] = timeInIst(time(nullptr));
      status["pendingRecords"] = storageReady ? scanLog().pendingCount : 0;
      status["lastCloudAgeMs"] = lastCloudSuccess.load() ? millis() - lastCloudSuccess.load() : 0;
      String output;
      serializeJson(status, output);
      Serial.println(output);
    } else if (serialCommand == "sensor") {
      float x, y, z;
      if (readAcceleration(x, y, z)) {
        Serial.printf("ADXL345 x=%.4f y=%.4f z=%.4f magnitude=%.4f m/s2\n", x, y, z, sqrtf(x*x+y*y+z*z));
      } else Serial.println("ADXL345 read failed");
    } else if (serialCommand == "sample") {
      saveSample();
    } else if (serialCommand == "portal") {
      if (!portalActive) startPortal();
    } else if (serialCommand == "portal-close") {
      closePortal();
    } else if (serialCommand == "storage-check") {
      diagnoseStorage();
    } else if (serialCommand.length()) {
      Serial.println("Commands: status, sensor, sample, portal, portal-close, storage-check");
    }
    serialCommand = "";
    // Bound diagnostic work so queued serial commands cannot starve acquisition.
    break;
  }
}

String readCommittedRecord(File &file) {
  size_t length = file ? file.size() : 0;
  if (!length || length > 1024) return "";
  char bytes[1025];
  if (file.read(reinterpret_cast<uint8_t *>(bytes), length) != length) return "";
  bytes[length] = 0;
  return String(bytes);
}

void diagnoseStorage() {
  JsonDocument result;
  result["diagnostic"] = "storage-check";
  result["nodeId"] = nodeId;
  if (!storageReady) {
    result["error"] = "LittleFS unavailable";
  } else {
    uint32_t started = millis(), maximumRead = 0;
    size_t count;
    { FilesystemLock lock; count = logPaths.size(); }
    size_t valid = 0, invalid = 0;
    for (size_t i = 0; i < count; ++i) {
      String line;
      uint32_t readStarted = millis();
      {
        FilesystemLock lock;
        File file = LittleFS.open(logPaths[i]);
        line = readCommittedRecord(file);
      }
      maximumRead = max(maximumRead, static_cast<uint32_t>(millis() - readStarted));
      JsonDocument record;
      if (line.length() && !deserializeJson(record, line)) ++valid;
      else ++invalid;
      esp_task_wdt_reset();
      vTaskDelay(pdMS_TO_TICKS(1));
    }
    result["records"] = count;
    result["valid"] = valid;
    result["invalid"] = invalid;
    result["elapsedMs"] = millis() - started;
    result["maximumReadMs"] = maximumRead;
    result["usedBytes"] = LittleFS.usedBytes();
    result["totalBytes"] = LittleFS.totalBytes();
  }
  result["freeHeap"] = ESP.getFreeHeap();
  result["largestAllocation"] = ESP.getMaxAllocHeap();
  String output;
  serializeJson(result, output);
  Serial.println(output);
}

void uploadOne() {
  if (!storageReady || !config["base"].is<const char *>()) return;
  String path = scanLog().pending;
  if (!path.length()) { nextUpload = millis() + 2000; return; }
  String line;
  {
    FilesystemLock lock;
    File entry = LittleFS.open(path);
    if (!entry) { nextUpload = millis() + 10000; return; }
    line = readCommittedRecord(entry);
    entry.close();
  }
  int status = postToCloud(config["endpoint"].as<String>(), line);
  String acknowledged = path;
  acknowledged.setCharAt(acknowledged.lastIndexOf('/') + 1, 's');
  Serial.printf("Telemetry HTTP %d\n", status);
  if (status >= 200 && status < 300) {
    FilesystemLock lock;
    if (LittleFS.rename(path, acknowledged)) {
      for (String &stored : logPaths) if (stored == path) { stored = acknowledged; break; }
      retryDelay = 5000;
      nextUpload = millis() + 100;
      return;
    }
  }
  Serial.printf("Upload deferred (HTTP %d)\n", status);
  nextUpload = millis() + retryDelay + esp_random() % 3000;
  retryDelay = min(300000UL, static_cast<unsigned long>(retryDelay) * 2);
}

void sendHeartbeat() {
  nextHeartbeat = millis() + HeartbeatInterval;
  if (!config["base"].is<const char *>()) return;
  JsonDocument heartbeat;
  heartbeat["nodeId"] = nodeId;
  heartbeat["bootId"] = bootId;
  heartbeat["uptimeMs"] = millis();
  heartbeat["version"] = FLEET_VERSION;
  heartbeat["ssid"] = config["ssid"] | "";
  heartbeat["rssi"] = WiFi.RSSI();
  heartbeat["channel"] = WiFi.channel();
  heartbeat["storageReady"] = storageReady;
  SensorReading reading = currentReading();
  heartbeat["sensorReady"] = reading.valid;
  heartbeat["timeSynced"] = time(nullptr) >= 1577836800;
  heartbeat["mode"] = otaActive.load() ? "updating" : portalActive.load() ? "setup" : "running";
  if (reading.valid) {
    heartbeat["acceleration"]["x"] = reading.x;
    heartbeat["acceleration"]["y"] = reading.y;
    heartbeat["acceleration"]["z"] = reading.z;
    heartbeat["value"] = sqrtf(reading.x*reading.x+reading.y*reading.y+reading.z*reading.z);
  }
  auto state = storageReady ? scanLog() : LogState{};
  heartbeat["logRecords"] = state.count;
  heartbeat["pendingRecords"] = state.pendingCount;
  auto peers = heartbeat["neighbors"].to<JsonArray>();
  portENTER_CRITICAL(&readingMux);
  Neighbor copy[16];
  memcpy(copy, neighbors, sizeof(copy));
  portEXIT_CRITICAL(&readingMux);
  for (auto &neighbor : copy) {
    if (neighbor.id[0] && millis() - neighbor.seen <= 45000) peers.add(neighbor.id);
  }
  String body;
  serializeJson(heartbeat, body);
  int status = postToCloud("/v1/heartbeat", body);
  cloudHealthy = status == 200;
  Serial.printf("Heartbeat HTTP %d\n", status);
}

void exportLog() {
  if (!storageReady) { portal.send(503, "text/plain", "Local log unavailable"); return; }
  size_t count = 0, totalBytes = 0;
  {
    FilesystemLock lock;
    count = logPaths.size();
    for (size_t size : logSizes) totalBytes += size + 1;
  }
  WiFiClient peer = portal.client();
  peer.setNoDelay(true);
  portal.sendHeader("Content-Disposition", "attachment; filename=esp32-log.ndjson");
  portal.setContentLength(totalBytes);
  portal.send(200, "application/x-ndjson", "");
  uint32_t started = millis();
  size_t sent = 0;
  bool complete = true;
  Serial.printf("Log export started: %u records, %u bytes\n", count, totalBytes);
  // Only the main loop appends/reclaims index entries. While this handler runs,
  // workers may rename acknowledgments, leaving record bytes and sizes unchanged.
  for (size_t i = 0; i < count && complete; ++i) {
    if (!peer.connected() || millis() - started > 180000) { complete = false; break; }
    String line;
    size_t expected;
    {
      FilesystemLock lock;
      File entry = LittleFS.open(logPaths[i]);
      line = readCommittedRecord(entry);
      expected = logSizes[i];
    }
    esp_task_wdt_reset();
    if (line.length() != expected || !line.length()) { complete = false; break; }
    line += '\n';
    size_t written = peer.write(reinterpret_cast<const uint8_t *>(line.c_str()), line.length());
    sent += written;
    complete = written == line.length();
    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(1));
    if ((i + 1) % 32 == 0) Serial.printf("Log export progress: %u/%u\n", i + 1, count);
  }
  if (!complete || sent != totalBytes) peer.stop();
  Serial.printf("Log export %s: %u/%u bytes in %lu ms\n", complete && sent == totalBytes ? "complete" : "canceled", sent, totalBytes, millis() - started);
}

void startPortal() {
  WiFi.mode(WIFI_AP_STA);
  String name = "ESP32-Setup-" + nodeId.substring(6);
  if (!WiFi.softAP(name.c_str(), apPassword.c_str(), 1, false, 1)) {
    WiFi.mode(WIFI_STA);
    return;
  }
  formToken = randomHex(16);
  Serial.printf("Setup Wi-Fi %s password %s, open http://192.168.4.1\n", name.c_str(), apPassword.c_str());
  dns.start(53, "*", WiFi.softAPIP());
  portal.begin();
  portalActive = true;
  portalStarted = millis();
}

void closePortal() {
  if (!portalActive) return;
  portal.stop();
  dns.stop();
  WiFi.softAPdisconnect(false);
  WiFi.mode(WIFI_STA);
  portalActive = false;
  touched = false;
  nextWifi = millis();
  Serial.println("Setup AP closed; saved settings retained");
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
    if (!configureHttp(http, tls, url, 4096)) {
      Serial.println("OTA rejected download URL");
      return false;
    }
    const char *headers[] = {"Location"};
    http.collectHeaders(headers, 1);
    http.useHTTP10(true);
    int status = http.GET();
    Serial.printf("OTA HTTPS hop=%d status=%d length=%d\n", hop, status, http.getSize());
    if (status == 200) return true;
    url = http.header("Location");
    http.end();
    if (status != 301 && status != 302 && status != 307 && status != 308) return false;
    esp_task_wdt_reset();
  }
  return false;
}

bool checkOta() {
  if (!FLEET_ALLOW_OTA) return true;
  String manifest = config["ota"].as<String>();
  if (!manifest.length()) return true;
  Serial.println("OTA checking manifest");
  VerifiedClient tls;
  HTTPClient http;
  if (!assetGet(http, tls, manifest)) return false;
  JsonDocument data;
  // Parse through a small fixed buffer so an invalid manifest cannot exhaust RAM.
  std::unique_ptr<char[]> json(new (std::nothrow) char[2048]);
  if (!json) return false;
  int manifestSize = http.getSize();
  if (manifestSize <= 0 || manifestSize >= 2048 ||
      http.getStream().readBytes(json.get(), manifestSize) != static_cast<size_t>(manifestSize)) return false;
  auto error = deserializeJson(data, json.get(), manifestSize);
  json.reset();
  http.end();
  if (error || data["board"].as<String>() != "esp32dev") return false;
  if ((data["storageSchema"] | 0) != 2) {
    Serial.println("OTA rejected: firmware must support log storage schema 2");
    return false;
  }
  String version = data["version"].as<String>(), hash = data["sha256"].as<String>();
  if (version == FLEET_VERSION) return true;
  if (version == settings.getString("attempted", "")) return false;
  if (version.length() != 40 || hash.length() != 64 || !assetGet(http, tls, data["url"].as<String>())) return false;
  int size = http.getSize();
  if (size <= 0 || size != (data["size"] | 0) || !Update.begin(size)) return false;
  mbedtls_sha256_context digest;
  mbedtls_sha256_init(&digest);
  mbedtls_sha256_starts_ret(&digest, 0);
  std::unique_ptr<uint8_t[]> block(new (std::nothrow) uint8_t[1024]);
  if (!block) { Update.abort(); mbedtls_sha256_free(&digest); return false; }
  uint8_t actual[32];
  int remaining = size;
  while (remaining) {
    size_t requested = min(remaining, 1024);
    size_t received = http.getStream().readBytes(block.get(), requested);
    if (received != requested || Update.write(block.get(), received) != received) break;
    mbedtls_sha256_update_ret(&digest, block.get(), received);
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
  Serial.printf("OTA verified version=%s bytes=%d; restarting\n", version.c_str(), size);
  ESP.restart();
  return true;
}

void setup() {
  Serial.setRxBufferSize(4096);
  Serial.begin(115200);
  filesystemMutex = xSemaphoreCreateRecursiveMutex();
  handshakeMutex = xSemaphoreCreateMutex();
  if (!filesystemMutex || !handshakeMutex) { Serial.println("Mutex initialization failed"); ESP.restart(); }
  arduino_esp_crt_bundle_set(caBundle);
  esp_crt_bundle_attach(nullptr);
  setenv("TZ", "IST-5:30", 1);
  tzset();
  pinMode(StatusLed, OUTPUT);
  esp_task_wdt_init(45, true);
  esp_task_wdt_add(nullptr);
  char id[20];
  snprintf(id, sizeof(id), "esp32-%012llx", static_cast<unsigned long long>(ESP.getEfuseMac()));
  nodeId = id;
  bootId = randomHex(16);
  Serial.printf("Node %s, firmware %s, reset %d\n", id, FLEET_VERSION, esp_reset_reason());
  settings.begin("fleet", false);
  apPassword = settings.getString("apKey", "");
  if (apPassword.length() < 8) {
    apPassword = randomHex(8);
    settings.putString("apKey", apPassword);
  }
  deserializeJson(config, settings.getString("config", "{}"));
  beginSensor();
  storageReady = LittleFS.begin(false);
  esp_ota_img_states_t state;
  pendingVerification = esp_ota_get_state_partition(esp_ota_get_running_partition(), &state) == ESP_OK &&
    state == ESP_OTA_IMG_PENDING_VERIFY;
  if (storageReady) nextSequence = scanLog().maxSequence + 1;
  else Serial.println("LittleFS unavailable; see first-flash instructions");
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  portal.on("/", HTTP_GET, [] {
    if (portal.client().localIP() != WiFi.softAPIP()) { portal.send(403); return; }
    portal.send_P(200, "text/html", PortalPage);
  });
  portal.on("/settings", HTTP_GET, [] {
    if (portal.client().localIP() != WiFi.softAPIP()) { portal.send(403); return; }
    JsonDocument view;
    for (auto key : {"ssid", "base", "ota"}) view[key] = config[key] | "";
    view["endpoint"] = config["endpoint"] | "/v1/telemetry";
    view["sensitivity"] = config["sensitivity"] | 1.0f;
    view["touch"] = config["touch"] | 30;
    view["interval"] = config["interval"] | 60;
    view["motionThreshold"] = config["motionThreshold"] | 1.5f;
    view["token"] = formToken;
    view["node"] = nodeId;
    view["version"] = FLEET_VERSION;
    String body;
    serializeJson(view, body);
    portal.sendHeader("Cache-Control", "no-store");
    portal.send(200, "application/json", body);
  });
  portal.on("/settings", HTTP_POST, [] {
    if (portal.client().localIP() != WiFi.softAPIP()) { portal.send(403); return; }
    saveSettings();
  });
  portal.on("/log", HTTP_GET, [] {
    if (portal.client().localIP() != WiFi.softAPIP()) { portal.send(403); return; }
    exportLog();
  });
  portal.on("/status", HTTP_GET, [] {
    if (portal.client().localIP() != WiFi.softAPIP()) { portal.send(403); return; }
    JsonDocument status;
    status["nodeId"] = nodeId;
    status["timeIst"] = timeInIst(time(nullptr));
    status["pending"] = storageReady ? scanLog().pendingCount : 0;
    bool reported = lastCloudSuccess.load() && millis()-lastCloudSuccess.load() < CloudTimeout;
    status["connection"] = reported ? "Cloud connected" : WiFi.status()==WL_CONNECTED ? "Wi-Fi connected; cloud pending" : "Wi-Fi reconnecting";
    String response;
    serializeJson(status, response);
    portal.sendHeader("Cache-Control", "no-store");
    portal.send(200, "application/json", response);
  });
  portal.on("/logs", HTTP_GET, [] {
    if (portal.client().localIP() != WiFi.softAPIP()) { portal.send(403); return; }
    if (otaActive) { portal.send(503, "text/plain", "Firmware update in progress. Retry shortly."); return; }
    TransportBudget budget;
    if (!budget.acquired) { portal.send(503); return; }
    // Keep only one parsed record in RAM, leaving room for cloud TLS.
    String body;
    if (!body.reserve(32768)) { portal.send(503, "text/plain", "Retry when memory is available."); return; }
    body = "[";
    bool first = true;
    if (storageReady) {
      FilesystemLock lock;
      std::vector<size_t> paths;
      for (size_t i = 0; i < logPaths.size(); ++i) paths.push_back(i);
      std::sort(paths.begin(), paths.end(), [](size_t a, size_t b) { return recordSequence(logPaths[a]) > recordSequence(logPaths[b]); });
      for (size_t i = 0; i < paths.size() && i < 30; ++i) {
        File file = LittleFS.open(logPaths[paths[i]]);
        JsonDocument record;
        String line = readCommittedRecord(file);
        if (line.length() && !deserializeJson(record, line)) {
          if (!first) body += ',';
          body += line;
          first = false;
        }
        esp_task_wdt_reset();
      }
    }
    body += ']';
    portal.sendHeader("Cache-Control", "no-store");
    portal.send(200, "application/json", body);
  });
  portal.onNotFound([] {
    if (portal.client().localIP() != WiFi.softAPIP()) { portal.send(403); return; }
    portal.sendHeader("Location", "http://192.168.4.1/");
    portal.send(302, "text/plain", "");
  });
  if (!config["ssid"].is<const char *>()) startPortal();
  nextOta = millis() + 60000 + esp_random() % 60000;
  xTaskCreatePinnedToCore([](void *) {
    esp_task_wdt_add(nullptr);
    for (;;) {
      esp_task_wdt_reset();
      if (WiFi.status() == WL_CONNECTED) {
        if (due(millis(), nextUpload)) uploadOne();
        esp_task_wdt_reset();
        if (!pendingVerification.load() && time(nullptr) >= 1577836800 && due(millis(), nextOta)) {
          otaActive = true;
          bool ok = checkOta();
          otaActive = false;
          nextOta = millis() + (ok ? 900000UL : 120000UL) + esp_random() % 30000;
        }
      }
      vTaskDelay(pdMS_TO_TICKS(50));
    }
  }, "fleetUpload", 16384, nullptr, 1, &networkTaskHandle, 1);
  xTaskCreatePinnedToCore([](void *) {
    esp_task_wdt_add(nullptr);
    for (;;) {
      esp_task_wdt_reset();
      if (WiFi.status() == WL_CONNECTED && due(millis(), nextHeartbeat)) sendHeartbeat();
      vTaskDelay(pdMS_TO_TICKS(50));
    }
  }, "fleetStatus", 16384, nullptr, 1, &heartbeatTaskHandle, 1);
  if (!networkTaskHandle || !heartbeatTaskHandle) { Serial.println("Network task initialization failed"); ESP.restart(); }
  auto timer = xTimerCreate("statusLED", pdMS_TO_TICKS(50), pdTRUE, nullptr, [](TimerHandle_t) {
    uint32_t phase = millis() % 2000;
    bool reported = lastCloudSuccess.load() && millis()-lastCloudSuccess.load() < CloudTimeout;
    bool on;
    if (portalActive.load()) on = phase % 250 < 125;
    else if (!currentReading().valid || !storageReady) on = phase < 100 || (phase >=200 && phase<300) || (phase>=400 && phase<500);
    else if (WiFi.status() != WL_CONNECTED) on = phase % 1000 < 500;
    else if (!reported) on = phase < 120 || (phase >=250 && phase <370);
    else on = true;
    digitalWrite(StatusLed, on ? HIGH : LOW);
  });
  if (timer) xTimerStart(timer, 0);
  verificationStarted = millis();
}

void loop() {
  esp_task_wdt_reset();
  serviceSerial();
  uint32_t now = millis();
  serviceSensor(now);
  if (pendingVerification) {
    if (storageReady && sensorAddress && cloudHealthy && WiFi.status() == WL_CONNECTED &&
        time(nullptr) >= 1577836800 && now - verificationStarted >= 20000) {
      pendingVerification = esp_ota_mark_app_valid_cancel_rollback() != ESP_OK;
      if (!pendingVerification) Serial.println("OTA boot confirmed: storage, sensor and cloud heartbeat healthy");
    } else if (now - verificationStarted >= 180000) {
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
      closePortal();
    }
  }
  if (WiFi.status() == WL_CONNECTED) {
    wifiLostAt = 0;
    serviceDiscovery();
    if (!ntpStarted) { configTzTime("IST-5:30", "pool.ntp.org", "time.google.com"); ntpStarted = true; }
  } else if (due(now, nextWifi) && config["ssid"].is<const char *>()) {
    WiFi.begin(config["ssid"].as<const char *>(), config["password"] | "");
    nextWifi = now + 30000;
  }
  if (WiFi.status() != WL_CONNECTED) {
    if (!wifiLostAt) wifiLostAt = now;
    if (!portalActive && now - wifiLostAt > 30000) startPortal();
  }
  delay(20);
}
