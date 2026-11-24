import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, SkipBack, StepForward, Square, X, ShieldCheck, ShieldOff, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Scenario, Step, Device } from '../engine/sim';
import { buildRoutes, pointAt, resolveSteps, defaultParams } from '../engine/sim';
import { buildPacket } from '../engine/packet';
import PacketInspector from './PacketInspector';
import { DeviceIcon, DEVICE_NAMES, layerColor } from './ui';
import { store, useStore } from '../lib/store';
import { play } from '../lib/sound';

type Mode = 'idle' | 'playing' | 'step' | 'paused' | 'done';

export default function SimPlayer({ scenario }: { scenario: Scenario }) {
  const speedSetting = useStore((s) => s.settings.speed);
  const reduced = useStore((s) => s.settings.reducedMotion);
  const [params, setParams] = useState(() => defaultParams(scenario));
  const [mitigated, setMitigated] = useState(false);
  const steps = useMemo(() => resolveSteps(scenario, params, mitigated), [scenario, params, mitigated]);
  const [idx, setIdx] = useState(0);
  const [t, setT] = useState(0);
  const [mode, setMode] = useState<Mode>('idle');
  const [speed, setSpeed] = useState(speedSetting);
  const [inspect, setInspect] = useState<Device | null>(null);
  const holdRef = useRef(0);
  const tRef = useRef(0);
  useEffect(() => { tRef.current = t; }, [t]);

  useEffect(() => { setIdx(0); setT(0); setMode('idle'); setParams(defaultParams(scenario)); setMitigated(false); setInspect(null); }, [scenario]);
  useEffect(() => { setIdx(0); setT(0); setMode('idle'); }, [params, mitigated]);

  const step: Step = steps[Math.min(idx, steps.length - 1)];
  const routes = useMemo(() => buildRoutes(scenario, step), [scenario, step]);
  const duration = useMemo(() => (step.local ? 1.1 : Math.max(1.3, Math.max(...routes.map((r) => r.total)) / 32)), [routes, step]);
  const packet = useMemo(() => {
    try { return step.packet ? buildPacket(step.packet) : null; } catch (e) { console.error(e); return null; }
  }, [step]);

  // Animation loop
  useEffect(() => {
    if (mode !== 'playing' && mode !== 'step') return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const prev = tRef.current;
      if (prev >= 1) {
        if (mode === 'step') { setMode('paused'); return; }
        holdRef.current += dt * speed;
        if (holdRef.current > 1.4) {
          holdRef.current = 0;
          if (idx < steps.length - 1) { tRef.current = 0; setT(0); setIdx(idx + 1); }
          else { setMode('done'); store.complete(`sim:${scenario.id}`); }
          return;
        }
      } else {
        const nt = reduced ? 1 : Math.min(1, prev + (dt * speed) / duration);
        tRef.current = nt;
        setT(nt);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, speed, duration, idx, steps.length, reduced, scenario.id]);

  const go = (i: number, autoplay: 'step' | 'paused') => {
    holdRef.current = 0;
    setIdx(Math.max(0, Math.min(steps.length - 1, i)));
    setT(autoplay === 'step' ? 0 : 1);
    setMode(autoplay);
  };
  const start = () => { holdRef.current = 0; if (mode === 'idle' || mode === 'done') { setIdx(0); setT(0); } setMode('playing'); };
  const pause = () => setMode('paused');
  const resume = () => setMode('playing');
  const restart = () => { holdRef.current = 0; setIdx(0); setT(0); setMode('playing'); };
  const reset = () => { holdRef.current = 0; setIdx(0); setT(0); setMode('idle'); setParams(defaultParams(scenario)); setMitigated(false); };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ') { e.preventDefault(); if (mode === 'playing') pause(); else if (mode === 'paused' || mode === 'step') resume(); else start(); }
      if (e.key === 'ArrowRight') go(idx + 1, 'step');
      if (e.key === 'ArrowLeft') go(idx - 1, 'paused');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const positions = routes.map((r) => pointAt(r, t));
  const current = new Set<string>();
  if (t < 0.08 || step.local) current.add(step.from);
  positions.forEach((p) => p.at && current.add(p.at));
  const arrived = t >= 1;
  const activeHop = positions.map((p) => p.at).find((a) => a && step.hops?.[a]);
  const started = mode !== 'idle' || idx > 0;
  const topLayer = packet?.layers[packet.layers.length - 1]?.id ?? 'data';
  // Sound effects: departure, arrival, finish
  const layerNum = /eth|arp|vlan|stp/i.test(topLayer) ? 2 : /ip|icmp|ospf|bgp/i.test(topLayer) ? 3 : /tcp|udp/i.test(topLayer) ? 4 : 7;
  const prevRef = useRef({ t: 1, mode: 'idle' as Mode, idx: 0 });
  useEffect(() => {
    const p = prevRef.current;
    const moving = (m: Mode) => m === 'playing' || m === 'step';
    if (moving(mode) && t === 0 && (p.t !== 0 || p.idx !== idx || !moving(p.mode))) {
      if (step.local) play('local');
      else if (step.danger) { play('danger'); play('send', layerNum); }
      else if (Array.isArray(step.to) && step.to.length > 1) play('broadcast', layerNum);
      else play('send', layerNum);
    }
    if (t >= 1 && p.t < 1 && p.idx === idx && !step.local) play(step.dropAt ? 'drop' : step.ok ? 'ok' : 'arrive');
    if (mode === 'done' && p.mode !== 'done') play('done');
    prevRef.current = { t, mode, idx };
  }, [t, mode, idx]); // eslint-disable-line react-hooks/exhaustive-deps
  const dotColor = step.danger ? '#f43f5e' : layerColor(topLayer).hex;
  const routeIds = new Set(routes.flatMap((r) => r.points.map((p, i) => (i ? `${r.points[i - 1].id}|${p.id}` : ''))));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* Topology canvas */}
        <div className="panel overflow-hidden">
          <div className="panel-head">
            <span className="flex items-center gap-2">Network topology <span className="chip">step {idx + 1}/{steps.length}</span></span>
            {scenario.mitigatedSteps && (
              <button className={`btn btn-sm ${mitigated ? 'btn-primary' : ''}`} onClick={() => setMitigated(!mitigated)} aria-pressed={mitigated}>
                {mitigated ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                {mitigated ? `Defence ON: ${scenario.mitigationLabel ?? 'mitigation'}` : 'Defence OFF — enable mitigation'}
              </button>
            )}
          </div>
          <div className="relative w-full bg-[radial-gradient(circle_at_1px_1px,#1a2742_1px,transparent_0)] [background-size:22px_22px]" style={{ aspectRatio: '16 / 9' }}>
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {scenario.links.map((l) => {
                const a = scenario.devices.find((d) => d.id === l.a)!;
                const b = scenario.devices.find((d) => d.id === l.b)!;
                const hot = routeIds.has(`${l.a}|${l.b}`) || routeIds.has(`${l.b}|${l.a}`);
                return <line key={l.a + l.b} x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke"
                  stroke={hot && started ? dotColor : '#263556'} strokeOpacity={hot && started ? 0.65 : 1} strokeWidth={hot && started ? 2.2 : 1.5} strokeDasharray={l.wireless ? '4 4' : undefined} />;
              })}
            </svg>
            {scenario.links.filter((l) => l.label).map((l) => {
              const a = scenario.devices.find((d) => d.id === l.a)!;
              const b = scenario.devices.find((d) => d.id === l.b)!;
              return <span key={'lbl' + l.a + l.b} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded bg-ink-950/80 px-1 font-mono text-[9px] text-slate-500" style={{ left: `${(a.x + b.x) / 2}%`, top: `${(a.y + b.y) / 2}%` }}>{l.label}</span>;
            })}
            {scenario.devices.map((d) => {
              const on = started && current.has(d.id);
              const isDest = started && arrived && (Array.isArray(step.to) ? step.to.includes(d.id) : step.to === d.id) && !step.dropAt;
              const dropped = started && arrived && step.dropAt === d.id;
              return (
                <button key={d.id} onClick={() => setInspect(d)} aria-label={`Inspect ${d.label}`}
                  className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 focus:outline-none" style={{ left: `${d.x}%`, top: `${d.y}%` }}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl border transition sm:h-11 sm:w-11 ${d.type === 'attacker' ? 'border-rose-500/60 bg-rose-950/80 text-rose-300' : 'border-ink-500 bg-ink-850 text-slate-200'}
                    ${on ? 'scale-110 border-cyan-400 shadow-[0_0_0_4px_rgba(34,211,238,0.15)]' : ''} ${isDest ? (step.ok ? 'border-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.2)]' : 'border-cyan-300') : ''} ${dropped ? 'border-rose-400 shadow-[0_0_0_4px_rgba(244,63,94,0.25)]' : ''} group-hover:border-cyan-500/70 group-focus-visible:ring-2 group-focus-visible:ring-cyan-400`}>
                    <DeviceIcon type={d.type} className="h-4 w-4 sm:h-5 sm:w-5" />
                  </span>
                  <span className="whitespace-nowrap rounded bg-ink-950/85 px-1 text-[9px] font-medium text-slate-300 sm:text-[11px]">{d.label}</span>
                  {d.ip && <span className="hidden whitespace-nowrap font-mono text-[9px] text-slate-500 md:block">{d.ip}</span>}
                </button>
              );
            })}
            {started && !step.local && positions.map((p, i) => {
              const r = routes[i];
              const droppedHere = step.dropAt && arrived && p.at === step.dropAt;
              return (
                <div key={r.target + i} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                  {droppedHere ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white"><X className="h-4 w-4" /></span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="block h-3.5 w-3.5 rounded-[4px] ring-2 ring-ink-950" style={{ background: dotColor, boxShadow: `0 0 14px ${dotColor}` }} />
                      {i === 0 && step.label && <span className="rounded bg-ink-950/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold" style={{ color: dotColor }}>{step.label}</span>}
                    </span>
                  )}
                </div>
              );
            })}
            {started && step.local && (
              <div className="pointer-events-none absolute -translate-x-1/2 translate-y-6 sm:translate-y-8" style={{ left: `${scenario.devices.find((d) => d.id === step.from)!.x}%`, top: `${scenario.devices.find((d) => d.id === step.from)!.y}%` }}>
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">{step.label ?? 'processing…'}</span>
              </div>
            )}
          </div>
          <div className="min-h-9 border-t border-ink-700 px-4 py-2 text-xs text-slate-400" aria-live="polite">
            {activeHop ? <><span className="font-semibold text-cyan-300">{scenario.devices.find((d) => d.id === activeHop)?.label}:</span> {step.hops![activeHop]}</>
              : started ? (arrived ? (step.dropAt ? <span className="text-rose-300">Packet dropped at {scenario.devices.find((d) => d.id === step.dropAt)?.label}.</span> : 'Delivered.') : 'In transit…')
              : 'Press Start (or Space) to run the simulation. Click any device to inspect it.'}
          </div>
        </div>

        {/* Controls */}
        <div className="panel flex flex-wrap items-center gap-2 p-3">
          {mode === 'playing' ? (
            <button className="btn btn-primary" onClick={pause}><Pause className="h-4 w-4" />Pause</button>
          ) : mode === 'paused' || mode === 'step' ? (
            <button className="btn btn-primary" onClick={resume}><Play className="h-4 w-4" />Resume</button>
          ) : (
            <button className="btn btn-primary" onClick={start}><Play className="h-4 w-4" />Start</button>
          )}
          <button className="btn" onClick={() => go(idx - 1, 'paused')} disabled={idx === 0} aria-label="Previous step"><SkipBack className="h-4 w-4" />Prev</button>
          <button className="btn" onClick={() => go(idx + 1, 'step')} disabled={idx >= steps.length - 1 && t >= 1} aria-label="Next step"><StepForward className="h-4 w-4" />Next</button>
          <button className="btn" onClick={restart}><RotateCcw className="h-4 w-4" />Restart</button>
          <button className="btn" onClick={reset}><Square className="h-4 w-4" />Reset</button>
          <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            Speed
            <select className="input !w-auto !py-1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              {[0.25, 0.5, 1, 1.5, 2, 3].map((s) => <option key={s} value={s}>{s}×</option>)}
            </select>
          </label>
          <div className="h-1 w-full overflow-hidden rounded bg-ink-800" aria-hidden>
            <div className="h-full bg-cyan-400 transition-[width]" style={{ width: `${((idx + (started ? t : 0)) / steps.length) * 100}%` }} />
          </div>
          {scenario.params?.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-xs text-slate-400">
              {p.label}
              <input type="range" min={p.min} max={p.max} step={p.step} value={params[p.id]} onChange={(e) => setParams({ ...params, [p.id]: Number(e.target.value) })} className="accent-cyan-400" />
              <span className="w-14 font-mono text-slate-200">{params[p.id]}{p.unit}</span>
            </label>
          ))}
        </div>

        {/* Step timeline */}
        <div className="panel">
          <div className="panel-head">Steps</div>
          <ol className="max-h-72 overflow-auto p-2">
            {steps.map((s, i) => (
              <li key={i}>
                <button onClick={() => go(i, 'step')} className={`flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition ${i === idx ? 'bg-cyan-500/10 text-white' : i < idx ? 'text-slate-400 hover:bg-ink-800' : 'text-slate-500 hover:bg-ink-800'}`}>
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${i === idx ? 'border-cyan-400 text-cyan-300' : 'border-ink-600'}`}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{s.title}</span>
                    {s.danger && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-rose-400" />}
                    {s.ok && <CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-emerald-400" />}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Right column: explanation + inspector */}
      <div className="flex min-w-0 flex-col gap-4">
        <div className={`panel p-4 ${step.danger ? 'border-rose-500/40' : step.ok ? 'border-emerald-500/40' : ''}`} aria-live="polite">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">Step {idx + 1} of {steps.length}</div>
          <h3 className="text-lg font-semibold text-white">{step.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.text}</p>
          {step.rtt !== undefined && <div className="mt-2 font-mono text-xs text-emerald-300">Round-trip time (simulated): {step.rtt} ms</div>}
          {mode === 'done' && idx === steps.length - 1 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Simulation complete — marked in your progress.</div>
          )}
        </div>
        {step.tables?.map((tb) => <StateTable key={tb.title} t={tb} />)}
        <div className="panel">
          <div className="panel-head">Packet inspector</div>
          <div className="p-3">
            {packet ? <PacketInspector packet={packet} /> : <p className="text-sm text-slate-400">No packet on the wire in this step — this is processing inside a device.</p>}
          </div>
        </div>
      </div>

      {inspect && <DeviceModal device={inspect} scenario={scenario} steps={steps} idx={idx} onClose={() => setInspect(null)} />}
    </div>
  );
}

function StateTable({ t }: { t: { title: string; cols: string[]; rows: (string | number)[][]; highlight?: number } }) {
  return (
    <div className="panel overflow-hidden">
      <div className="panel-head">{t.title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead className="text-slate-500"><tr>{t.cols.map((c) => <th key={c} className="px-3 py-1.5 font-medium">{c}</th>)}</tr></thead>
          <tbody>
            {t.rows.map((r, i) => (
              <tr key={i} className={`border-t border-ink-800 ${t.highlight === i ? 'bg-cyan-500/10 text-cyan-200' : 'text-slate-300'}`}>
                {r.map((c, j) => <td key={j} className="px-3 py-1.5">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeviceModal({ device, scenario, steps, idx, onClose }: { device: Device; scenario: Scenario; steps: Step[]; idx: number; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const involved = steps.map((s, i) => ({ s, i })).filter(({ s }) => s.from === device.id || s.to === device.id || (Array.isArray(s.to) && s.to.includes(device.id)) || s.hops?.[device.id]);
  const tables = steps.slice(0, idx + 1).flatMap((s) => s.tables ?? []).filter((t) => t.device === device.id);
  const latest = tables.length ? tables[tables.length - 1] : null;
  const links = scenario.links.filter((l) => l.a === device.id || l.b === device.id).map((l) => scenario.devices.find((d) => d.id === (l.a === device.id ? l.b : l.a))!);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal aria-label={`${device.label} details`}>
      <div className="panel max-h-[85vh] w-full max-w-lg overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-ink-500 bg-ink-850"><DeviceIcon type={device.type} className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-white">{device.label}</h3>
            <div className="text-sm text-slate-400">{DEVICE_NAMES[device.type]}{device.zone ? ` · ${device.zone}` : ''}</div>
          </div>
          <button className="btn btn-sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
          {device.ip && <><dt className="text-slate-500">IP</dt><dd className="text-slate-200">{device.ip}</dd></>}
          {device.mac && <><dt className="text-slate-500">MAC</dt><dd className="text-slate-200">{device.mac}</dd></>}
          <dt className="text-slate-500">Links</dt><dd className="text-slate-200">{links.map((l) => l.label).join(', ') || '—'}</dd>
        </dl>
        {device.info && <p className="mt-3 text-sm leading-relaxed text-slate-300">{device.info}</p>}
        {latest && <div className="mt-4"><StateTable t={latest} /></div>}
        <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Role in this simulation</h4>
        <ul className="mt-1 space-y-1 text-sm">
          {involved.length === 0 && <li className="text-slate-500">This device is not involved in any step.</li>}
          {involved.map(({ s, i }) => (
            <li key={i} className={i === idx ? 'text-cyan-200' : 'text-slate-300'}>
              <span className="font-mono text-xs text-slate-500">#{i + 1}</span> {s.from === device.id ? 'Sends' : s.hops?.[device.id] ? 'Forwards' : 'Receives'}: {s.title}
              {s.hops?.[device.id] && <div className="pl-6 text-xs text-slate-400">{s.hops[device.id]}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
