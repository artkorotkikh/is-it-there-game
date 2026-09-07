---
title: Multiplayer accounts and measurement plan
tags: [accounts, multiplayer, analytics, planning]
---

# Multiplayer accounts and measurement plan

## Implemented account entry

Two-player expeditions require the existing Internet Identity account. Solo deliveries and local exploration remain available without signing in. The client restores its saved session first. Create or an invite without a session opens one sign-in action; successful authentication resumes that same host/join intent. Cancellation keeps the invitation available to retry; leaving cancels the pending intent. Missing profile data offers a retry before joining. No new solo run/ticket or leaderboard opt-in is created by multiplayer entry.

`Account.sessionIdentity()` returns the account identity only while its session and principal still match. `connectRooms(identity)` uses it directly for signed room calls; it no longer generates an independent identity per tab. The backend binds seats to the signed caller and rejects anonymous requests. This is caller authentication, not a backend proof that a credential was issued specifically by Internet Identity: a custom client can use its own signing key. Session validity is checked at entry; an established WebRTC match does not poll II or terminate just because its delegation later expires.

Host and guest must use different accounts. On one computer, use separate browser profiles or a normal/private pair, and authenticate with different II accounts. The same host account produces an explicit error and must not delete the host's invitation. Reloading and creating a fresh invite replaces only that account's older invitation. This affects signaling, not an already established WebRTC match. The header shows Sign in, Connecting… or the saved nickname. Header sign-in opens the existing garage without creating/joining a room; invite sign-in still resumes its room. Signing out in the garage clears the displayed account and bus appearance. Account edits are unavailable during a team session so the agreed crew identity/appearance cannot drift; leave the team to edit them.

The lobby shows both saved nicknames. The shared bus uses the host's existing saved garage appearance, copied to the guest during the validated handshake. These values are plain-text, catalog-bounded peer presentation, not a server-certified public profile lookup. Account principals and leaderboard preferences are not sent in the hello packet. Network protocol 2 requires this presentation payload; older clients cannot silently join. Existing profile fields, nickname validation, II derivation origin and records persistence are unchanged.

## Character appearance — next small feature, not implemented

Offer a small catalog of four to six outfit presets in the existing profile, with a character preview. Each player selects their own look; both peers see it. Keep names and outfits visible in the lobby without adding mandatory setup steps. Character appearance should be independent of the shared bus: hosting selects the bus look, never the guest's clothes.

Only visual colors/clothes change. Driving, carrying, pushing and winching remain available to both players; appearance grants no strength, speed, ownership or role advantage. Do not introduce unlock currencies or progression in this first pass. Persist a bounded preset ID through an additive profile API/storage extension that leaves the current `Profile` record and old-client saves compatible. Require actual prior-Wasm upgrade, isolation and retry tests before changing persistent storage. Runtime/physics snapshots need not contain cosmetic assets; a versioned reliable crew payload is enough.

## Implemented collection — 0.8.0

The first release implements aggregate counters in the existing rooms canister, with a separate collection timestamp. It does not change records/profile storage or send data to an external service.

| Counter / dashboard | Authoritative trigger | Deduplication |
| --- | --- | --- |
| `roomsCreated` / Rooms created | New accepted room creation | Exact create retries return the same room/session; failed creates are excluded |
| `guestsJoined` / Guests joined | First accepted guest-seat claim | One per room; retries, self-join and full-room rejections excluded |
| `pairsConnected` / Teams connected | Both members report validated hello + completed signaling | One per internal session; a joined guest alone is not a connection |
| `expeditionsStarted` / Expeditions started | Both members report entering the game, with both connection reports present | First start per session; restarting the same room does not add another |

These count invitations and pairs, **not unique people**. Creation/join are server observations; connection/start are signed browser reports and can be absent or dishonest. The aggregate funnel combines all maps/releases and is not a timestamped cohort analysis. Legacy live rooms at upgrade retain signaling but have no analytics session ID and are not backfilled. Earlier games cannot be reconstructed.

`Room` retains its old persistent shape. A separate bounded reference map links live invites to monotonically increasing internal numeric session IDs. Session records retain only authenticated host/guest principals, expiry and deduplication flags for up to six hours, separately from the ten-minute invite TTL. Closing or replacing an invite deletes its reference but does not invalidate already-issued reporting IDs. No SDP, invite URL, position stream or public relationship log is copied into analytics. Expired sessions reject reports immediately and are pruned on create/report activity. At 5,000 retained sessions, the oldest ID is evicted rather than blocking game creation; lifetime `sessionsEvicted` makes possible undercount visible. Aggregates contain no principal or session IDs and survive upgrades.

`CoopTelemetry` sends at most two distinct milestones per client/session. Reports are serialized in the background with an eight-second timeout, at most three attempts and 1.5/3-second retry delays. Retries use the identical session/event and cannot inflate counters; a permanent authorization/expiry error stops retrying. Leaving a team cancels queued retries; an in-flight accepted fact may still finish. Reporting failures never pause gameplay. The admin panel does not send milestone reports.

The existing statistics panel reads `rooms.adminStatistics()` using its own signed identity and a separate bounded reader grant on rooms. Current authorized records readers are mirrored during rollout without changing records permissions. Later grants/revocations must be applied to both services; neither service delegates access to the other. The panel shows four cards, separate collection time, capacity warning when relevant and a dedicated co-op CSV. It retains solo data when the co-op query fails or access is denied, hides co-op numbers/export on failure and clears all data on logout/expiry. Refresh is manual.

## Future measurement goals — not implemented in this release

Historical audit before 0.8.0, during the 0.7.1 frontend release: `src/expedition.ts` sends gameplay/signaling messages but no analytics milestones; `src/backend/rooms.mo` stores only the bounded expiring room map, with no historical counters or analytics read API. The separate panel reads solo aggregates from records. Created rooms, joined accounts, completed peer connections and expedition starts are therefore unavailable as historical metrics. Expired/replaced/closed rooms cannot reconstruct those totals. Room joins would measure accepted accounts, not unique people or a working peer connection; those need separate, explicitly defined counters. No telemetry is added by the interaction-fix deployment.

Solo analytics in records continue to count opens, deliveries and first saves. The aggregate co-op implementation above supersedes the earlier no-collection state. The richer event plan below remains future work: finishes, per-round restarts, distinct accounts, diagnostic timelines, direct/relay categories and host/guest history are not collected.

First answer three questions: can an invited teammate actually connect, do connected teams begin/play/finish, and do guests later invite someone themselves? A room creation count alone cannot answer these. Use the existing ICP infrastructure, a small bounded diagnostics store in the rooms actor, and controller-only queries; no external analytics service is needed for the first release.

| Proposed event | Trigger / source | Useful properties | Decision it supports |
| --- | --- | --- | --- |
| `invite_opened` | Client opens an invitation route | client attempt ID, release, entry route | Are recipients reaching the game? Client-reported, not a server-verified join. |
| `team_signin_started`, `team_signin_completed`, `team_signin_cancelled` | Auth UI starts/succeeds/cancels | attempt ID, host/guest intent; restored sessions recorded separately | Is the account gate losing players? Never count session restore as a new signup. |
| `room_created` | First accepted `create` update | internal session ID, map ID/version, release, server time | Invitation supply; exact retries count once. |
| `room_joined` | First successful guest-seat claim | session ID, signed participant role, server time | Did another account accept the invitation? Does not mean WebRTC works yet. |
| `peer_connected` | Each peer completes validated hello and signaling | session ID, role, connection duration in ms, direct/relay category | Where does signaling/connectivity fail? Count a connected pair after both reports. |
| `player_ready` | Guest selects Ready; host readiness starts at room creation | session ID, role, ready time | Is the lobby understandable? |
| `expedition_started` | Host starts a round and guest acknowledges its start | session ID, round number, map/version | Main conversion: a team actually entered the game. Distinguish host-only start reports. |
| `expedition_finished` | Host reports the goal and guest receives final state | session ID, round number, elapsed ms, per-role confirmation | Can teams complete the route? Browser-reported, not tamper-proof scores. |
| `expedition_restarted` | Host starts the next round | session ID, previous/new round | Do people retry or explore another route? |
| `connection_failed`, `session_ended` | Explicit connection failure or leave/finish; inactivity expiry separately | stage, finite reason code, last confirmed milestone, duration | Separate expired invites, same-account/full-room errors, ICE failure, disconnection and deliberate departure. |

Stage is a fixed enum: invitation, authentication, signaling, lobby, playing. Reason codes are bounded identifiers, never raw error payloads. A vanished tab is classified as unknown/abandoned after expiry, not fabricated as a voluntary leave. A room can finish and later restart: milestones belong to a numbered round, not one terminal flag on the whole room.

## Who joined whom and data bounds — proposed

Keep a controller-only session record with server-derived `hostPrincipal`, `guestPrincipal`, internal session ID, map/version and milestone timestamps. This answers who hosted and who joined without relying on non-unique nicknames or client-supplied account IDs. Use the caller/membership record as authority. Show nicknames in the game; do not expose a public list of account relationships.

The analytics session ID must be separate from the invite code. An invite is a capability to claim the guest seat: never export the full invite URL/code to analytics, referrers or logs. Do not retain SDP, ICE candidates/IP addresses, delegation material or key data in diagnostic history. Keep only a direct/relay category and timing summaries for connection analysis. Standard signaling still needs its existing bounded SDP storage while the invitation is live.

Proposed retention: at most 5,000 recent session summaries and 14 days of detailed host/guest associations, whichever bound is reached first. Expired rows are excluded from reads immediately; bounded cleanup occurs during activity. Lifetime aggregate milestone counters omit account/session identifiers. This is limited operational data, not indefinite social-graph history. Account identity is pseudonymous, not anonymous. Controller rotation must be honored on every diagnostics query, as for solo statistics.

Analytics must never gate simulation or continuously poll ICP. Queue a few asynchronous milestone reports with bounded retry; their failure leaves gameplay running. After signaling expires at ten minutes, reporting needs its own bounded member-bound session record/window (proposed six hours), not an invite renewal or arbitrary client ownership claim. Deduplicate reports by `(session ID, round, caller, event)`; server creates/joins count in the same atomic update as the accepted transition. Unknown delivery outcomes retry the same key. Analytics reads never create activity.

## First report and acceptance — planned

- Created rooms → accepted guest → both peers connected → both started → finished: counts and conversion rates by map/release. Keep invitation cohorts old enough to connect; do not treat every fresh unanswered invite as a failure.
- Median and p90 create-to-join and join-to-connected time. Identify the slow stage before tuning network behavior.
- Failures by stage/reason and direct/relay category. Client reports can be absent or dishonest; distinguish server observations from client reports.
- Starts, finishes, restarts and connected play duration per team/round. This is stronger evidence than room count but does not prove enjoyment.
- Later, for level tuning, attach small per-round totals for planks placed, stones moved, winch attachments, recoveries and driver swaps. Use these to see whether both players use the mechanics; avoid per-frame positions or a log of every keypress.
- Within the retained window: guests who later host, repeat pairs and accounts returning for another team session. Call new arrivals first-seen co-op accounts, not newly registered people. This measures the invitation loop without assuming clipboard copy means an invitation was delivered.

Before implementation is marked complete, test caller/controller isolation, deduplication, retention/capacity, real prior-Wasm upgrade, analytics failure during gameplay, and one complete two-account milestone journey. Run `npm run docs:check` when updating this plan. Richer telemetry beyond the four aggregate counters, character presets, long-term progression, reconnect, bans/friends lists and a public team leaderboard are separate future work.
