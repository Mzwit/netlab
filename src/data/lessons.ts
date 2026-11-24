import type { Topic } from './questions';

export type Exercise =
  | { kind: 'order'; prompt: string; items: string[] }
  | { kind: 'classify'; prompt: string; buckets: string[]; items: [string, number][] }
  | { kind: 'subnet'; prompt: string }
  | { kind: 'binary'; prompt: string };

export type Diagram = { kind: 'sim'; id: string } | { kind: 'osi' } | { kind: 'encap' } | { kind: 'packet'; protocol: string };

export interface Lesson {
  id: string; title: string; minutes: number; objectives: string[]; simple: string; technical: string[];
  diagram: Diagram; example: string; exercise: Exercise; check: string[]; summary: string[];
}
export interface Course { id: string; title: string; level: string; topic: Topic; blurb: string; lessons: Lesson[] }

export const COURSES: Course[] = [
  {
    id: 'beginner', title: 'Beginner networking', level: 'Beginner', topic: 'fundamentals', blurb: 'What a network is, how devices are addressed, and what switches and routers do.',
    lessons: [
      {
        id: 'b1', title: 'Hosts, switches and routers', minutes: 12,
        objectives: ['Name the main network devices and their jobs', 'Explain LAN vs WAN', 'Explain the difference between a switch and a router'],
        simple: 'A network is a set of devices that can send messages to each other. A switch connects devices in the same building, like a post room delivering letters inside an office. A router connects different networks together, like the postal service carrying letters between cities.',
        technical: ['Hosts (PCs, phones, servers) originate and consume data. Switches forward Ethernet frames within a LAN using MAC addresses and a MAC address table built by learning source addresses on each port. Routers forward IP packets between networks using routing tables and longest-prefix matching.', 'A LAN covers a limited area under one administration; WANs connect LANs over long distances (often leased from service providers). Wireless access points bridge Wi-Fi clients onto the wired LAN; firewalls enforce security policy between zones.'],
        diagram: { kind: 'sim', id: 'arp' }, example: 'At home, your Wi-Fi router is actually three devices in one box: a switch (the LAN ports), a wireless access point, and a router with NAT that connects to your ISP.',
        exercise: { kind: 'classify', prompt: 'Which device primarily makes each decision?', buckets: ['Switch', 'Router', 'Access point'], items: [['Forward a frame by MAC address', 0], ['Choose the next hop for 8.8.8.8', 1], ['Bridge Wi-Fi clients to Ethernet', 2], ['Stop broadcasts from leaving the LAN', 1], ['Learn which port a MAC lives on', 0]] },
        check: ['q5', 'q38', 'q39'], summary: ['Switch = Layer 2, MAC addresses, within a LAN.', 'Router = Layer 3, IP addresses, between networks.', 'Routers separate broadcast domains.'],
      },
      {
        id: 'b2', title: 'MAC addresses, IP addresses and ARP', minutes: 15,
        objectives: ['Describe MAC and IPv4 address formats', 'Explain why both are needed', 'Follow an ARP exchange'],
        simple: 'Every network card has a MAC address, like a serial number. An IP address is more like a postal address that tells the network where you are. To deliver a message on the local network, your computer uses ARP to ask: "who owns this IP address? Tell me your MAC."',
        technical: ['A MAC address is 48 bits (6 bytes), usually shown as hex pairs. The first 3 bytes are the OUI (manufacturer). An IPv4 address is 32 bits in dotted decimal, split into network and host parts by the subnet mask.', 'ARP (EtherType 0x0806) broadcasts a request containing the target IP; the owner replies by unicast. Results are cached. For off-subnet destinations, the host ARPs for its default gateway, not for the remote host.'],
        diagram: { kind: 'sim', id: 'arp' }, example: 'Run `arp -a` (Windows) or `ip neigh` (Linux) to see your ARP cache — the gateway\'s entry will be there.',
        exercise: { kind: 'order', prompt: 'Order the events when PC1 first pings PC2 on the same LAN.', items: ['PC1 checks its ARP cache', 'PC1 broadcasts an ARP request', 'PC2 sends an ARP reply', 'PC1 stores the mapping', 'PC1 sends the ICMP echo request'] },
        check: ['q37', 'p3', 'q7'], summary: ['MAC: 48-bit, hop-by-hop. IP: 32-bit (IPv4), end-to-end.', 'ARP request = broadcast, reply = unicast.', 'Off-subnet → ARP for the gateway.'],
      },
    ],
  },
  {
    id: 'osi-models', title: 'OSI and TCP/IP models', level: 'Beginner', topic: 'osi', blurb: 'The layered models every network engineer thinks in.',
    lessons: [
      {
        id: 'o1', title: 'The seven OSI layers', minutes: 14,
        objectives: ['List the OSI layers in order', 'Give a protocol and device for each layer', 'Map OSI to TCP/IP'],
        simple: 'The OSI model splits networking into seven jobs, from the physical cable at the bottom to the application at the top. Each layer only worries about its own job and relies on the one below.',
        technical: ['Layers: 1 Physical, 2 Data Link, 3 Network, 4 Transport, 5 Session, 6 Presentation, 7 Application. Mnemonic (top-down): "All People Seem To Need Data Processing".', 'TCP/IP uses four layers: Link (OSI 1–2), Internet (3), Transport (4) and Application (5–7). Real protocols do not always fit neatly — TLS is often placed at 5/6, ARP between 2 and 3.'],
        diagram: { kind: 'osi' }, example: 'When troubleshooting, "it\'s a Layer 1 problem" means cables or signal; "Layer 7" means the application itself.',
        exercise: { kind: 'classify', prompt: 'Assign each protocol to its OSI layer.', buckets: ['Layer 2', 'Layer 3', 'Layer 4', 'Layer 7'], items: [['Ethernet', 0], ['IPv4', 1], ['TCP', 2], ['DNS', 3], ['UDP', 2], ['ICMP', 1], ['HTTP', 3], ['802.1Q', 0]] },
        check: ['q1', 'q4', 'q2'], summary: ['7 layers: Physical → Application.', 'TCP/IP collapses them into 4.', 'Each layer has its own PDU.'],
      },
      {
        id: 'o2', title: 'Encapsulation and decapsulation', minutes: 12,
        objectives: ['Describe how each layer adds a header', 'Name PDUs at each layer', 'Explain decapsulation at the receiver'],
        simple: 'Sending data is like packing a parcel inside a box, inside a bigger box, inside a shipping crate. Each layer adds its own label. The receiver unpacks the boxes in reverse order.',
        technical: ['Data (L7) → TCP segment (+20 B header) → IP packet (+20 B) → Ethernet frame (+14 B header, +4 B FCS) → bits. Each header contains a field identifying the next protocol up: EtherType, IP Protocol, port numbers.', 'At the receiver, each layer checks its header (FCS, IP checksum, ports), strips it and passes the payload up. Routers decapsulate only up to Layer 3 and re-encapsulate a new Layer 2 frame.'],
        diagram: { kind: 'encap' }, example: 'A 1 460-byte TCP payload becomes a 1 500-byte IP packet (the Ethernet MTU) and a 1 518-byte frame.',
        exercise: { kind: 'order', prompt: 'Order the PDUs on the sending host.', items: ['Data', 'Segment', 'Packet', 'Frame', 'Bits'] },
        check: ['q3', 'q2'], summary: ['Headers are added going down, removed going up.', 'Next-protocol fields link the layers.', 'Routers rebuild the frame at each hop.'],
      },
    ],
  },
  {
    id: 'intermediate', title: 'Intermediate networking', level: 'Intermediate', topic: 'subnetting', blurb: 'Subnetting, binary arithmetic and how TCP and UDP really behave.',
    lessons: [
      {
        id: 'i1', title: 'Binary and subnetting', minutes: 20,
        objectives: ['Convert between decimal and binary', 'Calculate network, broadcast and host range', 'Find the number of usable hosts'],
        simple: 'An IP address is really 32 ones and zeros. The subnet mask marks which of them name the network and which name the device. Bigger masks make smaller networks.',
        technical: ['Prefix /n = n one-bits in the mask. Hosts per subnet = 2^(32−n) − 2 (network and broadcast are reserved; /31 and /32 are special cases).', 'Block-size method: 256 − (interesting mask octet) gives the subnet increment. For /26 the mask is 255.255.255.192, block 64: subnets .0, .64, .128, .192. Network = address AND mask; broadcast = network OR wildcard.'],
        diagram: { kind: 'packet', protocol: 'ipv4' }, example: '192.168.10.77/26 → block 64 → network 192.168.10.64, broadcast .127, hosts .65–.126 (62 hosts).',
        exercise: { kind: 'subnet', prompt: 'Solve randomly generated subnetting problems. Answers are checked by the calculator engine.' },
        check: ['q6', 'q40'], summary: ['Usable = 2^host bits − 2.', 'Block size = 256 − mask octet.', 'Network = IP AND mask.'],
      },
      {
        id: 'i2', title: 'TCP vs UDP', minutes: 16,
        objectives: ['Compare TCP and UDP', 'Track sequence and acknowledgement numbers', 'Explain flow and congestion control'],
        simple: 'TCP is like a phone call — you set it up, confirm everything is heard, and hang up politely. UDP is like posting a postcard: quick, cheap, but no guarantee it arrives.',
        technical: ['TCP: 3-way handshake, byte sequence numbers, cumulative ACKs, retransmissions, sliding window flow control and congestion control (slow start, AIMD, fast recovery).', 'UDP: 8-byte header, no state. Used for DNS, DHCP, VoIP, streaming and as the base for QUIC.'],
        diagram: { kind: 'sim', id: 'tcp-handshake' }, example: 'A video call uses UDP because a late packet is useless; a file download uses TCP because every byte matters.',
        exercise: { kind: 'classify', prompt: 'TCP or UDP?', buckets: ['TCP', 'UDP'], items: [['HTTPS (HTTP/1.1, HTTP/2)', 0], ['DNS query', 1], ['SSH', 0], ['DHCP', 1], ['VoIP (RTP)', 1], ['SMTP', 0]] },
        check: ['q8', 'q10', 'q11', 'q12'], summary: ['Ack = next byte expected.', 'SYN and FIN each consume 1 sequence number.', 'UDP: no handshake, no retransmission.'],
      },
    ],
  },
  {
    id: 'protocols', title: 'Network protocols', level: 'Intermediate', topic: 'application', blurb: 'DHCP, DNS, HTTP and TLS — the protocols behind every web page.',
    lessons: [
      {
        id: 'p1l', title: 'DHCP and DNS', minutes: 15,
        objectives: ['Describe the DORA process', 'Explain recursive DNS resolution', 'Recognise common record types'],
        simple: 'DHCP is the receptionist who gives a new device its address and directions. DNS is the phone book that turns names into addresses.',
        technical: ['DHCP: Discover/Offer/Request/ACK over UDP 67/68; options carry mask, router, DNS, lease. Relay agents forward broadcasts across routers.', 'DNS: stub resolver → recursive resolver → root → TLD → authoritative. Records: A, AAAA, CNAME, MX, NS, TXT, PTR. Caching is governed by TTL.'],
        diagram: { kind: 'sim', id: 'dhcp' }, example: 'nslookup -type=mx example.com lists mail servers; ipconfig /all shows the DHCP-provided DNS servers.',
        exercise: { kind: 'order', prompt: 'Order the DHCP exchange.', items: ['Discover', 'Offer', 'Request', 'Acknowledge'] },
        check: ['q13', 'q14', 'q15', 'q16'], summary: ['DORA over UDP 67/68.', 'DNS mostly UDP 53.', 'TTL controls caching.'],
      },
      {
        id: 'p2l', title: 'HTTP, HTTPS and TLS', minutes: 18,
        objectives: ['Read an HTTP request and response', 'Explain what TLS protects', 'Describe the TLS 1.3 handshake'],
        simple: 'HTTP is how browsers ask for web pages. HTTPS wraps those requests in a locked envelope (TLS) so nobody in between can read or change them, and so you know you are talking to the real site.',
        technical: ['HTTP request: method, path, version, headers (Host is mandatory), optional body. Response: status code, headers, body.', 'TLS 1.3: ClientHello (key share) → ServerHello (key share) → encrypted certificate, CertificateVerify, Finished → client Finished. ECDHE gives forward secrecy; AEAD ciphers give confidentiality and integrity.'],
        diagram: { kind: 'sim', id: 'https-tls' }, example: 'Open your browser devtools Network tab to see real request/response headers for any site.',
        exercise: { kind: 'classify', prompt: 'With HTTPS, is it visible to an on-path observer?', buckets: ['Visible', 'Hidden'], items: [['Destination IP address', 0], ['URL path (/account)', 1], ['Server name (SNI, without ECH)', 0], ['Cookies', 1], ['Packet sizes and timing', 0], ['Form passwords', 1]] },
        check: ['q17', 'q18'], summary: ['HTTPS = HTTP over TLS over TCP 443.', 'Certificates authenticate the server.', 'Metadata is still visible.'],
      },
    ],
  },
  {
    id: 'advanced', title: 'Advanced networking', level: 'Advanced', topic: 'routing', blurb: 'Routing decisions, dynamic protocols and VLAN design.',
    lessons: [
      {
        id: 'a1', title: 'How routers choose paths', minutes: 18,
        objectives: ['Apply longest-prefix match', 'Use administrative distance and metrics', 'Trace a packet hop by hop'],
        simple: 'A router is like a signpost at a junction: it reads the destination and points to the most specific road that leads there.',
        technical: ['Route selection order: longest prefix → lowest AD (connected 0, static 1, eBGP 20, OSPF 110, RIP 120) → lowest metric → ECMP.', 'OSPF builds a link-state database and runs SPF; BGP uses path attributes and policy between autonomous systems.'],
        diagram: { kind: 'sim', id: 'routing' }, example: 'Use the Routing Table Explorer tool to test which route wins for different destinations.',
        exercise: { kind: 'order', prompt: 'Order the router\'s tie-breakers when choosing a route.', items: ['Longest prefix match', 'Lowest administrative distance', 'Lowest metric', 'Equal-cost load balancing'] },
        check: ['q19', 'q20', 'q21', 'q22'], summary: ['Most specific prefix wins first.', 'AD compares route sources.', 'Metric compares within a protocol.'],
      },
      {
        id: 'a2', title: 'VLANs, trunks and Spanning Tree', minutes: 16,
        objectives: ['Explain VLAN segmentation', 'Describe 802.1Q tagging', 'Explain why STP is required'],
        simple: 'VLANs split one physical switch into several virtual ones. Spanning Tree stops traffic from going round in circles when switches are cabled in a loop for backup.',
        technical: ['802.1Q inserts a 4-byte tag (TPID 0x8100, PCP, DEI, 12-bit VID). Access ports carry one untagged VLAN; trunks carry many tagged VLANs plus one untagged native VLAN.', 'STP elects a root bridge, chooses root and designated ports and blocks the rest. RSTP converges in about a second; MSTP maps VLANs to instances.'],
        diagram: { kind: 'packet', protocol: 'vlan' }, example: 'Voice VLANs let an IP phone and a PC share one cable while keeping their traffic separate.',
        exercise: { kind: 'classify', prompt: 'Which feature addresses each issue?', buckets: ['VLAN', 'STP', 'Trunk'], items: [['Separate guests from staff', 0], ['Redundant links cause a broadcast storm', 1], ['Carry 20 VLANs between two switches', 2], ['Elect a root bridge', 1]] },
        check: ['q24', 'q25', 'q26'], summary: ['VLAN = broadcast domain.', 'Trunks tag frames.', 'STP prevents loops.'],
      },
    ],
  },
  {
    id: 'ccna', title: 'CCNA preparation', level: 'Advanced', topic: 'addressing', blurb: 'Exam-style practice on addressing, IPv6 and NAT.',
    lessons: [
      {
        id: 'c1', title: 'IPv6 essentials', minutes: 15,
        objectives: ['Shorten IPv6 addresses correctly', 'Identify address types', 'Explain SLAAC and Neighbor Discovery'],
        simple: 'IPv6 addresses are much longer so the world never runs out. Devices can configure themselves by listening to routers.',
        technical: ['128-bit addresses in 8 hex groups. Drop leading zeros in a group; replace ONE run of zero groups with ::. Types: global unicast 2000::/3, link-local fe80::/10, unique local fc00::/7, multicast ff00::/8.', 'SLAAC: Router Advertisement provides the /64 prefix; the host creates an interface ID and performs DAD. ICMPv6 NS/NA replace ARP.'],
        diagram: { kind: 'packet', protocol: 'icmpv6' }, example: '2001:0db8:0000:0000:0000:ff00:0042:8329 → 2001:db8::ff00:42:8329.',
        exercise: { kind: 'classify', prompt: 'Classify each IPv6 address.', buckets: ['Global unicast', 'Link-local', 'Multicast'], items: [['2001:db8::1', 0], ['fe80::1a2b', 1], ['ff02::1', 2], ['2606:4700::6810', 0], ['ff02::1:ff00:1', 2]] },
        check: ['q40', 'q41'], summary: ['Only one :: per address.', 'fe80::/10 link-local.', 'ND replaces ARP.'],
      },
      {
        id: 'c2', title: 'NAT and PAT', minutes: 12,
        objectives: ['Distinguish static NAT, dynamic NAT and PAT', 'Read a translation table', 'Know NAT terminology'],
        simple: 'NAT lets all the devices in your house share one public internet address, by keeping a list of who started which conversation.',
        technical: ['Inside local (private), inside global (public as seen outside), outside global (remote). PAT tracks the port to multiplex flows.', 'NAT breaks end-to-end addressing; inbound connections need static NAT or port forwarding.'],
        diagram: { kind: 'sim', id: 'nat' }, example: 'Cisco: `ip nat inside source list 1 interface g0/0 overload` configures PAT.',
        exercise: { kind: 'classify', prompt: 'Name each address from the router\'s point of view (PC 192.168.1.10 → server 198.51.100.80 via public 203.0.113.5).', buckets: ['Inside local', 'Inside global', 'Outside global'], items: [['192.168.1.10', 0], ['203.0.113.5', 1], ['198.51.100.80', 2]] },
        check: ['q42', 'q6'], summary: ['PAT = many-to-one using ports.', 'Translation tables map replies back.', 'NAT is not a firewall.'],
      },
    ],
  },
  {
    id: 'troubleshooting', title: 'Network troubleshooting', level: 'Intermediate', topic: 'troubleshooting', blurb: 'A methodical approach and the tools that go with it.',
    lessons: [
      {
        id: 't1', title: 'A layered troubleshooting method', minutes: 14,
        objectives: ['Apply bottom-up troubleshooting', 'Choose the right tool for each layer', 'Interpret common symptoms'],
        simple: 'Start with the simplest things — is it plugged in? — and work up. Each test you pass rules out a whole layer of possible causes.',
        technical: ['Bottom-up: link → IP config (ipconfig/ip a) → ping gateway → ping remote IP → DNS (nslookup/dig) → application (curl, telnet to port). Top-down and divide-and-conquer (start at Layer 3 with ping) are alternatives.', 'Tools: ping (reachability/RTT), traceroute (path), arp (L2 mapping), netstat/ss (sockets), Wireshark (packets), show interfaces (errors).'],
        diagram: { kind: 'sim', id: 'ping' }, example: 'Ping by IP works but by name fails → DNS. Ping to gateway fails → local L1–L3 problem.',
        exercise: { kind: 'order', prompt: 'Order a bottom-up troubleshooting sequence.', items: ['Check cable / link lights', 'Check IP address, mask and gateway', 'Ping the default gateway', 'Ping a remote IP', 'Test DNS name resolution'] },
        check: ['q33', 'q34', 'q35'], summary: ['Work layer by layer.', 'Each test isolates a layer.', 'Document what you change.'],
      },
      {
        id: 't2', title: 'Reading packet captures', minutes: 16,
        objectives: ['Identify a packet\'s protocol from its headers', 'Read TTL, flags and ports', 'Spot common problems in captures'],
        simple: 'A packet capture is a recording of exactly what crossed the wire. Learning to read the headers is like learning to read the label on a parcel.',
        technical: ['Use EtherType → IP Protocol → ports to identify protocols. TCP flags reveal connection state (SYN, RST, FIN). TTL hints at hop count and OS. Retransmissions and duplicate ACKs indicate loss; zero windows indicate a slow receiver.', 'NETLAB\'s inspector shows the same structure Wireshark does: a field tree, a hex dump, and byte-to-field highlighting.'],
        diagram: { kind: 'packet', protocol: 'tcp' }, example: 'A SYN followed immediately by RST,ACK = port closed. A SYN with no reply = filtered.',
        exercise: { kind: 'classify', prompt: 'What does each observation suggest?', buckets: ['Port closed', 'Packet loss', 'Filtered'], items: [['SYN → RST,ACK', 0], ['Repeated retransmissions', 1], ['SYN with no answer at all', 2], ['Duplicate ACKs', 1]] },
        check: ['p1', 'p4', 'p5', 'q36'], summary: ['EtherType → Protocol → port.', 'Flags tell the TCP story.', 'Loss shows as retransmissions.'],
      },
    ],
  },
  {
    id: 'security', title: 'Cybersecurity fundamentals', level: 'Intermediate', topic: 'security', blurb: 'How common network attacks work, and the controls that stop them.',
    lessons: [
      {
        id: 's1', title: 'Layer 2 attacks and defences', minutes: 16,
        objectives: ['Explain ARP spoofing, DHCP starvation and VLAN hopping', 'Match each attack to a switch defence', 'Describe detection signals'],
        simple: 'Local networks trust everyone plugged in. Attackers abuse that trust to pretend to be the router or hand out fake settings. Smart switches can check messages and block the fakes.',
        technical: ['ARP spoofing → Dynamic ARP Inspection. DHCP starvation / rogue DHCP → DHCP snooping + port security. VLAN double tagging → unused tagged native VLAN, no DTP. MAC flooding → port security. Rogue root bridge → BPDU/Root Guard.', '802.1X authenticates devices before they get network access at all.'],
        diagram: { kind: 'sim', id: 'arp' }, example: 'Toggle "Defence ON" in the ARP spoofing lab to see DAI drop the forged reply.',
        exercise: { kind: 'classify', prompt: 'Match the attack to its main defence.', buckets: ['DAI', 'DHCP snooping', 'Native VLAN hardening'], items: [['ARP spoofing', 0], ['Rogue DHCP server', 1], ['Double tagging', 2], ['DHCP starvation', 1]] },
        check: ['q27', 'q29', 'q30'], summary: ['Layer 2 has no built-in authentication.', 'Switch features add validation.', 'Encrypt traffic anyway.'],
      },
      {
        id: 's2', title: 'Spoofing, DoS and encryption', minutes: 15,
        objectives: ['Explain IP spoofing and reflection attacks', 'Describe SYN floods and SYN cookies', 'Explain why encryption defeats sniffing and hijacking'],
        simple: 'Some attackers lie about where packets come from, or overwhelm a server with fake requests. Others just listen. Encryption and careful filtering protect against all three.',
        technical: ['BCP 38 ingress filtering stops spoofed sources at the edge. SYN cookies remove state from the handshake. Closed resolvers and RRL stop DNS amplification.', 'TLS/SSH defeat sniffing; Secure/HttpOnly cookies over HTTPS defeat session hijacking; HSTS defeats SSL stripping.'],
        diagram: { kind: 'sim', id: 'https-tls' }, example: 'Compare the plain HTTP POST and the TLS Application Data record in the HTTPS simulation — same request, very different exposure.',
        exercise: { kind: 'classify', prompt: 'Which control best addresses each threat?', buckets: ['Encryption', 'Filtering / rate limiting', 'Stateless handshake'], items: [['Packet sniffing', 0], ['DNS amplification', 1], ['SYN flood', 2], ['Session hijacking via HTTP', 0], ['IP spoofing', 1]] },
        check: ['q28', 'q31', 'q32'], summary: ['Filter spoofed sources at the edge.', 'SYN cookies stop SYN floods.', 'Encrypt everything sensitive.'],
      },
    ],
  },
];

export const ALL_LESSONS = COURSES.flatMap((c) => c.lessons.map((l) => ({ ...l, course: c })));
