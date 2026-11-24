# NETLAB — Interactive Network & Protocol Explorer

NETLAB is an interactive network laboratory. You can watch packets cross a network, decode every header field down to the bit, run guided and attack simulations, use real calculators, and study with lessons and exams.

> **About the packets:** every packet in NETLAB is *generated* by the in-browser packet builder (`src/engine/packet.ts`). It produces real header layouts, real field encodings and correctly computed IPv4/TCP/UDP/ICMP/ICMPv6 checksums. These are **simulated packets, not captured traffic**, and the UI marks each one with a `SIMULATED` badge. All addresses come from private or documentation ranges (RFC 1918, RFC 5737, RFC 3849).

## Features

| Area | What works |
|---|---|
| **Protocol explorer** | 32 protocols (IPv4, IPv6, ARP, ICMP, ICMPv6, IP routing, TCP and its handshake, termination, retransmission, flow and congestion control, UDP, DNS, DHCP, HTTP, HTTPS, TLS, SSH, FTP, SMTP, POP3, IMAP, WebSocket, Ethernet, VLAN, STP, NAT, PAT, Routing, OSPF, BGP). Each one covers 10 sections: what it is, why it exists, the problem it solves, its OSI layer and TCP/IP mapping, a step-through sequence diagram, important fields, real-world uses, security and troubleshooting. Most also include a decodable example packet. |
| **Packet animation engine** | SVG/HTML topology with clients, servers, routers, switches, firewalls, DNS and DHCP servers, access points and the Internet cloud. Paths are found by BFS. Controls: Start, Pause, Resume, Restart, Next, Previous, speed 0.25–3× and Reset, plus keyboard shortcuts. Packets can be broadcast to several devices or dropped at a device, with per-hop notes. Click any device to inspect it and see its state tables (ARP cache, NAT table, routing table, DHCP bindings). |
| **Packet inspector** | Wireshark-style **Simple / Technical / Hex** views. Includes a key-field summary (MACs, IPs, ports, protocol, length, TTL/hop limit, seq/ack, flags, checksum, payload), a collapsible field tree, a hex or binary dump with byte↔field highlighting, and per-field explanations with bit breakdowns. |
| **Guided simulations** | A Opening a website (DNS → TCP → TLS 1.3 → certificate checks → HTTP), B DHCP DORA, C TCP handshake, D Routing with Layer 2 rewrite, E ARP, F Ping (adjustable count, loss and delay), G HTTPS/TLS vs HTTP, H NAT/PAT, I TCP retransmission and teardown. |
| **Security lab** | ARP spoofing, DNS spoofing, IP spoofing, SYN flood, MITM (evil twin), packet sniffing, session hijacking, DHCP starvation, VLAN hopping and DNS amplification. Each lab covers the explanation, vulnerabilities, detection and mitigation, and has a **Defence ON/OFF** toggle that replays the scenario with the control in place. Everything is simulated and nothing leaves the browser. |
| **OSI lab** | A clickable 7-layer model (responsibilities, protocols, devices, PDU, headers, examples, problems) and an animated encapsulation/decapsulation walkthrough. |
| **Tools** | Subnet calculator (with binary view and subnet splitting), binary/hex/IPv4 converter, searchable port explorer, DNS lookup simulator (A/AAAA/MX/CNAME/NS/TXT/PTR over a fictional zone), routing table explorer (longest prefix → AD → metric, editable table) and a packet header builder. |
| **Learning** | 8 courses with 16 lessons. Each lesson has objectives, a simple and a technical explanation, a diagram or simulation, an example, an interactive exercise, a knowledge check and summary notes. |
| **Exams** | Multiple choice, true/false, scenario, drag-and-drop ordering, packet interpretation, and generated subnetting questions checked by the calculator engine. You get immediate feedback with explanations. |
| **Progress** | Recently explored items, bookmarks, completion tracking and Recharts analytics. Progress is saved in localStorage and can be exported or imported. It can optionally sync to the server. |
| **Search** | Global search with Ctrl+K or `/`, covering protocols, ports, packet fields, devices, OSI layers, troubleshooting text, lessons, simulations, tools and a 60-term glossary. |

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS 4, Framer Motion, Lucide icons, Recharts, React Router (hash routing, so no server rewrites are needed). The optional backend uses Node.js 20+, Express, PostgreSQL, bcrypt and JWT. Everything is free and open-source, with no paid APIs.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 35 unit tests: packet encoders, checksums, subnetting, content integrity
npm run build        # static site in dist/
```

The front end runs fully on its own: no backend and no external services are required.

### Optional: accounts and server-side progress

```bash
cd server
npm install
cp .env.example .env            # set JWT_SECRET (and DATABASE_URL for persistence)
npm run dev                     # API on http://localhost:8787
npm test                        # API tests (in-memory PostgreSQL via pg-mem)
```

Then build or run the front end with the API URL:

```bash
VITE_API_URL=http://localhost:8787 npm run dev
```

The **Settings → Account & cloud sync** panel then lets users register and log in. Progress syncs automatically while signed in.

API overview:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | Health check (also checks the database) |
| POST | `/api/auth/register` | — | `{email, password, name?}` → `{token, user}` |
| POST | `/api/auth/login` | — | `{email, password}` → `{token, user}` |
| POST | `/api/auth/logout` | Bearer | Client discards the token (JWTs are stateless) |
| GET | `/api/me` | Bearer | Current user |
| GET / PUT | `/api/progress` | Bearer | Read or replace the user's progress JSON (≤256 KB) |
| GET | `/api/admin/stats` | Bearer + `admin` role | User counts |

Security measures: bcrypt password hashing (cost 12), HS256 JWTs with a 7-day expiry, rate-limited auth endpoints, constant-time handling of unknown e-mails, Helmet headers, a CORS allow-list, request size limits and parameterised SQL. Set `ADMIN_EMAIL` to promote a registered user to `admin`. The schema is in `server/schema.sql` and is applied automatically on start-up.

## Deployment

**Front end on Vercel (free):** import the repository. `vercel.json` already sets `npm run build` → `dist`. Add `VITE_API_URL` only if you deploy the API. The build is static and uses hash routes, so it also works on GitHub Pages, Netlify or any static host.

**Database on Supabase (free):** create a project and copy the connection string from *Project Settings → Database → Connection string (URI)* into `DATABASE_URL`. Neon also works.

**API on Render (free):** `render.yaml` defines the service (root `server/`, `npm ci`, `npm start`, health check `/api/health`). Set `DATABASE_URL` and `CORS_ORIGIN` (your Vercel URL). `JWT_SECRET` is generated for you. Note that free Render instances sleep when idle, so the first request after a pause is slow.

## Project structure

```
src/
  engine/   bytes.ts (address parsing, checksums), packet.ts (byte-accurate encoders), sim.ts (scenario model, BFS paths)
  data/     protocols.ts, guided.ts, attacks.ts, knowledge.ts (OSI, ports, glossary, DNS zone, routes), lessons.ts, questions.ts
  components/ Layout, SimPlayer, PacketInspector, Sequence, Questions, ui
  pages/    Explore (dashboard, protocols, simulations, search), Osi, Tools, Learn (courses, exams, progress, glossary, settings)
  lib/      store.ts (localStorage state), catalog.ts (search index), subnet.ts, api.ts (optional backend)
server/     Express API, schema.sql, tests
```

### Adding a simulation

Add a `Scenario` to `src/data/guided.ts` (or `attacks.ts`). Define `devices` (x/y in 0–100), `links` and `steps`. Each step gives `from`, `to` (one id or several), a `title`, `text` and an optional `packet` spec (`{eth, ipv4|ipv6|arp, tcp|udp|icmp|icmp6, app}`). The packet is encoded automatically. The data tests (`src/data/data.test.ts`) check that every device reference, path and packet is valid.

## Verification performed

- Unit tests reproduce the textbook IPv4 header checksum (`0xb861`) and verify that every generated IP, TCP, UDP and ICMP checksum sums to zero. They also check that field ranges tile each packet exactly, and test IPv6 RFC 5952 formatting and subnet edge cases (/0, /31, /32).
- Every scenario (normal and mitigated), protocol sample and exam packet builds and validates.
- A headless Chrome run covered every route at desktop and mobile widths with no console errors, and exercised the calculators, exam scoring, lesson flow and account registration/sync against the API.

## Licence

MIT. Protocol descriptions are summarised from the RFCs and IEEE standards cited on each page.
