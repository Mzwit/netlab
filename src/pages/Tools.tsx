import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, XCircle, Lock } from 'lucide-react';
import { PageHeader, BookmarkButton, Tabs } from '../components/ui';
import PacketInspector from '../components/PacketInspector';
import { TOOLS } from '../lib/catalog';
import { calcSubnet, parseCidrInput, splitSubnets, matches, maskFromCidr } from '../lib/subnet';
import { parseIPv4, intToIPv4, ipv4ToInt } from '../engine/bytes';
import { buildPacket, type PacketSpec } from '../engine/packet';
import { PORTS, DNS_ZONE, DNS_TYPES_INFO, SAMPLE_ROUTES, ROUTE_SOURCES, type RouteEntry } from '../data/knowledge';
import { store } from '../lib/store';
import { NotFound } from './Explore';

export function ToolsIndex() {
  return (
    <div>
      <PageHeader eyebrow="Network tools" title="Calculators & explorers">Functional tools that do real calculations in your browser.</PageHeader>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((t) => <Link key={t.id} to={`/tools/${t.id}`} className="card-link"><div className="font-semibold text-white">{t.title}</div><p className="mt-1 text-sm text-slate-400">{t.desc}</p><div className="mt-3 flex items-center gap-1 text-xs text-cyan-300">Open <ArrowRight className="h-3 w-3" /></div></Link>)}
      </div>
    </div>
  );
}

export function ToolPage() {
  const { id = '' } = useParams();
  const t = TOOLS.find((x) => x.id === id);
  useEffect(() => { if (t) store.visit(`tool:${t.id}`); }, [t]);
  if (!t) return <NotFound what="tool" />;
  const C = { subnet: Subnet, converter: Converter, ports: Ports, dns: DnsTool, routing: Routing, builder: Builder }[t.id]!;
  return (
    <div>
      <div className="mb-2 text-sm"><Link to="/tools" className="text-slate-400 hover:text-cyan-300">Tools</Link> <span className="text-slate-600">/</span> <span className="text-slate-300">{t.title}</span></div>
      <PageHeader eyebrow="Tool" title={t.title} actions={<BookmarkButton id={`tool:${t.id}`} />}>{t.desc}</PageHeader>
      <C />
    </div>
  );
}

const Row = ({ k, v, mono = true }: { k: string; v: string | number; mono?: boolean }) => (
  <div className="flex justify-between gap-4 border-b border-ink-800 py-1.5 text-sm last:border-0"><span className="text-slate-400">{k}</span><span className={`text-right text-slate-100 ${mono ? 'font-mono' : ''}`}>{v}</span></div>
);
const Err = ({ msg }: { msg: string }) => <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert"><XCircle className="h-4 w-4" />{msg}</div>;

// ------------------------------------------------------------------ Subnet
function Subnet() {
  const [input, setInput] = useState('192.168.10.77/26');
  const [split, setSplit] = useState(28);
  const res = useMemo(() => {
    try { const { ip, cidr } = parseCidrInput(input); return { r: calcSubnet(ip, cidr) }; } catch (e) { return { err: (e as Error).message }; }
  }, [input]);
  const r = res.r;
  const subs = r && split > r.cidr ? splitSubnets(r.ip, r.cidr, split) : [];
  const bitRow = (label: string, b: string) => (
    <div className="flex flex-wrap items-center gap-2 font-mono text-xs"><span className="w-20 text-slate-500">{label}</span>
      <span>{b.split('').map((c, i) => c === '.' ? <span key={i} className="text-slate-600">.</span> : <span key={i} className={(() => { const bit = b.slice(0, i).replace(/\./g, '').length; return bit < (r?.cidr ?? 0) ? 'text-cyan-300' : 'text-amber-300'; })()}>{c}</span>)}</span>
    </div>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel p-5">
        <label className="label" htmlFor="sn">IPv4 address with CIDR or mask</label>
        <input id="sn" className="input font-mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder="10.0.0.5/255.255.255.0" />
        <div className="mt-2 flex flex-wrap gap-1">{['192.168.1.130/25', '10.20.30.40/22', '172.16.5.4/12', '203.0.113.9/30', '10.0.0.1/32'].map((x) => <button key={x} className="chip hover:border-cyan-500/50" onClick={() => setInput(x)}>{x}</button>)}</div>
        <div className="mt-4">
          {res.err && <Err msg={res.err} />}
          {r && <>
            <Row k="Address" v={`${r.ip}/${r.cidr}`} />
            <Row k="Subnet mask" v={r.mask} />
            <Row k="Wildcard mask" v={r.wildcard} />
            <Row k="Network address" v={r.network} />
            <Row k="Broadcast address" v={r.cidr >= 31 ? 'n/a (RFC 3021 / host route)' : r.broadcast} />
            <Row k="First usable host" v={r.first} />
            <Row k="Last usable host" v={r.last} />
            <Row k="Usable hosts" v={r.usable.toLocaleString()} />
            <Row k="Total addresses" v={r.total.toLocaleString()} />
            <Row k="Class / type" v={`${r.ipClass} · ${r.type}`} mono={false} />
          </>}
        </div>
      </div>
      {r && (
        <div className="space-y-4">
          <div className="panel p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">Binary representation <span className="font-normal text-slate-500">(<span className="text-cyan-300">network bits</span> / <span className="text-amber-300">host bits</span>)</span></h3>
            <div className="space-y-1.5 overflow-x-auto">{bitRow('Address', r.binary.ip)}{bitRow('Mask', r.binary.mask)}{bitRow('Network', r.binary.network)}{bitRow('Broadcast', r.binary.broadcast)}</div>
            <p className="mt-3 text-xs text-slate-400">Network = address AND mask. Broadcast = network OR wildcard. Usable hosts = 2^{32 - r.cidr} − 2{r.cidr >= 31 ? ' (except /31 and /32)' : ''}.</p>
          </div>
          <div className="panel p-5">
            <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-white">Split into subnets</h3>
              <label className="flex items-center gap-2 text-xs text-slate-400">new prefix /<input type="number" min={r.cidr} max={32} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="input !w-16 !py-1" /></label></div>
            {split <= r.cidr ? <p className="text-xs text-slate-500">Choose a prefix longer than /{r.cidr}.</p> : (
              <div className="max-h-64 overflow-auto"><table className="w-full font-mono text-xs"><thead className="text-left text-slate-500"><tr><th className="py-1">#</th><th>Network</th><th>Hosts</th><th>Broadcast</th></tr></thead>
                <tbody>{subs.map((s, i) => <tr key={i} className="border-t border-ink-800 text-slate-300"><td className="py-1">{i + 1}</td><td>{s.network}/{s.cidr}</td><td>{s.first} – {s.last}</td><td>{s.broadcast}</td></tr>)}</tbody></table>
                <p className="mt-2 text-xs text-slate-500">{2 ** (split - r.cidr)} subnets of {calcSubnet(r.ip, split).usable} usable hosts{2 ** (split - r.cidr) > 64 ? ' (first 64 shown)' : ''}.</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Converter
function Converter() {
  const [val, setVal] = useState('192');
  const [base, setBase] = useState<'dec' | 'bin' | 'hex'>('dec');
  const [ip, setIp] = useState('192.168.10.77');
  const n = useMemo(() => {
    const s = val.trim().replace(/^0x/i, '').replace(/^0b/i, '').replace(/[\s_]/g, '');
    const re = { dec: /^\d+$/, bin: /^[01]+$/, hex: /^[0-9a-f]+$/i }[base];
    if (!s || !re.test(s)) return null;
    const v = BigInt(base === 'dec' ? s : base === 'bin' ? '0b' + s : '0x' + s);
    return v;
  }, [val, base]);
  const ipRes = useMemo(() => { try { return parseIPv4(ip); } catch (e) { return (e as Error).message; } }, [ip]);
  const bits = n !== null ? n.toString(2) : '';
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel p-5">
        <div className="mb-3 flex items-center justify-between"><label className="label !mb-0" htmlFor="cv">Number</label><Tabs size="sm" value={base} onChange={setBase} options={[{ id: 'dec', label: 'Decimal' }, { id: 'bin', label: 'Binary' }, { id: 'hex', label: 'Hex' }]} /></div>
        <input id="cv" className="input font-mono" value={val} onChange={(e) => setVal(e.target.value)} />
        <div className="mt-4">
          {n === null ? <Err msg={`Not a valid ${base === 'dec' ? 'decimal' : base === 'bin' ? 'binary' : 'hexadecimal'} number`} /> : <>
            <Row k="Decimal" v={n.toString(10)} />
            <Row k="Binary" v={bits.padStart(Math.ceil(bits.length / 8) * 8, '0').replace(/(.{8})(?=.)/g, '$1 ')} />
            <Row k="Hexadecimal" v={'0x' + n.toString(16).toUpperCase()} />
            <Row k="Octal" v={'0o' + n.toString(8)} />
            <Row k="Bits needed" v={bits.length} />
          </>}
        </div>
        {n !== null && n < 256n && (
          <div className="mt-4">
            <h3 className="label">Place values (one octet)</h3>
            <div className="grid grid-cols-8 gap-1 text-center font-mono text-xs">
              {[128, 64, 32, 16, 8, 4, 2, 1].map((pv, i) => { const on = (Number(n) >> (7 - i)) & 1; return <div key={pv} className={`rounded-md border py-1.5 ${on ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : 'border-ink-700 text-slate-500'}`}><div>{pv}</div><div className="text-base">{on}</div></div>; })}
            </div>
            <p className="mt-2 text-xs text-slate-400">{[128, 64, 32, 16, 8, 4, 2, 1].filter((_, i) => (Number(n) >> (7 - i)) & 1).join(' + ') || '0'} = {n.toString()}</p>
          </div>
        )}
      </div>
      <div className="panel p-5">
        <label className="label" htmlFor="ipc">IPv4 address → binary</label>
        <input id="ipc" className="input font-mono" value={ip} onChange={(e) => setIp(e.target.value)} />
        <div className="mt-4">
          {typeof ipRes === 'string' ? <Err msg={ipRes} /> : <>
            {ipRes.map((o, i) => <Row key={i} k={`Octet ${i + 1}: ${o}`} v={`${o.toString(2).padStart(8, '0')}  ·  0x${o.toString(16).padStart(2, '0').toUpperCase()}`} />)}
            <Row k="Dotted binary" v={ipRes.map((o) => o.toString(2).padStart(8, '0')).join('.')} />
            <Row k="32-bit integer" v={ipv4ToInt(ip).toLocaleString()} />
            <Row k="Hex" v={'0x' + ipRes.map((o) => o.toString(16).padStart(2, '0')).join('').toUpperCase()} />
          </>}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Ports
function Ports() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [proto, setProto] = useState<'all' | 'TCP' | 'UDP'>('all');
  const list = PORTS.filter((p) => (proto === 'all' || p.proto.includes(proto)) && (!q || `${p.port} ${p.service} ${p.desc}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 p-3">
        <input className="input !w-72" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by number, service or purpose…" aria-label="Search ports" />
        <Tabs size="sm" value={proto} onChange={setProto} options={[{ id: 'all', label: 'All' }, { id: 'TCP', label: 'TCP' }, { id: 'UDP', label: 'UDP' }]} />
        <span className="ml-auto text-xs text-slate-500">{list.length} of {PORTS.length} · well-known 0–1023, registered 1024–49151, dynamic 49152–65535</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500"><tr><th className="px-4 py-2">Port</th><th>Protocol</th><th>Service</th><th className="pr-4">Purpose</th></tr></thead>
          <tbody>{list.map((p) => <tr key={p.port + p.proto} className="border-t border-ink-800"><td className="px-4 py-2 font-mono text-cyan-200">{p.port}</td><td className="font-mono text-xs text-slate-400">{p.proto}</td><td className="font-medium text-slate-100">{p.service} {p.secure && <Lock className="inline h-3 w-3 text-emerald-400" aria-label="encrypted" />}</td><td className="py-2 pr-4 text-slate-400">{p.desc}</td></tr>)}</tbody>
        </table>
        {!list.length && <p className="p-4 text-sm text-slate-400">No ports match.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ DNS
function DnsTool() {
  const [name, setName] = useState('example.com');
  const [type, setType] = useState('A');
  const [ran, setRan] = useState<{ name: string; type: string } | null>({ name: 'example.com', type: 'A' });
  const result = useMemo(() => {
    if (!ran) return null;
    let n = ran.name.trim().toLowerCase().replace(/\.$/, '');
    if (ran.type === 'PTR' && /^\d+\.\d+\.\d+\.\d+$/.test(n)) n = n.split('.').reverse().join('.') + '.in-addr.arpa';
    const chain: string[] = [];
    const answers: { name: string; type: string; ttl: number; value: string; pref?: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const recs = DNS_ZONE[n];
      if (!recs) break;
      const direct = recs.filter((r) => r.type === ran.type);
      if (direct.length) { direct.forEach((r) => answers.push({ name: n, ...r })); break; }
      const cname = recs.find((r) => r.type === 'CNAME');
      if (cname && ran.type !== 'CNAME') { answers.push({ name: n, ...cname }); chain.push(`${n} → ${cname.value}`); n = cname.value; continue; }
      break;
    }
    const exists = !!DNS_ZONE[ran.name.trim().toLowerCase().replace(/\.$/, '')] || !!DNS_ZONE[n];
    return { qname: ran.name.trim(), answers, chain, rcode: answers.length ? 'NOERROR' : exists ? 'NOERROR (no data)' : 'NXDOMAIN' };
  }, [ran]);
  const firstA = result?.answers.find((a) => a.type === ran?.type);
  const pkt = useMemo(() => {
    if (!result || !ran) return null;
    try {
      return buildPacket({ ipv4: { src: '198.51.100.53', dst: '192.168.1.10' }, udp: { sport: 53, dport: 50123 }, app: { kind: 'dns', dns: { id: 0x4e21, response: true, ra: true, rcode: result.rcode === 'NXDOMAIN' ? 3 : 0, qname: ran.type === 'PTR' && /^\d+\.\d+\.\d+\.\d+$/.test(result.qname) ? result.qname.split('.').reverse().join('.') + '.in-addr.arpa' : result.qname, qtype: ran.type, answers: result.answers.map((a) => ({ name: a.name, type: a.type, ttl: a.ttl, data: a.value, pref: a.pref })) } } });
    } catch { return null; }
  }, [result, ran]);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <div className="panel p-5">
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setRan({ name, type }); }}>
            <input className="input flex-1 font-mono" value={name} onChange={(e) => setName(e.target.value)} aria-label="Domain name" placeholder="example.com or 203.0.113.80 for PTR" />
            <select className="input !w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Record type">{Object.keys(DNS_TYPES_INFO).map((t) => <option key={t}>{t}</option>)}</select>
            <button className="btn btn-primary" type="submit">Lookup</button>
          </form>
          <p className="mt-2 text-xs text-slate-500">{DNS_TYPES_INFO[type]} Try: {['example.com MX', 'www.example.com A', 'cdn.example.com AAAA', '_dmarc.example.com TXT', '203.0.113.80 PTR', 'example.com NS', 'nope.example.com A'].map((x) => <button key={x} className="mx-0.5 text-cyan-300 hover:underline" onClick={() => { const [n, t] = x.split(' '); setName(n); setType(t); setRan({ name: n, type: t }); }}>{x}</button>)}</p>
          <p className="mt-1 text-xs text-amber-300/80">Simulated: answers come from a built-in fictional zone, not the live DNS.</p>
        </div>
        {result && (
          <div className="panel p-5 font-mono text-xs">
            <div className="text-slate-500">;; QUESTION SECTION:</div><div className="text-slate-300">;{result.qname}.&nbsp;&nbsp;IN&nbsp;&nbsp;{ran!.type}</div>
            <div className="mt-2 text-slate-500">;; status: <span className={result.rcode === 'NXDOMAIN' ? 'text-rose-300' : 'text-emerald-300'}>{result.rcode}</span></div>
            {result.answers.length > 0 && <><div className="mt-2 text-slate-500">;; ANSWER SECTION:</div>
              {result.answers.map((a, i) => <div key={i} className="text-slate-100">{a.name}.&nbsp;&nbsp;{a.ttl}&nbsp;&nbsp;IN&nbsp;&nbsp;<span className="text-cyan-300">{a.type}</span>&nbsp;&nbsp;{a.pref !== undefined ? a.pref + ' ' : ''}{a.value}{a.type === 'CNAME' || a.type === 'MX' || a.type === 'NS' || a.type === 'PTR' ? '.' : ''}</div>)}</>}
            {result.chain.length > 0 && <div className="mt-2 font-sans text-slate-400">CNAME chain followed: {result.chain.join(', ')}.</div>}
            {firstA && ran!.type === 'MX' && <div className="mt-2 font-sans text-slate-400">Mail is delivered to the lowest preference first; the MX host must then be resolved with an A/AAAA query.</div>}
          </div>
        )}
      </div>
      {pkt && <div className="panel"><div className="panel-head">Resulting DNS response packet</div><div className="p-3"><PacketInspector packet={pkt} /></div></div>}
    </div>
  );
}

// ------------------------------------------------------------------ Routing
function Routing() {
  const [routes, setRoutes] = useState<RouteEntry[]>(SAMPLE_ROUTES);
  const [dest, setDest] = useState('10.1.5.20');
  const [add, setAdd] = useState({ prefix: '10.1.5.0/25', nextHop: '10.255.0.14', iface: 'G0/5', source: 'S' as RouteEntry['source'] });
  const [err, setErr] = useState('');
  const analysis = useMemo(() => {
    try {
      parseIPv4(dest);
      const m = routes.map((r, i) => ({ r, i, ok: matches(dest, r.prefix, r.cidr) }));
      const matching = m.filter((x) => x.ok);
      if (!matching.length) return { matching, best: null as null | number, why: 'No route matches and there is no default route — the packet is dropped and ICMP Destination Unreachable is returned.' };
      const maxLen = Math.max(...matching.map((x) => x.r.cidr));
      const longest = matching.filter((x) => x.r.cidr === maxLen);
      const minAd = Math.min(...longest.map((x) => x.r.ad));
      const byAd = longest.filter((x) => x.r.ad === minAd);
      const minMetric = Math.min(...byAd.map((x) => x.r.metric));
      const best = byAd.filter((x) => x.r.metric === minMetric);
      let why = `${matching.length} route(s) match. Longest prefix is /${maxLen}`;
      if (longest.length > 1) why += `; ${longest.length} routes share it, so the lowest administrative distance (${minAd}, ${ROUTE_SOURCES[byAd[0].r.source]}) wins`;
      if (byAd.length > 1) why += `; then lowest metric ${minMetric}`;
      if (best.length > 1) why += `; ${best.length} equal-cost paths → load-balanced (ECMP)`;
      return { matching, best: best[0].i, why: why + '.' };
    } catch (e) { return { matching: [], best: null, why: (e as Error).message, err: true }; }
  }, [dest, routes]);
  const addRoute = () => {
    try {
      const { ip, cidr } = parseCidrInput(add.prefix);
      const net = intToIPv4((ipv4ToInt(ip) & maskFromCidr(cidr)) >>> 0);
      const ad = { C: 0, L: 0, S: 1, B: 20, O: 110, R: 120 }[add.source];
      setRoutes([...routes, { prefix: net, cidr, nextHop: add.nextHop, iface: add.iface, source: add.source, ad, metric: add.source === 'O' ? 10 : add.source === 'R' ? 1 : 0 }]);
      setErr('');
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <label className="label" htmlFor="rd">Destination IP to look up</label>
        <div className="flex flex-wrap gap-2"><input id="rd" className="input !w-60 font-mono" value={dest} onChange={(e) => setDest(e.target.value)} />
          {['10.1.5.20', '10.1.5.200', '10.9.9.9', '172.20.1.1', '198.51.100.7', '8.8.8.8', '192.168.1.1'].map((d) => <button key={d} className="chip hover:border-cyan-500/50" onClick={() => setDest(d)}>{d}</button>)}</div>
        <p className={`mt-3 text-sm ${analysis.best !== null ? 'text-emerald-300' : 'text-amber-300'}`}>{analysis.best !== null && <CheckCircle2 className="mr-1 inline h-4 w-4" />}{analysis.why}{analysis.best !== null && ` Forward via ${routes[analysis.best].nextHop} out ${routes[analysis.best].iface}.`}</p>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full font-mono text-xs">
          <thead className="text-left text-slate-500"><tr><th className="px-4 py-2">Code</th><th>Prefix</th><th>[AD/Metric]</th><th>Next hop</th><th>Interface</th><th className="pr-4">Match?</th><th></th></tr></thead>
          <tbody>
            {routes.map((r, i) => {
              const m = analysis.matching.find((x) => x.i === i);
              return (
                <tr key={i} className={`border-t border-ink-800 ${analysis.best === i ? 'bg-emerald-500/10 text-emerald-200' : m ? 'text-slate-200' : 'text-slate-500'}`}>
                  <td className="px-4 py-1.5" title={ROUTE_SOURCES[r.source]}>{r.source}{r.cidr === 0 ? '*' : ''}</td><td>{r.prefix}/{r.cidr}</td><td>[{r.ad}/{r.metric}]</td><td>{r.nextHop}</td><td>{r.iface}</td>
                  <td className="pr-4">{analysis.best === i ? 'SELECTED' : m ? 'matches' : '—'}</td>
                  <td className="pr-3"><button className="text-slate-500 hover:text-rose-300" onClick={() => setRoutes(routes.filter((_, k) => k !== i))} aria-label="Remove route">×</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-ink-700 p-3 font-sans text-xs text-slate-500">Codes: C connected, L local, S static, O OSPF, B BGP, R RIP, * candidate default. Route selection: longest prefix → lowest AD → lowest metric.</div>
      </div>
      <div className="panel flex flex-wrap items-end gap-2 p-4">
        <div><label className="label">Prefix</label><input className="input !w-40 font-mono" value={add.prefix} onChange={(e) => setAdd({ ...add, prefix: e.target.value })} /></div>
        <div><label className="label">Next hop</label><input className="input !w-36 font-mono" value={add.nextHop} onChange={(e) => setAdd({ ...add, nextHop: e.target.value })} /></div>
        <div><label className="label">Interface</label><input className="input !w-24 font-mono" value={add.iface} onChange={(e) => setAdd({ ...add, iface: e.target.value })} /></div>
        <div><label className="label">Source</label><select className="input !w-auto" value={add.source} onChange={(e) => setAdd({ ...add, source: e.target.value as RouteEntry['source'] })}>{(['S', 'O', 'B', 'R'] as const).map((s) => <option key={s} value={s}>{ROUTE_SOURCES[s]}</option>)}</select></div>
        <button className="btn btn-primary" onClick={addRoute}>Add route</button>
        <button className="btn" onClick={() => setRoutes(SAMPLE_ROUTES)}>Reset table</button>
        {err && <div className="w-full"><Err msg={err} /></div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Builder
function Builder() {
  const [l4, setL4] = useState<'tcp' | 'udp' | 'icmp'>('tcp');
  const [f, setF] = useState({ smac: '3c:22:fb:1a:0e:51', dmac: '00:1d:aa:7c:30:01', src: '192.168.1.10', dst: '203.0.113.80', ttl: 64, dscp: 0, df: true, sport: 52344, dport: 443, seq: 1000, ack: 0, win: 64240, mss: 1460, flags: ['SYN'] as string[], itype: 8, icode: 0, payload: '' });
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });
  const built = useMemo(() => {
    try {
      const spec: PacketSpec = { eth: { src: f.smac, dst: f.dmac }, ipv4: { src: f.src, dst: f.dst, ttl: f.ttl, dscp: f.dscp, df: f.df } };
      for (const [k, v, max] of [['TTL', f.ttl, 255], ['DSCP', f.dscp, 63], ['Source port', f.sport, 65535], ['Destination port', f.dport, 65535], ['Window', f.win, 65535]] as const) if (!(v >= 0 && v <= max)) throw new Error(`${k} must be 0–${max}`);
      if (l4 === 'tcp') spec.tcp = { sport: f.sport, dport: f.dport, seq: f.seq, ack: f.ack, flags: f.flags.join(',') || 'none', win: f.win, mss: f.flags.includes('SYN') ? f.mss : undefined };
      if (l4 === 'udp') spec.udp = { sport: f.sport, dport: f.dport };
      if (l4 === 'icmp') spec.icmp = { type: f.itype, code: f.icode, id: 1, seq: 1, data: f.payload || undefined };
      if (f.payload && l4 !== 'icmp') spec.app = { kind: 'raw', text: f.payload };
      return { p: buildPacket(spec) };
    } catch (e) { return { err: (e as Error).message }; }
  }, [f, l4]);
  const num = (k: keyof typeof f, label: string) => <div><label className="label">{label}</label><input type="number" className="input font-mono" value={f[k] as number} onChange={(e) => set(k, Number(e.target.value))} /></div>;
  const txt = (k: keyof typeof f, label: string) => <div><label className="label">{label}</label><input className="input font-mono" value={f[k] as string} onChange={(e) => set(k, e.target.value)} /></div>;
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <div className="panel space-y-4 p-5">
        <fieldset><legend className="mb-2 text-sm font-semibold text-amber-300">Ethernet</legend><div className="grid grid-cols-2 gap-2">{txt('smac', 'Source MAC')}{txt('dmac', 'Destination MAC')}</div></fieldset>
        <fieldset><legend className="mb-2 text-sm font-semibold text-sky-300">IPv4</legend><div className="grid grid-cols-2 gap-2">{txt('src', 'Source IP')}{txt('dst', 'Destination IP')}{num('ttl', 'TTL')}{num('dscp', 'DSCP')}</div>
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={f.df} onChange={(e) => set('df', e.target.checked)} className="accent-cyan-400" />Don't Fragment</label></fieldset>
        <fieldset><legend className="mb-2 flex items-center justify-between text-sm font-semibold text-violet-300">Layer 4 <Tabs size="sm" value={l4} onChange={setL4} options={[{ id: 'tcp', label: 'TCP' }, { id: 'udp', label: 'UDP' }, { id: 'icmp', label: 'ICMP' }]} /></legend>
          {l4 !== 'icmp' && <div className="grid grid-cols-2 gap-2">{num('sport', 'Source port')}{num('dport', 'Destination port')}</div>}
          {l4 === 'tcp' && <>
            <div className="mt-2 grid grid-cols-3 gap-2">{num('seq', 'Sequence')}{num('ack', 'Ack')}{num('win', 'Window')}</div>
            <div className="mt-2 flex flex-wrap gap-1">{['SYN', 'ACK', 'FIN', 'RST', 'PSH', 'URG'].map((fl) => <label key={fl} className={`chip cursor-pointer ${f.flags.includes(fl) ? 'border-violet-400 text-violet-200' : ''}`}><input type="checkbox" className="sr-only" checked={f.flags.includes(fl)} onChange={() => set('flags', f.flags.includes(fl) ? f.flags.filter((x) => x !== fl) : [...f.flags, fl])} />{fl}</label>)}</div>
            {f.flags.includes('SYN') && <div className="mt-2 w-1/2">{num('mss', 'MSS option')}</div>}
          </>}
          {l4 === 'icmp' && <div className="grid grid-cols-2 gap-2">{num('itype', 'Type (8 = echo req)')}{num('icode', 'Code')}</div>}
        </fieldset>
        <div><label className="label">Payload (text)</label><input className="input font-mono" value={f.payload} onChange={(e) => set('payload', e.target.value)} placeholder="optional" /></div>
      </div>
      <div className="panel"><div className="panel-head">Resulting packet</div><div className="p-3">{built.err ? <Err msg={built.err} /> : <PacketInspector packet={built.p!} />}</div></div>
    </div>
  );
}
