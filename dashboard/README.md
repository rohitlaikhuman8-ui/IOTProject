# Dashboard and ingest API

This Next.js application hosts the password-protected dashboard and `POST /v1/telemetry`. MongoDB access runs on the server.

```powershell
Copy-Item .env.example .env.local
# Configure a development database and credentials.
npm install
npm run dev
```

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Dashboard queries, shared-password sign-in, sessions |
| `app/layout.tsx` | HTML shell |
| `app/v1/telemetry/route.ts` | Payload validation, node authentication, deduplicated write |
| `lib/fleet.ts` | Zod schemas, MongoDB connection, constant-time secret comparison |
| `.env.example` | Server environment placeholders |

Set Vercel's Root Directory to `dashboard`. See [deployment](../docs/DEPLOYMENT.md) and the [API reference](../docs/API.md).
