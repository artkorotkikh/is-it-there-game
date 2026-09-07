import {chromium,expect} from '@playwright/test';

// Published expedition startup only. No account, room or activity-counter writes.
const base=new URL(process.argv[2]??'https://isitthereyet.nano-tema--0v1.opencloud.org/');
base.search='?mode=expedition';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],updates=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(/\/api\/v[23]\/canister\/[^/]+\/call$/.test(new URL(request.url()).pathname))updates.push(request.url());});
try{
  await page.goto(base.href);
  await expect(page.locator('#exp-host')).toBeEnabled({timeout:30000});
  await expect(page.locator('#exp-explore')).toBeEnabled();
  await expect(page.locator('#account-toggle')).toContainText('Sign in');
  await expect(page.locator('#exp-join-form')).toBeVisible();
  await page.screenshot({path:'test-results/public-expedition-menu.png'});
  await page.locator('#exp-explore').click();await expect(page.locator('#exp-hud')).toBeVisible();
  await expect(page.locator('#exp-systems')).toContainText('3/3');
  await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.up('KeyW');
  await page.locator('#exp-pause-button').click();await expect(page.locator('#exp-pause')).toBeVisible();
  await page.locator('#exp-resume').click();await expect(page.locator('#exp-hud')).toBeVisible();
  await page.screenshot({path:'test-results/public-expedition-explore.png'});
  expect(await page.evaluate(()=>('__expeditionDebug' in window)||('__rvDebug' in window))).toBe(false);
  expect(errors).toEqual([]);expect(updates).toEqual([]);
  console.log(JSON.stringify({url:base.href,result:'passed',mode:'guest expedition startup',roomButtons:'wired',pause:'passed',productionUpdateCalls:updates.length}));
}finally{await browser.close();}
