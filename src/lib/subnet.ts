import { ipv4ToInt, intToIPv4, parseIPv4 } from '../engine/bytes';

export interface SubnetResult {
  ip: string; cidr: number; mask: string; wildcard: string; network: string; broadcast: string;
  first: string; last: string; usable: number; total: number; ipClass: string; type: string;
  binary: { ip: string; mask: string; network: string; broadcast: string };
}

export const maskFromCidr = (c: number) => (c === 0 ? 0 : (0xffffffff << (32 - c)) >>> 0);
export const toBinaryDotted = (n: number) => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, '0')).join('.');

export function cidrFromMask(mask: string): number {
  const m = ipv4ToInt(mask);
  const inv = ~m >>> 0;
  if ((inv & (inv + 1)) !== 0) throw new Error(`${mask} is not a valid (contiguous) subnet mask`);
  let c = 0;
  for (let i = 31; i >= 0; i--) if ((m >>> i) & 1) c++;
  return c;
}

export function parseCidrInput(input: string): { ip: string; cidr: number } {
  const s = input.trim();
  const m = s.match(/^(\d+\.\d+\.\d+\.\d+)\s*(?:\/\s*(\d+(?:\.\d+\.\d+\.\d+)?))?$/);
  if (!m) throw new Error('Enter an address like 192.168.10.37/26 or 10.0.0.5/255.255.255.0');
  parseIPv4(m[1]);
  if (!m[2]) return { ip: m[1], cidr: 24 };
  const cidr = m[2].includes('.') ? cidrFromMask(m[2]) : Number(m[2]);
  if (cidr < 0 || cidr > 32) throw new Error('Prefix length must be between 0 and 32');
  return { ip: m[1], cidr };
}

export function calcSubnet(ip: string, cidr: number): SubnetResult {
  const a = ipv4ToInt(ip);
  const mask = maskFromCidr(cidr);
  const net = (a & mask) >>> 0;
  const bc = (net | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - cidr);
  let first = net + 1, last = bc - 1, usable = Math.max(total - 2, 0);
  if (cidr === 32) { first = net; last = net; usable = 1; }
  if (cidr === 31) { first = net; last = bc; usable = 2; } // RFC 3021 point-to-point
  const o1 = a >>> 24;
  const ipClass = o1 < 128 ? 'A' : o1 < 192 ? 'B' : o1 < 224 ? 'C' : o1 < 240 ? 'D (multicast)' : 'E (reserved)';
  const type = isPrivate(a) ? 'Private (RFC 1918)' : o1 === 127 ? 'Loopback' : (a >>> 16) === 0xa9fe ? 'Link-local (APIPA)' : (a >>> 22) === (0x64400000 >>> 22) ? 'Shared / CGNAT (RFC 6598)' : o1 >= 224 ? 'Multicast/Reserved' : 'Public';
  return {
    ip, cidr, mask: intToIPv4(mask), wildcard: intToIPv4(~mask >>> 0), network: intToIPv4(net), broadcast: intToIPv4(bc),
    first: intToIPv4(first >>> 0), last: intToIPv4(last >>> 0), usable, total, ipClass, type,
    binary: { ip: toBinaryDotted(a), mask: toBinaryDotted(mask), network: toBinaryDotted(net), broadcast: toBinaryDotted(bc) },
  };
}

export function isPrivate(a: number) {
  return (a >>> 24) === 10 || (a >>> 20) === (0xac100000 >>> 20) || (a >>> 16) === 0xc0a8;
}

/** Split a network into 2^n equal subnets. */
export function splitSubnets(ip: string, cidr: number, newCidr: number, limit = 64) {
  if (newCidr < cidr || newCidr > 32) return [];
  const base = ipv4ToInt(calcSubnet(ip, cidr).network);
  const size = 2 ** (32 - newCidr);
  const count = 2 ** (newCidr - cidr);
  return Array.from({ length: Math.min(count, limit) }, (_, i) => calcSubnet(intToIPv4((base + i * size) >>> 0), newCidr));
}

/** Longest-prefix match helper for the routing table explorer. */
export function matches(dest: string, network: string, cidr: number) {
  const m = maskFromCidr(cidr);
  return ((ipv4ToInt(dest) & m) >>> 0) === ((ipv4ToInt(network) & m) >>> 0);
}
