











const SNAP_DISTANCE = 512.0;
const SNAP_SQUARED = SNAP_DISTANCE * SNAP_DISTANCE;

const TRACKED_BOUND = 4096;

type PositionSetter<Handle> = (handle: Handle, x: number, y: number, z: number) => void;

export class EffectMotion<Handle> {
  private readonly handles: Handle[] = [];

  private readonly points: number[] = [];

  private readonly placed: number[] = [];
  private readonly index = new Map<Handle, number>();

  private readonly active: number[] = [];
  private activeCount = 0;
  private serial = 0;

  tracking = false;

  smoothing = false;

  constructor(private readonly setPosition: PositionSetter<Handle>) {}


  beginFrame(): void {
    this.serial++;
    this.activeCount = 0;

    if (this.handles.length > TRACKED_BOUND) {
      this.handles.length = 0;
      this.points.length = 0;
      this.placed.length = 0;
      this.index.clear();
    }
  }


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


  release(handle: Handle): void {
    const slot = this.index.get(handle);
    if (slot !== undefined) this.placed[slot] = -1;
  }


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
