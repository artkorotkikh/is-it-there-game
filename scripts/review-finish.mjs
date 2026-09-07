import { chromium, expect } from '@playwright/test';
// Presentation fixture only. No physics, account, timer or record API is changed.
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  for (const [name,width,height,touch] of [['desktop',1440,900,false],['portrait',390,844,true],['landscape',844,390,true]]) {
    const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.argv[2] ?? 'http://127.0.0.1:4173/');
    await expect(page.locator('#start')).toBeEnabled();
    await page.evaluate(()=>{
      for(const id of ['menu','postcard','menu-footer'])document.getElementById(id).classList.add('hidden');
      document.getElementById('finish').classList.remove('hidden');
      document.getElementById('finish-time').textContent='Finality quarry · 4:32.18';
      document.getElementById('save-status').textContent='Guest delivery. Sign in before your next run to keep its time.';
    });
    const link=page.getByRole('link',{name:'Apply at OpenCloud.org'});
    await expect(page.locator('.finish-credits')).toContainText('Built with GPT Astra.');
    await expect(page.locator('.finish-credits')).toContainText('Deployed on OpenCloud.');
    await expect(link).toHaveAttribute('href','https://opencloud.org/');
    await expect(link).toHaveAttribute('target','_blank');
    await expect(link).toHaveAttribute('rel','noopener noreferrer');
    await link.scrollIntoViewIfNeeded();
    const box=await link.boundingBox();
    if(!box || box.height<44 || box.x<0 || box.x+box.width>width || box.y<0 || box.y+box.height>height)throw new Error(`${name}: CTA is not reachable`);
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error(`${name}: horizontal overflow`);
    await link.focus();await page.screenshot({path:`test-results/finish-credits-${name}.png`});
    await page.locator('#finish-menu').scrollIntoViewIfNeeded();await page.locator('#finish-menu').click();
    await expect(page.locator('#menu')).toBeVisible();
    if(errors.length)throw new Error(errors.join('\n'));
    console.log(`${name}: finish copy/link, reachability, return-to-title and runtime checks passed (presentation fixture)`);
    await page.close();
  }
} finally {await browser.close();}
