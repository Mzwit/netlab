// Low-level helpers for building and formatting packet bytes.

export const u16 = (n: number) => [(n >>> 8) & 0xff, n & 0xff];
export const u24 = (n: number) => [(n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
export const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
export const ascii = (s: string) => Array.from(new TextEncoder().encode(s));

export function parseMac(mac: string): number[] {
  const parts = mac.split(/[:-]/).map((h) => parseInt(h, 16));
  if (parts.length !== 6 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) throw new Error(`Invalid MAC address: ${mac}`);
  return parts;
}
export const fmtMac = (b: number[]) => b.map((x) => x.toString(16).padStart(2, '0')).join(':');

export function parseIPv4(ip: string): number[] {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) throw new Error(`Invalid IPv4 address: ${ip}`);
  const n = parts.map((p) => {
    if (!/^\d{1,3}$/.test(p)) throw new Error(`Invalid IPv4 address: ${ip}`);
    const v = Number(p);
    if (v > 255) throw new Error(`Invalid IPv4 octet ${v} in ${ip}`);
    return v;
  });
  return n;
}
export const fmtIPv4 = (b: number[]) => b.join('.');
export const ipv4ToInt = (ip: string) => parseIPv4(ip).reduce((a, o) => ((a << 8) | o) >>> 0, 0);
export const intToIPv4 = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

export function parseIPv6(ip: string): number[] {
  let s = ip.trim().toLowerCase();
  let tail: number[] = [];
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    tail = parseIPv4(v4[1]);
    s = s.slice(0, -v4[1].length) + '0:0';
  }
  const halves = s.split('::');
  if (halves.length > 2) throw new Error(`Invalid IPv6 address: ${ip}`);
  const toGroups = (h: string) => (h ? h.split(':') : []);
  const head = toGroups(halves[0]);
  const back = halves.length === 2 ? toGroups(halves[1]) : [];
  const fill = 8 - head.length - back.length;
  if ((halves.length === 1 && head.length !== 8) || fill < 0) throw new Error(`Invalid IPv6 address: ${ip}`);
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...back];
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) throw new Error(`Invalid IPv6 address: ${ip}`);
    out.push(...u16(parseInt(g, 16)));
  }
  if (tail.length) out.splice(12, 4, ...tail);
  return out;
}
export function fmtIPv6(b: number[]): string {
  const g: number[] = [];
  for (let i = 0; i < 16; i += 2) g.push((b[i] << 8) | b[i + 1]);
  // RFC 5952: compress the longest run of 2+ zero groups
  let bestStart = -1, bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (g[i] !== 0) { i++; continue; }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > bestLen && j - i >= 2) { bestStart = i; bestLen = j - i; }
    i = j;
  }
  const hex = g.map((x) => x.toString(16));
  if (bestStart < 0) return hex.join(':');
  return hex.slice(0, bestStart).join(':') + '::' + hex.slice(bestStart + bestLen).join(':');
}

/** RFC 1071 Internet checksum. */
export function inetChecksum(bytes: number[]): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    sum += (bytes[i] << 8) + (i + 1 < bytes.length ? bytes[i + 1] : 0);
  }
  while (sum >> 16) sum = (sum & 0xffff) + (sum >> 16);
  return ~sum & 0xffff;
}

export const hex2 = (n: number) => n.toString(16).padStart(2, '0');
export const hex4 = (n: number) => '0x' + n.toString(16).padStart(4, '0');
export const bin8 = (n: number) => n.toString(2).padStart(8, '0');
export const bytesToHex = (b: number[], sep = ' ') => b.map(hex2).join(sep);

/** Deterministic pseudo-random bytes so simulated keys/ciphertext stay stable between renders. */
export function prngBytes(seed: number, n: number): number[] {
  let x = seed >>> 0 || 1;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    out.push(x & 0xff);
  }
  return out;
}
