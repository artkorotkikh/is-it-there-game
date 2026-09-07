import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// Capture the actual procedural title scene, with a dedicated DOM card layout.
// This is an offline asset tool: it never starts a run or changes game physics.
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:4173/');
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base.href);await expect(page.locator('#start')).toBeEnabled();
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:`
    #app { display:none !important; }
    #game { transform:translateX(170px) scale(1.45); transform-origin:68% 62%; }
    #social-card { position:fixed; inset:0; z-index:100; color:#f5efd9;
      background:linear-gradient(90deg,#172e28f5 0%,#172e28df 34%,#172e2870 57%,transparent 80%);
      font-family:Arial,Helvetica,sans-serif; padding:48px 54px; }
    .social-brand { display:flex; align-items:center; gap:14px; font-size:12px; font-weight:700; letter-spacing:2px; }
    .social-brand img { width:40px; height:40px; }
    .social-eyebrow { margin-top:57px; color:#edbd7c; font-size:12px; font-weight:700; letter-spacing:3px; }
    #social-card h1 { margin:20px 0 25px; font-family:Arial,Helvetica,sans-serif; font-size:86px;
      line-height:.97; letter-spacing:-4px; font-weight:900; max-width:660px; }
    #social-card h1 span { color:#edbd7c; }
    .social-copy { font-size:23px; line-height:1.5; color:#e1e3d1; margin:0; max-width:510px; }
    .social-footer { position:absolute; bottom:46px; left:54px; right:54px; display:flex; justify-content:space-between;
      align-items:center; font-size:11px; font-weight:700; letter-spacing:1.8px; }
    .social-footer span:last-child { padding:12px 16px; border-radius:4px; color:#203a32; background:#edbd7c; }
  `});
  await page.evaluate(()=>{
    const card=document.createElement('div');card.id='social-card';
    card.innerHTML=`<div class="social-brand"><img src="/favicon.svg?v=0.4.3" alt="">PROBABLY WORKS / DELIVERY DEPARTMENT</div>
      <div class="social-eyebrow">THREE CANISTERS. ONE QUESTION.</div>
      <h1>IS IT<br>THERE YET<span>?</span></h1>
      <p class="social-copy">An app on wheels. A few loose canisters.<br>Try to ship it in one piece.</p>
      <div class="social-footer"><span>A PHYSICS ROAD TRIP · POWERED BY ICP</span><span>PLAY IN YOUR BROWSER ↗</span></div>`;
    document.body.append(card);
  });
  await expect(page.locator('#social-card img')).toHaveJSProperty('naturalWidth',64);
  await page.waitForTimeout(250);
  if(errors.length)throw new Error(errors.join('\n'));
  await mkdir('public/social',{recursive:true});
  await page.screenshot({path:'public/social/road-trip-v1.png'});
  console.log('Captured public/social/road-trip-v1.png (1200×630), from the actual title scene.');
} finally {await browser.close();}
