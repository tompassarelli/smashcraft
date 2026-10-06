// Training's hit areas (#120) drawn as outlines on the fighter's plane: body
// parts green, protected parts blue, strikes red, after Rivals of Aether II.
// The lightning is created with the fighter's renderers at a synchronized
// match start and only moved while presenting.
import { f32 } from "wisp/src/sim/f32";
import type { Capsule } from "../physics/contactGeometry";
import { HitAreaKind, type HitAreaList, collectHitAreas, createHitAreaList } from "../presentation/hitAreas";
import type { Fighter } from "../sim/fighter";
import type { WorldOrigin } from "./effects";

/** Shapes drawn per fighter; a fighter's parts and strikes beyond these go undrawn. */
const MAX_SHAPES = 16;
/** Each end of a capsule is a half circle of this many segments. */
const ARC_SEGMENTS = 4;
const SEGMENTS_PER_SHAPE = 2 + 2 * ARC_SEGMENTS;
const LIGHTNING = "LEAS";
/** In front of the fighter's model, toward the camera. */
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

  /** The capsule's outline: two sides and a half circle at each end. */
  private outline(first: number, c: Readonly<Capsule>, kind: HitAreaKind): number {
    const dx = c.x2 - c.x1;
    const dz = c.z2 - c.z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const ux = length > f32(0.001) ? dx / length : 1.0;
    const uz = length > f32(0.001) ? dz / length : 0.0;
    const nx = -uz * c.radius;
    const nz = ux * c.radius;
    let segment = this.draw(first, c.x1 + nx, c.z1 + nz, c.x2 + nx, c.z2 + nz, kind);
    segment = this.draw(segment, c.x1 - nx, c.z1 - nz, c.x2 - nx, c.z2 - nz, kind);
    const start = Math.atan2(nz, nx);
    segment = this.arc(segment, c.x2, c.z2, c.radius, start, -1.0, kind);
    return this.arc(segment, c.x1, c.z1, c.radius, start, 1.0, kind);
  }

  /** A half circle from `start`, turning by `turn` (1 counterclockwise, -1 clockwise). */
  private arc(first: number, cx: number, cz: number, radius: number, start: number, turn: number, kind: HitAreaKind): number {
    let segment = first;
    for (let step = 0; step < ARC_SEGMENTS; step++) {
      const a = start + turn * Math.PI * step / ARC_SEGMENTS;
      const b = start + turn * Math.PI * (step + 1) / ARC_SEGMENTS;
      segment = this.draw(segment, cx + radius * Math.cos(a), cz + radius * Math.sin(a), cx + radius * Math.cos(b), cz + radius * Math.sin(b), kind);
    }
    return segment;
  }
}
