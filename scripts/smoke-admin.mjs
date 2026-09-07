import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Actor, HttpAgent } from '@icp-sdk/core/agent';
import { roomsIdl } from '../src/services/rooms-api.ts';
import { adminIdl } from '../src/admin/api.ts';
import { idlFactory } from '../src/services/records-api.ts';

// Read-only release verification: never loads the game or writes profiles/events/grants.
const mapping=JSON.parse(readFileSync('.icp/data/mappings/ic.ids.json','utf8'));
if (!mapping.admin) throw new Error('Admin canister has not been mapped');
const base=new URL(process.argv[2] ?? `https://${mapping.admin}.icp.net/`);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const html=await fetch(base);
if(html.status!==200 || sha(await html.text())!==sha(readFileSync('dist-admin/index.html')))throw new Error('Admin HTML mismatch');
for(const [header,value] of [['x-frame-options','DENY'],['x-content-type-options','nosniff'],['cache-control','no-store'],['x-robots-tag','noindex']]) {
  if(!html.headers.get(header)?.includes(value))throw new Error(`Missing ${header}`);
}
if(!html.headers.get('content-security-policy')?.includes("connect-src 'self'"))throw new Error('Missing CSP');
const cookie=html.headers.getSetCookie().find(value=>value.startsWith('ic_env='));
if(!cookie)throw new Error('Missing canister environment');
const env=new URLSearchParams(decodeURIComponent(cookie.slice(7).split(';')[0]));
for(const name of ['records','admin','rooms'])if(env.get(`PUBLIC_CANISTER_ID:${name}`)!==mapping[name])throw new Error(`Incorrect ${name} mapping`);
for(const path of ['.well-known/ii-app-metadata',...readdirSync('dist-admin/assets').map(name=>`assets/${name}`)]) {
  const response=await fetch(new URL(path,base));
  if(response.status!==200 || sha(Buffer.from(await response.arrayBuffer()))!==sha(readFileSync(`dist-admin/${path}`)))throw new Error(`Asset mismatch: ${path}`);
  const mime=response.headers.get('content-type') ?? '';
  if(path.endsWith('.js')&&!mime.includes('javascript') || path.endsWith('.css')&&!mime.includes('text/css'))throw new Error(`MIME mismatch: ${path}`);
}
if((await fetch(new URL('assets/missing.js',base))).status!==404)throw new Error('Missing asset must be 404');
const agent=await HttpAgent.create({host:base.origin});
const admin=Actor.createActor(adminIdl,{agent,canisterId:mapping.records});
const records=Actor.createActor(idlFactory,{agent,canisterId:mapping.records});
if(await records.version()!=='0.6.1')throw new Error('Wrong records version');
for(const result of [await admin.adminStatistics(),await admin.listStatisticsReaders(),await records.statistics(),await records.myRecords(),await records.myProfile()]) {
  if(!('err' in result))throw new Error('Anonymous access was not rejected');
}
const coop=Actor.createActor(roomsIdl,{agent,canisterId:mapping.rooms});
if(!('err' in await coop.adminStatistics())||!('err' in await coop.listStatisticsReaders()))throw new Error('Anonymous co-op statistics access');
console.log(JSON.stringify({url:base.href,result:'passed',mode:'read-only',records:mapping.records,recordsVersion:'0.6.1',assets:'exact',anonymousAccess:'rejected'}));
