# Minimal Multiplayer MVP

# Game Concept

## Premise

A small group of friends is trying to get an old, unreliable recreational vehicle through a remote mountain valley before nightfall.

The road is partially destroyed, the vehicle is too heavy for the terrain, and the only way forward is to cooperate: drive, push, attach the winch, improvise with the environment, and recover from mistakes.

The fantasy is not “drive well.”

The fantasy is:

> **Keep this terrible machine moving together.**

The game should constantly create situations where one player causes a problem and the others have to physically solve it.

---

## Story Setup

The players were on their way home when the main road was closed after a landslide.

There is one remaining route through the valley.

It is technically passable.

Unfortunately, they are driving an old RV that was never designed for it.

The group has to cross the valley before dark.

No large narrative system is required. The story exists primarily to give the journey a clear reason and destination.

Opening setup:

```text
The highway is closed.

The only way home is through the old valley road.

It should take twenty minutes.

Probably.
```

The tone should be dry, understated, and slightly absurd.

---

## Player Fantasy

The central experience is cooperative problem-solving around one shared physical object.

Players should naturally fall into temporary roles:

```text
Driver
Winch operator
Spotter
Person outside fixing the latest disaster
```

Roles are not selected in a menu.

They emerge from the situation.

A typical moment should look like:

```text
Player A: drives

Player B: "stop, stop, STOP"

vehicle slides sideways

Player C: runs toward a tree with the winch

Player D: tries to push the rear of the RV

the vehicle almost tips over

everyone starts shouting

somehow it works
```

This is the core product value of the game.

---

## Core Loop

```text
DRIVE
  ↓
ENCOUNTER PROBLEM
  ↓
GET OUT
  ↓
UNDERSTAND THE SITUATION
  ↓
USE VEHICLE / WINCH / PLAYERS
  ↓
RECOVER
  ↓
CONTINUE
  ↓
CREATE A NEW PROBLEM
```

The important part is that recovery should often be more entertaining than success.

Failure must usually create a new playable situation rather than immediately ending the game.

---

## MVP Level Story

The MVP contains one short section of the journey.

### 1. Safe Start

Players spawn at a roadside stop next to the RV.

The road ahead looks manageable.

Purpose:

- learn movement
- enter the vehicle
- understand who is driving

### 2. First Descent

The group drives down a narrow dirt road.

The suspension and weight of the vehicle become obvious.

No serious challenge yet.

Purpose:

- establish the vehicle as the main shared object
- let players experiment

### 3. The Ditch

A damaged section of road causes the RV to become stuck or slide into a shallow ditch.

Driving alone should not be enough.

Nearby is a clearly visible tree / anchor point.

Purpose:

- force players to leave the vehicle
- introduce the winch naturally

### 4. Recovery

One player takes the winch cable and attaches it to the anchor.

Another controls the vehicle.

They must coordinate throttle and winch tension.

The solution should be simple, but the physics should create room for:

- over-pulling
- rolling the RV
- bad positioning
- players getting dragged
- accidental success

This is the main MVP moment.

### 5. Final Climb

After recovery, the group drives a short uphill section.

The RV is now damaged-looking / dirty / visibly stressed.

The finish is visible ahead.

### 6. Finish

Players reach a small checkpoint / service station / road gate.

Show:

```text
WE MADE IT

Next stop: home.
Probably.
```

For the MVP, the session ends here.

Target session length:

```text
3–7 minutes
```

---

## Tone

The game should feel:

- cooperative
- physical
- slightly stressful
- absurd
- forgiving
- highly readable
- funny because of player behavior, not scripted jokes

Avoid:

- constant meme dialogue
- excessive UI comedy
- forced jokes
- complicated lore
- cinematic exposition

The physics and the players should generate most of the humor.

---

## Design Principle

Every major mechanic should answer this question:

> Does this create a reason for players to communicate and physically help each other?

If not, it is probably outside the MVP.

---

## Goal

Prove that 2 players in separate browsers can connect to the same session and cooperatively interact with one physics-based vehicle.

The MVP is successful when:

1. Player A creates a room.
2. Player B joins using a room code.
3. A WebRTC connection is established.
4. Both players can move.
5. Both players see the same vehicle.
6. One player can drive the vehicle.
7. The second player can operate a winch.
8. Vehicle and winch state stay synchronized well enough to play.

Do not build anything beyond what is required to prove this loop.

---

## Tech Stack

- TypeScript
- Vite
- PlayCanvas Engine
- Rapier 3D WASM
- Native WebRTC DataChannels
- ICP asset canister
- ICP Motoko canister for room creation + WebRTC signaling

---

## Architecture

ICP is NOT part of the realtime simulation loop.

```text
                ICP
        rooms + signaling
                |
                v
        WebRTC connection
                |
                v

Guest ------ inputs ------> Host
Guest <---- snapshots ----- Host
```

The host browser runs the authoritative physics simulation.

ICP only handles:

- create room
- join room
- exchange WebRTC offer/answer
- exchange ICE candidates
- room expiration

Once WebRTC is connected, normal gameplay traffic must go directly between browsers.

---

## Scope

### Required

- 2 players
- room creation
- room code
- room join
- WebRTC connection
- host-authoritative simulation
- player movement
- one vehicle
- vehicle driving
- one winch
- one winch anchor
- basic synchronization
- one tiny test level
- reconnect is NOT required

### Explicitly Not Required

Do not implement:

- 3–4 players before 2-player works reliably
- accounts
- Internet Identity
- matchmaking
- dedicated servers
- host migration
- rollback networking
- deterministic lockstep
- voice chat
- text chat
- persistence
- leaderboards
- multiple levels
- inventory
- ragdolls
- realistic rope physics
- mobile controls
- gamepad support
- production art

---

## Networking Model

Use host-authoritative networking.

### Guest sends

```text
movement input
look direction
jump
enter/exit vehicle
vehicle controls
winch actions
```

### Host simulates

```text
players
vehicle
winch
physics
interactions
```

### Host sends snapshots

Target:

```text
15–20 snapshots / second
```

Physics target:

```text
60 Hz fixed timestep
```

Rendering runs independently.

---

## WebRTC Channels

Create two `RTCDataChannel`s.

### `state`

For continuously changing state.

Configuration:

```text
unordered
unreliable
maxRetransmits = 0
```

Contains:

- player transforms
- vehicle transform
- vehicle velocity
- winch length
- winch attachment state

Old packets can be discarded.

### `events`

For discrete gameplay actions.

Configuration:

```text
ordered
reliable
```

Contains:

- player joined
- enter vehicle
- exit vehicle
- attach winch
- detach winch
- reset vehicle
- start game

---

## Snapshot Format

Keep the protocol minimal.

Example:

```ts
type Snapshot = {
  tick: number;
  players: {
    id: string;
    position: [number, number, number];
    rotation: [number, number, number, number];
  }[];
  vehicle: {
    position: [number, number, number];
    rotation: [number, number, number, number];
    linearVelocity: [number, number, number];
    angularVelocity: [number, number, number];
  };
  winch: {
    attached: boolean;
    targetLength: number;
    anchorId?: string;
  };
};
```

Use stable entity IDs.

Reject snapshots older than the latest processed tick.

---

## Remote Rendering

Do not snap remote entities directly to the newest network state.

Maintain a small snapshot buffer.

Target interpolation delay:

```text
~100 ms
```

Use:

- lerp for position
- slerp for rotation

Do not implement rollback for MVP.

---

## Player

Use a simple kinematic capsule.

Required controls:

```text
WASD
mouse look
jump
interact
```

No character animations are required.

A capsule or primitive placeholder is enough.

---

## Vehicle

Use Rapier's raycast vehicle controller or another simple stable vehicle implementation.

Required:

- throttle
- brake
- reverse
- steering
- suspension
- rollover
- external winch force

Do not build physical rigid-body wheels.

All tuning values should live in one config object.

---

## Winch

Do not simulate the rope as multiple rigid bodies.

Use:

```text
visual rope
+
spring / pulling force
```

Required states:

```text
STOWED
TAKEN
ATTACHED
```

Required actions:

```text
take winch
attach to anchor
reel in
reel out
detach
```

Only the host calculates winch forces.

---

## Test Level

Build one tiny level.

```text
spawn
  |
  v
short road
  |
  v
ditch / slope
  |
  v
winch anchor
  |
  v
finish
```

The vehicle should become difficult to recover without the winch.

Total playtime:

```text
2–5 minutes
```

Primitive geometry is sufficient.

---

## ICP Signaling Canister

Minimal API:

```text
create_room(host_peer_id) -> room_code

join_room(room_code, peer_id) -> room_info

post_signal(
  room_code,
  from_peer,
  to_peer,
  payload
)

poll_signals(
  room_code,
  peer_id
) -> [signal]
```

Signal payload only needs to support:

```text
WebRTC offer
WebRTC answer
ICE candidate
```

Constraints:

```text
max players: 2 initially
room TTL: 30 minutes
signal TTL: 2 minutes
```

Delete expired rooms and old signaling messages.

---

## Implementation Order

### Step 1 — Local Physics

Create:

- level
- player
- vehicle
- winch

Acceptance:

One browser can drive the vehicle into a ditch and pull it out using the winch.

Do not start multiplayer before this works.

### Step 2 — Two-Browser WebRTC

Connect two browser windows using WebRTC.

Temporary manual signaling is acceptable.

Acceptance:

- both players can move
- both players see each other
- vehicle state is synchronized
- guest inputs affect host simulation
- winch actions synchronize

### Step 3 — ICP Rooms

Replace manual signaling with:

```text
Create Room
Join Room
```

using the ICP signaling canister.

Acceptance:

Two separate computers can open the ICP-hosted game and join the same session using only a room code.

### Step 4 — Network Cleanup

Test approximately:

```text
100 ms RTT
1% packet loss
```

Fix only issues that make the game unusable.

Do not attempt perfect synchronization.

---

## Debug Overlay

Add a simple toggleable overlay:

```text
HOST / CLIENT
peer count
RTT
physics FPS
render FPS
snapshot rate
latest simulation tick
```

This is required.

---

## Definition of Done

The multiplayer MVP is done when:

- game loads from ICP
- Player A can create a room
- Player B can join by code
- WebRTC connects automatically
- both players can move
- both players can see one another
- both players see the same vehicle
- one player can drive
- the other player can operate the winch
- vehicle physics runs only on host
- gameplay packets use WebRTC, not ICP
- remote transforms are interpolated
- host disconnect ends the session cleanly
- session remains playable around 100 ms RTT
- one complete 2–5 minute cooperative interaction works

Stop development at this point and test whether the interaction is actually fun before expanding the scope.
