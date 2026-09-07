import * as pc from 'playcanvas';
import { config } from './config';
import type { Vec3 } from './types';

/** A continuous low-poly tube, in one draw call even when slack has many bends. */
export class CableVisual {
  readonly entity: pc.Entity;
  private readonly mesh: pc.Mesh;
  private pointCount = 0;

  constructor(app: pc.Application, material: pc.StandardMaterial) {
    this.mesh = new pc.Mesh(app.graphicsDevice);
    this.entity = new pc.Entity('Winch cable', app);
    this.entity.enabled = false;
    this.entity.addComponent('render', { meshInstances: [new pc.MeshInstance(this.mesh, material)], castShadows: false });
    app.root.addChild(this.entity);
  }

  update(points: Vec3[]) {
    const sides = 6;
    const positions: number[] = [];
    const normals: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[Math.max(0, i - 1)];
      const b = points[Math.min(points.length - 1, i + 1)];
      const tangent = new pc.Vec3(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
      const right = Math.hypot(tangent.x, tangent.z) > 0.001 ? new pc.Vec3(-tangent.z, 0, tangent.x).normalize() : new pc.Vec3(1, 0, 0);
      const up = new pc.Vec3().cross(tangent, right).normalize();
      for (let side = 0; side < sides; side++) {
        const angle = side / sides * Math.PI * 2;
        const n = right.clone().mulScalar(Math.cos(angle)).add(up.clone().mulScalar(Math.sin(angle)));
        normals.push(n.x, n.y, n.z);
        positions.push(points[i].x + n.x * config.winch.radius, points[i].y + n.y * config.winch.radius, points[i].z + n.z * config.winch.radius);
      }
    }
    this.mesh.setPositions(positions);
    this.mesh.setNormals(normals);
    if (this.pointCount !== points.length) {
      const indices: number[] = [];
      for (let i = 0; i < points.length - 1; i++) for (let side = 0; side < sides; side++) {
        const a = i * sides + side;
        const b = i * sides + (side + 1) % sides;
        indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
      this.mesh.setIndices(indices);
      this.pointCount = points.length;
    }
    this.mesh.update();
  }
}
