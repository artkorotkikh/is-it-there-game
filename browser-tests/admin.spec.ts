import { test, expect } from '@playwright/test';
import { PocketIc, PocketIcServer, SubnetStateType, createIdentity, type Actor } from '@dfinity/pic';
import { HttpAgent } from '@icp-sdk/core/agent';
import { Ed25519KeyIdentity } from '@icp-sdk/core/identity';
import { idlFactory, unwrap, type RecordsApi } from '../src/services/records-api';
import { adminIdl, type AdminApi } from '../src/admin/api';

let server:PocketIcServer,pic:PocketIc,records:Actor<RecordsApi>,admin:Actor<AdminApi>,gateway:string,cookie:string;
const controller=createIdentity('browser-admin-controller');
const reader=Ed25519KeyIdentity.generate(new Uint8Array(32).fill(42));
test.beforeAll(async()=>{
  server=await PocketIcServer.start();pic=await PocketIc.create(server.getUrl(),{nns:{state:{type:SubnetStateType.New}},application:[{state:{type:SubnetStateType.New}}]});
  await pic.setTime(Date.now());
  const fixture=await pic.setupCanister<RecordsApi>({idlFactory,wasm:'.mops/.build/records.wasm',sender:controller.getPrincipal()});
  records=fixture.actor;admin=pic.createActor<AdminApi>(adminIdl,fixture.canisterId);admin.setIdentity(controller);
  gateway=`http://127.0.0.1:${await pic.makeLive()}`;
  const agent=await HttpAgent.create({host:gateway,shouldFetchRootKey:true});
  cookie=encodeURIComponent(`PUBLIC_CANISTER_ID:records=${fixture.canisterId.toText()}&ic_root_key=${Buffer.from(agent.rootKey!).toString('hex')}`);
});
test.afterAll(async()=>{await pic?.stopLive();await pic?.tearDown();await server?.stop();});

test('private dashboard: sign-in, grant, counters, CSV, retry, restore, revocation and logout races',async({page,context})=>{
  await context.addCookies([{name:'ic_env',value:cookie,url:'http://127.0.0.1:5173'}]);
  await context.addInitScript(()=>{
    if(!sessionStorage.getItem('admin-test-initialized')) {sessionStorage.setItem('garage-test-signed-out','yes');sessionStorage.setItem('admin-test-initialized','yes');}
    // Only II's human popup gesture is replaced; API requests are genuinely signed.
    window.open=(()=>({closed:false})) as unknown as typeof window.open;
  });
  await page.route('**/src/admin/main.ts*',async route=>{
    const response=await route.fetch(),body=await response.text();
    const modified=body.replace(/import \{ AuthClient \} from [^;]+;/,'import { AuthClient } from "/browser-tests/identity-fixture.ts";');
    expect(modified).not.toBe(body);
    // An already-running local Vite may inject its own backend cookie. Select this disposable fixture before app initialization.
    await route.fulfill({response,body:`document.cookie = ${JSON.stringify(`ic_env=${cookie}; Path=/; SameSite=Lax`)};\n${modified}`});
  });
  let fail=false,hold:Promise<void>|undefined,release:()=>void=()=>{};
  const writes:string[]=[],errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/call'))writes.push(path);
    if(hold)await hold;
    if(fail){await route.abort();return;}
    const response=await route.fetch({url:gateway+path});await route.fulfill({response});
  });
  await page.goto('/admin/');await expect(page.locator('#login')).toBeEnabled();await expect(page.locator('#dashboard')).toBeHidden();
  await page.locator('#login').click();await expect(page.locator('#message')).toContainText('does not have statistics access',{timeout:15000});
  await expect(page.locator('#principal')).toHaveValue(reader.getPrincipal().toText());
  unwrap(await admin.setStatisticsReader(reader.getPrincipal(),true));await page.locator('#refresh').click();
  await expect(page.locator('#dashboard')).toBeVisible();await expect(page.locator('#empty')).toBeVisible();await expect(page.locator('#finish-ratio')).toContainText('—');
  // Seed disposable backend events; no gameplay/finish evidence is claimed by this UI fixture.
  records.setIdentity(reader);unwrap(await records.ensureProfile());
  for(let n=1;n<=3;n++)unwrap(await records.gameOpened(new Uint8Array(32).fill(n)));
  const key=new Uint8Array(32).fill(4),ticket=unwrap(await records.beginDelivery(key,'old-road',5n));
  unwrap(await records.beginDelivery(new Uint8Array(32).fill(5),'relay-ridge',4n));
  await new Promise(resolve=>setTimeout(resolve,10000));
  unwrap(await records.completeDelivery(key,ticket.id,10000n));unwrap(await records.claimDelivery(key,ticket.id,false));
  await page.locator('#refresh').click();await expect(page.locator('#opens')).toHaveText('3');await expect(page.locator('#starts')).toHaveText('2');
  await expect(page.locator('#finishes')).toHaveText('1');await expect(page.locator('#saved')).toHaveText('1');await expect(page.locator('#finish-ratio')).toContainText('50.0%');
  await expect(page.locator('#courses tr')).toHaveCount(2);await page.screenshot({path:'test-results/admin-desktop.png',fullPage:true});
  const download=page.waitForEvent('download');await page.locator('#export').click();const file=await download;
  const stream=await file.createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toContain('"3","ALL","","2","1","1"');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/admin-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();await expect(page.locator('#opens')).toHaveText('3');
  fail=true;await page.locator('#refresh').click();await expect(page.locator('#message')).toContainText('Could not load',{timeout:20000});
  await expect(page.locator('#dashboard')).toBeHidden();fail=false;await page.locator('#refresh').click();await expect(page.locator('#opens')).toHaveText('3');
  unwrap(await admin.setStatisticsReader(reader.getPrincipal(),false));await page.locator('#refresh').click();
  await expect(page.locator('#message')).toContainText('does not have statistics access');await expect(page.locator('#export')).toBeHidden();await expect(page.locator('#opens')).toBeEmpty();
  unwrap(await admin.setStatisticsReader(reader.getPrincipal(),true));await page.locator('#refresh').click();await expect(page.locator('#opens')).toHaveText('3');
  hold=new Promise(resolve=>{release=resolve;});await page.locator('#refresh').click();await expect(page.locator('#message')).toContainText('Loading');
  await page.locator('#logout').click();hold=undefined;release();await expect(page.locator('#login')).toBeEnabled();
  await expect(page.locator('#dashboard')).toBeHidden();await expect(page.locator('#opens')).toBeEmpty();
  await page.locator('#login').click();await expect(page.locator('#opens')).toHaveText('3');
  await page.evaluate(()=>sessionStorage.setItem('garage-test-signed-out','yes'));
  await expect(page.locator('#message')).toContainText('Your session has expired');await expect(page.locator('#opens')).toBeEmpty();
  expect(writes).toEqual([]);expect(errors).toEqual([]);
});
