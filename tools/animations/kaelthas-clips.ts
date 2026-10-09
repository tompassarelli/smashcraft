
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
const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/kaelthas-clips.ts STOCK_BLOOD_MAGE.mdx PRIVATE_OUTPUT");
const originalBytes = await Bun.file(input).arrayBuffer();
const source = parseMDX(originalBytes), model = structuredClone(source);
ensure(source.Sequences.length === 11 && source.Bones.some(b => b.Name === "Bone_Hand_R"), "Expected original classic Blood Mage");
const stand = source.Sequences[0]!;
interface Gesture { chest?: number; pelvis?: number; arm?: number; elbow?: number; hand?: number; leftArm?: number; leftElbow?: number; head?: number; thigh?: number; knee?: number; leftThigh?: number; yaw?: number; lean?: number; }
interface Action { pose: HeroPose; frames: number; contact: number; gesture: Gesture; hold?: boolean; air?: boolean; roll?: number; target?: readonly [number, number]; paired?: boolean; pain?: boolean; }
const forward: Gesture = { chest: 15, pelvis: -8, arm: -95, elbow: 15, leftArm: -35, leftElbow: -20, head: -8, thigh: 12, leftThigh: -8 };
const overhead: Gesture = { chest: -18, pelvis: 8, arm: -165, elbow: -10, leftArm: -140, head: -18, thigh: -12, leftThigh: 15 };
const low: Gesture = { chest: 45, pelvis: 18, arm: -45, elbow: 15, leftArm: -60, head: -20, thigh: 45, knee: -55, leftThigh: -25 };
const back: Gesture = { chest: -12, pelvis: -15, arm: 40, leftArm: -55, head: 20, yaw: 105 };
const cast: Gesture = { chest: -15, pelvis: 8, arm: -120, elbow: -30, leftArm: -115, leftElbow: -20, head: -12 };
const brace: Gesture = { chest: 28, pelvis: 12, arm: -50, elbow: -30, leftArm: -70, leftElbow: -25, head: -15, thigh: 38, knee: -65, leftThigh: -35 };
const actions: Action[] = [];
const normals: readonly [HeroPose, AttackStyle, Gesture, readonly [number, number]][] = [
  ["jab", AttackStyle.jab, { ...forward, chest: 8, arm: -65 }, [48, 65]],
  ["jab2", AttackStyle.jab2, forward, [60, 70]],
  ["forwardTilt", AttackStyle.forwardTilt, forward, [80, 75]],
  ["forwardTiltUp", AttackStyle.forwardTiltUp, { ...overhead, arm: -125 }, [65, 110]],
  ["forwardTiltDown", AttackStyle.forwardTiltDown, low, [70, 22]],
  ["upTilt", AttackStyle.upTilt, overhead, [12, 155]],
  ["downTilt", AttackStyle.downTilt, low, [75, 15]],
  ["dashAttack", AttackStyle.dashAttack, { ...forward, lean: 15 }, [80, 65]],
  ["forwardSmash", AttackStyle.forwardSmash, { ...forward, chest: 30, leftArm: -100 }, [85, 82]],
  ["upSmash", AttackStyle.upSmash, { ...overhead, chest: -25 }, [0, 166]],
  ["downSmash", AttackStyle.downSmash, { ...low, leftArm: 65, yaw: 25 }, [70, 20]],
  ["neutralAir", AttackStyle.neutralAir, { ...cast, leftArm: 65, yaw: 65 }, [70, 80]],
  ["forwardAir", AttackStyle.forwardAir, { ...forward, thigh: 25, leftThigh: -30 }, [82, 85]],
  ["backAir", AttackStyle.backAir, back, [-75, 85]],
  ["upAir", AttackStyle.upAir, overhead, [0, 158]],
  ["downAir", AttackStyle.downAir, { ...low, chest: 28, lean: -10, thigh: 40, leftThigh: -25 }, [25, 20]],
];
for (const [pose, style, gesture, target] of normals) {
  const move = KAELTHAS_MOVES.normals[style]; ensure(move, `${pose}: missing timing`);
  actions.push({ pose, frames: move.totalFrames, contact: move.startupFrames, gesture, target, air: pose.endsWith("Air") });
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
for (const [pose, key, gesture, contact, target] of [
  ["neutralSpecial", "neutral", { ...cast, chest: 30 }, 8, [75, 45]],
  ["sideSpecial", "side", { ...cast, arm: -105, leftArm: -65 }, 15, [82, 80]],
  ["upSpecial", "up", { ...overhead, thigh: -50, leftThigh: 40, lean: -15 }, 11, [5, 160]],
  ["downSpecial", "down", { ...brace, leftArm: 70, arm: -100, yaw: 30 }, 13, [70, 70]],
] as const) {
  const special = KAELTHAS_SPECIALS[key]!;
  for (const air of [false, true]) {
    const form = air ? special.air ?? special.ground : special.ground;
    const projectile = key === "neutral" ? form.projectiles?.[0] : undefined;
    const release = projectile === undefined ? contact : projectile.spawnFrame + (projectile.activeFrom ?? 1) - 1;
    actions.push({ pose: (air ? `${pose}Air` : pose) as HeroPose, frames: form.endFrame, contact: release, gesture: air ? { ...gesture, thigh: 30, leftThigh: -35 } : gesture, target, air });
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
  if (/^Bone_Leg2_[LR]$/.test(name)) return [g.knee ?? 0, 0];
  if (name === "Bone_Root") return [g.lean ?? 0, 0];
  return [0, 0];
}
const originals = new Map<string, mdx.AnimVector>(); tracks(source, (t, p) => originals.set(p, t));
let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
const cutoff = cursor, bindings: string[] = [], damageBindings: string[] = [];
const records: { pose: string; index: number; frames: number; contact: number }[] = [];
for (const [ordinal, action] of [...actions, ...damageActions].entries()) {
  const index = model.Sequences.length, start = cursor, end = start + Math.round(action.frames * 1000 / 60); cursor = end + 100;
  const name = ordinal < actions.length ? `Kaelthas ${action.pose}` : `Kaelthas Damage ${Math.floor((ordinal - actions.length) / 3)} ${(ordinal - actions.length) % 3}`;
  model.Sequences.push({ ...stand, Name: name, Interval: new Uint32Array([start, end]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
  const phaseFrames = [...new Set([0, Math.max(1, action.contact - 3), action.contact, Math.min(action.frames - 1, action.contact + 4), action.frames,
    ...(action.roll ? Array.from({ length: Math.ceil(action.frames / 3) }, (_, i) => i * 3) : []),
    ...(action.pose === "victimPummel" ? [action.contact - 1] : [])])].sort((a, b) => a - b);
  const amount = (frame: number) => action.hold || action.pain ? 1 : action.pose === "victimPummel" && frame < action.contact ? 0 : action.pose === "knockdown" && frame >= action.contact ? 1 : frame === 0 || frame === action.frames ? 0 : frame < action.contact ? -0.3 : 1;
  tracks(model, (track, path) => {
    const donor = originals.get(path); if (!donor || globalClock(donor)) return;
    const first = donor.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]); if (!first) return;
    const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
    for (const frame of phaseFrames) {
      let Vector = first.Vector.slice();
      if (node) { let [y, z] = joint(node.Name, action.gesture); y = node.Name === "Bone_Root" && action.roll ? frame / action.frames * 360 * action.roll : y * amount(frame);
        if (node.Name === "Bone_Root" && (action.pose === "getUp" || action.pose === "getUpAttack" || action.pose.startsWith("getUpRoll"))) y += 85 * Math.max(0, 1 - frame / action.contact);
        z *= amount(frame); Vector = rotated(first.Vector, y, z); }
      const tangent = () => match || track.LineType === mdx.LineType.Bezier ? Vector.slice() : new Float32Array(Vector.length);
      track.Keys.push({ ...first, Frame: start + Math.round(frame * 1000 / 60), Vector, ...(first.InTan ? { InTan: tangent(), OutTan: tangent() } : {}) });
    }
  });
  if (action.target) {
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
    if (!action.air) { key.Vector[2] = key.Vector[2]! - lowest; if (key.InTan) { key.InTan = root.Translation.LineType === mdx.LineType.Bezier ? key.Vector.slice() : new Float32Array(3); key.OutTan = key.InTan.slice(); } }
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
const normalReach = [];
let tiltForward = 0;
for (const style of [AttackStyle.forwardTilt, AttackStyle.jab, AttackStyle.jab2, AttackStyle.forwardTiltUp,
  AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack]) {
  const ordinal = normals.findIndex(normal => normal[1] === style), action = actions[ordinal]!;
  const index = source.Sequences.length + ordinal, [start, end] = model.Sequences[index]!.Interval;
  const root = model.Nodes.find(node => node.Name === "Bone_Root")!, chest = model.Nodes.find(node => node.Name === "Bone_Chest")!;
  const donor = (node: mdx.Node) => source.Nodes[node.ObjectId]!.Rotation!.Keys.find(key => key.Frame >= stand.Interval[0] && key.Frame <= stand.Interval[1])!.Vector;
  const rootBase = donor(root), chestBase = donor(chest);
  const translation = root.Translation!.Keys.filter(key => key.Frame >= start! && key.Frame <= end!);
  const translationBase = translation.map(key => key.Vector.slice());
  const rotationKeys = (node: mdx.Node) => node.Rotation!.Keys.filter(key => key.Frame >= start! && key.Frame <= end!);
  const rootKeys = rotationKeys(root), chestKeys = rotationKeys(chest);
  const set = (keys: typeof rootKeys, base: ArrayLike<number>, active: number, recoil: number) => {
    for (const key of keys) {
      const frame = Math.round((key.Frame - start!) * 60 / 1000);
      const angle = frame === 0 || frame === action.frames ? 0 : frame < action.contact ? recoil : active;
      key.Vector = rotated(base, angle);
      if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); }
    }
  };
  let selected: ReturnType<typeof measureDrawnReach> | undefined;

  selection: for (const slack of [0, 2]) for (const activeRoot of [0, 20, -20, 40, -40, 60, -60])
    for (const activeChest of [action.gesture.chest ?? 0, 20, -20, 40, -40, 60, -60, 80, -80, 100, -100])
      for (const recoilRoot of [60, -60, 30, -30, 0, 80, -80]) {
        set(rootKeys, rootBase, activeRoot, recoilRoot);
        set(chestKeys, chestBase, activeChest, 35);
        for (const [i, key] of translation.entries()) {
          key.Vector = translationBase[i]!.slice();
          if (key.InTan) { key.InTan = root.Translation!.LineType === mdx.LineType.Bezier ? key.Vector.slice() : new Float32Array(3); key.OutTan = key.InTan.slice(); }
        }
        const floor = new DrawnModel(generateMDX(model), 1);
        for (const key of translation) {
          const triangles = floor.triangles(index, (key.Frame - start!) / 1000, 1);
          let lowest = Infinity;
          for (let vertex = 1; vertex < triangles.length; vertex += 2) lowest = Math.min(lowest, triangles[vertex]!);
          key.Vector[2] = key.Vector[2]! - lowest;
          if (key.InTan) { key.InTan = root.Translation!.LineType === mdx.LineType.Bezier ? key.Vector.slice() : new Float32Array(3); key.OutTan = key.InTan.slice(); }
        }
        const row = measureDrawnReach(new DrawnModel(generateMDX(model), characterModelScale(20)), 20, style);
        if (row.swing < 30 || row.peakFrame < row.firstActive - slack || row.peakFrame > row.lastActive + slack) continue;
        if (style === AttackStyle.forwardTilt && row.forward < 70) continue;
        if ((style === AttackStyle.jab || style === AttackStyle.jab2) && row.forward >= tiltForward) continue;
        selected = row;
        if (style === AttackStyle.forwardTilt) tiltForward = row.forward;
        normalReach.push({ style, activeRoot, activeChest, recoilRoot, ...row });
        console.log(`KAELTHAS_NORMAL_REACH_PASS ${style} ${JSON.stringify(normalReach.at(-1))}`);
        break selection;
      }
  ensure(selected, `${action.pose}: no skinned recoil/contact pose meets original reach gates`);
}
const stripped = structuredClone(model); stripped.Sequences = stripped.Sequences.slice(0, source.Sequences.length);
tracks(stripped, track => { if (!globalClock(track)) track.Keys = track.Keys.filter(k => k.Frame < cutoff); });
ensure(isDeepStrictEqual(stripped, source), "Authored suffix changed original body or animation");
const bytes = generateMDX(model), decoded = parseMDX(bytes);
ensure(isDeepStrictEqual(parseMDX(generateMDX(decoded)), decoded), "MDX round trip changed model");
mkdirSync(output, { recursive: true }); await Bun.write(join(output, "herobloodelf.mdx"), bytes);
await Bun.write(join(project, "ts/src/game/sim/heroes/kaelthasClips.ts"), [
  "// Generated by tools/animations/kaelthas-clips.ts from the stock classic Blood Mage rig.",
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
