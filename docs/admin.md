---
title: Game statistics panel
tags: [admin, analytics, identity, operations]
---

# Game statistics panel

The owner requested a separate statistics panel on the existing Cloud Engine. The `admin` certified-assets canister serves a standalone English-language dashboard; the browser reads existing `records` solo aggregates and `rooms` co-op aggregates directly. No proxy, second analytics database or new engine is required. Published panel: [Statistics](https://zhtrs-oiaaa-aaabz-aadga-cai.icp.net/). Check [Status](./status.md) for verification and owner-access state.

The owner confirmed real authenticated production viewing on 2026-09-06. The existing dashboard account also has a controller-verified rooms reader grant following explicit authorization; its authenticated co-op panel view after that grant has not yet been observed. English is the default interface language regardless of browser locale; dates and display counts use `en-US`, ratios use a decimal point, and CSV retains exact integers and UTC timestamps.

## Available data

The overview shows existing lifetime opens, full solo starts, confirmed finishes and first result saves, plus collection start and browser fetch time. Each track/rules-version row stays separate; current rules are labelled independently of historical rows. Finish/start and save/finish ratios use event totals, not unique-player cohorts. A zero denominator displays an em dash. CSV contains raw exact integer counts, UTC collection/fetch timestamps, an ALL totals row and individual course rows; opens appear only on the totals row. CSV is generated locally from the last fetched snapshot, with spreadsheet formula escaping.

There are no invented daily charts, unique-user counts, acquisition sources or co-op results. Four aggregate co-op cards and a dedicated co-op CSV are implemented; their separate collection date excludes earlier sessions. [Collection rules](./multiplayer-accounts.md) distinguish server-created/joined rooms from two-client-confirmed connections and starts. Unique people, per-session histories and co-op finishes remain unavailable. Profiles, private records, pending-run capabilities, invites and SDP are not returned by the panel API. Opening, signing in, refreshing and exporting never call `gameOpened`, create a profile or write a gameplay event.

## Co-op service and permissions

The rooms service exposes its own `adminStatistics`, `setStatisticsReader` and `listStatisticsReaders` with the same eight-reader, controller-issued policy. Rollout mirrors the current active panel readers into rooms; records remains unchanged. Future access grants and revocations must target **both records and rooms**. Rooms uses `.mops/.build/rooms.did` for CLI calls. Partial co-op failure/denial hides those cards and CSV while keeping successfully loaded solo data. Neither fetching nor exporting writes counters.

## Access and identity

`adminStatistics()` returns the existing `Statistics` shape to a current records controller or explicitly granted reader. `statistics()` remains controller-only for CLI compatibility. `setStatisticsReader(principal, enabled)` and `listStatisticsReaders()` are controller-only. At most eight grants are retained. Anonymous grants are rejected; adding or removing the same reader is idempotent. Each persistent grant records its issuing controller; it authorizes reads only while that issuer is still a controller. Controller changes are checked on every read; active grants must be reissued by a current controller after rotation. Re-adding an old issuing controller makes their retained grants active again unless removed. Grant edits also remove inactive grants.

The panel has its own origin-bound Internet Identity account and storage. It intentionally does not reuse the game's derivation origin, create a game profile or change the game's alternative-origin file. The owner signs in on the panel, copies the displayed principal and has the existing controller grant it access. There is no first-visitor admin claim. Custom admin aliases require a separate reviewed identity-origin configuration; initially use the canister URL.

The static page shell is public; statistical data is guarded in Motoko, not by a hidden URL or frontend flag. HTML has no embedded statistics or credentials. The panel uses no analytics cookies; SDK session storage is only for authentication. CSP, noindex and no-store headers are configured in `admin/public/_headers`.

Sign-in/restore leads to a fresh authorized query. Denial, query failure, refresh, logout and observed session expiry clear the previous numbers and CSV from the UI. Pending replies cannot restore data after logout. Requests time out after 15 seconds; refresh is manual. Session validity is checked every second and when returning to the tab, without polling ICP. Revocation applies to the next backend read; already downloaded data cannot be retracted, and an open panel is a timestamped snapshot, not a live authorization subscription.

## Development and verification

```sh
npm run admin:build
npm exec -- icp build records admin -e ic
npx vitest run tests/admin-statistics.test.ts
RECORDS_UPGRADE_FROM=/tmp/rv-admin-before/records-0.6.0.wasm npm run test:backend
npx playwright test browser-tests/admin.spec.ts
npm run docs:check
```

The upgrade fixture path is a local retained copy, not a repository dependency. Before changing records, retain the previously built release Wasm outside `.mops/.build` and point `RECORDS_UPGRADE_FROM` at it. The admin-specific prior-Wasm case expects the 0.6.0 delivery API. Existing record/profile/delivery tests retain caller isolation, retry and upgrade coverage. The browser case uses real signed disposable PocketIC calls and substitutes only the human II gesture. Its seeded counters are backend fixtures, not physical-gameplay evidence. It verifies denial/grant, empty/data states, CSV, retry, restore, revocation, expiry, logout races and narrow layout; it also checks that browser requests never call update endpoints.

`npm run dev` serves `/admin/` for local work. Without a local `ic_env` cookie the panel explicitly shows an unavailable state. The browser test supplies its isolated backend. `npm run admin:build` typechecks the project and builds only admin assets into `dist-admin`; the game build stays in `dist`.

## Publish and grant access

For the original solo panel, use the already linked owner identity and mapped existing records canister. The co-op analytics release upgrades only `rooms frontend admin`; records is not targeted. Never reinstall either persistent service. The admin uses the pinned static-site recipe and receives `PUBLIC_CANISTER_ID:records` through its certified-assets environment cookie.

```sh
npm exec -- icp deploy records admin -e ic --subnet uw5ql-smzbi-sadfn-urdoy-irsne-27mwo-qbzpb-3oinv-yxour-533bx-fae --identity rv-there-opencloud
npm exec -- icp canister call records listStatisticsReaders '()' --candid src/backend/records.did --query -e ic --identity rv-there-opencloud
```

After opening the deployed admin URL and signing in, substitute its displayed principal for `PANEL_PRINCIPAL` in this template:

```sh
npm exec -- icp canister call records setStatisticsReader '(principal "PANEL_PRINCIPAL", true)' --candid src/backend/records.did -e ic --identity rv-there-opencloud
```

Use `false` to revoke that principal. This grants read-only analytics access, not control over canisters. A controller still reads existing totals with `npm run stats:cloud`. Read-only production checks must verify exact admin assets, headers, records wiring/version, anonymous denial and unchanged controller totals across the upgrade. No production events/accounts are seeded for verification.

### Co-op rollout and reader grant

Upgrade rooms first, mirror each currently authorized panel reader, then publish frontend and admin. Do not redeploy records for this release. Substitute the existing panel principal below; grant/revoke both services when managing full dashboard access.

```sh
npm run deploy:cloud -- rooms
npm exec -- icp canister call rooms setStatisticsReader '(principal "PANEL_PRINCIPAL", true)' --candid .mops/.build/rooms.did -e ic --identity rv-there-opencloud
npm run deploy:cloud -- frontend admin
npm exec -- icp canister call rooms listStatisticsReaders '()' --candid .mops/.build/rooms.did --query -e ic --identity rv-there-opencloud
npm exec -- icp canister call rooms adminStatistics '()' --candid .mops/.build/rooms.did --query -e ic --identity rv-there-opencloud
```

Reload both game tabs and create a new invitation after rollout; old rooms have no analytics session ID. Refresh the statistics panel. Earlier co-op activity cannot be backfilled.
