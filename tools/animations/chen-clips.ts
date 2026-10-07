// Original action gestures over the private classic Pandaren Brewmaster rig.
// Usage: bun tools/animations/chen-clips.ts STOCK_CHEN.mdx PRIVATE_OUTPUT
import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, parseMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, AttackStyle, GrabAction } from "../../ts/src/game/sim/codes";
import { CHEN_MOVES } from "../../ts/src/game/sim/heroes/chenMoves";
import { CHEN_SPECIALS } from "../../ts/src/game/sim/heroes/chenSpecials";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { seconds } from "./asset-info";

const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
function ensure(ok: unknown, why: string): asserts ok { if (!ok) throw new Error(why); }
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/chen-clips.ts STOCK_CHEN.mdx PRIVATE_OUTPUT");
const source = parseMDX(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
ensure(source.Sequences.length === 11 && source.Helpers.some(n => n.Name === "Bone Rope"), "Expected original classic Pandaren Brewmaster");
const stand = source.Sequences[9]!;
function tracks(value: unknown, visit: (track: mdx.AnimVector, path: string) => void, path = "") {
  if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) return;
  if ("Keys" in value && Array.isArray(value.Keys)) { visit(value as mdx.AnimVector, path); return; }
  for (const [key, child] of Object.entries(value)) if (key !== "Nodes") tracks(child, visit, `${path}.${key}`);
}
const globalClock = (track: mdx.AnimVector) => track.GlobalSeqId != null && track.GlobalSeqId !== -1 && track.GlobalSeqId !== 0xffffffff;

interface Gesture {
  chest?: number; head?: number; hip?: number; waist?: number;
  staff?: number; staffYaw?: number; wrist?: number; palm?: number; palmYaw?: number; elbow?: number;
  front?: number; knee?: number; back?: number; backKnee?: number; lean?: number; turn?: number;
}
interface Action {
  pose: HeroPose; frames: number; contact: number; active?: number; gesture: Gesture;
  hold?: boolean; air?: boolean; roll?: number; spin?: boolean; rear?: Gesture; finish?: Gesture;
  paired?: boolean;
}
const thrust: Gesture = { chest: 18, hip: -8, staff: -85, wrist: 25, palm: -65, elbow: 15, front: 12, back: -12 };
const overhead: Gesture = { chest: -18, hip: 12, staff: -155, wrist: 35, palm: -115, head: -15, front: -12, back: 18 };
const crouch: Gesture = { chest: 30, hip: -10, front: -40, knee: 65, back: -35, backKnee: 60, staff: -25, palm: -45 };
const low: Gesture = { ...crouch, chest: 45, staff: -75, wrist: 65, palm: -60 };
const kick: Gesture = { chest: -15, hip: 10, front: -100, knee: 20, back: 25, backKnee: 35, staff: -30, palm: -80 };
const heel: Gesture = { chest: 25, hip: -12, back: 110, backKnee: -20, front: -15, knee: 30, staff: -55, palm: -40 };
const belly: Gesture = { chest: -30, hip: 20, lean: 20, staff: 20, palm: -75, front: 20, back: -25 };
const hold: Gesture = { chest: 15, palm: -100, elbow: -15, staff: -30, front: -10, knee: 20 };
const captive: Gesture = { chest: -28, head: -20, palm: 35, staff: 30, front: -25, knee: 40, back: 20 };
const actions: Action[] = [];
const normals: readonly [HeroPose, AttackStyle, Gesture][] = [
  ["jab", AttackStyle.jab, {...thrust, staff: -20, palm: -95, chest: 10}],
  ["jab2", AttackStyle.jab2, {...thrust, staff: -65, wrist: -25, palm: -20}],
  ["jab3", AttackStyle.jab3, belly],
  ["forwardTilt", AttackStyle.forwardTilt, thrust],
  ["forwardTiltUp", AttackStyle.forwardTiltUp, {...thrust, staff: -115, chest: -8}],
  ["forwardTiltDown", AttackStyle.forwardTiltDown, {...low, staff: -95}],
  ["upTilt", AttackStyle.upTilt, {...overhead, staff: -25, palm: -165, elbow: 60}],
  ["downTilt", AttackStyle.downTilt, {...kick, chest: 35, front: -85, knee: 5, back: -45, backKnee: 65}],
  ["dashAttack", AttackStyle.dashAttack, {...belly, lean: 35, chest: -40}],
  ["forwardSmash", AttackStyle.forwardSmash, {...thrust, chest: 38, staff: -115, wrist: 65, waist: 35, palm: -120}],
  ["upSmash", AttackStyle.upSmash, {...overhead, chest: -40, palm: -65, staff: -65, lean: -12}],
  ["downSmash", AttackStyle.downSmash, {...low, staff: -105, waist: 30}],
  ["neutralAir", AttackStyle.neutralAir, {...kick, front: -90, knee: 65, back: 85, backKnee: -50, palm: -100}],
  ["forwardAir", AttackStyle.forwardAir, kick],
  ["backAir", AttackStyle.backAir, heel],
  ["upAir", AttackStyle.upAir, overhead],
  ["downAir", AttackStyle.downAir, {...kick, chest: 28, front: 12, knee: -20, back: -90, backKnee: 110, staff: -100}],
  ["grab", AttackStyle.grab, hold],
];
for (const [pose, style, gesture] of normals) {
  const move = CHEN_MOVES.normals[style]; ensure(move, `${pose}: missing move timing`);
  actions.push({ pose, frames: move.totalFrames, contact: move.startupFrames, active: move.activeFrames, gesture, air: pose.endsWith("Air"),
    ...(pose === "downSmash" ? {rear: {...low, staff: 80, palm: 65, waist: -55}, active: 6} : {}) });
}
const extra: readonly [HeroPose, number, number, Gesture][] = [
  ["crouch", 30, 1, crouch], ["landing", 8, 2, crouch], ["shield", 30, 1, {...crouch, palm: -105, staff: -75}],
  ["airDodge", 49, 4, {...crouch, lean: -28}], ["smashCharge", 30, 1, {...overhead, staff: 35, palm: -50}],
  ["dizzy", 60, 22, {chest: -20, head: 30, staff: 18, palm: 35, waist: 20}],
  ["turn", 8, 4, {waist: 140, staff: -30, palm: -30}], ["stop", 8, 3, {...crouch, lean: -18}],
  ["jumpSquat", 5, 4, {...crouch, chest: 45}], ["jump", 24, 7, {...overhead, front: -65, knee: 80, back: 30}],
  ["doubleJump", 24, 7, {...kick, lean: -20}], ["wallJump", 24, 7, {...heel, lean: -25}], ["wallTech", 26, 5, crouch],
  ["fall", 30, 1, {...kick, front: -25, knee: 55, back: 40, backKnee: -20}],
  ["fallSpecial", 30, 1, {...captive, staff: -125, palm: -120, chest: 35}],
  ["ledgeHang", 30, 1, {...overhead, palm: -175, staff: -175, chest: 20}],
  ["ledgeClimb", 25, 10, {...overhead, lean: 30, front: -65, knee: 65}], ["ledgeAttack", 40, 20, thrust],
  ["knockdown", 30, 25, {...captive, lean: 88}], ["downDamage", 24, 5, {...captive, lean: 75}],
  ["getUp", 30, 18, {...crouch, lean: 35}], ["getUpAttack", 49, 16, {...low, staff: -115, waist: 35}],
  ["spotDodge", 22, 4, {...crouch, lean: -32}], ["tech", 26, 8, {...crouch, lean: 50}],
  ["damageGround", 24, 3, {...captive, chest: -40}], ["damageAir", 24, 3, {...captive, chest: -45, front: -70}],
  ["damageTumble", 30, 9, {...captive, lean: 75}], ["damageShield", 24, 3, {...crouch, chest: -25, palm: -125}],
  ["grabHold", 30, 1, hold], ["grabbed", 30, 1, captive],
];
for (const [pose, frames, contact, gesture] of extra) actions.push({pose, frames, contact, gesture,
  hold: ["crouch", "shield", "smashCharge", "fall", "fallSpecial", "ledgeHang", "grabHold", "grabbed"].includes(pose),
  air: ["airDodge", "jump", "doubleJump", "wallJump", "fall", "fallSpecial", "damageAir", "damageTumble", "ledgeHang"].includes(pose),
  ...(pose === "getUpAttack" ? {rear: {...low, staff: 95, palm: 65, waist: -65}, active: 16} : {}) });
for (const pose of ["rollForward", "techForward", "getUpRollForward", "ledgeRoll", "rollBackward", "techBackward", "getUpRollBackward"] as const)
  actions.push({pose, frames: pose.startsWith("tech") ? 40 : 31, contact: 10, gesture: crouch, roll: pose.endsWith("Backward") ? -1 : 1});
for (const [pose, throwAction, gesture] of [
  ["pummel", GrabAction.pummel, {...hold, front: -95, knee: 85, chest: 28}],
  ["throwForward", GrabAction.throwForward, {...thrust, palm: -130, chest: 40}],
  ["throwBack", GrabAction.throwBack, {...hold, palm: 130, staff: 70, waist: 155, chest: -20}],
  ["throwUp", GrabAction.throwUp, {...overhead, palm: -175, staff: -155}],
  ["throwDown", GrabAction.throwDown, {...low, palm: -55, chest: 70}],
] as const) {
  const move = CHEN_MOVES.throws[throwAction]; ensure(move, `${pose}: missing throw`);
  actions.push({pose, frames: move.totalFrames, contact: move.contactFrame, gesture, paired: true});
  actions.push({pose: `victim${pose[0]!.toUpperCase()}${pose.slice(1)}` as HeroPose, frames: move.totalFrames, contact: move.contactFrame,
    gesture: pose === "throwUp" ? {...captive, chest: -50, front: -85, back: 90, palm: -155, staff: -145}
      : pose === "throwDown" ? {...captive, chest: 70, lean: 75, front: -75, knee: 90}
      : pose === "throwBack" ? {...captive, chest: 40, lean: 40, palm: -120, staff: -110}
      : {...captive, chest: -55, lean: -35, palm: -90, staff: -80}, air: true, paired: true});
}
for (const [pose, key, gesture] of [
  ["neutralSpecial", "neutral", {...thrust, chest: 40, head: 20, staff: 30, palm: -25}],
  ["sideSpecial", "side", {...thrust, palm: -155, elbow: -10, chest: 15}],
  ["upSpecial", "up", {...overhead, palm: -135, staff: -170, front: -65, knee: 90, back: 30}],
  ["downSpecial", "down", {...crouch, chest: 40, staff: -80, palm: -110}],
] as const) {
  const move = CHEN_SPECIALS[key]; ensure(move, `${pose}: missing special`);
  for (const air of [false, true]) {
    const form = air ? move.air ?? move.ground : move.ground;
    const contact = Math.min(...[...(form.regions?.map(r => r.firstFrame) ?? []), ...(form.motion?.map(r => r.first) ?? []), ...(form.projectiles?.map(r => r.spawnFrame) ?? []), 16]);
    actions.push({pose: (air ? `${pose}Air` : pose) as HeroPose, frames: form.endFrame, contact, active: pose === "upSpecial" ? 22 : pose === "neutralSpecial" ? 11 : 4, gesture, air, spin: pose === "upSpecial"});
  }
}
for (const air of [false, true]) {
  actions.push({pose: air ? "downSpecialFollowUpAir" : "downSpecialFollowUp", frames: 32, contact: 8, active: 4, gesture: {...thrust, palm: -115, staff: 15, chest: 40}, air});
  actions.push({pose: air ? "sideSpecialFollowUpAir" : "sideSpecialFollowUp", frames: 28, contact: 5, active: 8,
    gesture: {...belly, lean: 42, chest: -25, front: -65, knee: 65, back: 55, palm: -80, staff: -30}, air});
}
const damage: Action[] = [];
for (let height = 0; height < 3; height++) for (let strength = 0; strength < 3; strength++) {
  const gain = [0.45, 0.8, 1.2][strength]!;
  const gesture: Gesture = height === 0 ? {chest: 28, hip: -30, front: -65, knee: 85, back: -45, backKnee: 65, palm: 35, head: -15}
    : height === 1 ? {chest: 55, hip: -22, palm: -65, staff: 35, waist: 25, front: -15, knee: 35}
    : {head: -55, chest: -35, palm: 50, staff: 45, hip: 15, front: 25, back: -20};
  for (const key of Object.keys(gesture) as (keyof Gesture)[]) gesture[key] = (gesture[key] ?? 0) * gain;
  damage.push({pose: "damageGround", frames: 24, contact: 1, hold: true, gesture});
}
function rotated(q: ArrayLike<number>, pitch: number, yaw = 0): Float32Array {
  const y = pitch * Math.PI / 360, z = yaw * Math.PI / 360;
  const a = [-Math.sin(y) * Math.sin(z), Math.sin(y) * Math.cos(z), Math.cos(y) * Math.sin(z), Math.cos(y) * Math.cos(z)];
  const [x = 0, v = 0, w = 0, s = 1] = Array.from(q);
  const [i = 0, j = 0, k = 0, l = 1] = a;
  const result = new Float32Array([l*x+i*s+j*w-k*v, l*v-i*w+j*s+k*x, l*w+i*v-j*x+k*s, l*s-i*x-j*v-k*w]);
  const norm = Math.hypot(...result); for (let n = 0; n < 4; n++) result[n] = result[n]! / norm;
  return result;
}
function joint(name: string, g: Gesture): [number, number] {
  if (name === "Bone_Root") return [g.lean ?? 0, g.turn ?? 0];
  if (name === "Bone_Chest") return [g.chest ?? 0, g.waist ?? 0];
  if (name === "Bone_Pelvis") return [g.hip ?? 0, (g.waist ?? 0) * -0.4];
  if (name === "Bone_Head") return [g.head ?? 0, 0];
  if (name === "Bone_Arm1_L") return [g.staff ?? 0, g.staffYaw ?? 0];
  if (name === "Bone_Arm2_L") return [g.wrist ?? 0, 0];
  if (name === "Bone_Arm1_R") return [g.palm ?? 0, g.palmYaw ?? 0];
  if (name === "Bone_Arm2_R") return [g.elbow ?? 0, 0];
  if (name === "Bone_Leg1_L") return [g.front ?? 0, 0];
  if (name === "Bone_Leg2_L") return [g.knee ?? 0, 0];
  if (name === "Bone_Leg1_R") return [g.back ?? 0, 0];
  if (name === "Bone_Leg2_R") return [g.backKnee ?? 0, 0];
  return [0, 0];
}
const originals = new Map<string, mdx.AnimVector>(); tracks(source, (track, path) => originals.set(path, track));
let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
const bindings: string[] = [], damageBindings: string[] = [], records: {pose: string; index: number; frames: number; contact: number; motion?: number}[] = [];
for (const [ordinal, action] of [...actions, ...damage].entries()) {
  const index = model.Sequences.length, start = cursor, end = start + Math.round(action.frames * 1000 / 60); cursor = end + 100;
  const name = ordinal < actions.length ? `Chen ${action.pose}` : `Chen Damage ${Math.floor((ordinal - actions.length) / 3)} ${(ordinal - actions.length) % 3}`;
  model.Sequences.push({...stand, Name: name, Interval: new Uint32Array([start, end]), NonLooping: !action.hold, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array([-300,-300,-200]), MaximumExtent: new Float32Array([300,300,350]), BoundsRadius: 400});
  const frameSet = action.hold ? [0, action.frames] : [0, Math.max(1, action.contact - 3), action.contact,
    Math.min(action.frames - 1, action.contact + (action.active ?? 4) - 1), action.frames];
  if (action.rear) frameSet.push(action.contact + 3);
  if (action.spin || action.roll) for (let f = 0; f < action.frames; f += 2) frameSet.push(f);
  const phaseFrames = [...new Set(frameSet)].sort((a,b) => a-b);
  tracks(model, (track, path) => {
    const donor = originals.get(path); if (!donor || globalClock(donor)) return;
    const first = donor.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]); if (!first) return;
    const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
    for (const frame of phaseFrames) {
      const activeEnd = action.contact + (action.active ?? 4) - 1;
      const amount = action.hold ? 1 : frame === 0 || frame === action.frames ? 0 : frame < action.contact ? -0.3 : frame <= activeEnd ? 1 : Math.max(0, (action.frames - frame) / (action.frames - activeEnd));
      const gesture = action.rear && frame >= action.contact + 3 ? action.rear : frame === action.frames && action.finish ? action.finish : action.gesture;
      let Vector = first.Vector.slice();
      if (node) {
        let [pitch, yaw] = joint(node.Name, gesture); pitch *= amount; yaw *= amount;
        if (node.Name === "Bone_Root") {
          if (action.roll) pitch = 360 * action.roll * frame / action.frames;
          if (action.spin) yaw = frame < action.contact ? 0 : Math.min(1, (frame - action.contact) / (action.active ?? 22)) * 720;
        }
        Vector = rotated(first.Vector, pitch, yaw);
      }
      const tangent = () => match || track.LineType === mdx.LineType.Bezier ? Vector.slice() : new Float32Array(Vector.length);
      track.Keys.push({...first, Frame: start + Math.round(frame * 1000 / 60), Vector,
        ...(first.InTan ? {InTan: tangent(), OutTan: tangent()} : {})});
    }
  });
  // The staff belongs to the left hand; both legs and the keg hand need
  // their contact points visible in the side view, despite the bind axes.
  const staffTargets: Partial<Record<HeroPose, readonly [number, number]>> = {
    jab2: [65,58], forwardTilt: [108,65], forwardTiltUp: [100,98], forwardTiltDown: [105,28],
    forwardSmash: [125,62], upAir: [15,160], downSmash: [115,26],
    getUpAttack: [105,40], ledgeAttack: [110,70],
  };
  const handTargets: Partial<Record<HeroPose, readonly [number, number]>> = {
    jab: [60,80], upTilt: [25,132], grab: [62,72], grabHold: [62,72],
    throwForward: [65,80], throwBack: [-70,85], throwUp: [15,140], throwDown: [65,35],
    neutralSpecial: [40,65], neutralSpecialAir: [40,65], sideSpecial: [65,105], sideSpecialAir: [65,105],
    downSpecialFollowUp: [70,75], downSpecialFollowUpAir: [70,75],
  };
  const footTargets: Partial<Record<HeroPose, readonly [number, number]>> = {
    downTilt: [70,20], forwardAir: [75,65], backAir: [-75,60], downAir: [12,-8], neutralAir: [65,70], pummel: [60,60],
  };
  const extendedLeg = footTargets[action.pose] ? model.Helpers.find(n=>n.Name===(action.pose==="backAir"?"Bone_Leg1_R":"Bone_Leg1_L")) : undefined;
  if (extendedLeg) {
    if (!extendedLeg.Scaling) extendedLeg.Scaling = {LineType: mdx.LineType.Linear, GlobalSeqId: null,
      Keys: source.Sequences.flatMap(s=>Array.from(s.Interval).map(Frame=>({Frame,Vector:new Float32Array([1,1,1])})))};
    for(const frame of phaseFrames){
      const activeEnd=action.contact+(action.active??4)-1;
      const amount=frame===0||frame===action.frames?0:frame<action.contact?0:frame<=activeEnd?1:Math.max(0,(action.frames-frame)/(action.frames-activeEnd));
      const scale=1+amount*0.65,Vector=new Float32Array([scale,scale,scale]);
      extendedLeg.Scaling.Keys.push({Frame:start+Math.round(frame*1000/60),Vector,
        ...(extendedLeg.Scaling.LineType>1?{InTan:Vector.slice(),OutTan:Vector.slice()}:{})});
    }
  }
  function fit(chain: readonly [string,string,string], target: readonly [number,number], afterFrame?: number) {
    const first=model.Helpers.find(n=>n.Name===chain[0]), second=model.Helpers.find(n=>n.Name===chain[1]), endpoint=model.Nodes.find(n=>n.Name===chain[2]);
    ensure(first?.Rotation && second?.Rotation && endpoint, `${action.pose}: missing contact chain`);
    const base=(n:mdx.Node)=>source.Nodes[n.ObjectId]!.Rotation!.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1])!.Vector;
    const bases=[base(first),base(second)];
    const renderer=new ModelRenderer(model), data=Reflect.get(renderer,"rendererData"), pivot=model.PivotPoints[endpoint.ObjectId]!;
    renderer.setSequence(index); data.frame=start+Math.round((afterFrame??action.contact)*1000/60);
    const angles=[0,0,0,0];
    function set() {
      for(const [part,node] of [first,second].entries())for(const frame of phaseFrames){
        if(afterFrame!==undefined&&frame<afterFrame)continue;
        const activeEnd=action.contact+(action.active??4)-1;
        const amount=action.hold?1:frame===0||frame===action.frames?0:frame<action.contact?-0.3:frame<=activeEnd?1:Math.max(0,(action.frames-frame)/(action.frames-activeEnd));
        const key=node.Rotation!.Keys.find(k=>k.Frame===start+Math.round(frame*1000/60))!;
        key.Vector=rotated(bases[part]!,angles[part*2]!*amount,angles[part*2+1]!*amount);
        if(key.InTan){key.InTan=key.Vector.slice();key.OutTan=key.Vector.slice();}
      }
    }
    function loss(){set();renderer.update(0);const a=data.nodes[endpoint.ObjectId].matrix;
      const x=a[0]*pivot[0]+a[4]*pivot[1]+a[8]*pivot[2]+a[12], y=a[1]*pivot[0]+a[5]*pivot[1]+a[9]*pivot[2]+a[13], z=a[2]*pivot[0]+a[6]*pivot[1]+a[10]*pivot[2]+a[14];
      return (x-target[0])**2+(z-target[1])**2+y*y*0.02;
    }
    for(let pass=0;pass<4;pass++)for(let dimension=0;dimension<4;dimension++){
      let best=Infinity, choice=0;
      for(let value=-180;value<=180;value+=pass<2?20:5){angles[dimension]=value;const distance=loss();if(distance<best){best=distance;choice=value;}}
      angles[dimension]=choice;
    }
    loss();
  }
  const staffTarget=staffTargets[action.pose]; if(staffTarget)fit(["Bone_Arm1_L","Bone_Arm2_L","Bone Rope"],staffTarget);
  const handTarget=handTargets[action.pose];if(handTarget)fit(["Bone_Arm1_R","Bone_Arm2_R","Bone_Hand_R"],handTarget);
  const footTarget=footTargets[action.pose];if(footTarget)fit(action.pose==="backAir"?["Bone_Leg1_R","Bone_Leg2_R","Bone_Foot_R"]:["Bone_Leg1_L","Bone_Leg2_L","Bone_Foot_L"],footTarget);
  if(action.rear)fit(["Bone_Arm1_L","Bone_Arm2_L","Bone Rope"],[-105,action.pose==="downSmash"?26:40],action.contact+3);
  const root = model.Helpers.find(n => n.Name === "Bone_Root"); ensure(root, "Chen root missing");
  if (!root.Translation) root.Translation = {LineType: mdx.LineType.Linear, GlobalSeqId: null,
    Keys: source.Sequences.flatMap(s => Array.from(s.Interval).map(Frame => ({Frame, Vector: new Float32Array([0,0,0])})))};
  if (!action.air) {
    const drawn = new DrawnModel(generateMDX(model), 1);
    for (const frame of phaseFrames) {
      const triangles = drawn.triangles(index, frame / 60, 1); let floor = Infinity;
      for (let i = 1; i < triangles.length; i += 2) floor = Math.min(floor, triangles[i]!);
      const time = start + Math.round(frame * 1000 / 60), old = root.Translation.Keys.find(k => k.Frame === time);
      const Vector = new Float32Array([old?.Vector[0] ?? 0, old?.Vector[1] ?? 0, (old?.Vector[2] ?? 0) - floor]);
      const key: mdx.AnimKeyframe = {...(old ?? {Frame: time, Vector}), Vector};
      if (root.Translation.LineType > 1) {key.InTan = new Float32Array(3); key.OutTan = new Float32Array(3);}
      if (old) Object.assign(old, key); else root.Translation.Keys.push(key);
    }
    root.Translation.Keys.sort((a,b) => a.Frame-b.Frame);
  }
  const victimContact = /^victim(Pummel|Throw)/.test(action.pose);
  const binding = `{ index: ${index}, seconds: ${seconds(victimContact ? 1 : (end-start)/1000)}, aligned: true${action.paired ? `, contact: ${seconds(victimContact ? 0.5 : action.contact/60)}` : ""} }`;
  if (ordinal < actions.length) bindings.push(`  ${action.pose}: ${binding},`); else damageBindings.push(`  ${binding},`);
  records.push({pose: name, index, frames: victimContact ? 60 : action.frames, contact: victimContact ? 30 : action.contact});
}
// Victim playback shares a half-second contact while holders retain their move timing.
for (const [ordinal, action] of actions.entries()) if (/^victim(Pummel|Throw)/.test(action.pose)) {
  const sequence = model.Sequences[source.Sequences.length + ordinal]!, [first, last] = sequence.Interval;
  const contact = first! + Math.round(action.contact * 1000 / 60), start = cursor;
  cursor = start + 1100;
  tracks(model, track => {
    if (globalClock(track)) return;
    for (const key of track.Keys) if (key.Frame >= first! && key.Frame <= last!)
      key.Frame = start + (key.Frame <= contact ? Math.round((key.Frame - first!) / (contact - first!) * 500)
        : 500 + Math.round((key.Frame - contact) / (last! - contact) * 500));
    track.Keys.sort((a, b) => a.Frame - b.Frame);
  });
  sequence.Interval = new Uint32Array([start, start + 1000]);
}
const bytes = generateMDX(model), drawn = new DrawnModel(bytes, 1), before = new DrawnModel(generateMDX(source), 1);
for (const [index, sequence] of source.Sequences.entries()) for (const at of [0, 0.5, 1]) {
  const time = (sequence.Interval[1]-sequence.Interval[0])*at/1000, a = before.triangles(index,time,1), b = drawn.triangles(index,time,1);
  ensure(a.length === b.length && a.every((v,i) => Math.abs(v-b[i]!) < 0.001), `${sequence.Name}: original geometry changed`);
}
for (const [ordinal, action] of [...actions, ...damage].entries()) {
  const record = records[ordinal]!, first = drawn.triangles(record.index,0,1), contact = drawn.triangles(record.index,record.contact/60,1);
  ensure(first.length > 0 && first.length === contact.length, `${record.pose}: model body missing`);
  let motion = 0;
  for (let frame=0; frame<=record.frames; frame++) {
    const triangles = drawn.triangles(record.index,frame/60,1);
    ensure(triangles.length === first.length, `${record.pose}: body disappears`);
    for (let i=0;i<first.length;i+=2) motion=Math.max(motion,Math.hypot(triangles[i]!-first[i]!,triangles[i+1]!-first[i+1]!));
  }
  ensure(action.hold ? motion < 0.01 : motion >= 8, `${record.pose}: ${action.hold ? "held pose drifts" : "gesture lacks visible travel"} ${motion}`);
  record.motion = motion;
}
const damageContacts=damage.map((_,i)=>drawn.triangles(source.Sequences.length+actions.length+i,0,1));
for(let a=0;a<damageContacts.length;a++)for(let b=a+1;b<damageContacts.length;b++)
  ensure(damageContacts[a]!.some((v,i)=>Math.abs(v-damageContacts[b]![i]!)>4),`Chen damage ${a}/${b}: indistinguishable contact pose`);
mkdirSync(output, {recursive:true}); await Bun.write(join(output,"chen.mdx"),bytes);
await Bun.write(join(project,"ts/src/game/sim/heroes/chenClips.ts"),[
  "// Generated by tools/animations/chen-clips.ts from the private classic Pandaren Brewmaster rig.",
  'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClip, HeroClipTable } from "./hero";', "",
  'export const CHEN_MODEL_FILE = "units\\\\creeps\\\\PandarenBrewmaster\\\\PandarenBrewmaster.mdl";',
  'export const CHEN_FALLBACK_CLIP: HeroClip = { index: 9, seconds: 1.0 };',
  'export const CHEN_CLIPS = { idle: CHEN_FALLBACK_CLIP, walk: {index: 0, seconds: f32(0.666)}, dash: {index: 0, seconds: f32(0.666)}, run: {index: 0, seconds: f32(0.666)}, ko: {index: 7, seconds: f32(2.667)},',
  ...bindings, '} as const satisfies HeroClipTable;', 'export const CHEN_DAMAGE_CLIPS: readonly HeroClip[] = [', ...damageBindings, '];', "",
].join("\n"));
const preview = new DrawnModel(bytes, 0.8);
for (const pose of ["jab","jab2","jab3","forwardTilt","forwardTiltUp","forwardTiltDown","upTilt","downTilt","forwardSmash","upSmash","downSmash","neutralAir","forwardAir","backAir","upAir","downAir","neutralSpecial","sideSpecial","upSpecial","downSpecial","downSpecialFollowUp","sideSpecialFollowUp","rollForward","getUpAttack","grab","throwForward","throwBack","throwUp","throwDown"] as const) {
  const ordinal = actions.findIndex(a => a.pose===pose), action=actions[ordinal]!, index=records[ordinal]!.index;
  const panels: PoseFrame[] = [1,-1].flatMap(facing => [0, Math.max(1,action.contact-3),action.contact,action.contact+(action.active??4)-1,action.frames].map(frame => ({frame,phase:frame<action.contact?AttackPhase.startup:frame<action.contact+(action.active??4)?AttackPhase.active:AttackPhase.recovery,x:0,z:0,facing,parts:[],strikes:[],clip:index,seconds:Math.min(action.frames,frame)/60})));
  await Bun.write(join(output,`${pose}.png`),sheet(`Chen ${pose}`,preview,panels,5).png);
}
await Bun.write(join(output,"chen-clips.json"),JSON.stringify({stockSequences:source.Sequences.length,appended:records.length,records},null,2)+"\n");
console.log(`CHEN_CLIPS_PASS ${records.length} authored clips; ${source.Sequences.length} stock sequences retained; ${output}`);
