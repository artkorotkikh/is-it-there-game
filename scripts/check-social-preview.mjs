import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:4173/');
const canonical = 'https://isitthereyet.nano-tema--0v1.opencloud.org/';
const imagePath = 'social/road-trip-v1.png';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
// Parse only the static head delivered over HTTP; no JS execution or authenticated session.
function metadata(html) {
  const head = html.match(/<head>[\s\S]*?<\/head>/i)?.[0];assert.ok(head,'Missing static head');
  const values = new Map();
  for(const tag of head.matchAll(/<(?:meta|link)\s+[^>]+>/gi)) {
    const attrs=Object.fromEntries([...tag[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
    const key=attrs.property??attrs.name??(attrs.rel==='canonical'?'canonical':undefined);
    if(key){assert.ok(!values.has(key),`Duplicate ${key}`);values.set(key,attrs.content??attrs.href);}
  }
  return values;
}
const results=[];
for(const [crawler,userAgent]of [['browser','Mozilla/5.0'],['Facebook','facebookexternalhit/1.1'],['X','Twitterbot/1.0'],['Telegram','TelegramBot (like TwitterBot)']]) {
  const r=await fetch(base,{headers:{'user-agent':userAgent}});assert.equal(r.status,200);assert.match(r.headers.get('content-type')??'',/text\/html/);
  assert.doesNotMatch(r.headers.get('x-robots-tag')??'',/noindex|noimageindex|none/i);
  const html=await r.text(),m=metadata(html);
  assert.equal(hash(html),hash(readFileSync('dist/index.html')),'Published HTML differs from build');
  assert.ok(m.get('description')?.length>50);assert.equal(m.get('og:description'),m.get('description'));assert.equal(m.get('twitter:description'),m.get('description'));
  assert.equal(m.get('og:type'),'website');assert.equal(m.get('og:title'),'IS IT THERE YET?');assert.equal(m.get('twitter:title'),m.get('og:title'));
  assert.equal(m.get('canonical'),canonical);assert.equal(m.get('og:url'),canonical);
  assert.equal(m.get('og:image'),new URL(imagePath,canonical).href);assert.equal(m.get('twitter:image'),m.get('og:image'));
  assert.equal(m.get('og:image:type'),'image/png');assert.equal(m.get('og:image:width'),'1200');assert.equal(m.get('og:image:height'),'630');
  assert.ok(m.get('og:image:alt'));assert.equal(m.get('twitter:image:alt'),m.get('og:image:alt'));assert.equal(m.get('twitter:card'),'summary_large_image');
  // Local preview checks its own image; public runs fetch the exact absolute OG URL.
  const imageUrl=base.protocol==='https:'?m.get('og:image'):new URL(imagePath,base);
  const image=await fetch(imageUrl,{headers:{'user-agent':userAgent}});assert.equal(image.status,200);assert.match(image.headers.get('content-type')??'',/image\/png/);
  const png=Buffer.from(await image.arrayBuffer());assert.equal(hash(png),hash(readFileSync(`dist/${imagePath}`)));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);assert.ok(png.length<5_000_000);
  results.push({crawler,html:r.status,image:image.status,dimensions:'1200×630',bytes:png.length});
}
console.log(JSON.stringify({url:base.href,result:'passed',canonical,image:new URL(imagePath,canonical).href,results},null,2));
