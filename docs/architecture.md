---
title: Architecture and decisions
tags: [architecture, physics, networking]
---

# Architecture and decisions

## Separate owner statistics panel — 2026-09-06

The user approved a standalone panel on the owned Cloud Engine. Add one certified-assets `admin` canister and a bounded reader API in records 0.6.1. Browser calls go directly to records; existing aggregates remain the source of truth. This avoids an unnecessary inter-canister proxy and duplicate storage. The panel uses its own II origin; controller-issued read grants never confer canister management or access to private player records. Existing `statistics()` stays controller-only. No new telemetry or co-op storage is introduced. See [Admin](./admin.md) for access, snapshot semantics and publication gates.

## Aggregate co-op analytics — 0.8.0

Keep the original persistent Room and records/profile layouts intact. Add separate bounded reporting sessions and counters inside rooms, because accepted create/join transitions must increment atomically with their server facts. A session ID outlives its short-lived invitation for up to six hours and authorizes only its server-derived members. Count a connection/start once after both signed client reports; accept out-of-order arrival without duplicate increments. First starts are per room, not per restart, to keep the initial funnel comparable. The richer per-round/history plan remains deferred.

The panel reads rooms directly with separate controller-issued reader grants, initially mirrored from existing records readers. This avoids modifying the profiles service or introducing cross-canister calls to the game path. The tradeoff is that grants/revocations must be applied to both services. Private session state is never returned by analytics queries. See [collection semantics and bounds](./multiplayer-accounts.md).

## Explicit interaction targets — 2026-09-06

The reported cargo pile exposed field-kit pickup consuming E before cargo, even when a support was loaded and could not move. Expeditions now build one authoritative candidate list across cargo, resources, the nearest rear socket, recovery, an attachable tree and seats. Available loose modules sort first, then free resources; blocked candidates sort last. Distance and stable ID break ties within each category. Each player can cycle with X and retain their own selected ID until unavailable or consumed. Prompt, snapshot target metadata, corner outline and E execution use that same selection. No aim-ray precision or new interaction distance is required.

Host validation re-evaluates the explicit displayed target ID at action time. A stale or newly owned target is rejected, without falling through to another object or placing a newly carried prop. Cycling cancels a charged removal/kick. Existing rear-only loading, one occupied hand, line of sight and loaded-support protection remain. Cargo visibility ignores other loose modules and kinematic teammates so a pile does not hide its rear handles; terrain, bus and support colliders still block access. Solo keeps its existing automatic selection, with the same cargo visibility correction. The interaction compatibility key advances to net3; room/record canister APIs and persistent data are unchanged.

## Expedition implementation decision — 2026-09-06

The user authorized the cooperative roadmap and a data-driven clearing with boards/stones/pushing. New maps use validated schema-versioned JSON heightfields rather than extending the solo longitudinal profiles. `Level` retains the unchanged legacy path and adds exact triangle sampling/breaks for heightfields. `FieldKit` owns stable resource identity, carry/placement transitions and support dependencies; renderers consume the same geometry. This bounded placement model was chosen to allow player-selected positions without introducing unstable free planks or another physics engine.

The expedition entrypoint is separate from the solo account/ticket UI and never submits new map IDs to existing personal records. The records actor, its stable layout, production identity origin and legacy track rules are unchanged. User-authored uploads and online map persistence are future work; the initial registry is bundled with the frontend. [Map format and rules](./maps.md) are canonical. Multiplayer implementation/verification status is tracked separately in [Status](./status.md).

Browser simulation and rendering are separated so the local prototype can become an authoritative host without moving physics into ICP. This document includes both implemented foundations and the implemented two-player transport and outstanding internet verification.

## Forgiving bridge placement — 2026-09-06

The user could place the original plank only in a tiny green region. Its 5.08 m end-support span almost exactly matched the central gap's 5 m bank separation. Increase plank length from 5.4 to 6.8 m while keeping the authored terrain, placement checks and shared render/collision mesh. The extra overlap permits small positioning and rotation errors without accepting unsupported bridges. Move the initial two planks one metre forward (map content version 2), since their longer ends otherwise take interaction priority beside the passenger door. Slope rejection now tells plank carriers to rest both ends on banks or stones. Include `config.fieldKit` in the map compatibility fingerprint because guests build prop meshes from their own tuning; different lengths must fail the handshake instead of displaying different geometry. Map schema and backend interfaces remain unchanged.

## Extended Forest crossing and recovery coverage — 2026-09-06

After confirming plank placement, the user requested a longer map with stones, a hollow and a climb on every approach. Extend the existing authored JSON from 104 to 192 m in Z (content version 3), preserving terrain through Z=72 and the central bridge geometry. Stagger the three new stone/hollow/climb sequences so changing approaches remains possible instead of building sealed corridors. Move the goal from Z=82 to Z=170. Keep the format and runtime unchanged; the larger map still fits the existing terrain/resource limits and map compatibility handshake.

Choose winch trees by physically testing retrieval, not just distance. Trees five metres to either side of the new approach centres sit at hollow entrances, uphill exits and crests. Move the original left hill's upper tree beyond the crest so the minimum cable length cannot halt recovery too soon. Add near-bank trees for pulling a stranded bus back from the central gap; a far-bank anchor drives it into the cliff, while sideways pulling risks overturning it. The playable recovery tests include walking the cable to the selected trees and moving the bus with the actual winch. Profile persistence, solo physics, room APIs and deployment remain separate from this map-only decision.

## Expedition publication — 0.7.0

The user authorized deployment after trying the local build. Publish the current direct-connection expedition, with the unconfigured TURN/separate-network limits explicitly retained. Target only `frontend rooms`: install the separate signaling service on the owned engine, upgrade/sync the existing frontend, and verify sibling IDs. Leave the records 0.6.0 module, settings and identity origins untouched; it has no dependency on rooms. The general all-canister deploy command remains available but is unnecessary for this release. Public checks compare assets and service wiring, then start unsigned exploration without writing account, room or activity data. A published guest startup is not evidence of an internet-wide two-player session.

## Expedition entry correction — 2026-09-06

The user's screenshot showed both windows in host/share mode while their addresses held different invitation codes. The old invite route only prefilled a small Join field and kept the larger Create button visible, allowing either recipient to create another room. The route now chooses guest connection automatically; hosting and leaving clear stale room parameters. Host/guest lobby roles are explicit, with sharing shown only to the host and hidden after connection. Host creation supplies host readiness, eliminating the redundant host Ready click. A validated early ready packet is retained through the last signaling reply.

The initial simplification removed the single-map picker and collapsed the invite form. The user's later visual reference restores a visible invite form under Create expedition; the single-map picker remains hidden. The data-driven map catalog stays intact. Local build and Production labels strengthen the existing app-shipping metaphor without changing goal physics, map data, records or deployment behavior.

## Account-bound teams — 2026-09-06

The user requested sign-in for multiplayer and asked how profiles and analytics should support it. Reuse the existing Account/II session for room calls; remove per-tab generated identities. Share saved nicknames and the host's bus appearance as bounded presentation in protocol 2. Keep two distinct caller-bound seats. A failed self-join must not close the host room; a returning host can replace only its own old invitation. Existing records/profile storage and the permanent II origin remain unchanged.

Stable room callers allow recognizable players now and attributable team activity later. Separate character outfits and historical telemetry are explicitly planned rather than silently extending persistent profiles. The canonical [accounts and measurement plan](./multiplayer-accounts.md) defines proposed events, server versus browser evidence, controller-only host/guest relationships, retention and verification gates. No event collector is added in this step.

## Shared title and abstract expedition card — 2026-09-06

The user requested replacing the now-outdated multiplayer teaser and Solo deliveries label, then supplied a layout reference. Both screens now use a top Solo / Co-op switch. Solo retains its routes/launch; Co-op uses DELIVER TOGETHER, Create expedition and an always-visible invitation form. Replace the literal terrain preview with a compact upper-right route card, editorial metadata and a bundled abstract forest illustration. This metadata stays outside the map JSON so a copy/art change does not change network compatibility or gameplay. The declared 5–10 minutes is an estimate, not measured telemetry.

Both modes now render `masthead()` and bind the same separate Music, Sound and Internet Identity controls. Expedition header login opens the existing garage; room-gated login keeps its pending intent. Garage edits apply before team entry; active teams retain the handshake presentation. Narrow headers show all controls with the brand reduced to its icon. No persistence layout or signaling API changes are involved.

## Runtime ownership

| Responsibility | Runtime | State |
| --- | --- | --- |
| Static HTML, JS, WASM, art | Certified-assets canister on existing Cloud Engine | Deployed; public solo preview verified |
| Personal records, run tickets and controller activity counters | Persistent Motoko canister on the same engine | Implemented; see status for deployment evidence |
| Rooms, membership, signaling, expiry | Separate Motoko rooms canister | Implemented and tested locally; not deployed on the engine |
| Authoritative physics | Host browser / standalone local simulation | One shared world with two owned characters |
| Rendering, camera, input | Each browser, using PlayCanvas | Local implemented |
| Inputs, snapshots, events | WebRTC DataChannels | Implemented; verification in Status |
| Fallback transport | Owner VPS coturn | UDP/TCP relay; see Networking for verification and limits |

## Local simulation

`Simulation` owns Rapier world, player capsule, raycast vehicle controller, winch state, progress, and tick. It has no DOM, PlayCanvas, network, or wall-clock dependency. Inputs and discrete actions enter the simulation; serializable snapshots leave it. The renderer reads state and never writes physics transforms.

`Canisters` owns the three fixed IDs and atomic loose/carried/docked transitions inside that world. Only loose bodies are enabled; carried poses follow the player and docked poses derive from chassis/socket transforms. The snapshot includes module phases, carrier ID, positions/quaternions, linear/angular velocities and socket positions, plus latched startup, neutral-input arming, derived capabilities, explicit brake, hatch state and historical per-type release flags (telemetry only, never release gates). Interaction selection is shared by prompt and action, with rear access and line-of-sight checks. A bounded 20-event sequence lets audio observe pickups, docking, impacts and release without controlling gameplay. The host validates these same actions and apply the SKILLS mapping once.

The rear bay uses five non-overlapping collision cuboids with zero density. Explicit chassis mass, centre of mass and inertia preserve the former 1600 kg box envelope, avoiding a suspension change from cutting the opening. Docked modules are part of that fixed envelope and never contribute additional active bodies. Loose modules are 12 kg dynamic CCD cuboids. Dropping checks shape clearance; socket release inherits `velocityAtPoint` and angular velocity before adding a small configured local kick. Out-of-bounds/below-ground items use a deterministic free-space search and keep their ID and disconnected phase.

World units are metres, seconds, kilograms, newtons, and radians. Y is up; the route and vehicle's initial forward direction are +Z. In the default camera looking toward +Z, **screen-right is world −X**. Walking uses the camera's right/forward basis; vehicle steering is relative to the vehicle (D turns right from a chase view, A left). Turning the camera to face the vehicle naturally changes its apparent screen direction. Rapier quaternions are XYZW. Tuning lives in `src/game/config.ts`; track geometry lives in `src/game/tracks.ts`; each `Level` instance supplies shared rendering, collision and ground sampling.

The terrain is one shared mesh for rendering and collisions, including shoulders from each track’s road half-width out to ±18 m relative to the road center. The player stays within the finite terrain with a 0.6 m edge margin. A sampled ground-clearance floor supplements Rapier's shape casts so a player cannot sink below the rendered ground after a jump, edge crossing, or vehicle exit. This is a forgiving prototype boundary, not an invisible jump into a lower world. Large decorative mountains sit outside the walkable area.

Physics runs at 60 Hz. Rendering interpolates previous/current local snapshots. Frame time and catch-up count are bounded to prevent a long stall from applying seconds of accumulated forces. A hidden tab pauses the local session and clears input. The host signals shared pause explicitly; either hidden participant stops the session.

The vehicle uses one dynamic chassis and four raycast wheels. Wheel graphics are not separate colliding bodies. Chassis sleeping is disabled because the raycast controller directly changes its velocity each tick; a sleeping body can otherwise accumulate unapplied suspension impulses. PlayCanvas's built-in Ammo physics is unused. This avoids two competing worlds and keeps Rapier testable without WebGL.

The winch uses a terrain-supported cable route shared by simulation and rendering (`cable.ts`). The upper convex hull of every terrain slope change along the fairlead–anchor plane gives the shortest supported path. Its length determines extension; its first segment determines force direction at the front fairlead. This replaces the straight chord, which previously cut through the recovery crest, disappeared inside the road, and pulled the RV toward the ground. The analytical ground sample is exact for the current piecewise-linear terrain. New terrain types must supply all relevant surface breaks or a different contact solver.

Pull remains a tension-only spring with damping and a 28 kN force cap, applied at the fairlead so it can torque the chassis. Stiffness is 40 kN/m (25 cm stretch at 10 kN), rather than the former 6 kN/m rubber-like response. The drum reels at up to 1.6 m/s and slows with load. A stalled drum cannot shorten the rest length beyond the force-cap extension; paying out remains possible. Attaching starts with 30 cm of slack, limited by available cable, and validates routed reach. Releasing Q holds the paid-out length; the vehicle can settle against that length under gravity. A slack cable applies no force or damping.

Visual slack hangs under gravity and forms loose bends where it rests on the terrain. A bounded numerical length solve fits the paid-out length; it does not add a second physics simulation. `CableVisual` renders one continuous six-sided tube in one draw call. Snapshot `winch.length` is paid-out rest length in metres; `winch.span` is the shortest terrain-supported distance in metres; tension is newtons. The HUD distinguishes slack and taut cable and keeps winch controls visible while driving.

This is a frictionless, quasi-static terrain contact model, not a chain of colliding rope bodies: cable inertia, friction, snagging/wrapping around arbitrary trees/rocks, and breakage remain deferred. Local testing allows operating the winch alone; the expedition binds actions to their player owner.

## Optional rollover rocks — 0.5.3

The user asked for an avoidable one-sided collision on each straight to test recovery. `Level.rolloverRockMesh()` provides a six-vertex convex stone to both Rapier and PlayCanvas, so the rendered obstacle is the actual collision surface. Dimensions are 1.5 m wide × 4.6 m long × 1.8 m high, offset +3.4 m from the road centre, with its peak 15% of the length beyond the centre. `tracks.ts` chooses flat post-recovery positions; a verge sign says ROLL TEST / ONE WHEEL ON / OR GO AROUND. The centre lane leaves 1.57 m between an aligned chassis side and the stone. No collision trigger, forced orientation or invisible rollover impulse is used.

Physical crossing tests exposed two recovery problems. Exiting a rolled chassis used its rotated door direction, which could place the player inside the body. Exits now search ground-level candidate positions and reject capsule overlaps, preferring 4 m clearance when overturned and 3 m when upright, within interaction reach for kicking. Side-facing raycast wheels could push against the rock wall and defeat the righting torque. Suspension now engages only while chassis up dot world up exceeds 0.5 (within 60° of upright); rigid chassis collisions remain active at every angle. The small kick clearance impulse described below separates the wheels from the rock during rotation. These changes keep ordinary driving forces and cargo-impact rules unchanged.

Cable support still samples terrain only: it does not wrap around these rocks, tree trunks or the bus. The stone participates in body/item/player collisions, not cable routing.

## Curves, anchors and recovery kick

Track centerline knots are smoothstep-baked on curved segments at intervals of at most two metres (constant-X segments retain only their endpoints) and then interpreted as piecewise-linear geometry. `Level.rows` merges these rows with every elevation break. Terrain, road, posts, trees, blocks, finish and boundary checks use world X = centerX(Z) + local lateral offset. Ground sampling is therefore exact for the corresponding triangulated planar strips. Cable support additionally inserts every crossing of the moving road shoulders, including a cable with constant world X.

Each level owns stable IDs for the primary recovery anchor and extra shoulder trees. Attaching selects the nearest reachable marked tree, validates the full terrain-supported length and stores its ID; subsequent force and rendering use that same endpoint. Marked trunks collide. Decorative trees do not become anchors and ropes still do not wrap arbitrary obstacles.

The recovery kick is a simulation-owned held interaction with availability, charge fraction, cooldown seconds, monotonically increasing kick count and remaining animation seconds in the snapshot. It applies a 1600 kg × 2.3 m/s vertical impulse, plus up to 1600 kg × 2 m/s sideways along the horizontal component of chassis up to clear nearby rocks, and an angular PD assist toward world up, using 18,000 N·m/rad gain and 6,500 N·m·s/rad damping for up to 2.4 seconds. An exactly roof-down bus chooses a horizontal axis from its forward direction. No pose or position is assigned by the action. Physics may still prevent recovery when pinned under an obstacle; restarting remains a fallback.

Keyboard and touch feed the same InputFrame. Each touch button owns its pointer IDs; camera drag and analog stick have separate owners. A central clear path removes keys, touch holds and visual stick displacement. Static scenery alone uses PlayCanvas material batches bounded to 60 m; groups are removed on track changes. Moving bus/cargo/character geometry stays separate. Rendering observes the snapshot to animate the kick and synthesize its sound; it cannot trigger the assist.

The user authorized replacing tracks on 2026-09-05. Rules version 2 separates the winding courses from version 1. Release 0.4.2 uses rules version 3 because repeatable cargo losses change difficulty; the backend preserves versions 1 and 2. Release 0.4.4 added version 4 only for the easier old road. Release 0.5.3 adds optional rollover rocks and recovery physics fixes, moving current rules to old-road 5 / ridge and quarry 4. Thirteen historical/current pairs are retained per account; public boards only accept current pairs. Future additions must revisit that bound.

## Accounts and track ownership

Tracks and private records are independent of future multiplayer. A browser’s `Simulation` owns its selected `Level`; there is no global active terrain. Internet Identity authenticates a caller-bound records actor while gameplay remains local. Optional server tickets bracket normal runs without entering the physics loop. Personal times are client-reported, not competitively certified. Restart/cancellation uses a generation counter to discard stale frontend responses; successful finish retry is idempotent on the backend. Persistent Motoko maps retain records through upgrades.

Canonical API, bounds and account-origin decisions are described in [Tracks, profiles and leaderboard](./solo-records.md).

## Character and sound

`Character` builds a visual adult traveler from articulated primitives: patched plaid shirt, trousers, boots, cap, face, tired eyes, bruise, bandage and two articulated arms. The feet and visual scale match the underlying capsule. Walking animation derives from actual displacement; both arms swing naturally, both reach forward for cargo, and the left hand can carry the cable. These visuals never modify physics or authoritative state.

`GameAudio` uses Web Audio with a single reused graph, separate music/effects buses, output compression, and short-lived sound nodes that disconnect when finished. Audio starts/resumes only from user gestures, suspends with pause/hidden gameplay, and can be independently muted. A missing or blocked audio context does not prevent playing.

Music is an original 92 BPM four-chord string/bass/brush pattern. Plucked strings use generated Karplus–Strong samples; effects use filtered noise and oscillators for the engine, winch, footsteps, jump/landing, door, cable latch, impacts, finish. No remote recordings, copyrighted tracks, sound libraries or microphone permissions are used. Musical time comes from the audio clock, independently of simulation time. The development-only diagnostic getter exposes output RMS and audio state for verification.

## Implemented expedition network

The two-player implementation keeps a single authoritative Rapier world, caller-bound room membership and browser-to-browser gameplay. Driver, passenger, cable carrier/operator and carried item ownership are explicit. Input expiry, action sequence, round epoch, complete snapshots, interpolation and explicit shared pause keep the two views coherent without per-frame ICP calls.

Rooms are a separate persistent actor. Full SDP uses authenticated update replies during onboarding, replacing the original query/cursor proposal. The fixed offer/answer design has bounded storage and needs no candidate log. Existing records/profile storage, II derivation origin and solo rule keys are unchanged. A runtime ICE configuration endpoint supplies short-lived TURN credentials; see Networking for its VPS deployment and remaining separate-device validation.

The canonical [network protocol and setup](./networking.md) documents every packet, field, timer, bound and state transition. Refer to Status for demonstrated evidence; implementation alone is not the public multiplayer acceptance gate.

## Decisions reviewed 2026-09-05

1. **Use the already owned Cloud Engine.** Earlier cost concerns about buying another engine no longer apply. The user supplied the OpenCloud console origin and exact subnet, recorded in the deployment guide. The public solo preview was deployed and checked before adding multiplayer, as requested. Hosting serves the game files; session physics still runs in each browser.
2. **Keep ICP outside the realtime loop.** Canister update latency is appropriate for lobby state, not 60 Hz vehicle input.
3. **Add TURN.** STUN-only is a connectivity experiment, not sufficient evidence of internet reliability. TURN relays encrypted WebRTC packets and does not own simulation. Obtain short-lived credentials; never embed a provider's long-lived secret in the build.
4. **Keep PlayCanvas + Rapier.** Integrate transforms explicitly; do not load Ammo.
5. **Prove physical recovery before networking.** The first gate includes an actual ditch, stable idle behavior, tension-only pulling, and recovery to the road.
6. **Distinguish infrastructure from session authority.** A highly available engine does not preserve a browser-hosted match after the host closes the tab.
7. **Route the cable over terrain before expanding physics scope.** The user's rope screenshots exposed a shared physics/rendering shortcut through the crest. Terrain support, visible slack, less stretch and drum stall behavior fix this local recovery problem without introducing a separate rope engine or a many-body solver.
8. **Build the solo cargo loop before networking.** The user authorized three removable modules (initially under the IS ICP BUS THERE YET title, now IS IT THERE YET?). The reviewed proposal uses impact-and-speed-gated releases rather than guaranteed coordinate triggers. Careful driving preserves cargo. The 0.4.2 correction removes stage/location eligibility, so real bumps throughout the route can release cargo repeatedly. The same terrain profile supplies bumps to visuals, collision and cable routing.
9. **Keep failure understandable and recoverable.** Power loss removes engine force, not velocity; WINCH loss removes drum control, not passive holding; SKILLS swaps authoritative throttle and steering. Direction changes/power restoration disarm both drive axes until neutral. P explicitly parks the bus for solo retrieval, and pause cancels held removal. These game states make no real ICP calls.

10. **Add accounts and levels before networking, as requested.** Three selectable solo routes and private personal records are the current scope. Internet Identity uses the frontend canister as its permanent primary origin; no identity attributes are requested. The records canister requires no cycles/proxy or realtime calls.

## Technical references

Verified against official documentation on 2026-09-05:

- [ICP Cloud Engines](https://internetcomputer.org/wiki/cloud-engines/)
- [ICP frontend and game builds](https://docs.internetcomputer.org/guides/frontends/frameworks/)
- [ICP canister execution](https://docs.internetcomputer.org/concepts/canisters/)
- [WebRTC TURN](https://webrtc.org/getting-started/turn-server)
- [PlayCanvas standalone engine](https://developer.playcanvas.com/user-manual/engine/standalone/)
- [PlayCanvas built-in physics](https://developer.playcanvas.com/user-manual/physics/physics-basics/)
- [Rapier raycast vehicle](https://rapier.rs/javascript3d/classes/DynamicRayCastVehicleController.html)
- [Rapier character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/)
- [Browser background animation behavior](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [Web Audio autoplay and user controls](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

### Internet Identity compatibility correction — 2026-09-05

The sign-in request uses II’s standard origin-bound delegation with an eight-hour maximum lifetime. It omits the optional `targets` request: the current [official II handler](https://github.com/dfinity/internet-identity/blob/main/src/frontend/src/lib/stores/channelHandlers/delegation.ts) issues unscoped account delegations, while pinned signer 5.6.3 correctly rejects an unscoped response to a scoped request. This reproduced the post-confirmation failure with the real SDK and a locally signed protocol fixture. We changed the request to match the supported II flow, not SDK validation. Caller-bound records authorization and primary derivation origin are unchanged. The fixture also verifies session restore and sign-out; it is not a real user-account sign-in. Known error classes are mapped to actionable messages without logging delegation or storage payloads.

### Abstract title and Probably Works bus — 2026-09-05

The latest visual iteration renames the game to IS IT THERE YET? and makes the bus the fictional app Probably Works. Reusable, cached canvas panels from `Signage.appWindow` are painted onto both sides and the roof; existing `Signage.label` surfaces share the same material/mesh creation helper. The side stripes and rear passenger windows are replaced, while the cab and service bay remain. SHIPPING… 99% is fixed artwork, not game state. Both character arms remain after the user’s clarification; the beer mesh, permanently bent drinking elbow and opening sound are removed. Physical rules, records keys, canister IDs and the permanent II derivation origin do not change with the public display name.

## Repeatable cargo impacts — 0.4.2

The old coordinate zones and permanent WINCH/SKILLS flags made real impacts on the remaining rollers irrelevant. `Simulation.step` now passes signed world-vertical chassis acceleration and absolute longitudinal travel speed into `Canisters.updateRide` after each Rapier step. It returns at most one released type; historical snapshot flags are observation only. No track/recovery coordinate participates. All three modules can be released repeatedly, using a rotating weak-latch order and short burst/cooldown/docking guards documented in the cargo guide.

The same measured acceleration drives a per-item bounded scalar spring for presentation: gain 0.65, spring 110 s⁻², damping 7 s⁻¹, travel ±0.11 m. A small type-dependent response prevents lockstep motion. Snapshot `rattle` is local vertical displacement in metres; `CanisterVisuals` interpolates it and adds rearward displacement and pitch/roll to the docked model. Authoritative interaction positions and release origin remain the socket, and only loose Rapier bodies collide. Phase changes clear visual motion. The sequenced `rattle` event is a quiet effects cue with a 0.35-second rate limit; it never changes capabilities. This supplies feedback without introducing unstable constrained cargo bodies or a second physics engine.

## Finish credits and OpenCloud identity alias — 0.4.2

The user requested a finish-screen attribution and an application link. The finish card now says “Built with GPT Astra. Deployed on OpenCloud.” and links to https://opencloud.org/ with a new-tab, noopener/noreferrer anchor. A compact footer follows the replay/menu actions. The card can scroll safely on short screens and the link has a 44px hit area.

The user also supplied https://isitthereyet.nano-tema--0v1.opencloud.org/. A live read confirmed it serves the existing frontend and records IDs. The permanent II derivation origin stays the original canister address. The new domain was already covered by the client’s non-local/custom-domain derivation setting; the missing piece was the primary’s certified `ii-alternative-origins` JSON with explicit CORS/MIME headers. No DNS, canister mapping, backend authorization or account origin is changed. Tests exercise exact origin configuration, SDK ICRC-95 request propagation and separation of local/official gateway defaults; real account equality still requires using the same II account on both domains.


## Title identity and practice entry — 0.4.3

A single local SVG (`public/favicon.svg`) represents an app window with code brackets and two wheels in the masthead, browser tab and OpenCloud console. It replaces the infinity glyph and separate bus icon. The title exposes one delivery CTA for the selected track. The user saw the previous adjacent normal/practice launch buttons as duplicates, so practice is retained under pause, explicitly labelled unsaved. It calls the existing recovery start transition, clearing the active saved-run reference and resetting to a preloaded practice state on the selected course; a later restart remains practice. The co-op teaser is static future-facing copy, without a join action or new network behavior. Title content can scroll above the footer on short desktop windows; the two-line title and compact laptop spacing keep the launch and co-op teaser in view at 1280×720. Versioned icon URLs refresh previously cached artwork. Physics, track rule keys, Internet Identity configuration and the records canister are unchanged; this is a frontend-only release.


## Easier first delivery — 0.4.4

The user requested a more forgiving first level. Only `old-road` changes: finish Z 136 → 112 m; the 8 m half-width remains; the ±4 m final S-bends become one 2 m bend. The first bump drops from 0.40 to 0.22 m and widens from 1.6 to 6 m; the later bump drops from 0.28 to 0.18 m and widens from 4 to 6 m. The extra small bump and final stepped climb are removed. Raising the ditch floor from −2 to 0 m, lowering its exit and rounding transitions halves the maximum exit grade from 0.75 to 0.375. The flat practice-spawn pocket and primary tree remain reachable. The new profile, finish, visible terrain, collision and cable support come from the same track data.

`winchOptional` controls only tutorial wording; no assistance force or cargo immunity is added. The first ascent can be driven and still supports cable recovery. Shared suspension/engine/cargo thresholds stay unchanged. A physical full-route regression verifies all three modules stay installed at 3 and 4 m/s; fast travel still causes real ejection. `old-road` increments its record rules to 4; the backend explicitly accepts that additional pair while preserving all nine historical pairs and active tickets. Relay ridge and Finality quarry keep their geometry and version 3 records.

## Decision — minimum profile and leaderboard, 0.5.0

Extend the existing records canister, keeping the `Account` record layout and its persistent map intact. Add a separate caller-keyed profile map with nickname, `{color,wheels,decal}` and a `listed` preference. `ensureProfile` creates one stored pseudorandom adjective/animal/number nickname and shares the existing 10,000-account bound. Names are decorative, non-unique labels, not account identifiers or security tokens. Nicknames accept 3–24 Latin/Cyrillic letters, digits, spaces, hyphen and underscore after trimming. Both API and interface validate names; the backend allowlists all cosmetic IDs. No user text enters HTML or scene texture markup.

Default sharing is false, including existing accounts. A public query scans at most 10,000 profiles and keeps only the 20 fastest current-course records, ordered by best milliseconds and principal as an internal deterministic tie-break. Returned rows contain nickname, cosmetic IDs, best time, completions and caller-relative `isYou`; no principal, historical results, active ticket or other profile detail is exposed. Live profile lookup makes edits/opt-out immediate and backfills the next eligible result. The current query accepts only old-road v5 and ridge/quarry v4 (updated in 0.5.3). Records remain browser-reported; no physics attestation is added.

`Account` uses the authenticated actor for profile creation/edits and caller-relative ranking; guest ranking uses an anonymous actor and never creates a profile. Generation guards discard stale private responses. The garage retains draft edits after a failed save, restores saved appearance on close/sign-out, traps focus and makes the game/menu inert while open. A profile refresh does not switch identity origin or alter current record keys. Six cached paint materials and three prebuilt decal/wheel groups bound cosmetic resources. `Renderer.setSkin` changes only render materials/enabled meshes; simulation has no skin state. The small SVG assembly preview uses the same catalog as the 3D renderer.

The minimum deliberately uses fixed catalog choices instead of arbitrary colors/images/freeform bumper text, and one shared canister instead of new infrastructure. All persisted profile state lives on the Cloud Engine; browser memory holds only an unsaved draft and the SDK retains its normal authentication session.

## Cargo loss announcements — 0.5.2

The user found capability changes too easy to miss. `src/ui/cargo-loss.ts` consumes the simulation's sequenced `eject` events at every fixed tick, independently of the persistent warning's priority and the mutable interaction message. A three-second simulation-clock lifetime pauses with gameplay; event sequence deduplication prevents the retained event tail from continually refreshing it. New ejections replace the headline immediately; reinstallation and session reset clear it. `main.ts` presents the headline, consequence and recovery action on a transparent surface. The model derives opacity/scale from the same clock, including 220 ms entrance and 280 ms exit, so pausing and replacing an event cannot desynchronize a separate CSS timer. Reduced-motion CSS keeps the message static. The user requested removing the original solid panel, overboard label, other-offline list and visual clutter; its colored bars are also removed. This changes only feedback: physics, records rules, backend storage and authentication are unchanged.


## Public link metadata — 0.5.4

`index.html` owns static description, canonical URL, Open Graph and Twitter Card metadata; no runtime DOM injection is required by crawlers. Social/canonical URLs use the public custom game domain, while the unrelated Internet Identity derivation origin stays on the original frontend canister address. `public/social/road-trip-v1.png` is a 1200×630 screenshot of the actual game scene plus dedicated card typography, served without authentication or client-side rendering. Use a new image filename for artwork changes because `/social/*` is cached immutably. The PNG is generated explicitly by a local tool, not during builds or at request time; reproducible builds copy the checked-in artifact.

## Post-finish identity and activity — 0.6.0

Previously a guest could not save after the finish because II issued the ticket only at the next start. Creating a new authenticated ticket at the finish would violate the existing server-duration check. Normal online starts now obtain a capability-protected ticket without requiring II; completion freezes the time, and a separate signed claim binds it to the player. Signed starts retain caller binding. Claim retries store the receipt on the delivery, so independent guest tabs work and legacy account ticket/receipt fields remain untouched. Both paths share a synchronous record-update helper. No await splits a backend mutation and no client-supplied principal is accepted.

The client retains each capability/result in memory. Cancellation and network errors preserve the displayed run, and generation checks discard late UI responses after a restart or account change. A claim attempt binds its local result to the current identity before sending, preventing ambiguous-response retries from switching accounts. II still opens directly from the finish button gesture. An explicit Join action enables profile publication atomically with the save; automatic signed saves preserve private profiles. Only bests qualifying for the existing top 20 appear publicly.

The same server transitions drive minimal aggregates: ready-page opens, accepted full starts, confirmed finishes and first claims, grouped by supported track/rules version. Reads use the runtime controller check. No analytics pixels, third-party events, persistent visitor IDs or device data are added. Bounded 24-hour capability state supports authorization and deduplication; lifetime counters remain separate. Counts cannot reconstruct past traffic or prove unique humans. See the records guide for protocol fields, limits and the controller command. This changes persistence/UI only; physics and course rules remain unchanged.

Mops now embeds its generated Candid interface directly. The former `candid` override embedded a checked-in compatibility subset, which omitted new methods from metadata even though the handlers worked. `backend:build` copies the generated interface for CLI decoding, but it is no longer an input override; new methods cannot be hidden by a stale subset.

## Verification scope and documentation context — 2026-09-06

The user requested lower token/time overhead after repeated browser work. Feature acceptance and later regression checks now have separate scopes: demonstrate a new integration once, then select checks for the actual changed boundaries. Complete driving is not a prerequisite for inspecting a later finish-screen style change. Persistence still requires access, retry and upgrade evidence. This changes the engineering workflow, not runtime architecture or gameplay.

Current status is deliberately short; detailed release evidence is preserved in `status-history.md` and read on demand. This avoids repeatedly loading thousands of historical words while retaining the evidence behind earlier claims. Canonical behavior stays in its topic document, with no requirement to repeat the whole release narrative across all documentation.

## Owner VPS TURN — 2026-09-07

After a separate-network failure report, the user authorized coturn on the existing `contabo` VPS. Keep ICP signaling and browser host physics; relay encrypted packets through coturn only when ICE requires it. Allow an external HTTPS credential endpoint because the certified-assets canister cannot run the VPS credential issuer at a same-origin dynamic path. The frontend explicitly allows that origin in CSP and omits cookies; the HMAC secret remains on the VPS. Public issuance has origin filtering and resource quotas, not authenticated membership enforcement. See [Networking](./networking.md) for operational limits.

## Guest playback timing — 2026-09-07

After successful separate-network connection, the user reported jitter only on the joining player. The original buffer assigned packet arrival timestamps to poses, so varying delivery intervals changed apparent movement speed. Guest interpolation now uses existing host simulation ticks and a render-clock cursor, with a 100 ms startup/recovery cushion. Buffer exhaustion holds and refills instead of repeatedly chasing incoming packets. This changes presentation only: no new protocol fields, guest physics, prediction, host authority or TURN changes. It addresses a demonstrated buffer weakness; no measured diagnosis of the user's exact connection or claim of fully smooth play is made.
