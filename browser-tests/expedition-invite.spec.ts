import {test,expect,type Page} from '@playwright/test';
import type {Snapshot} from '../src/game/types';
import {expeditionAccount} from './expedition-account-fixture';
const state=(page:Page)=>page.evaluate(()=>(window as unknown as {__expeditionDebug:{team:string;roomCode:string;snapshot:Snapshot}}).__expeditionDebug);

test('account-gated invite preserves its room; two distinct accounts start together',async({page,browser})=>{
  test.skip(process.env.ICP_LOCAL_BACKEND!=='1','Requires local rooms canister.');
  test.setTimeout(180_000);
  const guestContext=await browser.newContext({viewport:{width:900,height:900}}),guest=await guestContext.newPage(),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));guest.on('pageerror',e=>errors.push(e.message));
  try{
    await expeditionAccount(page,71,true);await expeditionAccount(guest,72,true);
    for(const surface of [page,guest]){
      await surface.context().route('https://id.ai/**',route=>route.fulfill({body:'Test identity gesture substituted.'}));
      surface.on('popup',popup=>void popup.close());
    }
    await page.goto('/?mode=expedition');await expect(page.locator('#exp-host')).toBeEnabled();
    await page.locator('#exp-explore').click();await expect(page.locator('#exp-hud')).toBeVisible();
    await page.locator('#exp-pause-button').click();await page.locator('#exp-leave').click();
    await expect(page.locator('#exp-map-picker')).toBeHidden();await expect(page.locator('#exp-code')).toBeVisible();
    await page.screenshot({path:'/private/tmp/expedition-simplified-menu.png'});
    await page.locator('#exp-host').click();await expect(page.locator('#exp-signin')).toBeVisible();
    expect((await state(page)).roomCode).toBe('');await expect(page.locator('#exp-copy')).toBeHidden();
    await page.locator('#exp-signin').click();await expect(page.locator('#exp-copy')).toBeEnabled({timeout:30000});
    const hostName=(await page.locator('#account-toggle').innerText()).replace(/ ↗$/,'');
    const invite=await page.locator('#exp-invite').inputValue(),code=new URL(invite).searchParams.get('room');
    expect(new URL(page.url()).searchParams.has('room')).toBe(false);
    await expect(page.locator('#exp-lobby-title')).toHaveText('Invite your teammate.');
    await page.screenshot({path:'/private/tmp/expedition-host-invite.png'});
    // A second window with the host's account must not consume or delete the invite.
    const selfContext=await browser.newContext(),self=await selfContext.newPage();
    try{
      await expeditionAccount(self,71);await self.goto(invite);
      await expect(self.locator('#exp-lobby-status')).toContainText('different account',{timeout:30000});
      await expect(page.locator('#exp-copy')).toBeEnabled();
    }finally{await selfContext.close();}
    // Opening the invite leads to sign-in, then automatically joins the same room.
    await guest.goto(invite);
    await expect(guest.locator('#exp-lobby-role')).toHaveText('ROAD CREW / YOU ARE JOINING',{timeout:20000});
    await expect(guest.locator('#exp-host')).toBeHidden();await expect(guest.locator('#exp-share')).toBeHidden();
    await expect(guest.locator('#exp-signin')).toBeEnabled();
    await expect(guest.locator('#exp-lobby-title')).toHaveText('Sign in to join.');
    await guest.screenshot({path:'/private/tmp/expedition-invite-signin.png'});
    await guest.evaluate(()=>sessionStorage.setItem('finish-test-cancel','yes'));
    await guest.locator('#exp-signin').click();await expect(guest.locator('#exp-lobby-status')).toContainText('cancelled');
    expect(new URL(guest.url()).searchParams.get('room')).toBe(code);expect((await state(guest)).roomCode).toBe('');
    await guest.locator('#exp-signin').click();await expect(guest.locator('#exp-ready')).toBeEnabled({timeout:40000});
    const guestName=(await guest.locator('#account-toggle').innerText()).replace(/ ↗$/,'');
    for(const surface of [page,guest]){await expect(surface.locator('#exp-crew')).toContainText(hostName);await expect(surface.locator('#exp-crew')).toContainText(guestName);}
    expect((await state(guest)).team).toBe('guest');expect((await state(guest)).roomCode).toBe(code);expect((await state(page)).roomCode).toBe(code);
    await expect(page.locator('#exp-ready')).toBeDisabled();await expect(page.locator('#exp-share')).toBeHidden();
    await guest.screenshot({path:'/private/tmp/expedition-guest-ready.png'});
    await guest.locator('#exp-ready').click();await expect(page.locator('#exp-ready')).toBeEnabled();await page.locator('#exp-ready').click();
    await expect(page.locator('#exp-hud')).toBeVisible();await expect(guest.locator('#exp-hud')).toBeVisible();
    await guest.keyboard.press('KeyT');await expect.poll(async()=>(await state(page)).snapshot.fieldKit!.ping).not.toBeNull();
    await guest.locator('#exp-pause-button').click();await expect(page.locator('#exp-pause')).toBeVisible();await guest.locator('#exp-leave').click();
    expect(new URL(guest.url()).searchParams.has('room')).toBe(false);await expect(guest.locator('#exp-host')).toBeVisible();
    // Restoring a saved account does not ask for another human sign-in.
    await guest.reload();await expect(guest.locator('#exp-host')).toBeEnabled({timeout:30000});
    await expect(guest.locator('#account-toggle')).toHaveText(`${guestName} ↗`);
    // Invalid links stay in guest/error flow instead of offering Create a team.
    await guest.goto('/?mode=expedition&room=bad-code');await expect(guest.locator('#exp-lobby-title')).toHaveText('Couldn’t connect.',{timeout:20000});await expect(guest.locator('#exp-host')).toBeHidden();
    await guest.locator('#exp-cancel').click();expect(new URL(guest.url()).searchParams.has('room')).toBe(false);
    // Pasting remains available on demand and submitting with Enter works.
    await guest.locator('#exp-code').fill('not-an-invite');await guest.locator('#exp-code').press('Enter');await expect(guest.locator('#exp-lobby-title')).toHaveText('Couldn’t connect.',{timeout:20000});
    await guest.locator('#exp-cancel').click();await guest.setViewportSize({width:390,height:844});await guest.screenshot({path:'/private/tmp/expedition-simplified-phone.png'});
    expect(errors).toEqual([]);
  }finally{await guestContext.close();}
});
