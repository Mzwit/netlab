import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Monitor, Server } from 'lucide-react';
import { OSI } from '../data/knowledge';
import { PageHeader, BookmarkButton } from '../components/ui';
import { store, useStore } from '../lib/store';

const BLOCKS = {
  eth: { label: 'Ethernet header', sub: 'dst/src MAC, EtherType · 14 B', color: '#f59e0b' },
  ip: { label: 'IP header', sub: 'src/dst IP, TTL, proto · 20 B', color: '#38bdf8' },
  tcp: { label: 'TCP header', sub: 'ports, seq/ack, flags · 20 B', color: '#a78bfa' },
  data: { label: 'Data', sub: 'GET / HTTP/1.1 …', color: '#2dd4bf' },
  fcs: { label: 'FCS', sub: 'CRC-32 · 4 B', color: '#f59e0b' },
};
type B = keyof typeof BLOCKS;
const STAGES: { side: 'send' | 'wire' | 'recv'; layer: number; pdu: string; blocks: B[]; text: string }[] = [
  { side: 'send', layer: 7, pdu: 'Data', blocks: ['data'], text: 'The browser (Layers 7–5) produces application data: an HTTP request, encrypted by TLS if HTTPS.' },
  { side: 'send', layer: 4, pdu: 'Segment', blocks: ['tcp', 'data'], text: 'Transport adds a TCP header: source port 52344, destination port 443, sequence and acknowledgement numbers, flags. Data + header = a segment.' },
  { side: 'send', layer: 3, pdu: 'Packet', blocks: ['ip', 'tcp', 'data'], text: 'Network adds an IP header: source and destination IP, TTL, protocol = 6 (TCP). Now it is a packet.' },
  { side: 'send', layer: 2, pdu: 'Frame', blocks: ['eth', 'ip', 'tcp', 'data', 'fcs'], text: 'Data Link adds an Ethernet header (MAC addresses, EtherType 0x0800) and an FCS trailer for error detection. Now it is a frame.' },
  { side: 'wire', layer: 1, pdu: 'Bits', blocks: ['eth', 'ip', 'tcp', 'data', 'fcs'], text: 'Physical turns the frame into signals: voltage on copper, light in fibre or radio waves — a stream of bits.' },
  { side: 'recv', layer: 2, pdu: 'Frame', blocks: ['eth', 'ip', 'tcp', 'data', 'fcs'], text: 'The receiver rebuilds the frame, checks the FCS, sees its own MAC as destination and EtherType 0x0800 → passes the payload to IP. Header and trailer are removed.' },
  { side: 'recv', layer: 3, pdu: 'Packet', blocks: ['ip', 'tcp', 'data'], text: 'IP checks the header checksum and that the destination IP is its own. Protocol 6 → hand the payload to TCP.' },
  { side: 'recv', layer: 4, pdu: 'Segment', blocks: ['tcp', 'data'], text: 'TCP verifies the checksum, orders the data by sequence number, sends an ACK and delivers bytes to the socket on port 443.' },
  { side: 'recv', layer: 7, pdu: 'Data', blocks: ['data'], text: 'The web server application reads the HTTP request. Decapsulation is complete.' },
];

export function Encapsulation() {
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!play) return;
    const t = setTimeout(() => (i < STAGES.length - 1 ? setI(i + 1) : setPlay(false)), 2200);
    return () => clearTimeout(t);
  }, [play, i]);
  const s = STAGES[i];
  const bits = '0100010100000000000001010101110000011100010001100100000000000000';
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="btn btn-sm btn-primary" onClick={() => { if (i === STAGES.length - 1) setI(0); setPlay(!play); }}>{play ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{play ? 'Pause' : 'Play'}</button>
        <button className="btn btn-sm" onClick={() => { setPlay(false); setI(Math.max(0, i - 1)); }} disabled={!i} aria-label="Previous"><ChevronLeft className="h-3.5 w-3.5" /></button>
        <button className="btn btn-sm" onClick={() => { setPlay(false); setI(Math.min(STAGES.length - 1, i + 1)); }} disabled={i === STAGES.length - 1} aria-label="Next"><ChevronRight className="h-3.5 w-3.5" /></button>
        <button className="btn btn-sm" onClick={() => { setPlay(false); setI(0); }}><RotateCcw className="h-3.5 w-3.5" />Restart</button>
        <div className="ml-auto flex gap-1">{STAGES.map((_, k) => <button key={k} onClick={() => { setPlay(false); setI(k); }} aria-label={`Stage ${k + 1}`} className={`h-2 w-5 rounded-full ${k === i ? 'bg-cyan-400' : k < i ? 'bg-cyan-800' : 'bg-ink-600'}`} />)}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-[120px_1fr_120px]">
        <div className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center text-xs ${s.side === 'send' ? 'border-cyan-400 text-cyan-200' : 'border-ink-700 text-slate-500'}`}><Monitor className="mb-1 h-6 w-6" />Sender<br />encapsulates ↓</div>
        <div className="min-h-[180px] rounded-xl border border-ink-700 bg-ink-950/60 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="text-sm font-semibold text-white">Layer {s.layer} · {OSI.find((o) => o.n === s.layer)?.name}</div>
            <div className="chip text-cyan-200">PDU: {s.pdu}</div>
          </div>
          {s.side === 'wire' ? (
            <div className="overflow-hidden font-mono text-xs leading-5 text-slate-400">
              {[0, 1, 2].map((r) => <motion.div key={r} initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: r * 0.15 }}>{bits.slice(r * 16).repeat(2).slice(0, 64).replace(/(.{8})/g, '$1 ')}</motion.div>)}
              <div className="mt-2 text-[11px] text-slate-500">…1 518 bytes × 8 = 12 144 bits on the wire (plus 8-byte preamble)</div>
            </div>
          ) : (
            <div className="flex flex-wrap items-stretch gap-1">
              <AnimatePresence mode="popLayout" initial={false}>
                {s.blocks.map((b) => (
                  <motion.div key={b} layout initial={{ opacity: 0, y: s.side === 'send' ? -24 : 0, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: s.side === 'recv' ? -24 : 0, scale: 0.9 }} transition={{ duration: 0.45 }}
                    className={`rounded-lg border px-3 py-2 ${b === 'data' ? 'min-w-[140px] flex-1' : ''}`} style={{ borderColor: BLOCKS[b].color, background: `${BLOCKS[b].color}1f` }}>
                    <div className="text-xs font-semibold" style={{ color: BLOCKS[b].color }}>{BLOCKS[b].label}</div>
                    <div className="text-[10px] text-slate-400">{BLOCKS[b].sub}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          <p className="mt-4 text-sm leading-relaxed text-slate-300" aria-live="polite">{s.text}</p>
        </div>
        <div className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center text-xs ${s.side === 'recv' ? 'border-cyan-400 text-cyan-200' : 'border-ink-700 text-slate-500'}`}><Server className="mb-1 h-6 w-6" />Receiver<br />decapsulates ↑</div>
      </div>
    </div>
  );
}

export default function OsiLab() {
  const [params, setParams] = useSearchParams();
  const sel = Number(params.get('layer') ?? 4);
  const L = OSI.find((o) => o.n === sel) ?? OSI[3];
  const reduced = useStore((s) => s.settings.reducedMotion);
  useEffect(() => store.visit('page:osi'), []);
  return (
    <div>
      <PageHeader eyebrow="Interactive laboratory" title="The OSI model" actions={<BookmarkButton id="page:osi" />}>Click a layer to explore its responsibilities, protocols, devices, data units and common problems. Then watch application data get encapsulated into bits and back again.</PageHeader>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-1.5" role="tablist" aria-label="OSI layers">
          {OSI.map((l) => (
            <button key={l.n} role="tab" aria-selected={l.n === sel} onClick={() => setParams({ layer: String(l.n) })}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${l.n === sel ? 'border-transparent shadow-lg' : 'border-ink-700 bg-ink-900 hover:border-ink-500'}`}
              style={l.n === sel ? { background: `${l.color}22`, boxShadow: `inset 0 0 0 1px ${l.color}` } : undefined}>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg font-mono text-sm font-bold" style={{ background: `${l.color}26`, color: l.color }}>{l.n}</span>
              <span className="flex-1"><span className="block text-sm font-semibold text-white">{l.name}</span><span className="block text-[11px] text-slate-500">PDU: {l.pdu} · TCP/IP: {l.tcpip}</span></span>
            </button>
          ))}
        </div>
        <motion.div key={L.n} initial={reduced ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="panel p-5">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl font-mono text-lg font-bold" style={{ background: `${L.color}26`, color: L.color }}>{L.n}</span><div><h2 className="text-xl font-semibold text-white">{L.name} layer</h2><p className="text-sm text-slate-400">{L.role}</p></div></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div><h3 className="label">Responsibilities</h3><ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">{L.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul></div>
            <div><h3 className="label">Common problems</h3><ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">{L.problems.map((r) => <li key={r}>{r}</li>)}</ul></div>
            <div><h3 className="label">Protocols</h3><div className="flex flex-wrap gap-1">{L.protocols.map((p) => <span key={p} className="chip">{p}</span>)}</div></div>
            <div><h3 className="label">Devices</h3><div className="flex flex-wrap gap-1">{L.devices.map((p) => <span key={p} className="chip">{p}</span>)}</div></div>
            <div><h3 className="label">Data unit (PDU)</h3><p className="text-sm text-slate-200">{L.pdu}</p></div>
            <div><h3 className="label">Headers / trailers</h3><p className="text-sm text-slate-200">{L.header}</p></div>
          </div>
          <div className="mt-4 rounded-lg bg-ink-950/60 p-3 text-sm"><span className="font-semibold text-cyan-200">Example: </span><span className="text-slate-300">{L.example}</span></div>
        </motion.div>
      </div>
      <section className="panel mt-6 p-5">
        <h2 className="h2 mb-1">Encapsulation & decapsulation</h2>
        <p className="mb-4 text-sm text-slate-400">Data → Segment → Packet → Frame → Bits, then the reverse at the receiver.</p>
        <Encapsulation />
      </section>
    </div>
  );
}
