import type { PacketSpec } from './packet';

export type DeviceType =
  | 'pc' | 'laptop' | 'server' | 'web' | 'router' | 'switch' | 'firewall' | 'dns' | 'dhcp' | 'ap' | 'cloud' | 'attacker' | 'phone';

export interface Device {
  id: string;
  type: DeviceType;
  label: string;
  x: number; // 0–100
  y: number; // 0–100
  ip?: string;
  mac?: string;
  info?: string;
  zone?: string;
}
export interface Link { a: string; b: string; label?: string; wireless?: boolean }

export interface Table { title: string; device?: string; cols: string[]; rows: (string | number)[][]; highlight?: number }

export interface Step {
  from: string;
  to: string | string[];
  title: string;
  text: string;
  label?: string;
  packet?: PacketSpec;
  hops?: Record<string, string>;
  tables?: Table[];
  dropAt?: string; // packet is dropped when it reaches this device
  local?: boolean; // processing inside one device, no travel
  danger?: boolean;
  ok?: boolean; // highlight as success (e.g. mitigation worked)
  rtt?: number;
}

export interface Param { id: string; label: string; min: number; max: number; step: number; default: number; unit?: string }

export interface AttackInfo {
  explain: string;
  vulnerabilities: string[];
  detection: string[];
  mitigation: string[];
}

export interface Scenario {
  id: string;
  title: string;
  kind: 'guided' | 'attack';
  short: string;
  summary: string;
  protocols: string[];
  devices: Device[];
  links: Link[];
  steps: Step[] | ((p: Record<string, number>) => Step[]);
  params?: Param[];
  attack?: AttackInfo;
  mitigatedSteps?: Step[];
  mitigationLabel?: string;
  takeaways?: string[];
}

export function resolveSteps(s: Scenario, params: Record<string, number>, mitigated: boolean): Step[] {
  if (mitigated && s.mitigatedSteps) return s.mitigatedSteps;
  return typeof s.steps === 'function' ? s.steps(params) : s.steps;
}

export function defaultParams(s: Scenario) {
  return Object.fromEntries((s.params ?? []).map((p) => [p.id, p.default]));
}

/** Shortest path through the topology (BFS). */
export function findPath(links: Link[], from: string, to: string): string[] {
  if (from === to) return [from];
  const adj = new Map<string, string[]>();
  for (const l of links) {
    adj.set(l.a, [...(adj.get(l.a) ?? []), l.b]);
    adj.set(l.b, [...(adj.get(l.b) ?? []), l.a]);
  }
  const prev = new Map<string, string>();
  const q = [from];
  const seen = new Set([from]);
  while (q.length) {
    const n = q.shift()!;
    if (n === to) break;
    for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.add(m); prev.set(m, n); q.push(m); }
  }
  if (!seen.has(to)) return [from, to];
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return path;
}

export interface Route { target: string; points: { id: string; x: number; y: number }[]; lengths: number[]; total: number }

export function buildRoutes(sc: Scenario, step: Step): Route[] {
  const byId = new Map(sc.devices.map((d) => [d.id, d]));
  const targets = Array.isArray(step.to) ? step.to : [step.to];
  return targets.map((t) => {
    let ids = findPath(sc.links, step.from, t);
    if (step.dropAt) {
      const i = ids.indexOf(step.dropAt);
      if (i >= 0) ids = ids.slice(0, i + 1);
    }
    const points = ids.map((id) => { const d = byId.get(id)!; return { id, x: d.x, y: d.y }; });
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, (p.y - points[i].y) * 0.6));
    return { target: t, points, lengths, total: lengths.reduce((a, b) => a + b, 0) };
  });
}

export function pointAt(r: Route, t: number): { x: number; y: number; at: string | null } {
  if (r.points.length < 2 || r.total === 0) return { ...r.points[0], at: r.points[0].id };
  let d = Math.min(Math.max(t, 0), 1) * r.total;
  for (let i = 0; i < r.lengths.length; i++) {
    if (d <= r.lengths[i] || i === r.lengths.length - 1) {
      const f = r.lengths[i] === 0 ? 1 : Math.min(d / r.lengths[i], 1);
      const a = r.points[i], b = r.points[i + 1];
      const near = f < 0.12 ? a.id : f > 0.88 ? b.id : null;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, at: near };
    }
    d -= r.lengths[i];
  }
  const last = r.points[r.points.length - 1];
  return { ...last, at: last.id };
}
