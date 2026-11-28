'use client';

import { useEffect, useRef, useState } from 'react';
import { formatIst } from '../lib/time';

type Backup = { date: string; verifiedAt: string; snapshot: string; rows: number; fileId: string };
type BackupStatus = { configured: boolean; backups: Backup[] };
export default function DailyExports({ yesterday, today, nodeIds, selectedNode }: {
  yesterday: string; today: string; nodeIds: string[]; selectedNode?: string;
}) {
  const [date, setDate] = useState(yesterday);
  const [node, setNode] = useState(selectedNode || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<BackupStatus>();
  const [backupError, setBackupError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch('/api/exports/backup', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error();
        setBackup(await response.json()); setBackupError('');
      } catch { if (!controller.signal.aborted) setBackupError('Drive backup status unavailable. Refresh to retry.'); }
    }
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => { controller.abort(); clearInterval(timer); active.current?.abort(); };
  }, []);
  async function download() {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setMessage('Preparing export…');
    try {
      const parts: string[] = ['\ufeff'];
      let cursor = '', snapshot = '', rows = 0, total = -1, bytes = 3, filename = '';
      const seen = new Set<string>();
      do {
        const params = new URLSearchParams({ date, ...(node ? { node } : {}),
          ...(snapshot ? { snapshot } : {}), ...(cursor ? { cursor } : {}) });
        const response = await fetch('/api/exports/day?' + params, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 ? 'Session expired. Sign in again.' : 'Export failed. Retry; no partial file was saved.');
        const page = await response.json();
        if (page.date !== date || page.node !== node || (snapshot && page.snapshot !== snapshot) ||
          !Number.isInteger(page.rows) || typeof page.csv !== 'string' || typeof page.header !== 'string' ||
          !(page.nextCursor === null || typeof page.nextCursor === 'string')) throw new Error('Invalid export response.');
        if (!snapshot) {
          snapshot = page.snapshot; total = page.total; filename = page.filename;
          if (!Number.isInteger(total) || total < 0 || total > 1000000) throw new Error('Export too large; select one node.');
          parts.push(page.header);
        }
        parts.push(page.csv); rows += page.rows;
        bytes += new TextEncoder().encode(page.csv).length;
        if (bytes > 50000000 || rows > total) throw new Error('Export exceeded its size/count limit. Select one node or retry.');
        cursor = page.nextCursor || '';
        if (cursor && seen.has(cursor)) throw new Error('Export cursor did not advance.');
        seen.add(cursor);
        setMessage(`Preparing ${rows.toLocaleString()} of ${total.toLocaleString()} readings…`);
      } while (cursor);
      if (rows !== total) throw new Error('Record count changed during export. Retry; no partial file was saved.');
      const url = URL.createObjectURL(new Blob(parts, { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage(`Downloaded ${rows.toLocaleString()} readings for ${date}. Snapshot ${formatIst(snapshot)}.${rows === 0 ? ' No readings were stored for this period.' : ''}`);
    } catch (error) {
      setMessage(controller.signal.aborted ? 'Export cancelled. No partial file was saved.' : (error as Error).message);
    } finally { active.current = null; setBusy(false); }
  }
  const latest = backup?.backups[0];
  const stale = latest && Date.now() - Date.parse(latest.verifiedAt) > 36 * 3600000;
  return <section aria-labelledby="daily-export-title" style={{ border: '1px solid #d0d5dd', borderRadius: 12, padding: 20, marginBlock: 24 }}>
    <h2 id="daily-export-title">Daily data files</h2>
    <p>One CSV for 00:00–24:00 IST. Select all nodes or one node; files open in Excel.</p>
    <form onSubmit={event => { event.preventDefault(); void download(); }}>
      <label>Date (IST) <input type="date" required min="2020-01-01" max={today} value={date}
        disabled={busy} onChange={event => setDate(event.target.value)} /></label>{' '}
      <label>Nodes <select value={node} disabled={busy} onChange={event => setNode(event.target.value)}>
        <option value="">All nodes, including historical readings</option>
        {nodeIds.map(id => <option key={id} value={id}>{id}</option>)}
      </select></label>{' '}
      <button disabled={busy}>{busy ? 'Preparing CSV…' : 'Download CSV'}</button>{' '}
      {busy && <button type="button" onClick={() => active.current?.abort()}>Cancel</button>}
    </form>
    <p role="status" aria-live="polite">{message}</p>
    {date === today && <p>Today is incomplete. Download it again after midnight for the full day.</p>}
    <p>Dates follow capture time when available, otherwise server receipt time. Both timestamps and the time source are included.
      Delayed uploads can change an earlier day; download again for an updated file.</p>
    <h3>Automatic Google Drive copies</h3>
    {backupError ? <p role="alert">{backupError}</p> : !backup ? <p>Checking backup status…</p> :
      !backup.configured ? <p>Drive automation is not configured yet. Manual downloads are available.</p> :
      !latest ? <p>Awaiting Google authorization and the first verified backup. Automatic saving is not active until setup completes.</p> :
      <p>{stale ? 'Backup needs attention. Last verified: ' : 'Last verified backup: '}{latest.date} · {latest.rows.toLocaleString()} readings · {formatIst(latest.verifiedAt)}.
        {' '}<a href={'https://drive.google.com/file/d/' + latest.fileId + '/view'} target="_blank" rel="noreferrer">Open Drive file</a></p>}
    <p>Google checks hourly for completed days and delayed uploads. Your laptop can be off. Files contain received data;
      a missing reading cannot be reconstructed after a node’s local storage fills.</p>
    {backup?.configured && <p><a href="/api/exports/setup">Download private Google Drive setup script</a> ·{' '}
      <a href="https://script.google.com/home/start" target="_blank" rel="noreferrer">Open Google Apps Script</a>.
      Run <code>configureFleetExport</code> once and approve Google access. Treat the downloaded script as a password.</p>}
    {backup && backup.backups.length > 0 && <details><summary>Recent Drive copies</summary><ul>
      {backup.backups.map(item => <li key={item.date}><a href={'https://drive.google.com/file/d/' + item.fileId + '/view'} target="_blank" rel="noreferrer">{item.date}</a>
        {' '}· {item.rows.toLocaleString()} readings · verified {formatIst(item.verifiedAt)}</li>)}
    </ul></details>}
  </section>;
}
