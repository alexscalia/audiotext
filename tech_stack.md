WEB
Core: NextJS + Tailwind + Radix UI
Data: TanStack Table (Logic) + TanStack Virtual (Performance)
Analytics: Tremor (High-density charts)
Backend & Safety: HonoJS + Zod (Shared types via RPC)
Fetching: TanStack Query (Syncs Hono data to your tables)
DB: Postgres

SIPRecommended Hybrid ArchitectureTo maximize active calls on your stack, avoid "hairpinning" media through your application.Signaling Layer (Kamailio):Receives the INVITE.Queries your Rust/Hono API (or a Redis cache populated by them) for the LCR decision.If it's a Wholesale Call: Rewrites the SIP headers and forwards to the Carrier IP. (Audio goes via RTPEngine).If it's an IVR Call: Routes the call to a FreeSWITCH cluster.Media Layer (RTPEngine vs. FreeSWITCH):RTPEngine: Sits on the edge. It relays raw UDP audio packets between your customer and the carrier. It uses almost zero CPU.FreeSWITCH: Sits behind the firewall. It only handles the small % of traffic that requires actual file playback.