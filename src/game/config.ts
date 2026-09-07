// SI units unless noted. Shared physics tuning lives here; route geometry is in tracks.ts.
export const config = {
  physics: { step: 1 / 60, maxFrame: 0.1, maxSteps: 6, gravity: -9.81 },
  terrain: { halfWidth: 18, edgeMargin: 0.6 },
  player: { radius: 0.3, halfHeight: 0.5, walkSpeed: 4.5, runSpeed: 7, jumpSpeed: 5.2, interactionDistance: 3.4, exitDistance: 3 },
  vehicle: {
    mass: 1600,
    halfWidth: 1.08,
    halfHeight: 0.75,
    halfLength: 2.35,
    wheelX: 1.04,
    wheelZ: 1.55,
    wheelY: -0.48,
    wheelRadius: 0.45,
    suspension: 0.42,
    suspensionStiffness: 38,
    suspensionCompression: 4.4,
    suspensionRelaxation: 5.4,
    maxSuspensionForce: 16000,
    engineForce: 1800, // Per wheel, all-wheel drive for the prototype.
    brakeForce: 130,
    parkingBrake: 70,
    minSuspensionUp: .5, // cos(60°): side-facing wheel rays must not push off walls.
    maxSteering: 0.42,
    steeringResponse: 3.2, // Radians per second.
    maxSpeed: 14, // m/s; engine cuts out above this, external forces still apply.
  },
  winch: {
    minLength: 2,
    maxLength: 32,
    reelSpeed: 1.6, // m/s at no load; the drum slows under tension.
    stiffness: 40000, // N/m, tension-only; 10 kN stretches 25 cm.
    damping: 6500, // Ns/m along the first supported cable segment.
    maxForce: 28000,
    attachSlack: 0.3, // m; attaching alone must not jerk the vehicle.
    groundClearance: 0.07, // m above collision surface, including road overlay.
    radius: 0.025, // m, visual cable radius.
    visualSegmentLength: 0.4, // m, slack curve sampling.
    mount: { x: 0, y: -0.25, z: 2.68 }, // Front face of the fairlead.
  },
  cargo: {
    mass: 12, // kg per loose module; docked modules are included in chassis mass.
    halfWidth: 0.255, halfHeight: 0.35, halfDepth: 0.24, // m, handles are cosmetic.
    friction: 0.85, restitution: 0.08,
    carrySpeed: 2.8, // m/s, no sprint with cargo.
    reach: 1.7, socketReach: 1.75, // m, with rear access and line-of-sight checks.
    stationarySpeed: 0.35, // m/s, docking/removal threshold.
    removeSeconds: 0.85,
    ejectSpeed: 2.3, ejectLift: 1.1, ejectSide: 0.45, // m/s added relative to mount velocity.
    shockThreshold: 8, // m/s², loose latches react to smaller upward shocks.
    minimumBumpSpeed: 2.1, // m/s; crawling still protects the cargo.
    releaseCooldown: 2.5, dockGrace: 2, // seconds; one loss per impact burst, time to settle after loading.
    impactQuietSeconds: .4, impactReset: 2, // seconds below this upward acceleration (m/s²) to rearm.
    rattleThreshold: 3, // m/s², audible cargo jolt before the release threshold.
    rattleSpring: 110, rattleDamping: 7, rattleGain: .65, // s^-2, s^-1, acceleration multiplier.
    rattleTravel: .11, // metres of bounded visual socket travel; no extra chassis mass.
    socketY: -0.12, socketZ: -1.98,
    carryForward: 0.7, carryY: 0.02,
    rescueMargin: 1, belowGroundLimit: 1, // m.
  },
  recovery: {
    holdSeconds: .85, cooldown: 3, assistSeconds: 2.4, // seconds
    exitDistance: 4, // metres; leave room for the chassis to rotate after exiting.
    reach: 4.6, liftSpeed: 2.3, clearanceSpeed: 2, // metres, vertical/sideways impulse / mass in m/s
    torque: 18000, damping: 6500, // N·m/rad, N·m·s/rad; short upright PD assist
  },
  fieldKit: {
    plank: { width:1.15, height:.18, length:6.8 }, // metres; bank overlap across the 5 m gap, two wheel tracks
    stone: { width:1.25, height:.65, length:1.6 }, // metres; a beveled wheel ramp
    reach:2.4, carrySpeed:2.5, placementReach:3.9, // metres, m/s, metres ahead of player
    rotationSpeed:1.2, maxSlope:.65, supportInset:.16, // rad/s, rise/run, metres from plank ends
    clearance:.025, maxBurial:.07, // metres; supported items are deliberately stable
    pushForce:1900, pushReach:3.4, pushMaxSpeed:1.8, // newtons, metres, m/s
    pingLifetime:5, pingDistance:7, // seconds, metres in camera-facing direction
  },
  rolloverRock: {
    roadOffset: 3.4, width: 1.5, length: 4.6, height: 1.8, // metres; beside the main driving line
    peakFraction: .15, friction: 1.1, // Peak Z as a fraction of length from its centre.
  },
} as const;

export const moduleDefinitions = {
  winch: { id: 'winch-01', number: '01', label: 'WINCH', color: '#edb44e', symbol: '↧', x: 0.66 },
  cycles: { id: 'cycles-02', number: '02', label: 'CYCLES', color: '#57cbd8', symbol: 'ϟ', x: 0 },
  skills: { id: 'skills-03', number: '03', label: 'SKILLS', color: '#b18ae8', symbol: '↔', x: -0.66 },
} as const;
