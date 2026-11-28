import { authenticated } from '../../../../lib/session';
import { DRIVE_SCRIPT } from '../../../../lib/drive-script';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!await authenticated()) return Response.json({ error: 'sign in required' }, { status: 401 });
  if (!process.env.EXPORT_JOB_SECRET) return Response.json({ error: 'export secret not configured' }, { status: 503 });
  const origin = process.env.EXPORT_PUBLIC_ORIGIN || new URL(request.url).origin;
  if (!/^https:\/\/[^/]+$/.test(origin)) return Response.json({ error: 'configure production export origin' }, { status: 503 });
  const bootstrap = '// PRIVATE: this file contains the export job credential. Do not share or commit.\n' +
    'function configureFleetExport() {\n  PropertiesService.getScriptProperties().setProperties(' +
    JSON.stringify({ FLEET_ORIGIN: origin, FLEET_SECRET: process.env.EXPORT_JOB_SECRET,
      ...(process.env.EXPORT_DRIVE_FOLDER_ID ? { FLEET_FOLDER_ID: process.env.EXPORT_DRIVE_FOLDER_ID } : {}) }) + ');\n  installFleetBackup();\n}\n';
  return new Response(bootstrap + DRIVE_SCRIPT, { headers: {
    'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="PRIVATE-fleet-drive-setup.gs"',
    'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff',
  } });
}
