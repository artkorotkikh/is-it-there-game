---
title: Implementation plan
tags: [plan, acceptance]
---

# Implementation plan

## Co-op analytics — authorized, 2026-09-06

Implement four cumulative milestones: accepted rooms, guest joins, both clients connected and both clients started. Count the first start per room, preserve prior room state, keep profiles/records untouched, and extend the existing panel and CSV. Verify deduplication, member/reader access, expiry/capacity, prior-Wasm upgrade and one two-account browser → panel flow. Collection begins on rollout; no backfill or unique-player claims. See [Status](./status.md) for completed evidence.

## Owner statistics panel — authorized, 2026-09-06

Add a separate `admin` static-site canister on the existing engine, backed by read-only access to existing records aggregates. First release includes II sign-in, explicit controller-issued reader grants, lifetime totals, track/version ratios and CSV. Keep the original controller query and private player APIs unchanged. Do not add daily history, new co-op telemetry or a second database in this step. Local acceptance: prior-0.6.0 data-preserving upgrade, grant/revoke/controller-rotation tests, one signed browser flow including failed reads/logout, and documentation checks. Publication acceptance: exact admin assets/headers and sibling IDs, anonymous denial, preserved records counters and the owner's real II account granted access. Local gates and read-only production publication checks have passed. The real owner panel account grant is confirmed by controller readback; the owner confirmed successful authenticated production viewing on 2026-09-06. See [Admin](./admin.md) and [Status](./status.md).

## Current authorized work — expeditions, 2026-09-06

The user has now authorized implementation of cooperative play and a reusable map format, overriding the earlier deferral below. Preserve existing profiles, II origin, records canister and all solo rule keys. First build/verify Forest crossing and its supported props locally, then generalize player ownership and prove the same recovery across two browsers. Rooms belong to a separate signaling service on the existing Cloud Engine; never replace or reinstall records. Public network readiness additionally requires direct/relay and separate-network tests. The user requested publication after local playtesting; release 0.7.0 deploys the expedition and invite flow with direct connections. A chosen TURN credential service and separate-network validation remain outstanding. A user map editor/upload service remains deferred.

The first map supports reusable boards, movable stones, bounded pushing and the existing winch, with multiple approaches and connections between them. Begin on a safe clearing rather than forcing a scripted stuck-bus solution. Maps are versioned, validated JSON files, automatically cataloged at build time. Acceptance: sampled terrain equals collider geometry, two planks permit an otherwise blocked crossing, invalid/occupied/load-bearing item transitions are rejected, alternative physical routes are demonstrated, and existing solo checks pass. See [Maps](./maps.md).

Reviewed on 2026-09-05 against the original brief and the user's existing Cloud Engine. The order prioritizes proving the shared recovery interaction. Check actual completion evidence in the status document, not from this plan alone.

The user subsequently requested publishing the working solo prototype immediately. The static-hosting part of Stage 3 now runs before Stage 2; backend signaling, TURN and multiplayer gates remain unchanged. A public solo preview is not the completed multiplayer MVP.

The delivered 0.4.0 iteration adds **phone controls, an always-open cargo bay, more sensitive latches, full SKILLS inversion, winding roads, more anchors and a playful physical rollover recovery**. The user allows replacing the tracks. Multiplayer is explicitly deferred. The cargo/recovery metaphor and exact user-selected title remain unchanged.

## Local playtest correction — 2026-09-06

The account iteration requires II only for two-player rooms, resumes the original invite/create action after sign-in, and reuses saved nicknames plus the host's bus garage. Local tests use two different account identities. Preserve solo guest play and all existing profile/record storage. Acceptance: cancelled login preserves the invite, signed restore avoids a second login, a self-join cannot delete the host room, two accounts start together, and room state survives upgrade. Character presets and richer history remain planned; release 0.8.0 implements four aggregate co-op counters with controller/granted-reader access, described in [Accounts and measurement](./multiplayer-accounts.md). The user completed local playtesting and then authorized the 0.7.0 deployment.

Before any redeployment, simplify the single-map start screen, use the user’s reference layout with a top Solo / Co-op switch, DELIVER TOGETHER, a visible invite form and compact Forest Crossing card (5–10 min, Moderate, 3 paths). Both modes expose Music, Sound and II status in their shared header. Keep Local build → Production in-world labels, and ensure opening an invite always joins the existing host. Keep distinct lobby roles, guest Ready and one host Start. Verify the reported two-window entry flow and the affected desktop/phone layout only; reuse established physics, persistence and full cooperative checks. The user tried the updated local version before authorizing release 0.7.0.

After the user confirmed the longer planks work, extend Forest crossing so every approach combines movable stones, a hollow and an uphill section. Preserve the proven central bridge geometry and open connections between approaches. Add reachable, useful winch trees near fall/recovery zones. Acceptance for this map iteration: full physical deliveries by all three approaches, physical recovery from the new hollows and the original steep hillside, a usable central-gap rescue, and targeted visual inspection of the extended terrain. Keep existing profiles and deployment untouched; record the user's completed local playtest and subsequent release authorization.

## Verification policy — revised 2026-09-06

Use the proportional verification policy in AGENTS.md and the development guide for subsequent iterations. Historical release gates below record the initial acceptance work; they do not require replaying all those scenarios after every change. A new feature gets one representative integration check, later changes get focused checks, and persistence retains its data/access guarantees. Full browser suites and multi-viewport matrices are selective, not routine.

## Save after finishing and private counters — 0.6.0 (deployed and verified)

Offer II on a guest finish and claim that already-completed time with explicit leaderboard opt-in. Preserve cancellation/retry, private autosaves and historical records. Add controller-only opens, starts, finishes and saved-result aggregates to the same canister. Verify the actual prior-Wasm upgrade, capability/caller isolation, immutable and idempotent finishes, private access and a complete browser guest delivery → cancelled login → login/save/retry → leaderboard → reload. Practice stays unsaved and excluded. Publish both existing canisters after checks; no gameplay/rules changes or multiplayer.

## Social preview repair — 0.5.4 (deployed and verified)

Verify the live raw head with common crawler user agents, add missing OG/Twitter metadata and a game-based PNG card, validate initial HTML and image responses locally, publish only the frontend, then recheck the custom domain and guest gameplay. Keep all persistence and II origin configuration unchanged.

## Optional rollover rocks — 0.5.3 (deployed and verified)

Add one physical faceted stone at the verge of a flat straight on each route with a visible ROLL TEST sign and a broad centre bypass. Prove actual one-sided rollovers, safe full-speed bypasses and kick recovery without teleporting. Fix rolled exits and side-facing suspension if they block recovery. Preserve the beginner delivery path and historical profiles/times, with new rules old-road 5 / ridge and quarry 4. Verify an actual 0.5.0 records upgrade, real browser rollover/kick and normal first delivery, then publish both existing canisters. Multiplayer remains deferred. Local gates passed. After an initial automatic-review rejection, the user explicitly approved publishing both canisters on 2026-09-06. Both canisters deployed successfully and public verification passed.

## Lighter loss feedback — 0.5.2 (deployed and verified)

Replace the solid panel with transparent text, remove the overboard/other-offline labels and colored bars, and fit fade/zoom entrance and exit into three seconds. Preserve readable desktop/phone layouts, reduced motion, event replacement, pause and reset behavior. Verify and publish a frontend-only update.

## Notice every lost canister — 0.5.1 (deployed and verified)

Show a large temporary centered announcement for every physical module ejection, naming the lost capability and recovery action. New losses must not be masked by existing warning priority; handle repeats, restoration, pause and restart. Check actual gameplay and phone layouts, then publish a frontend-only update to the existing engine. Preserve all physics, course versions, profiles and records.

## Roadside club — 0.5.0 (deployed and verified)

Add nickname/default generation, a 54-combination cosmetic garage and an opt-in top-20 leaderboard to the existing authenticated records service. Keep guest play and guest leaderboard reading. Preserve old results/tickets through an additive canister upgrade. Verify caller isolation, validation, profile persistence, ranking/ties/backfill, opt-out, failed-save recovery, desktop/phone editing and the actual previous-Wasm migration. Publish both existing canisters after checks. Gameplay/track rules and multiplayer scope remain unchanged.

## Easier first delivery — 0.4.4 (deployed and verified)

Shorten and soften only the first course, allow its climb under engine power, keep optional winch practice and real cargo impacts, and update the route hint. Keep the two harder levels unchanged. Separate the new first-course record rules (4) from its historical results while leaving the other tracks at 3. Verify moderate-speed full delivery, fast loss, cable recovery, browser finish and a data-preserving backend upgrade, then publish both existing canisters.

## Title polish — 0.4.3 (deployed and verified)

Replace the header infinity symbol and tab icon with one app-on-wheels mark. Keep one title delivery button and relocate the existing unsaved winch practice to pause. Announce future co-op rollover recovery without adding multiplayer. Preserve finish credits, the OpenCloud CTA and shared II origin. Verify keyboard/touch entry, practice/restart/course selection, compact desktop and both phone orientations, then publish only the frontend to the existing engine; no physics or records upgrade is needed.

## Cargo impact correction and follow-ups — 0.4.2 (deployed)

Replace the obsolete one-shot zones with repeatable, speed/impact-based releases across every course. Include CYCLES, visible socket jostle and quiet clatter; bound a single impact burst and give fresh installations time to settle. Preserve cautious driving, module identities and recovery actions. Use rules version 3 while preserving old personal records. Verify real late quarry crossings, repeated retrieval/release, full browser deliveries and the actual previous-Wasm upgrade before publishing. Include the user’s subsequent finish-screen GPT Astra/OpenCloud credit and exact custom-domain II allowlist; verify short-screen layout and served JSON/CORS. 

## Visual follow-up — IS IT THERE YET? / Probably Works (deployed 0.4.1)

Rename public title and app metadata, repaint the bus as a fictional application, label its cargo as CANISTERS CARGO, remove beer and its cue, and retain both arms per the explicit correction. Keep current physics, tracks, rules version and identity origin. Verify desktop/phone presentation, carrying/cable/audio, then publish to the same canisters and document readback.

## Stage 1d — Phone road trip and roadside recovery (deployed)

- Use a shared keyboard/touch input path with independent fingers for stick, camera and context buttons. Simplify phone HUD, keep all menu/account actions accessible and clear holds on cancellation/pause.
- Keep the rear hatch open and lower impact/speed release thresholds while preserving careful driving. Reverse both SKILLS axes and require both axes neutral before applying the changed mapping.
- Replace final straights with bends. Move terrain, scenery, barriers, finish and bounds together, and support winching to multiple marked trees.
- Add a charged administrator kick with physical lift/torque, animation, sound and cooldown; no teleport or saved checkpoint.
- Preserve version 1 personal records and use version 2 for new courses. Test real-Wasm upgrade retention, physical kick results, curved geometry, all full routes and phone multitouch layouts. Deploy the tested upgrade to the existing canisters.

Automated and deployment gates passed, and the user confirmed live II sign-in. Actual phone hardware and user-account finish/save/reload remain manual checks.

Gate: three routes remain finishable, phone walking/driving/interactions can share fingers without stuck controls, a side/roof-down bus can be kicked upright, and historical records survive. Actual phone hardware and real-user II saving are reported separately from emulation/local tests.

## Stage 1c — Three solo tracks and personal records

- Keep the original route and add Relay ridge (roadblocks/narrow pass) and Finality quarry (rollers/long climb), with a selector, distinct scenery and matching physical geometry.
- Make track geometry instance-owned; thread it through physics, cargo recovery, cable routing and rendering. Require all three modules and actual recovery at the finish.
- Add optional Internet Identity; support guest play, session restore/sign-out, private bests and completion counts per track. Exclude practice and pauses from saved full runs.
- Add a persistent Motoko records canister on the same engine, caller-bound tickets, bounded storage, validation and idempotent finish retries. Clearly describe times as browser-reported personal results.
- Verify physics, both complete new browser routes, account/error states, real Wasm access control and data-preserving upgrades. Build/deploy both canisters together and verify the public game and Internet Identity flow.

Gate: all three solo routes are playable and the same account can retrieve a saved per-track result after reload; practice runs do not upload; guest saving is extended by the 0.6.0 stage above. Record any user-dependent live sign-in validation separately. Multiplayer is not part of this gate.

## Stage 1b — Three canisters and ICP Bus

- Preserve the warm valley and worn traveler; add ICP-inspired service hardware, colored stripes, readable module symbols and a rear loading bay.
- Load three distinct physical canisters before the first drive. Implement pickup, carry, correct-slot docking, deliberate removal and safe dropping with one item per player.
- Derive engine/winch/drive-direction capabilities from installed modules. Preserve passive cable holding, inertia, brakes and normal walking. Require neutral throttle after power/direction changes.
- Original 0.2 rule, superseded by the 0.4.2 correction above: add visible terrain bumps and two eligible release zones: WINCH before the ditch, SKILLS on the flat after recovery. Release once per module only after a sufficiently hard physical hit above a speed threshold; cautious passage preserves cargo. The second zone depends on route recovery, not mandatory earlier cargo loss.
- Expand the final route, add clear module status, warnings, lost-item markers, sounds, and safe same-ID recovery of unreachable items. The recovery shortcut starts loaded.
- Prove loading, cargo collisions, power loss/restoration, actual reversed movement, neutral-input protection, careful/rough bump traversal and full browser route; preserve the existing rope and control regressions.

Gate: complete the normal solo route from three loose modules to the finish, recover both ejected modules, test manual CYCLES removal, then build and verify the hosted update. Real networking, fuel consumption and arbitrary loose cargo remain deferred.

## Stage 0 — Project foundation

- Add mandatory documentation rules, canonical product/architecture/runbook/status, and preserve the original brief.
- Scaffold TypeScript/Vite, pinned dependencies, checks, and a static build.
- Keep the simulation independent of graphics and future network transports.

Gate: install, typecheck, documentation validation, tests, and build have reproducible commands.

## Stage 1 — Local recovery prototype

- Kinematic character, walking, mouse camera, jump, contextual vehicle entry/exit.
- Raycast RV, throttle, brake, reverse, steering, suspension, and rollover.
- Short mountain route with descent, ditch, recovery slope, anchor, finish.
- Stowed/carried/attached winch with reel in/out, detach, damped capped force.
- Restart, recovery test shortcut, pause, readable controls, and debug overlay.
- User-requested follow-up: fix camera-relative controls and terrain boundaries, add the scuffed traveler with beer, original music, gameplay sounds, separate mute controls, and regression checks.
- Rope follow-up: shared terrain contact route, visible slack, reduced stretch, load-limited reeling, stop/start and blocked-chassis checks, and clear winch controls in the cab.

Gate: one player can drive into the ditch, exit, carry and attach the winch, pull the RV back onto the road, and reach the finish. The cable must stay visible over the recovery crest, show paid-out slack, and support stopping/restarting the drum without a runaway elastic pull. Verify both headless physical outcomes and the browser interaction path. A shortcut that spawns the RV in the ditch is a tuning tool, not a substitute for driving there.

## Stage 2 — Two-browser multiplayer (authorized)

- Add WebRTC transport with state/events channels, input expiry, event IDs, protocol version, and backpressure.
- Route local and remote input through the same authoritative simulation API.
- Add two players, validated seat ownership and winch ownership, snapshots and interpolation.
- Use the separate ICP rooms actor for invite-based offer/answer exchange; manual SDP is not the player flow.
- Establish TURN fallback; measure direct and forced relay connections.

Gate: two browsers independently move, share one vehicle, swap driver/winch roles, and complete recovery. Disconnect and pause are visible. Guest movement/steering must be evaluated at 100 ms RTT before deciding whether limited prediction is necessary.

## Stage 3 — Rooms and Cloud Engine

- Confirm the user's engine endpoint/subnet, deployment access, canister IDs, and available cycles without recording secrets.
- Implement bounded Motoko rooms and signaling with caller-bound membership and bounded immutable SDP exchanged through update replies.
- Supply TURN credentials safely; handle signaling timeout and expired rooms.
- Deploy static assets and backend to the existing engine, configure actual public URLs, check WASM MIME/CSP and caching.

Gate: separate computers on separate internet connections join only by room code, with no manual SDP. No gameplay packets enter the canister API after connection.

The earlier multiplayer deferrals in release history above describe those releases, not the current authorization.

## Stage 4 — Network and playtest gate

- Test approximately 100 ms RTT, 1% packet loss, input silence, stale snapshots, duplicate events, full/expired rooms, and host departure.
- Test direct and TURN-relayed sessions. Local two-window testing does not prove NAT traversal.
- Run a complete 2–5 minute cooperative session and observe whether coordination is necessary and recovery is enjoyable.
- Fix playability issues; defer extra mechanics and art.

Gate: every product acceptance criterion is demonstrated and evidence recorded. Stop expanding scope until people have played the loop.

## Changes from the source plan

TURN and an early relay test are explicit. Snapshot state includes carried winch/seat ownership, not only transforms. Input expiry, signaling authorization/limits, and background-tab behavior are explicit. The two conflicting playtime targets are unified at 2–5 minutes. ICP integration targets the existing Cloud Engine; no new engine purchase is planned.
