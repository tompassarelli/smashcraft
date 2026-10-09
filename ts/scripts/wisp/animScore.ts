// The animation scorecard's measured lines (#367): whole-body involvement,
// return to ready, phases against the frame data and pose contrast, each read
// from the exported body posed at the clip time production shows. Every input
// is a sampled move (animScoreSample.ts builds them from the game and the
// packaged bodies); these functions are pure, so a scorecard is deterministic.
// Thresholds and how they were set: smashcraft:docs/animation-scorecard.md.

/** The move classes thresholds are kept for. */
export type MoveClass = "jab" | "tilt" | "smash" | "aerial" | "special";
export const MOVE_CLASSES: readonly MoveClass[] = ["jab", "tilt", "smash", "aerial", "special"];

/** One posed frame, facing right, around the fighter's origin, in world units. */
export interface ScoreFrame {
  /** Zero-based attack frame. */
  readonly frame: number;
  /** Body vertices as x,z pairs, in one stable order for the whole move. */
  readonly vertices: Float32Array;
  /** Which vertices draw this frame. */
  readonly drawn: Uint8Array;
  /** Drawn triangles, as vertex indices. */
  readonly faces: Uint32Array;
  /** Each node's pivot as x,z pairs by object id. */
  readonly nodes: Float32Array;
}

/** One arm or leg: the node it hangs from (shoulder or hip) and its end (hand or foot). */
export interface ScoreLimb { readonly name: string; readonly root: number; readonly end: number }

/** The chain line 1 reads, found in the skeleton by name (animScoreSample.ts). */
export interface ScoreSkeleton {
  readonly names: readonly string[];
  readonly pelvis: number | undefined;
  readonly chest: number | undefined;
  readonly limbs: readonly ScoreLimb[];
}

/** One move as the scorecard reads it. */
export interface MoveSample {
  readonly moveClass: MoveClass;
  /** Every frame of the move, then the frames after it ends (the transition into the next state). */
  readonly frames: readonly ScoreFrame[];
  /** How many of `frames` belong to the move; the rest follow it. */
  readonly moveFrames: number;
  /** The pose the move returns to: standing, or the airborne idle for an aerial. */
  readonly ready: ScoreFrame;
  readonly skeleton: ScoreSkeleton;
  /** Zero-based first and last active frames, from the simulation's frame data. */
  readonly firstActive: number;
  readonly lastActive: number;
  /** The far end of the first active strike, around the fighter's origin, facing right. */
  readonly strike: { readonly x: number; readonly z: number };
  /** Pixels per world unit of the smallest gameplay view the masks are drawn at. */
  readonly pixelsPerUnit: number;
}

/** Per-class pass thresholds; heights are fractions of the fighter's standing height. */
export interface ClassThresholds {
  /** Line 1: least share of the end-effector's windup-to-contact travel carried by the pelvis and spine. */
  readonly bodyShare: number;
  /** Line 1: least centre-of-mass shift toward the strike, windup to contact. */
  readonly massShift: number;
  /** Line 2: most mean vertex distance from the ready pose on the move's last frame. */
  readonly endError: number;
  /** Line 2: most mean vertex travel in one frame across end lag and into the next state. */
  readonly jump: number;
  /** Line 2: least end-effector travel past its contact position, along its motion into contact. */
  readonly overshoot: number;
  /** Line 3: most frames the extension peak may come after the first active frame. */
  readonly peakLate: number;
  /** Line 3: least share of end lag the body is still moving. */
  readonly fill: number;
  /** Line 4: least silhouette contrast, 1 minus the larger of the windup/contact and contact/recovery mask IoUs. */
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
  /** The frames the lines read: windup extreme, contact (first active) and the recovery key frame. */
  readonly keys: { readonly windup: number; readonly contact: number; readonly recovery: number };
  /** How far short of its thresholds the move falls, summed over failed measures; orders the table worst first. */
  readonly shortfall: number;
}

/**
 * Pass thresholds per move class, set from the calibration set
 * (smashcraft:docs/animation-scorecard.md, "Thresholds"). Tom tunes them.
 */
export const THRESHOLDS: Readonly<Record<MoveClass, ClassThresholds>> = {
  jab: { bodyShare: 0.2, massShift: 0.02, endError: 0.06, jump: 0.06, overshoot: 0.02, peakLate: 1, fill: 0.5, contrast: 0.15 },
  tilt: { bodyShare: 0.2, massShift: 0.03, endError: 0.06, jump: 0.06, overshoot: 0.03, peakLate: 2, fill: 0.5, contrast: 0.2 },
  smash: { bodyShare: 0.25, massShift: 0.04, endError: 0.06, jump: 0.06, overshoot: 0.05, peakLate: 2, fill: 0.5, contrast: 0.25 },
  aerial: { bodyShare: 0.15, massShift: 0.02, endError: 0.06, jump: 0.06, overshoot: 0.03, peakLate: 2, fill: 0.5, contrast: 0.2 },
  special: { bodyShare: 0.15, massShift: 0.02, endError: 0.06, jump: 0.06, overshoot: 0.02, peakLate: 3, fill: 0.4, contrast: 0.15 },
};

/** Below this the end-effector barely travels toward the strike, and its shares mean nothing. */
const LEAST_TRAVEL = 0.02;
/** A body within this mean vertex distance of the move's last pose has settled. */
const SETTLED = 0.01;
/** Pullback below this is no windup; a jab of three or fewer startup frames may skip it. */
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

/** The ready pose's drawn height: every distance is a fraction of it. */
export function bodyHeight(ready: ScoreFrame): number {
  const { minZ, maxZ } = drawnBounds(ready);
  return Number.isFinite(maxZ - minZ) && maxZ > minZ ? maxZ - minZ : 1;
}

/** Mean distance between the vertices two frames both draw. */
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

/** The drawn silhouette at gameplay zoom: one byte per pixel, origin-anchored so frames of a move compare in place. */
export interface Mask { readonly left: number; readonly top: number; readonly width: number; readonly height: number; readonly pixels: Uint8Array }

/** Rasterizes the frame's drawn triangles into a mask over a fixed window around the fighter. */
export function silhouette(frame: ScoreFrame, pixelsPerUnit: number, extent: number): Mask {
  const left = Math.floor(-extent * pixelsPerUnit), top = Math.floor(-extent * pixelsPerUnit);
  const width = Math.ceil(2 * extent * pixelsPerUnit), height = width;
  const pixels = new Uint8Array(width * height);
  const faces = frame.faces, v = frame.vertices;
  for (let t = 0; t + 2 < faces.length; t += 3) {
    const a = faces[t] ?? 0, b = faces[t + 1] ?? 0, c = faces[t + 2] ?? 0;
    // Screen rows grow downward; world z grows upward.
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

/** The mask's centroid in world units: the drawn body's centre of mass. */
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

/** A limb's end must lie within this of the end-effector at contact (a held weapon reaches far from the hand). */
const LIMB_REACH = 1.0;
/** The end-effector rides a limb when its distance to the limb's end changes less than this from windup to contact. */
const RIGID = 0.12;

/**
 * The striking limb: of the arms and legs whose end is near the end-effector
 * at contact, the one it stays rigidly attached to from windup to contact (a
 * hand, foot or the weapon it holds). None means the body itself struck.
 */
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

/** Scores lines 1–4 of one sampled move against its class thresholds. */
export function scoreMove(sample: MoveSample, thresholds: ClassThresholds): MoveScore {
  const { frames, moveFrames, ready, skeleton } = sample;
  const height = bodyHeight(ready);
  const contact = Math.min(Math.max(0, sample.firstActive), moveFrames - 1);
  const contactFrame = frames[contact];
  if (contactFrame === undefined) throw new Error("a scored move has a contact frame");
  // The strike's direction, from the chest at contact (or chest height) toward the far end of the strike.
  const chest = skeleton.chest === undefined ? { x: 0, z: height * 0.6 } : point(contactFrame.nodes, skeleton.chest);
  const dx = sample.strike.x - chest.x, dz = sample.strike.z - chest.z, length = Math.hypot(dx, dz) || 1;
  const ux = dx / length, uz = dz / length;
  const along = (p: { readonly x: number; readonly z: number }) => p.x * ux + p.z * uz;
  // The end-effector: the drawn vertex nearest the strike's far end at contact.
  let tip = 0, nearest = Infinity;
  for (let vertex = 0; vertex < contactFrame.drawn.length; vertex++) {
    if (contactFrame.drawn[vertex] !== 1) continue;
    const distance = Math.hypot((contactFrame.vertices[vertex * 2] ?? 0) - sample.strike.x, (contactFrame.vertices[vertex * 2 + 1] ?? 0) - sample.strike.z);
    if (distance < nearest) { nearest = distance; tip = vertex; }
  }
  const tipAt = (index: number) => along(point(frames[index]?.vertices ?? new Float32Array(0), tip));
  // Line 3's key frames come from the animation alone: the extension peak and the windup extreme before it.
  let peak = 0;
  for (let index = 0; index < moveFrames; index++) if (tipAt(index) > tipAt(peak) + 1e-6) peak = index;
  let windup = 0;
  for (let index = 0; index <= Math.min(peak, contact); index++) if (tipAt(index) < tipAt(windup) - 1e-6) windup = index;
  const limb = strikingLimb(skeleton, frames, tip, windup, contact, height);
  // A body strike (no limb carries the end-effector) is carried wholly by the body.
  const rootAt = (index: number) => limb === undefined ? tipAt(index) : along(point(frames[index]?.nodes ?? new Float32Array(0), limb.root));

  // Line 1: the body's share of the end-effector's windup-to-contact travel, and the mass shift.
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

  // Line 2: settle to ready, no snap through end lag into the next state, and follow-through past the hit.
  const last = frames[moveFrames - 1] ?? contactFrame;
  const endError = meanVertexDistance(last, ready) / height;
  let jump = 0;
  for (let index = Math.max(1, sample.lastActive + 1); index < frames.length; index++) {
    const before = frames[index - 1], after = frames[index];
    if (before !== undefined && after !== undefined) jump = Math.max(jump, meanVertexDistance(before, after) / height);
  }
  // Follow-through: the end-effector keeps travelling the way it moved into contact.
  const tipPoint = (index: number) => point(frames[index]?.vertices ?? new Float32Array(0), tip);
  const into = tipPoint(contact), from = tipPoint(Math.max(0, contact - 1));
  const speed = Math.hypot(into.x - from.x, into.z - from.z);
  let overshoot = 0;
  if (speed > 1e-6) for (let index = contact + 1; index < moveFrames; index++) {
    const at = tipPoint(index);
    overshoot = Math.max(overshoot, ((at.x - into.x) * (into.x - from.x) + (at.z - into.z) * (into.z - from.z)) / speed / height);
  }
  const line2: LineTwo = { pass: endError <= thresholds.endError && jump <= thresholds.jump && overshoot >= thresholds.overshoot, endError, jump, overshoot };

  // Line 3: windup in startup, full extension on the first active frame, recovery moving through end lag.
  let settle = moveFrames - 1;
  while (settle > sample.lastActive + 1 && meanVertexDistance(frames[settle - 1] ?? last, last) / height <= SETTLED) settle--;
  const endLag = Math.max(1, moveFrames - 1 - sample.lastActive);
  const fill = Math.min(1, Math.max(0, settle - sample.lastActive) / endLag);
  const pullback = (tipAt(0) - tipAt(windup)) / height;
  const windupOk = windup < sample.firstActive && (pullback >= LEAST_PULLBACK || sample.firstActive <= SHORT_STARTUP);
  const peakOk = peak >= sample.firstActive - 1 && peak <= sample.firstActive + thresholds.peakLate;
  const line3: LineThree = { pass: windupOk && peakOk && fill >= thresholds.fill, windup, peak, settle, fill };

  // Line 4: silhouette contrast between the windup, contact and recovery key frames.
  const recovery = Math.min(moveFrames - 1, Math.round((sample.lastActive + moveFrames - 1) / 2));
  // A move with no pullback before contact is contrasted from the pose it starts in.
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
