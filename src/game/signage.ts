import * as pc from 'playcanvas';
import { decalFor, defaultSkin } from './skin';

/** Locally drawn lettering on real scene surfaces. No downloaded fonts or images. */
export class Signage {
  private cache = new Map<string, pc.StandardMaterial>();
  constructor(private app: pc.Application) {}

  label(lines: string[], width: number, height: number, position: number[], parent: pc.Entity, background = '#e9ddbb', foreground = '#293e3b') {
    const key = JSON.stringify([lines, width / height, background, foreground]);
    return this.surface(lines.join(' '), key, width, height, position, parent, (ctx, w, h) => {
      ctx.fillStyle = background; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = foreground; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lineHeight = h / (lines.length + .35);
      lines.forEach((line, i) => {
        ctx.font = `900 ${Math.min(lineHeight * .67, w / Math.max(3, line.length) * 1.32)}px Arial, sans-serif`;
        ctx.fillText(line, w / 2, (i + .68) * lineHeight, w * .9);
      });
    });
  }

  /** Painted app-window livery; its eternal 99% is a joke, not run progress. */
  appWindow(width: number, height: number, position: number[], parent: pc.Entity, decal = 'probably') {
    const style = decalFor({...defaultSkin,decal});
    return this.surface('Probably Works app window', `app-window:${decal}:${width / height}`, width, height, position, parent, (ctx, w, h) => {
      ctx.fillStyle = '#284641'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#d7cfaf'; ctx.fillRect(0, 0, w, h * .14);
      for (const [i, color] of ['#b86f55', '#cba85b', '#739683'].entries()) {
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(28 + i * 27, h * .07, 7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#40594d'; ctx.font = '600 18px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('probably.works / app', w - 24, h * .073);
      ctx.textAlign = 'center'; ctx.fillStyle = '#f0e3bc';
      ctx.font = `900 ${Math.min(65, h * .19)}px Arial, sans-serif`;
      ctx.fillText(style.title, w / 2, h * .34, w * .9);
      ctx.font = `500 ${Math.min(28, h * .075)}px Arial, sans-serif`;
      ctx.fillStyle = '#cad2b4'; ctx.fillText(style.subtitle, w / 2, h * .50);
      ctx.textAlign = 'left'; ctx.font = `700 ${Math.min(21, h * .065)}px monospace`;
      ctx.fillText('SHIPPING…', w * .065, h * .66);
      ctx.textAlign = 'right'; ctx.fillStyle = '#efbd73'; ctx.fillText('99%', w * .935, h * .66);
      ctx.fillStyle = '#51695a'; ctx.fillRect(w * .065, h * .73, w * .87, h * .065);
      ctx.fillStyle = '#efbd73'; ctx.fillRect(w * .065, h * .73, w * .87 * .99, h * .065);
      ctx.textAlign = 'center'; ctx.font = `600 ${Math.min(18, h * .055)}px monospace`;
      ctx.fillStyle = '#abbca5'; ctx.fillText(style.footer, w / 2, h * .9);
    });
  }

  private surface(name: string, key: string, width: number, height: number, position: number[], parent: pc.Entity, paint: (ctx: CanvasRenderingContext2D, width: number, height: number) => void) {
    let material = this.cache.get(key);
    if (!material) {
      const canvas = document.createElement('canvas');
      canvas.width = 768; canvas.height = Math.round(768 * height / width);
      const ctx = canvas.getContext('2d')!;
      paint(ctx, canvas.width, canvas.height);
      const texture = new pc.Texture(this.app.graphicsDevice, { name, width: canvas.width, height: canvas.height, mipmaps: true });
      texture.setSource(canvas);
      material = new pc.StandardMaterial(); material.diffuseMap = texture;
      material.emissiveMap = texture; material.emissive = new pc.Color(.16, .16, .16);
      material.gloss = .05; material.cull = pc.CULLFACE_NONE; material.update();
      this.cache.set(key, material);
    }
    const mesh = new pc.Mesh(this.app.graphicsDevice);
    mesh.setPositions([width / 2, -height / 2, 0, -width / 2, -height / 2, 0, -width / 2, height / 2, 0, width / 2, height / 2, 0]);
    mesh.setNormals([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
    mesh.setUvs(0, [0, 1, 1, 1, 1, 0, 0, 0]); mesh.setIndices([0, 1, 2, 0, 2, 3]); mesh.update();
    const e = new pc.Entity(name, this.app);
    e.addComponent('render', { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: false });
    parent.addChild(e); e.setLocalPosition(position[0], position[1], position[2]);
    return e;
  }
}
