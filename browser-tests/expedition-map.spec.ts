import {test,expect} from '@playwright/test';

test('extended Forest Crossing renders its new obstacles, hollows, anchors and finish',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  // Visual inspection fixture: the real map and renderer, with a survey camera.
  // Route completion and winch recovery are exercised by physical simulation tests.
  await page.route('**/__map-review',route=>route.fulfill({contentType:'text/html',body:'<style>body{margin:0}canvas{display:block}</style><canvas id="scene"></canvas>'}));
  await page.goto('/__map-review');
  const map=await page.evaluate(async()=>{
    const simulationPath='/src/game/simulation.ts',rendererPath='/src/game/renderer.ts',catalogPath='/src/game/maps/catalog.ts';
    const [{Simulation,initPhysics},{Renderer},{expeditionMaps,mapTrack}]=await Promise.all([import(simulationPath),import(rendererPath),import(catalogPath)]);
    await initPhysics();const map=expeditionMaps.find((map:{id:string})=>map.id==='forest-crossing'),track=mapTrack(map);
    const simulation=new Simulation('road',track);for(let i=0;i<60;i++)simulation.step();
    const renderer=new Renderer(document.querySelector('canvas')!);renderer.setTrack(track);
    const snapshot=simulation.snapshot();renderer.draw(snapshot,snapshot,1,0,.6,false,1/60);
    renderer.app.scene.fog.type='none';
    const camera=renderer.app.root.findByName('Camera');camera.camera.projection=1;camera.camera.orthoHeight=106;
    camera.setPosition(102,200,13);camera.lookAt(0,5,85);
    Object.assign(window,{mapReview:{renderer,simulation,camera}});
    return {finish:map.finish,resources:map.resources.length,anchors:map.anchors.length};
  });
  expect(map.finish.z).toBe(170);expect(map.resources).toBe(17);expect(map.anchors).toBe(30);
  await page.waitForTimeout(500);await page.screenshot({path:'test-results/expedition-map-overview.png'});
  for(const [name,x,z] of [['bridge',0,43],['left',-18,98],['center',0,112],['right',18,124]] as const){
    await page.evaluate(({x,z})=>{
      const {camera}= (window as unknown as {mapReview:{camera:{camera:{orthoHeight:number};setPosition:(x:number,y:number,z:number)=>void;lookAt:(x:number,y:number,z:number)=>void}}}).mapReview;
      camera.camera.orthoHeight=25;camera.setPosition(x+28,40,z-25);camera.lookAt(x,6,z);
    },{x,z});
    await page.waitForTimeout(250);await page.screenshot({path:`test-results/expedition-map-${name}.png`});
  }
  expect(errors).toEqual([]);
});
