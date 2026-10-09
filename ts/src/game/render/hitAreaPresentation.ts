



import { f32 } from "wisp/src/sim/f32";
import type { Capsule } from "../physics/contactGeometry";
import { HitAreaKind, type HitAreaList, collectHitAreas, createHitAreaList } from "../presentation/hitAreas";
import type { Fighter } from "../sim/fighter";
import { cosineTurns, sineTurns } from "../sim/mathTables";
import { squareRoot } from "../sim/warcraftMath";
import type { WorldOrigin } from "./effects";


const MAX_SHAPES = 16;

const ARC_SEGMENTS = 4;
const SEGMENTS_PER_SHAPE = 2 + 2 * ARC_SEGMENTS;
const LIGHTNING = "LEAS";

const DEPTH = -60.0;

export class HitAreaPresentation {
  private readonly lines: lightning[] = [];
  private readonly list: HitAreaList = createHitAreaList();
  private drawnSegments = 0;

  constructor(private readonly origin: WorldOrigin) {
    for (let index = 0; index < MAX_SHAPES * SEGMENTS_PER_SHAPE; index++) {
      const line = AddLightningEx(LIGHTNING, false, origin.x, origin.y, origin.z - 4096.0, origin.x, origin.y, origin.z - 4096.0);
      SetLightningColor(line, 1.0, 1.0, 1.0, 0.0);
      this.lines.push(line);
    }
  }

  destroy(): void {
    for (const line of this.lines) DestroyLightning(line);
    this.lines.length = 0;
  }

  present(fighter: Readonly<Fighter> | undefined): void {
    let segment = 0;
    if (fighter !== undefined) {
      collectHitAreas(fighter, this.list);
      const shapes = Math.min(this.list.count, MAX_SHAPES);
      for (let index = 0; index < shapes; index++) {
        const area = this.list.areas[index];
        if (area !== undefined) segment = this.outline(segment, area.capsule, area.kind);
      }
    }
    for (let index = segment; index < this.drawnSegments; index++) {
      const line = this.lines[index];
      if (line !== undefined) SetLightningColor(line, 1.0, 1.0, 1.0, 0.0);
    }
    this.drawnSegments = segment;
  }

  private draw(segment: number, x1: number, z1: number, x2: number, z2: number, kind: HitAreaKind): number {
    const line = this.lines[segment];
    if (line === undefined) return segment;
    const { x, y, z } = this.origin;
    MoveLightningEx(line, false, x + x1, y + DEPTH, z + z1, x + x2, y + DEPTH, z + z2);
    if (kind === HitAreaKind.strike) SetLightningColor(line, 1.0, f32(0.2), f32(0.2), 1.0);
    else if (kind === HitAreaKind.protected) SetLightningColor(line, f32(0.3), f32(0.6), 1.0, 1.0);
    else SetLightningColor(line, f32(0.3), 1.0, f32(0.3), 1.0);
    return segment + 1;
  }


  private outline(first: number, c: Readonly<Capsule>, kind: HitAreaKind): number {
    const dx = c.x2 - c.x1;
    const dz = c.z2 - c.z1;
    const length = squareRoot(f32(f32(dx * dx) + f32(dz * dz)));
    const ux = length > f32(0.001) ? dx / length : 1.0;
    const uz = length > f32(0.001) ? dz / length : 0.0;
    const nx = -uz * c.radius;
    const nz = ux * c.radius;
    let segment = this.draw(first, c.x1 + nx, c.z1 + nz, c.x2 + nx, c.z2 + nz, kind);
    segment = this.draw(segment, c.x1 - nx, c.z1 - nz, c.x2 - nx, c.z2 - nz, kind);
    segment = this.arc(segment, c.x2, c.z2, nx, nz, -1.0, kind);
    return this.arc(segment, c.x1, c.z1, nx, nz, 1.0, kind);
  }


  private arc(first: number, cx: number, cz: number, nx: number, nz: number, turn: number, kind: HitAreaKind): number {
    let segment = first;
    let previousX = nx;
    let previousZ = nz;
    for (let step = 1; step <= ARC_SEGMENTS; step++) {
      const turns = f32(f32(step) / f32(2 * ARC_SEGMENTS));
      const cosine = cosineTurns(turns);
      const sine = turn * sineTurns(turns);
      const x = f32(f32(nx * cosine) - f32(nz * sine));
      const z = f32(f32(nz * cosine) + f32(nx * sine));
      segment = this.draw(segment, cx + previousX, cz + previousZ, cx + x, cz + z, kind);
      previousX = x;
      previousZ = z;
    }
    return segment;
  }
}
