---
title: Two-player expedition networking
tags: [networking, rooms, testing]
---

# Two-player expedition networking

The expedition is a separate, unsaved mode at `?mode=expedition`. **Create expedition** requests Internet Identity if needed, then creates an invite and makes the host ready. Opening the link restores or requests the guest’s account, then connects directly; no Create or Join choice is shown on that route. The guest chooses **Ready**, then the host chooses **Start expedition**. The Solo / Co-op switch sits above both title headings, and the co-op menu exposes its invite paste/code form below Create expedition. Either player can drive; the second seat is a passenger seat. Get out and back in to change roles. The winch belongs to its carrier, then to the player who attached it. Both players can carry supplies, place supports, push, collect fallen cargo and mark a point. Actual verification and remaining release gates are in [Status](./status.md).

## Entry and lobby behavior

A single bundled map has no map picker; it reappears automatically when the catalog contains more than one map. The compact upper-right Forest Crossing card shows abstract forest artwork, an authored 5–10 min estimate, Moderate difficulty and 3 paths; it does not expose actual terrain or object positions. In-world signs still label the route **Local build → Production**. These are gameplay labels, not infrastructure status or a deployment action.

Invite URLs enter the guest flow immediately. The saved account is restored first; an unsigned recipient signs in once, then continues into the same room. Cancelled sign-in preserves the invite for retry. [Account entry and measurement](./multiplayer-accounts.md) defines the current behavior, aggregate analytics and future measurement. Hosting removes any stale `room` URL parameter, and leaving a room clears it before showing the menu. Host and guest have distinct role labels and the same abbreviated room ID. Only the host sees Copy invite link; the full text input appears only if clipboard copying fails. Once connected, sharing controls disappear. The host has one Start action after the guest is ready; the guest has one Ready action. A malformed/expired invite remains in the guest/error flow until the player deliberately returns to the menu. It never creates a replacement room.

The shared header exposes independent Music/Sound toggles and the current Internet Identity state. Its profile button opens the existing garage before team entry; joining freezes that crew presentation and disables account edits until leaving. Header sign-in opens the account without creating a room; invite sign-in retains its original guest intent.

Reliable readiness received after a validated hello is retained even if the local final signaling reply is still pending. This prevents a fast host from losing readiness while the guest completes ICP onboarding.

## Ownership and timing

The host runs one Rapier world at 60 fixed steps/s. `stepPlayers` receives both players' controls; `action(action, playerId)` performs distance, occupancy and ownership checks in that world. Guests render received state and never advance their own world. Camera movement is immediate; character/vehicle movement waits for authoritative snapshots. This first implementation has no guest prediction.

`src/network/peer.ts` owns only RTCPeerConnection and two negotiated data channels: ID 0 `state` is unordered with zero retransmissions; ID 1 `events` is ordered/reliable. `src/network/protocol.ts` validates packets, bounds input, implements input expiry and the interpolation buffer. `src/expedition.ts` owns lobby, session generation, round epoch, UI, signaling cancellation, fixed steps and pause. `src/services/rooms.ts` uses the existing account identity from `Account.sessionIdentity()` for caller-bound room requests. It creates no temporary identity. Team members must use different accounts. The existing profile backend and solo records rules are unchanged.

State and input are sent at most 20 times/s. Input sequence numbers reject reordered controls; 350 ms silence returns movement/reel/push to neutral. Discrete actions have a monotonically increasing sequence and run at most once. A round `epoch` rejects delayed messages from a previous restart. Host actions use the same simulation API as guest actions. The guest buffers up to 12 snapshots and rejects stale ticks. Playback uses host `tick × fixed timestep` timestamps, advancing with the guest render clock rather than spacing states by packet arrival. Startup and buffer recovery wait for 100 ms of host history; uneven packet arrival within that cushion does not change playback speed. On underrun, playback holds the latest known pose and refills the cushion before resuming, with no extrapolation or local prediction. Pause/resume and new epochs clear the playback clock. History overflow bounds catch-up after a long renderer suspension. Long outages or a host that cannot sustain real-time physics can still cause visible holds; guest input latency remains.

Packets are bounded to 48,000 characters and channel backlog to 96,000 bytes. State sends are skipped above that backlog; reliable overflow ends the connection visibly. Full snapshots repeat player/prop ownership, transforms, vehicle/wheels, modules/capabilities, winch, recovery, progress and a bounded cargo-event history. Descriptions/prompts are plain text. Network snapshots validate safe positive event sequences and known cargo event/module catalogs before rendering. The client deduplicates event sequences; a bounded unreliable history can lose an event when snapshots are dropped, and this is not lossless delivery. This is cooperative host authority, not competitive anti-cheat.

## Protocol 2

| Packet | Channel/direction | Fields and behavior |
| --- | --- | --- |
| `hello` | Reliable, both | `key`: map ID, content version, SHA-256 of JSON `{map,fieldKit}` (validated map plus shared `config.fieldKit` tuning), `net3`; plus `profile {nickname, skin {color,wheels,decal}}` for bounded crew presentation. Mismatch/invalid presentation rejects the connection. Host skin controls the shared bus; no principal/listing preference is sent |
| `ready` | Reliable, both | Host readiness is sent on handshake completion; guest sends it on Ready; host start requires both |
| `start` | Reliable, host → guest | New `epoch`, full `snapshot`, `prompt`, `message`; resets interpolation |
| `input` | State, guest → host | `epoch`, `sequence`, `frame` with movement/yaw, sprint, brake, reel, held interact and push |
| `action` | Reliable, guest → host | `epoch`, `sequence`, `action`: interact/winch/jump/drop/park/ping/cycleTarget; interact includes the displayed optional `targetId` (bounded kind-prefixed ID). The host revalidates reach, ownership and restrictions, rejecting stale IDs without substituting another target |
| `state` | State, host → guest | `epoch`, full `snapshot`, guest `prompt`, shared `message`; final state also sent reliably |
| `pause`, `resume` | Reliable, both | `epoch`; host authorizes resume and sends a full snapshot with it |
| `visibility` | Reliable, both | `hidden`: a hidden participant pauses the session and blocks resume until returning |
| `heartbeat` | State, both | Once per second, including pause; no gameplay mutation |

Cargo-loss notices are shared with solo. The host consumes ejections on fixed simulation ticks; the guest consumes authoritative snapshot events using active render time. Both peers hide and freeze the notice while paused or stalled, resume its remaining three-second lifetime, dismiss it when the lost module is docked, and clear consumption state for a new `epoch` or expedition. Initial loose cargo and manual drop/removal events remain quiet. A later event replaces an earlier one; duplicate, stale, malformed and old-epoch snapshots do not replay it.

Expedition snapshots carry `interaction.target {id,label,index,total}` when a target exists: stable kind-prefixed ID, display name, one-based selected index and candidate count (maximum 40). Each player has independent selection; X is a reliable host-owned cycle action. The client uses the selected snapshot for its outline, label, prompt and interact ID. This adds no ICP calls. net3 rejects older peers that could act on a different target; both players must reload and create a fresh invitation.

Either participant can pause. Input and held interactions clear for both. Two seconds of packet silence pauses gameplay; disconnection/failure ends the session with a visible explanation. Restart belongs to the host. Reload/departure ends the room; reconnection and host migration are deferred. A live match does not depend on its invitation surviving on ICP. Two best-effort analytics milestones (connected/first start) now use independent six-hour reporting sessions; see [collection semantics](./multiplayer-accounts.md).

## Separate rooms canister

`src/backend/rooms.mo` has no reference or calls to the records canister. It stores at most 128 rooms with ten-minute invitation lifetimes, one invitation per host account (a new invite replaces that account’s older one), exactly two distinct caller-bound seats, one immutable offer and answer (at most 32,000 characters each), and map key (at most 160 characters). A cryptographically random 80-bit code locates the room. Possession of an unused invite allows claiming its guest seat; share it only with the intended teammate. The map itself stays in the bundled registry.

All signaling methods are updates. `create(code,mapKey,offer)`, `join(code)`, `answer(code,sdp)` and `poll(code)` return `ok {mapKey,offer,answer:opt text,joined,sessionId:opt nat}` or `err text`. `close(code)` is idempotent and only members can remove the room. Anonymous callers cannot create/join; the host cannot claim the guest seat under the same account. Only members can poll, only the guest can answer. The client closes only rooms it successfully created/joined, so a rejected self-join cannot delete the host’s invite. Exact retries retain membership and SDP. Changed descriptions require a fresh room. Expired entries are pruned on activity; idle storage remains bounded. These bounds limit storage, not Sybil-based denial of service.

Complete ICE gathering precedes publication (no trickle candidates). The host polls every two seconds until an answer; polling stops once the peer connection is established. Update responses authenticate the SDP through ICP consensus. This deliberately replaces the earlier query/cursor plan and avoids an uncertified signaling response path. Canister latency affects joining only; no per-frame calls or live polling remain. There are no cross-canister calls or attached cycles, compatible with Cloud Engine constraints.

## Local verification

The following uses a disposable local network, not the published engine:

```sh
npm run rooms:build
npm run test:rooms
npm exec -- icp network start -d
npm exec -- icp deploy records -e local
npm exec -- icp deploy rooms -e local
ICP_LOCAL_BACKEND=1 npm exec -- playwright test browser-tests/expedition.spec.ts
```

The focused guest timing regression is `ICP_LOCAL_BACKEND=1 npm exec -- playwright test browser-tests/expedition-jitter.spec.ts`; it adds 0/70/10/40 ms delivery delays to real guest WebRTC state messages and checks physical walking, pause/resume and a new round. Constant-speed playback under jitter, packet loss, underrun recovery and clock reset are covered by `tests/snapshot-timing.test.ts`.

The focused invite/menu regression is `ICP_LOCAL_BACKEND=1 npm exec -- playwright test browser-tests/expedition-invite.spec.ts`; it covers guest exploration, signed entry, cancellation/retry with the same invite, a rejected same-account join, account restore, and two distinct accounts starting together. Only the human II gesture is substituted; profile/room calls use signed identities and real local canisters.

For interactive testing, run `ICP_LOCAL_BACKEND=1 npm run dev`, open Expeditions, sign in and create a room, then open its invite in a second browser profile/device that can reach the server and sign in with a different II account. The default Vite address is loopback; browser automation uses two contexts on that machine. `vite.config.ts` obtains local canister IDs and root key from the CLI at startup and proxies `/api`; both accounts and rooms canisters are required for team entry. Restart Vite after installing a missing canister so it picks up its ID. Stop the local network with `npm exec -- icp network stop` when finished. Local profiles are separate from production; this does not migrate or overwrite live data. Plain Vite has exploration available and disables team-room buttons with an explanation.

## Cloud Engine and TURN gate

Release 0.7.0 is published on the existing nano-tema engine. The rooms canister is `zsua7-paaaa-aaabz-aadfq-cai`; the frontend remains `z4wnx-uqaaa-aaabz-aadeq-cai` and records remains `zvvgl-cyaaa-aaabz-aadfa-cai` at 0.6.0. The deployed frontend cookie and settings contain the verified rooms ID. That initial release used direct ICE only. The VPS TURN addition below is verified separately; frontend 0.8.1 now includes it.

The repository adds `rooms` beside the existing frontend/records entries in `icp.yaml` and `mops.toml`. Preserve existing production mappings. Install the new rooms canister and upgrade/sync the frontend on the owner's existing engine; do not reinstall records. Verify the frontend's `ic_env` includes the real `PUBLIC_CANISTER_ID:rooms` after deployment. No production identifier for rooms is assumed in code. The existing general deployment command now includes all three configured canisters; use a targeted deployment when records do not need upgrading.

Development defaults to direct ICE. Production `.env.production` sets `VITE_ICE_CONFIG_PATH=https://turn.62-84-183-92.sslip.io/connection-config`. The client accepts same-origin paths or external HTTPS URLs, omits cookies and does not cache credentials; CSP permits this single external origin. Errors remain visible instead of silently falling back. The endpoint returns STUN plus TURN UDP/TCP URLs and temporary credentials; `iceTransportPolicy:"relay"` can force a transport check.

### VPS operation

The owner authorized `ssh contabo` on 2026-09-07. Ubuntu coturn listens on public IPv4 port 3478 (UDP/TCP); UDP relay allocations use 49160–49415. Caddy serves the issuer's HTTPS hostname, proxying to loopback 9187 and overwriting its client-IP header. Existing websites retain ports 80/443. Source configuration is in `ops/turn/`; the issuer runs as a sandboxed dynamic systemd user. The root-only `/etc/rv-turn/issuer.env` stores the shared secret, also installed in root/turnserver-readable `/etc/turnserver.conf`; no secret is shipped to the browser or repository. Original Caddy/coturn configs are backed up under `/etc/rv-turn/`.

Credentials expire after 3,600 seconds. Start a fresh room to obtain fresh credentials; uninterrupted sessions beyond one hour are not guaranteed. Issuance permits the two game origins, 20 requests/IP/minute and 500 total/minute. Origin filtering is not authentication and can be spoofed outside a browser. Coturn enforces four allocations/username, 100 total, 1,000,000 bytes/s per session and 10,000,000 bytes/s aggregate, and denies private/link-local/multicast peers. Capacity is deliberately bounded; abuse can still consume availability within these limits. TURN/TLS on 443/5349 is not configured, so networks blocking 3478 may still fail. The hostname uses the VPS's existing sslip.io naming convention and depends on that DNS service.

```sh
ssh contabo 'systemctl is-active coturn turn-issuer caddy'
node scripts/check-turn.mjs
```

The browser check applies the current published CSP to a blank presentation page, fetches credentials from the game origin, forces relay separately over UDP and TCP, exchanges an echoed data-channel message and verifies both selected candidates are relays. It creates no production room, account or analytics events. Two physical devices on separate networks, 100 ms RTT / 1% loss and a complete human cooperative run remain separate acceptance gates. The operational disable command is `ssh contabo 'systemctl disable --now coturn turn-issuer'`; disabling the issuer makes configured game joins fail visibly until service is restored or the frontend configuration is changed.

Transport semantics were checked against [MDN data channels](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel) and [ICE gathering state](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/iceGatheringState).

## Co-op milestone API

`report(sessionId, #connected | #started)` is a member-signed update independent of signaling. It returns `#ok` or a permanent `#err` for missing/expired sessions or nonmembers. Both role flags must exist to increment a pair counter; retries and restarts are idempotent. `adminStatistics()` is a restricted query returning `since`, `roomsCreated`, `guestsJoined`, `pairsConnected`, `expeditionsStarted`, `sessionsEvicted`; the last five are lifetime Nat counters. Reader management is controller-only and separate from records. The original Room layout and all signaling methods remain upgrade-compatible; pre-analytics rooms return no session ID.
