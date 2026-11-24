import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, Clock, Target, Lightbulb, Cpu, Image, FlaskConical, ListChecks, NotebookPen, ArrowLeft, ArrowRight, PlayCircle, RotateCcw, Trophy, Download, Upload, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { COURSES, ALL_LESSONS, type Diagram } from '../data/lessons';
import { BANK, TOPICS, subnetQuestion, type Question, type Topic } from '../data/questions';
import { GLOSSARY } from '../data/knowledge';
import { protocols, protocolById } from '../data/protocols';
import { guided } from '../data/guided';
import { attacks } from '../data/attacks';
import { scenarioById } from '../lib/catalog';
import { buildPacket } from '../engine/packet';
import { store, useStore, type ExamResult } from '../lib/store';
import { PageHeader, BookmarkButton } from '../components/ui';
import { QuestionCard, ExerciseBox } from '../components/Questions';
import PacketInspector from '../components/PacketInspector';
import { Encapsulation } from './Osi';
import { OSI } from '../data/knowledge';
import { NotFound } from './Explore';
import { API_URL, useSession, authenticate, logout, push, pull } from '../lib/api';

// ------------------------------------------------------------------ Courses
export function LearnIndex() {
  const completed = useStore((s) => s.completed);
  return (
    <div>
      <PageHeader eyebrow="Learning" title="Courses">Structured lessons, each with objectives, simple and technical explanations, a live diagram or simulation, a practical example, an interactive exercise, a knowledge check and summary notes.</PageHeader>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COURSES.map((c) => {
          const done = c.lessons.filter((l) => completed[`lesson:${l.id}`]).length;
          return (
            <Link key={c.id} to={`/learn/${c.id}`} className="card-link flex flex-col">
              <span className="chip w-fit">{c.level}</span>
              <div className="mt-2 font-semibold text-white">{c.title}</div>
              <p className="mt-1 flex-1 text-sm text-slate-400">{c.blurb}</p>
              <div className="mt-3 text-xs text-slate-500">{done}/{c.lessons.length} lessons</div>
              <div className="mt-1 h-1 overflow-hidden rounded bg-ink-700"><div className="h-full bg-cyan-400" style={{ width: `${(done / c.lessons.length) * 100}%` }} /></div>
            </Link>
          );
        })}
      </div>
      <div className="panel mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div><div className="font-semibold text-white">Ready to test yourself?</div><div className="text-sm text-slate-400">Practice exams with multiple choice, true/false, scenarios, drag-and-drop, packet interpretation and subnetting.</div></div>
        <Link to="/exams" className="btn btn-primary">Go to exams <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}

export function CoursePage() {
  const { course = '' } = useParams();
  const c = COURSES.find((x) => x.id === course);
  const completed = useStore((s) => s.completed);
  if (!c) return <NotFound what="course" />;
  return (
    <div>
      <div className="mb-2 text-sm"><Link to="/learn" className="text-slate-400 hover:text-cyan-300">Learn</Link> <span className="text-slate-600">/</span> <span className="text-slate-300">{c.title}</span></div>
      <PageHeader eyebrow={c.level} title={c.title}>{c.blurb}</PageHeader>
      <ol className="space-y-2">
        {c.lessons.map((l, i) => (
          <li key={l.id}><Link to={`/learn/${c.id}/${l.id}`} className="card-link flex items-center gap-4">
            {completed[`lesson:${l.id}`] ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-slate-600" />}
            <div className="flex-1"><div className="font-medium text-white">Lesson {i + 1}: {l.title}</div><div className="text-sm text-slate-400">{l.objectives.join(' · ')}</div></div>
            <span className="flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3 w-3" />{l.minutes} min</span>
          </Link></li>
        ))}
      </ol>
    </div>
  );
}

function DiagramView({ d }: { d: Diagram }) {
  const pkt = useMemo(() => (d.kind === 'packet' && protocolById[d.protocol]?.sample ? buildPacket(protocolById[d.protocol].sample!) : null), [d]);
  if (d.kind === 'encap') return <Encapsulation />;
  if (d.kind === 'osi') return (
    <div className="space-y-1">{OSI.map((l) => <Link key={l.n} to={`/osi?layer=${l.n}`} className="flex items-center gap-3 rounded-lg border border-ink-700 px-3 py-1.5 text-sm hover:border-ink-500"><span className="w-6 font-mono font-bold" style={{ color: l.color }}>{l.n}</span><span className="w-28 font-medium text-white">{l.name}</span><span className="hidden flex-1 truncate text-slate-400 sm:block">{l.protocols.slice(0, 4).join(', ')}</span><span className="chip">{l.pdu.split(' ')[0]}</span></Link>)}</div>
  );
  if (d.kind === 'packet') return pkt ? <PacketInspector packet={pkt} /> : null;
  const s = scenarioById[d.id];
  return (
    <Link to={`/${s.kind === 'attack' ? 'security' : 'simulations'}/${s.id}`} className="card-link flex items-center gap-3">
      <PlayCircle className="h-8 w-8 text-cyan-400" /><div><div className="font-medium text-white">Open the simulation: {s.title}</div><div className="text-sm text-slate-400">{s.summary}</div></div>
    </Link>
  );
}

export function LessonPage() {
  const { course = '', lesson = '' } = useParams();
  const idx = ALL_LESSONS.findIndex((l) => l.id === lesson && l.course.id === course);
  const l = ALL_LESSONS[idx];
  const completed = useStore((s) => s.completed);
  const [exDone, setExDone] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  useEffect(() => { setExDone(false); setChecks({}); if (l) store.visit(`lesson:${l.id}`); }, [l]);
  if (!l) return <NotFound what="lesson" />;
  const qs = l.check.map((id) => BANK.find((q) => q.id === id)!).filter(Boolean);
  const checkScore = Object.values(checks).filter(Boolean).length;
  const isDone = !!completed[`lesson:${l.id}`];
  const canComplete = exDone && Object.keys(checks).length === qs.length;
  const prev = ALL_LESSONS[idx - 1], next = ALL_LESSONS[idx + 1];
  const S = ({ icon: I, n, t, children }: { icon: typeof Target; n: number; t: string; children: React.ReactNode }) => (
    <section className="panel p-5"><h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white"><I className="h-4 w-4 text-cyan-400" />{n}. {t}</h2>{children}</section>
  );
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 text-sm"><Link to="/learn" className="text-slate-400 hover:text-cyan-300">Learn</Link> <span className="text-slate-600">/</span> <Link to={`/learn/${l.course.id}`} className="text-slate-400 hover:text-cyan-300">{l.course.title}</Link></div>
      <PageHeader eyebrow={`${l.course.title} · ${l.minutes} min`} title={l.title} actions={<BookmarkButton id={`lesson:${l.id}`} />} />
      <div className="space-y-4">
        <S icon={Target} n={1} t="Learning objectives"><ul className="space-y-1 text-sm text-slate-300">{l.objectives.map((o) => <li key={o} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />{o}</li>)}</ul></S>
        <S icon={Lightbulb} n={2} t="Simple explanation"><p className="text-[15px] leading-relaxed text-slate-200">{l.simple}</p></S>
        <S icon={Cpu} n={3} t="Technical explanation"><div className="space-y-3 text-sm leading-relaxed text-slate-300">{l.technical.map((t) => <p key={t}>{t}</p>)}</div></S>
        <S icon={Image} n={4} t="Diagram"><DiagramView d={l.diagram} /></S>
        <S icon={FlaskConical} n={5} t="Practical example"><p className="text-sm text-slate-300">{l.example}</p></S>
        <S icon={FlaskConical} n={6} t="Interactive exercise">{exDone && <div className="mb-2 text-sm text-emerald-300"><CheckCircle2 className="mr-1 inline h-4 w-4" />Exercise completed</div>}<ExerciseBox ex={l.exercise} onDone={() => setExDone(true)} /></S>
        <S icon={ListChecks} n={7} t={`Knowledge check (${checkScore}/${qs.length})`}>
          <div className="space-y-3">{qs.map((q, i) => <QuestionCard key={q.id} q={q} index={i} onAnswer={(ok) => setChecks((c) => ({ ...c, [q.id]: ok }))} />)}</div>
        </S>
        <S icon={NotebookPen} n={8} t="Summary notes"><ul className="grid gap-2 sm:grid-cols-3">{l.summary.map((s) => <li key={s} className="rounded-lg bg-ink-950/60 p-3 text-sm text-slate-200">{s}</li>)}</ul></S>
        <div className="panel flex flex-wrap items-center gap-3 p-4">
          {isDone ? <span className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />Lesson completed</span>
            : <button className="btn btn-primary" disabled={!canComplete} onClick={() => store.complete(`lesson:${l.id}`)}>Mark lesson complete</button>}
          {!isDone && !canComplete && <span className="text-xs text-slate-500">Finish the exercise and answer every knowledge-check question to complete.</span>}
          {isDone && <button className="btn btn-sm" onClick={() => store.uncomplete(`lesson:${l.id}`)}>Mark incomplete</button>}
          <div className="ml-auto flex gap-2">
            {prev && <Link className="btn" to={`/learn/${prev.course.id}/${prev.id}`}><ArrowLeft className="h-4 w-4" />Previous</Link>}
            {next && <Link className="btn" to={`/learn/${next.course.id}/${next.id}`}>Next<ArrowRight className="h-4 w-4" /></Link>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Exams
const PRESETS: { id: string; title: string; desc: string; topics: Topic[]; count: number; subnet: number }[] = [
  { id: 'fundamentals', title: 'Networking fundamentals', desc: 'Devices, OSI, addressing basics.', topics: ['fundamentals', 'osi', 'addressing'], count: 10, subnet: 0 },
  { id: 'ccna', title: 'CCNA practice exam', desc: 'Mixed topics at CCNA difficulty, including subnetting.', topics: ['osi', 'addressing', 'transport', 'switching', 'routing', 'application', 'security', 'troubleshooting'], count: 16, subnet: 4 },
  { id: 'packets', title: 'Packet interpretation', desc: 'Read real header structures and decide what is happening.', topics: ['transport', 'application', 'addressing', 'routing'], count: 6, subnet: 0 },
  { id: 'security', title: 'Security fundamentals', desc: 'Attacks, detection and mitigation.', topics: ['security'], count: 8, subnet: 0 },
  { id: 'subnet', title: 'Subnetting drill', desc: '10 freshly generated subnetting problems.', topics: [], count: 0, subnet: 10 },
  { id: 'troubleshooting', title: 'Troubleshooting scenarios', desc: 'Symptoms, tools and root causes.', topics: ['troubleshooting', 'routing'], count: 8, subnet: 0 },
];

function makeExam(p: typeof PRESETS[number], seed: number): Question[] {
  let pool = BANK.filter((q) => p.topics.includes(q.topic));
  if (p.id === 'packets') pool = BANK.filter((q) => q.type === 'packet');
  let x = seed;
  const rnd = () => { x = (x * 1103515245 + 12345) >>> 0; return x / 2 ** 32; };
  const picked = [...pool].sort(() => rnd() - 0.5).slice(0, p.count);
  const subs = Array.from({ length: p.subnet }, (_, i) => subnetQuestion(seed + i * 17));
  return [...picked, ...subs].sort(() => rnd() - 0.5);
}

export function Exams() {
  const [params, setParams] = useSearchParams();
  const pid = params.get('exam');
  const preset = PRESETS.find((p) => p.id === pid);
  const [seed, setSeed] = useState(() => Date.now() % 1e6);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const exam = useMemo(() => (preset ? makeExam(preset, seed) : []), [preset, seed]);
  const exams = useStore((s) => s.exams);
  useEffect(() => { setAnswers({}); setSaved(false); }, [pid, seed]);
  const finished = exam.length > 0 && Object.keys(answers).length === exam.length;
  const score = Object.values(answers).filter(Boolean).length;
  useEffect(() => {
    if (finished && !saved && preset) {
      const byTopic: Record<string, [number, number]> = {};
      exam.forEach((q) => { const t = byTopic[q.topic] ?? [0, 0]; byTopic[q.topic] = [t[0] + (answers[q.id] ? 1 : 0), t[1] + 1]; });
      store.addExam({ id: preset.id, title: preset.title, score, total: exam.length, date: Date.now(), byTopic });
      setSaved(true);
    }
  }, [finished, saved, preset, exam, answers, score]);

  if (!preset) return (
    <div>
      <PageHeader eyebrow="Examination system" title="Practice exams">Immediate feedback with explanations. Results are saved to your progress. Subnetting questions are generated fresh each attempt and marked by the calculator engine.</PageHeader>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PRESETS.map((p) => {
          const best = exams.filter((e) => e.id === p.id).reduce((m, e) => Math.max(m, Math.round((e.score / e.total) * 100)), -1);
          const n = p.id === 'packets' ? BANK.filter((q) => q.type === 'packet').length : Math.min(p.count, BANK.filter((q) => p.topics.includes(q.topic)).length) + p.subnet;
          return (
            <button key={p.id} onClick={() => { setSeed(Date.now() % 1e6); setParams({ exam: p.id }); }} className="card-link text-left">
              <div className="font-semibold text-white">{p.title}</div><p className="mt-1 text-sm text-slate-400">{p.desc}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{n} questions</span>{best >= 0 && <span className="flex items-center gap-1 text-amber-300"><Trophy className="h-3 w-3" />best {best}%</span>}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-sm"><button onClick={() => setParams({})} className="text-slate-400 hover:text-cyan-300">Exams</button> <span className="text-slate-600">/</span> <span className="text-slate-300">{preset.title}</span></div>
      <PageHeader eyebrow="Exam in progress" title={preset.title} actions={<button className="btn" onClick={() => setSeed(seed + 1)}><RotateCcw className="h-4 w-4" />New attempt</button>}>
        Answered {Object.keys(answers).length}/{exam.length} · Score {score}
      </PageHeader>
      <div className="sticky top-[61px] z-20 -mx-1 mb-4 h-1.5 overflow-hidden rounded bg-ink-800"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${(Object.keys(answers).length / exam.length) * 100}%` }} /></div>
      <div className="space-y-3">{exam.map((q, i) => <QuestionCard key={q.id + seed} q={q} index={i} onAnswer={(ok) => setAnswers((a) => ({ ...a, [q.id]: ok }))} />)}</div>
      {finished && (
        <div className="panel mt-6 p-6 text-center">
          <Trophy className="mx-auto h-10 w-10 text-amber-300" />
          <div className="mt-2 text-3xl font-semibold text-white">{score}/{exam.length} · {Math.round((score / exam.length) * 100)}%</div>
          <p className="mt-1 text-sm text-slate-400">{score / exam.length >= 0.8 ? 'Excellent — exam-ready on these topics.' : score / exam.length >= 0.6 ? 'Good. Review the explanations for the ones you missed.' : 'Keep practising — revisit the related lessons and simulations.'} Result saved to Progress.</p>
          <div className="mt-4 flex justify-center gap-2"><button className="btn btn-primary" onClick={() => setSeed(seed + 1)}>Try again</button><Link to="/progress" className="btn">View progress</Link></div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Progress
export function ProgressPage() {
  const s = useStore((x) => x);
  const lessonsDone = ALL_LESSONS.filter((l) => s.completed[`lesson:${l.id}`]).length;
  const simsDone = [...guided, ...attacks].filter((x) => s.completed[`sim:${x.id}`]).length;
  const protos = protocols.filter((p) => s.visited[`protocol:${p.id}`]).length;
  const courseData = COURSES.map((c) => ({ name: c.title.replace(' networking', '').replace(' fundamentals', ''), pct: Math.round((c.lessons.filter((l) => s.completed[`lesson:${l.id}`]).length / c.lessons.length) * 100) }));
  const topicAgg: Record<string, [number, number]> = {};
  s.exams.forEach((e: ExamResult) => Object.entries(e.byTopic).forEach(([t, [a, b]]) => { const c = topicAgg[t] ?? [0, 0]; topicAgg[t] = [c[0] + a, c[1] + b]; }));
  const topicData = Object.entries(topicAgg).map(([t, [a, b]]) => ({ name: TOPICS[t as Topic], pct: Math.round((a / b) * 100) }));
  const history = s.exams.slice(-20).map((e, i) => ({ n: i + 1, pct: Math.round((e.score / e.total) * 100), title: e.title }));
  const axis = { stroke: '#64748b', fontSize: 11 };
  const tip = { contentStyle: { background: '#0d1628', border: '1px solid #263556', borderRadius: 8, fontSize: 12 }, labelStyle: { color: '#e2e8f0' } };
  return (
    <div>
      <PageHeader eyebrow="Learning analytics" title="Your progress">Progress is saved in this browser (localStorage). Use Settings to export or import it between devices.</PageHeader>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['Lessons', `${lessonsDone}/${ALL_LESSONS.length}`], ['Simulations', `${simsDone}/${guided.length + attacks.length}`], ['Protocols explored', `${protos}/${protocols.length}`], ['Exams taken', s.exams.length]].map(([l, v]) => <div key={l} className="panel p-4"><div className="text-xs text-slate-500">{l}</div><div className="mt-1 text-2xl font-semibold text-white">{v}</div></div>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-4"><h2 className="mb-3 text-sm font-semibold text-white">Course completion (%)</h2>
          <ResponsiveContainer width="100%" height={240}><BarChart data={courseData} margin={{ left: -20 }}><CartesianGrid stroke="#1a2742" vertical={false} /><XAxis dataKey="name" tick={axis} interval={0} angle={-20} textAnchor="end" height={60} /><YAxis domain={[0, 100]} tick={axis} /><Tooltip {...tip} cursor={{ fill: '#1a274255' }} /><Bar dataKey="pct" name="Complete %" fill="#22d3ee" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <div className="panel p-4"><h2 className="mb-3 text-sm font-semibold text-white">Exam scores over time (%)</h2>
          {history.length ? <ResponsiveContainer width="100%" height={240}><LineChart data={history} margin={{ left: -20 }}><CartesianGrid stroke="#1a2742" vertical={false} /><XAxis dataKey="n" tick={axis} /><YAxis domain={[0, 100]} tick={axis} /><Tooltip {...tip} formatter={(v) => [`${v}%`, 'Score']} labelFormatter={(n) => history[Number(n) - 1]?.title ?? ''} /><Line dataKey="pct" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: '#60a5fa' }} /></LineChart></ResponsiveContainer> : <p className="py-16 text-center text-sm text-slate-500">Take an exam to see your trend.</p>}</div>
        <div className="panel p-4"><h2 className="mb-3 text-sm font-semibold text-white">Accuracy by topic (%)</h2>
          {topicData.length ? <ResponsiveContainer width="100%" height={Math.max(160, topicData.length * 34)}><BarChart data={topicData} layout="vertical" margin={{ left: 40 }}><CartesianGrid stroke="#1a2742" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={axis} /><YAxis type="category" dataKey="name" tick={axis} width={110} /><Tooltip {...tip} cursor={{ fill: '#1a274255' }} /><Bar dataKey="pct" name="Accuracy %" fill="#a78bfa" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <p className="py-10 text-center text-sm text-slate-500">No exam data yet.</p>}</div>
        <div className="panel p-4"><h2 className="mb-3 text-sm font-semibold text-white">Recent exams</h2>
          <table className="w-full text-sm"><tbody>{s.exams.slice(-8).reverse().map((e, i) => <tr key={i} className="border-t border-ink-800"><td className="py-1.5 text-slate-200">{e.title}</td><td className="text-slate-500">{new Date(e.date).toLocaleDateString()}</td><td className="text-right font-mono text-cyan-200">{e.score}/{e.total}</td></tr>)}</tbody></table>
          {!s.exams.length && <p className="text-sm text-slate-500">None yet.</p>}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Glossary
export function Glossary() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const list = GLOSSARY.filter(([t, d]) => !q || `${t} ${d}`.toLowerCase().includes(q.toLowerCase()));
  const letters = Array.from(new Set(list.map(([t]) => t[0].toUpperCase())));
  return (
    <div>
      <PageHeader eyebrow="Knowledge base" title="Networking glossary">{GLOSSARY.length} terms. Matching protocols link to their explorer pages.</PageHeader>
      <input className="input mb-5 max-w-md" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter terms…" aria-label="Filter glossary" />
      {letters.map((L) => (
        <section key={L} className="mb-5"><h2 className="mb-2 font-mono text-lg text-cyan-400">{L}</h2>
          <dl className="grid gap-2 md:grid-cols-2">{list.filter(([t]) => t[0].toUpperCase() === L).map(([t, d]) => {
            const p = protocols.find((x) => x.name.toLowerCase() === t.toLowerCase());
            return <div key={t} className="panel p-3"><dt className="font-medium text-white">{p ? <Link to={`/protocols/${p.id}`} className="hover:text-cyan-300">{t} →</Link> : t}</dt><dd className="mt-0.5 text-sm text-slate-400">{d}</dd></div>;
          })}</dl>
        </section>
      ))}
      {!list.length && <p className="text-slate-400">No terms match.</p>}
    </div>
  );
}

// ------------------------------------------------------------------ Settings
export function SettingsPage() {
  const st = useStore((s) => s.settings);
  const [msg, setMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const copyData = () => navigator.clipboard.writeText(store.export()).then(() => setMsg('Progress JSON copied to clipboard.'), () => setMsg('Clipboard unavailable here — use Export instead.'));
  const exportData = () => {
    const blob = new Blob([store.export()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'netlab-progress.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  const importData = (f: File) => f.text().then((t) => { try { store.import(t); setMsg('Progress imported.'); } catch { setMsg('That file is not valid NETLAB progress JSON.'); } });
  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Preferences" title="Settings" />
      <div className="panel divide-y divide-ink-700">
        <div className="p-4"><label className="label" htmlFor="nm">Display name</label><input id="nm" className="input" value={st.name} onChange={(e) => store.settings({ name: e.target.value })} placeholder="Shown on the dashboard" /></div>
        <div className="flex items-center justify-between p-4"><div><div className="text-sm font-medium text-white">Default simulation speed</div><div className="text-xs text-slate-500">Applied when a simulation opens.</div></div>
          <select className="input !w-auto" value={st.speed} onChange={(e) => store.settings({ speed: Number(e.target.value) })}>{[0.5, 1, 1.5, 2].map((s) => <option key={s} value={s}>{s}×</option>)}</select></div>
        <div className="flex items-center justify-between p-4"><div><div className="text-sm font-medium text-white">Packet inspector default view</div></div>
          <select className="input !w-auto" value={st.inspectorMode} onChange={(e) => store.settings({ inspectorMode: e.target.value as typeof st.inspectorMode })}><option value="simple">Simple</option><option value="technical">Technical</option><option value="hex">Hex</option></select></div>
        <label className="flex items-center justify-between p-4"><div><div className="text-sm font-medium text-white">Reduce motion</div><div className="text-xs text-slate-500">Packets jump to each device instead of animating.</div></div>
          <input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={st.reducedMotion} onChange={(e) => store.settings({ reducedMotion: e.target.checked })} /></label>
        <div className="flex flex-wrap items-center gap-2 p-4">
          <button className="btn" onClick={exportData}><Download className="h-4 w-4" />Export progress</button>
          <label className="btn cursor-pointer"><Upload className="h-4 w-4" />Import progress<input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} /></label>
          <button className="btn" onClick={copyData}>Copy JSON</button>
          {confirmReset ? (
            <span className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-sm text-rose-200">Erase all progress, bookmarks, exams and settings? This cannot be undone.
              <button className="btn btn-sm !border-rose-500/60 !text-rose-200" onClick={() => { store.reset(); setConfirmReset(false); setMsg('All data reset.'); }}>Yes, reset</button>
              <button className="btn btn-sm" onClick={() => setConfirmReset(false)}>Cancel</button></span>
          ) : <button className="btn !border-rose-500/40 !text-rose-300" onClick={() => setConfirmReset(true)}><Trash2 className="h-4 w-4" />Reset everything</button>}
          {msg && <span className="text-sm text-emerald-300">{msg}</span>}
        </div>
      </div>
      <Account />
    </div>
  );
}

function Account() {
  const session = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ email: '', password: '', name: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  };
  if (!API_URL) return (
    <div className="panel mt-4 p-4 text-sm text-slate-400">
      <div className="mb-1 font-medium text-white">Account & cloud sync</div>
      Accounts are not enabled on this deployment, so progress is stored only in this browser. To enable sign-in and server-side progress, deploy the included Node/PostgreSQL API and build the site with <code className="font-mono text-cyan-200">VITE_API_URL</code> (see the README).
    </div>
  );
  return (
    <div className="panel mt-4 p-4">
      <div className="mb-3 font-medium text-white">Account & cloud sync</div>
      {session ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-300">Signed in as <span className="font-medium text-white">{session.user.name || session.user.email}</span> <span className="chip">{session.user.role}</span></span>
          <span className="text-xs text-slate-500">Changes sync automatically.</span>
          <div className="ml-auto flex gap-2">
            <button className="btn btn-sm" disabled={busy} onClick={() => run(push, 'Progress uploaded.')}><Upload className="h-3.5 w-3.5" />Upload</button>
            <button className="btn btn-sm" disabled={busy} onClick={() => run(pull, 'Progress downloaded.')}><Download className="h-3.5 w-3.5" />Download</button>
            <button className="btn btn-sm" onClick={logout}>Log out</button>
          </div>
        </div>
      ) : (
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => authenticate(mode, f.email, f.password, f.name), mode === 'login' ? 'Signed in.' : 'Account created.'); }}>
          {mode === 'register' && <input className="input sm:col-span-2" placeholder="Name (optional)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />}
          <input className="input" type="email" required placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
          <input className="input" type="password" required minLength={8} placeholder="Password (8+ characters)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          <div className="flex items-center gap-3 sm:col-span-2">
            <button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
            <button type="button" className="text-sm text-cyan-300 hover:underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in'}</button>
          </div>
        </form>
      )}
      {msg && <p className={`mt-2 text-sm ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`} role="status">{msg.text}</p>}
    </div>
  );
}
