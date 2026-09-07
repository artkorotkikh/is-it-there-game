---
title: IS IT THERE YET?
tags: [game, entrypoint]
---

# IS IT THERE YET?

A physics road trip about shipping **Probably Works**, an unreliable app on wheels. Its battered bus wears browser-window panels, the slogan “Works on my subnet.” and a permanently optimistic 99% shipping bar. Load three removable modules — WINCH, CYCLES and SKILLS — then drive, mind the bumps, collect whatever falls out, and recover the bus with its winch. Start on a short, forgiving forest road, then try narrow Relay ridge or rolling Finality quarry. The first course has two low, broad bumps and a shallow dip that the bus can drive out of; its winch is optional. Play with keyboard/mouse or phone touch controls. The cargo bay stays open; impacts anywhere can rattle and repeatedly eject any installed module, including CYCLES. Slow crossings protect cargo. SKILLS loss reverses both driving axes, marked roadside trees accept the winch, and a held kick can right an overturned bus. Optional ROLL TEST rocks at the verge of each post-recovery straight let you deliberately tip it with one side; the centre lane stays clear. Release 0.7.0 adds the Forest crossing expedition and account-bound two-player rooms. Direct connections are available; TURN and separate-network verification remain outstanding in Status.

Release **0.8.0** is published on the owner's ICP Cloud Engine: [Play IS IT THERE YET?](https://isitthereyet.nano-tema--0v1.opencloud.org/). Every ejected canister raises a large centered three-second message naming the lost capability and how to restore it, with a transparent background and a gentle fade/zoom in and out. Internet Identity is optional: sign in before a full delivery or use the new finish-screen sign-in to save its personal best and completion count. Guest play remains available; practice and pauses do not count toward saved full runs. Detailed records stay private; players can opt into a friendly public top-20 leaderboard for each current course. Times are browser-reported, not competitive anti-cheat scores. The user confirmed Internet Identity sign-in works. Verification evidence and the remaining real-account finish/save/reload check are recorded in the status guide.

Open **My garage** to edit your nickname and combine six paints, three wheel trims and three sticker packs. Internet Identity creates a stable random default nickname; **Save profile** stores the name, look and sharing preference in the existing Cloud Engine canister. The garage previews changes, keeps drafts after failed saves and restores the saved look when closed. Cosmetics do not alter handling. **Leaderboard** is readable without sign-in; enable **Show my times on the leaderboard** in the garage to publish your current-course bests. Profiles and records survive upgrades and follow the same II account across devices.

The title uses an app-window-on-wheels mark and one delivery launch. Winch practice is available from pause as an unsaved run on the selected track. The title places a Solo / Co-op switch above the heading; the old multiplayer teaser and Solo deliveries label have been removed.

A separate [owner statistics panel](https://zhtrs-oiaaa-aaabz-aadga-cai.icp.net/) is published on the existing Cloud Engine; [access setup](./docs/admin.md) and verification are documented. It reads solo aggregates and four co-op counters with explicitly granted II access. Co-op collection is live and the existing dashboard account has read access (see Status).

Guest finishes can be claimed after II, and `npm run stats:cloud` reads controller-only game opens and per-course starts, finishes and saves. These are aggregate counts from collection start, not historical traffic or unique visitors.

Shared links include static Open Graph/Twitter metadata and a 1200×630 preview card captured from the actual game scene. The canonical sharing URL is the OpenCloud custom domain.

The finish credits GPT Astra and OpenCloud and links to the Cloud Engine application page. The custom game domain shares the original canister-based Internet Identity origin; sign in with the same II account to access its records.

The traveler has patched clothes, a few bruises and two animated arms. The beer prop and opening sound were removed at the user’s request. Original generated music and vehicle/winch/footstep effects start on interaction; Music and Sound can be muted separately.

## Expeditions

The published game adds Forest crossing, a reusable versioned JSON map catalog, planks/stones with placement previews, pushing and shared markers. The extended 64 × 192 m map gives each approach movable stones, a hollow and a climb, with marked recovery trees and open connections between paths. Expeditions has a compact start screen: create a team, sign in when needed, open its invite and sign in as a different account to join, then guest Ready and host Start. The single-map picker is hidden and the invite form is visible beneath Create expedition. Co-op uses DELIVER TOGETHER and a compact Forest Crossing card at the upper right with abstract forest artwork, an estimated 5–10 min, Moderate difficulty and 3 paths. Both modes share Music, Sound and Internet Identity status controls in the header. A separate rooms canister handles connection; existing II nicknames and the host’s bus look are reused, while solo tracks and saved records stay unchanged. Character outfits and co-op collection are described in the [accounts and measurement plan](./docs/multiplayer-accounts.md). Public network readiness requires TURN and separate-network verification. See [map authoring](./docs/maps.md) and [network setup](./docs/networking.md). Frontend/rooms run 0.8.0 with explicit item selection (outline/name, X or Next target) and aggregate co-op reporting; panel is 0.2.0; the profiles/records service is 0.6.1 after adding read-only panel access.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Use keyboard/mouse or phone touch controls. Art, audio and physics are bundled or generated locally. Plain Vite runs as an offline guest game; local records setup is documented below.

```sh
npm run check
npm run build
npm run preview
```

`check` runs TypeScript, physics/account tests, and documentation validation. `build` produces a static `dist/` directory suitable for an ICP asset canister. `npm run test:backend` builds and tests the persistent Motoko records canister on disposable PocketIC state.

`npm run deploy:cloud` updates the configured frontend, records and rooms canisters on the specified engine using the linked OpenCloud identity. Setup, authentication, preserved canister mappings and release details are in the deployment guide below.

With Google Chrome installed, `npm run test:browser` checks the full recovery route and pause/restart behavior in a separate browser. See the development guide for the Chromium alternative and controls.

## Project documentation

Product scope, architecture, reviewed milestones, controls, verification, and deployment requirements.
Source: [Project documentation](./docs/index.md)

## Agent instructions

All agents must update documentation together with implementation changes. The rule and the map of canonical documents are in [AGENTS.md](./AGENTS.md).
