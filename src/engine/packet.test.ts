import { describe, it, expect } from 'vitest';
import { buildPacket } from './packet';
import { parseIPv6, fmtIPv6, inetChecksum } from './bytes';
import { calcSubnet, cidrFromMask, parseCidrInput, matches } from '../lib/subnet';

describe('checksums', () => {
  it('reproduces the textbook IPv4 header checksum 0xb861', () => {
    // 4500 0073 0000 4000 4011 b861 c0a8 0001 c0a8 00c7 (total length 115)
    const p = buildPacket({
      ipv4: { src: '192.168.0.1', dst: '192.168.0.199', ttl: 64, id: 0 },
      udp: { sport: 1000, dport: 2000 },
      app: { kind: 'raw', text: 'x'.repeat(115 - 20 - 8) },
    });
    expect(p.bytes.slice(0, 20).map((b) => b.toString(16).padStart(2, '0')).join('')).toBe('4500007300004000401' + '1b861c0a80001c0a800c7');
  });
  it('produces IP/TCP/UDP/ICMP checksums that verify to zero', () => {
    const tcp = buildPacket({ eth: { src: '00:11:22:33:44:55', dst: '66:77:88:99:aa:bb' }, ipv4: { src: '10.0.0.2', dst: '93.184.215.14' }, tcp: { sport: 51514, dport: 443, seq: 2837461, flags: 'SYN', mss: 1460 } });
    const ip = tcp.bytes.slice(14, 34);
    expect(inetChecksum(ip)).toBe(0);
    const seg = tcp.bytes.slice(34);
    const pseudo = [10, 0, 0, 2, 93, 184, 215, 14, 0, 6, 0, seg.length];
    expect(inetChecksum([...pseudo, ...seg])).toBe(0);
    const icmp = buildPacket({ ipv4: { src: '10.0.0.2', dst: '8.8.8.8' }, icmp: { type: 8, code: 0, id: 1, seq: 1 } });
    expect(inetChecksum(icmp.bytes.slice(20))).toBe(0);
  });
  it('builds a 342-byte DHCP Discover frame layout', () => {
    const p = buildPacket({ eth: { src: '00:1a:2b:3c:4d:5e', dst: 'ff:ff:ff:ff:ff:ff' }, ipv4: { src: '0.0.0.0', dst: '255.255.255.255', ttl: 64 }, udp: { sport: 68, dport: 67 }, app: { kind: 'dhcp', dhcp: { op: 1, msg: 'DISCOVER', xid: 0x3903f326, chaddr: '00:1a:2b:3c:4d:5e', broadcast: true } } });
    // magic cookie at 14+20+8+236
    expect(p.bytes.slice(278, 282)).toEqual([0x63, 0x82, 0x53, 0x63]);
  });
  it('builds ARP as 42-byte frame', () => {
    const p = buildPacket({ eth: { src: '00:00:00:00:00:01', dst: 'ff:ff:ff:ff:ff:ff' }, arp: { op: 1, sha: '00:00:00:00:00:01', spa: '192.168.1.10', tha: '00:00:00:00:00:00', tpa: '192.168.1.1' } });
    expect(p.bytes.length).toBe(42);
    expect(p.bytes.slice(12, 14)).toEqual([0x08, 0x06]);
  });
  it('field ranges tile the whole packet', () => {
    const p = buildPacket({ eth: { src: '00:11:22:33:44:55', dst: '66:77:88:99:aa:bb' }, ipv4: { src: '10.0.0.2', dst: '10.0.0.53' }, udp: { sport: 53000, dport: 53 }, app: { kind: 'dns', dns: { id: 0xabcd, response: true, ra: true, qname: 'www.example.com', qtype: 'A', answers: [{ name: 'www.example.com', type: 'A', ttl: 300, data: '93.184.215.14' }] } } });
    const covered = new Array(p.bytes.length).fill(0);
    p.layers.forEach((l) => l.fields.forEach((f) => { for (let i = f.start; i < f.start + f.len; i++) covered[i]++; }));
    expect(covered.every((c) => c === 1)).toBe(true);
  });
});

describe('ipv6', () => {
  it('round-trips with RFC 5952 compression', () => {
    expect(fmtIPv6(parseIPv6('2001:0db8:0000:0000:0000:ff00:0042:8329'))).toBe('2001:db8::ff00:42:8329');
    expect(fmtIPv6(parseIPv6('fe80::1'))).toBe('fe80::1');
    expect(fmtIPv6(parseIPv6('::'))).toBe('::');
  });
});

describe('subnetting', () => {
  it('calculates /26', () => {
    const r = calcSubnet('192.168.10.77', 26);
    expect(r.network).toBe('192.168.10.64');
    expect(r.broadcast).toBe('192.168.10.127');
    expect(r.first).toBe('192.168.10.65');
    expect(r.last).toBe('192.168.10.126');
    expect(r.usable).toBe(62);
    expect(r.wildcard).toBe('0.0.0.63');
  });
  it('handles edge prefixes', () => {
    expect(calcSubnet('10.1.2.3', 32).usable).toBe(1);
    expect(calcSubnet('10.1.2.3', 31).usable).toBe(2);
    expect(calcSubnet('10.1.2.3', 0).mask).toBe('0.0.0.0');
    expect(calcSubnet('172.16.5.4', 12).broadcast).toBe('172.31.255.255');
  });
  it('parses masks and rejects invalid ones', () => {
    expect(cidrFromMask('255.255.255.240')).toBe(28);
    expect(() => cidrFromMask('255.0.255.0')).toThrow();
    expect(parseCidrInput('10.0.0.1/255.255.0.0').cidr).toBe(16);
    expect(matches('10.1.2.3', '10.0.0.0', 8)).toBe(true);
  });
});
