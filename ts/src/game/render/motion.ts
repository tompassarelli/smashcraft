// Presentation between simulation frames (#169). Renderers place moving
// effects once per 60 Hz simulation frame through `place`; on displays faster
// than that, the render-frame hook calls `draw` with how far the game has got
// toward the next simulation frame, and each effect is drawn between where
// the last two frames put it. Nothing here reads or writes simulation state.
//
// Drawn positions trail the simulation by one frame while smoothing is on: a
// frame's position is reached as the next frame begins. An effect that wasn't
// placed on the previous frame, or moved further than SNAP_DISTANCE, is drawn
// where it is placed, so respawns, parking and newly shown effects never glide.

/** A move longer than this in one frame is a teleport, drawn at once. */
export const SNAP_DISTANCE = 512.0;
const SNAP_SQUARED = SNAP_DISTANCE * SNAP_DISTANCE;
/** More tracked effects than a match ever places at once. */
const TRACKED_BOUND = 4096;

export type PositionSetter<Handle> = (handle: Handle, x: number, y: number, z: number) => void;

export class EffectMotion<Handle> {
  private readonly handles: Handle[] = [];
  /** Per tracked handle: from x, y, z, then to x, y, z. */
  private readonly points: number[] = [];
  /** The frame serial each tracked handle was last placed on. */
  private readonly placed: number[] = [];
  private readonly index = new Map<Handle, number>();
  /** Slots placed this frame, in order; `draw` visits only these. */
  private readonly active: number[] = [];
  private activeCount = 0;
  private serial = 0;
  /** Whether paths are kept at all; off (the default), `place` only sets the position. */
  tracking = false;
  /** Whether frames are drawn between simulation frames; off, `place` sets the position directly. */
  smoothing = false;

  constructor(private readonly setPosition: PositionSetter<Handle>) {}

  /** A new simulation frame's placements begin. */
  beginFrame(): void {
    this.serial++;
    this.activeCount = 0;
    // Destroyed effects stay tracked; past the bound every path starts over (one frame drawn without gliding).
    if (this.handles.length > TRACKED_BOUND) {
      this.handles.length = 0;
      this.points.length = 0;
      this.placed.length = 0;
      this.index.clear();
    }
  }

  /** Puts `handle` at this frame's position: drawn there at once, or reached by the next frame while smoothing. */
  place(handle: Handle, x: number, y: number, z: number): void {
    if (!this.tracking) {
      this.setPosition(handle, x, y, z);
      return;
    }
    let slot = this.index.get(handle);
    if (slot === undefined) {
      slot = this.handles.length;
      this.index.set(handle, slot);
      this.handles.push(handle);
      this.placed.push(-1);
      for (let i = 0; i < 6; i++) this.points.push(0.0);
    }
    const base = slot * 6;
    const points = this.points;
    const continuous = this.smoothing && this.placed[slot] === this.serial - 1;
    const toX = points[base + 3] ?? 0.0;
    const toY = points[base + 4] ?? 0.0;
    const toZ = points[base + 5] ?? 0.0;
    const dx = x - toX;
    const dy = y - toY;
    const dz = z - toZ;
    const glide = continuous && dx * dx + dy * dy + dz * dz <= SNAP_SQUARED;
    points[base] = glide ? toX : x;
    points[base + 1] = glide ? toY : y;
    points[base + 2] = glide ? toZ : z;
    points[base + 3] = x;
    points[base + 4] = y;
    points[base + 5] = z;
    if (this.placed[slot] !== this.serial) this.active[this.activeCount++] = slot;
    this.placed[slot] = this.serial;
    this.setPosition(handle, points[base] ?? x, points[base + 1] ?? y, points[base + 2] ?? z);
  }

  /** Forgets `handle`'s path, as it is parked or destroyed: its next placement is drawn at once. */
  release(handle: Handle): void {
    const slot = this.index.get(handle);
    if (slot !== undefined) this.placed[slot] = -1;
  }

  /** Draws every effect placed this frame `alpha` (0 to 1) of the way from its previous position to its current one. */
  draw(alpha: number): void {
    if (!this.smoothing) return;
    const t = alpha < 0.0 ? 0.0 : alpha > 1.0 ? 1.0 : alpha;
    const points = this.points;
    for (let i = 0; i < this.activeCount; i++) {
      const slot = this.active[i] ?? 0;
      if (this.placed[slot] !== this.serial) continue;
      const base = slot * 6;
      const fromX = points[base] ?? 0.0;
      const fromY = points[base + 1] ?? 0.0;
      const fromZ = points[base + 2] ?? 0.0;
      const toX = points[base + 3] ?? 0.0;
      const toY = points[base + 4] ?? 0.0;
      const toZ = points[base + 5] ?? 0.0;
      if (fromX === toX && fromY === toY && fromZ === toZ) continue;
      const handle = this.handles[slot];
      if (handle !== undefined) this.setPosition(handle, fromX + (toX - fromX) * t, fromY + (toY - fromY) * t, fromZ + (toZ - fromZ) * t);
    }
  }
}
