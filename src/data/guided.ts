import type { Scenario, Step, Device, Link } from '../engine/sim';
import { buildPacket, type AppSpec, type TlsRecord } from '../engine/packet';
import { prngBytes } from '../engine/bytes';

// All addresses use private (RFC 1918) or documentation (RFC 5737: 192.0.2.0/24, 198.51.100.0/24,
// 203.0.113.0/24) ranges, so nothing here points at a real host.
export const M = {
  pc: '3c:22:fb:1a:0e:51', pc2: '3c:22:fb:7d:42:10', pc3: 'a4:83:e7:2c:91:5b', phone: 'f0:99:b6:0a:13:c4',
  gw: '00:1d:aa:7c:30:01', gwWan: '00:1d:aa:7c:30:02', r1b: '00:1d:aa:11:00:02', r2a: '00:1e:bd:22:00:01', r2b: '00:1e:bd:22:00:02',
  dhcp: '52:54:00:8e:21:05', srv: '52:54:00:4a:b0:14', atk: 'de:ad:be:ef:66:66', bc: 'ff:ff:ff:ff:ff:ff', zero: '00:00:00:00:00:00',
};
const appLen = (app: AppSpec) => buildPacket({ app }).bytes.length;

// ------------------------------------------------------------ A: opening a website
const webDevices: Device[] = [
  { id: 'pc', type: 'pc', label: 'Browser PC', x: 8, y: 55, ip: '192.168.1.10', mac: M.pc, info: 'A laptop running a web browser. Configured by DHCP with gateway 192.168.1.1 and DNS resolver 198.51.100.53.' },
  { id: 'sw', type: 'switch', label: 'Switch', x: 24, y: 55, info: 'Layer 2 switch: forwards frames by destination MAC using its MAC address table. It never looks at IP addresses.' },
  { id: 'fw', type: 'firewall', label: 'Router + Firewall', x: 42, y: 55, ip: '192.168.1.1 / 203.0.113.5', mac: M.gw, info: 'Home/office edge router. Routes between the LAN and the ISP, performs NAT (private → public address) and runs a stateful firewall that only allows replies to connections started from inside.' },
  { id: 'net', type: 'cloud', label: 'Internet', x: 62, y: 55, info: 'Many ISP and backbone routers. Each one decrements TTL and forwards by longest-prefix match.' },
  { id: 'dns', type: 'dns', label: 'DNS resolver', x: 80, y: 20, ip: '198.51.100.53', info: 'Recursive resolver run by the ISP. If the answer is not cached it queries root → .com TLD → example.com authoritative servers on the client\'s behalf.' },
  { id: 'web', type: 'web', label: 'www.example.com', x: 88, y: 72, ip: '203.0.113.80', mac: M.srv, info: 'Web server listening on TCP 443 (HTTPS). Holds a certificate for www.example.com signed by a trusted CA.' },
];
const webLinks: Link[] = [{ a: 'pc', b: 'sw' }, { a: 'sw', b: 'fw' }, { a: 'fw', b: 'net' }, { a: 'net', b: 'dns' }, { a: 'net', b: 'web' }];
const wHops = {
  sw: 'Looks up the destination MAC in its MAC table and forwards out one port.',
  fw: 'Routes the packet, rewrites source 192.168.1.10 → 203.0.113.5 (NAT) and records the flow in its state table.',
  net: 'Each ISP/backbone router decrements TTL and forwards toward the destination network.',
};
const wHopsBack = { net: 'Routed back across the Internet toward 203.0.113.5.', fw: 'Matches the NAT/firewall state entry, rewrites destination back to 192.168.1.10 and allows it in.', sw: 'Forwards the frame to the PC\'s port.' };

const CL = { src: '192.168.1.10', dst: '203.0.113.80' };
const SV = { src: '203.0.113.80', dst: '192.168.1.10' };
const ethOut = { src: M.pc, dst: M.gw };
const ethIn = { src: M.gw, dst: M.pc };
const ISN_C = 1922418304, ISN_S = 3150923471;
const tlsCH: AppSpec = { kind: 'tls', records: [{ kind: 'ClientHello', sni: 'www.example.com' }] };
const shRecords: TlsRecord[] = [
  { kind: 'ServerHello' }, { kind: 'ChangeCipherSpec' },
  { kind: 'Encrypted', len: 64, seed: 201, note: 'EncryptedExtensions' },
  { kind: 'Encrypted', len: 410, seed: 202, note: 'Certificate chain' },
  { kind: 'Encrypted', len: 96, seed: 203, note: 'CertificateVerify' },
  { kind: 'Encrypted', len: 53, seed: 204, note: 'server Finished' },
];
const tlsSH: AppSpec = { kind: 'tls', records: shRecords };
const tlsCF: AppSpec = { kind: 'tls', records: [{ kind: 'ChangeCipherSpec' }, { kind: 'Encrypted', len: 53, seed: 301, note: 'client Finished' }] };
const tlsReq: AppSpec = { kind: 'tls', records: [{ kind: 'Encrypted', len: 120, seed: 401, note: 'HTTP GET / (encrypted)' }] };
const tlsResp: AppSpec = { kind: 'tls', records: [{ kind: 'Encrypted', len: 320, seed: 402, note: 'HTTP/1.1 200 OK + HTML (encrypted)' }] };
const c1 = ISN_C + 1, s1 = ISN_S + 1;
const c2 = c1 + appLen(tlsCH), s2 = s1 + appLen(tlsSH), c3 = c2 + appLen(tlsCF), c4 = c3 + appLen(tlsReq), s3 = s2 + appLen(tlsResp);

export const HTTP_GET = 'GET / HTTP/1.1\nHost: www.example.com\nUser-Agent: Mozilla/5.0 (NETLAB)\nAccept: text/html\nAccept-Encoding: gzip, br\nConnection: keep-alive\n';
export const HTTP_200 = 'HTTP/1.1 200 OK\nContent-Type: text/html; charset=UTF-8\nContent-Length: 69\nCache-Control: max-age=3600\nServer: nginx\n\n<!doctype html><html><head><title>Example</title></head><body></body></html>';

const websiteSteps: Step[] = [
  { from: 'pc', to: 'pc', local: true, label: 'parse URL', title: 'Browser parses the URL', text: 'The user types https://www.example.com. The browser extracts the scheme (https → port 443, TLS required), the host name (www.example.com) and the path (/). It checks its own DNS cache and the OS resolver cache — nothing is cached, so a DNS lookup is needed before any connection can be made.' },
  {
    from: 'pc', to: 'dns', label: 'DNS Query', title: 'DNS query: what is the IP of www.example.com?', hops: wHops,
    text: 'The OS stub resolver sends a UDP datagram from a random ephemeral port to port 53 on the configured resolver. The 16-bit transaction ID (0x6a1f) and random source port make the answer hard to forge. Shown as captured on the PC\'s network interface.',
    packet: { eth: ethOut, ipv4: { src: '192.168.1.10', dst: '198.51.100.53', ttl: 64, id: 0x5d21, df: false }, udp: { sport: 51734, dport: 53 }, app: { kind: 'dns', dns: { id: 0x6a1f, response: false, qname: 'www.example.com', qtype: 'A' } } },
  },
  {
    from: 'dns', to: 'pc', label: 'DNS Response', title: 'DNS response: 203.0.113.80', hops: wHopsBack,
    text: 'The resolver (after walking root → .com → example.com authoritative servers, or answering from cache) returns an A record. Same transaction ID, QR bit set, TTL 3600 means the answer may be cached for an hour. The firewall lets it in because it matches the outgoing query\'s state entry.',
    packet: { eth: ethIn, ipv4: { src: '198.51.100.53', dst: '192.168.1.10', ttl: 57, id: 0x0000 }, udp: { sport: 53, dport: 51734 }, app: { kind: 'dns', dns: { id: 0x6a1f, response: true, ra: true, qname: 'www.example.com', qtype: 'A', answers: [{ name: 'www.example.com', type: 'A', ttl: 3600, data: '203.0.113.80' }] } } },
    tables: [{ title: 'Browser DNS cache', device: 'pc', cols: ['Name', 'Type', 'Value', 'TTL'], rows: [['www.example.com', 'A', '203.0.113.80', '3600 s']], highlight: 0 }],
  },
  {
    from: 'pc', to: 'web', label: 'SYN', title: 'TCP handshake 1/3: SYN', hops: wHops,
    text: `The browser opens a TCP connection to 203.0.113.80:443. The SYN carries a random Initial Sequence Number (${ISN_C}) and options such as MSS 1460. No data yet.`,
    packet: { eth: ethOut, ipv4: { ...CL, ttl: 64, id: 0x7c01 }, tcp: { sport: 52344, dport: 443, seq: ISN_C, flags: 'SYN', win: 64240, mss: 1460 } },
  },
  {
    from: 'web', to: 'pc', label: 'SYN-ACK', title: 'TCP handshake 2/3: SYN-ACK', hops: wHopsBack,
    text: `The server accepts: it picks its own ISN (${ISN_S}) and acknowledges the client's SYN with Ack = ${ISN_C} + 1.`,
    packet: { eth: ethIn, ipv4: { ...SV, ttl: 53, id: 0 }, tcp: { sport: 443, dport: 52344, seq: ISN_S, ack: c1, flags: 'SYN,ACK', win: 65160, mss: 1460 } },
  },
  {
    from: 'pc', to: 'web', label: 'ACK', title: 'TCP handshake 3/3: ACK', hops: wHops,
    text: `The client acknowledges the server's ISN (Ack = ${s1}). Both sides are now ESTABLISHED and know each other's starting sequence numbers.`,
    packet: { eth: ethOut, ipv4: { ...CL, ttl: 64, id: 0x7c02 }, tcp: { sport: 52344, dport: 443, seq: c1, ack: s1, flags: 'ACK', win: 64240 } },
    tables: [{ title: 'TCP connection state', cols: ['Side', 'State', 'Next seq', 'Expecting'], rows: [['Client', 'ESTABLISHED', c1, s1], ['Server', 'ESTABLISHED', s1, c1]] }],
  },
  {
    from: 'pc', to: 'web', label: 'ClientHello', title: 'TLS ClientHello', hops: wHops,
    text: 'TLS 1.3 begins. The ClientHello lists supported versions and cipher suites, includes the Server Name Indication (www.example.com — visible to observers) and an ephemeral X25519 public key (key_share), so keys can be agreed in a single round trip.',
    packet: { eth: ethOut, ipv4: { ...CL, ttl: 64, id: 0x7c03 }, tcp: { sport: 52344, dport: 443, seq: c1, ack: s1, flags: 'PSH,ACK', win: 64240 }, app: tlsCH },
  },
  {
    from: 'web', to: 'pc', label: 'ServerHello…', title: 'TLS ServerHello + encrypted handshake', hops: wHopsBack,
    text: 'The server picks TLS_AES_128_GCM_SHA256, sends its own key share, and both sides compute the shared secret with ECDHE. Everything after ServerHello is already encrypted: EncryptedExtensions, the Certificate chain, CertificateVerify (a signature proving the server owns the certificate\'s private key) and Finished.',
    packet: { eth: ethIn, ipv4: { ...SV, ttl: 53, id: 0 }, tcp: { sport: 443, dport: 52344, seq: s1, ack: c2, flags: 'PSH,ACK', win: 65160 }, app: tlsSH },
  },
  {
    from: 'pc', to: 'pc', local: true, label: 'verify cert', title: 'Certificate validation', text: 'The browser decrypts the handshake and validates the certificate: (1) the chain leads to a root CA in its trust store, (2) every signature in the chain is valid, (3) the name www.example.com matches the certificate\'s Subject Alternative Name, (4) the current date is within the validity period, (5) the certificate is not revoked, and (6) CertificateVerify proves the server holds the private key. Any failure → a full-page warning and the connection is aborted.',
    tables: [{ title: 'Certificate checks', device: 'pc', cols: ['Check', 'Result'], rows: [['Chain to trusted root', '✓ Example Root CA → Example TLS CA → leaf'], ['Signatures', '✓ valid'], ['Hostname (SAN)', '✓ www.example.com'], ['Validity period', '✓ within dates'], ['Revocation', '✓ not revoked'], ['CertificateVerify', '✓ server holds private key']] }],
  },
  {
    from: 'pc', to: 'web', label: 'Finished', title: 'Client Finished', hops: wHops,
    text: 'The client sends its own Finished message (encrypted), a MAC over the entire handshake transcript. If any handshake message was tampered with, the values would not match. The secure channel is now ready for application data.',
    packet: { eth: ethOut, ipv4: { ...CL, ttl: 64, id: 0x7c04 }, tcp: { sport: 52344, dport: 443, seq: c2, ack: s2, flags: 'PSH,ACK', win: 64240 }, app: tlsCF },
  },
  {
    from: 'pc', to: 'web', label: 'GET /', title: 'HTTP request (inside TLS)', hops: wHops,
    text: 'The browser sends GET / with a Host header. On the wire it is a TLS Application Data record — only the browser and the server can read it. The decrypted contents are shown in the table.',
    packet: { eth: ethOut, ipv4: { ...CL, ttl: 64, id: 0x7c05 }, tcp: { sport: 52344, dport: 443, seq: c3, ack: s2, flags: 'PSH,ACK', win: 64240 }, app: tlsReq },
    tables: [{ title: 'Decrypted view (only browser and server can see this)', cols: ['HTTP request'], rows: HTTP_GET.trim().split('\n').map((l) => [l]) }],
  },
  {
    from: 'web', to: 'pc', label: '200 OK', title: 'HTTP response (inside TLS)', hops: wHopsBack,
    text: 'The server replies 200 OK with headers and the HTML document, again encrypted with the session keys. TCP acknowledges the bytes received so far.',
    packet: { eth: ethIn, ipv4: { ...SV, ttl: 53, id: 0 }, tcp: { sport: 443, dport: 52344, seq: s2, ack: c4, flags: 'PSH,ACK', win: 65160 }, app: tlsResp },
    tables: [{ title: 'Decrypted view (only browser and server can see this)', cols: ['HTTP response'], rows: HTTP_200.split('\n').map((l) => [l || '(blank line)']) }],
  },
  {
    from: 'pc', to: 'pc', local: true, label: 'render', title: 'Browser renders the page', text: `The browser acknowledges the data (Ack = ${s3}), parses the HTML, builds the DOM, and requests any further resources (CSS, images, scripts) — reusing this TLS connection or opening more. The padlock shows the connection is encrypted and the server is authenticated.`,
  },
];

// ------------------------------------------------------------ B: DHCP DORA
const dhcpDevices: Device[] = [
  { id: 'pc', type: 'laptop', label: 'New laptop', x: 10, y: 30, mac: M.pc, ip: '0.0.0.0 → ?', info: 'Just connected. It has a MAC address but no IP configuration, so it cannot send normal unicast IP traffic yet.' },
  { id: 'pc2', type: 'pc', label: 'Desktop', x: 10, y: 78, ip: '192.168.1.20', mac: M.pc2, info: 'An existing host on the LAN. It receives the broadcasts but ignores DHCP messages (UDP port 67 is not open on it).' },
  { id: 'sw', type: 'switch', label: 'Switch', x: 40, y: 55, info: 'Floods broadcast frames (ff:ff:ff:ff:ff:ff) out of every port except the one they arrived on.' },
  { id: 'dhcp', type: 'dhcp', label: 'DHCP server', x: 75, y: 25, ip: '192.168.1.5', mac: M.dhcp, info: 'Hands out addresses from pool 192.168.1.100–192.168.1.199 with an 8-hour lease.' },
  { id: 'gw', type: 'router', label: 'Gateway', x: 75, y: 80, ip: '192.168.1.1', mac: M.gw, info: 'Default gateway. Receives the broadcasts but is not configured as a DHCP server.' },
];
const dhcpLinks: Link[] = [{ a: 'pc', b: 'sw' }, { a: 'pc2', b: 'sw' }, { a: 'sw', b: 'dhcp' }, { a: 'sw', b: 'gw' }];
const XID = 0x3903f326;
const dhcpBase = { xid: XID, chaddr: M.pc };
const dhcpSteps: Step[] = [
  {
    from: 'pc', to: ['dhcp', 'pc2', 'gw'], label: 'DISCOVER', title: 'D — DHCP Discover (broadcast)', hops: { sw: 'Destination MAC is broadcast → flood out of all other ports.' },
    text: 'The laptop has no IP address, so it sends from 0.0.0.0:68 to 255.255.255.255:67 inside an Ethernet broadcast. Every device on the LAN receives it, but only DHCP servers respond. The transaction ID 0x3903f326 ties the whole exchange together.',
    packet: { eth: { src: M.pc, dst: M.bc }, ipv4: { src: '0.0.0.0', dst: '255.255.255.255', ttl: 64, id: 0, df: false }, udp: { sport: 68, dport: 67 }, app: { kind: 'dhcp', dhcp: { ...dhcpBase, op: 1, msg: 'DISCOVER', broadcast: true, hostname: 'laptop-01' } } },
  },
  {
    from: 'dhcp', to: ['pc', 'pc2', 'gw'], label: 'OFFER', title: 'O — DHCP Offer', hops: { sw: 'Broadcast reply flooded to all ports.' },
    text: 'The server picks a free address from its pool (192.168.1.100) and offers it, with mask, router, DNS and lease time. Because the client set the broadcast flag, the reply is broadcast. The server briefly reserves the address.',
    packet: { eth: { src: M.dhcp, dst: M.bc }, ipv4: { src: '192.168.1.5', dst: '255.255.255.255', ttl: 64, id: 0x0a01, df: false }, udp: { sport: 67, dport: 68 }, app: { kind: 'dhcp', dhcp: { ...dhcpBase, op: 2, msg: 'OFFER', yiaddr: '192.168.1.100', siaddr: '192.168.1.5', broadcast: true, server: '192.168.1.5', lease: 28800, mask: '255.255.255.0', router: '192.168.1.1', dns: ['198.51.100.53', '198.51.100.54'] } } },
    tables: [{ title: 'DHCP server bindings', device: 'dhcp', cols: ['IP', 'MAC', 'State', 'Lease'], rows: [['192.168.1.20', M.pc2, 'BOUND', '6h left'], ['192.168.1.100', M.pc, 'OFFERED', '—']], highlight: 1 }],
  },
  {
    from: 'pc', to: ['dhcp', 'pc2', 'gw'], label: 'REQUEST', title: 'R — DHCP Request (broadcast)', hops: { sw: 'Flooded — every DHCP server must learn which offer was chosen.' },
    text: 'The client formally requests 192.168.1.100 from server 192.168.1.5 (option 54). It is still broadcast so any other DHCP servers that made offers know they were declined and can release their reservations.',
    packet: { eth: { src: M.pc, dst: M.bc }, ipv4: { src: '0.0.0.0', dst: '255.255.255.255', ttl: 64, id: 0, df: false }, udp: { sport: 68, dport: 67 }, app: { kind: 'dhcp', dhcp: { ...dhcpBase, op: 1, msg: 'REQUEST', broadcast: true, requested: '192.168.1.100', server: '192.168.1.5', hostname: 'laptop-01' } } },
  },
  {
    from: 'dhcp', to: ['pc', 'pc2', 'gw'], label: 'ACK', title: 'A — DHCP Acknowledge', hops: { sw: 'Flooded to all ports.' },
    text: 'The server commits the binding and confirms it. The lease is 28 800 s (8 h). The client will try to renew at 50% (T1 = 4 h) with a unicast Request, and rebind with a broadcast at 87.5% (T2 = 7 h).',
    packet: { eth: { src: M.dhcp, dst: M.bc }, ipv4: { src: '192.168.1.5', dst: '255.255.255.255', ttl: 64, id: 0x0a02, df: false }, udp: { sport: 67, dport: 68 }, app: { kind: 'dhcp', dhcp: { ...dhcpBase, op: 2, msg: 'ACK', yiaddr: '192.168.1.100', siaddr: '192.168.1.5', broadcast: true, server: '192.168.1.5', lease: 28800, mask: '255.255.255.0', router: '192.168.1.1', dns: ['198.51.100.53', '198.51.100.54'] } } },
    tables: [{ title: 'DHCP server bindings', device: 'dhcp', cols: ['IP', 'MAC', 'State', 'Lease'], rows: [['192.168.1.20', M.pc2, 'BOUND', '6h left'], ['192.168.1.100', M.pc, 'BOUND', '8h']], highlight: 1 }],
  },
  {
    from: 'pc', to: ['dhcp', 'pc2', 'gw'], label: 'ARP probe', title: 'Duplicate address check (ARP probe)', hops: { sw: 'Broadcast flooded.' },
    text: 'Before using the address, the client sends an ARP probe (sender IP 0.0.0.0, target 192.168.1.100). If anyone answers, the address is already in use and the client sends DHCPDECLINE. Nobody answers here.',
    packet: { eth: { src: M.pc, dst: M.bc }, arp: { op: 1, sha: M.pc, spa: '0.0.0.0', tha: M.zero, tpa: '192.168.1.100' } },
  },
  {
    from: 'pc', to: 'pc', local: true, label: 'configured', title: 'Client configured', text: 'The laptop configures its interface and can now talk to the network and the Internet.',
    tables: [{ title: 'Laptop IP configuration', device: 'pc', cols: ['Setting', 'Value'], rows: [['IPv4 address', '192.168.1.100'], ['Subnet mask', '255.255.255.0 (/24)'], ['Default gateway', '192.168.1.1'], ['DNS servers', '198.51.100.53, 198.51.100.54'], ['Lease duration', '8 hours (renew at 4 h)'], ['DHCP server', '192.168.1.5']] }],
  },
];

// ------------------------------------------------------------ C: TCP handshake
const tcpDevices: Device[] = [
  { id: 'cl', type: 'pc', label: 'Client', x: 12, y: 50, ip: '10.0.0.15', mac: M.pc, info: 'Runs an application that wants to talk to the server on TCP port 80.' },
  { id: 'sw', type: 'switch', label: 'Switch', x: 50, y: 50, info: 'Forwards frames between the two hosts on the same LAN.' },
  { id: 'sv', type: 'server', label: 'Server', x: 88, y: 50, ip: '10.0.0.80', mac: M.srv, info: 'Has a socket in LISTEN state on port 80.' },
];
const tcpLinks: Link[] = [{ a: 'cl', b: 'sw' }, { a: 'sw', b: 'sv' }];
const T = { c: 4012345678, s: 91827364 };
const tc = (seq: number, ack: number | undefined, flags: string, app?: AppSpec, back = false) => ({
  eth: back ? { src: M.srv, dst: M.pc } : { src: M.pc, dst: M.srv },
  ipv4: back ? { src: '10.0.0.80', dst: '10.0.0.15', ttl: 64, id: 0x2211 } : { src: '10.0.0.15', dst: '10.0.0.80', ttl: 64, id: 0x4b10 },
  tcp: back ? { sport: 80, dport: 49812, seq, ack, flags, win: 65160, mss: flags.includes('SYN') ? 1460 : undefined } : { sport: 49812, dport: 80, seq, ack, flags, win: 64240, mss: flags.includes('SYN') ? 1460 : undefined },
  app,
});
const req: AppSpec = { kind: 'http', text: 'GET /status HTTP/1.1\nHost: 10.0.0.80\nAccept: */*\n' };
const reqLen = appLen(req);
const st = (c: string, s: string, cs: string, ss: string) => [{ title: 'Connection state', cols: ['', 'Client', 'Server'], rows: [['State', c, s], ['Seq / Ack', cs, ss]] }];
const tcpSteps: Step[] = [
  { from: 'cl', to: 'sv', label: 'SYN', title: 'SYN', hops: { sw: 'Forwarded by destination MAC.' }, text: `The client picks a random ISN = ${T.c} and sends SYN. Its state becomes SYN-SENT. The SYN flag consumes one sequence number, even though it carries no data.`, packet: tc(T.c, undefined, 'SYN'), tables: st('SYN-SENT', 'LISTEN', `seq ${T.c}`, '—') },
  { from: 'sv', to: 'cl', label: 'SYN-ACK', title: 'SYN-ACK', hops: { sw: 'Forwarded.' }, text: `The server picks its own ISN = ${T.s}, and acknowledges with Ack = ${T.c} + 1 = ${T.c + 1}: "I received your SYN; the next byte I expect is ${T.c + 1}". State SYN-RECEIVED.`, packet: tc(T.s, T.c + 1, 'SYN,ACK', undefined, true), tables: st('SYN-SENT', 'SYN-RECEIVED', `seq ${T.c}`, `seq ${T.s}, ack ${T.c + 1}`) },
  { from: 'cl', to: 'sv', label: 'ACK', title: 'ACK — connection established', hops: { sw: 'Forwarded.' }, text: `The client acknowledges the server's SYN with Ack = ${T.s + 1}. Its sequence number is now ${T.c + 1}. Both sides are ESTABLISHED — three segments, one and a half round trips.`, packet: tc(T.c + 1, T.s + 1, 'ACK'), tables: st('ESTABLISHED', 'ESTABLISHED', `seq ${T.c + 1}, ack ${T.s + 1}`, `seq ${T.s + 1}, ack ${T.c + 1}`) },
  { from: 'cl', to: 'sv', label: `DATA ${reqLen}B`, title: `Data: ${reqLen} bytes`, hops: { sw: 'Forwarded.' }, text: `The client sends ${reqLen} bytes of application data with Seq = ${T.c + 1}. The PSH flag asks the receiver to pass it straight to the application. The next byte will be ${T.c + 1 + reqLen}.`, packet: tc(T.c + 1, T.s + 1, 'PSH,ACK', req), tables: st('ESTABLISHED', 'ESTABLISHED', `next seq ${T.c + 1 + reqLen}`, `expects ${T.c + 1}`) },
  { from: 'sv', to: 'cl', label: 'ACK', title: 'Server acknowledges the data', hops: { sw: 'Forwarded.' }, text: `Ack = ${T.c + 1} + ${reqLen} = ${T.c + 1 + reqLen}: "I have every byte before ${T.c + 1 + reqLen}". Acknowledgements are cumulative — one ACK can confirm many segments.`, packet: tc(T.s + 1, T.c + 1 + reqLen, 'ACK', undefined, true), tables: st('ESTABLISHED', 'ESTABLISHED', `next seq ${T.c + 1 + reqLen}`, `ack ${T.c + 1 + reqLen}`) },
];

// ------------------------------------------------------------ TCP termination & retransmission
const relData = (seq: number, txt: string): AppSpec => ({ kind: 'raw', text: txt, name: `Data (seq ${seq})` });
const R0 = 1000, RS = 5000;
const tcpRelSteps: Step[] = [
  { from: 'cl', to: 'sv', label: 'seg 1 (100B)', title: 'Segment 1 sent (bytes 1000–1099)', hops: { sw: 'Forwarded.' }, text: 'The client sends 100 bytes starting at Seq 1000 (relative numbers for readability) and starts a retransmission timer (RTO).', packet: tc(R0, RS, 'PSH,ACK', relData(R0, 'A'.repeat(100))) },
  { from: 'cl', to: 'sv', label: 'seg 2 (100B)', dropAt: 'sw', title: 'Segment 2 lost (bytes 1100–1199)', hops: { sw: 'Output queue full — the frame is dropped (congestion).' }, text: 'Segment 2 is dropped by a congested device. The sender doesn\'t know yet. Thanks to the window, it keeps sending.', packet: tc(R0 + 100, RS, 'PSH,ACK', relData(R0 + 100, 'B'.repeat(100))) },
  { from: 'cl', to: 'sv', label: 'seg 3 (100B)', title: 'Segment 3 arrives out of order', hops: { sw: 'Forwarded.' }, text: 'Segment 3 (Seq 1200) arrives, but the receiver is missing 1100–1199. It buffers segment 3 and cannot pass it to the application yet.', packet: tc(R0 + 200, RS, 'PSH,ACK', relData(R0 + 200, 'C'.repeat(100))) },
  { from: 'sv', to: 'cl', label: 'ACK 1100 (dup)', title: 'Duplicate ACKs: "still need 1100"', hops: { sw: 'Forwarded.' }, text: 'The receiver keeps acknowledging 1100 — the first missing byte. With SACK, it also reports "I have 1200–1299". Three duplicate ACKs trigger Fast Retransmit without waiting for the timer.', packet: tc(RS, R0 + 100, 'ACK', undefined, true), tables: [{ title: 'Receiver buffer', device: 'sv', cols: ['Bytes', 'Status'], rows: [['1000–1099', 'delivered to app'], ['1100–1199', 'MISSING'], ['1200–1299', 'buffered (out of order)']], highlight: 1 }] },
  { from: 'cl', to: 'sv', label: 'RETX seg 2', title: 'Fast retransmit of segment 2', hops: { sw: 'Forwarded.' }, ok: true, text: 'The sender retransmits Seq 1100. Congestion control halves the congestion window (cwnd) because loss signals congestion.', packet: tc(R0 + 100, RS, 'PSH,ACK', relData(R0 + 100, 'B'.repeat(100))) },
  { from: 'sv', to: 'cl', label: 'ACK 1300', title: 'Cumulative ACK jumps to 1300', hops: { sw: 'Forwarded.' }, ok: true, text: 'The gap is filled, so the receiver delivers 1100–1299 to the application and acknowledges everything up to 1300 in one ACK.', packet: tc(RS, R0 + 300, 'ACK', undefined, true) },
  { from: 'cl', to: 'sv', label: 'FIN', title: 'Close 1/4: client FIN', hops: { sw: 'Forwarded.' }, text: 'The client has no more data and sends FIN (state FIN-WAIT-1). FIN consumes one sequence number.', packet: tc(R0 + 300, RS, 'FIN,ACK') },
  { from: 'sv', to: 'cl', label: 'ACK', title: 'Close 2/4: server ACKs the FIN', hops: { sw: 'Forwarded.' }, text: 'The server acknowledges (Ack 1301) and enters CLOSE-WAIT. It may still send data — the connection is half-closed.', packet: tc(RS, R0 + 301, 'ACK', undefined, true) },
  { from: 'sv', to: 'cl', label: 'FIN', title: 'Close 3/4: server FIN', hops: { sw: 'Forwarded.' }, text: 'When the server application closes its socket, the server sends its own FIN (LAST-ACK).', packet: tc(RS, R0 + 301, 'FIN,ACK', undefined, true) },
  { from: 'cl', to: 'sv', label: 'ACK', title: 'Close 4/4: final ACK, TIME-WAIT', hops: { sw: 'Forwarded.' }, text: 'The client acknowledges the server FIN and waits in TIME-WAIT for 2×MSL so delayed segments from this connection cannot corrupt a new one with the same ports. The server goes straight to CLOSED.', packet: tc(R0 + 301, RS + 1, 'ACK'), tables: [{ title: 'Final states', cols: ['Side', 'State'], rows: [['Client', 'TIME-WAIT → CLOSED'], ['Server', 'CLOSED']] }] },
];

// ------------------------------------------------------------ D: routing between networks
const rtDevices: Device[] = [
  { id: 'pa', type: 'pc', label: 'PC-A', x: 6, y: 50, ip: '192.168.10.10/24', mac: M.pc, zone: 'LAN A', info: 'Default gateway 192.168.10.1 (R1).' },
  { id: 'sw1', type: 'switch', label: 'SW1', x: 20, y: 50, zone: 'LAN A' },
  { id: 'r1', type: 'router', label: 'R1', x: 38, y: 50, ip: '.10.1 | 10.0.0.1', mac: `${M.gw} / ${M.r1b}`, info: 'Interfaces: G0/0 192.168.10.1/24 (LAN A, MAC ' + M.gw + '), G0/1 10.0.0.1/30 (to R2, MAC ' + M.r1b + ').' },
  { id: 'r2', type: 'router', label: 'R2', x: 62, y: 50, ip: '10.0.0.2 | .20.1', mac: `${M.r2a} / ${M.r2b}`, info: 'Interfaces: G0/1 10.0.0.2/30 (to R1, MAC ' + M.r2a + '), G0/0 192.168.20.1/24 (LAN B, MAC ' + M.r2b + ').' },
  { id: 'sw2', type: 'switch', label: 'SW2', x: 80, y: 50, zone: 'LAN B' },
  { id: 'sb', type: 'server', label: 'Server-B', x: 94, y: 50, ip: '192.168.20.20/24', mac: M.srv, zone: 'LAN B', info: 'Default gateway 192.168.20.1 (R2).' },
];
const rtLinks: Link[] = [{ a: 'pa', b: 'sw1' }, { a: 'sw1', b: 'r1' }, { a: 'r1', b: 'r2', label: '10.0.0.0/30' }, { a: 'r2', b: 'sw2' }, { a: 'sw2', b: 'sb' }];
const R1T = { title: 'R1 routing table', device: 'r1', cols: ['Destination', 'Next hop', 'Interface', 'Source'], rows: [['192.168.10.0/24', 'connected', 'G0/0', 'C'], ['10.0.0.0/30', 'connected', 'G0/1', 'C'], ['192.168.20.0/24', '10.0.0.2', 'G0/1', 'S/O'], ['0.0.0.0/0', '10.0.0.2', 'G0/1', 'S*']] };
const R2T = { title: 'R2 routing table', device: 'r2', cols: ['Destination', 'Next hop', 'Interface', 'Source'], rows: [['192.168.20.0/24', 'connected', 'G0/0', 'C'], ['10.0.0.0/30', 'connected', 'G0/1', 'C'], ['192.168.10.0/24', '10.0.0.1', 'G0/1', 'S/O']] };
const ping = (ttl: number, src: string, dst: string, smac: string, dmac: string, type: 8 | 0) => ({
  eth: { src: smac, dst: dmac }, ipv4: { src, dst, ttl, id: type === 8 ? 0x31a0 : 0x8e02 }, icmp: { type, code: 0, id: 0x0001, seq: 1 },
});
const rtSteps: Step[] = [
  { from: 'pa', to: 'pa', local: true, label: 'same subnet?', title: 'PC-A decides: local or remote?', text: 'PC-A ANDs its own address and the destination with its mask /24: 192.168.10.0 ≠ 192.168.20.0, so Server-B is on another network. The packet must go to the default gateway 192.168.10.1. PC-A already has R1\'s MAC in its ARP cache (otherwise it would ARP for the gateway, not for Server-B).', tables: [{ title: 'PC-A ARP cache', device: 'pa', cols: ['IP', 'MAC'], rows: [['192.168.10.1', M.gw]] }] },
  { from: 'pa', to: 'r1', label: 'L2: PC-A→R1', title: 'Hop 1: frame addressed to the gateway', hops: { sw1: 'Forwards by destination MAC (R1 G0/0).' }, text: 'Key idea: the IP destination is Server-B (192.168.20.20) but the Ethernet destination is R1\'s MAC. IP addresses are end-to-end; MAC addresses are hop-by-hop.', packet: ping(64, '192.168.10.10', '192.168.20.20', M.pc, M.gw, 8) },
  { from: 'r1', to: 'r1', local: true, label: 'lookup', title: 'R1 processes the packet', text: 'R1 strips the Ethernet header, checks the IP header checksum, and does a longest-prefix match on 192.168.20.20: the /24 route via 10.0.0.2 beats the default route /0. It decrements TTL 64 → 63, recomputes the header checksum, then builds a NEW Ethernet header for the next link.', tables: [{ ...R1T, highlight: 2 }] },
  { from: 'r1', to: 'r2', label: 'L2: R1→R2', title: 'Hop 2: Layer 2 header rewritten', text: 'Same IP source and destination, but the frame now goes from R1 G0/1 MAC to R2 G0/1 MAC. TTL is 63. (On a serial/PPP link there might be no MAC addresses at all — the Layer 2 header depends on the link type.)', packet: ping(63, '192.168.10.10', '192.168.20.20', M.r1b, M.r2a, 8) },
  { from: 'r2', to: 'r2', local: true, label: 'lookup', title: 'R2 processes the packet', text: '192.168.20.20 matches a directly connected network on G0/0. R2 decrements TTL to 62, ARPs for 192.168.20.20 if needed, and builds a new frame toward Server-B.', tables: [{ ...R2T, highlight: 0 }] },
  { from: 'r2', to: 'sb', label: 'L2: R2→Server', title: 'Hop 3: delivered on LAN B', hops: { sw2: 'Forwards to Server-B\'s port.' }, text: 'The final frame: R2 G0/0 MAC → Server-B MAC. Source IP is still PC-A. Server-B sees TTL 62 and can infer the packet crossed 2 routers.', packet: ping(62, '192.168.10.10', '192.168.20.20', M.r2b, M.srv, 8) },
  { from: 'sb', to: 'r2', label: 'Echo reply', title: 'Reply: Server-B → its gateway R2', hops: { sw2: 'Forwarded.' }, text: 'Server-B replies to 192.168.10.10 — also a remote network, so it frames the reply to its own gateway R2. The reply starts a fresh TTL of 64.', packet: ping(64, '192.168.20.20', '192.168.10.10', M.srv, M.r2b, 0) },
  { from: 'r2', to: 'r1', label: 'R2→R1', title: 'Reply crosses the R2–R1 link', text: 'R2 matches 192.168.10.0/24 via 10.0.0.1, decrements TTL to 63, rewrites the frame for the inter-router link.', packet: ping(63, '192.168.20.20', '192.168.10.10', M.r2a, M.r1b, 0), tables: [{ ...R2T, highlight: 2 }] },
  { from: 'r1', to: 'pa', label: 'R1→PC-A', title: 'Reply delivered to PC-A', hops: { sw1: 'Forwarded.' }, ok: true, text: 'R1 delivers on its connected LAN with TTL 62. PC-A matches the ICMP identifier/sequence to its request: reply received. Two routers rewrote the Layer 2 header four times in total; the IP addresses never changed.', packet: ping(62, '192.168.20.20', '192.168.10.10', M.gw, M.pc, 0), tables: [{ title: 'MAC vs IP summary', cols: ['Hop', 'Src MAC → Dst MAC', 'Src IP → Dst IP'], rows: [['PC-A→R1', 'PC-A → R1 G0/0', '192.168.10.10 → 192.168.20.20'], ['R1→R2', 'R1 G0/1 → R2 G0/1', 'same'], ['R2→Server', 'R2 G0/0 → Server-B', 'same']] }] },
];

// ------------------------------------------------------------ E: ARP
const arpDevices: Device[] = [
  { id: 'p1', type: 'pc', label: 'PC1', x: 12, y: 25, ip: '192.168.1.10', mac: M.pc, info: 'Wants to send to 192.168.1.20 on the same subnet.' },
  { id: 'sw', type: 'switch', label: 'Switch', x: 50, y: 50, info: 'Learns source MACs per port; floods broadcasts and unknown unicasts.' },
  { id: 'p2', type: 'pc', label: 'PC2', x: 88, y: 25, ip: '192.168.1.20', mac: M.pc2 },
  { id: 'p3', type: 'laptop', label: 'PC3', x: 88, y: 78, ip: '192.168.1.30', mac: M.pc3 },
  { id: 'gw', type: 'router', label: 'Gateway', x: 12, y: 78, ip: '192.168.1.1', mac: M.gw },
];
const arpLinks: Link[] = [{ a: 'p1', b: 'sw' }, { a: 'sw', b: 'p2' }, { a: 'sw', b: 'p3' }, { a: 'gw', b: 'sw' }];
const arpSteps: Step[] = [
  { from: 'p1', to: 'p1', local: true, label: 'ARP cache?', title: 'PC1 checks its ARP cache', text: 'PC1 wants to ping 192.168.1.20. It is on the same /24, so PC1 needs PC2\'s MAC to build the Ethernet frame. The ARP cache has no entry for it.', tables: [{ title: 'PC1 ARP cache', device: 'p1', cols: ['IP', 'MAC', 'Type'], rows: [['192.168.1.1', M.gw, 'dynamic']] }] },
  { from: 'p1', to: ['p2', 'p3', 'gw'], label: 'Who has .20?', title: 'ARP request (broadcast)', hops: { sw: 'Learns PC1\'s MAC on port 1, then floods the broadcast to all other ports.' }, text: 'PC1 broadcasts "Who has 192.168.1.20? Tell 192.168.1.10". Every host on the LAN processes it. PC3 and the gateway see the target IP is not theirs and ignore it (though they may update an existing entry for PC1).', packet: { eth: { src: M.pc, dst: M.bc }, arp: { op: 1, sha: M.pc, spa: '192.168.1.10', tha: M.zero, tpa: '192.168.1.20' } }, tables: [{ title: 'Switch MAC table', device: 'sw', cols: ['MAC', 'Port'], rows: [[M.pc, 'Fa0/1']], highlight: 0 }] },
  { from: 'p2', to: 'p1', label: '.20 is at …', title: 'ARP reply (unicast)', hops: { sw: 'Learns PC2 on port 2. Knows PC1 is on port 1 → forwards only there.' }, text: 'PC2 recognises its own IP. It caches PC1\'s mapping (from the request) and replies directly to PC1\'s MAC: "192.168.1.20 is at ' + M.pc2 + '".', packet: { eth: { src: M.pc2, dst: M.pc }, arp: { op: 2, sha: M.pc2, spa: '192.168.1.20', tha: M.pc, tpa: '192.168.1.10' } }, tables: [{ title: 'Switch MAC table', device: 'sw', cols: ['MAC', 'Port'], rows: [[M.pc, 'Fa0/1'], [M.pc2, 'Fa0/2']], highlight: 1 }] },
  { from: 'p1', to: 'p1', local: true, label: 'cache', title: 'PC1 caches the mapping', text: 'The entry is stored for a limited time (often 1–20 minutes depending on the OS) so the next packets do not need ARP again. Note that ARP has no authentication — any host can send a reply, which is what ARP spoofing exploits.', tables: [{ title: 'PC1 ARP cache', device: 'p1', cols: ['IP', 'MAC', 'Type'], rows: [['192.168.1.1', M.gw, 'dynamic'], ['192.168.1.20', M.pc2, 'dynamic']], highlight: 1 }] },
  { from: 'p1', to: 'p2', label: 'ICMP echo', title: 'The original packet can finally be sent', hops: { sw: 'Unicast — forwarded only to PC2\'s port.' }, ok: true, text: 'Now PC1 builds the Ethernet frame with PC2\'s MAC and sends the ICMP Echo Request that it had been waiting to send.', packet: { eth: { src: M.pc, dst: M.pc2 }, ipv4: { src: '192.168.1.10', dst: '192.168.1.20', ttl: 128, id: 0x1234 }, icmp: { type: 8, code: 0, id: 1, seq: 1 } } },
];

// ------------------------------------------------------------ F: ping (parametrised)
const pingDevices: Device[] = [
  { id: 'pc', type: 'pc', label: 'Your PC', x: 8, y: 55, ip: '192.168.1.10', mac: M.pc },
  { id: 'gw', type: 'router', label: 'Home router', x: 30, y: 55, ip: '192.168.1.1', mac: M.gw, info: 'NATs the ICMP echo (it uses the ICMP identifier like a port number).' },
  { id: 'net', type: 'cloud', label: 'Internet', x: 58, y: 55, info: 'Several routers; each decrements TTL. Congested links may drop packets.' },
  { id: 'sv', type: 'server', label: 'Target host', x: 88, y: 55, ip: '198.51.100.10', info: 'Replies to ICMP Echo Requests. Its OS uses initial TTL 64.' },
];
const pingLinks: Link[] = [{ a: 'pc', b: 'gw' }, { a: 'gw', b: 'net' }, { a: 'net', b: 'sv' }];
function pingSteps(p: Record<string, number>): Step[] {
  const n = p.count, loss = p.loss, lat = p.latency;
  const steps: Step[] = [];
  const rtts: number[] = [];
  for (let s = 1; s <= n; s++) {
    const lost = prngBytes(s * 7919 + loss * 31 + 3, 1)[0] / 256 < loss / 100;
    steps.push({ from: 'pc', to: 'sv', dropAt: lost ? 'net' : undefined, danger: lost, label: `Echo req #${s}`, title: `Echo Request seq=${s}${lost ? ' — lost' : ''}`,
      hops: { gw: 'NAT rewrites source to the public address and records the ICMP identifier.', net: lost ? 'A congested router drops the packet.' : 'Routers forward it, decrementing TTL.' },
      text: lost ? 'The request is dropped in transit. ping waits for its timeout (typically 1–2 s) and reports "Request timed out" for this sequence number.' : `ping sends ICMP type 8 with identifier 0x0001 and sequence ${s}, and records the send time.`,
      packet: { eth: { src: M.pc, dst: M.gw }, ipv4: { src: '192.168.1.10', dst: '198.51.100.10', ttl: 64, id: 0x6000 + s }, icmp: { type: 8, code: 0, id: 1, seq: s, data: 'abcdefghijklmnopqrstuvwabcdefghi' } } });
    if (!lost) {
      const jitter = prngBytes(s * 131 + lat, 1)[0] / 256;
      const rtt = Math.round(lat * 2 + 1 + jitter * Math.max(2, lat * 0.25));
      rtts.push(rtt);
      steps.push({ from: 'sv', to: 'pc', label: `Echo reply #${s}`, title: `Echo Reply seq=${s}: ${rtt} ms, TTL=60`, rtt,
        hops: { net: 'Routed back, TTL decremented at each hop.', gw: 'NAT matches the ICMP identifier and forwards to 192.168.1.10.' },
        text: `The target copies identifier, sequence and data into a type 0 reply. It started at TTL 64 and arrives with TTL 60, so it crossed 4 routers. ping prints: Reply from 198.51.100.10: bytes=32 time=${rtt}ms TTL=60.`,
        packet: { eth: { src: M.gw, dst: M.pc }, ipv4: { src: '198.51.100.10', dst: '192.168.1.10', ttl: 60, id: 0x9a00 + s }, icmp: { type: 0, code: 0, id: 1, seq: s, data: 'abcdefghijklmnopqrstuvwabcdefghi' } } });
    }
  }
  const recv = rtts.length;
  const stats = recv ? [Math.min(...rtts), Math.max(...rtts), Math.round(rtts.reduce((a, b) => a + b, 0) / recv)] : ['—', '—', '—'];
  steps.push({ from: 'pc', to: 'pc', local: true, label: 'statistics', title: 'Ping statistics', ok: recv === n,
    text: `Packets: sent = ${n}, received = ${recv}, lost = ${n - recv} (${Math.round(((n - recv) / n) * 100)}% loss). Loss above a few percent hurts TCP throughput and real-time apps. Remember: a host that drops ping (firewall) is not necessarily down.`,
    tables: [{ title: 'ping 198.51.100.10 — summary (simulated)', device: 'pc', cols: ['Sent', 'Received', 'Loss', 'Min', 'Max', 'Avg'], rows: [[n, recv, `${Math.round(((n - recv) / n) * 100)}%`, `${stats[0]} ms`, `${stats[1]} ms`, `${stats[2]} ms`]] }] });
  return steps;
}

// ------------------------------------------------------------ G: HTTPS & TLS deep dive
const tlsDevices: Device[] = [
  { id: 'br', type: 'laptop', label: 'Browser', x: 8, y: 40, ip: '192.168.1.10', mac: M.pc },
  { id: 'gw', type: 'router', label: 'Router', x: 30, y: 40, ip: '192.168.1.1', mac: M.gw },
  { id: 'eve', type: 'attacker', label: 'Eavesdropper', x: 48, y: 82, info: 'A passive observer on the path (e.g. a compromised ISP router or shared Wi-Fi). Sees every byte on the wire but cannot change them without detection.' },
  { id: 'net', type: 'cloud', label: 'Internet', x: 55, y: 40 },
  { id: 'ws', type: 'web', label: 'shop.example.com', x: 90, y: 40, ip: '203.0.113.80', info: 'Presents a certificate for shop.example.com issued by a public CA.' },
];
const tlsLinks: Link[] = [{ a: 'br', b: 'gw' }, { a: 'gw', b: 'net' }, { a: 'net', b: 'ws' }, { a: 'net', b: 'eve', label: 'tap' }];
const tb = { src: '192.168.1.10', dst: '203.0.113.80' }, tw = { src: '203.0.113.80', dst: '192.168.1.10' };
const tlsH = { gw: 'NAT + forward.', net: 'Eavesdropper copies the packet.' };
const tlsSteps: Step[] = [
  { from: 'br', to: 'ws', label: 'ClientHello', hops: tlsH, title: '1. ClientHello', text: 'After the TCP handshake, the browser offers TLS 1.3, its cipher suites, and an X25519 key share. The eavesdropper can read this record: SNI reveals the site name (Encrypted ClientHello, ECH, can hide it).', packet: { eth: { src: M.pc, dst: M.gw }, ipv4: { ...tb, id: 0x10 }, tcp: { sport: 50122, dport: 443, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'tls', records: [{ kind: 'ClientHello', sni: 'shop.example.com', seed: 21 }] } }, tables: [{ title: 'What the eavesdropper sees', cols: ['Visible', 'Hidden'], rows: [['IP addresses, ports, SNI shop.example.com, packet sizes & timing', 'nothing secret yet']] }] },
  { from: 'ws', to: 'br', label: 'ServerHello', hops: tlsH, title: '2. ServerHello (+ key share)', text: 'The server chooses TLS 1.3 and AES-128-GCM and returns its key share. Now both sides combine their private key with the other\'s public key (Diffie–Hellman) and derive the same shared secret. The eavesdropper saw both public keys but cannot compute the secret — that is the elliptic-curve discrete logarithm problem.', packet: { eth: { src: M.gw, dst: M.pc }, ipv4: { ...tw, id: 0x20, ttl: 54 }, tcp: { sport: 443, dport: 50122, seq: 1, ack: 1 + appLen({ kind: 'tls', records: [{ kind: 'ClientHello', sni: 'shop.example.com', seed: 21 }] }), flags: 'PSH,ACK' }, app: { kind: 'tls', records: [{ kind: 'ServerHello', seed: 22 }] } } },
  { from: 'br', to: 'br', local: true, label: 'key schedule', title: '3. Session keys derived', text: 'HKDF expands the ECDHE secret (plus a hash of all handshake messages) into separate handshake and application traffic keys for each direction. Ephemeral keys give forward secrecy: stealing the server\'s certificate key later does not decrypt this session.', tables: [{ title: 'Key schedule (simplified)', device: 'br', cols: ['Input', 'Output'], rows: [['ECDHE(x25519) shared secret', 'Handshake secret'], ['Handshake secret + transcript hash', 'client/server handshake traffic keys'], ['Master secret + transcript hash', 'client/server application traffic keys']] }] },
  { from: 'ws', to: 'br', label: 'Cert + Verify', hops: tlsH, title: '4. Encrypted Certificate, CertificateVerify, Finished', text: 'The server proves its identity: the certificate binds shop.example.com to a public key, a CA signature vouches for that binding, and CertificateVerify is a signature over the handshake with the matching private key. In TLS 1.3 the certificate itself is encrypted.', packet: { eth: { src: M.gw, dst: M.pc }, ipv4: { ...tw, id: 0x21, ttl: 54 }, tcp: { sport: 443, dport: 50122, seq: 200, ack: 300, flags: 'PSH,ACK' }, app: { kind: 'tls', records: [{ kind: 'Encrypted', len: 64, seed: 31, note: 'EncryptedExtensions' }, { kind: 'Encrypted', len: 420, seed: 32, note: 'Certificate' }, { kind: 'Encrypted', len: 96, seed: 33, note: 'CertificateVerify' }, { kind: 'Encrypted', len: 53, seed: 34, note: 'Finished' }] } } },
  { from: 'br', to: 'br', local: true, label: 'validate', title: '5. Certificate verification', text: 'The browser checks the chain up to a trusted root, the signatures, hostname match, validity dates and revocation. If an attacker had substituted their own certificate, the chain or hostname check would fail here.', tables: [{ title: 'Certificate', device: 'br', cols: ['Field', 'Value'], rows: [['Subject / SAN', 'shop.example.com'], ['Issuer', 'Example TLS CA (intermediate)'], ['Public key', 'ECDSA P-256'], ['Signature', 'ecdsa-with-SHA256'], ['Validity', '90 days'], ['Result', '✓ trusted']] }] },
  { from: 'br', to: 'ws', label: 'Finished', hops: tlsH, title: '6. Client Finished', text: 'The browser sends Finished, proving it saw the same handshake. Total cost: one round trip before data can flow (TLS 1.2 needed two).', packet: { eth: { src: M.pc, dst: M.gw }, ipv4: { ...tb, id: 0x11 }, tcp: { sport: 50122, dport: 443, seq: 300, ack: 900, flags: 'PSH,ACK' }, app: { kind: 'tls', records: [{ kind: 'ChangeCipherSpec' }, { kind: 'Encrypted', len: 53, seed: 41, note: 'Finished' }] } } },
  { from: 'br', to: 'ws', label: 'POST /login', hops: { ...tlsH, net: 'Eavesdropper copies the packet — but sees only ciphertext.' }, title: '7. Encrypted application data', text: 'The login form is POSTed inside an Application Data record. The eavesdropper sees only random-looking bytes. Integrity is protected too: flipping any bit makes the AES-GCM tag check fail.', packet: { eth: { src: M.pc, dst: M.gw }, ipv4: { ...tb, id: 0x12 }, tcp: { sport: 50122, dport: 443, seq: 364, ack: 900, flags: 'PSH,ACK' }, app: { kind: 'tls', records: [{ kind: 'Encrypted', len: 180, seed: 51, note: 'POST /login (encrypted)' }] } }, tables: [{ title: 'What the eavesdropper sees', cols: ['Visible', 'Hidden'], rows: [['IPs, ports, SNI, sizes, timing', 'URL path, headers, cookies, username, password, page content']] }] },
  { from: 'br', to: 'ws', label: 'HTTP (no TLS)', danger: true, hops: { gw: 'Forward.', net: 'Eavesdropper reads everything in clear text.' }, title: 'Compare: the same request over plain HTTP', text: 'Without TLS, the identical request travels as readable ASCII. Anyone on the path can read the password and cookies — and an active attacker could modify the page. This is the core difference between HTTP and HTTPS: confidentiality, integrity and server authentication.', packet: { eth: { src: M.pc, dst: M.gw }, ipv4: { ...tb, id: 0x13 }, tcp: { sport: 50124, dport: 80, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'http', text: 'POST /login HTTP/1.1\nHost: shop.example.com\nContent-Type: application/x-www-form-urlencoded\nContent-Length: 31\nCookie: session=8f2c1a9e\n\nuser=alice&password=Summer2026!' } }, tables: [{ title: 'HTTP vs HTTPS', cols: ['', 'HTTP', 'HTTPS'], rows: [['Port', '80', '443'], ['Confidentiality', '✗ plaintext', '✓ encrypted'], ['Integrity', '✗ can be modified', '✓ AEAD tag'], ['Server authentication', '✗ none', '✓ certificate'], ['Visible to observer', 'everything', 'IPs, ports, SNI, sizes']] }] },
];

// ------------------------------------------------------------ H: NAT / PAT
const natDevices: Device[] = [
  { id: 'p1', type: 'pc', label: 'PC1', x: 8, y: 18, ip: '192.168.1.10', mac: M.pc, zone: 'Inside (private)' },
  { id: 'p2', type: 'laptop', label: 'PC2', x: 8, y: 50, ip: '192.168.1.11', mac: M.pc2, zone: 'Inside (private)' },
  { id: 'ph', type: 'phone', label: 'Phone', x: 8, y: 82, ip: '192.168.1.12', mac: M.phone, zone: 'Inside (private)' },
  { id: 'sw', type: 'switch', label: 'Switch', x: 26, y: 50 },
  { id: 'rt', type: 'router', label: 'NAT router', x: 46, y: 50, ip: 'in .1.1 | out 203.0.113.5', mac: M.gw, info: 'Inside interface 192.168.1.1, outside interface 203.0.113.5 — the only public IPv4 address the ISP assigned. Runs PAT (NAT overload).' },
  { id: 'net', type: 'cloud', label: 'Internet', x: 68, y: 50 },
  { id: 'ws', type: 'web', label: 'Web server', x: 92, y: 30, ip: '198.51.100.80' },
  { id: 'dn', type: 'dns', label: 'DNS server', x: 92, y: 75, ip: '198.51.100.53' },
];
const natLinks: Link[] = [{ a: 'p1', b: 'sw' }, { a: 'p2', b: 'sw' }, { a: 'ph', b: 'sw' }, { a: 'sw', b: 'rt' }, { a: 'rt', b: 'net' }, { a: 'net', b: 'ws' }, { a: 'net', b: 'dn' }];
const NATCOLS = ['Proto', 'Inside local', 'Inside global', 'Outside'];
const n1 = ['TCP', '192.168.1.10:50001', '203.0.113.5:40001', '198.51.100.80:443'];
const n2 = ['TCP', '192.168.1.11:50001', '203.0.113.5:40002', '198.51.100.80:443'];
const n3 = ['UDP', '192.168.1.12:61000', '203.0.113.5:40003', '198.51.100.53:53'];
const natSteps: Step[] = [
  { from: 'p1', to: 'rt', label: 'SYN :50001', title: 'PC1 opens a connection (inside)', hops: { sw: 'Forwarded to the router.' }, text: 'PC1 sends a SYN from its private address 192.168.1.10:50001 to the web server. Private (RFC 1918) addresses are not routable on the Internet, so this packet cannot leave as-is.', packet: { eth: { src: M.pc, dst: M.gw }, ipv4: { src: '192.168.1.10', dst: '198.51.100.80', id: 0x0101 }, tcp: { sport: 50001, dport: 443, seq: 1000, flags: 'SYN', mss: 1460 } } },
  { from: 'rt', to: 'ws', label: 'SYN :40001', title: 'Router translates and forwards (outside)', hops: { net: 'Routed normally — it now has a public source.' }, text: 'PAT rewrites source IP 192.168.1.10 → 203.0.113.5 and source port 50001 → 40001, recomputes the IP and TCP checksums, and records the mapping. TTL drops to 63.', packet: { eth: { src: M.gwWan, dst: '00:00:5e:00:01:01' }, ipv4: { src: '203.0.113.5', dst: '198.51.100.80', ttl: 63, id: 0x0101 }, tcp: { sport: 40001, dport: 443, seq: 1000, flags: 'SYN', mss: 1460 } }, tables: [{ title: 'NAT translation table', device: 'rt', cols: NATCOLS, rows: [n1], highlight: 0 }] },
  { from: 'p2', to: 'rt', label: 'SYN :50001', title: 'PC2 uses the SAME source port', hops: { sw: 'Forwarded.' }, text: 'By coincidence PC2 also picked source port 50001 to the same server. Without port translation the router could not tell the two replies apart.', packet: { eth: { src: M.pc2, dst: M.gw }, ipv4: { src: '192.168.1.11', dst: '198.51.100.80', id: 0x0202 }, tcp: { sport: 50001, dport: 443, seq: 7000, flags: 'SYN', mss: 1460 } } },
  { from: 'rt', to: 'ws', label: 'SYN :40002', title: 'PAT assigns a different public port', hops: { net: 'Routed.' }, text: 'The router maps PC2 to 203.0.113.5:40002. One public IP, distinguished by port: up to ~64 000 simultaneous flows per protocol per public address.', packet: { eth: { src: M.gwWan, dst: '00:00:5e:00:01:01' }, ipv4: { src: '203.0.113.5', dst: '198.51.100.80', ttl: 63, id: 0x0202 }, tcp: { sport: 40002, dport: 443, seq: 7000, flags: 'SYN', mss: 1460 } }, tables: [{ title: 'NAT translation table', device: 'rt', cols: NATCOLS, rows: [n1, n2], highlight: 1 }] },
  { from: 'ph', to: 'dn', label: 'DNS :61000→:40003', title: 'Phone sends a DNS query (UDP)', hops: { sw: 'Forwarded.', rt: 'Translated 192.168.1.12:61000 → 203.0.113.5:40003.', net: 'Routed.' }, text: 'UDP flows are translated the same way. Because UDP has no connection teardown, UDP entries expire after a short idle timer (often 30–300 s). Shown here as it leaves the phone.', packet: { eth: { src: M.phone, dst: M.gw }, ipv4: { src: '192.168.1.12', dst: '198.51.100.53', id: 0x0303, df: false }, udp: { sport: 61000, dport: 53 }, app: { kind: 'dns', dns: { id: 0x41b2, response: false, qname: 'api.example.net', qtype: 'AAAA' } } }, tables: [{ title: 'NAT translation table', device: 'rt', cols: NATCOLS, rows: [n1, n2, n3], highlight: 2 }] },
  { from: 'ws', to: 'rt', label: 'SYN-ACK →:40002', title: 'Reply arrives for 203.0.113.5:40002', hops: { net: 'Routed to the public address.' }, text: 'The server only ever sees 203.0.113.5. Its SYN-ACK is addressed to port 40002.', packet: { eth: { src: '00:00:5e:00:01:01', dst: M.gwWan }, ipv4: { src: '198.51.100.80', dst: '203.0.113.5', ttl: 55, id: 0 }, tcp: { sport: 443, dport: 40002, seq: 555000, ack: 7001, flags: 'SYN,ACK', mss: 1460 } } },
  { from: 'rt', to: 'p2', label: 'SYN-ACK →PC2', title: 'Reverse translation to PC2', hops: { sw: 'Forwarded to PC2.' }, ok: true, text: 'The router looks up port 40002, finds 192.168.1.11:50001, rewrites destination IP and port back, and forwards on the LAN. Unsolicited inbound packets with no table entry are dropped — a side effect that hides inside hosts (but NAT is not a firewall substitute).', packet: { eth: { src: M.gw, dst: M.pc2 }, ipv4: { src: '198.51.100.80', dst: '192.168.1.11', ttl: 54, id: 0 }, tcp: { sport: 443, dport: 50001, seq: 555000, ack: 7001, flags: 'SYN,ACK', mss: 1460 } }, tables: [{ title: 'NAT translation table', device: 'rt', cols: NATCOLS, rows: [n1, n2, n3], highlight: 1 }] },
];

export const guided: Scenario[] = [
  { id: 'website', kind: 'guided', title: 'Opening a website', short: 'A', protocols: ['dns', 'udp', 'tcp', 'tls', 'https', 'http'], summary: 'Everything that happens after you press Enter on https://www.example.com: DNS, TCP, TLS 1.3, certificate validation and HTTP.', devices: webDevices, links: webLinks, steps: websiteSteps, takeaways: ['Name resolution happens before any connection.', 'HTTPS = HTTP inside TLS inside TCP.', 'TLS 1.3 needs one round trip and encrypts the certificate.'] },
  { id: 'dhcp', kind: 'guided', title: 'DHCP address assignment (DORA)', short: 'B', protocols: ['dhcp', 'udp', 'arp'], summary: 'Discover, Offer, Request, Acknowledge — how a new device gets its IP address, mask, gateway, DNS and lease.', devices: dhcpDevices, links: dhcpLinks, steps: dhcpSteps, takeaways: ['A client with no IP uses 0.0.0.0 → 255.255.255.255.', 'UDP 68 (client) and 67 (server).', 'Leases are renewed at 50% of their duration.'] },
  { id: 'tcp-handshake', kind: 'guided', title: 'TCP three-way handshake', short: 'C', protocols: ['tcp', 'tcp-handshake'], summary: 'SYN, SYN-ACK, ACK and the first data exchange, with sequence and acknowledgement numbers tracked at every step.', devices: tcpDevices, links: tcpLinks, steps: tcpSteps, takeaways: ['SYN and FIN each consume one sequence number.', 'Ack = next byte expected.', 'ISNs are random to prevent spoofing.'] },
  { id: 'routing', kind: 'guided', title: 'Routing between networks', short: 'D', protocols: ['ip-routing', 'routing', 'ipv4', 'icmp', 'ethernet'], summary: 'Two LANs joined by two routers. Watch the Layer 2 header get rewritten at each hop while the IP addresses stay the same.', devices: rtDevices, links: rtLinks, steps: rtSteps, takeaways: ['MAC = hop-by-hop, IP = end-to-end.', 'Routers decrement TTL and recompute the header checksum.', 'Longest prefix match wins.'] },
  { id: 'arp', kind: 'guided', title: 'ARP resolution', short: 'E', protocols: ['arp', 'ethernet'], summary: 'How a host discovers the MAC address for an IPv4 address on its own LAN, and how switches learn MAC locations.', devices: arpDevices, links: arpLinks, steps: arpSteps, takeaways: ['ARP request = broadcast, reply = unicast.', 'Results are cached for minutes.', 'ARP has no authentication.'] },
  { id: 'ping', kind: 'guided', title: 'ICMP and ping', short: 'F', protocols: ['icmp'], summary: 'Send echo requests, watch replies, see TTL and round-trip time, and add packet loss to see what ping reports.', devices: pingDevices, links: pingLinks, steps: pingSteps, params: [{ id: 'count', label: 'Pings', min: 1, max: 6, step: 1, default: 4 }, { id: 'loss', label: 'Loss', min: 0, max: 60, step: 5, default: 0, unit: '%' }, { id: 'latency', label: 'One-way delay', min: 2, max: 150, step: 1, default: 12, unit: ' ms' }], takeaways: ['RTT ≈ 2 × one-way delay + processing.', 'TTL in a reply hints at the hop count.', 'Blocked ICMP ≠ host down.'] },
  { id: 'https-tls', kind: 'guided', title: 'HTTPS and TLS 1.3', short: 'G', protocols: ['tls', 'https', 'http'], summary: 'Key exchange, certificate verification, session keys and encrypted data — plus what an eavesdropper sees with and without HTTPS.', devices: tlsDevices, links: tlsLinks, steps: tlsSteps, takeaways: ['ECDHE gives forward secrecy.', 'Certificates authenticate the server.', 'SNI, IPs and sizes are still visible.'] },
  { id: 'nat', kind: 'guided', title: 'NAT and PAT', short: 'H', protocols: ['nat', 'pat'], summary: 'Several private devices share one public IPv4 address. Watch the translation table fill up and replies get mapped back.', devices: natDevices, links: natLinks, steps: natSteps, takeaways: ['PAT distinguishes flows by port.', 'Checksums are recomputed after rewriting.', 'Inbound needs an existing mapping (or port forwarding).'] },
  { id: 'tcp-reliability', kind: 'guided', title: 'TCP retransmission & teardown', short: 'I', protocols: ['tcp', 'tcp-retransmission', 'tcp-termination', 'tcp-congestion'], summary: 'A lost segment, duplicate ACKs, fast retransmit, then the four-segment FIN close and TIME-WAIT.', devices: tcpDevices, links: tcpLinks, steps: tcpRelSteps, takeaways: ['Duplicate ACKs signal a gap.', 'Loss shrinks the congestion window.', 'Closing is four segments; TIME-WAIT lasts 2×MSL.'] },
];
