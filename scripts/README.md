# Documentation capture

`capture-docs.cjs` uses Playwright to capture dashboard sign-in, an authenticated fleet view, and the actual firmware portal HTML with sample settings.

Run it from the repository root. The script reads the existing ignored `dashboard/.env.local` for the operator password. It closes the browser after capture and does not save browser authentication state.

See [screenshot instructions](../docs/images/README.md) for installation, temporary authorized Vercel access, and regeneration commands.

`serial-check.py` uses pyserial to inspect COM5, read the sensor, and check local logging. Use `--reset` only when a reboot is intended. `--config work/node-config.json` provisions a private USB configuration without echoing credentials. `--command portal` opens the AP for commissioning checks.

`export-arduino.ps1` exports the same firmware source into an ignored Arduino IDE sketch. See [the node record](../docs/NODE-COM5.md).
