import { writeFile } from 'node:fs/promises';
const id=process.argv[2];
if(!id || !/^[a-z][a-z0-9-]{1,47}$/.test(id) || ['old-road','relay-ridge','finality-quarry'].includes(id))throw new Error('Usage: npm run maps:new -- my-map');
const map={schemaVersion:1,id,version:1,name:id.split('-').join(' '),description:'A new expedition. Edit its terrain and resources.',terrain:{originX:-24,originZ:-8,cellSize:2,columns:25,rows:41,heights:Array(25*41).fill(3)},spawn:{vehicle:{x:0,z:3,yaw:0},players:[{x:4,z:0,yaw:0},{x:-4,z:0,yaw:0}]},finish:{x:0,z:64,yaw:0,radius:5},anchors:[{id:'anchor-one',x:6,z:32,yaw:0}],obstacles:[],resources:[{id:'plank-one',kind:'plank',x:6,z:8,yaw:0},{id:'stone-one',kind:'stone',x:-6,z:8,yaw:0}]};
const file=new URL(`../src/game/maps/data/${id}.json`,import.meta.url);
await writeFile(file,JSON.stringify(map,null,2)+'\n',{flag:'wx'});
console.log(`Created ${file.pathname}. Run npm run maps:check, then open Expeditions.`);
