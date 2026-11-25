# Telemetry API

## Request

```http
POST /v1/telemetry
Content-Type: application/json
Authorization: Bearer <node-specific-secret>
Content-Length: <UTF-8 byte count>
```

Production origin is `https://esp32-fleet-iot-project3.vercel.app`. The current route requires Content-Length between 1 and 1024 bytes. Chunked requests without that header are rejected.

The API authenticates against the entry for the payload's ID in `NODE_SECRETS_JSON`. The dashboard password is a distinct credential.

## Payload

```json
{
  "nodeId": "esp32-012345abcdef",
  "eventId": "aabbccddaabbccddaabbccddaabbccdd",
  "uptimeMs": 60000,
  "sampledAt": 1794546000,
  "value": 42.5,
  "sensitivity": 1,
  "resetReason": 1,
  "version": "usb-dev"
}
```

| Field | Meaning and validation |
| --- | --- |
| nodeId | Required `esp32-` plus 12 lowercase hex digits |
| eventId | Required 32 lowercase hex digits, stable across retries |
| uptimeMs | Nonnegative integer, milliseconds since boot, wraps with device millis |
| sampledAt | Optional Unix seconds, 1577836800–4102444800 |
| value | Required finite number |
| sensitivity | Required number, 0.01–100 |
| resetReason | Required nonnegative ESP reset code |
| version | Required string, up to 64 characters |
| kind | Optional `sample` or `movement`, defaults to sample |
| bootId | Optional 32 lowercase hex digits identifying one boot |
| movementDelta | Optional nonnegative acceleration change in m/s² |
| calibrationRevision | Optional 1–32 letters, digits, hyphens or underscores; `none` means identity defaults |

Atlas adds a BSON date `receivedAt` and `_id = nodeId:eventId`.

Server-generated receive times are authoritative and displayed in IST. API responses include serverTime epoch milliseconds and timezone Asia/Kolkata. The verified HTTP Date header also allows the node to synchronize without reading a response body or waiting for SNTP.

The heartbeat accepts bootId, mode (running/setup/updating), timeSynced, pendingRecords and current acceleration/value. The live API returns the latest 100 persisted notifications and telemetry events, plus Online/Last-seen metadata based on the latest accepted server report.

Calibration-capable firmware includes `calibrationRevision` in both events and heartbeats. The API persists it without rewriting older events. Missing/`none` revisions are displayed as Not applied; an explicitly configured identity revision remains visible. Corrected axes precede magnitude/sensitivity calculation. See [calibration operations and evidence](CALIBRATION.md).

ADXL345 events additionally include `sensor: "ADXL345"`, `unit: "m/s2"`, and `acceleration: {x, y, z}` with finite numbers. These fields are optional for compatibility with older events. The summary value is magnitude times sensitivity. Authenticated heartbeats use `POST /v1/heartbeat`, and signed-in topology reads use `GET /api/topology`. See [topology](TOPOLOGY.md).

## Responses

| HTTP | Meaning | Action |
| --- | --- | --- |
| 200 | `{"accepted":true}` | Mark local record acknowledged |
| 400 | Invalid telemetry | Inspect fields, keep queued |
| 401 | Unauthorized node or secret | Correct registration or portal secret |
| 413 | Invalid request length | Check Content-Length and byte count |
| 503 | Temporarily unavailable | Keep queued and retry |

503 includes `Retry-After: 15`. The current firmware uses its own exponential backoff. Other failures also leave records queued.

## Deduplication

Upsert uses `$setOnInsert` with majority write concern. Repeating a Node ID/event ID pair acknowledges the original record. Changed values under that same ID do not replace the original sample.

## PowerShell ingest check

Use a registered development node ID and matching secret. This command writes a real record.

```powershell
$nodeId = 'esp32-012345abcdef' # Replace with a registered development ID.
$secureSecret = Read-Host 'Node API secret' -AsSecureString
$credential = [pscredential]::new('node', $secureSecret)
$secret = $credential.GetNetworkCredential().Password
$eventId = [guid]::NewGuid().ToString('N')
$record = @{
    nodeId = $nodeId
    eventId = $eventId
    uptimeMs = 60000
    sampledAt = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    value = 42.5
    sensitivity = 1
    resetReason = 1
    version = 'manual-api-check'
}
$body = [Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress))
$headers = @{ Authorization = "Bearer $secret" }
Invoke-RestMethod -Method Post -Uri 'https://esp32-fleet-iot-project3.vercel.app/v1/telemetry' -ContentType 'application/json' -Headers $headers -Body $body
```

Repeat the last request without generating a new event ID to check deduplication. Reload the dashboard and confirm only one record exists for that event. Keep live secrets out of committed scripts.

## Device-local routes

| Route | Purpose |
| --- | --- |
| `GET /` | Portal HTML |
| `GET /settings` | Nonsecret settings, Node ID, version, form token |
| `POST /settings` | Form-urlencoded settings with current token |
| `GET /log` | Committed pending and acknowledged records as NDJSON |
| `GET /logs` | Latest 30 committed records as JSON |
| `GET /status` | Current connection, IST time, storage and pending count |
| Other paths | Redirect to portal origin |

These routes run on the setup AP.
