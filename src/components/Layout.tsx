import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Layers, PlayCircle, ShieldAlert, Boxes, Wrench, GraduationCap, ClipboardCheck, BarChart3, BookA, Bookmark, Settings, Search, Menu, X, ChevronRight, ArrowUp, Keyboard, Home, MoreHorizontal, Volume2, VolumeX,
} from 'lucide-react';
import { search, type Item } from '../lib/catalog';
import { store, useStore } from '../lib/store';
import { play } from '../lib/sound';
import { protocols } from '../data/protocols';
import { guided } from '../data/guided';
import { attacks } from '../data/attacks';
import { ALL_LESSONS } from '../data/lessons';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, key: 'd', group: 'Explore', blurb: 'Your starting point and overview' },
  { to: '/protocols', label: 'Protocol explorer', icon: Layers, key: 'p', group: 'Explore', blurb: '32 protocols, decoded field by field' },
  { to: '/simulations', label: 'Simulations', icon: PlayCircle, key: 's', group: 'Explore', blurb: 'Watch packets cross the network' },
  { to: '/osi', label: 'OSI lab', icon: Boxes, key: 'o', group: 'Explore', blurb: 'Seven layers, encapsulation animated' },
  { to: '/tools', label: 'Tools', icon: Wrench, key: 't', group: 'Explore', blurb: 'Subnet, binary, ports, DNS and routing tools' },
  { to: '/security', label: 'Security lab', icon: ShieldAlert, key: 'a', group: 'Explore', blurb: 'Attacks replayed with defences on and off' },
  { to: '/learn', label: 'Learn', icon: GraduationCap, key: 'l', group: 'Practise', blurb: '8 courses, 16 hands-on lessons' },
  { to: '/exams', label: 'Exams', icon: ClipboardCheck, key: 'e', group: 'Practise', blurb: 'Test yourself with instant feedback' },
  { to: '/progress', label: 'Progress', icon: BarChart3, key: 'r', group: 'You', blurb: 'See how far you have come' },
  { to: '/glossary', label: 'Glossary', icon: BookA, key: 'g', group: 'You', blurb: '60 networking terms explained' },
  { to: '/saved', label: 'Saved', icon: Bookmark, key: 'b', group: 'You', blurb: 'Everything you bookmarked' },
  { to: '/settings', label: 'Settings', icon: Settings, key: ',', group: 'You', blurb: 'Preferences, account and data' },
];
const GROUPS = ['Explore', 'Practise', 'You'];
const sectionOf = (path: string) => NAV.find((n) => (n.end ? path === n.to : path === n.to || path.startsWith(n.to + '/'))) ?? NAV[0];
const AUTHOR = 'Mazwi Dlamini';

export const TOTAL_ITEMS = protocols.length + guided.length + attacks.length + ALL_LESSONS.length;

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-2">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#0d1628" stroke="#263556" />
        <path d="M11 15l9-5M11 17l9 5" stroke="#64748b" strokeWidth="1.6" />
        <circle cx="9" cy="16" r="3.5" fill="#22d3ee" />
        <circle cx="22.5" cy="9" r="2.8" fill="#60a5fa" />
        <circle cx="22.5" cy="23" r="2.8" fill="#60a5fa" />
      </svg>
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-[0.12em] text-white">NETLAB</div>
        <div className="text-[10px] text-slate-500">Network & Protocol Explorer</div>
      </div>
    </Link>
  );
}

function ProgressMini() {
  const completed = useStore((s) => s.completed);
  const visited = useStore((s) => s.visited);
  const done = Object.keys(completed).length + Object.keys(visited).filter((k) => k.startsWith('protocol:')).length;
  const pct = Math.min(100, Math.round((done / TOTAL_ITEMS) * 100));
  return (
    <Link to="/progress" className="mx-3 mb-3 block rounded-lg border border-ink-700 bg-ink-850 p-3 hover:border-ink-500">
      <div className="flex justify-between text-xs"><span className="text-slate-400">Learning progress</span><span className="font-semibold text-cyan-300">{pct}%</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${pct}%` }} /></div>
    </Link>
  );
}

function SearchBox() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => { setOpen(false); setQ(''); }, [loc.pathname, loc.search]);
  const results: Item[] = q.trim() ? search(q, 8) : [];
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const go = (href: string) => { nav(href); setOpen(false); setQ(''); ref.current?.blur(); };
  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && q.trim()) go(active < results.length ? results[active].href : `/search?q=${encodeURIComponent(q)}`);
          if (e.key === 'Escape') { setOpen(false); ref.current?.blur(); }
        }}
        className="input !pl-9 !pr-14" placeholder="Search protocols, ports, fields, devices, lessons…" aria-label="Search" role="combobox" aria-expanded={open && results.length > 0} aria-controls="search-results" />
      <span className="kbd absolute right-2.5 hidden sm:inline top-1/2 -translate-y-1/2">Ctrl K</span>
      {open && q.trim() && (
        <ul id="search-results" role="listbox" className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-ink-600 bg-ink-900 shadow-2xl">
          {results.map((r, i) => (
            <li key={r.key} role="option" aria-selected={i === active}>
              <button onMouseDown={() => go(r.href)} className={`flex w-full items-start gap-3 px-3 py-2 text-left ${i === active ? 'bg-ink-700' : 'hover:bg-ink-800'}`}>
                <span className="chip mt-0.5 shrink-0">{r.kind}</span>
                <span className="min-w-0"><span className="block truncate text-sm text-slate-100">{r.title}</span>{r.desc && <span className="block truncate text-xs text-slate-500">{r.desc}</span>}</span>
              </button>
            </li>
          ))}
          <li role="option" aria-selected={active === results.length}>
            <button onMouseDown={() => go(`/search?q=${encodeURIComponent(q)}`)} className={`w-full px-3 py-2 text-left text-sm text-cyan-300 ${active === results.length ? 'bg-ink-700' : 'hover:bg-ink-800'}`}>
              {results.length ? `See all results for "${q}"` : `No quick matches — search everything for "${q}"`}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}


/** Faint, tiled credit behind every page. Purely decorative: never blocks clicks. */
function Watermark() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='260'><text x='20' y='150' transform='rotate(-24 210 130)' font-family='Inter, sans-serif' font-size='17' font-weight='600' letter-spacing='2' fill='%2322d3ee' fill-opacity='0.045'>Developed by ${AUTHOR}</text></svg>`;
  return <div aria-hidden className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage: `url("data:image/svg+xml,${svg.replace(/#/g, '%23').replace(/"/g, "'")}")` }} />;
}

function Signature() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-20 right-3 z-40 lg:bottom-4 lg:right-4">
      <button onClick={() => { setOpen((o) => !o); play(open ? 'click' : 'ok'); }} aria-expanded={open} aria-label={`Developed by ${AUTHOR}`}
        className="group flex items-center gap-2 rounded-full border border-cyan-500/30 bg-ink-900/90 p-1 sm:pr-3 text-xs text-slate-300 shadow-lg shadow-cyan-500/10 backdrop-blur transition hover:border-cyan-400/60">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-[11px] font-bold text-ink-950">MD</span>
        <span className="hidden sm:inline">Developed by <b className="font-semibold text-cyan-200">{AUTHOR}</b></span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }}
            className="absolute bottom-11 right-0 w-64 rounded-xl border border-ink-600 bg-ink-900 p-4 text-sm shadow-2xl">
            <div className="font-semibold text-white">{AUTHOR}</div>
            <div className="text-xs text-slate-400">Designer & developer of NETLAB</div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">An interactive lab for learning how networks really work, from the bits in a header to a full TLS handshake.</p>
            <div className="mt-3 text-[11px] text-slate-500">© {new Date().getFullYear()} {AUTHOR}. All rights reserved.</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Thin bar that sweeps across the top on every route change. */
function RouteBar({ k }: { k: string }) {
  return (
    <motion.div key={k} aria-hidden className="fixed left-0 top-0 z-[60] h-0.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-300"
      initial={{ width: '0%', opacity: 1 }} animate={{ width: '100%', opacity: 0 }} transition={{ width: { duration: 0.5, ease: 'easeOut' }, opacity: { delay: 0.45, duration: 0.25 } }} />
  );
}

function Crumbs() {
  const { pathname } = useLocation();
  const sec = sectionOf(pathname);
  const rest = pathname.split('/').filter(Boolean).slice(1);
  const pretty = (s: string) => decodeURIComponent(s).replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-xs text-slate-500 xl:flex">
      <Link to="/" className="hover:text-cyan-300"><Home className="h-3.5 w-3.5" /></Link>
      {sec.to !== '/' && <><ChevronRight className="h-3 w-3" /><Link to={sec.to} className="truncate hover:text-cyan-300">{sec.label}</Link></>}
      {rest.map((r, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1"><ChevronRight className="h-3 w-3 shrink-0" /><span className="truncate text-slate-300">{pretty(r)}</span></span>
      ))}
    </nav>
  );
}

/** Previous / next section cards at the foot of every page. */
function Pager() {
  const { pathname } = useLocation();
  const i = NAV.indexOf(sectionOf(pathname));
  const prev = NAV[(i - 1 + NAV.length) % NAV.length], next = NAV[(i + 1) % NAV.length];
  const Card = ({ n, dir }: { n: typeof NAV[number]; dir: 'prev' | 'next' }) => (
    <Link to={n.to} className={`group flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/70 p-4 transition hover:-translate-y-0.5 hover:border-cyan-500/40 hover:bg-ink-850 ${dir === 'next' ? 'flex-row-reverse text-right' : ''}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink-800 text-cyan-300 transition group-hover:bg-cyan-500/15"><n.icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-slate-500">{dir === 'prev' ? '← Previous section' : 'Next section →'} <span className="kbd ml-1">{dir === 'prev' ? '[' : ']'}</span></span>
        <span className="block truncate font-semibold text-slate-100">{n.label}</span>
        <span className="block truncate text-xs text-slate-500">{n.blurb}</span>
      </span>
    </Link>
  );
  return (
    <div className="mt-12 grid gap-3 sm:grid-cols-2">
      <Card n={prev} dir="prev" /><Card n={next} dir="next" />
    </div>
  );
}

function Shortcuts({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <motion.div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div role="dialog" aria-label="Keyboard shortcuts" className="panel w-full max-w-lg p-5" initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="h2 flex items-center gap-2"><Keyboard className="h-5 w-5 text-cyan-300" />Jump anywhere</h2><button className="btn btn-sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button></div>
        <p className="mt-1 text-xs text-slate-400">Press <span className="kbd">G</span> then a letter to fly to a section.</p>
        <div className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} onClick={onClose} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-ink-800">
              <span className="flex items-center gap-2"><n.icon className="h-4 w-4 text-slate-500" />{n.label}</span>
              <span><span className="kbd">G</span> <span className="kbd">{n.key.toUpperCase()}</span></span>
            </Link>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-ink-700 pt-3 text-xs text-slate-400">
          <span><span className="kbd">Ctrl K</span> or <span className="kbd">/</span> search</span>
          <span><span className="kbd">[</span> <span className="kbd">]</span> previous / next section</span>
          <span><span className="kbd">?</span> this panel</span>
          <span><span className="kbd">Space</span> <span className="kbd">← →</span> in simulations</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function useHotkeys(openHelp: () => void) {
  const nav = useNavigate();
  const loc = useLocation();
  const pending = useRef(0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName) || t?.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (Date.now() - pending.current < 1200) {
        pending.current = 0;
        const n = NAV.find((x) => x.key === key);
        if (n) { e.preventDefault(); nav(n.to); }
        return;
      }
      if (key === 'g') { pending.current = Date.now(); return; }
      if (e.key === '?') { e.preventDefault(); openHelp(); return; }
      if (e.key === '[' || e.key === ']') {
        const i = NAV.indexOf(sectionOf(loc.pathname));
        nav(NAV[(i + (e.key === ']' ? 1 : -1) + NAV.length) % NAV.length].to);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [nav, loc.pathname, openHelp]);
}

const TABS = ['/', '/protocols', '/simulations', '/learn'];

export default function Layout({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [top, setTop] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    const f = () => setTop(window.scrollY > 600);
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  useHotkeys(() => setHelp(true));
  const sound = useStore((s) => s.settings.sound);
  const firstNav = useRef(true);
  useEffect(() => { if (firstNav.current) { firstNav.current = false; return; } play('nav'); }, [loc.pathname]);
  useEffect(() => { if (help) play('open'); }, [help]);
  const current = sectionOf(loc.pathname);

  const side = (id: string) => (
    <nav className="flex h-full flex-col" aria-label="Main">
      <div className="py-4"><Logo /></div>
      <div className="flex-1 overflow-y-auto px-3">
        {GROUPS.map((g) => (
          <div key={g} className="mb-3">
            <div className="px-3 pb-1 pt-2 text-[11px] font-semibold text-slate-600">{g}</div>
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === g).map((n) => {
                const active = n === current;
                return (
                  <li key={n.to}>
                    <NavLink to={n.to} end={n.end} className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? 'text-cyan-100' : 'text-slate-400 hover:text-slate-100'}`}>
                      {active && <motion.span layoutId={`nav-pill-${id}`} className="absolute inset-0 rounded-lg border border-cyan-500/30 bg-gradient-to-r from-cyan-500/20 to-blue-500/5" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                      {active && <motion.span layoutId={`nav-dot-${id}`} className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />}
                      <n.icon className={`relative h-4 w-4 transition group-hover:scale-110 ${active ? 'text-cyan-300' : ''}`} />
                      <span className="relative flex-1">{n.label}</span>
                      <span className="relative hidden text-[10px] text-slate-600 opacity-0 transition group-hover:opacity-100 lg:inline">G {n.key.toUpperCase()}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <ProgressMini />
      <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850/60 px-3 py-2 text-[11px] text-slate-500">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-[10px] font-bold text-ink-950">MD</span>
        <span>Developed by<br /><b className="text-slate-300">{AUTHOR}</b></span>
      </div>
    </nav>
  );
  return (
    <div className="relative min-h-full lg:pl-60">
      <Watermark />
      <RouteBar k={loc.pathname} />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-cyan-500 focus:px-3 focus:py-1 focus:text-ink-950">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-ink-700 bg-ink-900 lg:block">{side('d')}</aside>
      <AnimatePresence>
        {menu && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)} />
            <motion.aside className="absolute inset-y-0 left-0 w-64 border-r border-ink-700 bg-ink-900" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
              <button className="btn btn-sm absolute right-3 top-4 z-10" onClick={() => setMenu(false)} aria-label="Close menu"><X className="h-4 w-4" /></button>
              {side('m')}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-700 bg-ink-950/85 px-4 py-3 backdrop-blur md:px-8">
        <button className="btn btn-sm lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu"><Menu className="h-4 w-4" /></button>
        <SearchBox />
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <Crumbs />
          <button className={`btn btn-sm ${sound ? 'text-cyan-200' : ''}`} onClick={() => { store.settings({ sound: !sound }); if (!sound) setTimeout(() => play('correct'), 30); }} aria-pressed={sound} aria-label={sound ? 'Mute sound effects' : 'Turn on sound effects'} title={sound ? 'Sound on' : 'Sound off'}>
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button className="btn btn-sm hidden md:inline-flex" onClick={() => setHelp(true)} aria-label="Keyboard shortcuts"><Keyboard className="h-4 w-4" /><span className="kbd">?</span></button>
        </div>
      </header>
      <main id="main" className="relative z-10 mx-auto max-w-[1500px] px-4 py-6 pb-24 md:px-8 md:py-8 lg:pb-8">
        <motion.div key={loc.pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }}>
          {children}
        </motion.div>
        <Pager />
      </main>
      <footer className="relative z-10 border-t border-ink-800 px-8 py-5 pb-24 text-xs text-slate-500 lg:pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-slate-400">NETLAB · Developed by <span className="text-cyan-300">{AUTHOR}</span> · © {new Date().getFullYear()}</span>
          <button className="hover:text-cyan-300" onClick={() => setHelp(true)}>Keyboard shortcuts (?)</button>
        </div>
        <p className="mt-2">All packets are generated by NETLAB's in-browser packet builder (with real header layouts and checksums), never captured from a live network. Addresses use private and documentation ranges (RFC 1918 / RFC 5737 / RFC 3849).</p>
      </footer>

      {/* Mobile tab bar */}
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-ink-700 bg-ink-900/95 backdrop-blur lg:hidden">
        {TABS.map((to) => {
          const n = NAV.find((x) => x.to === to)!;
          const active = n === current;
          return (
            <Link key={to} to={to} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${active ? 'text-cyan-300' : 'text-slate-500'}`}>
              {active && <motion.span layoutId="tab-glow" className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />}
              <n.icon className="h-5 w-5" />{n.label.split(' ')[0]}
            </Link>
          );
        })}
        <button onClick={() => setMenu(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] text-slate-500"><MoreHorizontal className="h-5 w-5" />More</button>
      </nav>

      <Signature />
      <AnimatePresence>
        {top && (
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="btn fixed bottom-32 right-4 z-40 !rounded-full !p-2.5 shadow-lg lg:bottom-16" aria-label="Back to top"><ArrowUp className="h-4 w-4" /></motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>{help && <Shortcuts onClose={() => setHelp(false)} />}</AnimatePresence>
    </div>
  );
}
