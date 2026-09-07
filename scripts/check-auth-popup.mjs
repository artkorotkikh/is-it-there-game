import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.goto(process.argv[2] ?? 'http://127.0.0.1:5175/');
 await expect(page.locator('#account-toggle')).toBeEnabled({timeout:30000});
 page.on('console',m=>{if(m.type()==='error')console.log('Game console:',m.text());});
 page.on('pageerror',e=>console.log('Game error:',e.message));
 const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('#account-toggle').click()]);
 await popup.waitForURL('https://id.ai/**');
 await popup.waitForLoadState('domcontentloaded');
 await page.waitForTimeout(2500);
 await expect(page.locator('#account-toggle')).toBeDisabled();
 if(popup.isClosed())throw new Error(`Provider closed early: ${await page.locator('#account-feedback').textContent()}`);
 await expect(popup.locator('body')).toContainText('IS IT THERE YET?',{timeout:15000});
 await popup.screenshot({path:'test-results/auth-provider.png',timeout:15000});
 console.log('Internet Identity popup opened:',popup.url());
 await popup.close();
 await expect(page.locator('#account-toggle')).toBeEnabled({timeout:15000});
 await expect(page.locator('#account-message')).toContainText('cancelled');
 await expect(page.locator('#account-feedback')).toBeVisible();
 await expect(page.locator('#account-feedback')).toContainText('cancelled');
 await page.screenshot({path:'test-results/auth-cancelled.png'});
 console.log('Cancellation returned control to the guest game. No identity created.');
} finally {await browser.close();}
