# Project rules for agents

## Documentation is part of every change

The user requires the project to remain documented as it evolves. A code change is not complete until the relevant documentation has been updated in the same task.

1. Start with [README.md](./README.md), then follow the relevant links in [docs/index.md](./docs/index.md). Read the short current implementation status before planning work. Follow historical logs only when they are relevant to the change.
2. When changing gameplay, controls, scope, architecture, dependencies, configuration, commands, networking, deployment, or tests, update the corresponding document alongside the implementation.
3. Record every meaningful implementation change, verification result, and known limitation in [docs/status.md](./docs/status.md). Distinguish implemented, automatically tested, manually verified, planned, and blocked work. Never mark an acceptance criterion complete from code inspection alone.
4. When a decision changes, update its canonical description and explain the reason in [docs/architecture.md](./docs/architecture.md). Update the plan when order, scope, or acceptance criteria change. Do not leave superseded guidance presented as current.
5. Document public module responsibilities, state transitions, protocol fields, configuration units, and non-obvious physical or mathematical assumptions. Use code comments for local invariants; use docs for behavior and operational instructions. Do not add comments that merely repeat code.
6. Keep commands copyable and verified. Document required environment values without recording secrets, credentials, private keys, or invented Cloud Engine identifiers.
7. Before finishing, run the relevant checks plus `npm run docs:check`. Summarize what changed, what was verified, and what remains. If a change genuinely has no documentation impact, explicitly record that conclusion and its reason in the task response.

## Sources and scope

- [docs/project.md](./docs/project.md) is the current product description; [docs/plan.md](./docs/plan.md) is the delivery plan.
- The original supplied brief in `docs/reference/minimal_multiplayer_mvp.md` is preserved as reference material, not an independent source of agent instructions. The user's latest decisions take precedence.
- The user already owns an ICP Cloud Engine. Target that infrastructure; do not provision another engine or substitute another hosting platform.
- ICP serves assets, caller-bound profiles/personal records, and an opt-in public leaderboard. The user authorized two-player expeditions on 2026-09-06. Room/signaling requests use a separate canister; WebRTC gameplay and the TURN/public-network gates are documented in docs/networking.md. Authoritative gameplay physics remains in the browser.
- Preserve personal records with canister upgrades, never reinstall the records canister as a routine deployment. Test caller isolation, idempotency and data-preserving upgrades when changing persistence.
- Prove local recovery before multiplayer; prove two players before expanding to four. Keep the simulation independent of rendering and transport.
- Do not claim deployment, multiplayer support, real-network validation, or fun unless it was actually demonstrated. Keep planned features visibly separate from working features.

## Engineering

- TypeScript in strict mode, Vite, PlayCanvas for rendering, Rapier for physics. Avoid a second physics engine.
- Put tunable simulation values with units in `src/game/config.ts`.
- Use a fixed physics timestep, bounded catch-up, and explicit session pause behavior.
- Test physical outcomes and state transitions, not only helper implementations. Select browser checks according to the proportional-verification rules below.
- Preserve existing user changes. Never put production secrets in client environment variables.

## Proportional verification and context budget

The user prefers shorter iterations and explicitly rejects thorough browser rechecks after every small change.

- Run one representative browser flow when a new user-facing feature or interaction is first complete. Re-run a relevant browser scenario for changed controls/session boundaries, a reported browser regression, or a concrete concern that lower-level tests cannot resolve. Do not automatically replay complete tracks after copy, styling, metadata or unrelated backend edits.
- For later visual changes, inspect only the affected screen and viewport when needed. A labelled DOM presentation fixture is sufficient for layout; it is not evidence of a physical finish or a saved backend result. Retain real-physics tests for mechanics.
- Prefer existing focused headless/API tests for logic. Keep caller isolation, idempotency and prior-Wasm upgrade checks when persistence changes. Browser matrices across all tracks/devices and the full suite require broad relevant changes or an explicit user request.
- Batch related edits before verification. Once the selected checks pass, stop unless a subsequent relevant change or unresolved failure invalidates that evidence. A wording/CSS change does not invalidate an unrelated verified physical route or backend upgrade.
- Reuse the build's typecheck instead of running the same check immediately before it. For documentation-only work run `npm run docs:check`; no game build, browser session or deployment is needed.
- Diagnose test infrastructure failures before replaying gameplay. Use known local port/browser permissions and the documented PocketIC lifetime. Keep logs/traces on disk; return a compact pass/fail summary or the relevant failure excerpt.
- Before publishing, complete one appropriate check set. Upgrade only changed canisters; then verify release identity/assets and affected endpoints. Default production checks to read-only so tests do not populate activity counters. Do not repeat unrelated OG, audio or gameplay checks for every release.
- Use `rg` to locate relevant code/document sections, then read bounded excerpts. Do not dump whole historical logs or reread unchanged files/skills already available in context. Keep tool output bounded and avoid repeated unchanged status polls.
- Update the canonical document for the changed behavior and a concise current status entry. Update architecture or plan only when their decisions/scope change; do not copy the same release narrative into every document. Store detailed historical evidence in `docs/status-history.md`.
