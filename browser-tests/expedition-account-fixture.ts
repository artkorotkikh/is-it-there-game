import {expect,type Page} from '@playwright/test';

/** Substitute only the human II gesture; room/profile calls remain signed against local ICP. */
export async function expeditionAccount(page:Page,seed:number,signedOut=false){
  await page.addInitScript(({seed,signedOut})=>{
    if(!sessionStorage.getItem('test-identity-seed')){
      sessionStorage.setItem('test-identity-seed',String(seed));
      if(signedOut)sessionStorage.setItem('garage-test-signed-out','yes');
    }
  },{seed,signedOut});
  await page.route('**/src/services/account.ts*',async route=>{
    const response=await route.fetch(),body=await response.text();
    const modified=body.replace(/import \{ AuthClient \} from [^;]+;/,'import { AuthClient } from "/browser-tests/identity-fixture.ts";');
    expect(modified).not.toBe(body);await route.fulfill({response,body:modified});
  });
}
