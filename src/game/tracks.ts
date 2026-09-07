/** Track IDs + rulesVersion are persistent record keys. Bump the version if a route changes. */
export type TrackId = string;
export interface Track {
  map?: import('./maps/schema').MapDefinition;
  id: TrackId; number: string; name: string; description: string; difficulty: string; rulesVersion: number;
  profile: readonly (readonly [number, number])[];
  centerline: readonly (readonly [number, number])[]; // [world Z, road center X], metres.
  roadHalfWidth: number; shoulderSlope: number; finishZ: number;
  anchorX: number; anchorZ: number; recoverySpawnZ: number;
  winchOptional: boolean; // The introductory climb is driveable; this controls its help copy.
  ditch: readonly [number, number]; ditchMaxY: number; recoveredZ: number; recoveredMinY: number;
  bumps: readonly number[];
  rolloverRockZ: number; // Optional one-sided rock on a flat straight, metres along the course.
  obstacles: readonly { x: number; z: number; width: number; depth: number; height: number }[];
  palette: { sky: string; ground: string; road: string; verge: string; trees: string; accent: string };
}
export const tracks: readonly Track[] = [
  {
    id: 'old-road', number: '01', name: 'The old road', description: 'An easier first delivery. Two gentle bumps and one shallow dip.', difficulty: 'EASY DOES IT', rulesVersion: 5,
    centerline: [[-24,0],[90,0],[105,2],[132,2]],
    profile: [[-24,3],[9.8,3],[12.8,3.22],[15.8,3],[18,3],[24,2.5],[30,1.2],[32,.64],[34,.18],[36,0],[43,0],[45,.18],[47,.7],[49,1.45],[51,2.2],[53,2.8],[55,3.15],[57,3.3],[73,3.5],[82,3.5],[85,3.68],[88,3.5],[132,3.5]],
    roadHalfWidth: 8, shoulderSlope: .25, finishZ: 112,
    anchorX: 3.5, anchorZ: 60, recoverySpawnZ: 39, ditch: [35,47], ditchMaxY: 2, recoveredZ: 53, recoveredMinY: 3,
    winchOptional: true,
    bumps: [12.8,85], rolloverRockZ: 77, obstacles: [],
    palette: { sky: '#c2c9ad', ground: '#879071', road: '#b6a787', verge: '#aa9b7a', trees: '#49634d', accent: '#edb44e' },
  },
  {
    id: 'relay-ridge', number: '02', name: 'Relay ridge', description: 'A winding mountain pass. Thread the roadblocks and keep the cargo.', difficulty: 'MIND THE GAP', rulesVersion: 4,
    centerline: [[-24,0],[101,0],[123,4],[148,-4],[173,4],[194,-4],[210,-4]],
    profile: [[-24,3],[14,3],[15,3.04],[16,3],[19.2,3],[20,3.45],[20.8,3],[27,3],[39,.5],[46,-1.5],[53,-1.5],[61,4.5],[70,5],[88,5],[90,5.28],[92,5],[100,5],[120,6],[143,6],[155,8],[166,8],[176,9],[210,9]],
    roadHalfWidth: 4.6, shoulderSlope: .6, finishZ: 190,
    anchorX: 3.5, anchorZ: 70, recoverySpawnZ: 49, ditch: [45,57], ditchMaxY: 1.5, recoveredZ: 63, recoveredMinY: 4.5,
    winchOptional: false,
    bumps: [20,90], rolloverRockZ: 81,
    obstacles: [{x:-1.9,z:114,width:4.5,depth:1,height:1.15},{x:1.9,z:136,width:4.5,depth:1,height:1.15},{x:-1.9,z:159,width:4.5,depth:1,height:1.15}],
    palette: { sky: '#aebdc7', ground: '#768a88', road: '#a3acaa', verge: '#889794', trees: '#385d60', accent: '#67d4df' },
  },
  {
    id: 'finality-quarry', number: '03', name: 'Finality quarry', description: 'Dust, winding rollers and one last long climb. Deliver all three modules.', difficulty: 'THE LONG HAUL', rulesVersion: 4,
    centerline: [[-24,0],[108,0],[133,5],[160,-5],[187,5],[220,-4],[248,-4]],
    profile: [[-24,3],[17,3],[18,3.15],[19,3],[23.2,3],[24,3.48],[24.8,3],[30,3],[42,0],[49,-2],[56,-2],[64,4],[77,5],[96,5],[98,5.28],[100,5],[120,5],[124,5.6],[128,5],[134,5],[138,5.7],[142,5],[148,5],[152,5.8],[156,5],[164,5],[184,8.5],[193,8.5],[198,9.2],[203,8.5],[223,11.5],[248,11.5]],
    roadHalfWidth: 7, shoulderSlope: .35, finishZ: 228,
    anchorX: 3.5, anchorZ: 73, recoverySpawnZ: 52, ditch: [48,60], ditchMaxY: 1, recoveredZ: 66, recoveredMinY: 4,
    winchOptional: false,
    bumps: [24,98,124,138,152,198], rolloverRockZ: 87, obstacles: [],
    palette: { sky: '#c9adba', ground: '#9e8878', road: '#c2a17c', verge: '#a88c71', trees: '#736477', accent: '#d5a0e6' },
  },
];
export const trackById = (id: string): Track => tracks.find(track => track.id === id) ?? tracks[0];
