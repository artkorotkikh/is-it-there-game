---
title: Tracks, profiles and leaderboard
tags: [tracks, identity, persistence]
---

# Tracks, profiles and leaderboard

Authorized on 2026-09-05: add Internet Identity, personal completion times and two more solo levels. Multiplayer is explicitly outside this iteration. This document describes the implementation; check status for verification and the version currently deployed.

## Tracks

| ID | Route | Finish Z | Distinct challenge |
| --- | --- | --- | --- |
| `old-road` | 01 / The old road | 112 m | Beginner forest route, two broad low bumps, a shallow driveable dip and one gentle bend |
| `relay-ridge` | 02 / Relay ridge | 190 m | Cold mountain palette, narrower road, steeper shoulders and three alternating physical roadblocks along S-bends |
| `finality-quarry` | 03 / Finality quarry | 228 m | Dusty violet quarry, six marked bumps/rollers, wide S-bends and a longer final climb |

All three routes are immediately selectable; there is no account or progression lock. Every normal route starts with three loose modules and requires loading them. Hard hits anywhere can eject any installed module, including CYCLES, and reinstalled modules can fall again. Slow crossings preserve cargo. Each route retains its primary recovery tree and has additional orange-banded anchors on both shoulders every 28 m. The first route can climb out under engine power; its winch is optional and the HUD explains that. The other recovery slopes remain demanding. Recovery criteria remain track-specific. The finish requires the driver aboard, actual ditch recovery and all three modules docked. A missing item keeps the delivery incomplete, even at the gate.

`src/game/tracks.ts` holds stable IDs, record rules versions, piecewise elevation and lateral centerline, bounds, colors, anchor/recovery positions, bump marker positions, `rolloverRockZ` (metres along each post-recovery straight), the `winchOptional` help-copy flag and obstacle dimensions. Each `Simulation` owns a `Level`; collision, ground sampling, safe exits, cargo recovery and cable support read the same instance. Renderer track switching disposes the previous scenery and meshes. Physics constants remain shared. Existing default terrain exports are compatibility helpers for original-route tests, not mutable global state.

Each course has an optional **ROLL TEST** rock on the +X verge of a flat straight: Z=77 m (old road), 81 m (ridge), 87 m (quarry). Aim one side onto the rising face to test rollover; drive down the centre to bypass it. The collider and visible faceted surface share one mesh. See [Canisters cargo](./canisters.md#percussive-maintenance) for recovery.

## Sign-in and driver log

Playing without sign-in is supported. Internet Identity is optional and the game requests no identity attributes such as email, legal name or wallet balance. The game stores only the nickname the player chooses or accepts by default. The account panel has Garage, My times and Leaderboard tabs. The driver log shows the player’s best time and completed deliveries per track. Detailed records are private to the signed caller. Current-course bests appear publicly only after the player enables sharing in the garage; no query accepts another player’s principal.

The browser uses pinned `@icp-sdk/auth` 8.0.3 and compatible `@icp-sdk/core` 5.4.0. Sign-in opens `https://id.ai/authorize` directly from the button gesture and requests the standard eight-hour, origin-bound Internet Identity delegation without a `targets` field. II currently returns unscoped delegations; asking for a records-only target caused signer 5.6.3 to reject the response after confirmation. SDK key, lifetime and origin validation remain enabled; backend records still enforce the ingress caller. Session keys stay in the SDK's browser storage. Restore, sign-out, cancelled sign-in and unavailable records have visible states. A small popup wrapper watches the same named window used by the pinned SDK: closing before the first handshake returns promptly instead of waiting for its 120-second establishment timeout. Successful automatic closure is given a persistence grace period. The SDK still owns the delegation protocol and origin checks. Blocked popups, cancellation, transport, storage and invalid-session failures have distinct safe messages; provider payloads and keys are never displayed. Account actions pause an active drive.

The permanent primary account origin is `https://z4wnx-uqaaa-aaabz-aadeq-cai.icp.net`. Official canister gateway aliases are canonicalized by Internet Identity. Local development uses its own origin. The custom game origin `https://isitthereyet.nano-tema--0v1.opencloud.org` is explicitly authorized by the primary’s `/.well-known/ii-alternative-origins` file. On that domain AuthClient requests the unchanged canister derivation origin, so the same Internet Identity maps to the original game principal. The two origins keep separate browser session storage: a first visit to the custom domain still requires sign-in. The JSON file lists only that exact origin without a trailing slash, and is served with application/json and wildcard CORS. Future aliases must be added explicitly; changing the primary derivation origin would change account identity. The primary serves `/.well-known/ii-app-metadata` with the game's name and description, JSON MIME and CORS. No personal identity attributes are requested.

Backend identity comes only from signed ingress (`caller`), never a principal supplied in request arguments. The frontend gets the backend ID and root key from the certified-assets `ic_env` cookie. Agents must not fetch a replacement root key on production or embed credentials in the frontend.

## Timer and saving

- Every online full delivery, including a guest start, obtains a server-issued ticket before the controls become active. No II login is required. Preparation has an eight-second UI timeout, a retry and **Play without saving** fallback; plain offline Vite starts immediately. Late responses cannot activate a discarded route. Practice bypasses tickets.
- Timer precision remains the fixed 60 Hz simulation step. Pause, hidden-tab suspension, loading and backend request time do not count. The display shows minutes, seconds and hundredths.
- At the full finish, `completeDelivery` freezes the elapsed milliseconds before login and counts one completion. **Sign in & join leaderboard** opens II directly from the click, then automatically claims that same result. No second drive is needed. The adjacent disclosure says this publishes the nickname, bus look and all current-course bests; garage opt-out still hides them.
- Players already signed in save automatically with their existing sharing preference. Private users can choose **Join leaderboard** on the finish. Signing in through the header at a guest finish saves privately unless sharing was already on.
- Cancellation leaves the finish/time in place. Failed confirmation or saving keeps an explicit retry. Successful retries never increment personal completions or aggregate saves twice. **View leaderboard** opens that course after publication; appearing in the top 20 still depends on the best time.
- Each full delivery has its own 256-bit random capability in tab memory; independent tabs do not replace one another. Signed starts bind to the starting account. A guest result binds atomically to the first signed claimant; retries under a different account fail. No query reveals capabilities or pending results. Leaving/reloading discards an unsent result; no cross-device pending-result recovery is promised.
- A run must finish within one hour of its server start and report 10 seconds–one hour, no more than server elapsed + two seconds. Once confirmed, claiming/retrying is available for 24 hours from start. Gameplay and record rules versions are unchanged by 0.6.0.
- The legacy `startRun` / `finishRun` API remains supported for older clients and active tickets, including its one-active-ticket-per-account rule. New claims do not replace legacy active tickets or retry receipts.

## Records canister

`src/backend/main.mo` is a persistent Motoko actor. Records, active ticket, last successful receipt, monotonic ticket counter, profile map, aggregate counters and bounded delivery/open-event maps survive upgrades. The build pins moc 1.15.1 and Motoko Core 2.6.1 through `mops.toml`/`mops.lock`. Mops generates `.mops/.build/records.did`; `npm run backend:build` (also used by backend tests) copies it to the checked-in `src/backend/records.did` for readable CLI decoding; the TypeScript IDL is exercised against actual Wasm by PocketIC tests.

| Method | Kind | Meaning |
| --- | --- | --- |
| `gameOpened(key)` | Public update | Count one ready game document, deduplicated by a random 32-byte key |
| `beginDelivery(key, track, rulesVersion)` | Public update | Issue a guest or caller-bound ticket; count one normal launch |
| `completeDelivery(key, id, elapsedMs)` | Public update | Confirm and freeze the finish using the matching secret capability and ticket |
| `claimDelivery(key, id, publish)` | Authenticated update | Bind a confirmed result to the caller, save once and optionally enable profile publication |
| `statistics()` | Controller-only query | Aggregate opens and per-course starts/finishes/saves since collection began |
| `version()` | Public query | Deployed service version |
| `myRecords()` | Caller-bound query | At most thirteen private track/version records |
| `myProfile()` | Caller-bound query | Optional saved nickname, cosmetic IDs and sharing preference |
| `ensureProfile()` | Authenticated update | Idempotently create a default profile, or return the saved one |
| `saveProfile(profile)` | Authenticated update | Validate and save the caller’s nickname, skin and publication preference |
| `leaderboard(track, rulesVersion)` | Public query | Up to 20 opted-in current-course bests, ordered fastest first |
| `startRun(track, rulesVersion)` | Authenticated update | Validate the route/version and issue/replace one active ticket |
| `finishRun(id, elapsedMs)` | Authenticated update | Validate the caller's ticket, update personal statistics, return an idempotent receipt |

Each result is `ok` or a bounded application error string. A record stores track, rules version, best/last milliseconds, completion count and server update time (nanoseconds). The caller is the account key; it is not duplicated in each result. A ticket contains ID, track, rules version and server start time. Receipts retain ID, resulting record and the new-best flag.

Legacy account limits: 10,000 accounts globally; at most one profile, thirteen records, one active ticket and one retry receipt per account; two seconds between active starts; a one-hour ticket lifetime; reported duration between 10 seconds and one hour. Reported simulation time cannot exceed server elapsed time by more than two seconds. Repeated successful submission with the same ID/time returns the prior receipt; changing the time on a used ID fails. No await occurs inside state mutations, so updates are atomic.

These are **personal, browser-reported times**, not tamper-proof competitive scores. The canister verifies identity, signed-start ownership or possession of a guest capability, single claim and timing bounds, but cannot prove local physics or detect a modified client. The public leaderboard is for friendly comparison; do not advertise tamper-proof ranking. Future route changes must bump their record rules version and explicitly retain historical results. Release 0.5.3 adds optional rollover rocks and recovery fixes, so current rules are version 5 for `old-road` and version 4 for `relay-ridge` / `finality-quarry`. The backend accepts versions 1–4 for all three IDs and version 5 only for `old-road`, bounding storage to thirteen records per account. Current leaderboards and the driver log select only their current version; historical private results, profiles, active tickets and retry receipts survive upgrades. Earlier times do not compete against the altered routes.

The actor makes no cross-canister calls, attaches no cycles, and requires no proxy. It belongs to the existing Cloud Engine and the same named OpenCloud application as the frontend.

## Garage and public ranking

Expeditions reuse this same account, saved nickname and the host’s bus appearance, but do not create solo delivery tickets or publish results. Team entry and planned character cosmetics are documented in [Accounts and measurement](./multiplayer-accounts.md). The existing profile data shape is unchanged.

After II sign-in/restore, `ensureProfile()` creates the first saved profile. Subsequent logins return the exact saved nickname and appearance. Default names look like “Rusty Otter 1234”; the canister makes an ornamental pseudorandom selection and persists it atomically. Names need not be unique; ownership always comes from the signed caller. Edited names are trimmed and limited to 3–24 Latin/Cyrillic letters, digits, spaces, `-` and `_`.

`src/game/skin.ts` is the client catalog: six paint IDs (`cream`, `mint`, `coral`, `blue`, `violet`, `gold`), three wheels (`stock`, `whitewall`, `rally`) and three sticker packs (`probably`, `ship`, `404`). Backend validation mirrors these exact IDs and is exercised for every choice. The defaults retain cream/stock/Probably Works. All 54 combinations are cosmetic. The garage shows a side-view assembly preview and applies drafts visually to the real bus; **Save profile** persists in the canister. Closing restores the saved look. Failed saves retain the draft for retry; sign-out restores the guest look. No profile or cosmetic persistence uses local storage.

The profile’s **Show my times on the leaderboard** switch defaults off. The explicit finish **Join leaderboard** action also enables this same profile preference; merely authenticating does not opt in. Saving it on publishes the nickname, bus look and best current-course times, including any previously saved current-course best. Switching it off removes those public rows without deleting private records. Renaming/repainting updates existing public rows. Guest visitors can read rankings without II. One row per driver/course, at most 20; ties use an internal stable principal ordering, not nickname uniqueness. The public row contains `nickname`, `skin`, `bestMs`, `completions`, and caller-relative `isYou`. Actual principals, legacy-course times and tickets are not returned. Opt-out also backfills the next eligible driver. Failed loads offer retry and empty boards explain how to join. New finished saved runs are naturally included when the board is opened/refreshed.

## Controller-only activity counters — 0.6.0

The measurement goal is to distinguish opened games, attempted deliveries and completed deliveries, then see which courses lose players. Aggregates live in the existing records canister; there is no external analytics service, advertising identifier, cookie, IP, fingerprint, referrer or click-stream collection.

| Event / field | Trigger and counting | Decision supported |
| --- | --- | --- |
| `opens` | One accepted `gameOpened` after local physics/renderer boot, once per document. Reloads and new tabs count again; title returns and route selection do not. | Are people actually opening the playable game? |
| `courses[].starts` | One accepted normal `beginDelivery` per track/rules pair. Retries using the same key return the same ticket. Practice has no ticket and is excluded. | Which levels get launched? |
| `courses[].finishes` | First validated `completeDelivery` for a ticket, guest or signed. Pauses, partial progress and restarts are not finishes. | How many launches reach the end? |
| `courses[].saved` | First successful authenticated claim, private or public. Joining later or retrying does not count again. | How many finished players retain a result? |
| `since` | Canister time in nanoseconds when these aggregates were first initialized. | Where does measurement coverage begin? |

These are approximate client-reported usage counters, **not unique users** or tamper-proof telemetry. Unsupported old clients, blocked/failed requests and offline fallback runs are not counted. A server-accepted start whose response never reaches the browser still counts as a launch attempt. Page-open transmission is best effort and does not block play. Claims are the saving conversion, not specifically “new logins”. There is no daily breakdown yet; take controller snapshots if needed. Previous traffic cannot be backfilled.

`statistics()` checks `Principal.isController(caller)` at call time, not an app-role flag or hard-coded wallet. Anonymous users, ordinary II players and former controllers receive only an error. Nothing in the public game displays statistics. A separate [owner panel](./admin.md) uses `adminStatistics()` and explicit read-only grants in records 0.6.1; this original controller endpoint is unchanged. A controller uses the linked CLI identity:

```sh
npm run stats:cloud
```

Equivalent command: `npm exec -- icp canister call records statistics '()' --candid src/backend/records.did --query -e ic --identity rv-there-opencloud`. If the OpenCloud delegation has expired, reauthenticate that same identity as described in deployment. A different controller can substitute their own CLI identity.

Counters retain lifetime totals and at most thirteen supported course/version rows. Open/guest delivery capabilities and claim receipts expire after 24 hours, are capped at 50,000 entries in total and cleaned in creation order (at most 100 per new open/start). Expired requests are rejected even before cleanup; reaching the cap rejects new entries without blocking offline gameplay. Guest visits do not consume the 10,000 persistent profile/account slots. A capability never leaves tab memory except in HTTPS canister calls; it is not placed in a URL, public board, local storage or logs. Confirmed time and claimed owner are retained only to enforce save authorization/retry, separately from the anonymous aggregates. Cleanup never deletes lifetime counters or personal records. Public event writes can be inflated by a modified client; the capacity bound limits retained transient state, not hostile request volume.

## Verification commands

```sh
npm run check
npm run test:backend
npm run test:browser
npm run icp:build
```

Backend tests use an isolated PocketIC instance and signed test identities, not the user's Internet Identity. They cover anonymous rejection, cross-account isolation, validation, faster/slower times, independent tracks, replacement/expiry, idempotency and actual persistent upgrades. Browser routes use keyboard actions without moving physics bodies. A live Internet Identity sign-in must be recorded separately from these automated tests.

To connect Vite to a local records canister:

```sh
npx icp network start -d
npx icp deploy records
ICP_LOCAL_BACKEND=1 npm run dev
```

The local gateway uses a dynamically selected port. Vite reads it and the root key with `icp network status --json`, reads the records ID, sets `ic_env` and proxies `/api`. Plain `npm run dev` works as an offline guest game without starting ICP. `npm run test:backend` builds and runs its own temporary PocketIC instance.

## Sources

- [Internet Identity authentication](https://docs.internetcomputer.org/guides/authentication/internet-identity/)
- [AuthClient API](https://js.icp.build/auth/latest/api/client/classes/authclient/)
- [DFINITY Internet Identity skill](https://github.com/dfinity/icskills/blob/main/skills/internet-identity/SKILL.md)
- [DFINITY Mops skill](https://github.com/dfinity/icskills/blob/main/skills/mops-cli/SKILL.md)

Release 0.4.0 live acceptance: the user confirmed Internet Identity sign-in works after deployment on 2026-09-05. Real-account delivery saving and retrieval after reload remain unverified; persistence and caller isolation are covered separately by local backend tests.
