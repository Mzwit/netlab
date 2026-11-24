import type { PacketSpec } from '../engine/packet';
import { M } from './guided';
import { calcSubnet } from '../lib/subnet';
import { intToIPv4 } from '../engine/bytes';

export type Topic = 'fundamentals' | 'osi' | 'addressing' | 'subnetting' | 'transport' | 'application' | 'switching' | 'routing' | 'security' | 'troubleshooting';
export const TOPICS: Record<Topic, string> = {
  fundamentals: 'Fundamentals', osi: 'OSI & TCP/IP', addressing: 'IP addressing', subnetting: 'Subnetting', transport: 'Transport (TCP/UDP)',
  application: 'Application protocols', switching: 'Switching & VLANs', routing: 'Routing', security: 'Security', troubleshooting: 'Troubleshooting',
};

interface Base { id: string; topic: Topic; level: 1 | 2 | 3; explain: string }
export type Question =
  | (Base & { type: 'mcq' | 'scenario'; prompt: string; scenario?: string; options: string[]; answer: number })
  | (Base & { type: 'tf'; prompt: string; answer: boolean })
  | (Base & { type: 'order'; prompt: string; items: string[] }) // items in correct order
  | (Base & { type: 'packet'; prompt: string; packet: PacketSpec; options: string[]; answer: number })
  | (Base & { type: 'subnet'; prompt: string; ip: string; cidr: number; ask: 'network' | 'broadcast' | 'hosts' | 'first' | 'last' | 'mask' });

export const BANK: Question[] = [
  { id: 'q1', type: 'mcq', topic: 'osi', level: 1, prompt: 'At which OSI layer do routers make forwarding decisions?', options: ['Layer 2 — Data Link', 'Layer 3 — Network', 'Layer 4 — Transport', 'Layer 7 — Application'], answer: 1, explain: 'Routers forward on the destination IP address, a Layer 3 (Network) function. Switches use MAC addresses at Layer 2.' },
  { id: 'q2', type: 'mcq', topic: 'osi', level: 1, prompt: 'What is the PDU at the Transport layer when using TCP?', options: ['Frame', 'Packet', 'Segment', 'Bits'], answer: 2, explain: 'TCP\'s PDU is a segment (UDP\'s is a datagram). Packets are Layer 3, frames Layer 2, bits Layer 1.' },
  { id: 'q3', type: 'order', topic: 'osi', level: 1, prompt: 'Arrange the encapsulation sequence on a sending host, from first to last.', items: ['Data', 'Segment', 'Packet', 'Frame', 'Bits'], explain: 'Application data gets a transport header (segment), then an IP header (packet), then an Ethernet header/trailer (frame), then is sent as bits.' },
  { id: 'q4', type: 'tf', topic: 'osi', level: 1, prompt: 'In the TCP/IP model, the OSI Session, Presentation and Application layers are combined into one Application layer.', answer: true, explain: 'TCP/IP has four layers: Link, Internet, Transport, Application. OSI 5–7 map to Application.' },
  { id: 'q5', type: 'mcq', topic: 'switching', level: 1, prompt: 'What does a switch do with a frame whose destination MAC is not in its MAC address table?', options: ['Drops it', 'Floods it out all ports in the VLAN except the incoming one', 'Sends it to the default gateway', 'Sends an ARP request'], answer: 1, explain: 'Unknown unicast frames are flooded within the VLAN. When the destination replies, the switch learns its port.' },
  { id: 'q6', type: 'mcq', topic: 'addressing', level: 1, prompt: 'Which of these is a private (RFC 1918) address?', options: ['172.32.10.5', '192.169.1.1', '172.20.4.9', '11.0.0.1'], answer: 2, explain: 'RFC 1918: 10.0.0.0/8, 172.16.0.0/12 (172.16.0.0–172.31.255.255) and 192.168.0.0/16. 172.20.4.9 is in 172.16/12.' },
  { id: 'q7', type: 'mcq', topic: 'addressing', level: 1, prompt: 'A Windows PC shows the address 169.254.33.7. What is the most likely cause?', options: ['It has a static IP', 'It failed to get a DHCP lease', 'It is using IPv6', 'Its DNS server is down'], answer: 1, explain: '169.254.0.0/16 is APIPA (link-local), self-assigned when no DHCP server answers.' },
  { id: 'q8', type: 'mcq', topic: 'transport', level: 1, prompt: 'Which protocol provides connectionless, best-effort delivery with no acknowledgements?', options: ['TCP', 'UDP', 'SSH', 'TLS'], answer: 1, explain: 'UDP has no handshake, acknowledgements or retransmissions.' },
  { id: 'q9', type: 'order', topic: 'transport', level: 1, prompt: 'Put the TCP three-way handshake in order.', items: ['SYN', 'SYN-ACK', 'ACK'], explain: 'Client SYN, server SYN-ACK, client ACK.' },
  { id: 'q10', type: 'mcq', topic: 'transport', level: 2, prompt: 'A client sends SYN with Seq = 1000. What Ack number will the server\'s SYN-ACK carry?', options: ['1000', '1001', '0', 'A random number'], answer: 1, explain: 'The SYN consumes one sequence number, so the server acknowledges 1001 — the next byte it expects.' },
  { id: 'q11', type: 'mcq', topic: 'transport', level: 2, prompt: 'A TCP segment has Seq = 5000 and carries 300 bytes. What Ack does the receiver send if all is received?', options: ['5000', '5001', '5300', '5301'], answer: 2, explain: 'Ack = Seq + length = 5300, the next byte expected.' },
  { id: 'q12', type: 'tf', topic: 'transport', level: 2, prompt: 'Three duplicate ACKs make a TCP sender retransmit before the retransmission timer expires.', answer: true, explain: 'This is Fast Retransmit (RFC 5681).' },
  { id: 'q13', type: 'mcq', topic: 'application', level: 1, prompt: 'Which port does DNS use by default?', options: ['25', '53', '67', '443'], answer: 1, explain: 'DNS uses port 53, UDP for most queries and TCP for large answers/zone transfers.' },
  { id: 'q14', type: 'order', topic: 'application', level: 1, prompt: 'Arrange the DHCP messages in order.', items: ['Discover', 'Offer', 'Request', 'Acknowledge'], explain: 'DORA: Discover (broadcast), Offer, Request (broadcast), ACK.' },
  { id: 'q15', type: 'mcq', topic: 'application', level: 2, prompt: 'Why is a DHCP Request sent as a broadcast even though the client already knows the server\'s address?', options: ['Because UDP cannot unicast', 'So that all DHCP servers learn which offer was accepted', 'To update switch MAC tables', 'Because the server requires it for authentication'], answer: 1, explain: 'Other servers that made offers see the Request naming a different server ID and release their reserved addresses.' },
  { id: 'q16', type: 'mcq', topic: 'application', level: 1, prompt: 'Which DNS record type maps a name to an IPv6 address?', options: ['A', 'AAAA', 'PTR', 'MX'], answer: 1, explain: 'AAAA ("quad-A") records hold IPv6 addresses.' },
  { id: 'q17', type: 'mcq', topic: 'application', level: 2, prompt: 'In TLS 1.3, which handshake message is the first one that is encrypted?', options: ['ClientHello', 'ServerHello', 'EncryptedExtensions', 'ChangeCipherSpec'], answer: 2, explain: 'Keys are derived from the ServerHello key share; everything after it, starting with EncryptedExtensions, is encrypted — including the certificate.' },
  { id: 'q18', type: 'tf', topic: 'application', level: 2, prompt: 'With HTTPS, an on-path observer can still see the destination IP address and usually the server name (SNI).', answer: true, explain: 'TLS encrypts content, but IPs, ports, packet sizes and (without ECH) SNI remain visible.' },
  { id: 'q19', type: 'mcq', topic: 'routing', level: 2, prompt: 'A router has routes 10.0.0.0/8, 10.1.0.0/16 and 10.1.5.0/24. Which is used for 10.1.5.20?', options: ['10.0.0.0/8', '10.1.0.0/16', '10.1.5.0/24', 'The default route'], answer: 2, explain: 'Longest prefix match: /24 is the most specific route that matches.' },
  { id: 'q20', type: 'mcq', topic: 'routing', level: 2, prompt: 'The same prefix is learned via OSPF and a static route. Which is installed by default?', options: ['OSPF (AD 110)', 'Static (AD 1)', 'Both, load-balanced', 'Whichever was learned first'], answer: 1, explain: 'Lower administrative distance wins: static 1 beats OSPF 110.' },
  { id: 'q21', type: 'scenario', topic: 'routing', level: 2, scenario: 'PC-A (192.168.10.10/24) sends a packet to Server-B (192.168.20.20/24) via router R1.', prompt: 'What is the destination MAC address in the frame as it leaves PC-A?', options: ['Server-B\'s MAC', 'R1\'s LAN interface MAC', 'Broadcast ff:ff:ff:ff:ff:ff', 'PC-A\'s own MAC'], answer: 1, explain: 'The destination is on another subnet, so the frame goes to the default gateway (R1). The IP destination remains Server-B.' },
  { id: 'q22', type: 'tf', topic: 'routing', level: 1, prompt: 'Routers change the source and destination IP addresses of a packet at every hop.', answer: false, explain: 'Routers rewrite the Layer 2 header and decrement TTL; IP addresses stay the same (unless NAT is performed).' },
  { id: 'q23', type: 'mcq', topic: 'routing', level: 3, prompt: 'Two OSPF routers stay stuck in EXSTART/EXCHANGE. What is the most likely cause?', options: ['Different router IDs', 'MTU mismatch', 'Different OSPF process IDs', 'Wrong default route'], answer: 1, explain: 'An MTU mismatch causes DBD exchange to fail. Process IDs are locally significant.' },
  { id: 'q24', type: 'mcq', topic: 'switching', level: 2, prompt: 'What is the purpose of Spanning Tree Protocol?', options: ['To route between VLANs', 'To prevent Layer 2 loops', 'To assign IP addresses', 'To encrypt frames'], answer: 1, explain: 'STP blocks redundant paths so the switched topology is loop-free.' },
  { id: 'q25', type: 'mcq', topic: 'switching', level: 2, prompt: 'Which 802.1Q field identifies the VLAN?', options: ['TPID', 'PCP', 'VID (12 bits)', 'EtherType'], answer: 2, explain: 'The 12-bit VLAN ID (1–4094) identifies the VLAN; TPID 0x8100 marks the tag.' },
  { id: 'q26', type: 'tf', topic: 'switching', level: 1, prompt: 'Devices in different VLANs can communicate without a Layer 3 device.', answer: false, explain: 'Each VLAN is a separate broadcast domain/subnet; inter-VLAN routing requires a router or Layer 3 switch.' },
  { id: 'q27', type: 'mcq', topic: 'security', level: 2, prompt: 'Which switch feature defends against ARP spoofing?', options: ['PortFast', 'Dynamic ARP Inspection', 'BPDU Guard', 'EtherChannel'], answer: 1, explain: 'DAI validates ARP packets against DHCP snooping bindings.' },
  { id: 'q28', type: 'mcq', topic: 'security', level: 2, prompt: 'What does a SYN flood exhaust?', options: ['The server\'s DNS cache', 'The server\'s half-open connection backlog', 'The switch MAC table', 'The DHCP pool'], answer: 1, explain: 'Each SYN creates a half-open connection; when the backlog fills, new connections are refused. SYN cookies mitigate this.' },
  { id: 'q29', type: 'scenario', topic: 'security', level: 2, scenario: 'Users on one floor suddenly receive 10.99.0.x addresses with a gateway that is not your router. Your real pool is 10.10.0.0/24.', prompt: 'What is the most likely attack and the best control?', options: ['VLAN hopping — disable DTP', 'Rogue DHCP server — DHCP snooping', 'DNS amplification — rate limiting', 'IP spoofing — uRPF'], answer: 1, explain: 'An unauthorised DHCP server is handing out addresses. DHCP snooping only trusts server messages on designated ports.' },
  { id: 'q30', type: 'mcq', topic: 'security', level: 3, prompt: 'Which configuration mitigates VLAN double-tagging?', options: ['Using VLAN 1 as the native VLAN', 'Setting the native VLAN to an unused VLAN and tagging it', 'Enabling DTP desirable mode', 'Enabling PortFast'], answer: 1, explain: 'Double tagging needs the attacker to be in the native VLAN; use an unused, tagged native VLAN and disable DTP.' },
  { id: 'q31', type: 'tf', topic: 'security', level: 1, prompt: 'FTP sends user names and passwords in clear text.', answer: true, explain: 'Plain FTP has no encryption; use SFTP or FTPS.' },
  { id: 'q32', type: 'mcq', topic: 'security', level: 2, prompt: 'What makes DNS amplification possible?', options: ['TCP retransmission', 'Spoofed UDP source addresses and open resolvers', 'Large MTUs', 'DNSSEC'], answer: 1, explain: 'Attackers forge the victim\'s address in small UDP queries to open resolvers, which send large answers to the victim.' },
  { id: 'q33', type: 'mcq', topic: 'troubleshooting', level: 1, prompt: 'You can ping 8.8.8.8 but browsing to websites by name fails. What should you check first?', options: ['The default gateway', 'DNS configuration', 'The Ethernet cable', 'The subnet mask'], answer: 1, explain: 'IP connectivity works, so name resolution is the likely failure.' },
  { id: 'q34', type: 'mcq', topic: 'troubleshooting', level: 2, prompt: 'Which tool shows each router hop on the path to a destination?', options: ['ping', 'traceroute / tracert', 'nslookup', 'arp -a'], answer: 1, explain: 'traceroute sends packets with increasing TTL; each router returns ICMP Time Exceeded, revealing the path.' },
  { id: 'q35', type: 'order', topic: 'troubleshooting', level: 2, prompt: 'Order a bottom-up troubleshooting approach.', items: ['Check cable / link lights', 'Check IP address, mask and gateway', 'Ping the default gateway', 'Ping a remote IP', 'Test DNS name resolution'], explain: 'Bottom-up follows the OSI layers: physical → addressing → local reachability → remote reachability → application services.' },
  { id: 'q36', type: 'scenario', topic: 'troubleshooting', level: 3, scenario: 'Small pings work across a VPN, but SSH sessions hang as soon as a large directory listing is printed.', prompt: 'What is the most likely cause?', options: ['DNS misconfiguration', 'Path MTU problem with ICMP "fragmentation needed" blocked', 'Duplex mismatch on the LAN', 'Expired DHCP lease'], answer: 1, explain: 'Small packets pass but large ones are dropped: classic PMTUD black hole. Allow ICMP type 3 code 4 or clamp TCP MSS.' },
  { id: 'q37', type: 'mcq', topic: 'fundamentals', level: 1, prompt: 'What is the main difference between a MAC address and an IP address?', options: ['MAC is logical, IP is physical', 'MAC is used hop-by-hop on a link; IP identifies end hosts across networks', 'They are the same thing', 'MAC addresses are 32 bits'], answer: 1, explain: 'MAC (48-bit) addresses deliver frames on one link and are rewritten per hop; IP addresses are end-to-end and routable.' },
  { id: 'q38', type: 'mcq', topic: 'fundamentals', level: 1, prompt: 'Which device separates broadcast domains?', options: ['Hub', 'Switch (single VLAN)', 'Router', 'Repeater'], answer: 2, explain: 'Routers do not forward broadcasts. (VLANs also create separate broadcast domains on a switch.)' },
  { id: 'q39', type: 'tf', topic: 'fundamentals', level: 1, prompt: 'Each port on a switch is its own collision domain.', answer: true, explain: 'Switches with full duplex eliminate collisions between ports.' },
  { id: 'q40', type: 'mcq', topic: 'addressing', level: 2, prompt: 'What does the IPv6 address fe80::1 represent?', options: ['A global unicast address', 'A link-local address', 'A multicast address', 'The loopback address'], answer: 1, explain: 'fe80::/10 is link-local, valid only on one link.' },
  { id: 'q41', type: 'mcq', topic: 'addressing', level: 2, prompt: 'What replaces ARP in IPv6?', options: ['DHCPv6', 'Neighbor Discovery (ICMPv6 NS/NA)', 'RARP', 'IGMP'], answer: 1, explain: 'ICMPv6 Neighbor Solicitation and Advertisement messages resolve link-layer addresses.' },
  { id: 'q42', type: 'mcq', topic: 'application', level: 2, prompt: 'Which protocol lets many private hosts share one public IPv4 address using port numbers?', options: ['Static NAT', 'PAT (NAT overload)', 'DHCP', 'VLAN'], answer: 1, explain: 'PAT translates both address and port so flows can be distinguished.' },
  {
    id: 'p1', type: 'packet', topic: 'transport', level: 2, prompt: 'Inspect this packet. What is it?',
    packet: { eth: { src: M.pc, dst: M.gw }, ipv4: { src: '10.0.0.15', dst: '10.0.0.80' }, tcp: { sport: 49812, dport: 80, seq: 4012345678, flags: 'SYN', mss: 1460 } },
    options: ['A TCP connection request to a web server', 'A DNS query', 'A TCP reset', 'An ICMP echo request'], answer: 0, explain: 'IP protocol 6 (TCP), only the SYN flag set, destination port 80 — the first step of a handshake to an HTTP server.',
  },
  {
    id: 'p2', type: 'packet', topic: 'application', level: 2, prompt: 'Inspect this packet. Which statement is correct?',
    packet: { eth: { src: M.pc, dst: M.bc }, ipv4: { src: '0.0.0.0', dst: '255.255.255.255', df: false }, udp: { sport: 68, dport: 67 }, app: { kind: 'dhcp', dhcp: { op: 1, msg: 'DISCOVER', xid: 0x3903f326, chaddr: M.pc, broadcast: true } } },
    options: ['It is a DHCP server offering an address', 'It is a client with no IP looking for a DHCP server', 'It is an ARP request', 'It is a DNS response'], answer: 1, explain: 'Source 0.0.0.0, broadcast destination, UDP 68→67 and option 53 = DISCOVER.',
  },
  {
    id: 'p3', type: 'packet', topic: 'addressing', level: 2, prompt: 'This frame was captured on a LAN. What is the sender asking?',
    packet: { eth: { src: M.pc, dst: M.bc }, arp: { op: 1, sha: M.pc, spa: '192.168.1.10', tha: M.zero, tpa: '192.168.1.1' } },
    options: ['The IP address of 192.168.1.10', 'The MAC address for 192.168.1.1', 'For a DHCP lease', 'Whether 192.168.1.1 is reachable via ICMP'], answer: 1, explain: 'ARP opcode 1 (request), target IP 192.168.1.1, target MAC zero: "who has 192.168.1.1?" — usually the default gateway.',
  },
  {
    id: 'p4', type: 'packet', topic: 'routing', level: 2, prompt: 'This ICMP packet has TTL 61 when it arrives. The sender\'s OS starts at 64. How many routers did it cross?',
    packet: { eth: { src: M.gw, dst: M.pc }, ipv4: { src: '198.51.100.10', dst: '192.168.1.10', ttl: 61 }, icmp: { type: 0, code: 0, id: 1, seq: 1 } },
    options: ['1', '3', '61', 'Cannot be determined'], answer: 1, explain: 'Each router decrements TTL by one: 64 − 61 = 3 hops.',
  },
  {
    id: 'p5', type: 'packet', topic: 'application', level: 2, prompt: 'Inspect this DNS packet. What does it tell the client?',
    packet: { eth: { src: M.gw, dst: M.pc }, ipv4: { src: '198.51.100.53', dst: '192.168.1.10', ttl: 57 }, udp: { sport: 53, dport: 51734 }, app: { kind: 'dns', dns: { id: 0x6a1f, response: true, ra: true, qname: 'www.example.com', qtype: 'A', answers: [{ name: 'www.example.com', type: 'A', ttl: 3600, data: '203.0.113.80' }] } } },
    options: ['www.example.com does not exist', 'www.example.com is at 203.0.113.80 and may be cached for an hour', 'The resolver refused the query', 'The mail server for example.com'], answer: 1, explain: 'QR=1 response, RCODE 0, one A answer 203.0.113.80 with TTL 3600 seconds.',
  },
];

// ---- generated subnetting questions
export function subnetQuestion(seed: number): Question {
  let x = (seed * 2654435761) >>> 0;
  const r = (n: number) => { x = (x * 1103515245 + 12345) >>> 0; return x % n; };
  const cidr = [20, 22, 23, 25, 26, 27, 28, 29, 30][r(9)];
  const bases = [[10, r(256), r(256), r(256)], [172, 16 + r(16), r(256), r(256)], [192, 168, r(256), r(256)]];
  const ip = bases[r(3)].join('.');
  const asks = ['network', 'broadcast', 'hosts', 'first', 'last', 'mask'] as const;
  const ask = asks[r(asks.length)];
  const label = { network: 'network address', broadcast: 'broadcast address', hosts: 'number of usable hosts', first: 'first usable host', last: 'last usable host', mask: 'subnet mask (dotted decimal)' }[ask];
  return { id: `sn-${seed}`, type: 'subnet', topic: 'subnetting', level: 2, ip, cidr, ask, prompt: `What is the ${label} for ${ip}/${cidr}?`, explain: '' };
}
export function subnetAnswer(q: Extract<Question, { type: 'subnet' }>) {
  const s = calcSubnet(q.ip, q.cidr);
  const v = { network: s.network, broadcast: s.broadcast, hosts: String(s.usable), first: s.first, last: s.last, mask: s.mask }[q.ask];
  const block = 2 ** (32 - q.cidr);
  const explain = `/${q.cidr} → mask ${s.mask}, block size ${block >= 256 ? `${block / 256} in the third octet` : `${block} in the last octet`}. Network ${s.network}, broadcast ${s.broadcast}, usable ${s.first} – ${s.last} (${s.usable} hosts = 2^${32 - q.cidr} − 2).`;
  return { value: v, explain };
}
export const normalizeAnswer = (s: string) => s.trim().replace(/\s+/g, '').replace(/^0+(\d)/, '$1');
export { intToIPv4 };
