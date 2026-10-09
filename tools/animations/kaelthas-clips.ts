
import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { generateMDX, parseMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackStyle, AttackPhase, GrabAction } from "../../ts/src/game/sim/codes";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { KAELTHAS_MOVES } from "../../ts/src/game/sim/heroes/kaelthasMoves";
import { KAELTHAS_SPECIALS } from "../../ts/src/game/sim/heroes/kaelthasSpecials";
import { seconds } from "./asset-info";
import { measureDrawnReach } from "../../ts/scripts/wisp/drawnReach";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";

function ensure(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function tracks(value: unknown, visit: (track: mdx.AnimVector, path: string) => void, path = "") {
  if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) return;
  if ("Keys" in value && Array.isArray(value.Keys)) { visit(value as mdx.AnimVector, path); return; }
  for (const [key, child] of Object.entries(value)) if (key !== "Nodes") tracks(child, visit, `${path}.${key}`);
}
const globalClock = (track: mdx.AnimVector) => track.GlobalSeqId != null && track.GlobalSeqId !== -1 && track.GlobalSeqId !== 0xffffffff;
const args = process.argv.slice(2), lookAt = args.indexOf("--look"), look = lookAt >= 0 ? args.splice(lookAt, 2)[1] : "classic";
const [input, output] = args.map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith("..") && (look === "classic" || look === "definitive"), "usage: bun tools/animations/kaelthas-clips.ts STOCK_BLOOD_MAGE.mdx PRIVATE_OUTPUT [--look classic|definitive]");
const originalBytes = await Bun.file(input).arrayBuffer();
const source = parseMDX(originalBytes), model = structuredClone(source);
ensure(source.Sequences.length === 11 && source.Bones.some(b => b.Name === "Bone_Hand_R"), "Expected original classic Blood Mage");
const stand = source.Sequences[0]!;
interface Gesture { chest?: number; pelvis?: number; arm?: number; elbow?: number; hand?: number; leftArm?: number; leftElbow?: number; head?: number; thigh?: number; knee?: number; leftKnee?: number; leftThigh?: number; yaw?: number; lean?: number; tx?: number; tz?: number; }
type Ease = "in" | "out" | "inout" | "linear";
interface Key { frame: number; g: Gesture; ease?: Ease }
const GESTURE_FIELDS = ["chest", "pelvis", "arm", "elbow", "hand", "leftArm", "leftElbow", "head", "thigh", "knee", "leftKnee", "leftThigh", "yaw", "lean", "tx", "tz"] as const;
interface Action { pose: HeroPose; frames: number; contact: number; gesture: Gesture; keys?: Key[]; float?: boolean; hold?: boolean; air?: boolean; roll?: number; target?: readonly [number, number]; paired?: boolean; pain?: boolean; }
const forward: Gesture = { chest: 15, pelvis: -8, arm: -95, elbow: 15, leftArm: -35, leftElbow: -20, head: -8, thigh: 12, leftThigh: -8 };
const overhead: Gesture = { chest: -18, pelvis: 8, arm: -165, elbow: -10, leftArm: -140, head: -18, thigh: -12, leftThigh: 15 };
const low: Gesture = { chest: 45, pelvis: 18, arm: -45, elbow: 15, leftArm: -60, head: -20, thigh: 45, knee: -55, leftThigh: -25 };
const back: Gesture = { chest: -12, pelvis: -15, arm: 40, leftArm: -55, head: 20, yaw: 105 };
const cast: Gesture = { chest: -15, pelvis: 8, arm: -120, elbow: -30, leftArm: -115, leftElbow: -20, head: -12 };
const brace: Gesture = { chest: 28, pelvis: 12, arm: -50, elbow: -30, leftArm: -70, leftElbow: -25, head: -15, thigh: 38, knee: -65, leftThigh: -35 };
const actions: Action[] = [];
interface Strike { w: Gesture; c: Gesture; o: Gesture; r: Gesture; late: number; mid?: number; lead?: number }
const along = (from: Gesture, to: Gesture, amount: number): Gesture => {
  const out: Gesture = {};
  for (const field of GESTURE_FIELDS) out[field] = (from[field] ?? 0) + ((to[field] ?? 0) - (from[field] ?? 0)) * amount;
  return out;
};
function strikeKeys(total: number, startup: number, active: number, strike: Strike, air = false, windupAt = 0.6): Key[] {
  const c = Math.max(1, startup - 1), w = Math.max(1, Math.min(c - 1, Math.round(c * windupAt)));
  const last = c + active - 1, peak = Math.max(c + 1, c + strike.late), end = air ? total - 1 : total;
  const keys: Key[] = [{ frame: 0, g: {} }, { frame: w, g: strike.w }];
  if (strike.lead !== undefined && c - 1 > w) { const arms = along(strike.w, strike.c, strike.lead);
    keys.push({ frame: c - 1, g: { ...strike.c, arm: arms.arm, elbow: arms.elbow, leftArm: arms.leftArm, leftElbow: arms.leftElbow }, ease: "in" }, { frame: c, g: strike.c, ease: "linear" }); }
  else keys.push({ frame: c, g: strike.c, ease: "in" });
  if (last > c && last < peak) keys.push({ frame: last, g: along(strike.c, strike.o, 0.85), ease: "linear" }, { frame: peak, g: strike.o, ease: "out" });
  else keys.push({ frame: peak, g: strike.o, ease: "out" });
  const middle = Math.round(Math.max(last, peak) + (end - Math.max(last, peak)) * (strike.mid ?? 0.5));
  if (middle > peak + 1 && middle < end - 1) keys.push({ frame: middle, g: strike.r, ease: "linear" });
  keys.push({ frame: end, g: {}, ease: "linear" });
  if (end < total) keys.push({ frame: total, g: {} });
  return keys;
}
const STEP: Gesture = { thigh: -28, knee: -10, leftThigh: 22, leftKnee: -15 };
const LOAD: Gesture = { thigh: 10, knee: -25, leftThigh: -12, leftKnee: -30 };
const RAW_STRIKES: Partial<Record<HeroPose, Strike>> = {
  jab: { late: 1, mid: 0.62, w: { ...LOAD, tx: -11, lean: -6, arm: 10, elbow: -60, leftArm: -30 },
    c: { ...STEP, tx: 12, lean: 9, arm: -92, leftArm: 25 }, o: { ...STEP, tx: 17, lean: 11, arm: -92, leftArm: 30 },
    r: { tx: -3, lean: -2, arm: -40, elbow: -25, leftArm: -10 } },
  jab2: { late: 1, w: { ...LOAD, tx: -8, lean: -5, leftArm: -65, leftElbow: -45, arm: -40, yaw: -15 },
    c: { ...STEP, tx: 13, lean: 9, leftArm: -92, arm: 20, yaw: 20 }, o: { ...STEP, tx: 16, lean: 10, leftArm: -94, arm: 24, yaw: 24 },
    r: { tx: -3, lean: -2, leftArm: -40, leftElbow: -25, arm: -10 } },
  forwardTilt: { late: 2, w: { ...along(LOAD, STEP, 0.5), tx: -30, lean: -8, arm: -90, leftArm: -40 },
    c: { ...STEP, tx: 16, lean: 9, arm: -92, leftArm: 35 }, o: { ...STEP, tx: 20, lean: 10, arm: -92, leftArm: 40 },
    r: { tx: -5, lean: -3, arm: -40, elbow: -20, leftArm: -15 } },
  forwardTiltUp: { late: 2, w: { ...LOAD, tx: -12, lean: -4, arm: -128, leftArm: -30 },
    c: { ...STEP, tx: 14, lean: 2, arm: -132, leftArm: 30 }, o: { ...STEP, tx: 18, lean: 2, arm: -133, leftArm: 35 },
    r: { tx: -4, lean: -2, arm: -55, leftArm: -10 } },
  forwardTiltDown: { late: 2, w: { ...LOAD, tx: -12, lean: -6, arm: -58, leftArm: -40 },
    c: { ...STEP, knee: -40, tx: 15, lean: 22, arm: -60, leftArm: 30 }, o: { ...STEP, knee: -42, tx: 19, lean: 24, arm: -60, leftArm: 35 },
    r: { tx: -4, lean: 2, arm: -30, leftArm: -10 } },
  upTilt: { late: 2, w: { tx: -6, tz: -14, thigh: -45, knee: -90, leftThigh: -45, leftKnee: -90, lean: -16, chest: 10, arm: -35, elbow: -60, leftArm: -35, leftElbow: -60 },
    c: { tz: 22, lean: 6, arm: -60, elbow: -110, leftArm: -60, leftElbow: -110 }, o: { tz: 25, lean: 7, arm: -62, elbow: -112, leftArm: -62, leftElbow: -112 },
    r: { tz: 2, lean: -2, arm: -30, leftArm: -30 } },
  downTilt: { late: 2, w: { thigh: -45, knee: -75, leftThigh: 25, leftKnee: -45, tx: -40, lean: 30, arm: -45, leftArm: 20 },
    c: { thigh: -45, knee: -75, leftThigh: 25, leftKnee: -45, tx: 16, lean: 36, arm: -45, leftArm: 30 }, o: { thigh: -45, knee: -75, leftThigh: 25, leftKnee: -45, tx: 20, lean: 37, arm: -45, leftArm: 32 },
    r: { thigh: -15, knee: -25, tx: -4, lean: 8, arm: -25 } },
  dashAttack: { late: 2, w: { ...STEP, tx: -24, lean: -8, arm: -88, leftArm: -50 },
    c: { ...STEP, tx: 22, lean: 14, arm: -90, leftArm: 40 }, o: { ...STEP, tx: 27, lean: 15, arm: -90, leftArm: 45 },
    r: { tx: -5, lean: -3, arm: -35, leftArm: -10 } },
  forwardSmash: { late: 2, mid: 0.6, w: { ...LOAD, tx: -18, lean: -14, arm: 40, elbow: -60, leftArm: 30, leftElbow: -60 },
    c: { ...STEP, tx: 20, lean: 14, arm: -95, leftArm: -95 }, o: { ...STEP, tx: 27, lean: 17, arm: -125, leftArm: -125 },
    r: { tx: 2, lean: -5, arm: -40, elbow: -40, leftArm: -40, leftElbow: -40 } },
  upSmash: { late: 3, mid: 0.7, w: { lean: 18, chest: 12, arm: 20, leftArm: 20 },
    c: { tz: 18, lean: -6, arm: -178, leftArm: -178 }, o: { tz: 24, lean: -16, arm: -180, leftArm: -180 },
    r: { tz: -2, lean: 8, chest: 12, arm: -50, leftArm: -50, thigh: 15, knee: -30, leftThigh: 15, leftKnee: -30 } },
  downSmash: { late: 3, mid: 0.8, w: { thigh: -55, knee: -60, leftThigh: 45, leftKnee: -20, tx: -40, lean: -10, arm: 40, leftArm: -40 },
    c: { thigh: -55, knee: -60, leftThigh: 45, leftKnee: -20, tx: 14, lean: 30, arm: -45, leftArm: 45 }, o: { thigh: -66, knee: -36, leftThigh: 45, leftKnee: -20, tx: 32, lean: 28, arm: -42, leftArm: 50 },
    r: { thigh: -10, knee: -10, leftThigh: 8, tx: -2, lean: -2, arm: -10, leftArm: -10 } },
  neutralAir: { late: 3, mid: 0.55, lead: 0.5, w: { tx: -16, lean: -14, thigh: -40, knee: -60, leftThigh: -40, leftKnee: -60, arm: 40, elbow: -60 },
    c: { tx: 13, lean: 10, arm: -55, elbow: -15, leftArm: 60, thigh: 10, leftThigh: 20 }, o: { tx: 15, lean: 11, arm: -90, elbow: 0, leftArm: 70, thigh: 12, leftThigh: 22 },
    r: { tx: 4, tz: 7, lean: 4, thigh: -45, knee: -65, leftThigh: -45, leftKnee: -65, arm: -20, leftArm: 20 } },
  forwardAir: { late: 2, mid: 0.55, lead: 0.6, w: { tx: -12, lean: -12, arm: 40, elbow: -40, thigh: -30, knee: -40, leftThigh: -10 },
    c: { tx: 10, lean: 10, arm: -65, elbow: -10, thigh: -25, leftThigh: 25 }, o: { tx: 12, lean: 11, arm: -100, elbow: 0, thigh: -27, leftThigh: 27 },
    r: { tx: 6, tz: 7, lean: 4, thigh: -45, knee: -65, leftThigh: -35, leftKnee: -55, arm: -20, leftArm: 10 } },
  backAir: { late: 2, mid: 0.68, w: { tx: 12, lean: 12, arm: 10, elbow: -40, leftArm: -60, thigh: -15, leftThigh: 10 },
    c: { tx: -10, lean: -10, arm: 80, elbow: 50, leftArm: 20, thigh: 25, leftThigh: -25 }, o: { tx: -26, tz: 14, lean: -11, arm: 95, elbow: 30, leftArm: 25, thigh: 27, leftThigh: -27 },
    r: { tx: -10, tz: 5, lean: -4, thigh: -20, knee: -30, leftThigh: -15, leftKnee: -25, arm: 30, leftArm: -10 } },
  upAir: { late: 3, mid: 0.66, w: { tz: -12, lean: 10, arm: -165, elbow: -70, leftArm: -150, leftElbow: -70, thigh: -40, knee: -60, leftThigh: -40, leftKnee: -60 },
    c: { tz: 8, lean: -6, arm: -178, elbow: -50, leftArm: -175, leftElbow: -50, thigh: 15, leftThigh: 10 }, o: { tz: 25, lean: -12, arm: -178, elbow: 0, leftArm: -175, leftElbow: 0, thigh: 17, leftThigh: 12 },
    r: { tz: 8, lean: 0, thigh: -20, knee: -30, leftThigh: -20, leftKnee: -30, arm: -90, leftArm: -80 } },
  downAir: { late: 2, mid: 0.72, w: { tz: 20, lean: -6, thigh: -25, knee: -35, leftThigh: -25, leftKnee: -35, arm: -20, elbow: -60, leftArm: -20, leftElbow: -60 },
    c: { tz: -12, lean: 6, thigh: -5, leftThigh: -5, arm: -10, elbow: -50, leftArm: -10, leftElbow: -50 }, o: { tz: -27, lean: 11, thigh: -5, leftThigh: -5, arm: -10, elbow: 0, leftArm: -10, leftElbow: 0 },
    r: { tz: 6, lean: 3, thigh: -50, knee: -70, leftThigh: -50, leftKnee: -70, arm: -90, leftArm: -90 } },
  neutralSpecial: { late: 1, w: { ...LOAD, tx: -45, lean: -20, arm: -94, leftArm: -40 },
    c: { ...STEP, tx: 22, lean: 16, arm: -94, leftArm: 40 }, o: { ...STEP, tx: 28, lean: 18, arm: -94, leftArm: 45 },
    r: { tx: -7, lean: -5, arm: -40, leftArm: -10 } },
  sideSpecial: { late: 1, w: { ...LOAD, tx: -45, lean: -20, arm: -93, leftArm: -93 },
    c: { ...STEP, tx: 20, lean: 14, arm: -93, leftArm: -93 }, o: { ...STEP, tx: 25, lean: 16, arm: -93, leftArm: -93 },
    r: { tx: -6, lean: -4, arm: -40, leftArm: -40 } },
  downSpecial: { late: 1, w: { ...LOAD, tx: -62, lean: -8, arm: -110, yaw: 20, leftArm: -40 },
    c: { ...STEP, tx: 24, lean: 8, arm: -110, yaw: 20, leftArm: 35 }, o: { ...STEP, tx: 27, lean: 18, arm: -112, yaw: 24, leftArm: 40 },
    r: { tx: -7, lean: -5, arm: -40, leftArm: -10 } },
};
const OVERSHOOT: Partial<Record<HeroPose, number>> = { jab: 2, jab2: 4, forwardTilt: 3, forwardTiltUp: 4.5, forwardTiltDown: 4.5, upTilt: 3, downTilt: 3, dashAttack: 3,
  forwardSmash: 0.5, upSmash: 1, downSmash: 1, neutralAir: 1, forwardAir: 1, backAir: 1, upAir: 1, downAir: 1, neutralSpecial: 1.1, sideSpecial: 1.1, downSpecial: 1.3 };
const COUNTER: Partial<Record<HeroPose, number>> = { jab: 1.2 };
const DEFINITIVE: Partial<Record<HeroPose, { w?: Gesture; c?: Gesture; o?: Gesture; r?: Gesture; mid?: number; late?: number; lead?: number; overshoot?: number; counter?: number }>> = {
  jab: { counter: 1.294, o: { tx: 14.8 }, r: { tx: -1.4, lean: -5.5 } },
  jab2: { c: { tx: 16 }, o: { tx: 19 } },
  upTilt: { c: { tz: 14 }, o: { tz: 24 } },
  forwardSmash: { mid: 0.633, c: { arm: -78, leftArm: -78 }, o: { arm: -98, leftArm: -98 }, r: { tx: -1.1, lean: 1.9, arm: -38.7 }, overshoot: 1.194 },
  upSmash: { late: 1, mid: 0.807, overshoot: 0.949, o: { tz: 13.5, lean: -23.4 }, r: { lean: 3.9, chest: 15.1, arm: -8.1, leftArm: -32.3 } },
  downSmash: { mid: 0.803, o: { lean: 24.5 } },
  neutralAir: { mid: 0.5, lead: undefined, c: { lean: 24, arm: -45, elbow: 0 }, o: { tx: 33, tz: -4, lean: 22, arm: -60 },
    r: { tx: 14, tz: 0, lean: 8, thigh: 0, knee: 0, leftThigh: 0, leftKnee: 0, arm: -30, leftArm: 30 } },
  upAir: { late: 1, mid: 0.69, o: { tz: 13.1, lean: -19.2 }, r: { tz: -0.8, lean: 3, leftArm: -115.3, knee: -35.6, leftThigh: -12.6, leftKnee: -25 } },
  downAir: { r: { lean: 0.7, thigh: -25, knee: -21.7, leftThigh: -25, leftKnee: -28.5, arm: -45, leftArm: -26.5 } },
  downSpecial: { w: { arm: -85 }, c: { arm: -85 }, o: { arm: -88 } },
};
if (look === "definitive") for (const [pose, t] of Object.entries(DEFINITIVE) as [HeroPose, NonNullable<typeof DEFINITIVE[HeroPose]>][]) {
  const base = RAW_STRIKES[pose]!, { w, c, o, r, overshoot: _, counter: __, ...scalars } = t;
  RAW_STRIKES[pose] = { ...base, ...scalars, w: { ...base.w, ...w }, c: { ...base.c, ...c }, o: { ...base.o, ...o }, r: { ...base.r, ...r } };
  if (t.overshoot !== undefined) OVERSHOOT[pose] = t.overshoot;
  if (t.counter !== undefined) COUNTER[pose] = t.counter;
}
const STRIKES: Partial<Record<HeroPose, Strike>> = Object.fromEntries(Object.entries(RAW_STRIKES).map(([pose, strike]) => {
  const o = { ...along(strike.c, strike.o, OVERSHOOT[pose as HeroPose] ?? 1), arm: strike.o.arm, elbow: strike.o.elbow, leftArm: strike.o.leftArm, leftElbow: strike.o.leftElbow }, counter = COUNTER[pose as HeroPose] ?? 1;
  return [pose, { ...strike, o, r: along(along({}, o, 0.5), strike.r, counter) }];
}));
const NORMAL_STYLES: readonly [HeroPose, AttackStyle][] = [
  ["jab", AttackStyle.jab], ["jab2", AttackStyle.jab2], ["forwardTilt", AttackStyle.forwardTilt], ["forwardTiltUp", AttackStyle.forwardTiltUp],
  ["forwardTiltDown", AttackStyle.forwardTiltDown], ["upTilt", AttackStyle.upTilt], ["downTilt", AttackStyle.downTilt], ["dashAttack", AttackStyle.dashAttack],
  ["forwardSmash", AttackStyle.forwardSmash], ["upSmash", AttackStyle.upSmash], ["downSmash", AttackStyle.downSmash], ["neutralAir", AttackStyle.neutralAir],
  ["forwardAir", AttackStyle.forwardAir], ["backAir", AttackStyle.backAir], ["upAir", AttackStyle.upAir], ["downAir", AttackStyle.downAir],
];
const normals = NORMAL_STYLES;
for (const [pose, style] of NORMAL_STYLES) {
  const move = KAELTHAS_MOVES.normals[style]; ensure(move, `${pose}: missing timing`);
  const strike = STRIKES[pose]!;
  actions.push({ pose, frames: move.totalFrames, contact: move.startupFrames, gesture: strike.c, keys: strikeKeys(move.totalFrames, move.startupFrames + 1, move.activeFrames, strike, pose.endsWith("Air")), air: pose.endsWith("Air"), float: pose === "upSmash" || pose === "upTilt" });
}
const extra: readonly [HeroPose, number, number, Gesture][] = [
  ["crouch", 30, 8, brace], ["landing", 8, 2, brace], ["shield", 30, 5, { ...brace, leftArm: -105 }],
  ["airDodge", 49, 4, { ...brace, lean: -25 }], ["smashCharge", 30, 8, { ...cast, arm: -80, leftArm: -80 }],
  ["dizzy", 60, 25, { chest: -15, head: 30, arm: 20, leftArm: 15 }], ["turn", 8, 4, { yaw: 140, chest: -12 }],
  ["stop", 8, 3, { ...brace, lean: -18 }], ["jumpSquat", 5, 4, { ...brace, thigh: 55, knee: -80 }],
  ["jump", 24, 7, { ...overhead, thigh: -40, leftThigh: 30, lean: -12 }],
  ["doubleJump", 24, 7, { ...cast, thigh: -55, leftThigh: 40, lean: -20 }],
  ["wallJump", 24, 7, { ...overhead, lean: -25, thigh: 50 }], ["wallTech", 26, 6, brace],
  ["fall", 30, 12, { ...brace, thigh: 35, leftThigh: -20 }], ["fallSpecial", 30, 12, { ...brace, chest: 45, head: 20 }],
  ["ledgeHang", 30, 1, { ...overhead, chest: 15, thigh: 20 }], ["ledgeClimb", 25, 10, { ...overhead, lean: 35 }],
  ["ledgeAttack", 40, 16, forward], ["knockdown", 30, 25, { ...brace, lean: 85 }],
  ["downDamage", 24, 1, { ...brace, lean: 75, head: 30 }], ["getUp", 30, 18, { ...brace, lean: 30 }],
  ["getUpAttack", 49, 16, { ...forward, yaw: 160, leftArm: 65 }], ["spotDodge", 22, 4, { ...brace, lean: -30 }],
  ["tech", 26, 8, { ...brace, lean: 45 }], ["damageGround", 24, 1, { ...brace, chest: -35, head: -30 }],
  ["damageAir", 24, 1, { ...brace, chest: -40, thigh: 60 }], ["damageTumble", 30, 9, { ...brace, lean: 70 }],
  ["damageShield", 24, 1, { ...brace, chest: -20 }],
];
for (const [pose, frames, contact, gesture] of extra) actions.push({ pose, frames, contact, gesture,
  hold: ["shield", "smashCharge", "crouch", "ledgeHang"].includes(pose),
  air: ["airDodge", "jump", "doubleJump", "wallJump", "fall", "fallSpecial", "damageAir", "damageTumble", "ledgeHang"].includes(pose) });
const grab = KAELTHAS_MOVES.normals[AttackStyle.grab]!;
actions.push({ pose: "grab", frames: grab.totalFrames, contact: grab.startupFrames, gesture: { ...forward, arm: -105 }, target: [75, 75], paired: true });
actions.push({ pose: "grabHold", frames: 30, contact: 1, gesture: { ...forward, arm: -100 }, target: [65, 80], hold: true, paired: true });
actions.push({ pose: "grabbed", frames: 30, contact: 1, gesture: { chest: -35, pelvis: 20, head: 30, arm: 30, leftArm: 35 }, hold: true, paired: true });
for (const [pose, code, gesture, target] of [
  ["pummel", GrabAction.pummel, { ...forward, arm: -70, leftArm: -105 }, [50, 75]],
  ["throwForward", GrabAction.throwForward, forward, [90, 75]],
  ["throwBack", GrabAction.throwBack, back, [-70, 90]],
  ["throwUp", GrabAction.throwUp, overhead, [10, 160]],
  ["throwDown", GrabAction.throwDown, low, [55, 20]],
] as const) {
  const timing = KAELTHAS_MOVES.throws[code]!;
  const frames = pose === "pummel" ? 24 : timing.totalFrames, contact = pose === "pummel" ? 8 : timing.contactFrame;
  actions.push({ pose, frames, contact, gesture, target, paired: true });
  const victimPose = pose === "pummel" ? "victimPummel" : `victim${pose[0]!.toUpperCase()}${pose.slice(1)}` as HeroPose;
  actions.push({ pose: victimPose, frames, contact, gesture: pose === "throwUp" ? { ...brace, lean: -30, thigh: 55 } : pose === "throwDown" ? { ...brace, lean: 70 } : pose === "throwBack" ? { chest: 35, pelvis: -15, lean: 25 } : { chest: -40, pelvis: 15, head: -25, lean: -25 }, paired: true, air: pose === "throwUp" });
}
for (const pose of ["rollForward", "techForward", "getUpRollForward", "ledgeRoll", "rollBackward", "techBackward", "getUpRollBackward"] as const)
  actions.push({ pose, frames: pose.startsWith("tech") ? 40 : 31, contact: 10, gesture: brace, roll: pose.endsWith("Backward") ? -1 : 1 });
const TUCK: Gesture = { tx: 4, tz: -10, chest: 20, lean: 12, arm: -30, elbow: -110, leftArm: -30, leftElbow: -110, thigh: -55, knee: -90, leftThigh: -55, leftKnee: -90 };
const DIVE: Gesture = { tx: 4, lean: 8, arm: -178, leftArm: -178, thigh: 15, leftThigh: 15 };
const PHOENIX: Key[] = [
  { frame: 0, g: {} },
  { frame: 8, g: { tx: -38, tz: 12, lean: -4, chest: -10, arm: -150, elbow: -20, leftArm: -150, leftElbow: -20, thigh: -45, knee: -70, leftThigh: -45, leftKnee: -70 } },
  { frame: 19, g: TUCK, ease: "in" },
  { frame: 20, g: { ...TUCK, tx: 11, tz: -14, lean: 15 }, ease: "out" },
  { frame: 42, g: along(TUCK, DIVE, 0.15) },
  { frame: 46, g: DIVE, ease: "out" },
  { frame: 72, g: DIVE },
  { frame: 77, g: { lean: -4, arm: 40, leftArm: 40, thigh: -20, knee: -30, leftThigh: 10 }, ease: "linear" },
  { frame: 82, g: {}, ease: "linear" },
  { frame: 84, g: {} },
];

for (const [pose, key] of [["neutralSpecial", "neutral"], ["sideSpecial", "side"], ["upSpecial", "up"], ["downSpecial", "down"]] as const) {
  const special = KAELTHAS_SPECIALS[key]!;
  for (const air of [false, true]) {
    const form = air ? special.air ?? special.ground : special.ground;
    const first = key === "neutral" ? form.projectiles![0]!.spawnFrame : key === "side" ? form.commandGrab!.first : (form.regions![0]!.firstFrame + 1);
    const last = key === "neutral" ? first : key === "side" ? form.commandGrab!.last : form.regions![0]!.lastFrame + 1;
    const keys = key === "up" ? PHOENIX : strikeKeys(form.endFrame, first, last - first + 1, STRIKES[pose]!);
    actions.push({ pose: (air ? `${pose}Air` : pose) as HeroPose, frames: form.endFrame, contact: first, gesture: keys[2]!.g, keys, air, float: key === "up" });
  }
}
const damageActions: Action[] = [];
for (let height = 0; height < 3; height++) for (let strength = 0; strength < 3; strength++) {
  const gain = [0.5, 0.9, 1.3][strength]!;
  damageActions.push({ pose: "damageGround", frames: 24, contact: 1, hold: true, pain: true,
    gesture: height === 0 ? { thigh: 65 * gain, knee: -65 * gain, leftThigh: -50 * gain, pelvis: 28 * gain, chest: 25 * gain, head: -15 * gain }
    : height === 1 ? { chest: 55 * gain, pelvis: -25 * gain, arm: 30 * gain, leftArm: 35 * gain, head: 12 * gain }
    : { head: -45 * gain, chest: -35 * gain, arm: 45 * gain, leftArm: 55 * gain, pelvis: 10 * gain } });
}
function rotated(q: ArrayLike<number>, y: number, z = 0) {
  const a = y * Math.PI / 360, b = z * Math.PI / 360;
  const [i, j, k, l] = [-Math.sin(a) * Math.sin(b), Math.sin(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.cos(a) * Math.cos(b)];
  const [x = 0, v = 0, w = 0, t = 1] = Array.from(q);
  const out = [l! * x + i! * t + j! * w - k! * v, l! * v - i! * w + j! * t + k! * x, l! * w + i! * v - j! * x + k! * t, l! * t - i! * x - j! * v - k! * w];
  const length = Math.hypot(...out); return new Float32Array(out.map(n => n / length));
}
function joint(name: string, g: Gesture): [number, number] {
  if (name === "Bone_Chest") return [g.chest ?? 0, g.yaw ?? 0];
  if (name === "Bone_Pelvis") return [g.pelvis ?? 0, 0];
  if (name === "Bone_Arm1_R") return [g.arm ?? 0, 0];
  if (name === "Bone_Arm2_R") return [g.elbow ?? 0, 0];
  if (name === "Bone_Hand_R") return [g.hand ?? 0, 0];
  if (name === "Bone_Arm1_L") return [g.leftArm ?? 0, 0];
  if (name === "Bone_Arm2_L") return [g.leftElbow ?? 0, 0];
  if (name === "Bone_Head") return [g.head ?? 0, 0];
  if (name === "Bone_Leg1_R") return [g.thigh ?? 0, 0];
  if (name === "Bone_Leg1_L") return [g.leftThigh ?? 0, 0];
  if (name === "Bone_Leg2_R") return [g.knee ?? 0, 0];
  if (name === "Bone_Leg2_L") return [g.leftKnee ?? g.knee ?? 0, 0];
  if (name === "Bone_Root") return [g.lean ?? 0, 0];
  return [0, 0];
}
const eased = (ease: Ease | undefined, t: number) => ease === "in" ? t * t : ease === "out" ? t * (2 - t) : ease === "linear" ? t : t * t * (3 - 2 * t);
function keyedGesture(keys: readonly Key[], frame: number): Gesture {
  let a = keys[0]!, b = keys[keys.length - 1]!;
  for (let i = 0; i + 1 < keys.length; i++) if (frame >= keys[i]!.frame && frame <= keys[i + 1]!.frame) { a = keys[i]!; b = keys[i + 1]!; break; }
  const t = b.frame === a.frame ? 1 : eased(b.ease, Math.min(1, Math.max(0, (frame - a.frame) / (b.frame - a.frame))));
  const out: Gesture = {};
  for (const field of GESTURE_FIELDS) {
    const from = field === "knee" ? a.g.knee ?? 0 : field === "leftKnee" ? a.g.leftKnee ?? a.g.knee ?? 0 : a.g[field] ?? 0;
    const to = field === "knee" ? b.g.knee ?? 0 : field === "leftKnee" ? b.g.leftKnee ?? b.g.knee ?? 0 : b.g[field] ?? 0;
    out[field] = from + (to - from) * t;
  }
  return out;
}
const originals = new Map<string, mdx.AnimVector>(); tracks(source, (t, p) => originals.set(p, t));
const standLowest = (() => { const triangles = new DrawnModel(originalBytes, 1).triangles(0, 0, 1); let lowest = Infinity; for (let i = 1; i < triangles.length; i += 2) lowest = Math.min(lowest, triangles[i]!); return lowest; })();
let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
const cutoff = cursor, bindings: string[] = [], damageBindings: string[] = [];
const records: { pose: string; index: number; frames: number; contact: number }[] = [];
for (const [ordinal, action] of [...actions, ...damageActions].entries()) {
  const index = model.Sequences.length, start = cursor, end = start + Math.round(action.frames * 1000 / 60); cursor = end + 100;
  const name = ordinal < actions.length ? `Kaelthas ${action.pose}` : `Kaelthas Damage ${Math.floor((ordinal - actions.length) / 3)} ${(ordinal - actions.length) % 3}`;
  model.Sequences.push({ ...stand, Name: name, Interval: new Uint32Array([start, end]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
  const phaseFrames = action.keys ? Array.from({ length: action.frames + 1 }, (_, i) => i) : [...new Set([0, Math.max(1, action.contact - 3), action.contact, Math.min(action.frames - 1, action.contact + 4), action.frames,
    ...(action.roll ? Array.from({ length: Math.ceil(action.frames / 3) }, (_, i) => i * 3) : []),
    ...(action.pose === "victimPummel" ? [action.contact - 1] : [])])].sort((a, b) => a - b);
  const amount = (frame: number) => action.hold || action.pain ? 1 : action.pose === "victimPummel" && frame < action.contact ? 0 : action.pose === "knockdown" && frame >= action.contact ? 1 : frame === 0 || frame === action.frames ? 0 : frame < action.contact ? -0.3 : 1;
  tracks(model, (track, path) => {
    const donor = originals.get(path); if (!donor || globalClock(donor)) return;
    const first = donor.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]); if (!first) return;
    const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const moved = /^\.(Bones|Helpers)\.(\d+)\.Translation$/.exec(path);
    const rootTranslation = action.keys !== undefined && moved !== null && source[moved[1] as "Bones" | "Helpers"][Number(moved[2])]?.Name === "Bone_Root";
    const node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
    for (const frame of phaseFrames) {
      let Vector = first.Vector.slice();
      const keyed = action.keys ? keyedGesture(action.keys, frame) : undefined;
      if (rootTranslation && keyed) { Vector[0] = Vector[0]! + (keyed.tx ?? 0); Vector[2] = Vector[2]! + (keyed.tz ?? 0); }
      if (node && keyed) { const [y, z] = joint(node.Name, keyed); Vector = rotated(first.Vector, y, z); }
      else if (node) { let [y, z] = joint(node.Name, action.gesture); y = node.Name === "Bone_Root" && action.roll ? frame / action.frames * 360 * action.roll : y * amount(frame);
        if (node.Name === "Bone_Root" && (action.pose === "getUp" || action.pose === "getUpAttack" || action.pose.startsWith("getUpRoll"))) y += 85 * Math.max(0, 1 - frame / action.contact);
        z *= amount(frame); Vector = rotated(first.Vector, y, z); }
      const tangent = () => match || track.LineType === mdx.LineType.Bezier ? Vector.slice() : new Float32Array(Vector.length);
      track.Keys.push({ ...first, Frame: start + Math.round(frame * 1000 / 60), Vector, ...(first.InTan ? { InTan: tangent(), OutTan: tangent() } : {}) });
    }
  });
  if (action.target && !action.keys) {
    const renderer = new ModelRenderer(model), data = Reflect.get(renderer, "rendererData"); renderer.setSequence(index); data.frame = start + Math.round(action.contact * 1000 / 60);
    const arm = model.Nodes.find(n => n.Name === "Bone_Arm1_R")!, elbow = model.Nodes.find(n => n.Name === "Bone_Arm2_R")!, hand = model.Nodes.find(n => n.Name === "Bone_Hand_R")!, pivot = model.PivotPoints[hand.ObjectId]!;
    const donor = (n: mdx.Node) => source.Nodes[n.ObjectId]!.Rotation!.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1])!.Vector;
    const armBase = donor(arm), elbowBase = donor(elbow);
    const set = (node: mdx.Node, base: ArrayLike<number>, y: number, z: number) => { for (const frame of phaseFrames) { const key = node.Rotation!.Keys.find(k => k.Frame === start + Math.round(frame * 1000 / 60))!; key.Vector = rotated(base, y * amount(frame), z * amount(frame)); if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); } } };
    const angles = [0, 0, 0, 0];
    const loss = () => { set(arm, armBase, angles[0]!, angles[1]!); set(elbow, elbowBase, angles[2]!, angles[3]!); renderer.update(0); const matrix = data.nodes[hand.ObjectId].matrix; const x = matrix[0] * pivot[0]! + matrix[4] * pivot[1]! + matrix[8] * pivot[2]! + matrix[12], z = matrix[2] * pivot[0]! + matrix[6] * pivot[1]! + matrix[10] * pivot[2]! + matrix[14]; return (x - action.target![0]) ** 2 + (z - action.target![1]) ** 2; };
    for (let pass = 0; pass < 3; pass++) for (let dim = 0; dim < 4; dim++) { let best = Infinity, bestAngle = 0; for (let value = -180; value <= 180; value += pass === 0 ? 20 : 5) { angles[dim] = value; const distance = loss(); if (distance < best) { best = distance; bestAngle = value; } } angles[dim] = bestAngle; }
    loss();
  }
  const root = model.Nodes.find(n => n.Name === "Bone_Root")!;
  ensure(root.Translation, "Blood Mage root has no translation");
  const drawn = new DrawnModel(generateMDX(model), 1);
  for (const frame of phaseFrames) {
    const triangles = drawn.triangles(index, frame / 60, 1); let lowest = Infinity;
    for (let i = 1; i < triangles.length; i += 2) lowest = Math.min(lowest, triangles[i]!);
    const key = root.Translation.Keys.find(k => k.Frame === start + Math.round(frame * 1000 / 60))!;
    const lift = action.air ? 0 : action.float ? (action.keys ? Math.max(0, standLowest - lowest) : 0) : -lowest + (action.keys ? standLowest : 0);
    if (lift !== 0) { key.Vector[2] = key.Vector[2]! + lift; if (key.InTan) { key.InTan = root.Translation.LineType === mdx.LineType.Bezier ? key.Vector.slice() : new Float32Array(3); key.OutTan = key.InTan.slice(); } }
  }
  const victim = /^victim(Pummel|Throw)/.test(action.pose);
  const binding = `{ index: ${index}, seconds: ${seconds(victim ? 1 : (end - start) / 1000)}, aligned: true${action.paired ? `, contact: ${seconds(victim ? 0.5 : action.contact / 60)}` : ""} }`;
  if (ordinal < actions.length) bindings.push(`  ${action.pose}: ${binding},`); else damageBindings.push(`  ${binding},`);
  records.push({ pose: name, index, frames: action.frames, contact: action.contact });
}

for (const [ordinal, action] of actions.entries()) if (/^victim(Pummel|Throw)/.test(action.pose)) {
  const sequence = model.Sequences[source.Sequences.length + ordinal]!;
  const [first, last] = sequence.Interval, contact = first! + Math.round(action.contact * 1000 / 60), start = cursor;
  cursor = start + 1100;
  tracks(model, track => {
    if (globalClock(track)) return;
    for (const key of track.Keys) if (key.Frame >= first! && key.Frame <= last!)
      key.Frame = start + (key.Frame <= contact ? Math.round((key.Frame - first!) / (contact - first!) * 500)
        : 500 + Math.round((key.Frame - contact) / (last! - contact) * 500));
    track.Keys.sort((a, b) => a.Frame - b.Frame);
  });
  sequence.Interval = new Uint32Array([start, start + 1000]);
  action.frames = 60; action.contact = 30;
  records[ordinal]!.frames = 60; records[ordinal]!.contact = 30;
}
const normalReach: unknown[] = [];
const stripped = structuredClone(model); stripped.Sequences = stripped.Sequences.slice(0, source.Sequences.length);
tracks(stripped, track => { if (!globalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
ensure(isDeepStrictEqual(stripped, source), "Authored suffix changed original body or animation");
const bytes = generateMDX(model), decoded = parseMDX(bytes);
ensure(isDeepStrictEqual(parseMDX(generateMDX(decoded)), decoded), "MDX round trip changed model");
mkdirSync(output, { recursive: true }); await Bun.write(join(output, "herobloodelf.mdx"), bytes);
if (look === "classic") await Bun.write(join(project, "ts/src/game/sim/heroes/kaelthasClips.ts"), [
  "",
  'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClip, HeroClipTable } from "./hero";',
  'export const KAELTHAS_MODEL_FILE = "units\\\\human\\\\HeroBloodElf\\\\HeroBloodElf.mdl";',
  'export const KAELTHAS_FALLBACK: HeroClip = { index: 0, seconds: 1.5 };',
  'export const KAELTHAS_CLIPS = { idle: KAELTHAS_FALLBACK, walk: { index: 2, seconds: f32(0.933) }, dash: { index: 2, seconds: f32(0.933) }, run: { index: 2, seconds: f32(0.933) }, ko: { index: 9, seconds: 3.0 },',
  ...bindings, '} as const satisfies HeroClipTable;', 'export const KAELTHAS_DAMAGE_CLIPS: readonly HeroClip[] = [', ...damageBindings, '];', "",
].join("\n"));
const finalDrawn = new DrawnModel(bytes, 0.62);
const distance = (a: Float32Array, b: Float32Array) => { ensure(a.length === b.length && a.length > 0, "Missing drawn body"); let maximum = 0; for (let i = 0; i < a.length; i += 2) maximum = Math.max(maximum, Math.hypot(a[i]! - b[i]!, a[i + 1]! - b[i + 1]!)); return maximum; };
let measured = 0;
for (const [i, action] of [...actions, ...damageActions].entries()) {
  const index = source.Sequences.length + i;
  const first = finalDrawn.triangles(index, 0, 1), contact = finalDrawn.triangles(index, action.contact / 60, 1);
  ensure(action.hold ? distance(contact, finalDrawn.triangles(index, action.frames / 60, 1)) < 0.01 : distance(first, contact) > 3, `${action.pose}: dead or drifting gesture`);
  const panels: PoseFrame[] = [1, -1].flatMap(facing => [0, Math.max(1, action.contact - 3), action.contact, Math.min(action.frames, action.contact + 4), action.frames].map(frame => ({ frame, phase: frame < action.contact ? AttackPhase.startup : frame <= action.contact + 4 ? AttackPhase.active : AttackPhase.recovery, x: 0, z: 0, facing, parts: [], strikes: [], clip: index, seconds: frame / 60 })));
  await Bun.write(join(output, `${records[i]!.pose.replaceAll(" ", "-")}.png`), sheet(records[i]!.pose, finalDrawn, panels, 5).png); measured++;
}
await Bun.write(join(output, "kaelthas-clips.json"), JSON.stringify({ stockSequences: source.Sequences.length, appended: records.length, measuredBothFacings: measured, records }, null, 2) + "\n");
await Bun.write(join(output, "normal-reach.json"), JSON.stringify(normalReach, null, 2) + "\n");
console.log(`KAELTHAS_CLIPS_PASS ${records.length} authored clips; ${source.Sequences.length} stock sequences retained; ${measured} both-facing sheets; private output ${output}`);
