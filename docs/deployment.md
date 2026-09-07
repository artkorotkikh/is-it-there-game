---
title: Cloud Engine deployment
tags: [icp, deployment]
---

# Cloud Engine deployment

The game **IS IT THERE YET?** is deployed on the user's existing **nano-tema** Cloud Engine. Release 0.7.0 publishes Forest crossing, its new entry UI and account-bound expedition rooms. Frontend and rooms now run 0.8.0, profiles/records 0.6.1 and the separate statistics panel 0.2.0. TURN and separate-network multiplayer validation remain outstanding. [Play](https://z4wnx-uqaaa-aaabz-aadeq-cai.icp.net/) or open its [OpenCloud application page](https://opencloud.org/console/engines/engine-f70b19ae-a28e-445a-8ac5-5eaa27e23d71/apps/IS%20IT%20THERE%20YET%3F).

## Co-op analytics 0.8.0 — published, 2026-09-06

Upgraded the existing rooms service, then frontend and admin using `npm run deploy:cloud -- rooms` and `npm run deploy:cloud -- frontend admin`. All are Running and live metadata confirms versions 0.8.0/0.8.0/0.2.0. No records deployment. Public read-only game/admin smoke passed exact assets, headers, backend mapping and anonymous access denial. Controller `rooms.adminStatistics` succeeds; collection began at `1788724071953051233` ns, with zero initial counters. No test events were sent to production.

| Service | Existing canister | Module hash |
| --- | --- | --- |
| Frontend 0.8.0 | `z4wnx-uqaaa-aaabz-aadeq-cai` | `b5b537762b17ff1cec4ea2db10feafae57b18b4e221dc9525b8402b93cbebad7` |
| Rooms 0.8.0 | `zsua7-paaaa-aaabz-aadfq-cai` | `b9f0535ba521252e246cfd6c4fe6f893848727293d102f1e1a34b8230ddf85c6` |
| Admin 0.2.0 | `zhtrs-oiaaa-aaabz-aadga-cai` | `44c480f56ad33686640ea1a79645412ccb2b9c90dae28c22ddb1a3e68822bd86` |

Frontend synced 13 assets, state hash `f1f722aa5c5a272a963c4713e0863395208f7c3b56fa4e3808d6d374031d101a`; admin synced five, state hash `98e37369284a8bb329b6ab6c23ffd6305e3b69999c3f071fb2ff14d726ad9b83`. Records ID, hash `6af7723b3ebacdeae70b548df4c070658ec0785ae1f83f851fa8fb7f92e20c74`, settings and memory remain identical to pre-deployment readback.

**Access completed:** after explicit user authorization, applied the existing dashboard account's rooms reader grant and verified it via controller readback. The earlier automatic-review block is resolved. The requested `npm run deploy:cloud -- frontend rooms admin` rerun succeeded with all assets already current. Both read-only smoke checks passed; all service module hashes remain unchanged. Records ID/settings remain unchanged and records was not targeted. Its memory changed between reads, so no identical-memory claim applies to this later rerun. Co-op collection timestamp and initial zero counters survived. See [grant procedure](./admin.md#co-op-rollout-and-reader-grant) for later access changes.

## Interaction fix 0.7.1 — published, 2026-09-06

Published only `frontend` with `npm run deploy:cloud -- frontend` on the existing engine. The same frontend `z4wnx-uqaaa-aaabz-aadeq-cai` is Running; metadata reports 0.7.1. Thirteen assets synced; certified-assets state hash `6a6c3a75b1b6699ac151022234c5a46241463107748912c542a53f17705e0967`, frontend module hash `39baf804128166e5e0a2a1d1a07cb56ca64de4e85b4b4fc7f65df6179641e950`. Records, rooms and admin IDs, module hashes, settings and memory match the pre-deploy readback. No reinstall or persistence/reader-grant edits.

Verified 51 focused headless cases, the deployment build, public read-only exact assets and service wiring (records 0.6.1), and Chrome guest expedition startup/walking/pause with zero production update calls. Reused the previous keyboard/touch target-selection browser evidence; no full route or external-network rerun. Both teammates must reload and create a new invite because interaction compatibility is net3. The analytics audit confirmed that only solo aggregates exist; no room-created/joined/connected/started counters were introduced. See [measurement audit](./multiplayer-accounts.md).

## English panel 0.1.1 — published, 2026-09-06

The owner confirmed the authenticated production panel works, then requested English by default. Published only `admin` at the same [Statistics URL](https://zhtrs-oiaaa-aaabz-aadga-cai.icp.net/). Five assets synced; state hash `8a8696f46d31b3fb9e1994065748160d7f9149662afeb593580dc69ffaca58ae`. Built admin WASM hash: `5db6a15f98190166c8b738c9dbba8204b603f540901fcb02b2db88e84db76031`. Strict build, two formatting/CSV checks, `docs:check` and read-only production exact-assets/access checks passed. The records 0.6.1 service and existing read grant were not changed. Previous 0.1.0 publication evidence follows.

## Statistics panel release — published, 2026-09-06

Published [Statistics](https://zhtrs-oiaaa-aaabz-aadga-cai.icp.net/) after the owner renewed the existing `rv-there-opencloud` delegation. Targeted only `records admin`: records `zvvgl-cyaaa-aaabz-aadfa-cai` upgraded to 0.6.1 in place; new admin `zhtrs-oiaaa-aaabz-aadga-cai` serves panel 0.1.0. Both are Running under the existing controller. Frontend/rooms and game II origins were not deployed or changed.

Records WASM: `6af7723b3ebacdeae70b548df4c070658ec0785ae1f83f851fa8fb7f92e20c74`. Admin WASM: `1c78bfeac9064612d67ba14f8f2e933eebec38faed218fa81c70dacfbe0f91b5`. Five admin assets synced; certified-assets state hash: `334dc56bc7b71b50c8773362428cef033894e0f15ceece918c47a6dc5b5509d1`. Live module hashes match deployment artifacts.

`node scripts/smoke-admin.mjs` passed exact assets, security headers, canister wiring, records version and anonymous rejection. Controller statistics were byte-identical before/after upgrade: 19 opens; old-road v5 10/3/1 starts/finishes/saves, relay-ridge v4 2/0/0, finality-quarry v4 1/0/0; `since = 1788702054774225515` retained. No production test accounts/results/events were written. The owner supplied the real panel-origin II principal and received a read-only grant. Controller readback confirmed that exact account as the sole active reader. The owner confirmed successful production viewing on 2026-09-06; future access changes follow the [grant procedure](./admin.md#publish-and-grant-access).

## Release 0.7.0 — deployed, 2026-09-06

After the user's local playtest and explicit deploy request, `npm run deploy:cloud -- frontend rooms` upgraded the existing frontend and installed rooms on the same engine. Thirteen assets synced with certified-assets state hash `9f60d8706f54a5c63b3b109f7eafe5734c87c676cac7a9a109bc5eaec4d64197`. The records canister was not deployed or reinstalled.

| Canister | ID | Version | Verified state |
| --- | --- | --- | --- |
| Frontend | `z4wnx-uqaaa-aaabz-aadeq-cai` | 0.7.0 | Running; 116,876,126 bytes memory |
| Rooms | `zsua7-paaaa-aaabz-aadfq-cai` | 0.7.0 | Running; 5,598,807 bytes memory |
| Records | `zvvgl-cyaaa-aaabz-aadfa-cai` | 0.6.0 | Running; unchanged 5,966,156 bytes memory |

Frontend WASM: `9bdd17ea83045d4b8f456545402e4cfed849d8dfad585ef29106c31bf54dfed7`. Rooms WASM: `166bcdf2dc82f6c306b9f04a1f20801229e02f84c6f5ca5e5141212c74e72c28`. Records retains `72e7d9f34bdd9207392133db155c6867c4023b48762b2520156802ac0b22fb34`; its ID, module hash, memory and complete settings match the pre-deploy readback. All three retain the existing engine controller. Frontend settings and its public `ic_env` cookie contain all three verified IDs. The original II derivation origin, custom alias and records/auth source hashes are unchanged.

Verification: 152 headless tests; five actual-Wasm rooms tests; targeted frontend/rooms build; public read-only asset/hash/MIME/CSP/404, illustration, II origin, all sibling IDs, records version/privacy and public-board checks. A Chrome check of the published expedition passed menu loading, enabled room entry, guest exploration, walking input, pause/resume and absence of development getters, with no page errors or canister update calls. Screenshots were inspected. No synthetic production room, profile, result or activity counter was written. Earlier local two-player checks remain the evidence for team behavior; this public smoke does not certify a two-account session across networks.

The release uses direct ICE. TURN, forced-relay and separate-network validation remain outstanding, as communicated before deploying. To repeat the public checks against the matching `dist/` build:

```sh
node scripts/smoke-production.mjs https://isitthereyet.nano-tema--0v1.opencloud.org/ --read-only
node scripts/smoke-expedition.mjs
```

## Release 0.6.0 — deployed, 2026-09-06

Both existing canisters are built for guest-finish claiming and controller-only counters. Strict TypeScript/121 headless checks, 20 actual-Wasm checks (including the real 0.5.3 upgrade) and the complete guest-finish/login/retry/leaderboard/reload browser scenario pass. Gameplay and record course versions are unchanged. The existing OpenCloud CLI identity was reauthenticated after expiry. Deployment succeeded with eleven assets synced, state hash `2a1035f8b5d16f07dfca6510052ac359a5502f73a233453abd5ec9b70336540d`. The original canister IDs, controller and shared II origin remain unchanged; records used an upgrade, never reinstall.

- Frontend: Running, `service:version` 0.6.0, memory 112,747,166 bytes, WASM `cb2beb1da693c65c77d8683fe065edfca848b6d79592f95caf94202f684c45a1`.
- Records: Running, `version()` 0.6.0, memory 5,966,156 bytes at final readback, WASM `72e7d9f34bdd9207392133db155c6867c4023b48762b2520156802ac0b22fb34`.
- Public read-only smoke: exact release assets, MIME/cache/CSP, preserved II metadata/alias, anonymous statistics/private-data rejection and current boards passed. All four OG/image crawler-style checks passed. No production game execution or fabricated event/profile/result was used.
- The controller query succeeded. Initial counters were zero; a later read showed one opening with no course launches. `since` is `1788702054774225515` nanoseconds. Totals are approximate usage after release, not historical traffic or unique visitors. Explicit Candid decoding gives readable `opens`, `courses`, `starts`, `finishes`, `saved` fields. A subsequent records-only upgrade corrected the embedded Candid subset; executable sections match the initial 0.6.0 module byte for byte. Discovered-metadata CLI decoding now also works, and the same `since` timestamp / one opening survived that upgrade.

Controller command: `npm run stats:cloud`. Production smoke should use `--read-only` to avoid adding test opens/starts to the usage counters.

## Release 0.5.4 — 2026-09-06

Frontend-only build and deployment succeeded. Eleven assets synced, including `social/road-trip-v1.png` (1200×630, 378,360 bytes). The static head now serves description, canonical custom URL, complete OG image properties and Twitter large-image card tags without JavaScript.

- Frontend: Running, `service:version` 0.5.4, memory 112,353,758 bytes, WASM `95427b67c1bf0feeeba88e78cdb83d1a753dabc4f0e677944161ae729d76f77b`.
- Records: Running, version 0.5.3, unchanged memory 5,783,404 bytes and WASM `1134e7a3b52a8c80ba1cf625096a7d2a2ff880b9db2c5a5b8c5a461050050312`.
- Certified-assets state hash `ab23453527bd17bc924bd0c6df62f942ff8b3ffbeef64dc4ea50cb85b41ab061`. Existing controller/IDs, origins and zero cycles/idle burn retained.
- Strict TypeScript/build and docs validation passed; card visually inspected. Local and public raw-HTTP metadata/image checks pass for browser, Facebook, X and Telegram user agents. Public HTML and PNG match the build, with correct tags, 200 responses, MIME and dimensions. This does not claim cache refresh inside social platforms. Public guest gameplay smoke passed exact assets/headers, II/records/privacy/boards and real loading/driving/cargo loss/braking/audio/pause, with no errors or external requests. Final documentation validation passed. No synthetic production data was written.

## Release 0.5.3 — 2026-09-06

Both canisters build successfully. Strict checks pass 118 headless/account tests; 16 actual-Wasm backend tests include a real 0.5.0 upgrade preserving profiles, old times, receipt and active ticket. Normal first delivery and actual keyboard rock rollover/exit/kick both pass in Chrome. Rules become old-road 5 / ridge and quarry 4, while all thirteen supported historical/current result pairs remain stored. Public boards select only current rules.

Automatic approval review initially rejected deployment before execution. The user explicitly approved both existing canisters on 2026-09-06 (“да, заливай”), then `npm run deploy:cloud` successfully upgraded the mapped canisters and synced ten assets. No reinstall, new canister or engine; the existing controller, IDs and II origin remain unchanged.

- Frontend: Running, `service:version` 0.5.3, memory 112,681,246 bytes, WASM `0b36a6b39e34c2a443d5f16c217ad86dbc5a1e4050937fe1cb43b78a06ae9be1`.
- Records: Running, `service:version` 0.5.3, memory 5,783,404 bytes, WASM `1134e7a3b52a8c80ba1cf625096a7d2a2ff880b9db2c5a5b8c5a461050050312`.
- Certified-assets state hash `4c50b6743fcc3cd8c32f791173b0ca0557755c367e686027a421a4833d9f1a2b`. Both canisters retain zero cycles and idle burn.
- Public custom-domain smoke passed exact assets/headers, II configuration, records 0.5.3/privacy/boards, and actual guest loading/driving/cargo loss/braking/audio/pause with no errors or external requests; screenshot inspected. No synthetic production account or time was created.

## Release 0.5.2 — 2026-09-05

Frontend-only build and deployment succeeded on the existing engine; ten assets synced. Existing IDs, controllers, primary/II origins and records rules are preserved.

- Frontend: Running, `service:version` 0.5.2, memory 112,746,590 bytes, WASM `ff50399b90da35f95c82b32ac9059c6157f4e81d592f7c8d53e1e1047e53921b`.
- Records: Running, version 0.5.0, unchanged memory 5,717,662 bytes and WASM `f2d714233b4f6a755ba2076792a6f7bd8c16a529d15e15be31b2f1b8b6dd65f3`.
- Certified-assets state hash `5c3a58aef7f188b0031e6c43c705d8a2b395e9ba42b25e73511208f1ab5b00dc`. Both canisters retain zero cycles/idle burn.
- Strict checks passed all 97 headless/account tests and docs validation; all three browser scenarios passed, including observed rendered fade/zoom, desktop/phone layouts, reduced motion, pause and expiry. Public custom-domain smoke passed exact asset bytes/MIME/CSP/cache/404, II metadata/alias, unchanged records API and private-data rejection, public boards, guest garage, loading/driving/physical cargo loss, transparent notice with both labels absent, expiry, braking, audio and pause. No runtime errors or external requests; public screenshot inspected. No test profiles or results were written.

## Release 0.5.1 — 2026-09-05

`npm run icp:build -- frontend` and `npm run deploy:cloud -- frontend` succeeded on the existing engine. Only the frontend was upgraded; existing identities, records rules and canister mappings remain fixed.

- Frontend: Running, `service:version` 0.5.1, memory 112,746,398 bytes, WASM `2f7505afad75cadf204538b5a350145b0d71dc3020adcad1b5e345a66b868a41`.
- Records: Running, version 0.5.0, unchanged memory 5,717,662 bytes and WASM `f2d714233b4f6a755ba2076792a6f7bd8c16a529d15e15be31b2f1b8b6dd65f3`.
- Ten assets synced; certified-assets state hash `e2c7d87dd316e30ee087ddf24db5bdbf6c0d3799390ddcb35725b98488fed294`. Both canisters retain zero cycles/idle burn.
- Strict checks passed all 96 headless/account tests and docs validation. All three final browser scenarios passed at desktop, portrait and landscape sizes, including actual cargo ejection, pause/resume, expiry and restart. Public custom-domain smoke passed: exact release bytes/MIME/CSP/cache/404, II metadata/origin alias, private-data rejection and public boards, guest garage/leaderboard, actual cargo loading/driving/WINCH ejection with the new large announcement, braking, audio and pause, without runtime errors or external requests. The public screenshot was inspected; no production test profile or result was written.

## Release 0.5.0 — 2026-09-05

Both existing canisters built and upgraded on the supplied engine/subnet with the linked identity. The additive persistent profile map preserves the previous account record layout. No reinstall, new canister, engine or proxy; no cycles were attached. The records console label is now **Profiles and records**, in the same application group.

- Frontend: Running, `service:version` 0.5.0, memory 112,746,206 bytes, WASM `74caff3dcd4fd71a42f650b72317f843d3bfe873fd9d0e860dd45ef10b0281df`.
- Records: Running, `service:version` 0.5.0, memory 5,717,662 bytes, WASM `f2d714233b4f6a755ba2076792a6f7bd8c16a529d15e15be31b2f1b8b6dd65f3`.
- Ten assets synced; certified-assets state hash `566e0ae274e5fbdd321614bfbab40dbe46b4d73087ae861644b81b689066f405`.
- Existing IDs/controllers, sibling mapping, primary/II origin and icon path retained. Both canisters still report zero cycles and zero idle cycle burn.
- Strict checks passed 91 headless/account tests. Fifteen actual-Wasm backend checks passed, including a real 0.4.4 → 0.5.0 upgrade preserving results/active tickets, profile persistence, sharing/caller isolation and leaderboard ties/cap/backfill. Six browser scenarios passed, followed by a targeted three-viewport variant/pending-opt-out verification. The UI used real disposable canister storage with only the human II gesture replaced by a test identity. Test identity code is absent from release assets.
- Public custom-domain HTTPS smoke passed: exact build assets, MIME/CSP/cache/404, II metadata/alias, 0.5.0 records API, anonymous private-profile/records rejection, all three public board queries, guest garage/leaderboard and actual loading/driving/cargo loss/braking/audio/pause with no errors or external requests. Published touch smoke passed at 390×844 and 844×390 for practice, enter, drive, brake, pause, mute and resume without errors; screenshots inspected. These are Chrome touch-emulation checks. No synthetic production profiles or records have been created by verification.

## Release 0.4.4 — 2026-09-05

`npm run icp:build` and `npm run deploy:cloud` succeeded for both mapped canisters. The records canister was upgraded, never reinstalled; its supported track/version pairs now include the easy old road at version 4 while retaining versions 1–3 and active legacy tickets. Relay ridge and Finality quarry still use version 3. Eight actual-Wasm PocketIC checks passed, including an upgrade from the prior 0.4.2 WASM that retained an old result and ticket before saving a separate easy-course result. No synthetic production records were written.

- Frontend: Running, `service:version` 0.4.4, memory 112,680,478 bytes, WASM `13b9e498bb5abec891de973ab418df386784bf0e2218c8c277eb0808757473fc`.
- Records: Running, `service:version` 0.4.4, memory 5,640,251 bytes, WASM `9e6a42496e93042d0bac6f67edfdd06a54ecf1fc7fa3fb90e431dd7393d7c4e3`.
- Ten assets synced; certified-assets state hash `a0e5422e4ce1ee0d76dc5561b95d8eea18cc29cd0b11d166eda9ac4f898b26a6`.
- Existing IDs, controller, sibling environment mapping, console labels, icon path and shared II derivation origin remain fixed. Both canisters retain zero cycles/idle burn. No engine, canister, proxy or top-up was added.
- Local strict checks passed 87 headless/account tests; both selected browser scenarios passed: complete easy delivery with all cargo and optional winch stop/start/in-cab recovery. Custom-domain production smoke passed: exact built HTML/assets/II metadata, MIME/CSP/cache/404, records version/anonymous rejection, and actual guest loading/driving/loss/braking/audio/pause with no runtime errors or external guest requests. Published phone checks passed at 390×844 and 844×390 for practice, enter, drive, brake, pause, mute and resume; screenshots were inspected. These are Chrome touch-emulation checks.

## Release 0.4.3 — 2026-09-05

The existing frontend was upgraded using `npm run deploy:cloud -- frontend`. Browser re-authentication renewed the expired deployment session. An initial command with `--no-create` was rejected by CLI argument parsing because it conflicts with `--subnet`; it made no canister changes. The valid subnet-targeted deployment found the existing canister and synced 10 assets with state hash `6a1ecd48177c4621c1eaa90cc65b5e19900c1dac76aa610cbbcb619999761ef4`.

- Frontend: Running, `service:version` 0.4.3, memory 112,745,822 bytes, WASM `6f1032ab55d170fd505fd8557e6f53a6ceaa4eaa104a373366036acc4c08865d`.
- Records: Running, unchanged memory 5,640,015 bytes and WASM `c42365b30f2da023e1b592f8054923d07463bc69f030b982768d58b6879fa34e` (0.4.2). It was not built or upgraded for this visual release.
- Both retain their IDs/controllers and zero cycles/idle burn. Frontend readback retains the records ID and the new `/favicon.svg?v=0.4.3` console icon path. Primary and II derivation origins are unchanged.
- Public production smoke passed on the custom domain: exact build hashes, icon/II JSON headers, CSP/cache/404, records ID/version/anonymous rejection, and guest cargo loading/driving/loss/braking/audio/pause without runtime errors or external guest requests. Published touch smoke passed at 390×844 and 844×390, including the relocated practice entry, driving/braking and pause/mute/resume with no errors. Local four-viewport review and five navigation/audio browser scenarios passed; see Status.

## Verified release 0.4.2 — 2026-09-05

Both existing canisters were upgraded successfully on the first deployment attempt; no reinstall or new canister. The frontend synced 10 assets and reports state hash `ca87287ea796a912612d926ea0cc540bffe9aa41620fc934966949306813c244`. Both services report `0.4.2` and Running, with zero cycles/idle burn as expected for this engine.

- Frontend: memory 112,680,094 bytes; WASM `5a187f1300abf919624295952d1289767ffb83cca6aa1178f00fdca37969bd2e`.
- Records: memory 5,640,015 bytes; WASM `c42365b30f2da023e1b592f8054923d07463bc69f030b982768d58b6879fa34e`.
- Primary and custom HTTPS origins serve all nine release files byte-for-byte; the tenth synced asset is the default 404. II metadata and the new alternative-origin JSON have JSON MIME, wildcard CORS and no redirect. Assets remain immutable/fingerprinted; HTML revalidates.
- Full production smoke passed on the custom domain: records-cookie wiring, backend version/anonymous rejection, three selectors, actual cargo loading, driving, WINCH loss, braking, mute and pause. No runtime errors, third-party guest requests or production debug getter.
- Published touch checks passed at 390×844 and 844×390: practice, get in, drive, brake, pause, mute and resume. These are Chrome emulation checks, not physical phone benchmarks.
- Real II popup opened from the custom origin with the correct game metadata and cancellation restored guest control. No test account or record was created. Using one real II account on both origins is a user-level confirmation, separate from the verified configuration and protocol request.

The custom URL is an existing OpenCloud alias: a read before this change confirmed the same frontend/records IDs. No DNS changes were made. The permanent derivation origin and console base URL remain the original canister address. The exact custom origin is authorized in `public/.well-known/ii-alternative-origins`; its headers are in `public/_headers`.

## Known and unknown

| Item | Status |
| --- | --- |
| Cloud Engine ownership | Confirmed by user |
| Console origin | `https://opencloud.org` (provided by user) |
| Engine subnet | `uw5ql-smzbi-sadfn-urdoy-irsne-27mwo-qbzpb-3oinv-yxour-533bx-fae` (provided by user) |
| Deployment identity and controller access | Web link completed; canister status confirms the linked principal is its controller |
| CLI identity label | `rv-there-opencloud`; linked against the exact console origin, never the CLI's default auth origin |
| Frontend canister ID | `z4wnx-uqaaa-aaabz-aadeq-cai` |
| Personal records canister ID | `zvvgl-cyaaa-aaabz-aadfa-cai` |
| Public URL | `https://z4wnx-uqaaa-aaabz-aadeq-cai.icp.net/` |
| Signaling canister | `zsua7-paaaa-aaabz-aadfq-cai`, deployed at 0.7.0 |
| Custom domain | `https://isitthereyet.nano-tema--0v1.opencloud.org`; serves the existing frontend, shares the original II derivation origin |
| TURN endpoint and credential issuer | Not identified |
| Installed tools | Project-local `@icp-sdk/icp-cli` 1.4.0 and `@icp-sdk/ic-wasm` 0.11.1, pinned in the npm lockfile |

Never infer an engine ID, use unrelated existing canisters, expose credentials, or treat an arbitrary local identity as deployment access.

## Deployment commands

From the project root:

```sh
npm ci
npm test
npm run test:rooms
npm run docs:check
npm run icp:build -- frontend rooms
npm run deploy:cloud -- frontend rooms
```

This is the 0.7.0 frontend/rooms release scope. Run records persistence/upgrade checks only when changing records; select frontend alone for later frontend-only releases. Reuse already-passed gameplay/browser checks according to [Development](./development.md), adding a focused check for the affected behavior. Authenticate only if the existing CLI identity is missing or expired.

`icp:login` is the one-time web identity link; skip it when the label already exists on this computer. Press Enter in the CLI and complete Internet Identity in the browser on this same computer. It uses `--auth https://opencloud.org`, so the principal matches the engine console. Session keys remain in the CLI's normal credential storage, outside the project. Never copy them or a delegation into project files or chat. For an expired session, use `npx icp identity reauth rv-there-opencloud` and repeat the browser step.

`deploy:cloud` without names deploys all configured canisters (`frontend`, `records`, `rooms`) in the `ic` environment, the supplied subnet, and the linked identity. It does not change the machine's default identity. Do not add `--cycles`, a proxy, or a top-up for this engine: its canisters hold zero cycles by design. The app uses no paid cross-subnet service.

For an existing, purely visual frontend change, target only the mapped frontend:

```sh
npm run icp:build -- frontend
npm run deploy:cloud -- frontend
```

Check `.icp/data/mappings/ic.ids.json` still contains the existing frontend ID first. CLI 1.4.0 rejects combining `--no-create` with the script’s `--subnet`; keep the supplied subnet and preserved mapping. This keeps the records WASM and personal data untouched. Confirm both service versions, the frontend's sibling-ID cookie and the exact served build. Release 0.7.0 uses frontend/rooms 0.7.0 with unchanged records 0.6.0; target `frontend rooms` for this release.

The pinned `@dfinity/static-site@v0.3.3` recipe in `icp.yaml` builds the frontend, installs the certified-assets canister, then diffs and uploads only `dist/`. It does not upload source code, skills, documentation, `node_modules/`, or credentials. `__META_PROJECT`, `__META_NAME`, and `__META_MAIN_CANISTER` now identify **IS IT THERE YET? → Game** in the console. `__META_BASE_URL` records the unchanged frontend URL and `/favicon.svg?v=0.4.3` supplies its icon. The version query refreshes the cached icon in the header, browser tab and console after artwork changes.

Connected-network canister IDs are stored in `.icp/data/mappings/ic.ids.json`. Preserve that file and include it in future version control; only `.icp/cache/` is ignored. Losing the mapping can cause a later deployment to create a duplicate canister. This project has no Git repository yet, so each WASM embeds an explicit `service:version`, with no invented Git revision. For frontend-only releases, bump the frontend metadata and `package.json`/lockfile root versions; keep the records metadata and version query at their deployed value. When the backend changes, update its metadata and version query together and perform persistence/upgrade checks.

## Records backend deployment

Release 0.3.0 adds one `records` Motoko canister to the existing engine and keeps the original frontend ID/URL. Both share `__META_PROJECT`; only frontend has `__META_MAIN_CANISTER=true`. The records recipe is pinned to `@dfinity/motoko@v5.0.0`. `npm run deploy:cloud` builds, applies settings and upgrades both; do not select only frontend when adding a canister, because sibling IDs must be propagated to its cookie.

Use `npm run test:backend` before publishing a backend change. The persistent actor must be upgraded, never reinstalled, to preserve user records. PocketIC upgrade verification uses `wasm_memory_persistence=keep`; ICP CLI handles the Motoko metadata in its upgrade path, which was also verified on the local network. `.mops/` is a disposable build cache; `mops.toml`, `mops.lock` and the generated `src/backend/records.did` are project files. Run `npx mops generate candid records` after interface changes.

No new engine, proxy, cycles top-up or external database is needed. Expeditions use a separate rooms canister on the same engine. Production IDs, metadata and hashes are recorded in the release entries.

## HTTP behavior

`public/_headers` is copied to `dist/` and consumed by the upload plugin. It supplies a CSP allowing local scripts, WebAssembly compilation (`wasm-unsafe-eval`), inline style updates used by the UI, and the data/blob sources used by the engines. JavaScript string evaluation and external scripts are not allowed. HTML revalidates on every visit; fingerprinted `/assets/*` files are immutable for one year. The icon caches for one hour. Response certification and compression are supplied by certified-assets.

The game has one root page and no client-side path router, so no catch-all rewrite is configured; unknown assets should return a real 404. Rapier's compatibility build embeds WASM in its JS module, so this release has no separate `.wasm` URL to validate. Verify JavaScript/CSS/SVG MIME types, CSP, cache headers, browser startup, audio and actual winch interaction over HTTPS after deployment.

The Motoko room/signaling service is a separate backend canister on the same engine. The current records frontend reads `PUBLIC_CANISTER_ID:records` and `IC_ROOT_KEY` from the `ic_env` cookie; neither is a secret. When adding canisters, deploy the affected frontend and new service together so the frontend receives the complete ID mapping; verify its settings/cookie after deployment. Records does not depend on rooms and need not be updated. Existing frontend-only updates retain the sibling mapping; verify the records ID cookie after publication. Personal records do not add multiplayer.

## TURN

Plan a managed TURN service or a separately operated relay. Confirm whether the user already has one. The engine's canister endpoint should not be assumed to provide a TURN relay. Use short-lived TURN credentials; any browser-visible `VITE_*` value is public. Test with relay-only ICE policy to establish that fallback actually works.

## Release evidence — 0.4.1

- Published on 2026-09-05 through `npm run deploy:cloud`; both existing canisters were upgraded with their mappings and record schema preserved. Both report Running, version 0.4.1 and the new `__META_PROJECT` **IS IT THERE YET?**. No canisters or engine were created.
- Frontend memory in the readback: 112,679,902 bytes; records: 5,574,272 bytes. Both hold zero cycles and have zero idle cycle burn.
- Frontend WASM hash: `bb6b479258a360ebf29adfb1eb5aef6a2d2d172c67a4cd08fd7dd3912fe25848`.
- Records WASM hash: `e8d766594e261dc92d41d374ffd4fd654c160361ad0036538f84b44c111c2f42`.
- Nine assets synced; certified-assets state hash: `bd4d25d83286c497364a276ed18aa522bc19e8de97046603e8ae2a6fde983d1f`.
- Public smoke passed: title/II metadata, all asset hashes, headers/cache/404, backend version and anonymous records rejection, plus guest loading/driving/ejection/braking/audio/pause without runtime errors.
- The public display name changes; canister IDs, URL, II derivation origin, track IDs and rules version 2 stay fixed. This is a cosmetic release; backend changes only its version method. Caller/upgrade tests passed locally.

## Previous release evidence — 0.4.0

- Published on 2026-09-05 with `npm run deploy:cloud`, upgrading both mapped canisters. No engine, canister, proxy or top-up was added; records were not reinstalled.
- The first sync received IC0508 while frontend briefly stopped after installation. Immediate status read showed both Running; a repeat deploy completed and synced nine assets. Do not infer a frozen engine or top up cycles from this transient lifecycle error.
- Both report **Running**, `service:version` **0.4.0**, zero cycles and zero idle cycle burn. Release snapshot memory: frontend 104,291,102 bytes, records 5,574,080 bytes.
- Frontend WASM hash: `e717518aee38839f33d15394d69cd5334de6760ad5552290f33ea9adb0f9a828`.
- Records WASM hash: `6e5562648644c94d860bda112de97c67c0203190f5595b9ac4d85c910e88ce68`.
- Certified-assets state hash: `0a10c704ba9a60d106fb9a5a0be3b1f2de9d1e7d6e5b9507af453aaa9a0fbe9e`.
- Public production and phone smoke scripts passed, with exact deployed asset hashes and no guest runtime errors. The II popup/cancellation check passed in isolation. The user confirmed live authentication works after deployment. A real-account gameplay save/reload remains unverified; SDK fixture and backend retention tests are separately recorded in status.
- Both sibling-ID settings, application labels and frontend URL remain unchanged. Rules version 2 accepts new course results while historical version 1 data is preserved.

## Previous release evidence — 0.3.0

- Published on 2026-09-05 through `npm run deploy:cloud` to the existing engine/subnet, using the linked identity. The original frontend was upgraded; `records` was created with ID `zvvgl-cyaaa-aaabz-aadfa-cai`. Preserve both entries in `.icp/data/mappings/ic.ids.json`.
- Both canisters report **Running**, `service:version` **0.3.0**, zero cycles and zero idle cycle burn. Frontend uses 107,960,734 bytes of memory; records uses 5,573,647 bytes in the release snapshot.
- Frontend WASM hash: `80d592ff57e69902f45400462f98c945909bc07b2ddee3ade3a5fd9153a60251`.
- Records WASM hash: `6edc605b68f1b0db8a598bbb6a2a802739c71ab6f5056b28c7b19983e2d2e3fb`.
- Nine assets synced. Certified-assets state hash: `cf7c764ef4ae2bd75817842ad81d2d1306f6cdf9fe2dcc732b448e500b59d1c4`.
- Both settings include the two `PUBLIC_CANISTER_ID` values and the identical application title. Only frontend is the main canister, with the preserved public URL/icon. At that release Records was labelled **Personal records**; version 0.5.0 changes its label to **Profiles and records**. Settings were read back through the CLI; the locked Mac prevented rechecking visual console grouping.
- Public smoke passed against the matching release build: HTML/assets/icon/II metadata hashes, MIME/CSP/cache/404 behavior, records-cookie wiring, backend version and anonymous private-read rejection. Guest gameplay loaded all three modules, drove, ejected WINCH, braked, muted audio and paused with no runtime errors or external guest requests.
- Real Internet Identity popup showed **IS ICP BUS THERE YET** and the published description. The popup stayed open before cancellation and returned guest control with a visible message after closing. User-account login/save/reload remains a manual check; it was not inferred from popup cancellation or mocked tests.
- Save/isolation/idempotency/upgrade checks passed on disposable local PocketIC. Automatic approval review rejected writing a permanent synthetic production record, so that check was not executed and its script was removed. No test records were written to production.

## Previous release evidence — 0.2.0

- Updated the same canister `z4wnx-uqaaa-aaabz-aadeq-cai` on **nano-tema**, engine ID `engine-f70b19ae-a28e-445a-8ac5-5eaa27e23d71`, on the supplied subnet. Deployment reported that all canisters already exist and synced seven assets.
- Canister status: **Running**, 107,370,718 bytes of memory (approximately 102.4 MiB), zero cycles and zero idle cycle burn as expected. The separately sampled console storage display was 101 MiB, under 1% of the engine.
- WASM module hash: `44c480f56ad33686640ea1a79645412ccb2b9c90dae28c22ddb1a3e68822bd86`; live `service:version` read back as `0.2.0`.
- Certified-assets state hash: `4962c8f0475235eadb63cb1aeec16ad9622355ba484a4f208142f730c9daf6e2`.
- `npm run check` passed strict TypeScript, all 39 physics/state/geometry tests and documentation checks. All seven browser scenarios passed, including the full delivery route. Production and canister builds passed.
- Public production smoke passed: HTML and all built JS/CSS/icon byte hashes match `dist/`, MIME types and WASM CSP are correct, unknown assets return 404, and recorded cache headers match the immutable-assets/one-hour-icon policy.
- Isolated Chrome used the public UI to load all three modules, enter and drive, physically lose WINCH on a bump, brake, toggle both audio controls and pause. No page/console errors, external HTTP requests or development getter were present.
- OpenCloud displays **IS ICP BUS THERE YET → Game**, **RUNNING**, one canister and an **Open** link to the original public URL. Multiplayer remains planned.

To repeat the production smoke check, keep the matching release build in `dist/` and have Google Chrome installed, then run from the project root:

```sh
node scripts/smoke-production.mjs https://z4wnx-uqaaa-aaabz-aadeq-cai.icp.net/
```

The script compares served bytes with the local build before exercising the UI. It fails intentionally if local files differ from the deployed release. With no URL argument it checks the running production preview at `http://127.0.0.1:4173/`; Vite preview does not apply deployed CSP headers. Screenshots go to `test-results/`.

## Previous release evidence — 0.1.0

- Canister: `z4wnx-uqaaa-aaabz-aadeq-cai`, confirmed **Running**, approximately 98 MiB memory in the CLI status snapshot, zero cycles/zero idle cycle burn as expected on an engine.
- WASM module hash: `1c78bfeac9064612d67ba14f8f2e933eebec38faed218fa81c70dacfbe0f91b5`; live `service:version` read back as `0.1.0`.
- Certified-assets state hash after upload: `2110d9dc96be0ae06712c1af1f3604d0de58283532f27d0b18c434c618705440`; seven assets synced.
- Public HTTPS: HTML 200 with revalidation and the configured CSP; entry JS, CSS and SVG byte hashes match `dist/`, correct MIME types, Brotli compression, expected cache headers; an unknown asset returns 404.
- Isolated Chrome loaded the public URL, picked up/carried/attached the cable, pulled the RV onto the road, detached, and exercised both audio toggles without page/console errors. The production debug getter is absent.
- OpenCloud UI confirms **RV There Yet**, **Game**, **RUNNING**, one canister and an **Open** link to the correct HTTPS address. Icon metadata and its served SVG were verified; console icon rendering is not an acceptance gate.
- `npm run check` passed all 17 physics/geometry tests, TypeScript and documentation checks. Earlier six browser scenarios remain recorded in the status log. Multiplayer, TURN and cross-network co-op are not implemented or verified.

For later releases, record the version/hash, environment, canister IDs, public checks and remaining restrictions in the status log. Do not record private credentials.

Deployment follows the installed DFINITY skills: [Cloud Engine deployment](../.agents/skills/deploy-to-cloud-engine/SKILL.md), [engine canister rules](../.agents/skills/cloud-engine-canisters/SKILL.md), [ICP CLI](../.agents/skills/icp-cli/SKILL.md), and [static sites](../.agents/skills/static-site/SKILL.md). Future agents can use the same project-local skill copies and pinned tools.

## Expedition deployment scope — 2026-09-06

Release 0.7.0 installed `rooms` and upgraded/synced `frontend` with `npm run deploy:cloud -- frontend rooms`. Existing frontend/records mappings were preserved. The frontend environment includes `PUBLIC_CANISTER_ID:rooms=zsua7-paaaa-aaabz-aadfq-cai`; records WASM, settings and memory matched its pre-deploy readback. The general deployment script includes all three configured canisters, so target only the affected services. Never reinstall records. Full network setup and the remaining TURN/separate-network gate are in [Two-player expedition networking](./networking.md).
