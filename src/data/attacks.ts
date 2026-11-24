// Self-contained, simulated attack visualisations for defensive education.
// Nothing here sends traffic anywhere: every "packet" is built in the browser and animated on a diagram.
import type { Scenario, Device, Link, Step } from '../engine/sim';
import { M } from './guided';

const lan = (extra: Device[] = []): Device[] => [
  { id: 'v', type: 'pc', label: 'Victim', x: 10, y: 30, ip: '192.168.1.10', mac: M.pc },
  { id: 'sw', type: 'switch', label: 'Switch', x: 42, y: 52, info: 'Access switch. Security features such as DHCP snooping, Dynamic ARP Inspection and port security are configured here.' },
  { id: 'gw', type: 'router', label: 'Gateway', x: 74, y: 30, ip: '192.168.1.1', mac: M.gw },
  { id: 'net', type: 'cloud', label: 'Internet', x: 93, y: 30 },
  { id: 'a', type: 'attacker', label: 'Attacker', x: 10, y: 82, ip: '192.168.1.66', mac: M.atk, info: 'A device controlled by the attacker on the same LAN (e.g. a compromised laptop or a rogue device plugged into a wall port).' },
  ...extra,
];
const lanLinks: Link[] = [{ a: 'v', b: 'sw' }, { a: 'gw', b: 'sw' }, { a: 'gw', b: 'net' }, { a: 'a', b: 'sw' }];

// ------------------------------------------------------------------ ARP spoofing
const arpPoison = { eth: { src: M.atk, dst: M.pc }, arp: { op: 2 as const, sha: M.atk, spa: '192.168.1.1', tha: M.pc, tpa: '192.168.1.10' } };
const arpSpoof: Step[] = [
  { from: 'v', to: 'v', local: true, label: 'ARP cache', title: 'Normal state', text: 'The victim correctly maps the gateway 192.168.1.1 to the gateway\'s real MAC.', tables: [{ title: 'Victim ARP cache', device: 'v', cols: ['IP', 'MAC'], rows: [['192.168.1.1', M.gw]] }] },
  { from: 'a', to: 'v', danger: true, label: 'forged ARP reply', title: 'Attacker sends unsolicited ARP replies', hops: { sw: 'Forwards it like any other frame — plain switches do not validate ARP.' }, text: 'The attacker claims "192.168.1.1 is at de:ad:be:ef:66:66". ARP is stateless: most hosts accept replies they never asked for. The attacker repeats this every few seconds and sends the mirror lie to the gateway about the victim.', packet: arpPoison },
  { from: 'v', to: 'v', local: true, danger: true, label: 'poisoned', title: 'Victim\'s cache is poisoned', text: 'The victim now sends every off-subnet packet to the attacker\'s MAC.', tables: [{ title: 'Victim ARP cache', device: 'v', cols: ['IP', 'MAC'], rows: [['192.168.1.1', `${M.atk}  ← forged`]], highlight: 0 }] },
  { from: 'v', to: 'a', danger: true, label: 'traffic → attacker', title: 'Victim traffic flows through the attacker', hops: { sw: 'Delivers to the attacker\'s port — the destination MAC says so.' }, text: 'The IP destination is still the Internet, but the frame goes to the attacker, who can read, log or alter it, then forward it to the real gateway so the victim notices nothing (man-in-the-middle).', packet: { eth: { src: M.pc, dst: M.atk }, ipv4: { src: '192.168.1.10', dst: '203.0.113.80' }, tcp: { sport: 51000, dport: 80, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'http', text: 'GET /account HTTP/1.1\nHost: intranet.example.com\nCookie: sid=7d1e0c\n' } } },
  { from: 'a', to: 'gw', danger: true, label: 'relayed', title: 'Attacker relays to the real gateway', hops: { sw: 'Forwarded.' }, text: 'IP forwarding on the attacker\'s machine passes the packet on, so the connection keeps working.', packet: { eth: { src: M.atk, dst: M.gw }, ipv4: { src: '192.168.1.10', dst: '203.0.113.80', ttl: 63 }, tcp: { sport: 51000, dport: 80, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'http', text: 'GET /account HTTP/1.1\nHost: intranet.example.com\nCookie: sid=7d1e0c\n' } } },
];
const arpSpoofSafe: Step[] = [
  arpSpoof[0],
  { from: 'a', to: 'v', dropAt: 'sw', ok: true, label: 'forged ARP reply', title: 'Dynamic ARP Inspection drops the forgery', hops: { sw: 'DAI checks the ARP against the DHCP snooping binding table: 192.168.1.1 is not bound to this MAC on this port → drop + log.' }, text: 'The switch validates every ARP on untrusted ports against the IP–MAC–port bindings learned by DHCP snooping. The forged reply never reaches the victim, and an alert is raised.', packet: arpPoison, tables: [{ title: 'DHCP snooping binding table', device: 'sw', cols: ['MAC', 'IP', 'Port', 'VLAN'], rows: [[M.pc, '192.168.1.10', 'Fa0/1', 10], [M.atk, '192.168.1.66', 'Fa0/9', 10]] }] },
  { from: 'v', to: 'gw', ok: true, label: 'normal traffic', title: 'Traffic goes to the real gateway', hops: { sw: 'Forwarded to the gateway\'s port.' }, text: 'The victim\'s cache is intact, so frames go straight to the gateway.', packet: { eth: { src: M.pc, dst: M.gw }, ipv4: { src: '192.168.1.10', dst: '203.0.113.80' }, tcp: { sport: 51000, dport: 443, seq: 1, ack: 1, flags: 'ACK' } } },
];

// ------------------------------------------------------------------ DNS spoofing (cache poisoning)
const dnsDev: Device[] = [
  { id: 'v', type: 'pc', label: 'Victim', x: 8, y: 50, ip: '192.168.1.10' },
  { id: 'res', type: 'dns', label: 'Resolver', x: 38, y: 50, ip: '198.51.100.53', info: 'Recursive resolver with a cache shared by many users — poisoning it affects all of them.' },
  { id: 'net', type: 'cloud', label: 'Internet', x: 62, y: 50 },
  { id: 'auth', type: 'dns', label: 'Authoritative NS', x: 90, y: 22, ip: '192.0.2.53', info: 'Authoritative for bank.example.' },
  { id: 'a', type: 'attacker', label: 'Attacker', x: 90, y: 82, ip: '203.0.113.66', info: 'Off-path attacker. Cannot see the resolver\'s query, so must guess its transaction ID and source port.' },
  { id: 'fake', type: 'web', label: 'Fake bank', x: 62, y: 88, ip: '203.0.113.99' },
];
const dnsLinks: Link[] = [{ a: 'v', b: 'res' }, { a: 'res', b: 'net' }, { a: 'net', b: 'auth' }, { a: 'net', b: 'a' }, { a: 'net', b: 'fake' }];
const forged = { ipv4: { src: '192.0.2.53', dst: '198.51.100.53', ttl: 60 }, udp: { sport: 53, dport: 33411 }, app: { kind: 'dns' as const, dns: { id: 0x1f2e, response: true, aa: true, qname: 'www.bank.example', qtype: 'A', answers: [{ name: 'www.bank.example', type: 'A', ttl: 86400, data: '203.0.113.99' }] } } };
const dnsQ: Step[] = [
  { from: 'v', to: 'res', label: 'query', title: 'Victim asks the resolver', text: 'The victim asks for www.bank.example. The resolver has no cached answer.', packet: { ipv4: { src: '192.168.1.10', dst: '198.51.100.53' }, udp: { sport: 55012, dport: 53 }, app: { kind: 'dns', dns: { id: 0x9c01, response: false, qname: 'www.bank.example', qtype: 'A' } } } },
  { from: 'res', to: 'auth', label: 'query', title: 'Resolver queries the authoritative server', hops: { net: 'Routed.' }, text: 'The resolver sends its own query from source port 33411 with ID 0x1f2e. Whoever answers first with a matching ID, port and question wins.', packet: { ipv4: { src: '198.51.100.53', dst: '192.0.2.53' }, udp: { sport: 33411, dport: 53 }, app: { kind: 'dns', dns: { id: 0x1f2e, response: false, rd: false, qname: 'www.bank.example', qtype: 'A' } } } },
];
const dnsSpoof: Step[] = [
  ...dnsQ,
  { from: 'a', to: 'res', danger: true, label: 'forged answers ×1000s', title: 'Attacker races forged responses', hops: { net: 'Spoofed source 192.0.2.53 — looks like the real server.' }, text: 'The attacker floods the resolver with responses spoofed from the authoritative server\'s IP, each guessing a different transaction ID. If the source port is predictable, a 16-bit ID can be guessed quickly. One lands: ID 0x1f2e.', packet: forged },
  { from: 'res', to: 'res', local: true, danger: true, label: 'cache poisoned', title: 'Cache poisoned for 24 hours', text: 'The resolver accepts the forged answer (it arrived first and matched) and caches www.bank.example → 203.0.113.99 with TTL 86400. The genuine answer arriving later is ignored.', tables: [{ title: 'Resolver cache', device: 'res', cols: ['Name', 'Type', 'Value', 'TTL'], rows: [['www.bank.example', 'A', '203.0.113.99 ← forged', '86400']], highlight: 0 }] },
  { from: 'res', to: 'v', danger: true, label: 'A 203.0.113.99', title: 'Victim receives the malicious address', text: 'Every user of this resolver who visits www.bank.example is sent to the attacker\'s server.', packet: { ipv4: { src: '198.51.100.53', dst: '192.168.1.10' }, udp: { sport: 53, dport: 55012 }, app: { kind: 'dns', dns: { id: 0x9c01, response: true, ra: true, qname: 'www.bank.example', qtype: 'A', answers: [{ name: 'www.bank.example', type: 'A', ttl: 86400, data: '203.0.113.99' }] } } } },
  { from: 'v', to: 'fake', danger: true, label: 'SYN :443', title: 'Victim connects to the fake site', hops: { res: 'Routed via the ISP.', net: 'Routed.' }, text: 'With plain HTTP the victim would see a convincing copy. With HTTPS, the fake server cannot present a valid certificate for www.bank.example — which is why TLS remains the last line of defence.', packet: { ipv4: { src: '192.168.1.10', dst: '203.0.113.99' }, tcp: { sport: 51515, dport: 443, seq: 100, flags: 'SYN', mss: 1460 } } },
];
const dnsSafe: Step[] = [
  ...dnsQ,
  { from: 'a', to: 'res', label: 'forged answers', title: 'Forged answers arrive…', hops: { net: 'Spoofed source.' }, text: 'Same attack. But the resolver randomises its source port (≈2^16 × 2^16 combinations) and validates DNSSEC.', packet: forged },
  { from: 'res', to: 'res', local: true, ok: true, label: 'DNSSEC: bogus', title: 'DNSSEC validation fails → discarded', text: 'bank.example is signed. The forged response has no valid RRSIG signature chaining to the root trust anchor, so the resolver marks it bogus and discards it.' },
  { from: 'auth', to: 'res', ok: true, label: 'signed answer', title: 'Genuine signed answer accepted', hops: { net: 'Routed.' }, text: 'The real response validates (RRSIG + DNSKEY + DS chain) and is cached.', packet: { ipv4: { src: '192.0.2.53', dst: '198.51.100.53' }, udp: { sport: 53, dport: 33411 }, app: { kind: 'dns', dns: { id: 0x1f2e, response: true, aa: true, rd: false, qname: 'www.bank.example', qtype: 'A', answers: [{ name: 'www.bank.example', type: 'A', ttl: 300, data: '192.0.2.10' }] } } } },
];

// ------------------------------------------------------------------ IP spoofing
const ipDev: Device[] = [
  { id: 'a', type: 'attacker', label: 'Attacker', x: 8, y: 25, ip: '203.0.113.66' },
  { id: 'isp', type: 'router', label: 'Attacker\'s ISP edge', x: 32, y: 25, info: 'The first router the attacker\'s traffic reaches. Ingress filtering (BCP 38) belongs here.' },
  { id: 'net', type: 'cloud', label: 'Internet', x: 55, y: 50 },
  { id: 'srv', type: 'server', label: 'Target server', x: 90, y: 50, ip: '198.51.100.20', info: 'Trusts 192.0.2.10 by IP address (a weak, legacy practice).' },
  { id: 'tr', type: 'pc', label: 'Trusted host', x: 32, y: 82, ip: '192.0.2.10' },
];
const ipLinks: Link[] = [{ a: 'a', b: 'isp' }, { a: 'isp', b: 'net' }, { a: 'net', b: 'srv' }, { a: 'net', b: 'tr' }];
const spoofed = { ipv4: { src: '192.0.2.10', dst: '198.51.100.20' }, udp: { sport: 4444, dport: 514 }, app: { kind: 'raw' as const, text: '<13>forged log entry from trusted host', name: 'Syslog message' } };
const ipSpoof: Step[] = [
  { from: 'a', to: 'srv', danger: true, label: 'src 192.0.2.10 (forged)', title: 'Attacker forges the source address', hops: { isp: 'No source validation — forwards it.', net: 'Routers only look at the destination.' }, text: 'The attacker writes 192.0.2.10 into the IP source field. Routers forward based on destination only, so the packet reaches the server looking like it came from the trusted host.', packet: spoofed },
  { from: 'srv', to: 'srv', local: true, danger: true, label: 'accepted', title: 'Server trusts the source IP', text: 'A service that authenticates by source IP (old rsh-style trust, IP allow-lists for syslog/SNMP) accepts the forged message.' },
  { from: 'srv', to: 'tr', label: 'reply → real host', title: 'Replies go to the real owner of the IP', hops: { net: 'Routed to 192.0.2.10.' }, text: 'Any response goes to 192.0.2.10, not the attacker. That makes spoofing "blind" — ideal for one-way attacks, reflection/amplification DDoS, and SYN floods, but hard for full TCP sessions (random ISNs).', packet: { ipv4: { src: '198.51.100.20', dst: '192.0.2.10' }, icmp: { type: 3, code: 3 } } },
];
const ipSafe: Step[] = [
  { from: 'a', to: 'srv', dropAt: 'isp', ok: true, label: 'src 192.0.2.10 (forged)', title: 'Ingress filtering drops it at the edge', hops: { isp: 'BCP 38 / uRPF: source 192.0.2.10 is not a prefix assigned to this customer port → drop.' }, text: 'The ISP only accepts packets whose source addresses belong to the customer. Unicast Reverse Path Forwarding (uRPF) automates the check using the routing table.', packet: spoofed },
  { from: 'srv', to: 'srv', local: true, ok: true, label: 'auth by crypto', title: 'Defence in depth on the server', text: 'Even if a spoofed packet arrived, authenticating with cryptography (TLS client certificates, SSH keys, signed syslog) instead of source IP makes it useless.' },
];

// ------------------------------------------------------------------ SYN flood
const synDev: Device[] = [
  { id: 'a', type: 'attacker', label: 'Botnet', x: 10, y: 22, info: 'Many compromised machines, often spoofing random source addresses.' },
  { id: 'u', type: 'pc', label: 'Legit user', x: 10, y: 80, ip: '192.0.2.44' },
  { id: 'net', type: 'cloud', label: 'Internet', x: 45, y: 50 },
  { id: 'fw', type: 'firewall', label: 'Edge firewall', x: 68, y: 50 },
  { id: 'srv', type: 'web', label: 'Web server', x: 90, y: 50, ip: '198.51.100.80', info: 'SYN backlog of 128 half-open connections.' },
];
const synLinks: Link[] = [{ a: 'a', b: 'net' }, { a: 'u', b: 'net' }, { a: 'net', b: 'fw' }, { a: 'fw', b: 'srv' }];
const synPkt = (src: string, sport: number, seq: number) => ({ ipv4: { src, dst: '198.51.100.80', ttl: 50 }, tcp: { sport, dport: 443, seq, flags: 'SYN', win: 1024 } });
const backlog = (n: number) => [{ title: 'Server SYN backlog (half-open)', device: 'srv', cols: ['Used', 'Capacity', 'State'], rows: [[n, 128, n >= 128 ? 'FULL — new SYNs dropped' : 'ok']], highlight: 0 }];
const synFlood: Step[] = [
  { from: 'a', to: 'srv', danger: true, label: 'SYN ×10 000/s', title: 'Flood of SYNs with spoofed sources', hops: { net: 'Routed.', fw: 'Stateless rule "allow tcp/443" lets them through.' }, text: 'Each SYN makes the server allocate a half-open connection (TCB) and send a SYN-ACK. Sources are random spoofed addresses, so the final ACK never comes.', packet: synPkt('192.0.2.201', 31337, 1111) },
  { from: 'srv', to: 'net', danger: true, label: 'SYN-ACK → nowhere', title: 'SYN-ACKs go to spoofed addresses', text: 'The server retransmits SYN-ACKs several times before giving up (often ~60 s). Entries pile up.', packet: { ipv4: { src: '198.51.100.80', dst: '192.0.2.201' }, tcp: { sport: 443, dport: 31337, seq: 77, ack: 1112, flags: 'SYN,ACK' } }, tables: backlog(128) },
  { from: 'u', to: 'srv', dropAt: 'srv', danger: true, label: 'SYN', title: 'Legitimate user is refused', hops: { net: 'Routed.', fw: 'Allowed.' }, text: 'The backlog is full; the real user\'s SYN is dropped. The service is down for users even though bandwidth and CPU are fine — this is resource-exhaustion denial of service.', packet: synPkt('192.0.2.44', 50211, 900000) },
];
const synSafe: Step[] = [
  { from: 'a', to: 'srv', label: 'SYN ×10 000/s', title: 'Flood arrives…', hops: { net: 'Routed.', fw: 'Per-source SYN rate limits trim the flood.' }, text: 'Same flood. But the server has SYN cookies enabled.', packet: synPkt('192.0.2.201', 31337, 1111) },
  { from: 'srv', to: 'net', ok: true, label: 'SYN-ACK (cookie)', title: 'SYN cookies: no state stored', text: 'When the backlog fills, the server encodes the connection details (and a secret-keyed hash) into its ISN — the "cookie" — and stores nothing. Spoofed SYNs cost it almost no memory.', packet: { ipv4: { src: '198.51.100.80', dst: '192.0.2.201' }, tcp: { sport: 443, dport: 31337, seq: 0x5f3a91c2, ack: 1112, flags: 'SYN,ACK' } }, tables: backlog(0) },
  { from: 'u', to: 'srv', ok: true, label: 'SYN … ACK', title: 'Real users complete the handshake', hops: { net: 'Routed.', fw: 'Allowed.' }, text: 'A real client returns the final ACK with Ack = cookie + 1. The server validates the cookie, rebuilds the connection state and continues normally. Large DDoS also needs upstream scrubbing / anycast CDNs.', packet: { ipv4: { src: '192.0.2.44', dst: '198.51.100.80' }, tcp: { sport: 50211, dport: 443, seq: 900001, ack: 0x5f3a91c3, flags: 'ACK' } } },
];

// ------------------------------------------------------------------ MITM (evil twin Wi-Fi)
const mitmDev: Device[] = [
  { id: 'v', type: 'phone', label: 'Victim phone', x: 8, y: 50, ip: '10.0.0.23' },
  { id: 'ap', type: 'attacker', label: 'Evil-twin AP "CafeWiFi"', x: 34, y: 50, ip: '10.0.0.1', info: 'A laptop broadcasting the same SSID as the café, with a stronger signal. Acts as the victim\'s router, DNS and gateway.' },
  { id: 'real', type: 'ap', label: 'Real café AP', x: 34, y: 88 },
  { id: 'net', type: 'cloud', label: 'Internet', x: 62, y: 50 },
  { id: 'ws', type: 'web', label: 'mail.example.com', x: 92, y: 50, ip: '203.0.113.25' },
];
const mitmLinks: Link[] = [{ a: 'v', b: 'ap', wireless: true }, { a: 'ap', b: 'net' }, { a: 'real', b: 'net' }, { a: 'net', b: 'ws' }];
const mitm: Step[] = [
  { from: 'v', to: 'ap', danger: true, label: 'associate', title: 'Victim joins the evil twin', text: 'Phones auto-join known open SSIDs. The attacker now sits in the path of every packet, as gateway and DNS server.', packet: { ipv4: { src: '10.0.0.23', dst: '10.0.0.1' }, udp: { sport: 53001, dport: 53 }, app: { kind: 'dns', dns: { id: 0x2201, response: false, qname: 'mail.example.com', qtype: 'A' } } } },
  { from: 'v', to: 'ap', danger: true, label: 'HTTP login', title: 'Login over plain HTTP is intercepted', text: 'If the site (or a first request before redirect) uses HTTP, the attacker reads and can modify everything, including credentials. SSL-stripping tools rewrite https:// links to http:// to keep victims on plain HTTP.', packet: { ipv4: { src: '10.0.0.23', dst: '203.0.113.25' }, tcp: { sport: 50800, dport: 80, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'http', text: 'POST /login HTTP/1.1\nHost: mail.example.com\nContent-Type: application/x-www-form-urlencoded\n\nuser=bob&pass=hunter2' } } },
  { from: 'ap', to: 'ws', danger: true, label: 'relayed', title: 'Relayed to the real server', hops: { net: 'Routed.' }, text: 'The attacker forwards the request so the login succeeds and the victim suspects nothing.', packet: { ipv4: { src: '198.51.100.7', dst: '203.0.113.25' }, tcp: { sport: 41000, dport: 80, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'http', text: 'POST /login HTTP/1.1\nHost: mail.example.com\nContent-Type: application/x-www-form-urlencoded\n\nuser=bob&pass=hunter2' } } },
];
const mitmSafe: Step[] = [
  mitm[0],
  { from: 'v', to: 'ap', ok: true, label: 'ClientHello', title: 'HSTS forces HTTPS', text: 'mail.example.com is on the browser\'s HSTS preload list, so the browser never sends HTTP. It starts TLS directly.', packet: { ipv4: { src: '10.0.0.23', dst: '203.0.113.25' }, tcp: { sport: 50800, dport: 443, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'tls', records: [{ kind: 'ClientHello', sni: 'mail.example.com', seed: 61 }] } } },
  { from: 'ap', to: 'v', label: 'fake cert', title: 'Attacker presents its own certificate', text: 'To read the traffic the attacker must terminate TLS with a certificate for mail.example.com. It cannot obtain one signed by a trusted CA.', packet: { ipv4: { src: '203.0.113.25', dst: '10.0.0.23' }, tcp: { sport: 443, dport: 50800, seq: 1, ack: 300, flags: 'PSH,ACK' }, app: { kind: 'tls', records: [{ kind: 'ServerHello', seed: 62 }, { kind: 'Encrypted', len: 380, seed: 63, note: 'self-signed Certificate' }] } } },
  { from: 'v', to: 'ap', ok: true, label: 'Alert: bad_certificate', title: 'Browser aborts the connection', text: 'Certificate validation fails; with HSTS the browser offers no "proceed anyway" button. Credentials are never sent. Using a VPN on public Wi-Fi adds another layer.', packet: { ipv4: { src: '10.0.0.23', dst: '203.0.113.25' }, tcp: { sport: 50800, dport: 443, seq: 300, ack: 500, flags: 'PSH,ACK' }, app: { kind: 'tls', records: [{ kind: 'Alert' }] } } },
];

// ------------------------------------------------------------------ Packet sniffing
const snDev: Device[] = [
  { id: 'v', type: 'pc', label: 'Employee PC', x: 8, y: 30, ip: '10.1.1.20' },
  { id: 'hub', type: 'ap', label: 'Open Wi-Fi / hub', x: 40, y: 50, info: 'A shared medium (open Wi-Fi, legacy hub, or a mirrored switch port): every station can receive every frame.' },
  { id: 'a', type: 'attacker', label: 'Sniffer (promiscuous)', x: 8, y: 82, info: 'Network card in promiscuous/monitor mode running a capture tool.' },
  { id: 'ftp', type: 'server', label: 'FTP server', x: 88, y: 50, ip: '10.1.1.5' },
];
const snLinks: Link[] = [{ a: 'v', b: 'hub', wireless: true }, { a: 'a', b: 'hub', wireless: true }, { a: 'hub', b: 'ftp' }];
const sniff: Step[] = [
  { from: 'v', to: ['ftp', 'a'], danger: true, label: 'USER alice', title: 'FTP sends the user name in clear text', hops: { hub: 'Shared medium: every station receives the frame.' }, text: 'FTP (port 21) predates encryption. The sniffer\'s NIC accepts frames not addressed to it and records them.', packet: { ipv4: { src: '10.1.1.20', dst: '10.1.1.5' }, tcp: { sport: 50321, dport: 21, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'raw', text: 'USER alice\r\n', name: 'FTP command' } } },
  { from: 'v', to: ['ftp', 'a'], danger: true, label: 'PASS …', title: 'And the password', hops: { hub: 'Received by everyone.' }, text: 'The password travels as readable ASCII. Telnet, HTTP, POP3, IMAP and SMTP without TLS have the same weakness.', packet: { ipv4: { src: '10.1.1.20', dst: '10.1.1.5' }, tcp: { sport: 50321, dport: 21, seq: 13, ack: 40, flags: 'PSH,ACK' }, app: { kind: 'raw', text: 'PASS Tr0ub4dor&3\r\n', name: 'FTP command' } }, tables: [{ title: 'Sniffer capture log', device: 'a', cols: ['Proto', 'Data'], rows: [['FTP', 'USER alice'], ['FTP', 'PASS Tr0ub4dor&3']], highlight: 1 }] },
];
const sniffSafe: Step[] = [
  { from: 'v', to: ['ftp', 'a'], ok: true, label: 'SSH/SFTP (encrypted)', title: 'SFTP over SSH: the sniffer sees ciphertext', hops: { hub: 'Still received by everyone — but unreadable.' }, text: 'Replacing FTP with SFTP (SSH, port 22) or FTPS encrypts credentials and data. The sniffer captures only random-looking bytes. Switched networks, WPA3 and 802.1X also reduce who can capture traffic.', packet: { ipv4: { src: '10.1.1.20', dst: '10.1.1.5' }, tcp: { sport: 50321, dport: 22, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'raw', text: '×§ñ\u0082\u0013\u0099Ãî\u0004¾ú\u0011¬Ò\u0007\u008bða', name: 'SSH encrypted packet' } }, tables: [{ title: 'Sniffer capture log', device: 'a', cols: ['Proto', 'Data'], rows: [['SSH', 'encrypted (unreadable)']] }] },
];

// ------------------------------------------------------------------ Session hijacking
const shDev: Device[] = [
  { id: 'v', type: 'laptop', label: 'Victim', x: 8, y: 30, ip: '10.0.0.23' },
  { id: 'ap', type: 'ap', label: 'Shared Wi-Fi', x: 34, y: 50 },
  { id: 'a', type: 'attacker', label: 'Attacker', x: 8, y: 82, ip: '10.0.0.66' },
  { id: 'net', type: 'cloud', label: 'Internet', x: 62, y: 50 },
  { id: 'ws', type: 'web', label: 'shop.example', x: 92, y: 50, ip: '203.0.113.30' },
];
const shLinks: Link[] = [{ a: 'v', b: 'ap', wireless: true }, { a: 'a', b: 'ap', wireless: true }, { a: 'ap', b: 'net' }, { a: 'net', b: 'ws' }];
const sessHijack: Step[] = [
  { from: 'v', to: ['ws', 'a'], danger: true, label: 'Cookie: session=…', title: 'Logged-in request leaks the session cookie', hops: { ap: 'Open network — the attacker receives a copy.', net: 'Routed.' }, text: 'After logging in, every request carries the session cookie. Over plain HTTP it is visible to anyone on the network.', packet: { ipv4: { src: '10.0.0.23', dst: '203.0.113.30' }, tcp: { sport: 50900, dport: 80, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'http', text: 'GET /orders HTTP/1.1\nHost: shop.example\nCookie: session=4b9f2e17c0a8\n' } } },
  { from: 'a', to: 'ws', danger: true, label: 'replayed cookie', title: 'Attacker replays the cookie', hops: { ap: 'Forwarded.', net: 'Routed.' }, text: 'The attacker sends their own request with the stolen cookie. The server only checks the cookie, so it treats the attacker as the victim — no password needed.', packet: { ipv4: { src: '10.0.0.66', dst: '203.0.113.30' }, tcp: { sport: 41500, dport: 80, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'http', text: 'GET /account/address HTTP/1.1\nHost: shop.example\nCookie: session=4b9f2e17c0a8\n' } } },
  { from: 'ws', to: 'a', danger: true, label: '200 OK', title: 'Server serves the victim\'s account', hops: { net: 'Routed.', ap: 'Delivered.' }, text: 'Session hijacked. The same outcome follows if the cookie is stolen by XSS (no HttpOnly) or guessed (predictable IDs).', packet: { ipv4: { src: '203.0.113.30', dst: '10.0.0.66' }, tcp: { sport: 80, dport: 41500, seq: 1, ack: 80, flags: 'PSH,ACK' }, app: { kind: 'http', text: 'HTTP/1.1 200 OK\nContent-Type: text/html\n\n<h1>Your saved addresses</h1>' } } },
];
const sessSafe: Step[] = [
  { from: 'ws', to: 'v', ok: true, label: 'Set-Cookie: Secure; HttpOnly', title: 'Cookie issued with protections', hops: { net: 'Routed.', ap: 'Delivered (encrypted).' }, text: 'Over HTTPS the server sets Secure (never sent over HTTP), HttpOnly (not readable by JavaScript) and SameSite (not sent on cross-site requests). The session ID is long and random.', packet: { ipv4: { src: '203.0.113.30', dst: '10.0.0.23' }, tcp: { sport: 443, dport: 50900, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'tls', records: [{ kind: 'Encrypted', len: 210, seed: 71, note: 'Set-Cookie: session=…; Secure; HttpOnly; SameSite=Lax' }] } } },
  { from: 'v', to: ['ws', 'a'], ok: true, label: 'encrypted request', title: 'The cookie never appears in clear text', hops: { ap: 'Attacker gets only ciphertext.', net: 'Routed.' }, text: 'All requests are inside TLS. The attacker has nothing to replay. Servers also rotate the session ID at login, expire idle sessions and can re-authenticate for sensitive actions.', packet: { ipv4: { src: '10.0.0.23', dst: '203.0.113.30' }, tcp: { sport: 50900, dport: 443, seq: 1, ack: 1, flags: 'PSH,ACK' }, app: { kind: 'tls', records: [{ kind: 'Encrypted', len: 150, seed: 72, note: 'GET /orders + Cookie (encrypted)' }] } } },
];

// ------------------------------------------------------------------ DHCP starvation
const dsDev: Device[] = [
  { id: 'a', type: 'attacker', label: 'Attacker', x: 10, y: 22, info: 'Runs a tool that sends DHCP Discovers with thousands of random source MACs.' },
  { id: 'v', type: 'laptop', label: 'New employee', x: 10, y: 80 },
  { id: 'sw', type: 'switch', label: 'Access switch', x: 45, y: 50 },
  { id: 'dhcp', type: 'dhcp', label: 'DHCP server', x: 85, y: 50, ip: '192.168.1.5', info: 'Pool of 100 addresses: 192.168.1.100–199.' },
];
const dsLinks: Link[] = [{ a: 'a', b: 'sw' }, { a: 'v', b: 'sw' }, { a: 'sw', b: 'dhcp' }];
const randDiscover = { eth: { src: '02:9e:41:d0:7a:3c', dst: M.bc }, ipv4: { src: '0.0.0.0', dst: '255.255.255.255', df: false }, udp: { sport: 68, dport: 67 }, app: { kind: 'dhcp' as const, dhcp: { op: 1 as const, msg: 'DISCOVER' as const, xid: 0x0badf00d, chaddr: '02:9e:41:d0:7a:3c', broadcast: true } } };
const pool = (used: number) => [{ title: 'DHCP pool', device: 'dhcp', cols: ['Leased', 'Free', 'Status'], rows: [[used, 100 - used, used >= 100 ? 'EXHAUSTED' : 'ok']], highlight: 0 }];
const dhcpStarve: Step[] = [
  { from: 'a', to: 'dhcp', danger: true, label: 'DISCOVER ×1000 (random MACs)', title: 'Flood of Discovers from fake MACs', hops: { sw: 'Learns thousands of MACs on one port and forwards them all.' }, text: 'Each Discover uses a different random (locally administered) MAC, so the server thinks each is a new client and reserves an address for it.', packet: randDiscover, tables: pool(100) },
  { from: 'v', to: 'dhcp', danger: true, label: 'DISCOVER', title: 'Real client gets no address', hops: { sw: 'Forwarded.' }, text: 'The pool is empty. The new employee\'s laptop gets no offer and falls back to a 169.254.x.x link-local address — no network access.', packet: { ...randDiscover, eth: { src: M.pc, dst: M.bc }, app: { kind: 'dhcp', dhcp: { op: 1, msg: 'DISCOVER', xid: 0x1234abcd, chaddr: M.pc, broadcast: true } } } },
  { from: 'a', to: 'v', danger: true, label: 'rogue OFFER', title: 'Follow-up: rogue DHCP server', hops: { sw: 'Forwarded — any port may send Offers.' }, text: 'Now the attacker answers with its own Offer, naming itself as gateway and DNS server — a stepping stone to man-in-the-middle.', packet: { eth: { src: M.atk, dst: M.bc }, ipv4: { src: '192.168.1.66', dst: '255.255.255.255', df: false }, udp: { sport: 67, dport: 68 }, app: { kind: 'dhcp', dhcp: { op: 2, msg: 'OFFER', xid: 0x1234abcd, chaddr: M.pc, yiaddr: '192.168.1.240', broadcast: true, server: '192.168.1.66', lease: 86400, mask: '255.255.255.0', router: '192.168.1.66', dns: ['192.168.1.66'] } } } },
];
const dhcpStarveSafe: Step[] = [
  { from: 'a', to: 'dhcp', dropAt: 'sw', ok: true, label: 'DISCOVER (random MACs)', title: 'Port security + DHCP snooping stop the flood', hops: { sw: 'Port security: max 2 MACs on this port → violation, port err-disabled. DHCP snooping rate-limits DHCP to 10 pps on untrusted ports and checks chaddr = source MAC.' }, text: 'The access switch limits how many MAC addresses a port may learn and how fast it may send DHCP. The flood is cut off after the first few frames.', packet: randDiscover, tables: pool(1) },
  { from: 'a', to: 'v', dropAt: 'sw', ok: true, label: 'rogue OFFER', title: 'Rogue server blocked', hops: { sw: 'DHCP snooping: Offers/ACKs are only accepted from trusted ports (the uplink to the real server).' }, text: 'Server messages from an untrusted access port are dropped.', packet: dhcpStarve[2].packet },
  { from: 'v', to: 'dhcp', ok: true, label: 'DISCOVER', title: 'Real client is served normally', hops: { sw: 'Forwarded to the trusted port.' }, text: 'The pool still has free addresses; the employee gets 192.168.1.101.', packet: dhcpStarve[1].packet },
];

// ------------------------------------------------------------------ VLAN hopping (double tagging)
const vhDev: Device[] = [
  { id: 'a', type: 'attacker', label: 'Attacker (VLAN 1 native)', x: 8, y: 30, ip: '10.1.0.66', info: 'Plugged into an access port in VLAN 1, which is also the trunk\'s native VLAN.' },
  { id: 's1', type: 'switch', label: 'SW1', x: 36, y: 50, info: 'Trunk to SW2: native VLAN 1 (untagged), allowed VLANs 1,10,20.' },
  { id: 's2', type: 'switch', label: 'SW2', x: 66, y: 50 },
  { id: 'v', type: 'server', label: 'HR server (VLAN 20)', x: 92, y: 30, ip: '10.20.0.10' },
  { id: 'u', type: 'pc', label: 'User (VLAN 10)', x: 92, y: 80 },
];
const vhLinks: Link[] = [{ a: 'a', b: 's1' }, { a: 's1', b: 's2', label: '802.1Q trunk' }, { a: 's2', b: 'v' }, { a: 's2', b: 'u' }];
const dbl = { eth: { src: M.atk, dst: M.srv, vlan: [1, 20] }, ipv4: { src: '10.1.0.66', dst: '10.20.0.10' }, udp: { sport: 5555, dport: 161 }, app: { kind: 'raw' as const, text: 'snmp-get sysDescr', name: 'Payload' } };
const vlanHop: Step[] = [
  { from: 'a', to: 's1', danger: true, label: 'tags [1][20]', title: 'Attacker sends a double-tagged frame', text: 'The frame carries two 802.1Q tags: outer VLAN 1 (the native VLAN) and inner VLAN 20 (the target).', packet: dbl },
  { from: 's1', to: 's2', danger: true, label: 'tag [20]', title: 'SW1 strips the outer tag', text: 'SW1 sees outer tag 1 = native VLAN, so it removes it and sends the frame untagged on the trunk… but the inner tag 20 is still there. To SW2 it looks like a normal VLAN 20 frame.', packet: { ...dbl, eth: { ...dbl.eth, vlan: [20] } } },
  { from: 's2', to: 'v', danger: true, label: 'delivered to VLAN 20', title: 'SW2 delivers into VLAN 20', text: 'SW2 removes tag 20 and forwards to the HR server. The attacker crossed a VLAN boundary without a router. It is one-way (replies cannot come back the same way), but enough for some attacks.', packet: { ...dbl, eth: { src: M.atk, dst: M.srv } } },
];
const vlanSafe: Step[] = [
  { from: 'a', to: 's1', dropAt: 's1', ok: true, label: 'tags [999?]', title: 'Native VLAN is unused and tagged', hops: { s1: 'Access port is in VLAN 30 and the trunk native VLAN is 999 (unused, also tagged with "vlan dot1q tag native"). The outer tag no longer matches the native VLAN and tagged frames on an access port are discarded.' }, text: 'Best practice: never put users in the native VLAN, set the native VLAN to an unused ID, tag it explicitly, disable DTP (switchport nonegotiate) and shut down unused ports.', packet: { ...dbl, eth: { ...dbl.eth, vlan: [30, 20] } } },
];

// ------------------------------------------------------------------ DNS amplification
const ampDev: Device[] = [
  { id: 'a', type: 'attacker', label: 'Attacker', x: 8, y: 22 },
  { id: 'isp', type: 'router', label: 'Attacker ISP', x: 28, y: 22 },
  { id: 'net', type: 'cloud', label: 'Internet', x: 50, y: 50 },
  { id: 'r1', type: 'dns', label: 'Open resolver', x: 76, y: 20, ip: '192.0.2.53', info: 'Misconfigured: answers recursive queries from anyone on the Internet.' },
  { id: 'v', type: 'web', label: 'Victim', x: 76, y: 82, ip: '198.51.100.200' },
];
const ampLinks: Link[] = [{ a: 'a', b: 'isp' }, { a: 'isp', b: 'net' }, { a: 'net', b: 'r1' }, { a: 'net', b: 'v' }];
const ampQ = { ipv4: { src: '198.51.100.200', dst: '192.0.2.53' }, udp: { sport: 3333, dport: 53 }, app: { kind: 'dns' as const, dns: { id: 0x0d0d, response: false, qname: 'big.example', qtype: 'TXT' } } };
const bigTxt = 'v=spf1 include:_spf.big.example ' + 'x'.repeat(200);
const ampSteps: Step[] = [
  { from: 'a', to: 'r1', danger: true, label: 'small query, src = victim', title: 'Small query with the victim\'s address', hops: { isp: 'No ingress filtering.', net: 'Routed.' }, text: 'The attacker sends a tiny DNS query (~40 bytes of DNS) whose source IP is forged to be the victim\'s. It asks for a record known to be large.', packet: ampQ },
  { from: 'r1', to: 'v', danger: true, label: 'large response ×50', title: 'Large response hits the victim', hops: { net: 'Routed to the victim.' }, text: 'The resolver sends its big answer to the victim. With EDNS0 and records like ANY/TXT/DNSKEY, responses can be 30–50× the query size. Thousands of resolvers × a botnet = hundreds of Gbit/s of traffic the victim never asked for.', packet: { ipv4: { src: '192.0.2.53', dst: '198.51.100.200' }, udp: { sport: 53, dport: 3333 }, app: { kind: 'dns', dns: { id: 0x0d0d, response: true, ra: true, qname: 'big.example', qtype: 'TXT', answers: [{ name: 'big.example', type: 'TXT', ttl: 300, data: bigTxt }] } } }, tables: [{ title: 'Amplification', cols: ['Query (bytes on wire)', 'Response', 'Factor'], rows: [['~71', '~320 (up to 4000 with EDNS0)', '×4 – ×50']] }] },
];
const ampSafe: Step[] = [
  { from: 'a', to: 'r1', dropAt: 'isp', ok: true, label: 'spoofed query', title: 'BCP 38 at the source network', hops: { isp: 'Source 198.51.100.200 is not this customer\'s prefix → drop.' }, text: 'If every network filtered spoofed sources, reflection attacks would be impossible.', packet: ampQ },
  { from: 'a', to: 'r1', ok: true, label: 'query', title: 'Closed resolver + rate limiting', hops: { isp: 'Forwarded.', net: 'Routed.' }, text: 'Even if a spoofed query arrives, the resolver only serves its own clients (ACL) and authoritative servers apply Response Rate Limiting. Victims also use upstream DDoS scrubbing.', packet: ampQ },
  { from: 'r1', to: 'r1', local: true, ok: true, label: 'REFUSED', title: 'Query refused', text: 'The resolver returns REFUSED (small) or drops the query: no amplification.' },
];

const A = (id: string, title: string, summary: string, protocols: string[], devices: Device[], links: Link[], steps: Step[], mitigatedSteps: Step[], mitigationLabel: string, attack: Scenario['attack']): Scenario =>
  ({ id, kind: 'attack', title, short: '', summary, protocols, devices, links, steps, mitigatedSteps, mitigationLabel, attack });

export const attacks: Scenario[] = [
  A('arp-spoofing', 'ARP spoofing', 'Forged ARP replies redirect a victim\'s traffic through the attacker.', ['arp', 'ethernet'], lan(), lanLinks, arpSpoof, arpSpoofSafe, 'Dynamic ARP Inspection', {
    explain: 'ARP lets anyone on a LAN claim any IP address. By repeatedly sending forged replies, an attacker associates the gateway\'s IP with its own MAC in the victim\'s cache (and vice-versa), placing itself in the middle of the conversation.',
    vulnerabilities: ['ARP has no authentication', 'Hosts accept unsolicited (gratuitous) replies', 'Flat networks where untrusted devices share a VLAN with critical hosts'],
    detection: ['IP-to-MAC mapping for the gateway suddenly changes (arpwatch, XArp, IDS alerts)', 'Two IPs mapped to the same MAC in ARP tables', 'Excessive gratuitous ARP traffic', 'Duplicate IP warnings from the OS'],
    mitigation: ['Dynamic ARP Inspection (DAI) with DHCP snooping on access switches', 'Static ARP entries for critical hosts (small networks)', 'Encrypt traffic end-to-end (TLS, SSH, VPN) so interception gains little', 'Network segmentation and 802.1X port authentication'],
  }),
  A('dns-spoofing', 'DNS spoofing / cache poisoning', 'Forged DNS answers send users of a resolver to an attacker\'s server.', ['dns', 'udp'], dnsDev, dnsLinks, dnsSpoof, dnsSafe, 'DNSSEC + port randomisation', {
    explain: 'DNS over UDP accepts the first matching response. An attacker who can guess the transaction ID and source port of a resolver\'s outgoing query can inject a forged answer, which is then cached and served to every client (the 2008 Kaminsky attack made this practical).',
    vulnerabilities: ['16-bit transaction ID', 'Predictable source ports on old resolvers', 'No authentication of DNS data without DNSSEC', 'Long TTLs extend the impact'],
    detection: ['Many responses with mismatched IDs arriving at the resolver', 'Unexpected changes in resolved IPs for important domains', 'DNSSEC validation failures (bogus) in resolver logs', 'Certificate errors reported by users'],
    mitigation: ['DNSSEC signing and validation', 'Source port + ID randomisation (and 0x20 case randomisation)', 'DNS over TLS/HTTPS between client and resolver', 'HTTPS everywhere so a wrong IP cannot present a valid certificate'],
  }),
  A('ip-spoofing', 'IP spoofing', 'Packets with a forged source address bypass IP-based trust.', ['ipv4'], ipDev, ipLinks, ipSpoof, ipSafe, 'BCP 38 ingress filtering', {
    explain: 'The IPv4 source field is just a value the sender writes. Routers forward on destination only, so forged-source packets are delivered. Responses go to the real owner of the address, so spoofing is mostly used for one-way attacks and reflection DDoS.',
    vulnerabilities: ['No source validation in IP itself', 'Networks that do not implement ingress/egress filtering', 'Services that authenticate by source IP'],
    detection: ['Packets from your own prefixes arriving on the Internet interface', 'Backscatter (unexpected SYN-ACKs/ICMP errors) at the spoofed host', 'TTL values inconsistent with the claimed source'],
    mitigation: ['BCP 38 / BCP 84 ingress filtering and uRPF', 'Anti-spoofing ACLs at the network edge (bogons, own prefixes inbound)', 'Cryptographic authentication instead of IP trust (TLS, IPsec, SSH)'],
  }),
  A('syn-flood', 'SYN flood', 'Half-open connections exhaust a server\'s connection backlog.', ['tcp', 'tcp-handshake'], synDev, synLinks, synFlood, synSafe, 'SYN cookies', {
    explain: 'Each SYN creates server state that waits for an ACK that never arrives. With enough spoofed SYNs per second, the backlog stays full and legitimate connections are refused.',
    vulnerabilities: ['Server allocates state before the client proves reachability', 'Limited backlog size', 'Spoofable sources make blocking by IP useless'],
    detection: ['Many connections stuck in SYN_RECV (netstat/ss)', 'High ratio of SYNs to completed handshakes', 'Sudden increase in SYN traffic from diverse sources'],
    mitigation: ['SYN cookies (stateless handshake)', 'SYN proxying on firewalls/load balancers', 'Rate limiting and larger backlogs', 'Upstream DDoS scrubbing / anycast CDN'],
  }),
  A('mitm', 'Man-in-the-middle (evil twin)', 'A rogue Wi-Fi access point intercepts and relays a victim\'s traffic.', ['http', 'https', 'tls', 'dns'], mitmDev, mitmLinks, mitm, mitmSafe, 'HTTPS + HSTS', {
    explain: 'The attacker places themselves between client and server — here by impersonating a Wi-Fi network — so all traffic passes through them. Plain-text protocols can be read and altered; encrypted ones can only be attacked by tricking the user into accepting a bad certificate.',
    vulnerabilities: ['Devices auto-joining open SSIDs', 'Unencrypted protocols (HTTP, FTP, Telnet)', 'Users clicking through certificate warnings', 'Sites without HSTS (SSL stripping)'],
    detection: ['Duplicate SSIDs with different BSSIDs (wireless IDS)', 'Unexpected certificate warnings', 'Gateway/DNS settings that differ from the known network'],
    mitigation: ['HTTPS everywhere with HSTS preload', 'WPA3-Enterprise / 802.1X with server certificate validation', 'VPN on untrusted networks', 'Certificate pinning in mobile apps'],
  }),
  A('packet-sniffing', 'Packet sniffing', 'Capturing clear-text credentials from a shared network.', ['ftp', 'tcp', 'ssh'], snDev, snLinks, sniff, sniffSafe, 'Encryption (SFTP/SSH)', {
    explain: 'Any device that can receive frames (shared Wi-Fi, hubs, mirrored ports, a compromised switch) can record them. Protocols that send credentials or data in clear text expose them to the sniffer. Sniffing itself is also a legitimate troubleshooting technique — authorisation is what separates the two.',
    vulnerabilities: ['Clear-text protocols: FTP, Telnet, HTTP, POP3/IMAP/SMTP without TLS, SNMPv1/v2c', 'Shared media and open Wi-Fi', 'Unprotected SPAN ports'],
    detection: ['Hard to detect passively; look for NICs in promiscuous mode, unexpected SPAN sessions', 'ARP spoofing alerts (active sniffing on switched networks)'],
    mitigation: ['Replace clear-text protocols with encrypted ones (SFTP/SSH, HTTPS, IMAPS, SNMPv3)', 'WPA2/WPA3 encryption; avoid open networks', 'Switched networks with DAI and port security', 'VPNs for remote access'],
  }),
  A('session-hijacking', 'Session hijacking', 'A stolen session cookie lets an attacker impersonate a logged-in user.', ['http', 'https', 'tcp'], shDev, shLinks, sessHijack, sessSafe, 'Secure cookies over HTTPS', {
    explain: 'HTTP is stateless, so after login a session ID (usually a cookie) proves who you are. Whoever presents that ID is treated as you. It can be stolen by sniffing HTTP, by cross-site scripting, or predicted if poorly generated. (Classic TCP session hijacking by sequence-number prediction is largely defeated by random ISNs.)',
    vulnerabilities: ['Session cookies sent over HTTP', 'Cookies without HttpOnly (XSS theft)', 'Predictable or long-lived session IDs', 'No session rotation at login (session fixation)'],
    detection: ['Same session used from different IPs/user agents/geographies simultaneously', 'Impossible-travel alerts', 'Anomalous activity after login'],
    mitigation: ['HTTPS everywhere; Secure, HttpOnly, SameSite cookies', 'Long random session IDs, rotation on login, idle/absolute timeouts', 'Re-authentication for sensitive actions; MFA', 'Bind sessions to device signals where appropriate'],
  }),
  A('dhcp-starvation', 'DHCP starvation', 'Fake clients exhaust the address pool, enabling a rogue DHCP server.', ['dhcp', 'udp'], dsDev, dsLinks, dhcpStarve, dhcpStarveSafe, 'Port security + DHCP snooping', {
    explain: 'The attacker requests addresses for thousands of fake MACs until the pool is empty (denial of service), then often runs a rogue DHCP server that hands out the attacker\'s IP as gateway and DNS.',
    vulnerabilities: ['DHCP does not authenticate clients or servers', 'Unlimited MAC addresses per switch port', 'Any port allowed to send DHCP server messages'],
    detection: ['Pool utilisation suddenly hits 100%', 'Many leases with random/locally-administered MACs', 'DHCP Offers from unexpected servers', 'Switch MAC table growth on a single port'],
    mitigation: ['DHCP snooping (trusted ports only for server messages, rate limits)', 'Port security (max MACs per port)', '802.1X authentication', 'Monitoring of DHCP pools'],
  }),
  A('vlan-hopping', 'VLAN hopping (double tagging)', 'A double-tagged frame crosses into another VLAN via the native VLAN.', ['vlan', 'ethernet', 'stp'], vhDev, vhLinks, vlanHop, vlanSafe, 'Unused, tagged native VLAN', {
    explain: 'On 802.1Q trunks the native VLAN is sent untagged. An attacker in the native VLAN can add two tags: the first switch strips the outer (native) tag and forwards the frame across the trunk, where the next switch reads the inner tag and delivers it into the target VLAN. Another variant, switch spoofing, abuses DTP to negotiate a trunk.',
    vulnerabilities: ['User ports in the same VLAN as the trunk native VLAN', 'Native VLAN not tagged', 'DTP auto-negotiation left enabled'],
    detection: ['Frames with multiple 802.1Q tags arriving on access ports', 'Unexpected trunk negotiation (DTP) on access ports', 'Traffic in a VLAN from MACs learned elsewhere'],
    mitigation: ['Set the native VLAN to an unused ID and tag it', 'Never assign users to VLAN 1 / the native VLAN', 'Disable DTP (switchport mode access / nonegotiate)', 'Shut down and isolate unused ports'],
  }),
  A('dns-amplification', 'DNS amplification', 'Spoofed queries make open resolvers flood a victim with large responses.', ['dns', 'udp', 'ipv4'], ampDev, ampLinks, ampSteps, ampSafe, 'BCP 38 + closed resolvers', {
    explain: 'A reflection attack: small queries with the victim\'s spoofed source address make DNS servers send much larger responses to the victim. The servers are innocent reflectors; the amplification factor multiplies the attacker\'s bandwidth.',
    vulnerabilities: ['Open recursive resolvers', 'Networks without source-address validation', 'Large responses (ANY, DNSKEY, big TXT) over UDP'],
    detection: ['Large volumes of unsolicited DNS responses (UDP source port 53) at the victim', 'Resolvers seeing high query rates for the same large record from one "client"'],
    mitigation: ['Close open resolvers (serve only your own clients)', 'Response Rate Limiting on authoritative servers', 'BCP 38 ingress filtering', 'Upstream DDoS mitigation; drop unsolicited DNS responses at the edge'],
  }),
];
