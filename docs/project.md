---
title: Project description
tags: [product, scope]
---

# Project description

Title selected by the user: **IS IT THERE YET?** (formerly IS ICP BUS THERE YET / RV There Yet). A 3D browser game about delivering **Probably Works**, a battered app on wheels. The bus, canister-shaped hardware, CYCLES fuel and lost driving skills form a playful Internet Computer metaphor. Reaching the gate is a game objective, not a measurement of platform readiness. The game includes phone controls, winding courses and physical rollover recovery to three solo tracks with optional Internet Identity records. The user authorized two-player expeditions on 2026-09-06; release 0.7.0 publishes those expeditions with direct connections, while TURN and separate-network validation remain outstanding. Frontend 0.7.1 adds explicit nearby-item selection with outlines, names and X/touch cycling; release 0.8.0 adds aggregate co-op room creation, guest joins, connected pairs and first starts. Historical breakdowns and unique-player counts remain planned.

## Experience

The solo loop is load three modules → drive → keep cargo aboard or recover a loss → use the winch through the ditch → get the app over the line. In cooperation the shared vehicle creates temporary roles: driver, winch operator, spotter, and person recovering the latest mistake. Mistakes should create another playable situation. Humor comes from physical consequences and sparse writing.

The prototype uses a warm low-poly valley, a worn cream/olive bus with app-window livery, the slogan “Works on my subnet.” and a comic 99% shipping bar, three distinct modules, visible terrain bumps, one ditch and multiple marked tree anchors per route, an optional signed rollover rock beside each post-recovery straight, and a finish gate. Two additional selectable routes add a narrow blocked pass and a long rolling quarry. The first multiplayer session should last approximately **2–5 minutes**; actual human playtime still needs playtesting.

## Solo cargo iteration

The authorized pre-multiplayer scope, item rules, physical failures and revised road events.
Source: [Canisters cargo and Probably Works](./canisters.md)

## Solo tracks and records

Route definitions, Internet Identity and personal timing rules.
Source: [Tracks, profiles and leaderboard](./solo-records.md)

## Authorized two-player expedition

- Two desktop browser players with distinct II accounts, one shared session: create an invite, open it, sign in when needed and continue automatically, guest Ready and host Start. Manual code entry is visible beneath Create expedition. Saved nicknames and the host's bus appearance are reused. Solo exploration needs no account; see [accounts and measurement](./multiplayer-accounts.md).
- WASD, mouse look, jump, contextual interaction, vehicle throttle/brake/reverse/steering.
- Host-authoritative player, vehicle, and winch simulation.
- One winch: stowed → carried → attached; reel in/out, detach.
- Forest crossing: an open 64 × 192 m crossing from Local build to Production. Left, centre and right approaches each combine movable stones, a hollow and a climb, with marked winch trees near recovery zones and connections between approaches. Reusable planks, pushing and shared markers support alternative solutions; maps are stored as validated versioned JSON. A single map does not need a selection control.
- Loading from the owner's existing ICP Cloud Engine; signaling through a Motoko canister.
- WebRTC state and event channels, with TURN fallback for difficult network routes.
- Debug overlay and clean termination when the host leaves.
- Following the user's 2026-09-05 request: a detailed, scuffed adult traveler with both arms, no beer, simple procedural locomotion, original background music and gameplay sound effects with independent mute controls.

## Deferred

Four players, matchmaking, host migration, reconnection, voice/text chat, rollback, deterministic lockstep, an inventory beyond the three modules and bounded field kit, fuel consumption/refilling, checkpoint persistence, ragdolls, physical rope segments, gamepad controls, and production art.

Dragging players with the rope, simulated vehicle damage, and a day/night timer remain deferred. The user's phrase about getting ICP over the line is expressed through driving, cargo repair and winching. The traveler’s bruises, bandages and patched clothes are cosmetic. The user clarified that both arms must remain; only the beer and its opening sound are removed. Cargo carrying, cable attachment to the left hand and kicking retain their animations.

## Public multiplayer acceptance

Two people on separate computers and separate networks open the hosted game, create/join a room, enter the same session, and recover the same RV using driver and winch roles. Both observe consistent state around 100 ms RTT and 1% packet loss. Gameplay must not depend on an ICP call each frame. Completion of local physics alone does not meet this acceptance criterion.

## Source brief

The user-supplied [original MVP brief](./reference/minimal_multiplayer_mvp.md) is preserved verbatim. This project description and the user's subsequent instructions determine the current scope.

## Phone and winding-road follow-up

The latest authorized solo iteration supports phones with a thumb stick, context buttons, camera drag and a compact HUD. Missing SKILLS reverses both driving axes. The cargo compartment stays open, impacts anywhere can rattle and repeatedly release any installed module, including CYCLES, roads curve after recovery, and orange-banded trees on both shoulders offer additional cable anchors. A held **percussive maintenance** kick lifts and rolls an overturned bus using physics. The user explicitly allows replacing tracks; rules version 3 separates the repeatable-cargo difficulty from retained version 1/2 records. The optional roadside rollover rocks and recovery fixes in 0.5.3 use rules version 5 on the old road and 4 on ridge/quarry; all earlier records remain stored separately. The published iteration is solo. Expedition verification and deployment are tracked in Status.

## App on wheels identity

The main title is deliberately abstract; ICP references remain in the **CANISTERS CARGO** dispatch card, module names, footer and Probably Works bus. Side and roof panels resemble a small application window: three window buttons, “Works on my subnet.”, SHIPPING… 99% and “PLEASE DO NOT CLOSE THE BUS.” The rear hatch says DEPENDENCIES INSIDE. The painted progress bar is a visual joke, independent of actual route progress. App naming is cosmetic: canister IDs, identity derivation origin and version-2 track records stay the same.


The game mark is an application window with code brackets and wheels, shared by the header, tab and Cloud Engine listing. The title offers one selected-track delivery button; winch practice is available from pause as an unsaved session. The current title removes the old “NEXT UP / MULTIPLAYER” teaser and Solo deliveries badge, placing a Solo / Co-op switch above the heading in both modes. Co-op uses DELIVER TOGETHER, a prominent Create expedition action and a visible invitation form. Forest Crossing uses a compact upper-right card with abstract artwork and 5–10 min / Moderate / 3 paths. Music, Sound and the II account status use the same header in both modes. Published expedition verification and remaining network limits are tracked in Status.


The first delivery is now an introduction: a 112 m finish, two broad low bumps, a shallow rounded dip that can be driven, and one small final bend. The winch is available as help, rather than mandatory for this climb. Moderate driving can deliver every module without stopping; fast impacts still release cargo. The two harder tracks retain their previous challenges.

## Roadside club — profiles and garage

The user requested a minimal persistent profile, random default nickname, bus cosmetics assembled from wheels/stickers/paint, and a leaderboard. The chosen scope is six paints × three wheel trims × three sticker packs (54 looks), with no handling changes, uploads, economy or unlocks. Internet Identity binds the nickname, look and sharing preference to the existing records canister. The garage previews a draft and saves explicitly; closing discards unsaved edits. A friendly top-20 leaderboard shows current-course bests only for drivers who enable sharing. Old private results remain private by default. The game remains solo.

## Retaining a delivery and understanding usage — 0.6.0

A guest can finish first, then sign in with Internet Identity to retain that result and explicitly join the friendly leaderboard. Existing signed drivers keep their sharing preference. Counters for game opens and per-course starts, finishes and saves are stored in the existing Cloud Engine backend and visible only to current canister controllers. They measure aggregate activity, not unique people; the public release remains solo.
