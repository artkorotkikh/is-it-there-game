import {chromium,expect} from '@playwright/test';
const url=process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  for(const viewport of [{width:390,height:844},{width:844,height:390}]) {
    const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:2});const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    try {
      await page.goto(url);await expect(page.locator('#start')).toBeEnabled();
      if(await page.evaluate(()=>'__rvDebug' in window))throw new Error('Production must not expose diagnostics');
      await page.locator('#start').tap();await page.locator('#pause-button').tap();await page.locator('#recovery').tap();await expect(page.locator('#touch-controls')).toBeVisible();
      await page.locator('#touch-KeyE').tap();await expect(page.locator('#role')).toHaveText('AT THE WHEEL');
      const cdp=await context.newCDPSession(page),r=await page.locator('#touch-stick').boundingBox();
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:r.x+r.width/2,y:r.y+r.height*.18}]});
      await expect.poll(async()=>Number(await page.locator('#speed').textContent()),{timeout:15000}).toBeGreaterThan(2);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      const brake=await page.locator('#touch-Space').boundingBox();
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:2,x:brake.x+brake.width/2,y:brake.y+brake.height/2}]});
      await expect(page.locator('#speed')).toHaveText('0',{timeout:15000});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.screenshot({path:`test-results/public-phone-${viewport.width}.png`});
      await page.locator('#pause-button').tap();await expect(page.locator('#touch-controls')).toBeHidden();
      await page.locator('#pause-effects').tap();await expect(page.locator('#pause-effects')).toHaveAttribute('aria-pressed','false');
      await page.locator('#resume').tap();await expect(page.locator('#touch-controls')).toBeVisible();
      expect(errors).toEqual([]);console.log(JSON.stringify({url,viewport,result:'passed',flow:'touch practice, enter, drive, brake, pause, mute, resume',errors}));
    }finally{await context.close();}
  }
}finally{await browser.close();}
