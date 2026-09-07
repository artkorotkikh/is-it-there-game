---
title: Expedition maps and field kit
tags: [maps, gameplay, authoring]
---

# Expedition maps and field kit

The 2026-09-06 implementation begins the authorized cooperative expedition: one shared bus, reusable planks/stones, pushing, winching, and several ways through a clearing. The first map is Forest crossing. Solo routes and their historical record identities remain separate. Check [Status](./status.md) for actual verification and network readiness.

## Authoring files

Bundled maps live in `src/game/maps/data/*.json`; the catalog discovers these files at build time. `schema.ts` validates data before physics or rendering allocate resources. `npm run maps:check` validates every file and rejects duplicate IDs. To create a flat starter map:

```sh
npm run maps:new -- my-clearing
npm run maps:check
npm run dev
```

Open Expeditions and select the new map. The selector is hidden while only one bundled map exists; adding a second map makes it appear automatically. Edit its JSON, then reload the game. The template command refuses to overwrite a file. No database or canister change is required to add a bundled map. A player-facing editor, uploads, moderation, online map storage, and custom-map leaderboards are future work.

## Format version 1

`schemaVersion` is the file format version; `id` is a stable lowercase identifier; `version` identifies gameplay content. Increment content version when terrain, goal, resources, or obstacles change. The three existing solo IDs are reserved. Name and description are bounded plain text; executable code, URLs, external assets and unknown fields are rejected.

- `terrain`: originX/originZ in metres, cellSize in metres (0.5–4), columns/rows, and row-major heights in metres. X increases within a row, Z between rows. Up to 20,000 samples, 129 columns and 257 rows; finite heights −8 to 80 m.
- `spawn`: vehicle plus exactly two player positions, each `{x,z,yaw}`. Y comes from the ground. Yaw is radians; 0 faces +Z.
- `finish`: `{x,z,yaw,radius}`, metres/radians. The bus must reach the circle upright above terrain with all modules installed and a driver aboard. No prescribed route or item usage is required.
- `anchors`: stable IDs and positions of colliding marked trees. Cable attaches 1.1 m above terrain. At most 48, at least one.
- `obstacles`: up to 96 static colliding boxes with stable ID, position/yaw, width/height/depth in metres. Their visual dimensions match collision.
- `resources`: up to 32 reusable `plank` or `stone` instances, with stable ID and position/yaw. Dimensions and interaction tuning are shared in `config.fieldKit`, not arbitrary per-map physics.

The terrain mesh has two triangles per cell, a-c-b and b-c-d. Ground queries use that same diagonal, not bilinear interpolation. Walking, vehicle collision, placement and cable routing therefore agree. Cable routing includes all X, Z and diagonal edge crossings; it still does not wrap around props, boulders or tree trunks.

## Field kit rules

One carried object per player across cargo, cable and field kit. E picks up or places, Q/R rotates the placement, G also attempts placement, B holds a bounded push, T marks a nearby point for five simulation seconds. Walking while carrying is slower. Phone context controls expose the same actions.

Expeditions show a corner outline and name on the current interaction target. **E** acts on that target; **X** (or **Next target** on touch) cycles nearby candidates without moving. Available loose canisters take default priority over free planks/stones, recovery, sockets and seats; blocked candidates sort last and explain their restriction when selected. Manual selection remains until the target leaves reach, changes ownership or the action completes. A loaded support therefore cannot steal E from reachable cargo. The selected cargo is outlined itself, rather than incorrectly highlighting its empty socket. One shared candidate list controls hints, rendering and actual actions.

Resources are stable at rest. Their phases are available → carried → placed → carried. Carried collision is disabled. Placement uses a preview and validates supports, slope, the entire footprint, map bounds, other bodies and the bus's wheel footprint. Planks need end supports on ground or stones; stones need stable ground. Stones do not stack. Picking up a stone supporting a placed plank or a prop beneath the bus is rejected. The same convex mesh is used for rendering and Rapier collision. There is no free throwing, breakage or sliding under load in this first iteration.

Planks measure 6.8 × 1.15 × 0.18 m (length × width × thickness). End supports are sampled 0.16 m inward, giving a 6.48 m support span across the central gap's 5 m bank separation. This replaces the old 5.4 m plank, whose 5.08 m support span demanded nearly exact positioning. Stand back from the edge and move until the preview turns green; Q / R rotates it. Both ends still need support, and steep, obstructed or buried placements remain invalid. Two planks form the bus's wheel tracks.

Forest crossing retains the content-version-2 change moving the two starting planks from Z=8 to Z=9 m, keeping their longer ends outside pickup range at the passenger door.

Pushing adds at most 1,900 N near a slow bus and respects its explicit parking brake. Automatic solo parking releases while actively pushing; neutral input ends the force. Existing rollover kick and terrain-supported winch remain available. The field kit does not modify account capabilities or call ICP.

## Forest crossing

Content version 3 extends the authored heightfield to **64 × 192 m**, sampled at one-metre intervals (65 × 193 vertices; Z=-8…184). The goal moves from Z=82 to Z=170 m. Terrain through Z=72, including the working five-metre bridge gap, is preserved. The extension keeps three broad approaches with traversable connections between them; there is no prescribed route or item-usage gate. Five planks and twelve movable stones are available. Six additional fixed boulders flank the new stone clusters, leaving clearance choices around the intended crossings.

| Approach | Original section | Extended obstacles and terrain |
| --- | --- | --- |
| Left | Starting stones, low ground and the steep winch hillside | Two stones at Z=82, a hollow at Z=96–100 (Y=3.5), then a climb to Y=11 at Z=128 |
| Centre | The washed-out causeway, bridged with two planks under the wheel tracks | Two stones at Z=94, a hollow at Z=110–114 (Y=3.5), then a climb to Y=13 at Z=150 |
| Right | Three movable stones among boulders and smaller ridges | Two more stones at Z=106, a hollow at Z=122–126 (Y=4.5), then a climb to Y=13 at Z=160 |

The three approaches meet on the Y=13 production plateau. The in-world signs frame the delivery as **Local build → Production**; the finish says the app is live. These labels do not trigger real deployment. Ground remains authored JSON; no random or runtime procedural generation is enabled.

Thirty marked winch trees cover the approaches. New trees sit at the entries, uphill exits and crests of the hollows, on both sides of each approach. The original left hillside's upper tree moves from Z=49 to Z=55: the shorter distance previously exhausted the winch's minimum length before the bus cleared the crest. Two trees at X=±5, Z=38 retrieve a bus that drove off the central gap's near edge back onto its departure bank. Pulling straight into the opposite cliff does not clear that vertical wall; a lateral pull can tip the bus and eject its winch module. The safe near-bank retrieval is physically tested from both trees. An overturned bus still needs the existing righting action, and a lost winch module must be reinstalled.

Anchor selection must account for the terrain-supported cable path, its 32 m limit, the direction of pull and space for the whole bus before the tree; proximity alone does not prove recovery. Headless tests demonstrate three full deliveries after clearing their relevant stones, actual cable-carrying walks to the recovery trees, and winch recovery from all three new hollows, the original left hill and both near-bank gap trees. These tests use fixture positioning for setup/picking up distant supplies; they do not measure human completion time or guarantee arbitrary falls. See [Status](./status.md) for verification and local-playtest limits.

## Expedition presentation

The menu uses an abstract Forest Crossing card, not a projection of terrain/resources. `src/ui/expedition-card.ts` holds presentation metadata keyed by map ID: display title, short description, artwork, authored duration estimate, difficulty and number of intended approaches. The current card reads **Forest Crossing · 5–10 min · Moderate · 3 paths**. The duration is a design estimate requested for the menu, not a measured completion-time claim.

The bundled `public/illustrations/forest-crossing.svg` suggests three paths through a forest without disclosing obstacle, supply or anchor locations. The compact card uses a small illustration beside its description. On narrow screens it sits before launch actions; the artwork remains decorative. Art and labels do not alter the JSON map, physics or network map hash. When adding a map, optionally add its card entry; otherwise it shows its own name without fabricated difficulty, duration or artwork.
