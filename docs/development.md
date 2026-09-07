---
title: Development guide
tags: [development, controls, testing]
---

# Development guide

Local development requires Node.js 22.12+ and npm. Use Node 24 where possible. ICP tooling and credentials are not needed for the local physics stage.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install locked dependencies |
| `npm run dev` | Start Vite on localhost |
| `npm run typecheck` | Strict TypeScript checks |
| `npm test` | Headless simulation tests |
| `npm run test:browser` | Full route and pause/restart checks in headless Chrome |
| `npm run docs:check` | Check documentation hierarchy, local links, and required documents |
| `npm run check` | Run TypeScript, headless simulation tests and documentation checks |
| `npm run build` | Typecheck and build static files into `dist/` |
| `npm run maps:check` | Validate the bundled JSON map catalog |
| `npm run maps:new -- my-clearing` | Create a new map template without overwriting |
| `npm run rooms:build` | Build only the new rooms canister |
| `npm run test:rooms` | Check rooms access, retries, upgrade and expiry on PocketIC |
| `npm run preview` | Serve the production build locally |
| `npm run icp:build` | Build the frontend assets and persistent records canister |
| `npm run admin:build` | Typecheck and build the standalone statistics panel into `dist-admin` |
| `npm run stats:cloud` | Read lifetime activity totals with a current canister-controller identity |
| `npm run icp:login` | Link Internet Identity through the user's OpenCloud origin, once per machine |
| `npm run deploy:cloud` | Upgrade the frontend and records on the user's specified engine with the explicit linked identity |
| `node scripts/smoke-production.mjs https://z4wnx-uqaaa-aaabz-aadeq-cai.icp.net/` | Compare the public release with matching local `dist/`, then exercise cargo gameplay, audio and pause in Chrome |

## Choose the smallest useful verification

| Change | Default verification |
| --- | --- |
| Documentation only | `npm run docs:check` |
| Copy or simple styling | Build if publishing; inspect the affected layout only if needed. No full drive. |
| Existing physics tuning or logic | Relevant existing headless outcome tests; browser only for a specific unresolved visual/input concern. |
| New interaction or changed input/session flow | Relevant headless tests plus one representative browser scenario after the edits are complete. |
| Authentication, records or persistence | Relevant account/actual-Wasm tests, including ownership, retries and data-preserving upgrade. One browser journey when the user-facing integration is new or materially changed. |
| Deployment configuration or metadata | Build and check the affected served asset/API/metadata. No gameplay replay. |

Keep existing regression tests available. A full browser suite or a track/device matrix is not the default release gate. Repeat a passed scenario only if a relevant later edit, bug report or unresolved failure justifies it. For example, first implementing finish-time login justified one actual guest delivery through saving; changing its button text does not require driving the track again. Rapid headless tests usually provide better feedback for later logic fixes.

Separate environment failures from product failures. PocketIC needs a lifetime longer than a complete idle-between-requests drive (`ttl:900` in the finish scenario), and the local browser/backend need permission to bind ports. Fix those conditions before another full route attempt. Do not run separate typechecks immediately before a build that already performs the same check.

Read the short current status, then only the relevant canonical sections. Detailed release history is linked from status and need not be loaded routinely. Keep success output short; inspect a failing test's relevant log/trace rather than repeatedly dumping every file. Waiting for a test is chiefly elapsed time; additional model analysis, large outputs and image inspection are separate sources of token use. No exact per-operation token savings are claimed.

## Expedition workflow

Both title screens start with Solo / Co-op navigation; solo retains its three tracks and Co-op uses DELIVER TOGETHER. A single expedition map has no selection control; manual invite entry is visible beneath Create expedition. Team play creates an invite, opens that link directly into the guest lobby, then uses guest Ready and host Start; exploring alone remains available. Two-player entry requires the existing II account and uses its saved nickname/garage; first sign-in may create the normal default profile. Expeditions never start solo record tickets or save expedition results. See [accounts and measurement](./multiplayer-accounts.md). E acts on the named, outlined target or places a carried prop. X cycles nearby targets (Next target on touch); free cargo wins the default selection and blocked supports explain their restriction. Q/R rotates a prop, G also attempts placement, B pushes and T marks a spot. A second seated player is a passenger; exit and re-enter to change roles. In a team, pause is shared and only the host restarts. [Map authoring](./maps.md) and [room setup/protocol](./networking.md) contain the exact commands and limits.

## Interaction targeting verification

`npm test -- tests/interaction-targets.test.ts tests/field-kit.test.ts tests/canisters.test.ts tests/multiplayer.test.ts tests/expedition-recovery.test.ts` checks crowded selection, support protection, actual pickup/hold transitions, stale actions and per-player ownership alongside existing mechanics. `npm run test:browser -- browser-tests/interaction-targets.spec.ts` uses the real expedition UI/renderer/input on a fixture-arranged cargo pile, checking keyboard and touch selection/pickup and pause. It is not a full delivery or external-network session.

`src/game/interaction-visual.ts` draws selected object brackets from snapshots. `src/ui/interaction-indicator.ts` positions the target name and cycle control; it does not pick a separate client-side target. `src/ui/cargo-loss.ts` owns shared centered cargo-loss markup, sequenced event consumption and timed presentation for solo and expeditions.

## Controls

| Input | Action |
| --- | --- |
| WASD | Walk; throttle/reverse/steer when driving |
| Mouse drag / captured mouse | Orbit camera / look |
| Space | Jump on foot; brake when driving |
| E | Enter/exit vehicle, or attach carried cable at the anchor |
| E near cargo | Pick up a visible canister or install it in the matching rear socket |
| X / Next target (expedition) | Cycle nearby items, sockets and bus actions; E acts on the outlined target |
| Hold E near an overturned bus | Charge a physical recovery kick; keep hands empty and stand still |
| Hold E at an occupied rear socket | Remove a module after 0.85 seconds while the bus is stopped |
| G | Set the carried module down in clear space |
| P | Toggle the explicit parking brake; release before driving or winching |
| F | Take/stow cable near the RV; detach attached cable |
| Q / R | Reel in / reel out when attached |
| Shift | Run on foot |
| Escape | Release mouse / pause |
| Backquote | Toggle debug overlay |
| Music / Sound buttons | Independently enable or mute music and effects |

The title screen has one delivery button whose label follows the selected track. To try the winch with the RV already in the ditch, start a delivery, pause, then choose **Practice the winch · unsaved**. Practice loads all modules, keeps the selected track and does not save personal records. The pause panel also provides resume and restart. Drag with the left mouse button to orbit, or double-click the scene to capture the mouse. The camera expands to frame the player and RV when the winch is attached on foot; there is no first-person interior.

The normal route now begins with three loose modules behind the bus. Load all three first. Carrying a module slows walking and blocks the driver's seat/cable pickup. Missing CYCLES means no engine force; missing WINCH means no powered reeling; missing SKILLS after startup swaps W/S and A/D, with a persistent HUD label. Release both driving axes before using a new direction mapping or restored engine power. Walking, Space and camera are never inverted; the phone steering stick follows the same SKILLS reversal. Match the nearest rear socket; step sideways to select another slot, and step back into clear space if G reports an obstructed drop.

To use the winch: walk to the **front bumper** and press **F**, carry the hook to any reachable tree with an orange band, then press **E**. Hold **Q** to take up slack and pull the RV; releasing Q stops the drum and holds its length. **R** pays out, letting the cable sag and the vehicle move under gravity. **F** detaches while driving or when standing near the tree/front fairlead. Q/R work both on foot and in the driver's seat. The HUD shows **SLACK** when there is spare cable and **TAUT** under tension. Slower reeling under load is expected; the drum stalls at its force limit. A new build on port 4173 needs a page refresh and a new local run.

## Phone controls

Touch devices show a left analog movement/steering stick and right contextual buttons. Drag the scene with another finger to orbit. **Interact** becomes Pick up, Install, Get in/out, Attach, Hold · Remove or Hold · KICK! as appropriate. **Jump** becomes Brake in the driver's seat; Drop replaces Jump while carrying a module to keep the phone panel within six buttons. Cable/Stow/Detach, Park/Unpark, Drop, and attached-only Reel in/Pay out controls remain reachable. Touch actions use pointer capture and independent IDs so releasing a camera finger cannot release steering. Pause, blur and cancellation clear held input.

Phone HUD uses compact module chips, a shorter objective and smaller dashboard. Music/Sound are in pause; Internet Identity stays in the header. Title and modal panels scroll on short screens. Touch areas are at least 44px, the layout includes safe-area insets, and portrait camera distance fits the narrow view. Static scenery is batched by material in 60 m groups and rebuilt/disposed when changing tracks. Phone rendering caps pixel ratio at 1.25, uses 1024px shadows and fewer decorative trees. These are quality settings, not a measured performance guarantee. Actual-device Safari/Android checks remain separate from Chrome touch emulation.

## Code map

- `src/main.ts`: application lifecycle, fixed-step accumulator, pause, actions, HUD.
- `src/style.css`: responsive title screen, HUD, controls, pause, focus and reduced-motion styles.
- `src/game/config.ts`: physical and gameplay tuning with units.
- `src/game/math.ts`: DOM-free vector/quaternion helpers.
- `src/game/level.ts`: canonical terrain and road meshes, matching ground sampling, finite player boundaries and ground clearance.
- `src/game/simulation.ts`: authoritative local Rapier world, player/vehicle/winch, actions and snapshots.
- `src/game/canisters.ts`: stable item IDs, phase/capability transitions, access validation, safe drop/release/recovery and cargo events.
- `src/game/canister-visual.ts`: reusable hardware models, rear sockets, indicator lamps, selection frames and permanently open service hatch.
- `src/game/signage.ts`: cached local canvas lettering on scene surfaces; no remote image/font requests.
- `src/game/cable.ts`: DOM-free terrain support route, route length and paid-out slack shape, shared by physics and drawing.
- `src/game/cable-visual.ts`: continuous cable tube mesh, one draw call for all bends.
- `src/game/renderer.ts`: PlayCanvas scene, static environment, RV model, cable and camera.
- `src/game/character.ts`: articulated traveler model, cosmetic wear and empty-hand/carry animations and displacement-based gait.
- `src/game/audio.ts`: generated music, sound synthesis, audio lifecycle, separate mute buses and output diagnostics.
- `src/game/input.ts`: keyboard/touch input merging, per-pointer camera ownership and release/blur handling.
- `src/game/touch-controls.ts`: captured multitouch stick/buttons, context labels and neutral-input cleanup.
- `tests/roadside.test.ts`: side/roof kick outcomes, cancellation, anchors and cable support across curved shoulders.
- `browser-tests/mobile.spec.ts`: portrait/landscape Chrome touch emulation with simultaneous touch IDs, walking/camera, driving/brake, cancellation and pause.
- `src/game/types.ts`: simulation inputs and serializable snapshot types.
- `tests/simulation.test.ts`: physical behavior and gameplay transitions.
- `tests/canisters.test.ts`: loading, ownership, power/direction failures, neutral interlock, ejection physics, careful driving and same-ID recovery.
- `tests/cargo-helpers.ts`: deterministic fixture placement using real possession actions; browser tests never mutate physics state.
- `tests/cable.test.ts`: terrain clearance between cable nodes, crest/shoulder routing, slack length, endpoints and vertical cable cases.
- `browser-tests/recovery.spec.ts`: recovery shortcut, pause/camera/restart, slack/tension/stop/start and in-cab winch checks.
- `browser-tests/canisters.spec.ts`: complete new delivery route, initial loading, both losses, W/S recovery, manual CYCLES, hold cancellation and restart.
- `browser-tests/helpers.ts`: keyboard-only navigation, item collection and driving; state is read from the development getter.
- `browser-tests/controls-audio.spec.ts`: camera-relative walking, support beyond the former road edge, audio gesture/mute/pause behavior, and offline music signal verification.
- `playwright.config.ts`: separate headless browser, local web server, screenshots and failure traces.
- `scripts/check-docs.mjs`: documentation validation; this checks structure, not semantic freshness. Agents must still review meaning under AGENTS.md.
- `scripts/smoke-production.mjs`: served-file hashes, HTTP checks and production UI gameplay without the development getter; requires matching `dist/` and defaults to the running preview at localhost:4173 when no URL is supplied.
- `icp.yaml`: pinned certified-assets recipe, release version and OpenCloud app metadata.
- `public/_headers`: deployed CSP, MIME protection and caching rules; Vite preview does not apply these itself.
- `public/favicon.svg`: shared browser and OpenCloud app icon.

## Tuning and verification

Tune the vehicle and winch in the shared config. Keep the terrain's collision mesh and visual mesh derived from the same level data. When changing terrain, rerun recovery and shoulder/edge tests rather than assuming a ramp remains climbable. Screen-right at camera yaw 0 is −X; tests must check the camera basis, not assume +X means right on screen.

Headless tests exercise Rapier without a browser. `npm run test:browser` uses an installed Google Chrome by default; alternatively install Playwright Chromium with `npx playwright install chromium` and run `PLAYWRIGHT_CHANNEL=chromium npm run test:browser`. The automated browser uses software WebGL for a reproducible environment; its frame rate is not a hardware benchmark. The normal route test uses real key presses and reads the development-only, read-only `window.__rvDebug` diagnostic getter. No physics state is teleported or mutated by browser tests. Screenshots and failure traces go to ignored `test-results/`.

Browser checks cover the behavior affected by the change and runtime errors. Cable visibility, camera, restart and full finish are separate scenarios, not a mandatory checklist for every edit. Record the selected checks and their actual results concisely in the status document.

The debug overlay reports LOCAL mode, tick, physics/render FPS, and vehicle/winch values. Network peer count, RTT, and snapshot rate remain unavailable until transport exists; never display fabricated live measurements. In development, `window.__rvDebug.audio` includes audio context state, mute preferences and output RMS. Audio verification checks generated signal and graph behavior; it does not certify a particular speaker's loudness or subjective music quality.

## Browser expectations

Desktop Chromium is the first verification target. WebGL2 is required. Safari/Firefox and lower-powered devices need separate checks. The prototype pauses when the document is hidden. Losing focus clears held controls to avoid a stuck throttle or reel input.

## Initial interface details

| Before | After |
| --- | --- |
| No browser scene or UI | `renderer.ts` adds a low-poly valley, roadside props, RV, capsule player, marked anchor, visible cable and finish gate. All visuals are local primitives. |
| No entry flow | `main.ts` adds title, normal route, recovery shortcut, contextual HUD, pause, restart, finish, debug and load-error states; local-only status is explicit. |
| Default browser styling | `style.css` adds a restrained green/ochre palette, font smoothing, balanced headings, readable grouped controls and tabular live numbers. |
| No interaction states | Buttons have 44px minimum height, visible keyboard focus, explicit short transitions and 0.96 press scale; reduced-motion disables transitions and press scaling. |
| No viewport adaptation | UI spacing adapts below 800px wide and 740px high; this does not add touch gameplay support. |
| No hierarchy for UI surfaces | Layered shadows separate the title note and pause card; nested controls use smaller radii than the surrounding card. |
| Close camera at the anchor obscured the recovery | `renderer.ts` expands the orbit to frame RV and operator while attached, and raises/thins the marked tree's lower canopy. |
| Featureless capsule visual | `character.ts` adds an articulated, patched adult traveler with a tired face, bruise, bandages, scuffed boots, cap, beer can and a slightly uneven gait. The collider stays simple. |
| Visible shoulders ended without collision support | `level.ts` supplies one rendered/colliding shoulder mesh, a bounded walkable area and a ground-clearance guard. Mountains no longer intrude into that area. |
| Silent game | `audio.ts` adds generated background strings, bass and percussion plus context-sensitive gameplay effects; Music and Sound buttons provide independent mute and keyboard focus. |
| Game key handler intercepted focused UI controls | `input.ts` preserves keyboard activation of buttons, allows Tab navigation, and returns focus to the canvas when play resumes. |
| Straight cable vanished inside the crest and stretched like rubber | Shared terrain support, a continuous tube, visible ground slack, stiffer damped tension and a drum that slows/stalls under load. |
| Driving HUD hid winch commands; recovery framing cropped the RV | Q/R/F stay visible in the cab; SLACK/TAUT communicates tension; the on-foot winch camera leaves more room for the whole chassis. |

## Build footprint

The 0.5.0 production build is 5,159,538 bytes uncompressed / 1,688,088 bytes gzip across JS, CSS, and HTML (about 5.16 MB / 1.69 MB). Most bytes are PlayCanvas and the Rapier compatibility module, including embedded WASM; the new authentication SDK adds to the entry chunk. Procedural audio and scene lettering add no downloaded recordings, fonts or images. This is a measured build size, not an optimized asset budget. Vite warns about large engine chunks and externalizes optional PlayCanvas `node:worker_threads` imports used by Draco/GSplat workers; the current primitive scene does not use those paths. Consult status for current public smoke evidence.

## Historical 0.2.0 ICP Bus interface iteration

| Before | After |
| --- | --- |
| RV There Yet title and home-bound copy | `main.ts`/`index.html`: exact user title IS ICP BUS THERE YET; canister-loading premise, dispatch note and YES. WE GOT IT THERE finish |
| Plain cream/olive RV | `renderer.ts`: worn four-color side stripe, local ICP Bus badges and a hollow service bay; warm valley/traveler style retained |
| Solid rear wall, no cargo visuals | `canister-visual.ts`: three numbered/symbol-marked hardware boxes, handles/connectors/scuffs, sockets, lamps, highlights and an animated hatch |
| Decorative route with one ditch and a nearby gate | `level.ts`/`renderer.ts`: shared physical bumps, warning signs, extended final stretch and delivery gate at Z=139 m |
| No readable scene lettering | `signage.ts`: cached locally drawn text textures on module plates, bus badges, roadside signs and finish banner |
| One winch indicator | `main.ts`/`style.css`: three module cards, distinct online/carried/offline states, persistent power/direction warning, exact contextual interaction and held-removal progress |
| No wayfinding for lost objects | Projected/clamped colored cargo markers show type and distance; socket frames indicate selection/matching cargo |
| Camera focused beside the bus at startup | A rear loading view frames the three initial modules and open compartment; the normal orbit resumes after startup |
| Beer remained in the hand | `character.ts`: carrying pose holds the module; beer is hidden until hands are free |
| Audio always assumed an available engine/winch | `audio.ts`: capability-aware motor sound, cargo clicks/thuds/error/restoration cues, boot chord and reverse beep from effective throttle |
| Only automatic parking while walking | Explicit P brake plus visible parked status, and updated keyboard hints including G/held E |
| Plain title accent | `style.css`: restrained ICP-inspired title gradient and matching dispatch stripe; existing focus/press/reduced-motion behavior preserved |

## Shared entry UI

`src/ui/masthead.ts` supplies shared Solo / Co-op navigation and the same header markup to solo and expedition entrypoints; mode-local handlers bind separate music/effects state and their account lifecycle. The three controls remain visible on narrow screens; the brand contracts to its home-linked icon. `src/ui/expedition-card.ts` supplies editorial card metadata separately from the simulation map. See [map presentation](./maps.md).

For the changed entry/header interaction, use `ICP_LOCAL_BACKEND=1 npm exec -- playwright test browser-tests/entry-header.spec.ts`. It checks the title/card, independent audio controls, signed-out/connecting/signed-in/sign-out states, and garage entry without creating a room. Only the human II gesture is substituted. Desktop and 390 px screenshots cover the affected screens; it does not replay a route. The existing invite test now reads the account name from the shared header.

## Solo routes and accounts

`src/game/tracks.ts` defines three courses; `Level` supplies instance-owned geometry to simulation, rendering, cable and cargo. `src/services/account.ts` handles optional Internet Identity/session lifecycle and signed records calls. `src/services/auth-popup.ts` monitors early popup closure while the SDK handles authentication. `src/services/records-api.ts` describes the Candid client. `src/backend/main.mo` is the persistent records actor; `mops.toml` and `mops.lock` pin its compiler and library.

Additional checks: `npm run backend:check`, `npm run test:backend` (actual Wasm on isolated PocketIC), and the new `browser-tests/tracks.spec.ts` full routes. `tests/tracks.test.ts` verifies selected terrain/cable/colliders/recovery and physical cargo release; `tests/auth-popup.test.ts` covers early closure, successful automatic closure and popup blocking. `tests/account.test.ts` uses mocked SDK boundaries to test guest mode, cancellation, expiry, private-state clearing and late responses. Mocked tests do not prove a real Internet Identity login.

For Forest crossing terrain edits, `npm exec -- vitest run tests/expedition-route.test.ts tests/expedition-recovery.test.ts tests/field-kit.test.ts tests/maps.test.ts tests/multiplayer.test.ts` checks the three physical deliveries, carrying the cable to recovery trees, winch retrieval, bridge/support safety, terrain sampling and peer compatibility. `browser-tests/expedition-map.spec.ts` renders the actual map in a separate survey-camera fixture for inspecting terrain, props, marked trees and the finish; it is a visual check, not a human playthrough. Use the ordinary-control `browser-tests/expedition-plank.spec.ts` only when the carry/place flow changes.

Use `ICP_LOCAL_BACKEND=1 npm run dev` only after starting the local ICP network and deploying `records`; without this flag Vite remains an offline guest game. Full instructions and data bounds are in [Tracks, profiles and leaderboard](./solo-records.md).

| Before | After |
| --- | --- |
| One route and fixed scenery | `tracks.ts`/`renderer.ts`: original forest, cool Relay ridge and dusty Finality quarry, with disposable scenery and shared physical geometry |
| One unqualified start button | `main.ts`: three selectable track buttons, difficulty/description, per-track bests and a start label matching the selection |
| Decorative roadside props only | `renderer.ts`/`simulation.ts`: matching roadblock geometry and colliders on Relay ridge, plus marked quarry rollers |
| No account controls | `main.ts`/`account.ts`: optional Internet Identity sign-in, driver log, refresh/sign-out and visible connection/error states |
| Time appeared only at finish | `main.ts`/`style.css`: live tabular timer marked guest, practice or saved run; pause excludes time |
| Finish offered only restart | `main.ts`: best/save result, retry after failure, next track, replay and track selection |
| Saved restart could hide its preparation behind an overlay | `main.ts`: title status and guest fallback stay accessible while obtaining the next run ticket |
| Startup view could hide the bus behind newly seeded trees | `renderer.ts`: cleared the immediate dispatch area while retaining distant scenery |
| Title layout had no room for route cards | `style.css`: compact title on shorter screens, readable route hit areas, selected accents and responsive driver-log rows |

`node scripts/check-auth-popup.mjs http://127.0.0.1:5175/` exercises opening the real Internet Identity provider and cancelling it without creating an identity. Point it at a running Vite server with `ICP_LOCAL_BACKEND=1`, or at the published URL. It is separate from the offline route suite. The default URL is the dedicated local QA server at port 5175.

After deployment, `scripts/smoke-production.mjs` checks the metadata endpoint, frontend/backend cookie wiring, service version and anonymous-query rejection without creating records. This script requires Node 24 for direct imports of the typed Candid client. Save/retry/read/upgrade tests run on disposable local PocketIC state; do not create permanent synthetic production records as a routine smoke check. Actual production saving through Internet Identity is verified with a user-authorized delivery and recorded separately.

## Mobile and winding-road iteration

| Before | After |
| --- | --- |
| Keyboard-only gameplay | `input.ts`/`touch-controls.ts`: analog stick, independent camera finger, captured context buttons and cancellation cleanup |
| Dense desktop HUD on phones | `main.ts`/`style.css`: compact objective/module chips, smaller dashboard, large thumb buttons and touch-specific prompts |
| Audio buttons crowd the phone header | Audio controls move into pause on phones; short ICP BUS wordmark and Sign in remain in the header |
| Title and dialogs could exceed short screens | Scrollable touch title/modals, safe-area padding and compact portrait/landscape layouts; all track and account choices remain accessible |
| Rear hatch closed while driving | `simulation.ts`: doorOpen is always true; the existing hatch is fixed open while sockets remain visible |
| Cargo release required 12 m/s² at 2.6 m/s | Impact/speed thresholds are 8 m/s² and 2.1 m/s; careful driving remains possible |
| Missing SKILLS changed only throttle | Both driving axes reverse, with updated desktop hints/phone warning and a purple reversed stick; both axes must return to neutral |
| Straight terrain after recovery | `tracks.ts`/`level.ts`/`renderer.ts`: winding centerlines shared by road, ground, scenery, obstacles and finish gate |
| One cable destination | Orange-banded trees on both shoulders, with matching trunks/colliders and selected endpoint in the snapshot |
| Rollovers required a restart | Held contextual kick, wind-up/leg animation, metal/boing sound, charge bar, physical lift and short upright assist |
| Narrow camera and desktop render settings everywhere | Portrait camera fitting, static scenery batches and lower phone pixel/shadow/decorative-tree budgets |
| Context hints could confuse removal with kicking or overflow while carrying beside an attached cable | Separate hold labels, Drop replacing Jump, synchronized accessible button names and release of hidden-button holds |
| Old/new course times would be mixed | Rules version 2; current bests shown in selector/log, while version 1 history survives upgrades |

For a release-to-release persistence check, keep the previous built Wasm outside the disposable build directory before compiling the new source, then run `RECORDS_UPGRADE_FROM=/absolute/path/to/previous-records.wasm npm run test:backend`. This adds a test that installs the prior release, saves a result and starts another ticket, upgrades to the new Wasm, then verifies old results/tickets and separate version-2 statistics. Without that environment value the optional cross-release case is skipped; same-build persistence tests still run. Production state is never used for these fixtures.

`node scripts/smoke-touch.mjs https://z4wnx-uqaaa-aaabz-aadeq-cai.icp.net/` checks the built public game with real Chrome touch events in portrait and landscape: practice, enter, acceleration, brake, pause, mute and resume. It reads only the visible UI, requires diagnostics to be absent, and creates no account or saved record. This complements the local touch-only loading and winch route tests.

### Authentication regression checks

`tests/auth-integration.test.ts` runs the pinned AuthClient and signer against a local postMessage provider fixture with real generated keys and signed delegations. It reproduces rejection of the previous `targets` request, accepts the standard II response, restores the same principal and signs out. It exercises SDK decoding and persistence, not II passkeys or replica signature validation; no production account or record is created. `auth-options.ts` owns the supported request and safe error classification.

| Before | After |
| --- | --- |
| Requested a records-targeted delegation that II returns unscoped | Standard eight-hour origin-bound request accepted by the SDK; caller checks remain on the backend |
| Every sign-in failure appeared cancelled or unavailable | Popup blocking, cancellation, connection, storage and session validation have distinct messages and safe diagnostic codes |

The clean final gameplay suite passed 12/13 cases, including all three full routes and phone portrait/landscape/touch-only recovery. The remaining winch assertion reached z=45.14 rather than >46 in its 15-second software-renderer budget; its unchanged physical outcome passed the isolated recheck with a 30-second budget (45 seconds for the later climb).

## 0.4.1 identity and character revision

| Before | After |
| --- | --- |
| IS ICP BUS THERE YET title and ICP Bus display names | `main.ts`, HTML, II metadata and Cloud Engine labels use IS IT THERE YET?; the vehicle is Probably Works |
| Four colored side stripes and rear passenger windows | `renderer.ts`/`signage.ts`: app-window panels on both sides and roof, window buttons, Works on my subnet., SHIPPING… 99% and PLEASE DO NOT CLOSE THE BUS. |
| ICP Bus hatch/sign text | Probably Works delivery signs and DEPENDENCIES INSIDE hatch label |
| Precious cargo postcard | CANISTERS CARGO with Three canisters. One app. / Some assembly required. |
| Intro/finish framed the vehicle as ICP itself | App-on-wheels intro and “Your app made it to production. Somehow.” finish copy |
| Beer can and fixed drinking pose | `character.ts`: both arms retained, beer geometry removed, right arm swings and reaches for cargo; left-hand cable and kick animation retained |
| Cargo states said IN HAND | Carrying states now use CARRYING / CARRIED, while cable remains IN HAND |
| Can-opening sound at the start | `main.ts`/`audio.ts`: removed the cue, while music and other effects still start on interaction |
| ICP-specific gradient word in title | Abstract two-line title with the existing warm question-mark accent |

This cosmetic release keeps rules version 2 and all record keys. Verify desktop and both phone layouts, carrying and cable visuals, audio/start behavior, deployed title/metadata, and preserved backend access. No new physics tests are needed for the artwork.

`node scripts/review-visuals.mjs [url]` captures the title and a real camera orbit around the character/bus at desktop 1440×900 and phone 390×844 / 844×390. Default URL is the built preview at port 4173. It checks the public title and cargo card without mutating game state. Screenshots are kept in ignored `test-results/` for visual inspection.

## 0.4.2 cargo impact correction

| Before | After |
| --- | --- |
| `simulation.ts` restricted release to two one-shot coordinate zones | `Canisters.updateRide` evaluates actual acceleration and travel speed everywhere; track zone fields removed |
| Reinstalled modules were permanently safe; CYCLES never fell automatically | All three latch types rotate and can release repeatedly; existing capability/neutral-input rules apply |
| One rough patch could generate many simulation peaks | Fresh-impact quiet period, 2.5-second global cooldown and two-second docking grace bound repeated releases |
| Docked models stayed rigidly in place | Snapshot `rattle` drives bounded interpolated socket displacement/tilt in `canister-visual.ts`, then settles |
| No cue for an impact below release strength | `audio.ts` gives sequenced jolts a quiet, rate-limited clatter through Sound volume |
| Current records used rules version 2 | Version 3 separates new difficulty; backend accepts legacy versions 1/2 and keeps up to nine track/version results |
| Tests asserted permanent immunity and ignored late rollers | Actual Rapier crossings compare 1.7 versus 8 and 14 m/s on five late quarry bumps, repeated reinstall/loss, all module types, reverse, flat travel and burst/grace guards |

Tuning values and units live in `config.cargo`. `tests/cargo-ride.test.ts` uses initial fixture placement only for physical crossing setup; browser checks use real controls and a read-only snapshot. Backend upgrade verification uses the saved 0.4.1 Wasm with `RECORDS_UPGRADE_FROM=/tmp/icp-bus-records-0.4.1.wasm npm run test:backend`. This fixture lives outside the release and is never deployed.

## Finish credit and shared II origin follow-up

| Before | After |
| --- | --- |
| Finish card ended with replay and track selection | Compact “Built with GPT Astra. Deployed on OpenCloud.” footer, Cloud Engine invitation and OpenCloud.org application link |
| No outbound finish action | Explicit 44px link opens OpenCloud in a new tab with noopener/noreferrer; existing keyboard focus style retained |
| Desktop finish overlay could outgrow short windows | Wider, more compact finish card and safe vertical scrolling; phone sizing remains adaptive |
| A late WINCH loss referred to a recovery climb already completed | Objective note asks to return WINCH to its rear socket wherever it falls |
| Custom domain requested the original II identity but was not authorized | Primary serves an exact `ii-alternative-origins` allowlist with JSON MIME/CORS; principal derivation stays on the original canister origin |

`node scripts/review-finish.mjs [url]` checks desktop/portrait/landscape finish layout, focus/link reachability and returning to the title. It uses a DOM presentation fixture, not a simulated gameplay finish or record write. Actual full gameplay is covered separately by the three browser route checks. `scripts/smoke-production.mjs` additionally compares the served allowlist and headers with the release build, on either public game domain.


## Title and practice interface — 0.4.3

| Before | After |
| --- | --- |
| Infinity glyph in header and separate simple bus favicon | `public/favicon.svg` supplies one application-window/code-bracket/wheels mark for header, browser tab and OpenCloud; versioned icon URLs refresh cached art and the labelled home link keeps a 44px hit area |
| “Take the old road” and “Try the winch” compete on the title | One selected-track delivery button; unsaved winch practice moves into pause and retains the current track |
| No visible co-op entry | The former teaser is now replaced by the top Solo / Co-op switch; the solo launch and three tracks remain available. |
| Short desktop title could overflow into the fixed footer | `.menu` scrolls within its available vertical space; the title keeps two lines, with smaller type/margins below 850px height; existing touch scrolling remains |
| Browser helpers entered practice from the title | `startPractice` and the production touch smoke use actual start → pause → practice controls; no simulation setter is added |
| Production smoke assumed frontend and records versions always match | It reads the expected records version from its own `icp.yaml` configuration so static-only releases need no backend upgrade |

`scripts/review-visuals.mjs [URL]` now checks the title logo, single launch, future co-op copy, scroll reachability, keyboard/touch entry, loaded practice via pause and return to title at 1440×900, 1280×720, 390×844 and 844×390. It also checks the existing finish credit/link remains present. Screenshots go to ignored `test-results/identity-*.png`. Finish-screen presentation remains separately reviewable with `scripts/review-finish.mjs`.


## Easier first delivery — 0.4.4

| Before | After |
| --- | --- |
| First-course finish at 136 m with two ±4 m final bends | 112 m finish and one small 2 m bend; road width stays 16 m |
| Narrow 0.40 m first bump, extra late bumps and stepped final climb | Broad 0.22/0.18 m bumps and smoother final stretch |
| Deep ditch and mandatory steep winch climb | Floor raised by 2 m, rounded slope at half the maximum grade, driveable with the existing engine; winch remains usable |
| First-course HUD instructs every driver to use the cable | Optional-winch hint tells beginners to drive up gently, with cable instructions when actually carrying/attaching it |
| All current tracks use rules version 3 | Only the first uses version 4; backend retains historical pairs and unchanged version 3 times for the other courses |

`tests/first-delivery.test.ts` uses actual spawn/load/drive physics to finish at 3 and 4 m/s with all cargo and no winch/kick, and verifies that fast driving still causes release. The existing first delivery browser scenario now checks loading → steady driving → shallow-dip recovery → finish with all three; cable stop/start and in-cab recovery remain in `browser-tests/recovery.spec.ts`. Backend checks cover ten distinct track/version pairs and an actual 0.4.2 → 0.4.4 upgrade preserving an old-road v3 result and a ridge v3 active ticket before saving a separate old-road v4 result.

## Profiles and cosmetic garage — 0.5.0

| Before | After |
| --- | --- |
| Account panel only shows private records | Three tabs: Garage, My times and public Leaderboard; title links open garage/ranking and signed-in header shows the nickname |
| Driver identified by a principal suffix | Stable canister-generated random default, editable 3–24-character nickname |
| One bus livery and wheel trim | Six paint materials, three cached sticker groups and three wheel trims; 54 cosmetic-only combinations |
| No profile editor | Catalog choices, safe SVG preview, actual bus preview, explicit save, failed-save draft retention and discard-on-close |
| No public results | Opt-in, per-current-course top 20 with rank, paint, nickname, time and caller highlight; empty/loading/retry states |
| Overlay had no focus containment | Garage traps Tab/Escape, restores focus, makes siblings/canvas inert and scrolls at desktop/phone sizes; keyboard-operated tabs and labelled form inputs |

`src/game/skin.ts` owns cosmetic IDs/presentation; `Renderer.setSkin` applies them without touching physics. `src/ui/garage.ts` owns panel/draft/preview/ranking UI; `Account` owns all server state and identity-generation guards. `backend-tests/profiles.test.ts` exercises actual-Wasm nickname/cosmetic validation, account separation, sharing, ranking ties/cap/backfill and upgrade persistence. `browser-tests/profile.spec.ts` uses a disposable live PocketIC canister and HTTP agent; Playwright replaces only AuthClient’s human sign-in with a deterministic test identity from `browser-tests/identity-fixture.ts`. No application code imports that fixture or exposes a profile/physics setter. The test verifies actual backend profile saves/reload, failed-network retry, pending opt-out completion while the board is open, guest reads, all three wheel/sticker variants and desktop/phone layout; it does not prove a real passkey gesture. Run `npm run backend:build` before this browser test.

## Cargo loss feedback — 0.5.1

| Before | After |
| --- | --- |
| A small priority warning could mask a new loss | A large centered headline announces each physical ejection and its exact consequence |
| Repeated loss could look like the existing offline state | Sequenced events renew six seconds of reading time, including after reinstallation |
| Phone feedback competed with small HUD text | Responsive, noninteractive notice replaces the smaller warning temporarily; controls remain usable |

`src/ui/cargo-loss.ts` owns shared markup, event consumption, lifetime and English copy. Solo and expedition screens use the same presentation. Host/exploration advances it on fixed simulation ticks; a guest advances reading time from active render frames because it has no local physics ticks. Pause, visibility pause, connection stall and finish hide/freeze it; a new expedition epoch resets sequence state. Only safe, known event kinds/types are consumed, and retained/reordered snapshots are deduplicated. `tests/cargo-loss.test.ts` checks quiet startup/manual events, deduplication, expiry, new-loss priority, repeat loss, restoration, malformed/skipped/reordered events, pause/resume and session reset. `browser-tests/cargo-loss.spec.ts` drives with real keys to a physical WINCH ejection at desktop/portrait/landscape viewports, checks nonblocking layout, pause/resume, expiry and restart. Its CYCLES/SKILLS screenshots are explicitly DOM-only layout fixtures, not claims of physical ejections; it never changes physics state. The production smoke also checks the large WINCH headline immediately after actual loss.

The 0.5.1 production HTML/JS/CSS footprint is 5,163,431 bytes raw / 1,689,031 bytes gzip across six files. This UI release does not change the records service or course versions.

## Transparent announcements — 0.5.2

| Before | After |
| --- | --- |
| Opaque card with box shadow, colored top edge and countdown | Transparent background and no decorative bars; text shadows retain contrast over the road |
| “CARGO OVERBOARD” and “Also offline” rows | Only headline, consequence and recovery instruction remain |
| Six-second message with small position transition | Three seconds total with 220 ms fade/zoom in and 280 ms fade/zoom out, derived from the paused simulation clock |
| Reduced motion hid the countdown | Reduced motion shows static text for three seconds |

The lifetime test asserts expiry at three seconds. A motion check covers entrance/hold/exit values, and the desktop browser check observes computed opacity and transform during a real ejection to prove both phases render. Phone checks use reduced motion and verify transparent, unclipped text at portrait and landscape sizes. The public smoke requires transparent background and absence of both removed labels.

The 0.5.2 HTML/JS/CSS footprint is 5,162,675 bytes raw / 1,688,909 bytes gzip across six files.


## Optional rollover rocks — 0.5.3

| Before | After |
| --- | --- |
| Deliberate rollovers required awkward roadside driving | One signed, physical faceted stone at the verge of each flat post-recovery straight; broad centre bypass |
| A rotated door offset could place the player inside the chassis | Ground-level, collision-checked exit candidates with extra clearance for an overturned bus |
| Side-facing suspension rays could catch the rock during a kick | Suspension engages within 60° of upright; a bounded sideways kick impulse creates clearance |
| Current records were old-road 4 / other tracks 3 | Current rules old-road 5 / others 4; thirteen historical/current pairs retained, current-only public boards |

`tests/rollover-rock.test.ts` places only the initial approach, then verifies physical roll, landing, real exit and held kick at 4/8 m/s with ±0.18 m aiming tolerance on all three routes. Two open-lane paths per course cross at 14 m/s. Bypass measurement ends once the full chassis clears the rock, so later road bumps do not confound the check. Both real-rock recoveries and existing side/roof kick checks bound speed, lift and displacement; the side/roof checks additionally bound angular step. `browser-tests/rollover-rock.spec.ts` uses real keyboard input from unsaved practice, drives onto the old-road rock, exits and kicks, with read-only snapshots and screenshots. Normal first delivery is separately checked from loose cargo to finish.

```sh
npm run check
RECORDS_UPGRADE_FROM=/tmp/icp-bus-records-0.5.0.wasm npm run test:backend
npm run test:browser -- browser-tests/rollover-rock.spec.ts browser-tests/canisters.spec.ts --grep 'optional roadside rock|First delivery'
```

The optional upgrade fixture is the locally retained, previously deployed 0.5.0 records Wasm, outside release assets. It proves preservation of an edited/shared profile, historical results, a retry receipt and an active ticket, then saves each new current course on disposable PocketIC. No synthetic profiles or times are written to production. See Status for actual results.


## Social link previews — 0.5.4

| Before | After |
| --- | --- |
| Ordinary description existed, but no social tags | Static OG and Twitter Card title/description, website type and canonical custom URL |
| No crawler-readable game image | 1200×630 PNG with actual title scene and card typography, absolute URL, dimensions, MIME and alt text |
| No verification of raw crawler responses | `check-social-preview.mjs` checks identical built HTML and exact image bytes/dimensions/MIME for browser, Facebook, X and Telegram user agents |

To regenerate the card intentionally, start the built preview and run `node scripts/capture-social-card.mjs`. It captures the live procedural scene with a DOM-only promotional layout; no game source or physics is modified and no account/run is created. Inspect the generated PNG before building. When changing published artwork, increment the image filename in the capture tool, static metadata and checker so immutable caches retain the correct old asset.

```sh
npm run build
npm run preview -- --port 4173
```

In a separate terminal:

```sh
node scripts/capture-social-card.mjs
npm run build
node scripts/check-social-preview.mjs
npm run docs:check
```

After frontend-only deployment:

```sh
node scripts/check-social-preview.mjs https://isitthereyet.nano-tema--0v1.opencloud.org/
node scripts/smoke-production.mjs https://isitthereyet.nano-tema--0v1.opencloud.org/
```

The checker reads initial HTML and the declared image over HTTP without executing JavaScript or signing in. User-agent checks do not prove that a platform has refreshed its cached preview. Open Graph fields follow the [official protocol](https://ogp.me/).

## Finish saving verification — 0.6.0

`npm run backend:build` refreshes the checked-in Candid interface from Mops output, and `stats:cloud` explicitly uses it so controller results have readable field names.

`backend-tests/deliveries.test.ts` exercises open/launch/finish/claim deduplication, controller-only reads, guest ownership, signed-start binding, timing bounds, independent runs and expired capabilities on actual disposable Wasm. Aggregate and in-flight state are checked across upgrades; `RECORDS_UPGRADE_FROM=/tmp/icp-bus-records-0.5.3.wasm npm run test:backend` also verifies an actual prior-release upgrade retaining profiles, private records and legacy active/receipt state.

`browser-tests/finish-save.spec.ts` loads every module and physically drives the full first route. It substitutes only the human II gesture against a disposable PocketIC backend, then checks cancel, unavailable network, retry, publication, reload and counters. Desktop and portrait finish screenshots use that actual completed run, not a fabricated physics state. Ordinary profile/garage regression remains separate. Physical phone/real II completion are separate manual checks.

| Before | After |
| --- | --- |
| Guest finish suggested login before another run | Finish offers **Sign in & join leaderboard** and saves the already-finished delivery |
| No publication explanation on the finish | Adjacent copy explains public nickname, bus look and bests; garage opt-out remains available |
| No usage measurement | Controller CLI reads backend aggregate opens and per-course launch/finish/save counts |

Avoid production playthroughs or API event writes solely to seed statistics. Use local PocketIC for fabricated identities/results/events. Production release verification uses `node scripts/smoke-production.mjs https://isitthereyet.nano-tema--0v1.opencloud.org/ --read-only` to compare built assets/II headers and check records/version, anonymous statistics rejection and public boards without executing the app. `npm run stats:cloud` separately reads the controller query. The gameplay smoke script now creates real visit/start/finish activity if run against production; do not silently interpret those as organic players.

## Co-op analytics verification

`src/services/coop-telemetry.ts` sends only connection/start milestones with bounded retries. Rooms stores bounded session deduplication state and lifetime counters; the panel independently reads both backends.

```sh
npm run rooms:build
npm test -- tests/coop-telemetry.test.ts tests/admin-statistics.test.ts tests/multiplayer.test.ts
npm exec -- vitest run --config vitest.backend.config.ts backend-tests/rooms.test.ts backend-tests/coop-analytics.test.ts backend-tests/coop-capacity.test.ts
npm exec -- playwright test browser-tests/coop-analytics.spec.ts
```

Retain the previous rooms Wasm before rebuilding and set `ROOMS_UPGRADE_FROM=/absolute/path/to/previous-rooms.wasm` on the backend command to include the prior-release upgrade case; otherwise that optional case is skipped. The capacity case makes 5,001 disposable local creations. Browser fixtures use separate signed identities and disposable PocketIC services, not production statistics.
