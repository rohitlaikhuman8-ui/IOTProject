# Troubleshooting

## USB and build

| Symptom | Check and action |
| --- | --- |
| Board absent from port list | Try a data USB cable, another USB port, and the correct USB-serial driver |
| Port busy | Close serial monitors before upload |
| Upload waits at Connecting | Hold BOOT while connecting, release after writing starts, consult board reset sequence |
| Dependency download fails | Restore network access and rerun PlatformIO, inspect proxy and certificate configuration |
| Firmware exceeds OTA slot | Inspect build size, reduce code or plan a deliberate partition-layout migration |

## Wi-Fi and portal

| Symptom | Check and action |
| --- | --- |
| No setup AP | Read serial, verify power, hold GPIO 4 for four seconds, calibrate threshold |
| AP starts unexpectedly | Raise or lower threshold based on actual released/touched readings, inspect pad wiring |
| Captive popup absent | Stay connected to setup AP despite no internet, open `http://192.168.4.1/` directly |
| Cannot join AP | Use the latest password printed on serial, only one client is permitted |
| AP disappears | The 15-minute setup window expired or settings triggered restart |
| Save returns 400 | Check origin/path, password lengths, secret length, numeric limits |
| Save returns 403 | Reload the panel for its current form token |
| Device stays offline | Check 2.4 GHz network, SSID/password, signal, router, DHCP |
| Touch responds late | HTTP operations can block the loop until their timeout |

## Uploads

Read the serial line `Upload deferred (HTTP ...)`. Codes below can come from the application or hosting layer.

| Code or symptom | Action |
| --- | --- |
| Negative HTTP result | Check TLS trust, DNS, network, HTTPS URL, and reachable origin |
| 301/302/307/308 on ingest | Use the final canonical origin and exact path, ingestion does not follow redirects |
| 400 | Compare payload with [API schema](API.md) |
| 401 | Check exact lowercase Node ID, secret mapping, portal secret, and production redeployment |
| 413 | Ensure body is at most 1024 UTF-8 bytes and Content-Length is supplied |
| 503 | Check Atlas credentials, network access, availability, and database permissions |
| Vercel login HTML | Deployment Protection intercepted the request before ingestion |
| No upload attempts | Check saved backend, Wi-Fi, local filesystem, and SNTP clock sync |
| One record repeatedly fails | A permanently invalid oldest pending record blocks later records, export logs and repair the source of the invalid payload before intentional storage recovery |
| Count grows rapidly after reconnect | An offline backlog is draining |

Browser access through a temporary share link does not make the base endpoint reachable by ESP32 nodes. Configure an owner-approved production protection policy suitable for the ingest endpoint before commissioning.

## Dashboard

| Symptom | Action |
| --- | --- |
| Vercel login appears first | Complete authorized Vercel access or review production protection settings |
| Password rejected | Confirm the deployed `DASHBOARD_PASSWORD`, rotate and redeploy if necessary |
| Login returns server error | Inspect Vercel runtime logs, Atlas network rules, URI, and user roles |
| No nodes | Register and commission a real node, check ingestion responses |
| Stale values | Reload the page, compare receive time and optional sample time |
| Missing older events | UI shows only the latest 100, query/export Atlas for historical analysis |

## Storage and resets

Repeated brownouts usually require a better supply, cable, or load management. Reset codes are included in every event. Refer to the ESP-IDF reset reason enumeration for exact chip/framework meanings.

`LittleFS unavailable` means logging and uploading cannot proceed. Complete initial filesystem provisioning on a new board. For an existing board, inspect power and export readable data before choosing a filesystem replacement.

`Log full; unsent records preserved` means all retained slots are pending. Restore connectivity before new measurements can be stored.

NVS errors can prevent settings persistence. Do not erase the whole chip as the first response. Record the device ID, export logs, and capture configuration privately before deliberate recovery.

## OTA

1. Confirm the GitHub Actions run succeeded.
2. Open the stable manifest URL and verify it points to an existing asset.
3. Compare `board`, version SHA, byte count, and SHA-256.
4. Confirm the device portal contains the exact manifest URL.
5. Check internet connectivity, time sync, and an OTA-sized free application slot.
6. Allow a full polling interval while the node remains online.
7. If the image was previously attempted and failed, publish a corrected new commit SHA.
8. Use USB recovery if the device cannot reach a working image.

Docs-only pushes do not trigger firmware publication. Release URLs for a private repository require a separate accessible artifact host.
