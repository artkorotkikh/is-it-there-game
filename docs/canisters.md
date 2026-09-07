---
title: Canisters cargo and Probably Works
tags: [gameplay, cargo, art, acceptance]
---

# Canisters cargo and Probably Works

The user authorized this solo iteration before multiplayer, later renaming the game **IS IT THERE YET?**. The bus now represents the fictional app **Probably Works**. The supplied [three-canister proposal](./reference/three_canisters_proposal.md) is preserved as reference; the amendments below describe the implemented design. Verification and deployment state belong to [Status](./status.md).

## Premise and art direction

The battered **Probably Works** bus represents an application being shipped through the valley. Its cream/olive body retains the warm forest palette; painted browser windows replace the colored side stripes and rear passenger glazing. “Works on my subnet.”, an eternal 99% shipping bar, service hardware and three colored modules establish the theme. The title-screen card says **CANISTERS CARGO**. Rear sockets have numbers, symbols, rails, matching labels and status lamps. The rear hatch stays open in every state, including driving; it reveals a real opening in the chassis.

Each module has a heavy box, handle, rubber corners, connector and scuffed faceplate. WINCH #01 is ochre with a spool, CYCLES #02 is cyan with a power symbol/vents, and SKILLS #03 is purple with a driving licence tag. Symbols/numbers support color recognition. Fonts/signs are drawn locally; no external images or audio are downloaded.

Title: **IS IT THERE YET?**. Finish response: **YES. WE GOT IT THERE.** This is fiction; game modules do not create, stop or fund real ICP canisters, and game CYCLES never represent a real balance.

## Startup and capabilities

Every normal track starts with three loose modules behind the bus and three empty slots. Only simultaneous installation of all three completes the initial startup check. Any order works; removing a module before completion reduces the count. Try the winch starts already loaded in the selected track's ditch and does not save records.

| Module | Installed | Missing after startup |
| --- | --- | --- |
| WINCH | Q/R controls the drum | Drum stops; attached cable keeps its passive length/tension and can be detached |
| CYCLES | Engine can produce force | No engine force/audio; inertia, gravity, steering and brakes remain |
| SKILLS | W forward, S reverse, A left, D right | W reverse, S forward, A right, D left; camera, walking and brakes stay normal |

`startupCompleted` latches until restart. Engine capability is startup AND CYCLES installed. Other capabilities derive from module phases. Restoring engine power or changing SKILLS in either direction disarms throttle and steering until both driving axes are neutral; no held command becomes unexpected opposite thrust. Existing braking-to-reverse behavior still applies, without velocity reversal or teleportation.

## Crowded pickup

Reach and world obstruction checks remain active. Other loose canisters and teammates do not occlude a canister handle; the bus, terrain and field-kit supports still do. Expeditions add an explicit selected target with a name/outline and X / Next target cycling; see [field-kit interactions](./maps.md). Solo retains automatic nearest visible cargo selection.

## Interaction

E picks up a close visible item, installs it in its matching selected rear socket, or enters/exits the bus in the existing context. Hold E for 0.85 seconds at an occupied socket to remove it; releasing E, changing target, moving the bus, leaving reach or pausing cancels the hold. Wrong sockets explain the expected type. G sets cargo down if the placement is clear. F remains the cable action.

One carrier holds one module or cable. Carrying a module slows walking to 2.8 m/s, changes the arm pose and blocks driving/cable pickup. Module access takes priority over entering the bus; rear slots require approaching the opening, and pickup uses a line-of-sight ray. Docking/removal needs bus speed at most 0.35 m/s. There is no manual connector alignment or simulated hand collision.

P toggles an explicit parking brake, useful while collecting cargo. The existing automatic on-foot brake still releases when a cable is attached so solo winching works. Release explicit P before pulling or driving; the HUD identifies a parked bus.

## Road events

Each track profile contains bumps at the starting straight and a wide flat stretch after recovery, then a final road. The easier old road has broad 0.22/0.18 m bumps, a shallow rounded dip and its gate at Z=115 m; finish is crossed at Z=112 m. Its climb is driveable and the winch is optional. Collision, visible road and cable sampling use the same selected profile. The other courses are described in [Three tracks and personal records](./solo-records.md).

Every physical bump or landing can shake cargo loose, anywhere on any track and in either driving direction. The old zone/one-time release rules were removed after the user reported that late quarry rollers did nothing. An eligible hit needs at least 2.1 m/s of travel along the bus axis and 8 m/s² upward chassis acceleration in a fixed tick. Braking to a crawl before rough ground protects the cargo; speed alone on flat ground never ejects it.

The next weak latch rotates WINCH → SKILLS → CYCLES, skipping unavailable or newly installed modules. There is no permanent immunity after reinstalling. Release requires a fresh impact burst: at least 0.4 seconds below 2 m/s² to rearm, a 2.5-second global release cooldown and a two-second settling grace for a newly docked item. This bounds clustered front/rear wheel impacts without disabling later bumps. There is no mandatory loss, recovery milestone or first-loss prerequisite; CYCLES can now fall out too, cutting drive power until retrieved.

Docked canisters move and tilt slightly in their sockets under measured chassis acceleration and give a quiet clatter on jolts. Their bounded, damped visual motion is not a separate rigid body and cannot change vehicle mass or input mapping. Only a real loose/docked transition changes capability. The cargo bay stays open.

Released items start at the actual socket with the chassis point velocity (including rotation), plus a modest local backward/upward/side kick. They collide with the open bay, ground and other free items, then settle. The hatch remains open, a sound plays, capability changes immediately and the HUD marks the missing module.

Every ejection raises a large centered message on a fully transparent background, with text shadows for readability over the road. It keeps only the lost module headline, capability consequence and recovery instruction; the previous “CARGO OVERBOARD”, “Also offline” and colored countdown decorations are removed. CYCLES says engine power is lost; WINCH says its motor is offline while the cable still holds; DRIVING SKILL says forward/reverse and left/right are swapped and asks the player to release the controls. The complete announcement lasts three seconds of active simulation time, including a 220 ms fade/zoom from 94% to full size and a 280 ms fade/zoom out to 103.5%. Reduced motion uses a static three-second message.

The newest loss appears immediately, even if a higher-priority system is already offline; repeated ejections after reinstalling trigger it again. Startup loading, deliberate removal and setting cargo down do not trigger it. Reinstallation dismisses it; pause hides/freezes it and restart/title clear it. The message never captures input or pauses driving. Module chips and world markers remain; the smaller warning resumes after the announcement expires.

Hard braking can leave loose cargo under the rear bay. Move the bus forward to expose it before parking and walking back; with SKILLS missing, S is forward. The broad post-recovery bumps and flat collection areas are tuned for braking without pitching the bus onto its roof. Rollovers elsewhere remain possible.

## Optional rollover test

After the recovery climb, each route has one faceted grey stone beside the **ROLL TEST** sign on a straight. It sits near the +X verge (the left side in the default chase camera), at Z=77/81/87 m for old road/ridge/quarry. Aim the wheels on one side at its rising face at roughly 15–30 km/h to tip the bus. The centre and opposite side remain open for an easy bypass; the first route does not require hitting the stone. It is a real colliding mesh, with no automatic flip trigger. Cargo can still fall out from the impact.

## Percussive maintenance

On foot, with empty hands, approach a stationary overturned bus (speed below 1.5 m/s, distance under 4.6 m, local up dot world up below 0.45). Hold E, or the phone's **Hold · KICK!** button, for 0.85 seconds. The traveler winds up and kicks: a clonk/boing accompanies a physical lift, a small sideways clearance impulse and a 2.4-second upright torque assist. A three-second cooldown prevents repeated kicks. Releasing, moving, leaving reach or pausing cancels charging. The kick works without installed modules, but requires setting down carried cargo or the hook. Exiting an overturned bus searches for an unoccupied spot on the ground instead of following a door direction into the chassis. Side-facing suspension rays disengage beyond 60° of lean, preventing the rock wall from pushing back against the kick; the body still collides normally.

This is a deliberately exaggerated solo recovery action, not a position reset. It adds no checkpoint or automatic return to the road. A player must still retrieve modules and winch out of a ditch. No camera shake or screen flash is added.

## Failure recovery and limits

Loose items outside the walkable terrain or more than one metre below the sampled ground are moved to collision-checked safe ground using the same ID. They stay loose and disconnected; there is no duplication or automatic reinstallation. Merely distant but accessible items stay where they land. On-screen/clamped markers show type and distance.

No fuel depletion, refills, general inventory, arbitrary cargo simulation, cable item retrieval, physical hand joints or multiplayer transport are added. The roof hatch, licence tag and module handles are visual geometry. Chassis mass/inertia uses a fixed 1600 kg loaded envelope; loose modules weigh 12 kg and docked modules have no separate active body.

## Verification gate

Headless tests cover every loading order, startup inhibition, wrong slots/busy hands, held removal/cancellation, same-ID dropping/release/recovery, inherited ejection velocity, bus mass/stability, engine coasting, actual reverse/forward motion, neutral interlock, simultaneous missing modules, passive cable holding, careful/hard late-bump crossings, repeated releases after installation, reverse travel, flat-road stability, visible jostle settling and impact-burst/installation grace. Browser acceptance uses real keyboard actions for the full loading → WINCH retrieval → winch recovery → SKILLS reversal/restoration → finish route, plus CYCLES removal/restoration and pause/restart. See Status for actual results and limits.
