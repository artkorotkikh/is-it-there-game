import { readdir, readFile } from 'node:fs/promises';
import { parseMap } from '../src/game/maps/schema.ts';
const root=new URL('../src/game/maps/data/',import.meta.url), ids=new Set();
for(const name of (await readdir(root)).filter(n=>n.endsWith('.json')).sort()) {
  const map=parseMap(JSON.parse(await readFile(new URL(name,root),'utf8')));
  if(ids.has(map.id))throw new Error(`Duplicate map id: ${map.id}`);ids.add(map.id);
  console.log(`${map.id} v${map.version}: ${map.terrain.columns}×${map.terrain.rows}, ${map.resources.length} resources`);
}
if(!ids.size)throw new Error('No expedition maps');
