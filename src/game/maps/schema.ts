/** Portable, data-only map format. Coordinates are metres; rotations are radians.
 * Heights are row-major, +X within a row and +Z between rows. Version is content
 * identity; schemaVersion describes this file's structure. No scripts or URLs.
 */
export interface MapDefinition {
  schemaVersion: 1;
  id: string;
  version: number;
  name: string;
  description: string;
  terrain: { originX: number; originZ: number; cellSize: number; columns: number; rows: number; heights: number[] };
  spawn: { vehicle: MapPoint; players: [MapPoint, MapPoint] };
  finish: MapPoint & { radius: number };
  anchors: (MapPoint & { id: string })[];
  obstacles: (MapPoint & { id: string; width: number; height: number; depth: number })[];
  resources: (MapPoint & { id: string; kind: 'plank' | 'stone' })[];
}
export interface MapPoint { x: number; z: number; yaw: number }

const reserved = new Set(['old-road', 'relay-ridge', 'finality-quarry']);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function requireValue(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(`Invalid map: ${message}`); }
function keys(v: Record<string, unknown>, allowed: string[], where: string) {
  requireValue(Object.keys(v).every(k => allowed.includes(k)), `${where}: unknown field`);
}
const numberIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integerIn = (v: unknown, min: number, max: number): v is number => numberIn(v, min, max) && Number.isInteger(v);
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[a-z][a-z0-9-]{1,47}$/.test(v);

/** Validate before allocating terrain/physics. Throws with a bounded field error. */
export function parseMap(value: unknown): MapDefinition {
  requireValue(record(value), 'expected an object');
  keys(value, ['schemaVersion','id','version','name','description','terrain','spawn','finish','anchors','obstacles','resources'], 'root');
  requireValue(value.schemaVersion === 1, 'unsupported schemaVersion');
  requireValue(identifier(value.id) && !reserved.has(value.id), 'id is invalid or reserved for a solo record');
  requireValue(integerIn(value.version, 1, 1_000_000), 'version');
  for (const [key, max] of [['name', 60], ['description', 240]] as const) {
    const text = value[key];
    requireValue(typeof text === 'string' && text.trim().length > 0 && text.length <= max && !/[\u0000-\u001f<>]/.test(text), key);
  }
  const t = value.terrain;
  requireValue(record(t), 'terrain');
  keys(t, ['originX','originZ','cellSize','columns','rows','heights'], 'terrain');
  requireValue(numberIn(t.originX,-500,500) && numberIn(t.originZ,-500,500), 'terrain origin');
  requireValue(numberIn(t.cellSize,.5,4), 'cellSize (0.5–4 m)');
  requireValue(integerIn(t.columns,3,129) && integerIn(t.rows,3,257) && t.columns*t.rows <= 20_000, 'terrain dimensions');
  requireValue(Array.isArray(t.heights) && t.heights.length === t.columns*t.rows && t.heights.every(h=>numberIn(h,-8,80)), 'heights');
  const minX=t.originX, minZ=t.originZ, maxX=minX+(t.columns-1)*t.cellSize, maxZ=minZ+(t.rows-1)*t.cellSize;
  const point = (p:unknown, where:string, extra:string[]=[], margin=1) => {
    requireValue(record(p), where);
    keys(p, ['x','z','yaw',...extra], where);
    requireValue(numberIn(p.x,minX+margin,maxX-margin) && numberIn(p.z,minZ+margin,maxZ-margin) && numberIn(p.yaw,-Math.PI*2,Math.PI*2), `${where}: position/yaw`);
  };
  const spawn=value.spawn;
  requireValue(record(spawn), 'spawn'); keys(spawn,['vehicle','players'],'spawn');
  point(spawn.vehicle,'vehicle spawn',[],4);
  requireValue(Array.isArray(spawn.players) && spawn.players.length===2,'exactly two player spawns');
  spawn.players.forEach(p=>point(p,'player spawn',[],1));
  point(value.finish,'finish',['radius'],4);
  requireValue(record(value.finish) && numberIn(value.finish.radius,3,10),'finish radius');
  const ids=new Set<string>();
  for(const [key,max] of [['anchors',48],['obstacles',96],['resources',32]] as const) {
    const items=value[key]; requireValue(Array.isArray(items) && items.length<=max,key);
    if(key==='anchors')requireValue(items.length>=1,'at least one winch anchor');
    for(const item of items) {
      point(item,key,key==='obstacles'?['id','width','height','depth']:key==='resources'?['id','kind']:['id']);
      requireValue(record(item) && identifier(item.id) && !ids.has(item.id),`${key}: unique id`); ids.add(item.id);
      if(key==='resources')requireValue(item.kind==='plank'||item.kind==='stone','resource kind');
      if(key==='obstacles')for(const dimension of ['width','height','depth'])requireValue(numberIn(item[dimension],.25,12),`obstacle ${dimension}`);
    }
  }
  return value as unknown as MapDefinition;
}
