







export type MoveClass = "jab" | "tilt" | "smash" | "aerial" | "special";
export const MOVE_CLASSES: readonly MoveClass[] = ["jab", "tilt", "smash", "aerial", "special"];


export interface ScoreFrame {

  readonly frame: number;

  readonly vertices: Float32Array;

  readonly drawn: Uint8Array;

  readonly faces: Uint32Array;

  readonly nodes: Float32Array;
}


export interface ScoreLimb { readonly name: string; readonly root: number; readonly end: number }


export interface ScoreSkeleton {
  readonly names: readonly string[];
  readonly pelvis: number | undefined;
  readonly chest: number | undefined;
  readonly limbs: readonly ScoreLimb[];
}


export interface MoveSample {
  readonly moveClass: MoveClass;

  readonly frames: readonly ScoreFrame[];

  readonly moveFrames: number;

  readonly ready: ScoreFrame;
  readonly skeleton: ScoreSkeleton;

  readonly firstActive: number;
  readonly lastActive: number;

  readonly strike: { readonly x: number; readonly z: number };

  readonly pixelsPerUnit: number;
}


export interface ClassThresholds {

  readonly bodyShare: number;

  readonly massShift: number;

  readonly endError: number;

  readonly jump: number;

  readonly overshoot: number;

  readonly peakLate: number;

  readonly fill: number;

  readonly contrast: number;
}

export interface LineOne { readonly pass: boolean; readonly bodyShare: number; readonly massShift: number; readonly limb: string }
export interface LineTwo { readonly pass: boolean; readonly endError: number; readonly jump: number; readonly overshoot: number }
export interface LineThree { readonly pass: boolean; readonly windup: number; readonly peak: number; readonly settle: number; readonly fill: number }
export interface LineFour { readonly pass: boolean; readonly contrast: number; readonly windupContact: number; readonly contactRecovery: number }
export interface MoveScore {
  readonly line1: LineOne;
  readonly line2: LineTwo;
  readonly line3: LineThree;
  readonly line4: LineFour;

  readonly keys: { readonly windup: number; readonly contact: number; readonly recovery: number };

  readonly shortfall: number;
}





export const THRESHOLDS: Readonly<Record<MoveClass, ClassThresholds>> = {
  jab: { bodyShare: 0.41, massShift: 0.15, endError: 0.053, jump: 0.029, overshoot: 0.029, peakLate: 1, fill: 0.86, contrast: 0.36 },
  tilt: { bodyShare: 0.9, massShift: 0.023, endError: 0.053, jump: 0.055, overshoot: 0.029, peakLate: 2, fill: 0.53, contrast: 0.16 },
  smash: { bodyShare: 0.29, massShift: 0.071, endError: 0.026, jump: 0.014, overshoot: 0.095, peakLate: 3, fill: 0.84, contrast: 0.43 },
  aerial: { bodyShare: 0.29, massShift: 0.023, endError: 0.008, jump: 0.015, overshoot: 0.12, peakLate: 3, fill: 0.53, contrast: 0.25 },
  special: { bodyShare: 0.9, massShift: 0.2, endError: 0.046, jump: 0.055, overshoot: 0.039, peakLate: 1, fill: 0.9, contrast: 0.48 },
};


const LEAST_TRAVEL = 0.02;

const SETTLED = 0.01;

const LEAST_PULLBACK = 0.01;
const SHORT_STARTUP = 3;

function drawnBounds(frame: ScoreFrame): { readonly minZ: number; readonly maxZ: number } {
  let minZ = Infinity, maxZ = -Infinity;
  for (let vertex = 0; vertex < frame.drawn.length; vertex++) {
    if (frame.drawn[vertex] !== 1) continue;
    const z = frame.vertices[vertex * 2 + 1] ?? 0;
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minZ, maxZ };
}


export function bodyHeight(ready: ScoreFrame): number {
  const { minZ, maxZ } = drawnBounds(ready);
  return Number.isFinite(maxZ - minZ) && maxZ > minZ ? maxZ - minZ : 1;
}


export function meanVertexDistance(a: ScoreFrame, b: ScoreFrame): number {
  let sum = 0, count = 0;
  const vertices = Math.min(a.drawn.length, b.drawn.length);
  for (let vertex = 0; vertex < vertices; vertex++) {
    if (a.drawn[vertex] !== 1 || b.drawn[vertex] !== 1) continue;
    sum += Math.hypot((a.vertices[vertex * 2] ?? 0) - (b.vertices[vertex * 2] ?? 0), (a.vertices[vertex * 2 + 1] ?? 0) - (b.vertices[vertex * 2 + 1] ?? 0));
    count++;
  }
  return count === 0 ? 0 : sum / count;
}


export interface Mask { readonly left: number; readonly top: number; readonly width: number; readonly height: number; readonly pixels: Uint8Array }


export function silhouette(frame: ScoreFrame, pixelsPerUnit: number, extent: number): Mask {
  const left = Math.floor(-extent * pixelsPerUnit), top = Math.floor(-extent * pixelsPerUnit);
  const width = Math.ceil(2 * extent * pixelsPerUnit), height = width;
  const pixels = new Uint8Array(width * height);
  const faces = frame.faces, v = frame.vertices;
  for (let t = 0; t + 2 < faces.length; t += 3) {
    const a = faces[t] ?? 0, b = faces[t + 1] ?? 0, c = faces[t + 2] ?? 0;

    const ax = (v[a * 2] ?? 0) * pixelsPerUnit - left, ay = -(v[a * 2 + 1] ?? 0) * pixelsPerUnit - top;
    const bx = (v[b * 2] ?? 0) * pixelsPerUnit - left, by = -(v[b * 2 + 1] ?? 0) * pixelsPerUnit - top;
    const cx = (v[c * 2] ?? 0) * pixelsPerUnit - left, cy = -(v[c * 2 + 1] ?? 0) * pixelsPerUnit - top;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) continue;
    const rowStart = Math.max(0, Math.floor(Math.min(ay, by, cy))), rowEnd = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
    const columnStart = Math.max(0, Math.floor(Math.min(ax, bx, cx))), columnEnd = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let column = columnStart; column <= columnEnd; column++) {
        const px = column + 0.5, py = row + 0.5;
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
        if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) pixels[row * width + column] = 1;
      }
    }
  }
  return { left, top, width, height, pixels };
}

export function maskIoU(a: Mask, b: Mask): number {
  if (a.width !== b.width || a.height !== b.height) throw new Error("masks of one move share a window");
  let both = 0, either = 0;
  for (let index = 0; index < a.pixels.length; index++) {
    const x = a.pixels[index] === 1, y = b.pixels[index] === 1;
    if (x && y) both++;
    if (x || y) either++;
  }
  return either === 0 ? 1 : both / either;
}


export function maskCentroid(mask: Mask, pixelsPerUnit: number): { readonly x: number; readonly z: number } {
  let sx = 0, sy = 0, count = 0;
  for (let row = 0; row < mask.height; row++) for (let column = 0; column < mask.width; column++) {
    if (mask.pixels[row * mask.width + column] !== 1) continue;
    sx += column + 0.5; sy += row + 0.5; count++;
  }
  if (count === 0) return { x: 0, z: 0 };
  return { x: (sx / count + mask.left) / pixelsPerUnit, z: -(sy / count + mask.top) / pixelsPerUnit };
}

const point = (values: Float32Array, index: number) => ({ x: values[index * 2] ?? 0, z: values[index * 2 + 1] ?? 0 });


const LIMB_REACH = 1.0;

const RIGID = 0.12;






export function strikingLimb(skeleton: ScoreSkeleton, frames: readonly ScoreFrame[], tip: number, windup: number, contact: number, height: number): ScoreLimb | undefined {
  let best: ScoreLimb | undefined, steadiest = RIGID * height;
  const contactFrame = frames[contact];
  if (contactFrame === undefined) return undefined;
  for (const limb of skeleton.limbs) {
    const distance = (frame: ScoreFrame) => {
      const end = point(frame.nodes, limb.end), at = point(frame.vertices, tip);
      return Math.hypot(end.x - at.x, end.z - at.z);
    };
    const reach = distance(contactFrame);
    if (reach > LIMB_REACH * height) continue;
    let change = 0;
    for (let index = windup; index <= contact; index++) {
      const frame = frames[index];
      if (frame !== undefined) change = Math.max(change, Math.abs(distance(frame) - reach));
    }
    if (change < steadiest) { steadiest = change; best = limb; }
  }
  return best;
}


export function scoreMove(sample: MoveSample, thresholds: ClassThresholds): MoveScore {
  const { frames, moveFrames, ready, skeleton } = sample;
  const height = bodyHeight(ready);
  const contact = Math.min(Math.max(0, sample.firstActive), moveFrames - 1);
  const contactFrame = frames[contact];
  if (contactFrame === undefined) throw new Error("a scored move has a contact frame");

  const chest = skeleton.chest === undefined ? { x: 0, z: height * 0.6 } : point(contactFrame.nodes, skeleton.chest);
  const dx = sample.strike.x - chest.x, dz = sample.strike.z - chest.z, length = Math.hypot(dx, dz) || 1;
  const ux = dx / length, uz = dz / length;
  const along = (p: { readonly x: number; readonly z: number }) => p.x * ux + p.z * uz;

  let tip = 0, nearest = Infinity;
  for (let vertex = 0; vertex < contactFrame.drawn.length; vertex++) {
    if (contactFrame.drawn[vertex] !== 1) continue;
    const distance = Math.hypot((contactFrame.vertices[vertex * 2] ?? 0) - sample.strike.x, (contactFrame.vertices[vertex * 2 + 1] ?? 0) - sample.strike.z);
    if (distance < nearest) { nearest = distance; tip = vertex; }
  }
  const tipAt = (index: number) => along(point(frames[index]?.vertices ?? new Float32Array(0), tip));

  let peak = 0;
  for (let index = 0; index < moveFrames; index++) if (tipAt(index) > tipAt(peak) + 1e-6) peak = index;
  let windup = 0;
  for (let index = 0; index <= Math.min(peak, contact); index++) if (tipAt(index) < tipAt(windup) - 1e-6) windup = index;
  const limb = strikingLimb(skeleton, frames, tip, windup, contact, height);

  const rootAt = (index: number) => limb === undefined ? tipAt(index) : along(point(frames[index]?.nodes ?? new Float32Array(0), limb.root));


  const tipTravel = tipAt(contact) - tipAt(windup);
  const rootTravel = rootAt(contact) - rootAt(windup);
  const bodyShare = tipTravel <= LEAST_TRAVEL * height ? 0 : Math.max(0, Math.min(1, rootTravel / tipTravel));
  const extent = height * 1.6;
  const masks = new Map<number, Mask>();
  const mask = (index: number) => {
    let found = masks.get(index);
    const frame = frames[index];
    if (found === undefined && frame !== undefined) masks.set(index, found = silhouette(frame, sample.pixelsPerUnit, extent));
    if (found === undefined) throw new Error(`no frame ${index}`);
    return found;
  };
  const massShift = (along(maskCentroid(mask(contact), sample.pixelsPerUnit)) - along(maskCentroid(mask(windup), sample.pixelsPerUnit))) / height;
  const line1: LineOne = {
    pass: bodyShare >= thresholds.bodyShare && massShift >= thresholds.massShift,
    bodyShare, massShift, limb: limb?.name ?? "body",
  };


  const last = frames[moveFrames - 1] ?? contactFrame;
  const endError = meanVertexDistance(last, ready) / height;
  let jump = 0;
  for (let index = Math.max(1, sample.lastActive + 1); index < frames.length; index++) {
    const before = frames[index - 1], after = frames[index];
    if (before !== undefined && after !== undefined) jump = Math.max(jump, meanVertexDistance(before, after) / height);
  }

  const tipPoint = (index: number) => point(frames[index]?.vertices ?? new Float32Array(0), tip);
  const into = tipPoint(contact), from = tipPoint(Math.max(0, contact - 1));
  const speed = Math.hypot(into.x - from.x, into.z - from.z);
  let overshoot = 0;
  if (speed > 1e-6) for (let index = contact + 1; index < moveFrames; index++) {
    const at = tipPoint(index);
    overshoot = Math.max(overshoot, ((at.x - into.x) * (into.x - from.x) + (at.z - into.z) * (into.z - from.z)) / speed / height);
  }
  const line2: LineTwo = { pass: endError <= thresholds.endError && jump <= thresholds.jump && overshoot >= thresholds.overshoot, endError, jump, overshoot };


  let settle = moveFrames - 1;
  while (settle > sample.lastActive + 1 && meanVertexDistance(frames[settle - 1] ?? last, last) / height <= SETTLED) settle--;
  const endLag = Math.max(1, moveFrames - 1 - sample.lastActive);
  const fill = Math.min(1, Math.max(0, settle - sample.lastActive) / endLag);
  const pullback = (tipAt(0) - tipAt(windup)) / height;
  const windupOk = windup < sample.firstActive && (pullback >= LEAST_PULLBACK || sample.firstActive <= SHORT_STARTUP);
  const peakOk = peak >= sample.firstActive - 1 && peak <= sample.firstActive + thresholds.peakLate;
  const line3: LineThree = { pass: windupOk && peakOk && fill >= thresholds.fill, windup, peak, settle, fill };


  const recovery = Math.min(moveFrames - 1, Math.round((sample.lastActive + moveFrames - 1) / 2));

  const windupKey = windup < contact ? windup : 0;
  const windupContact = maskIoU(mask(windupKey), mask(contact));
  const contactRecovery = maskIoU(mask(contact), mask(recovery));
  const contrast = 1 - Math.max(windupContact, contactRecovery);
  const line4: LineFour = { pass: contrast >= thresholds.contrast, contrast, windupContact, contactRecovery };

  const short = (value: number, least: number) => Math.max(0, least - value) / Math.max(least, 1e-6);
  const over = (value: number, most: number) => Math.max(0, value - most) / Math.max(most, 1e-6);
  const shortfall = short(bodyShare, thresholds.bodyShare) + short(massShift, thresholds.massShift)
    + over(endError, thresholds.endError) + over(jump, thresholds.jump) + short(overshoot, thresholds.overshoot)
    + (windupOk ? 0 : 1) + (peakOk ? 0 : 1) + short(fill, thresholds.fill) + short(contrast, thresholds.contrast);
  return { line1, line2, line3, line4, keys: { windup: windupKey, contact, recovery }, shortfall };
}
