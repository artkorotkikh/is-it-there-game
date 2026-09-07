import { test, expect } from '@playwright/test';
import { PocketIc, PocketIcServer, SubnetStateType, type Actor } from '@dfinity/pic';
import { HttpAgent } from '@icp-sdk/core/agent';
import { Ed25519KeyIdentity } from '@icp-sdk/core/identity';
import { idlFactory,unwrap,type RecordsApi } from '../src/services/records-api';
let server:PocketIcServer,pic:PocketIc,api:Actor<RecordsApi>,gateway:string,cookie:string;
const identity=Ed25519KeyIdentity.generate(new Uint8Array(32).fill(42));
test.beforeAll(async()=>{
  server=await PocketIcServer.start();pic=await PocketIc.create(server.getUrl(),{nns:{state:{type:SubnetStateType.New}},application:[{state:{type:SubnetStateType.New}}]});
  await pic.setTime(Date.now()-120000);
  const fixture=await pic.setupCanister<RecordsApi>({idlFactory,wasm:'.mops/.build/records.wasm',sender:identity.getPrincipal()});api=fixture.actor;api.setIdentity(identity);
  const ticket=unwrap(await api.startRun('old-road',5n));await pic.advanceTime(60000);await pic.tick();unwrap(await api.finishRun(ticket.id,59000n));
  await pic.setTime(Date.now());gateway=`http://127.0.0.1:${await pic.makeLive()}`;
  const agent=await HttpAgent.create({host:gateway,shouldFetchRootKey:true});
  cookie=encodeURIComponent(`PUBLIC_CANISTER_ID:records=${fixture.canisterId.toText()}&ic_root_key=${Buffer.from(agent.rootKey!).toString('hex')}`);
});
test.afterAll(async()=>{await pic?.stopLive();await pic?.tearDown();await server?.stop();});
for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}])test(`garage persists to real Wasm and public ranking at ${viewport.width}x${viewport.height}`,async({browser})=>{
  const context=await browser.newContext({viewport,hasTouch:viewport.width!==1280,isMobile:viewport.width!==1280});
  await context.addCookies([{name:'ic_env',value:cookie,url:'http://127.0.0.1:5173'}]);
  const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  let rejectWrites=false;let holdSave:Promise<void>|undefined;
  await page.route('**/src/services/account.ts*',async route=>{const response=await route.fetch();const body=await response.text();const modified=body.replace(/import \{ AuthClient \} from [^;]+;/,'import { AuthClient } from "/browser-tests/identity-fixture.ts";');expect(modified).not.toBe(body);await route.fulfill({response,body:modified});});
  await page.route('**/api/**',async route=>{if(holdSave && route.request().url().endsWith('/call'))await holdSave;if(rejectWrites && route.request().url().endsWith('/call')){await route.abort();return;}const response=await route.fetch({url:gateway+new URL(route.request().url()).pathname});await route.fulfill({response});});
  const skin=viewport.width===390?{color:'mint',wheels:'whitewall',decal:'404'}:viewport.width===844?{color:'gold',wheels:'stock',decal:'probably'}:{color:'blue',wheels:'rally',decal:'ship'};
  try{
    await page.goto('/');await expect(page.locator('#start')).toBeEnabled();await expect(page.locator('#account-toggle')).not.toHaveText('Connecting…',{timeout:30000});
    await page.locator('#open-garage').click();await expect(page.locator('#nickname')).toBeEditable();
    if(viewport.width===1280)await expect(page.locator('#nickname')).toHaveValue(/^\w+ \w+ \d{4}$/);
    await page.locator('#nickname').fill(`Road Tester ${viewport.width}`);
    await page.locator(`[data-color="${skin.color}"]`).click();await page.locator(`[data-wheels="${skin.wheels}"]`).click();await page.locator(`[data-decal="${skin.decal}"]`).click();await page.locator('#profile-listed').check();
    await page.locator('#save-profile').click();await expect(page.locator('#account-message')).toHaveText('Profile saved. Ready to roll.',{timeout:30000});
    const saved=unwrap(await api.myProfile())[0]!;expect(saved).toEqual({nickname:`Road Tester ${viewport.width}`,skin,listed:true});
    await page.screenshot({path:`test-results/garage-controls-${viewport.width}.png`});
    await page.locator('#tab-garage').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/garage-${viewport.width}.png`});
    await page.locator('#tab-leaderboard').click();await expect(page.locator('#board-rows')).toContainText(saved.nickname,{timeout:15000});await expect(page.locator('#board-rows')).toContainText('0:59.00');await expect(page.locator('.your-row')).toHaveCount(1);
    await page.screenshot({path:`test-results/leaderboard-${viewport.width}.png`});
    await page.locator('#board-track').selectOption('relay-ridge');await expect(page.locator('#board-status')).toContainText('No public deliveries');
    await page.locator('#close-account').click();await page.reload();await expect(page.locator('#start')).toBeEnabled();await expect(page.locator('#account-toggle')).toContainText(saved.nickname,{timeout:30000});
    await page.screenshot({path:`test-results/skin-world-${viewport.width}.png`});await page.locator('#open-garage').click();await expect(page.locator(`[data-color="${skin.color}"]`)).toHaveAttribute('aria-pressed','true');await expect(page.locator('#nickname')).toHaveValue(saved.nickname);
    await page.locator('[data-color="coral"]').click();await page.locator('#close-account').click();await page.locator('#open-garage').click();await expect(page.locator(`[data-color="${skin.color}"]`)).toHaveAttribute('aria-pressed','true');
    if(viewport.width===1280){
      rejectWrites=true;await page.locator('#nickname').fill('Retry Driver');await page.locator('#save-profile').click();await expect(page.locator('#account-message')).toContainText('Could not save',{timeout:30000});await expect(page.locator('#nickname')).toHaveValue('Retry Driver');expect(unwrap(await api.myProfile())[0]?.nickname).toBe(saved.nickname);
      rejectWrites=false;await page.locator('#save-profile').click();await expect(page.locator('#account-message')).toHaveText('Profile saved. Ready to roll.',{timeout:30000});
    }
    let releaseSave!:()=>void;holdSave=new Promise(resolve=>releaseSave=resolve);
    await page.locator('#profile-listed').uncheck();await page.locator('#save-profile').click();await page.locator('#tab-leaderboard').click();await page.locator('#board-track').selectOption('old-road');await expect(page.locator('#board-rows li')).toHaveCount(1);
    holdSave=undefined;releaseSave();await expect(page.locator('#account-message')).toHaveText('Profile saved. Ready to roll.',{timeout:30000});await expect(page.locator('#board-status')).toContainText('No public deliveries');
    await page.locator('#sign-out').click();await expect(page.locator('#sign-out')).toBeDisabled();await page.locator('#tab-garage').click();await expect(page.locator('#nickname')).toBeDisabled();await expect(page.locator('#nickname')).toHaveValue('');
    await page.locator('#close-account').click();await page.locator('#open-leaderboard').click();await expect(page.locator('#board-status')).toContainText('No public deliveries');await page.keyboard.press('Escape');await expect(page.locator('#account-panel')).toBeHidden();await expect(page.locator('#open-leaderboard')).toBeFocused();
    expect(errors).toEqual([]);
  }finally{await context.close();}
});
