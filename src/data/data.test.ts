import { describe, it, expect } from 'vitest';
import { guided } from './guided';
import { attacks } from './attacks';
import { protocols } from './protocols';
import { BANK, subnetQuestion, subnetAnswer } from './questions';
import { COURSES } from './lessons';
import { buildPacket } from '../engine/packet';
import { inetChecksum } from '../engine/bytes';
import { resolveSteps, defaultParams, findPath } from '../engine/sim';
import { search } from '../lib/catalog';

describe('scenario integrity', () => {
  for (const s of [...guided, ...attacks]) {
    it(`${s.id}: all steps reference devices, have paths, and packets build`, () => {
      const ids = new Set(s.devices.map((d) => d.id));
      s.links.forEach((l) => { expect(ids.has(l.a)).toBe(true); expect(ids.has(l.b)).toBe(true); });
      const variants = [resolveSteps(s, defaultParams(s), false)];
      if (s.mitigatedSteps) variants.push(resolveSteps(s, defaultParams(s), true));
      for (const steps of variants) {
        expect(steps.length).toBeGreaterThan(0);
        for (const st of steps) {
          expect(ids.has(st.from), `${s.id}: from ${st.from}`).toBe(true);
          for (const t of Array.isArray(st.to) ? st.to : [st.to]) {
            expect(ids.has(t), `${s.id}: to ${t}`).toBe(true);
            if (!st.local) { const p = findPath(s.links, st.from, t); expect(p[0]).toBe(st.from); expect(p.length).toBeGreaterThan(1); }
          }
          if (st.dropAt) expect(ids.has(st.dropAt)).toBe(true);
          if (st.packet) {
            const p = buildPacket(st.packet);
            const ip = p.layers.find((l) => l.id === 'ipv4');
            if (ip) expect(inetChecksum(p.bytes.slice(ip.start, ip.start + 20))).toBe(0);
          }
        }
      }
    });
  }
  it('ping scenario varies with params', () => {
    const ping = guided.find((g) => g.id === 'ping')!;
    const a = resolveSteps(ping, { count: 6, loss: 50, latency: 20 }, false);
    expect(a.some((s) => s.dropAt)).toBe(true);
    const b = resolveSteps(ping, { count: 3, loss: 0, latency: 20 }, false);
    expect(b.length).toBe(7);
  });
});

describe('content integrity', () => {
  it('protocol samples build', () => { protocols.forEach((p) => p.sample && buildPacket(p.sample)); expect(protocols.length).toBe(32); });
  it('every protocol has all 10 sections', () => protocols.forEach((p) => {
    expect(p.what && p.why && p.problem && p.osiNote && p.flow.length && p.fields.length && p.uses.length && p.security.length && p.troubleshooting.length).toBeTruthy();
  }));
  it('lesson checks reference existing questions', () => COURSES.forEach((c) => c.lessons.forEach((l) => l.check.forEach((id) => expect(BANK.find((q) => q.id === id), id).toBeTruthy()))));
  it('mcq answers in range', () => BANK.forEach((q) => { if ('options' in q) expect(q.answer).toBeLessThan(q.options.length); if (q.type === 'packet') buildPacket(q.packet); }));
  it('subnet generator yields consistent answers', () => { for (let i = 0; i < 200; i++) { const q = subnetQuestion(i); if (q.type === 'subnet') expect(subnetAnswer(q).value).toBeTruthy(); } });
  it('search finds things', () => {
    expect(search('tcp')[0].title).toMatch(/TCP/);
    expect(search('443').some((r) => r.kind === 'Port')).toBe(true);
    expect(search('ttl').length).toBeGreaterThan(0);
    expect(search('switch').length).toBeGreaterThan(0);
  });
});
