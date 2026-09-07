import {test,expect,type Page} from '@playwright/test';
import {PocketIc,PocketIcServer,SubnetStateType,createIdentity,type Actor} from '@dfinity/pic';
import {HttpAgent} from '@icp-sdk/core/agent';
import {Ed25519KeyIdentity} from '@icp-sdk/core/identity';
import {roomsIdl,type RoomsApi} from '../src/services/rooms-api';
import {idlFactory,type RecordsApi} from '../src/services/records-api';
import {adminIdl,type AdminApi} from '../src/admin/api';
import {expeditionAccount} from './expedition-account-fixture';
let server:PocketIcServer,pic:PocketIc,rooms:Actor<RoomsApi>,gateway:string,cookie:string;
const owner=createIdentity('coop-browser-owner'),reader=Ed25519KeyIdentity.generate(new Uint8Array(32).fill(42));
test.beforeAll(async()=>{
 server=await PocketIcServer.start();pic=await PocketIc.create(server.getUrl(),{nns:{state:{type:SubnetStateType.New}},application:[{state:{type:SubnetStateType.New}}]});await pic.setTime(Date.now());
 const r=await pic.setupCanister<RecordsApi>({idlFactory,wasm:'.mops/.build/records.wasm',sender:owner.getPrincipal()});
 const c=await pic.setupCanister<RoomsApi>({idlFactory:roomsIdl,wasm:'.mops/.build/rooms.wasm',sender:owner.getPrincipal()});rooms=c.actor;rooms.setIdentity(owner);
 const admin=pic.createActor<AdminApi>(adminIdl,r.canisterId);admin.setIdentity(owner);
 await admin.setStatisticsReader(reader.getPrincipal(),true);await rooms.setStatisticsReader(reader.getPrincipal(),true);
 gateway=`http://127.0.0.1:${await pic.makeLive()}`;const agent=await HttpAgent.create({host:gateway,shouldFetchRootKey:true});
 cookie=encodeURIComponent(`PUBLIC_CANISTER_ID:records=${r.canisterId}&PUBLIC_CANISTER_ID:rooms=${c.canisterId}&ic_root_key=${Buffer.from(agent.rootKey!).toString('hex')}`);
});
test.afterAll(async()=>{await pic?.stopLive();await pic?.tearDown();await server?.stop();});
async function wire(page:Page,admin=false){
 await page.context().addCookies([{name:'ic_env',value:cookie,url:'http://127.0.0.1:5173'}]);
 await page.route('**/api/**',async route=>{const response=await route.fetch({url:gateway+new URL(route.request().url()).pathname});await route.fulfill({response});});
 // The user's running Vite injects its own backend cookie on asset responses.
 // Pin only the test environment and II gesture; keep all backend calls real.
 const env=Object.fromEntries(new URLSearchParams(decodeURIComponent(cookie)));
 const key=Array.from(Buffer.from(env.ic_root_key,'hex'));delete env.ic_root_key;
 await page.route(/\/src\/(?:services\/(?:account|rooms)|admin\/main)\.ts(?:\?|$)/,async route=>{
  const response=await route.fetch();let body=await response.text();
  const original=body;
  body=body.replace(/import \{ safeGetCanisterEnv \} from [^;]+;/,`const safeGetCanisterEnv=()=>({...${JSON.stringify(env)},IC_ROOT_KEY:new Uint8Array(${JSON.stringify(key)})});`);
  if(admin||route.request().url().includes('/account.ts'))body=body.replace(/import \{ AuthClient \} from [^;]+;/,'import { AuthClient } from "/browser-tests/identity-fixture.ts";');
  expect(body).not.toBe(original);await route.fulfill({response,body});
 });
}
async function counts(){const r=await rooms.adminStatistics();if('err'in r)throw new Error(r.err);return r.ok;}
test('real two-account session reports milestones and the private panel displays/exports them',async({page,browser})=>{
 test.setTimeout(180000);const errors:string[]=[];
 const guestContext=await browser.newContext(),guest=await guestContext.newPage(),panelContext=await browser.newContext(),panel=await panelContext.newPage();
 try{
  for(const p of [page,guest,panel])p.on('pageerror',e=>errors.push(e.message));
  await expeditionAccount(page,81);await expeditionAccount(guest,82);await wire(page);await wire(guest);await wire(panel,true);
  await page.goto('/?mode=expedition');await expect(page.locator('#exp-host')).toBeEnabled({timeout:30000});await page.locator('#exp-host').click();
  await expect(page.locator('#exp-copy')).toBeEnabled({timeout:30000});const invite=await page.locator('#exp-invite').inputValue();
  await expect.poll(async()=>(await counts()).roomsCreated).toBe(1n);
  await guest.goto(invite);await expect(guest.locator('#exp-ready')).toBeEnabled({timeout:45000});
  await expect.poll(async()=>(await counts()).pairsConnected,{timeout:20000}).toBe(1n);
  await guest.locator('#exp-ready').click();await expect(page.locator('#exp-ready')).toBeEnabled();await page.locator('#exp-ready').click();
  await expect(guest.locator('#exp-hud')).toBeVisible();await expect.poll(async()=>(await counts()).expeditionsStarted,{timeout:20000}).toBe(1n);
  expect((await counts()).guestsJoined).toBe(1n);
  await page.locator('#exp-pause-button').click();await page.locator('#exp-restart').click();await expect(guest.locator('#exp-hud')).toBeVisible();expect((await counts()).expeditionsStarted).toBe(1n);
  const writes:string[]=[];panel.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/call'))writes.push(r.url());});
  await panel.goto('/admin/');await expect(panel.locator('#coop-expeditionsStarted')).toHaveText('1',{timeout:20000});
  for(const key of ['roomsCreated','guestsJoined','pairsConnected'])await expect(panel.locator(`#coop-${key}`)).toHaveText('1');
  await panel.locator('#coop').scrollIntoViewIfNeeded();await panel.screenshot({path:'test-results/coop-analytics-desktop.png',fullPage:true});
  const download=panel.waitForEvent('download');await panel.locator('#coop-export').click();expect((await download).suggestedFilename()).toBe('coop-statistics.csv');
  await rooms.setStatisticsReader(reader.getPrincipal(),false);await panel.locator('#refresh').click();await expect(panel.locator('#coop-status')).toContainText('not been granted');await expect(panel.locator('#coop-metrics')).toBeHidden();await expect(panel.locator('#coop-export')).toBeHidden();await expect(panel.locator('#dashboard')).toBeVisible();
  await rooms.setStatisticsReader(reader.getPrincipal(),true);await panel.locator('#refresh').click();await expect(panel.locator('#coop-expeditionsStarted')).toHaveText('1');
  await panel.setViewportSize({width:390,height:844});await panel.screenshot({path:'test-results/coop-analytics-mobile.png',fullPage:true});
  expect(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await panel.locator('#logout').click();await expect(panel.locator('#dashboard')).toBeHidden();await expect(panel.locator('#coop-export')).toBeHidden();expect(writes).toEqual([]);expect(errors).toEqual([]);
 }finally{await guestContext.close();await panelContext.close();}
});
