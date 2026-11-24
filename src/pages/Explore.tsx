import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, PlayCircle, ShieldAlert, Clock, Bookmark, Layers, Wrench, GraduationCap, AlertTriangle, Search as SearchIcon, ShieldCheck, Eye } from 'lucide-react';
import { protocols, protocolById, CATEGORIES, type Category } from '../data/protocols';
import { guided } from '../data/guided';
import { attacks } from '../data/attacks';
import { OSI } from '../data/knowledge';
import { COURSES } from '../data/lessons';
import { buildPacket } from '../engine/packet';
import { resolveKey, search, TOOLS, scenarioById } from '../lib/catalog';
import { store, useStore } from '../lib/store';
import { BookmarkButton, PageHeader, DeviceIcon } from '../components/ui';
import PacketInspector from '../components/PacketInspector';
import SimPlayer from '../components/SimPlayer';
import Sequence from '../components/Sequence';

// ------------------------------------------------------------------ Dashboard
export function Dashboard() {
  const visited = useStore((s) => s.visited);
  const bookmarks = useStore((s) => s.bookmarks);
  const completed = useStore((s) => s.completed);
  const exams = useStore((s) => s.exams);
  const name = useStore((s) => s.settings.name);
  const recent = Object.entries(visited).sort((a, b) => b[1] - a[1]).map(([k]) => resolveKey(k)).filter(Boolean).slice(0, 6);
  const saved = bookmarks.map(resolveKey).filter(Boolean).slice(0, 6);
  const simsDone = [...guided, ...attacks].filter((s) => completed[`sim:${s.id}`]).length;
  const lessonsDone = Object.keys(completed).filter((k) => k.startsWith('lesson:')).length;
  const protosSeen = Object.keys(visited).filter((k) => k.startsWith('protocol:')).length;
  const avg = exams.length ? Math.round((exams.reduce((a, e) => a + e.score / e.total, 0) / exams.length) * 100) : null;
  return (
    <div>
      <div className="panel relative mb-6 overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#1a2742_1px,transparent_0)] [background-size:22px_22px] opacity-70" />
        <div className="relative max-w-3xl">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-400">Interactive network laboratory</div>
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{name ? `Welcome back, ${name}.` : 'See the packets. Inspect the bytes.'}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-400">Watch data cross a network hop by hop, decode every header field down to the bit, and practise with real calculators and exam questions. Every packet here is built byte-for-byte with valid checksums — simulated, not captured.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/simulations/website" className="btn btn-primary"><PlayCircle className="h-4 w-4" />What happens when you open a website?</Link>
            <Link to="/protocols" className="btn"><Layers className="h-4 w-4" />Explore {protocols.length} protocols</Link>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['Protocols explored', `${protosSeen}/${protocols.length}`], ['Simulations completed', `${simsDone}/${guided.length + attacks.length}`], ['Lessons completed', `${lessonsDone}/${COURSES.reduce((a, c) => a + c.lessons.length, 0)}`], ['Average exam score', avg === null ? '—' : `${avg}%`]].map(([l, v]) => (
          <div key={l} className="panel p-4"><div className="text-xs text-slate-500">{l}</div><div className="mt-1 text-2xl font-semibold text-white">{v}</div></div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="h2">Guided simulations</h2><Link to="/simulations" className="text-sm text-cyan-300 hover:underline">All</Link></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {guided.slice(0, 6).map((s) => (
                <Link key={s.id} to={`/simulations/${s.id}`} className="card-link">
                  <div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/15 text-xs font-bold text-cyan-300">{s.short}</span><span className="font-medium text-white">{s.title}</span>{completed[`sim:${s.id}`] && <span className="chip ml-auto text-emerald-300">done</span>}</div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-400">{s.summary}</p>
                </Link>
              ))}
            </div>
          </section>
          <section>
            <h2 className="h2 mb-3">Protocol categories</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {CATEGORIES.map((c) => (
                <Link key={c.id} to={`/protocols?cat=${c.id}`} className="card-link">
                  <div className="font-medium text-white">{c.label}</div>
                  <p className="mt-1 text-sm text-slate-400">{c.blurb}</p>
                  <div className="mt-2 flex flex-wrap gap-1">{protocols.filter((p) => p.category === c.id).map((p) => <span key={p.id} className="chip">{p.name}</span>)}</div>
                </Link>
              ))}
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="panel">
            <div className="panel-head"><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-400" />Recently explored</span></div>
            <ul className="p-2">
              {recent.length === 0 && <li className="px-2 py-3 text-sm text-slate-500">Nothing yet — open a protocol or simulation.</li>}
              {recent.map((r) => <li key={r!.key}><Link to={r!.href} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-ink-800"><span className="truncate text-slate-200">{r!.title}</span><span className="chip shrink-0">{r!.kind}</span></Link></li>)}
            </ul>
          </section>
          <section className="panel">
            <div className="panel-head"><span className="flex items-center gap-2"><Bookmark className="h-4 w-4 text-slate-400" />Bookmarks</span><Link to="/saved" className="text-xs font-normal text-cyan-300">All</Link></div>
            <ul className="p-2">
              {saved.length === 0 && <li className="px-2 py-3 text-sm text-slate-500">Use the Save button on any page to bookmark it.</li>}
              {saved.map((r) => <li key={r!.key}><Link to={r!.href} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-ink-800"><span className="truncate text-slate-200">{r!.title}</span><span className="chip shrink-0">{r!.kind}</span></Link></li>)}
            </ul>
          </section>
          <section className="grid grid-cols-2 gap-3">
            {[{ to: '/tools/subnet', icon: Wrench, l: 'Subnet calculator' }, { to: '/osi', icon: Layers, l: 'OSI lab' }, { to: '/security', icon: ShieldAlert, l: 'Attack labs' }, { to: '/learn', icon: GraduationCap, l: 'Courses' }].map((x) => (
              <Link key={x.to} to={x.to} className="card-link flex items-center gap-2 !p-3 text-sm text-slate-200"><x.icon className="h-4 w-4 text-cyan-400" />{x.l}</Link>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Protocol list
export function ProtocolList() {
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat') as Category | null;
  const [q, setQ] = useState('');
  const visited = useStore((s) => s.visited);
  const list = protocols.filter((p) => (!cat || p.category === cat) && (!q || `${p.name} ${p.full} ${p.ports ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <PageHeader eyebrow="Protocol explorer" title="How every protocol works">Pick a protocol to see what it does, where it sits in the OSI and TCP/IP models, its message flow, its fields decoded byte by byte, real-world uses, security issues and troubleshooting.</PageHeader>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button className={`btn btn-sm ${!cat ? 'btn-primary' : ''}`} onClick={() => setParams({})}>All ({protocols.length})</button>
        {CATEGORIES.map((c) => <button key={c.id} className={`btn btn-sm ${cat === c.id ? 'btn-primary' : ''}`} onClick={() => setParams({ cat: c.id })}>{c.label}</button>)}
        <input className="input !w-56 md:ml-auto" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter protocols" />
      </div>
      {CATEGORIES.filter((c) => !cat || c.id === cat).map((c) => {
        const items = list.filter((p) => p.category === c.id);
        if (!items.length) return null;
        return (
          <section key={c.id} className="mb-8">
            <h2 className="h2 mb-3">{c.label}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((p) => (
                <Link key={p.id} to={`/protocols/${p.id}`} className="card-link">
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="font-semibold text-white">{p.name}</div><div className="text-xs text-slate-500">{p.full}</div></div>
                    <div className="flex gap-1">{p.osi.map((l) => <span key={l} className="chip" style={{ color: OSI.find((o) => o.n === l)?.color }}>L{l}</span>)}</div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-400">{p.what}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">{p.ports && <span className="font-mono">{p.ports}</span>}{visited[`protocol:${p.id}`] && <span className="ml-auto flex items-center gap-1 text-emerald-400"><Eye className="h-3 w-3" />viewed</span>}</div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      {list.length === 0 && <p className="text-slate-400">No protocols match "{q}".</p>}
    </div>
  );
}

// ------------------------------------------------------------------ Protocol page
export function ProtocolPage() {
  const { id = '' } = useParams();
  const p = protocolById[id];
  useEffect(() => { if (p) store.visit(`protocol:${p.id}`); }, [p]);
  const sample = useMemo(() => { try { return p?.sample ? buildPacket(p.sample) : null; } catch { return null; } }, [p]);
  if (!p) return <NotFound what="protocol" />;
  const sims = (p.sims ?? []).map((s) => scenarioById[s]).filter(Boolean);
  const attackLabs = attacks.filter((a) => a.protocols.includes(p.id));
  const Section = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
    <section className="panel p-5"><h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-white"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink-700 text-xs text-cyan-300">{n}</span>{title}</h2>{children}</section>
  );
  return (
    <div>
      <div className="mb-2 text-sm"><Link to="/protocols" className="text-slate-400 hover:text-cyan-300">Protocols</Link> <span className="text-slate-600">/</span> <span className="text-slate-300">{p.name}</span></div>
      <PageHeader eyebrow={CATEGORIES.find((c) => c.id === p.category)?.label} title={`${p.name} — ${p.full}`} actions={<BookmarkButton id={`protocol:${p.id}`} />}>
        <span className="flex flex-wrap gap-2">
          <span className="chip">{p.standard}</span>{p.ports && <span className="chip font-mono">{p.ports}</span>}<span className="chip">TCP/IP: {p.tcpip}</span>
        </span>
      </PageHeader>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Section n={1} title="What it is"><p className="text-sm leading-relaxed text-slate-300">{p.what}</p></Section>
          <div className="grid gap-4 md:grid-cols-2">
            <Section n={2} title="Why it exists"><p className="text-sm leading-relaxed text-slate-300">{p.why}</p></Section>
            <Section n={3} title="Problem it solves"><p className="text-sm leading-relaxed text-slate-300">{p.problem}</p></Section>
          </div>
          <Section n={4} title="OSI layer & TCP/IP model (5)">
            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 text-xs">
              <div className="space-y-1">{OSI.map((l) => <div key={l.n} className={`rounded-md border px-2 py-1 ${p.osi.includes(l.n) ? 'border-cyan-400 bg-cyan-500/15 font-semibold text-white' : 'border-ink-700 text-slate-500'}`}>{l.n} {l.name}</div>)}</div>
              <div className="w-px bg-ink-700" />
              <div className="flex flex-col gap-1">
                {(['Application', 'Transport', 'Internet', 'Link'] as const).map((t) => <div key={t} className={`flex flex-1 items-center rounded-md border px-2 ${p.tcpip === t ? 'border-cyan-400 bg-cyan-500/15 font-semibold text-white' : 'border-ink-700 text-slate-500'}`} style={{ flexGrow: t === 'Application' ? 3 : t === 'Link' ? 2 : 1 }}>{t}</div>)}
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-300">{p.osiNote}</p>
          </Section>
          <Section n={6} title="How communication happens"><Sequence p={p} /></Section>
        </div>
        <div className="space-y-4">
          <Section n={7} title="Important fields">
            <dl className="divide-y divide-ink-800 text-sm">{p.fields.map(([f, d]) => <div key={f} className="grid gap-1 py-2 sm:grid-cols-[180px_1fr]"><dt className="font-mono text-xs text-cyan-200">{f}</dt><dd className="text-slate-300">{d}</dd></div>)}</dl>
          </Section>
          {sample && (
            <section className="panel">
              <div className="panel-head">Example packet — click any field or byte</div>
              <div className="p-3"><PacketInspector packet={sample} /></div>
            </section>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Section n={8} title="Real-world applications"><ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">{p.uses.map((u) => <li key={u}>{u}</li>)}</ul></Section>
            <Section n={9} title="Security considerations"><ul className="space-y-1.5 text-sm text-slate-300">{p.security.map((u) => <li key={u} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />{u}</li>)}</ul></Section>
          </div>
          <Section n={10} title="Troubleshooting">
            <div className="space-y-2">{p.troubleshooting.map(([s, f]) => <div key={s} className="rounded-lg bg-ink-950/60 p-3 text-sm"><div className="font-medium text-rose-200">Symptom: {s}</div><div className="mt-0.5 text-slate-300">→ {f}</div></div>)}</div>
          </Section>
          {(sims.length > 0 || attackLabs.length > 0 || (p.related?.length ?? 0) > 0) && (
            <section className="panel p-5">
              <h2 className="mb-3 text-base font-semibold text-white">Go further</h2>
              <div className="flex flex-wrap gap-2">
                {sims.map((s) => <Link key={s.id} to={`/simulations/${s.id}`} className="btn btn-sm btn-primary"><PlayCircle className="h-3.5 w-3.5" />Simulate: {s.title}</Link>)}
                {attackLabs.map((s) => <Link key={s.id} to={`/security/${s.id}`} className="btn btn-sm"><ShieldAlert className="h-3.5 w-3.5 text-rose-400" />{s.title}</Link>)}
                {p.related?.map((r) => protocolById[r] && <Link key={r} to={`/protocols/${r}`} className="btn btn-sm">{protocolById[r].name}</Link>)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Simulations
export function SimList({ kind }: { kind: 'guided' | 'attack' }) {
  const list = kind === 'guided' ? guided : attacks;
  const completed = useStore((s) => s.completed);
  return (
    <div>
      {kind === 'guided'
        ? <PageHeader eyebrow="Packet animation engine" title="Guided network simulations">Each simulation animates real packets across a topology. Step forwards and backwards, change speed, click devices to inspect them, and decode every packet in the inspector.</PageHeader>
        : <PageHeader eyebrow="Cybersecurity" title="Network attack visualisations">Self-contained, simulated demonstrations of common network attacks. Each lab shows the architecture, animates the attack, explains the vulnerability and detection signals — then lets you switch the defence on and watch it work. Nothing here sends real traffic.</PageHeader>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => (
          <Link key={s.id} to={`/${kind === 'guided' ? 'simulations' : 'security'}/${s.id}`} className="card-link">
            <div className="flex items-center gap-2">
              {kind === 'guided' ? <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/15 text-sm font-bold text-cyan-300">{s.short}</span> : <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-500/15 text-rose-300"><ShieldAlert className="h-4 w-4" /></span>}
              <span className="font-semibold text-white">{s.title}</span>
              {completed[`sim:${s.id}`] && <span className="chip ml-auto text-emerald-300">done</span>}
            </div>
            <p className="mt-2 text-sm text-slate-400">{s.summary}</p>
            <div className="mt-3 flex items-center gap-1 text-slate-500">
              {Array.from(new Set(s.devices.map((d) => d.type))).slice(0, 7).map((t) => <DeviceIcon key={t} type={t} className="h-4 w-4" />)}
              <span className="ml-auto flex items-center gap-1 text-xs text-cyan-300">Open <ArrowRight className="h-3 w-3" /></span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SimPage({ kind }: { kind: 'guided' | 'attack' }) {
  const { id = '' } = useParams();
  const s = (kind === 'guided' ? guided : attacks).find((x) => x.id === id);
  useEffect(() => { if (s) store.visit(`sim:${s.id}`); }, [s]);
  if (!s) return <NotFound what="simulation" />;
  const base = kind === 'guided' ? '/simulations' : '/security';
  return (
    <div>
      <div className="mb-2 text-sm"><Link to={base} className="text-slate-400 hover:text-cyan-300">{kind === 'guided' ? 'Simulations' : 'Security lab'}</Link> <span className="text-slate-600">/</span> <span className="text-slate-300">{s.title}</span></div>
      <PageHeader eyebrow={kind === 'guided' ? `Simulation ${s.short}` : 'Attack visualisation (simulated)'} title={s.title} actions={<BookmarkButton id={`sim:${s.id}`} />}>
        {s.summary}
        <div className="mt-2 flex flex-wrap gap-1">{s.protocols.map((pid) => protocolById[pid] && <Link key={pid} to={`/protocols/${pid}`} className="chip hover:border-cyan-500/50">{protocolById[pid].name}</Link>)}</div>
      </PageHeader>
      {s.attack && (
        <div className="mb-4 grid gap-3 lg:grid-cols-4">
          <div className="panel p-4 lg:col-span-1"><h3 className="mb-1 text-sm font-semibold text-white">The attack</h3><p className="text-sm text-slate-300">{s.attack.explain}</p></div>
          {[['Vulnerabilities', s.attack.vulnerabilities, AlertTriangle, 'text-amber-400'], ['How defenders detect it', s.attack.detection, SearchIcon, 'text-sky-400'], ['Mitigation', s.attack.mitigation, ShieldCheck, 'text-emerald-400']].map(([t, items, I, c]) => {
            const Icon = I as typeof AlertTriangle;
            return (
              <div key={t as string} className="panel p-4"><h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-white"><Icon className={`h-4 w-4 ${c}`} />{t as string}</h3>
                <ul className="list-disc space-y-1 pl-4 text-sm text-slate-300">{(items as string[]).map((x) => <li key={x}>{x}</li>)}</ul></div>
            );
          })}
        </div>
      )}
      <SimPlayer scenario={s} />
      {s.takeaways && (
        <div className="panel mt-4 p-4"><h3 className="mb-2 text-sm font-semibold text-white">Key takeaways</h3><ul className="grid gap-2 text-sm text-slate-300 md:grid-cols-3">{s.takeaways.map((t) => <li key={t} className="rounded-lg bg-ink-950/60 p-3">{t}</li>)}</ul></div>
      )}
      <p className="mt-4 text-xs text-slate-500">Keyboard: Space = start/pause, ← → = previous/next step. Packets are generated by NETLAB (valid headers and checksums), not captured traffic.</p>
    </div>
  );
}

// ------------------------------------------------------------------ Search page
export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const results = search(q, 100);
  const groups = results.reduce<Record<string, typeof results>>((acc, r) => { (acc[r.kind] ??= []).push(r); return acc; }, {});
  return (
    <div>
      <PageHeader eyebrow="Search" title={q ? `Results for "${q}"` : 'Search'}>{results.length} result{results.length === 1 ? '' : 's'} across protocols, simulations, lessons, tools, OSI layers, ports and glossary.</PageHeader>
      {!results.length && <p className="text-slate-400">Try a protocol name (TCP), a port (443), a field (TTL), a device (switch) or a problem (timeout).</p>}
      <div className="space-y-6">
        {Object.entries(groups).map(([k, items]) => (
          <section key={k}><h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{k} ({items.length})</h2>
            <div className="grid gap-2 md:grid-cols-2">{items.map((r) => <Link key={r.key} to={r.href} className="card-link !p-3"><div className="text-sm font-medium text-white">{r.title}</div>{r.desc && <div className="line-clamp-2 text-xs text-slate-400">{r.desc}</div>}</Link>)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function SavedPage() {
  const bookmarks = useStore((s) => s.bookmarks);
  const items = bookmarks.map(resolveKey).filter(Boolean);
  return (
    <div>
      <PageHeader eyebrow="Library" title="Bookmarks and saved lessons">Everything you have saved, stored in this browser.</PageHeader>
      {items.length === 0 && <p className="text-slate-400">No bookmarks yet. Use the <span className="chip">Save</span> button on protocols, simulations, lessons and tools.</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((r) => (
          <div key={r!.key} className="panel flex items-center gap-3 p-3">
            <Link to={r!.href} className="min-w-0 flex-1"><div className="text-sm font-medium text-white">{r!.title}</div><div className="text-xs text-slate-500">{r!.kind}{r!.desc ? ` · ${r!.desc}` : ''}</div></Link>
            <BookmarkButton id={r!.key} label={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <div className="py-20 text-center">
      <div className="font-mono text-5xl text-cyan-400">404</div>
      <p className="mt-3 text-slate-300">That {what} does not exist — like a packet with TTL 0.</p>
      <Link to="/" className="btn btn-primary mt-5">Back to dashboard</Link>
    </div>
  );
}

export { TOOLS };
