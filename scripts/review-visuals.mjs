import {chromium, expect} from '@playwright/test';
const url = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  for (const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:844,height:390}]) {
    const touch = viewport.width < 1000;
    const context = await browser.newContext({viewport,hasTouch:touch,isMobile:touch});
    const page = await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(url);
      await expect(page).toHaveTitle('IS IT THERE YET?');
      await expect(page.locator('#start')).toBeEnabled();
      await expect(page.locator('h1')).toHaveText('IS ITTHERE YET?');
      await expect(page.locator('#menu .menu-actions button')).toHaveCount(1);
      await expect(page.locator('#recovery')).toBeHidden();
      await expect(page.locator('.coming-next')).toHaveCount(0);
      await expect(page.getByRole('link',{name:'Co-op',exact:true})).toBeVisible();
      await expect(page.locator('.app-logo')).toHaveJSProperty('naturalWidth',64);
      await expect(page.locator('.finish-credits')).toContainText('Built with GPT Astra.');
      await expect(page.locator('.finish-cloud-link')).toHaveAttribute('href','https://opencloud.org/');
      if (!touch) await expect(page.locator('#postcard')).toContainText('CANISTERS CARGO');
      await page.screenshot({path:`test-results/identity-title-${viewport.width}.png`});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      if(touch) await page.locator('#start').tap();
      else {await page.locator('#start').focus();await page.keyboard.press('Enter');}
      await expect(page.locator('#pause-button')).toBeVisible();
      await expect(page.locator('.coming-next')).toHaveCount(0);
      await page.waitForTimeout(800);
      if (!touch) {
        // Orbit using the actual camera input to expose both the character and bus livery.
        await page.mouse.move(850,450);await page.mouse.down();await page.mouse.move(1090,425,{steps:12});await page.mouse.up();
        await page.waitForTimeout(500);
      }
      await page.screenshot({path:`test-results/identity-character-${viewport.width}.png`});
      await page.locator('#pause-button').click();
      await page.locator('#recovery').scrollIntoViewIfNeeded();
      await page.screenshot({path:`test-results/identity-practice-${viewport.width}.png`});
      await page.locator('#recovery').click();
      await expect(page.locator('#run-timer')).toContainText('PRACTICE');
      for(const type of ['winch','cycles','skills']) await expect(page.locator(`#module-state-${type}`)).toHaveText('ONLINE');
      await page.locator('#pause-button').click();await page.locator('#back-menu').click();
      await expect(page.locator('#menu')).toBeVisible();
      expect(errors).toEqual([]);
      console.log(JSON.stringify({viewport,render:'passed',flow:'one title launch, logo, upcoming co-op, keyboard/touch start, pause practice, return to title',errors}));
    } finally {await context.close();}
  }
} finally {await browser.close();}
