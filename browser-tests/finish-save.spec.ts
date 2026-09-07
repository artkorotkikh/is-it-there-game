import { test,expect } from '@playwright/test';
import { PocketIc,PocketIcServer,SubnetStateType,type Actor } from '@dfinity/pic';
import { HttpAgent } from '@icp-sdk/core/agent';
import { Ed25519KeyIdentity } from '@icp-sdk/core/identity';
import { idlFactory,unwrap,type RecordsApi } from '../src/services/records-api';
import { collect,install,enter,followRoad } from './helpers';
import { canisterTypes } from '../src/game/types';
let server:PocketIcServer,pic:PocketIc,api:Actor<RecordsApi>,gateway:string,cookie:string;
const identity=Ed25519KeyIdentity.generate(new Uint8Array(32).fill(42));
test.beforeAll(async()=>{
  server=await PocketIcServer.start({ttl:900});pic=await PocketIc.create(server.getUrl(),{nns:{state:{type:SubnetStateType.New}},application:[{state:{type:SubnetStateType.New}}]});
  await pic.setTime(Date.now());const fixture=await pic.setupCanister<RecordsApi>({idlFactory,wasm:'.mops/.build/records.wasm',sender:identity.getPrincipal()});api=fixture.actor;api.setIdentity(identity);
  gateway=`http://127.0.0.1:${await pic.makeLive()}`;const agent=await HttpAgent.create({host:gateway,shouldFetchRootKey:true});
  cookie=encodeURIComponent(`PUBLIC_CANISTER_ID:records=${fixture.canisterId.toText()}&ic_root_key=${Buffer.from(agent.rootKey!).toString('hex')}`);
});
test.afterAll(async()=>{await pic?.stopLive();await pic?.tearDown();await server?.stop();});
test('guest full delivery, cancelled II, failed save, retry, leaderboard and reload use real Wasm',async({page,context})=>{
  test.setTimeout(600000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await context.addCookies([{name:'ic_env',value:cookie,url:'http://127.0.0.1:5173'}]);
  await page.addInitScript(()=>{if(!sessionStorage.getItem('finish-test-initialized')){sessionStorage.setItem('garage-test-signed-out','yes');sessionStorage.setItem('finish-test-initialized','yes');}});
  await page.route('**/src/services/account.ts*',async route=>{const response=await route.fetch();const body=await response.text();await route.fulfill({response,body:body.replace(/import \{ AuthClient \} from [^;]+;/,'import { AuthClient } from "/browser-tests/identity-fixture.ts";')});});
  // This test substitutes only II's human gesture, never gameplay or canister state.
  await context.route('https://id.ai/**',route=>route.fulfill({body:'Local identity fixture'}));
  let rejectWrites=false;
  await page.route('**/api/**',async route=>{if(rejectWrites && route.request().url().endsWith('/call')){await route.abort();return;}const response=await route.fetch({url:gateway+new URL(route.request().url()).pathname});await route.fulfill({response});});
  await page.goto('/');await expect(page.locator('#account-toggle')).toContainText('Sign in',{timeout:30000});await page.locator('#start').click();await expect(page.locator('#hud')).not.toHaveClass(/hidden/,{timeout:15000});
  for(const type of canisterTypes){await collect(page,type);await install(page,type);}
  await enter(page);await followRoad(page,s=>s.progress.finished,{maxSpeed:3.6});
  await expect(page.locator('#finish-signin')).toHaveText('Sign in & join leaderboard ↗');
  await expect.poll(async()=>unwrap(await api.statistics()).courses[0]?.finishes,{timeout:30000}).toBe(1n);
  expect(unwrap(await api.statistics()).opens).toBe(1n);expect(unwrap(await api.myRecords())).toEqual([]);
  const displayed=await page.locator('#finish-time').innerText();
  await page.screenshot({path:'test-results/finish-guest-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.locator('#finish-signin').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/finish-guest-phone.png'});
  await page.evaluate(()=>sessionStorage.setItem('finish-test-cancel','yes'));await page.locator('#finish-signin').click();
  await expect(page.locator('#save-status')).toContainText('Your time is still here',{timeout:10000});expect(await page.locator('#finish-time').innerText()).toBe(displayed);expect(unwrap(await api.myRecords())).toEqual([]);
  rejectWrites=true;await page.locator('#finish-signin').click();await expect(page.locator('#retry-save')).toBeVisible({timeout:45000});expect(await page.locator('#finish-time').innerText()).toBe(displayed);
  rejectWrites=false;await page.locator('#retry-save').click();await expect(page.locator('#save-status')).toContainText('Leaderboard enabled',{timeout:30000});
  const record=unwrap(await api.myRecords())[0]!;expect(record.completions).toBe(1n);expect(unwrap(await api.myProfile())[0]?.listed).toBe(true);expect(unwrap(await api.statistics()).courses[0]).toMatchObject({starts:1n,finishes:1n,saved:1n});
  await page.screenshot({path:'test-results/finish-saved-phone.png'});await page.locator('#finish-board').click();await expect(page.locator('#board-rows')).toContainText(unwrap(await api.myProfile())[0]!.nickname,{timeout:15000});
  await page.locator('#close-account').click();await page.reload();await expect(page.locator('#account-toggle')).not.toContainText('Connecting',{timeout:30000});await page.locator('#open-garage').click();await page.locator('#tab-records').click();await expect(page.locator('#account-records')).toContainText('1 deliveries');
  await expect.poll(async()=>unwrap(await api.statistics()).opens).toBe(2n);expect(unwrap(await api.myRecords())).toEqual([record]);
  // Practice bypasses ticket/counter creation even while signed in.
  await page.locator('#close-account').click();await page.locator('#start').click();await expect(page.locator('#hud')).not.toHaveClass(/hidden/);await page.keyboard.press('Escape');await page.locator('#recovery').click();await expect(page.locator('#run-timer')).toContainText('PRACTICE');
  expect(unwrap(await api.statistics()).courses[0]).toMatchObject({starts:2n,finishes:1n,saved:1n});expect(errors).toEqual([]);
});
