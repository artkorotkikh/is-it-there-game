import { parseMap, type MapDefinition } from './schema';
import type { Track } from '../tracks';

const files = import.meta.glob('./data/*.json', { eager: true, import: 'default' });
export const expeditionMaps: readonly MapDefinition[] = Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([file,value])=>{
  try { return parseMap(value); } catch(error) { throw new Error(`${file}: ${String(error)}`); }
});
if(new Set(expeditionMaps.map(map=>map.id)).size!==expeditionMaps.length)throw new Error('Duplicate expedition map id');

/** Compatibility metadata for the shared vehicle/rendering layer. Expedition
 * IDs never enter the solo record flow. Terrain and goals use map data directly. */
export function mapTrack(map:MapDefinition):Track {
  return {
    id:map.id, number:'04', name:map.name, description:map.description, difficulty:'EXPEDITION', rulesVersion:map.version,
    profile:[[map.terrain.originZ,0],[map.terrain.originZ+(map.terrain.rows-1)*map.terrain.cellSize,0]],
    centerline:[[map.terrain.originZ,0],[map.terrain.originZ+(map.terrain.rows-1)*map.terrain.cellSize,0]],
    roadHalfWidth:map.terrain.columns*map.terrain.cellSize/2-1, shoulderSlope:0, finishZ:map.finish.z,
    anchorX:map.anchors[0].x, anchorZ:map.anchors[0].z, recoverySpawnZ:map.spawn.vehicle.z,
    winchOptional:true, ditch:[25,60], ditchMaxY:3, recoveredZ:65, recoveredMinY:0, bumps:[], rolloverRockZ:0, obstacles:[],
    palette:{sky:'#c2c9ad',ground:'#879071',road:'#b6a787',verge:'#aa9b7a',trees:'#49634d',accent:'#edb44e'}, map,
  };
}
