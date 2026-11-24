import { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Protocol } from '../data/protocols';

/** Step-through ladder (sequence) diagram for a protocol's message flow. */
export default function Sequence({ p }: { p: Protocol }) {
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(false);
  const n = p.flow.length;
  useEffect(() => { setI(0); setPlay(false); }, [p.id]);
  useEffect(() => {
    if (!play) return;
    const t = setTimeout(() => { if (i < n - 1) setI(i + 1); else setPlay(false); }, 1800);
    return () => clearTimeout(t);
  }, [play, i, n]);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="btn btn-sm btn-primary" onClick={() => { if (i >= n - 1) setI(0); setPlay(!play); }}>{play ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{play ? 'Pause' : 'Play'}</button>
        <button className="btn btn-sm" onClick={() => { setPlay(false); setI(Math.max(0, i - 1)); }} disabled={i === 0} aria-label="Previous"><ChevronLeft className="h-3.5 w-3.5" /></button>
        <button className="btn btn-sm" onClick={() => { setPlay(false); setI(Math.min(n - 1, i + 1)); }} disabled={i === n - 1} aria-label="Next"><ChevronRight className="h-3.5 w-3.5" /></button>
        <button className="btn btn-sm" onClick={() => { setPlay(false); setI(0); }}><RotateCcw className="h-3.5 w-3.5" />Restart</button>
        <span className="text-xs text-slate-500">Step {i + 1} / {n}</span>
      </div>
      <div className="relative rounded-lg border border-ink-700 bg-ink-950/60 p-4">
        <div className="mb-2 flex justify-between text-xs font-semibold text-slate-300">
          <span className="w-28 text-center">{p.actors[0]}</span><span className="w-28 text-center">{p.actors[1]}</span>
        </div>
        <div className="relative">
          <div className="absolute bottom-0 left-14 top-0 w-px bg-ink-600" />
          <div className="absolute bottom-0 right-14 top-0 w-px bg-ink-600" />
          {p.flow.map((f, k) => {
            const on = k === i, past = k < i;
            return (
              <button key={k} onClick={() => { setPlay(false); setI(k); }} className={`relative block w-full py-2.5 text-left transition ${on ? 'opacity-100' : past ? 'opacity-60' : 'opacity-30'}`}>
                {f.dir === '.' ? (
                  <div className="mx-auto w-fit rounded-md border border-dashed border-ink-500 bg-ink-850 px-3 py-1 text-center text-xs text-slate-200">{f.label}</div>
                ) : (
                  <div className="relative mx-14 h-6">
                    <div className={`absolute top-1/2 h-0.5 w-full ${on ? 'bg-cyan-400' : 'bg-slate-500'}`} />
                    <div className={`absolute top-1/2 h-0 w-0 -translate-y-1/2 border-y-[6px] border-y-transparent ${f.dir === '>' ? 'right-0 border-l-[9px]' : 'left-0 border-r-[9px]'} ${on ? 'border-l-cyan-400 border-r-cyan-400' : 'border-l-slate-500 border-r-slate-500'}`} />
                    <div className="absolute inset-x-0 -top-1 text-center font-mono text-[11px] text-slate-100"><span className="rounded bg-ink-950 px-1.5">{f.label}</span></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm" aria-live="polite">
        <span className="font-semibold text-cyan-200">{p.flow[i].label}</span>
        {p.flow[i].note && <span className="text-slate-300"> — {p.flow[i].note}</span>}
      </div>
    </div>
  );
}
