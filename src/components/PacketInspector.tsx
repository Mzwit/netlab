import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { Packet, Field, Layer } from '../engine/packet';
import { hex2, bin8 } from '../engine/bytes';
import { layerColor, SimBadge, Tabs } from './ui';
import { store, useStore } from '../lib/store';

type Mode = 'simple' | 'technical' | 'hex';

const KEY_FIELDS: [string, string][] = [
  ['srcMac', 'Source MAC'], ['dstMac', 'Destination MAC'], ['srcIp', 'Source IP'], ['dstIp', 'Destination IP'],
  ['sport', 'Source port'], ['dport', 'Destination port'], ['protocol', 'Protocol'], ['length', 'Packet length'],
  ['ttl', 'TTL / Hop limit'], ['seq', 'Sequence no.'], ['ack', 'Ack no.'], ['flags', 'TCP flags'], ['checksum', 'Checksum'], ['payload', 'Payload'],
];

export default function PacketInspector({ packet, compact = false }: { packet: Packet; compact?: boolean }) {
  const mode = useStore((s) => s.settings.inspectorMode);
  const setMode = (m: Mode) => store.settings({ inspectorMode: m });
  const [sel, setSel] = useState<{ layer: Layer; field: Field } | null>(null);
  const [hover, setHover] = useState<Field | null>(null);
  useEffect(() => setSel(null), [packet]);

  const meta = packet.meta;
  const checksum = meta.l4checksum ? `${meta.l4checksum} (L4)${meta.ipChecksum && meta.ipChecksum.startsWith('0x') ? ` · ${meta.ipChecksum} (IP)` : ''}` : meta.ipChecksum ?? '—';
  const values: Record<string, string> = { ...meta, checksum };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <SimBadge />
          <span className="truncate font-mono text-xs text-slate-300" title={packet.summary}>{packet.summary}</span>
        </div>
        <Tabs size="sm" value={mode} onChange={setMode} options={[{ id: 'simple', label: 'Simple' }, { id: 'technical', label: 'Technical' }, { id: 'hex', label: 'Hex' }]} />
      </div>

      <div className="flex flex-wrap gap-1">
        {packet.layers.map((l) => {
          const c = layerColor(l.id);
          return <span key={l.id + l.start} className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${c.bg} ${c.text} ${c.border}`}>{l.name} · {l.len}B</span>;
        })}
      </div>

      {mode === 'simple' && (
        <div className="space-y-2">
          {packet.layers.map((l) => {
            const c = layerColor(l.id);
            return (
              <div key={l.id + l.start} className={`rounded-lg border-l-2 bg-ink-950/60 px-3 py-2 ${c.border}`}>
                <div className={`text-xs font-semibold ${c.text}`}>{l.name} <span className="font-normal text-slate-500">· OSI layer {Math.floor(l.osi)}</span></div>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-300">{l.simple}</p>
              </div>
            );
          })}
        </div>
      )}

      {mode !== 'simple' && !compact && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-ink-700 bg-ink-950/60 p-2.5 text-xs sm:grid-cols-3">
          {KEY_FIELDS.map(([k, label]) => (
            <div key={k} className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
              <div className="truncate font-mono text-slate-200" title={values[k] ?? '—'}>{values[k] ?? '—'}</div>
            </div>
          ))}
        </div>
      )}

      {mode === 'technical' && <Tree packet={packet} sel={sel} onSel={setSel} />}

      {mode !== 'simple' && (
        <HexView packet={packet} sel={sel?.field ?? null} hover={hover} onHover={setHover} onSel={setSel} binary={mode === 'hex'} />
      )}

      {mode !== 'simple' && (
        <FieldDetail packet={packet} sel={sel} />
      )}
    </div>
  );
}

function Tree({ packet, sel, onSel }: { packet: Packet; sel: { field: Field } | null; onSel: (s: { layer: Layer; field: Field }) => void }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-ink-700 bg-ink-950/60 font-mono text-xs">
      {packet.layers.map((l) => {
        const c = layerColor(l.id);
        const k = l.id + l.start;
        const open = !closed[k];
        return (
          <div key={k} className="border-b border-ink-800 last:border-0">
            <button className={`flex w-full items-center gap-1 px-2 py-1.5 text-left font-semibold ${c.text} hover:bg-ink-800`} onClick={() => setClosed({ ...closed, [k]: open })} aria-expanded={open}>
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {l.name} <span className="ml-auto font-normal text-slate-500">bytes {l.start}–{l.start + l.len - 1}</span>
            </button>
            {open && l.fields.map((f) => (
              <button key={f.start} onClick={() => onSel({ layer: l, field: f })}
                className={`flex w-full gap-2 py-0.5 pl-7 pr-2 text-left hover:bg-ink-800 ${sel?.field === f ? 'bg-cyan-500/15 text-white' : 'text-slate-300'}`}>
                <span className="shrink-0 text-slate-400">{f.name}:</span>
                <span className="min-w-0 truncate">{f.value}</span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function HexView({ packet, sel, hover, onHover, onSel, binary }: {
  packet: Packet; sel: Field | null; hover: Field | null; onHover: (f: Field | null) => void; onSel: (s: { layer: Layer; field: Field }) => void; binary: boolean;
}) {
  const owner = useMemo(() => {
    const o: { layer: Layer; field: Field }[] = [];
    packet.layers.forEach((l) => l.fields.forEach((f) => { for (let i = f.start; i < f.start + f.len; i++) o[i] = { layer: l, field: f }; }));
    return o;
  }, [packet]);
  const per = binary ? 8 : 16;
  const rows = Math.ceil(packet.bytes.length / per);
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-ink-700 bg-ink-950/60 p-2 font-mono text-[11px] leading-5" onMouseLeave={() => onHover(null)}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-3 whitespace-nowrap">
          <span className="select-none text-slate-600">{(r * per).toString(16).padStart(4, '0')}</span>
          <span className="flex flex-wrap">
            {packet.bytes.slice(r * per, r * per + per).map((b, i) => {
              const idx = r * per + i;
              const o = owner[idx];
              const c = o ? layerColor(o.layer.id) : layerColor('data');
              const isSel = sel && o?.field === sel;
              const isHov = hover && o?.field === hover;
              return (
                <button key={idx} onMouseEnter={() => onHover(o?.field ?? null)} onClick={() => o && onSel(o)}
                  title={o ? `${o.layer.name} › ${o.field.name}` : ''}
                  className={`px-[3px] ${c.text} ${isSel ? 'rounded-sm bg-cyan-400 !text-ink-950' : isHov ? 'rounded-sm bg-ink-600 !text-white' : ''} ${i === 7 && !binary ? 'mr-2' : ''}`}>
                  {binary ? bin8(b) : hex2(b)}
                </button>
              );
            })}
          </span>
          {!binary && (
            <span className="hidden text-slate-500 sm:inline">
              {packet.bytes.slice(r * per, r * per + per).map((b, i) => {
                const o = owner[r * per + i];
                const on = sel && o?.field === sel;
                return <span key={i} className={on ? 'text-cyan-300' : ''}>{b >= 32 && b < 127 ? String.fromCharCode(b) : '.'}</span>;
              })}
            </span>
          )}
        </div>
      ))}
      <div className="mt-1 text-[10px] text-slate-500">{hover ? `${hover.name} = ${hover.value}` : 'Hover a byte to see its field · click to explain'}</div>
    </div>
  );
}

function FieldDetail({ packet, sel }: { packet: Packet; sel: { layer: Layer; field: Field } | null }) {
  if (!sel) return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-ink-600 px-3 py-2 text-xs text-slate-400">
      <Info className="h-3.5 w-3.5" /> Click any field or byte to see what it means and why it exists.
    </div>
  );
  const { layer, field } = sel;
  const bytes = packet.bytes.slice(field.start, field.start + field.len);
  const c = layerColor(layer.id);
  return (
    <div className={`rounded-lg border bg-ink-950/60 p-3 ${c.border}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className={`text-sm font-semibold ${c.text}`}>{layer.name} › {field.name}</div>
        <div className="font-mono text-[11px] text-slate-500">offset {field.start} · {field.len} byte{field.len > 1 ? 's' : ''}</div>
      </div>
      <div className="mt-1 font-mono text-sm text-white">{field.value}</div>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{field.explain}</p>
      {field.len <= 8 && (
        <div className="mt-2 space-y-0.5 font-mono text-[11px] text-slate-400">
          <div>hex&nbsp;&nbsp;&nbsp;{bytes.map(hex2).join(' ')}</div>
          <div>binary {bytes.map(bin8).join(' ')}</div>
          {field.bits && <div className="text-cyan-300">bits&nbsp;&nbsp;{field.bits}</div>}
        </div>
      )}
    </div>
  );
}
