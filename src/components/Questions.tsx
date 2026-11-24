import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, GripVertical, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import type { Question } from '../data/questions';
import { subnetAnswer, normalizeAnswer, subnetQuestion } from '../data/questions';
import { buildPacket } from '../engine/packet';
import PacketInspector from './PacketInspector';
import type { Exercise } from '../data/lessons';

function shuffle<T>(a: T[], seed: number): T[] {
  const r = [...a];
  let x = seed || 7;
  for (let i = r.length - 1; i > 0; i--) { x = (x * 1103515245 + 12345) >>> 0; const j = x % (i + 1); [r[i], r[j]] = [r[j], r[i]]; }
  if (r.length > 1 && r.every((v, i) => v === a[i])) [r[0], r[1]] = [r[1], r[0]];
  return r;
}

/** Drag-and-drop ordering with keyboard/button fallback. */
export function OrderList({ items, seed, disabled, onChange }: { items: string[]; seed: number; disabled?: boolean; onChange: (order: string[]) => void }) {
  const [order, setOrder] = useState(() => shuffle(items, seed));
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || disabled) return;
    const o = [...order]; const [x] = o.splice(from, 1); o.splice(to, 0, x); setOrder(o); onChange(o);
  };
  return (
    <ol className="space-y-1.5">
      {order.map((it, i) => (
        <li key={it} draggable={!disabled} onDragStart={() => setDrag(i)} onDragOver={(e) => { e.preventDefault(); if (drag !== null && drag !== i) { move(drag, i); setDrag(i); } }} onDragEnd={() => setDrag(null)}
          className={`flex items-center gap-2 rounded-lg border bg-ink-850 px-3 py-2 text-sm ${drag === i ? 'border-cyan-400' : 'border-ink-600'} ${disabled ? '' : 'cursor-grab'}`}>
          <GripVertical className="h-4 w-4 text-slate-500" /><span className="w-5 font-mono text-xs text-slate-500">{i + 1}.</span><span className="flex-1 text-slate-100">{it}</span>
          <button className="btn btn-sm !px-1" disabled={disabled || i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${it} up`}><ArrowUp className="h-3 w-3" /></button>
          <button className="btn btn-sm !px-1" disabled={disabled || i === order.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${it} down`}><ArrowDown className="h-3 w-3" /></button>
        </li>
      ))}
    </ol>
  );
}

export function Feedback({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className={`mt-3 rounded-lg border p-3 text-sm ${ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'}`} role="status">
      <div className={`mb-1 flex items-center gap-1.5 font-semibold ${ok ? 'text-emerald-300' : 'text-rose-300'}`}>{ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{ok ? 'Correct' : 'Not quite'}</div>
      <div className="text-slate-300">{children}</div>
    </div>
  );
}

/** Renders any question; calls onAnswer(correct) once when the user submits. */
export function QuestionCard({ q, onAnswer, index }: { q: Question; onAnswer?: (ok: boolean) => void; index?: number }) {
  const [choice, setChoice] = useState<number | boolean | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [text, setText] = useState('');
  const [done, setDone] = useState<boolean | null>(null);
  const packet = useMemo(() => (q.type === 'packet' ? buildPacket(q.packet) : null), [q]);
  const seed = q.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const submit = () => {
    let ok = false;
    if (q.type === 'mcq' || q.type === 'scenario' || q.type === 'packet') ok = choice === q.answer;
    else if (q.type === 'tf') ok = choice === q.answer;
    else if (q.type === 'order') ok = (order ?? shuffle(q.items, seed)).every((v, i) => v === q.items[i]);
    else if (q.type === 'subnet') ok = normalizeAnswer(text) === normalizeAnswer(subnetAnswer(q).value);
    setDone(ok);
    onAnswer?.(ok);
  };
  const canSubmit = done === null && ((q.type === 'order') || (q.type === 'subnet' ? text.trim() !== '' : choice !== null));
  const opts = 'options' in q ? q.options : [];
  const typeLabel = { mcq: 'Multiple choice', scenario: 'Scenario', tf: 'True or false', order: 'Drag to order', packet: 'Packet interpretation', subnet: 'Subnetting' }[q.type];
  return (
    <div className="panel p-5">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">{index !== undefined && <span className="font-mono">Q{index + 1}</span>}<span className="chip">{typeLabel}</span></div>
      {q.type === 'scenario' && <div className="mb-2 rounded-lg border-l-2 border-cyan-400 bg-ink-950/60 px-3 py-2 text-sm text-slate-300">{q.scenario}</div>}
      <p className="font-medium text-white">{q.prompt}</p>
      {packet && <div className="mt-3 rounded-lg border border-ink-700 p-3"><PacketInspector packet={packet} compact /></div>}
      <div className="mt-3">
        {opts.length > 0 && (
          <div className="space-y-1.5" role="radiogroup">
            {opts.map((o, i) => {
              const sel = choice === i;
              const right = done !== null && i === (q as { answer: number }).answer;
              const wrong = done === false && sel;
              return <button key={i} role="radio" aria-checked={sel} disabled={done !== null} onClick={() => setChoice(i)} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${right ? 'border-emerald-400 bg-emerald-500/10' : wrong ? 'border-rose-400 bg-rose-500/10' : sel ? 'border-cyan-400 bg-cyan-500/10' : 'border-ink-600 hover:border-ink-500'}`}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink-500 font-mono text-[10px]">{String.fromCharCode(65 + i)}</span><span className="text-slate-100">{o}</span></button>;
            })}
          </div>
        )}
        {q.type === 'tf' && (
          <div className="flex gap-2">{[true, false].map((v) => <button key={String(v)} disabled={done !== null} onClick={() => setChoice(v)} className={`btn flex-1 ${choice === v ? 'btn-primary' : ''} ${done !== null && v === q.answer ? '!border-emerald-400' : ''}`}>{v ? 'True' : 'False'}</button>)}</div>
        )}
        {q.type === 'order' && <OrderList items={q.items} seed={seed} disabled={done !== null} onChange={setOrder} />}
        {q.type === 'subnet' && <input className="input font-mono" value={text} disabled={done !== null} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()} placeholder={q.ask === 'hosts' ? 'e.g. 62' : 'e.g. 192.168.1.64'} aria-label="Your answer" />}
      </div>
      {done === null ? <button className="btn btn-primary mt-3" disabled={!canSubmit} onClick={submit}>Check answer</button> : (
        <Feedback ok={done}>
          {q.type === 'subnet' ? <>Answer: <span className="font-mono text-white">{subnetAnswer(q).value}</span>. {subnetAnswer(q).explain}</> : q.type === 'order' && !done ? <>Correct order: {q.items.join(' → ')}. {q.explain}</> : q.explain}
        </Feedback>
      )}
    </div>
  );
}

/** Lesson exercises. */
export function ExerciseBox({ ex, onDone }: { ex: Exercise; onDone: () => void }) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [assign, setAssign] = useState<Record<number, number>>({});
  const [result, setResult] = useState<boolean | null>(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [bin, setBin] = useState({ n: 0, a: '' });
  if (ex.kind === 'subnet') return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">{ex.prompt}</p>
      <QuestionCard key={seed} q={subnetQuestion(seed)} onAnswer={(ok) => ok && onDone()} />
      <button className="btn btn-sm" onClick={() => setSeed(seed + 1)}><RefreshCw className="h-3.5 w-3.5" />New problem</button>
    </div>
  );
  if (ex.kind === 'binary') {
    const n = bin.n || 1 + (seed % 254);
    return (<div><p className="text-sm">Convert {n} to 8-bit binary.</p><input className="input font-mono" value={bin.a} onChange={(e) => setBin({ n, a: e.target.value })} /><button className="btn btn-primary mt-2" onClick={() => { const ok = bin.a.trim() === n.toString(2).padStart(8, '0'); setResult(ok); if (ok) onDone(); }}>Check</button>{result !== null && <Feedback ok={result}>{n} = {n.toString(2).padStart(8, '0')}</Feedback>}</div>);
  }
  const check = () => {
    let ok = false;
    if (ex.kind === 'order') ok = (order ?? shuffle(ex.items, 3)).every((v, i) => v === ex.items[i]);
    if (ex.kind === 'classify') ok = ex.items.every(([, b], i) => assign[i] === b);
    setResult(ok);
    if (ok) onDone();
  };
  return (
    <div>
      <p className="mb-3 text-sm text-slate-300">{ex.prompt}</p>
      {ex.kind === 'order' && <OrderList items={ex.items} seed={3} onChange={setOrder} disabled={result === true} />}
      {ex.kind === 'classify' && (
        <div className="space-y-1.5">
          {ex.items.map(([label, correct], i) => (
            <div key={label} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${result !== null && assign[i] !== undefined ? (assign[i] === correct ? 'border-emerald-500/50' : 'border-rose-500/50') : 'border-ink-600'}`}>
              <span className="flex-1 text-slate-100">{label}</span>
              <div className="flex flex-wrap gap-1">{ex.buckets.map((b, bi) => <button key={b} onClick={() => { setAssign({ ...assign, [i]: bi }); setResult(null); }} className={`chip ${assign[i] === bi ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100' : 'hover:border-ink-500'}`}>{b}</button>)}</div>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-primary mt-3" onClick={check} disabled={ex.kind === 'classify' && Object.keys(assign).length < ex.items.length}>Check</button>
      {result !== null && <Feedback ok={result}>{result ? 'Well done — exercise complete.' : ex.kind === 'order' ? 'Some items are out of order. Try again.' : 'Items with a red border are in the wrong group. Try again.'}</Feedback>}
    </div>
  );
}
