# Documentation capture

`capture-docs.cjs` uses Playwright to capture dashboard sign-in, an authenticated fleet view, and the actual firmware portal HTML with sample settings.

Run it from the repository root. The script reads the existing ignored `dashboard/.env.local` for the operator password. It closes the browser after capture and does not save browser authentication state.

See [screenshot instructions](../docs/images/README.md) for installation, temporary authorized Vercel access, and regeneration commands.
