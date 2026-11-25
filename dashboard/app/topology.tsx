'use client';

import { useEffect, useState } from 'react';
import { formatIst } from '../lib/time';

type Node = {
  nodeId: string; lastSeen: string | null; version?: string; rssi?: number; ssid?: string;
  calibrationRevision?: string;
  channel?: number; storageReady?: boolean; sensorReady?: boolean; logRecords?: number; neighbors?: string[];
  lastMeasurement?: { value: number; unit?: string; acceleration?: { x: number; y: number; z: number } };
  acceleration?: { x: number; y: number; z: number }; value?: number;
  mode?: 'running' | 'setup' | 'updating'; timeSynced?: boolean; pendingRecords?: number;
};
type Notification = { _id: string; nodeId: string; kind: string; at: string; message: string; movementDelta?: number };
type Event = { _id: string; nodeId: string; receivedAt: string; sampledAt?: number; value: number;
  calibrationRevision?: string;
  kind?: string; movementDelta?: number; acceleration?: { x: number; y: number; z: number } };
type Snapshot = { serverTime: number; onlineTimeoutMs?: number; nodes: Node[];
  notifications?: Notification[]; events?: Event[] };

export default function Topology({ selectedNode }: { selectedNode?: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(0);
  const [received, setReceived] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    async function refresh() {
      try {
        const response = await fetch('/api/topology' + (selectedNode ? '?node=' + selectedNode : ''), { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 ? 'Session expired. Reload to sign in.' : 'Live connection unavailable. Retrying.');
        const data: Snapshot = await response.json();
        if (!Array.isArray(data.nodes) || !Number.isFinite(data.serverTime)) throw new Error('Invalid status response.');
        setSnapshot(data);
        setReceived(performance.now());
        setError('');
        failures = 0;
      } catch (error) {
        if (controller.signal.aborted) return;
        setError((error as Error).message);
        failures++;
      }
      if (!controller.signal.aborted) timer = setTimeout(refresh, Math.min(30000, 3000 * 2 ** Math.min(failures, 4)));
    }
    refresh();
    const tick = setInterval(() => setClock(performance.now()), 1000);
    return () => { controller.abort(); clearTimeout(timer); clearInterval(tick); };
  }, [selectedNode]);

  const nodes = snapshot?.nodes || [];
  const now = (snapshot?.serverTime || 0) + Math.max(0, clock - received);
  const stale = Boolean(snapshot && clock - received > 15000);
  const online = (node: Node) => Boolean(!stale && node.lastSeen && now - Date.parse(node.lastSeen) < (snapshot?.onlineTimeoutMs || 90000));
  const healthy = (node: Node) => node.sensorReady && node.storageReady;
  const color = (node: Node) => !online(node) ? '#64748b' : healthy(node) ? '#067647' : '#b54708';
  const status = (node: Node) => !node.lastSeen ? 'Last seen unavailable · awaiting first report' :
    !online(node) ? 'Last seen ' + formatIst(node.lastSeen) :
    node.mode === 'updating' ? 'Online · updating firmware' : node.mode === 'setup' ? 'Online · setup active' :
    healthy(node) ? 'Online' : 'Online · check hardware';
  const positions = new Map(nodes.map((node, i) => [node.nodeId,
    { x: 140 + i % 4 * 240, y: 230 + Math.floor(i / 4) * 190 }]));
  const height = Math.max(440, 330 + Math.ceil(nodes.length / 4) * 190);
  const edges: { from: string; to: string; mutual: boolean }[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (!online(node)) continue;
    for (const peer of node.neighbors || []) {
      const target = nodes.find(n => n.nodeId === peer);
      const key = [node.nodeId, peer].sort().join(':');
      if (!target || !online(target) || seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: node.nodeId, to: peer, mutual: Boolean(target.neighbors?.includes(node.nodeId)) });
    }
  }

  return <section aria-labelledby="topology-title">
    <h2 id="topology-title">Live network topology</h2>
    <p role="status">{error || (!snapshot ? 'Connecting…' : stale ? 'Status is stale.' :
      nodes.filter(online).length + ' of ' + nodes.length + ' registered nodes online')}</p>
    {snapshot && <p>Server time {formatIst(now)}</p>}
    <p>Every node connects directly to Vercel through its own Wi-Fi network. Green lines show a recent cloud heartbeat.
      Purple lines show authenticated ESP-NOW radio neighbors on the same channel.</p>
    <div style={{ overflowX: 'auto', border: '1px solid #d0d5dd', borderRadius: 12, background: '#f8fafc' }}>
      <svg role="img" aria-label="Cloud uplinks and observed radio neighbor connections"
        viewBox={'0 0 1000 ' + height} style={{ width: '100%', minWidth: 740, display: 'block' }}>
        <title>ESP32 fleet network topology</title>
        <rect x="380" y="25" width="240" height="68" rx="14" fill="#152a45" />
        <text x="500" y="53" textAnchor="middle" fill="white" fontSize="19">Vercel dashboard</text>
        <text x="500" y="77" textAnchor="middle" fill="#cbd5e1" fontSize="13">Independent cloud uplinks</text>
        {nodes.map(node => {
          const p = positions.get(node.nodeId)!;
          return <line key={node.nodeId} x1="500" y1="93" x2={p.x} y2={p.y - 40}
            stroke={color(node)} strokeWidth="2" strokeOpacity=".55" strokeDasharray={online(node) ? undefined : '6 6'} />;
        })}
        {edges.map(edge => {
          const a = positions.get(edge.from)!, b = positions.get(edge.to)!;
          return <line key={edge.from + edge.to} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="#7f56d9" strokeWidth="3" strokeDasharray={edge.mutual ? undefined : '5 5'} />;
        })}
        {nodes.map(node => {
          const p = positions.get(node.nodeId)!;
          return <g key={node.nodeId}>
            <rect x={p.x - 110} y={p.y - 40} width="220" height="110" rx="12" fill="white" stroke={color(node)} strokeWidth="2"/>
            <text x={p.x} y={p.y - 16} textAnchor="middle" fontSize="13" fontWeight="bold">{node.nodeId}</text>
            <text x={p.x} y={p.y + 7} textAnchor="middle" fontSize="12" fill={color(node)}>
              {online(node) ? node.mode === 'updating' ? 'Online · updating' : 'Online' : node.lastSeen ? 'Last seen · see status below' : 'Awaiting first report'}</text>
            <text x={p.x} y={p.y + 30} textAnchor="middle" fontSize="12">{node.ssid || 'Wi-Fi not reported'}</text>
            <text x={p.x} y={p.y + 50} textAnchor="middle" fontSize="12">
              {node.rssi !== undefined ? node.rssi + ' dBm · channel ' + node.channel : 'No signal report'}</text>
          </g>;
        })}
        {!nodes.length && <text x="500" y="220" textAnchor="middle" fill="#475467">Register a node to start monitoring.</text>}
      </svg>
    </div>
    <p>Heartbeats every 5 seconds · view refresh every 3 seconds · last seen after 90 seconds without a cloud report.
      A node with no radio neighbors can still upload independently.</p>
    <h2>Nodes</h2>
    <div style={{ overflowX: 'auto' }}>
      <table cellPadding="8"><thead><tr><th>Node</th><th>Connection</th><th>Sensor</th><th>Storage</th><th>Local / pending</th><th>Live magnitude (m/s²)</th><th>X/Y/Z (m/s²)</th><th>Last cloud report (IST)</th></tr></thead>
        <tbody>{nodes.map(node => <tr key={node.nodeId}>
          <td><a href={'/?node=' + node.nodeId}>{node.nodeId}</a><br/><small>{node.version?.slice(0,12)}</small>
            <br/><small>Calibration: {node.calibrationRevision && node.calibrationRevision !== 'none' ? node.calibrationRevision : 'Not applied'}</small></td><td>{status(node)}</td>
          <td>{node.sensorReady === undefined ? 'Unknown' : node.sensorReady ? 'Responding' : 'Check sensor'}</td>
          <td>{node.storageReady === undefined ? 'Unknown' : node.storageReady ? 'Ready' : 'Check flash'}</td>
          <td>{node.logRecords ?? '—'} / {node.pendingRecords ?? '—'}</td><td>{(node.value ?? node.lastMeasurement?.value)?.toFixed(3) ?? '—'}</td>
          <td>{(node.acceleration || node.lastMeasurement?.acceleration) ?
            Object.values((node.acceleration || node.lastMeasurement?.acceleration)!).map(n => n.toFixed(3)).join(' / ') : '—'}</td>
          <td>{node.lastSeen ? formatIst(node.lastSeen) : 'No report yet'}</td>
        </tr>)}</tbody></table>
    </div>
    {selectedNode && <p>History filtered to {selectedNode}. <a href="/">Show all nodes</a></p>}
    <h2>Notification history</h2>
    <p>Movement is highlighted. Times are recorded by the server and displayed in IST.</p>
    <div style={{ overflowX: 'auto', maxHeight: 450 }}>
      <table cellPadding="8"><thead><tr><th>Server time (IST)</th><th>Node</th><th>Event</th><th>Details</th></tr></thead>
        <tbody>{(snapshot?.notifications || []).map(notice => <tr key={notice._id}
          style={{ background: notice.kind === 'movement' ? '#fff0c2' : undefined }}>
          <td>{formatIst(notice.at)}</td><td>{notice.nodeId}</td><td><strong>{notice.kind}</strong></td>
          <td>{notice.message}{notice.movementDelta !== undefined ? ' · change ' + notice.movementDelta.toFixed(3) + ' m/s²' : ''}</td>
        </tr>)}</tbody></table>
      {!snapshot?.notifications?.length && <p>No recorded notifications yet.</p>}
    </div>
    <h2>Recent telemetry</h2>
    <div style={{ overflowX: 'auto', maxHeight: 500 }}>
      <table cellPadding="8"><thead><tr><th>Server received (IST)</th><th>Captured (IST)</th><th>Node</th><th>Event</th><th>Magnitude</th><th>X / Y / Z (m/s²)</th></tr></thead>
        <tbody>{(snapshot?.events || []).map(record => <tr key={record._id}
          style={{ background: record.kind === 'movement' ? '#fff0c2' : undefined }}>
          <td>{formatIst(record.receivedAt)}</td><td>{record.sampledAt ? formatIst(record.sampledAt * 1000) : 'Time sync pending at capture'}</td>
          <td>{record.nodeId}<br/><small>Calibration: {record.calibrationRevision && record.calibrationRevision !== 'none' ? record.calibrationRevision : 'Not applied'}</small></td><td>{record.kind || 'sample'}</td><td>{record.value.toFixed(3)}</td>
          <td>{record.acceleration ? Object.values(record.acceleration).map(n => n.toFixed(3)).join(' / ') : '—'}</td>
        </tr>)}</tbody></table>
    </div>
  </section>;
}
