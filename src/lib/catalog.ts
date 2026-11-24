import { protocols, protocolById } from '../data/protocols';
import { guided } from '../data/guided';
import { attacks } from '../data/attacks';
import { ALL_LESSONS } from '../data/lessons';
import { OSI, PORTS, GLOSSARY } from '../data/knowledge';

export const TOOLS = [
  { id: 'subnet', title: 'Subnetting calculator', desc: 'Network, broadcast, host range, wildcard and binary for any IPv4/CIDR.' },
  { id: 'converter', title: 'Binary & hex converter', desc: 'Decimal ⇄ binary ⇄ hexadecimal, plus IPv4 to binary.' },
  { id: 'ports', title: 'Port explorer', desc: 'Searchable database of common TCP and UDP ports.' },
  { id: 'dns', title: 'DNS lookup simulator', desc: 'Query A, AAAA, MX, CNAME, NS, TXT and PTR records in a simulated zone.' },
  { id: 'routing', title: 'Routing table explorer', desc: 'Test longest-prefix match and administrative distance.' },
  { id: 'builder', title: 'Packet header builder', desc: 'Build Ethernet/IPv4/TCP/UDP/ICMP headers and inspect every byte.' },
];

export const scenarioById = Object.fromEntries([...guided, ...attacks].map((s) => [s.id, s]));

export interface Item { key: string; title: string; href: string; kind: string; desc?: string }

export function resolveKey(key: string): Item | null {
  const [kind, id] = key.split(':');
  if (kind === 'protocol' && protocolById[id]) return { key, kind: 'Protocol', title: protocolById[id].name, href: `/protocols/${id}`, desc: protocolById[id].full };
  if (kind === 'sim' && scenarioById[id]) { const s = scenarioById[id]; return { key, kind: s.kind === 'attack' ? 'Security lab' : 'Simulation', title: s.title, href: s.kind === 'attack' ? `/security/${id}` : `/simulations/${id}`, desc: s.summary }; }
  if (kind === 'lesson') { const l = ALL_LESSONS.find((x) => x.id === id); if (l) return { key, kind: 'Lesson', title: l.title, href: `/learn/${l.course.id}/${l.id}`, desc: l.course.title }; }
  if (kind === 'tool') { const t = TOOLS.find((x) => x.id === id); if (t) return { key, kind: 'Tool', title: t.title, href: `/tools/${id}`, desc: t.desc }; }
  if (kind === 'page' && id === 'osi') return { key, kind: 'Lab', title: 'OSI model laboratory', href: '/osi' };
  return null;
}

let index: (Item & { text: string })[] | null = null;
function buildIndex() {
  const items: (Item & { text: string })[] = [];
  protocols.forEach((p) => items.push({ key: `protocol:${p.id}`, kind: 'Protocol', title: `${p.name} — ${p.full}`, href: `/protocols/${p.id}`, desc: p.what,
    text: [p.name, p.full, p.what, p.ports, p.standard, p.fields.map((f) => f[0]).join(' '), p.troubleshooting.map((t) => t.join(' ')).join(' ')].join(' ') }));
  [...guided, ...attacks].forEach((s) => items.push({ key: `sim:${s.id}`, kind: s.kind === 'attack' ? 'Security lab' : 'Simulation', title: s.title, href: s.kind === 'attack' ? `/security/${s.id}` : `/simulations/${s.id}`, desc: s.summary,
    text: [s.title, s.summary, s.protocols.join(' '), s.steps instanceof Function ? '' : s.steps.map((x) => x.title).join(' '), s.attack ? Object.values(s.attack).flat().join(' ') : '', s.devices.map((d) => d.type).join(' ')].join(' ') }));
  ALL_LESSONS.forEach((l) => items.push({ key: `lesson:${l.id}`, kind: 'Lesson', title: l.title, href: `/learn/${l.course.id}/${l.id}`, desc: `${l.course.title} · ${l.minutes} min`, text: [l.title, l.simple, l.technical.join(' '), l.objectives.join(' ')].join(' ') }));
  TOOLS.forEach((t) => items.push({ key: `tool:${t.id}`, kind: 'Tool', title: t.title, href: `/tools/${t.id}`, desc: t.desc, text: t.title + ' ' + t.desc }));
  OSI.forEach((l) => items.push({ key: `osi:${l.n}`, kind: 'OSI layer', title: `Layer ${l.n} — ${l.name}`, href: `/osi?layer=${l.n}`, desc: l.role, text: [l.name, l.role, l.pdu, l.protocols.join(' '), l.devices.join(' '), l.problems.join(' ')].join(' ') }));
  PORTS.forEach((p) => items.push({ key: `port:${p.port}`, kind: 'Port', title: `${p.port}/${p.proto} — ${p.service}`, href: `/tools/ports?q=${p.port}`, desc: p.desc, text: `${p.port} port ${p.service} ${p.desc}` }));
  GLOSSARY.forEach(([t, d]) => items.push({ key: `term:${t}`, kind: 'Glossary', title: t, href: `/glossary?q=${encodeURIComponent(t)}`, desc: d, text: `${t} ${d}` }));
  return items;
}

export function search(q: string, limit = 40): Item[] {
  if (!index) index = buildIndex();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored = index.map((it) => {
    const title = it.title.toLowerCase();
    const text = it.text.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (title === t || title.startsWith(t + ' ') || title.startsWith(t + '/')) score += 12;
      else if (title.includes(t)) score += 6;
      else if (text.includes(t)) score += 2;
      else return { it, score: 0 };
    }
    if (it.kind === 'Protocol') score += 1;
    return { it, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.it);
}
