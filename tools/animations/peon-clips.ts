import { chmodSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel, sheet } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase } from "../../ts/src/game/sim/codes";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";

const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/peon-clips.ts STOCK_PEON.mdx PRIVATE_OUTPUT");
mkdirSync(join(output, "hero-models"), { recursive: true });
const source = parseSource(await Bun.file(input).arrayBuffer());
ensure(source.Sequences.length === 22, "Use the unmodified stock Peon model");
const model = structuredClone(source), stand = source.Sequences[9];
ensure(stand?.Name === "Stand Ready", "Peon stock sequence order changed");

interface Gesture {
  readonly chest?: number; readonly head?: number; readonly axe?: number; readonly elbow?: number;
  readonly grip?: number; readonly knee?: number; readonly twist?: number; readonly lean?: number;
  readonly roll?: number; readonly yaw?: number; readonly tuck?: number; readonly height?: number;
}
interface Phase { readonly at: number; readonly pose: Gesture }
interface Action { readonly name: string; readonly frames: number; readonly phases: readonly Phase[]; readonly air?: boolean; readonly hold?: boolean; readonly contact?: number; readonly pain?: boolean }
const actions: Action[] = [];
const add = (name: string, frames: number, phases: readonly Phase[], options: Partial<Action> = {}) => actions.push({ name, frames, phases, ...options });
const phase = (at: number, pose: Gesture = {}): Phase => ({ at, pose });
const strike = (name: string, frames: number, first: number, last: number, coil: Gesture, hit: Gesture, exit: Gesture = {}, air = false) =>
  add(name, frames, [phase(0), phase(Math.max(0, first - 3), coil), phase(first, hit), phase(last, { ...hit, axe: (hit.axe ?? 0) + 12 }), phase(Math.min(frames - 1, last + 9), exit), phase(frames)], { air });

// The stock axe is attached to the right hand. Its free left hand handles
// lumber and grips; each attack moves the shoulders, chest and support legs.
strike("jab", 17, 3, 4, { axe: -25, chest: -8 }, { axe: -58, elbow: -18, chest: 14, knee: 8 });
strike("jab2", 25, 5, 6, { axe: -100, chest: -12 }, { axe: 24, elbow: 30, chest: 24, knee: 16 });
strike("forwardTilt", 29, 7, 9, { axe: -135, chest: -12, twist: -18 }, { axe: -30, elbow: -20, chest: 18, twist: 20, knee: 12 });
strike("forwardTiltUp", 29, 7, 9, { axe: -45, chest: 16 }, { axe: -155, elbow: -18, chest: -15, knee: 12 });
strike("forwardTiltDown", 29, 7, 9, { axe: -110, chest: -10 }, { axe: 35, elbow: 28, chest: 38, knee: 30 });
strike("upTilt", 30, 6, 9, { axe: 18, chest: 20, knee: 15 }, { axe: -170, elbow: -18, chest: -20, grip: -75, knee: 5 });
strike("downTilt", 27, 5, 7, { axe: -85, chest: -15 }, { axe: 50, elbow: 18, chest: 42, knee: 42, tuck: 0.16 });
strike("dashAttack", 38, 9, 12, { axe: -45, chest: -16, knee: 30 }, { axe: -75, elbow: -25, chest: 38, lean: 15, knee: 28 });
strike("forwardSmash", 59, 21, 23, { axe: -175, grip: -120, chest: -24, knee: 26 }, { axe: 35, grip: -25, elbow: 28, chest: 40, knee: 28 }, { axe: 40, chest: 28, knee: 20 });
strike("upSmash", 51, 16, 19, { axe: 10, chest: 30, knee: 35 }, { axe: -175, grip: -155, elbow: -22, chest: -26, knee: 0 });
add("downSmash", 54, [phase(0), phase(14, { axe: -160, knee: 25, chest: -15 }), phase(17, { axe: 45, chest: 40, knee: 35 }), phase(19, { axe: -130, yaw: 90, knee: 30 }), phase(20, { axe: 45, yaw: 180, chest: 40, knee: 35 }), phase(24, { axe: 65, yaw: 180, knee: 20 }), phase(40, { yaw: 300 }), phase(54, { yaw: 360 })]);
add("neutralAir", 31, [phase(0), phase(3, { axe: -135, grip: -80, twist: -35, knee: 40 }), phase(5, { axe: -70, grip: -100, yaw: 0, chest: 20, knee: 32 }), phase(9, { axe: -100, yaw: 180, chest: 25, knee: 38 }), phase(16, { yaw: 300, knee: 26 }), phase(31, { yaw: 360 })], { air: true });
strike("forwardAir", 38, 10, 12, { axe: -175, grip: -80, chest: -20, knee: 25 }, { axe: 40, elbow: 28, chest: 35, knee: 42 }, { chest: 20, axe: 45 }, true);
strike("backAir", 35, 8, 10, { axe: -35, grip: -105, chest: 22 }, { axe: -165, grip: -180, chest: -35, twist: 38, knee: 38 }, {}, true);
strike("upAir", 33, 7, 9, { axe: -50, chest: 20, knee: 42 }, { axe: -175, grip: -135, elbow: -22, chest: -24, knee: 10 }, {}, true);
strike("downAir", 45, 13, 16, { axe: -160, chest: -20, knee: 60 }, { axe: 18, elbow: 15, chest: 22, knee: 65 }, { axe: 25, chest: 15, knee: 50 }, true);
strike("neutralSpecial", 42, 18, 20, { grip: -145, chest: -20, twist: -25, knee: 20 }, { grip: -80, axe: -35, chest: 32, twist: 30, knee: 12 });
strike("sideSpecial", 52, 26, 29, { axe: -135, chest: 20, knee: 32 }, { axe: 50, grip: -70, chest: 40, knee: 35 });
add("upSpecial", 28, [phase(0), phase(6, { chest: 35, knee: 65, axe: 40, tuck: 0.2 }), phase(8, { chest: -15, axe: -155, grip: -110, knee: 10 }), phase(18, { chest: -25, axe: -170, grip: -150, knee: 45 }), phase(28, { chest: 15, knee: 50, axe: -75 })], { air: true });
add("downSpecial", 38, [phase(0), phase(3, { chest: 35, knee: 55, axe: -85, grip: -65, tuck: 0.16 }), phase(7, { chest: 38, knee: 55, axe: -95, grip: -70, tuck: 0.16 }), phase(18, { chest: 20, knee: 25, axe: 20, grip: -25 }), phase(38)]);

const roll = (sign: number, down = false) => [phase(0, { roll: down ? sign * 90 : 0 }), phase(4, { roll: sign * 35, tuck: 0.2, knee: 60, axe: -70 }), phase(11, { roll: sign * 135, tuck: 0.3, knee: 80, axe: -100 }), phase(21, { roll: sign * 275, tuck: 0.3, knee: 75, axe: -90 }), phase(29, { roll: sign * 355, knee: 30 }), phase(35, { roll: sign * 360 })];
add("turn", 8, [phase(0, { yaw: 180 }), phase(3, { yaw: 110, lean: -15, knee: 20 }), phase(8)]);
add("stop", 8, [phase(0, { lean: -20, knee: 15 }), phase(3, { lean: -25, knee: 30 }), phase(8)]);
add("jumpSquat", 3, [phase(0), phase(2, { knee: 65, chest: 30, tuck: 0.22 }), phase(3, { knee: 70, chest: 32, tuck: 0.24 })]);
add("jump", 22, [phase(0, { knee: 65, chest: 30 }), phase(4, { knee: 0, chest: -20, axe: -100, grip: -95 }), phase(12, { knee: 50, axe: -120, chest: -10 }), phase(22, { knee: 40, axe: -60 })], { air: true });
add("fall", 30, [phase(0, { knee: 40, axe: -70, grip: -55, chest: 15 }), phase(15, { knee: 50, axe: -55, grip: -70, chest: 20 }), phase(30, { knee: 40, axe: -70, grip: -55, chest: 15 })], { air: true });
add("landing", 12, [phase(0, { knee: 55, chest: 35, tuck: 0.18 }), phase(4, { knee: 65, chest: 40, tuck: 0.23 }), phase(12)]);
add("crouch", 30, [phase(0, { knee: 65, chest: 30, tuck: 0.22 }), phase(30, { knee: 65, chest: 30, tuck: 0.22 })], { hold: true });
add("shield", 30, [phase(0, { axe: -75, grip: -85, chest: -15, knee: 25 }), phase(30, { axe: -75, grip: -85, chest: -15, knee: 25 })], { hold: true });
add("airDodge", 49, [phase(0), phase(4, { lean: -32, knee: 75, axe: -100, grip: -70, tuck: 0.2 }), phase(27, { lean: -32, knee: 75, axe: -100, grip: -70, tuck: 0.2 }), phase(49, { lean: -10, knee: 35 })], { air: true });
add("tech", 26, [phase(0, { roll: 85, knee: 55 }), phase(8, { roll: 50, tuck: 0.3, knee: 75 }), phase(17, { roll: -10, knee: 35 }), phase(26)]);
for (const [name, sign, frames, down] of [["rollForward", -1, 31, false], ["rollBackward", 1, 31, false], ["techForward", -1, 40, true], ["techBackward", 1, 40, true], ["getUpRollForward", -1, 35, true], ["getUpRollBackward", 1, 35, true], ["ledgeRoll", -1, 36, true]] as const)
  add(name, frames, roll(sign, down).map(p => ({ ...p, at: p.at * frames / 35 })));
add("spotDodge", 22, [phase(0), phase(2, { lean: -35, knee: 60, axe: -85, tuck: 0.18 }), phase(15, { lean: -35, knee: 60, axe: -85, tuck: 0.18 }), phase(22)]);
add("knockdown", 60, [phase(0, { roll: 90, knee: 35, axe: -40 }), phase(60, { roll: 90, knee: 35, axe: -40 })], { hold: true });
add("getUp", 30, [phase(0, { roll: 90, knee: 35 }), phase(9, { roll: 70, knee: 70 }), phase(23, { roll: 15, knee: 35 }), phase(30)]);
add("getUpAttack", 49, [phase(0, { roll: 90, knee: 35 }), phase(10, { roll: 60, axe: -135, knee: 60 }), phase(16, { roll: 15, axe: -65, chest: 25 }), phase(19, { roll: 15, yaw: 180, axe: -65, chest: 25 }), phase(30, { yaw: 180, knee: 25 }), phase(49, { yaw: 360 })]);
add("ledgeHang", 30, [phase(0, { axe: -145, grip: -170, chest: -12, knee: 30, height: -65 }), phase(30, { axe: -145, grip: -170, chest: -12, knee: 30, height: -65 })], { air: true, hold: true });
add("ledgeClimb", 25, [phase(0, { lean: 65, height: -60, grip: -150 }), phase(11, { lean: 30, height: -15, knee: 50 }), phase(25)]);
add("ledgeAttack", 40, [phase(0, { lean: 65, height: -60, grip: -150 }), phase(12, { lean: 20, height: -10, axe: -155 }), phase(20, { axe: -45, chest: 30, knee: 20 }), phase(40)]);

const held: Gesture = { chest: 12, head: -8, grip: -72, elbow: -15, axe: -35, knee: 9, twist: -8 };
const captive: Gesture = { chest: -24, head: -18, grip: -18, elbow: 46, axe: -32, knee: 16, twist: 12 };
add("grab", 34, [phase(0), phase(5, { ...held, chest: -12, grip: -30 }), phase(7, held), phase(9, held), phase(34)]);
add("grabHold", 60, [phase(0, held), phase(60, held)], { hold: true, air: true });
add("grabbed", 60, [phase(0, captive), phase(60, captive)], { hold: true, air: true });
const paired = (name: string, first: Gesture, coil: Gesture, hit: Gesture, last: Gesture = {}) =>
  add(name, 60, [phase(0, first), phase(18, coil), phase(30, hit), phase(36, hit), phase(60, last)], { air: true, contact: 0.5 });
add("pummel", 68, [phase(0, held), phase(54, held), phase(57, { ...held, chest: -14, axe: -85, twist: -22 }), phase(60, { ...held, chest: 30, axe: -105, elbow: 30, twist: 24 }), phase(62, { ...held, chest: 30, axe: -105, elbow: 30, twist: 24 }), phase(68, held)], { air: true, contact: 1.0 });
add("victimPummel", 68, [phase(0, captive), phase(59, captive), phase(60, { ...captive, chest: 48, head: -40, grip: -45, knee: 28 }), phase(62, { ...captive, chest: 48, head: -40, grip: -45, knee: 28 }), phase(68, captive)], { air: true, contact: 1.0 });
paired("throwForward", held, { ...held, chest: -18, grip: -38, twist: -28 }, { ...held, chest: 36, grip: -100, elbow: -8, axe: -72, twist: 30 });
paired("victimThrowForward", captive, { ...captive, chest: 36 }, { ...captive, chest: -46, head: -34, grip: -95, axe: -65, knee: 40, twist: -16 });
paired("throwBack", held, { ...held, chest: -14, grip: -118, axe: -70, twist: -32 }, { ...held, chest: -32, grip: -180, axe: -148, twist: 70, knee: 24 });
paired("victimThrowBack", captive, { ...captive, chest: -28, grip: -110, knee: 48 }, { ...captive, chest: -68, grip: -156, axe: -130, knee: 68, twist: -50 });
paired("throwUp", held, { ...held, chest: 30, grip: -46, knee: 32 }, { ...held, chest: -22, grip: -168, elbow: -5, axe: -140, head: -25, knee: 0 });
paired("victimThrowUp", captive, { ...captive, chest: 35, knee: 55 }, { ...captive, chest: -45, grip: -160, axe: -130, head: -35, knee: 5 });
paired("throwDown", held, { ...held, chest: -22, grip: -140, knee: 15 }, { ...held, chest: 58, grip: -45, axe: 25, knee: 48 });
paired("victimThrowDown", captive, { ...captive, chest: -24, grip: -118, knee: 45 }, { ...captive, chest: 76, head: -8, grip: -40, axe: 36, knee: 70, twist: 25 });
for (let height = 0; height < 3; height++) for (let strength = 0; strength < 3; strength++) {
  const amount = [0.65, 1, 1.35][strength]!;
  const g: Gesture = { chest: [12, 34, -24][height]! * amount, head: [-16, -28, -34][height]! * amount, axe: [-16, -38, 22][height]! * amount,
    grip: [-16, -38, 22][height]! * amount, elbow: [18, 38, 28][height]! * amount, knee: [52, 22, 22][height]! * amount, lean: [-5, 5, -12][height]! * amount };
  add(`pain${height}${strength}`, 24, [phase(0, g), phase(3, g), phase(12, Object.fromEntries(Object.entries(g).map(([k,v]) => [k,v * 0.85]))), phase(24, Object.fromEntries(Object.entries(g).map(([k,v]) => [k,v * 0.75])))], { air: true, pain: true });
}

function poseAt(action: Action, frame: number): Gesture {
  const a = action.phases.findLast(p => p.at <= frame) ?? action.phases[0]!;
  const b = action.phases.find(p => p.at >= frame) ?? action.phases.at(-1)!;
  const t = a.at === b.at ? 0 : (frame - a.at) / (b.at - a.at);
  return Object.fromEntries([...new Set([...Object.keys(a.pose), ...Object.keys(b.pose)])].map(k => [k, (a.pose[k as keyof Gesture] ?? 0) * (1-t) + (b.pose[k as keyof Gesture] ?? 0) * t]));
}
function rotate(q: Float32Array | Int32Array, pitch: number, yaw = 0): Float32Array {
  const y = pitch * Math.PI / 360, z = yaw * Math.PI / 360;
  const a = [-Math.sin(y)*Math.sin(z), Math.sin(y)*Math.cos(z), Math.cos(y)*Math.sin(z), Math.cos(y)*Math.cos(z)];
  const [x=0,v=0,w=0,s=1] = q;
  const out = new Float32Array([a[3]!*x+a[0]!*s+a[1]!*w-a[2]!*v,a[3]!*v-a[0]!*w+a[1]!*s+a[2]!*x,a[3]!*w+a[0]!*v-a[1]!*x+a[2]!*s,a[3]!*s-a[0]!*x-a[1]!*v-a[2]!*w]);
  const norm = Math.hypot(...out); for (let i=0;i<4;i++) out[i] = out[i]! / norm;
  return out;
}
function joint(name: string, g: Gesture): [number,number] {
  if(name === "Bone_Chest") return [g.chest ?? 0, g.twist ?? 0];
  if(name === "Bone_Head") return [g.head ?? 0, 0];
  if(name === "Bone_Arm1_R") return [g.axe ?? 0, 0];
  if(name === "Bone_Arm1_L") return [g.grip ?? 0, 0];
  if(name === "Bone_Arm2_R") return [g.elbow ?? 0, 0];
  if(name === "Bone_Arm2_L") return [-(g.elbow ?? 0)*0.5, 0];
  if(name === "Bone_Leg1_L") return [-(g.knee ?? 0)*0.85,0];
  if(name === "Bone_Leg1_R") return [-(g.knee ?? 0)*0.35,0];
  if(/^Bone_Leg2_[LR]$/.test(name)) return [g.knee ?? 0,0];
  return [0,0];
}
const id = model.Nodes.length;
const helper: mdx.Helper = { Name: "Peon Motion", ObjectId:id, Parent:null, Flags:0, PivotPoint:new Float32Array([0,0,55]),
  Rotation:{LineType:1,GlobalSeqId:-1,Keys:[]}, Translation:{LineType:1,GlobalSeqId:-1,Keys:[]}, Scaling:{LineType:1,GlobalSeqId:-1,Keys:[]} };
for(const node of [...model.Bones,...model.Helpers,...model.Attachments]) if(node.Parent == null) node.Parent=id;
model.Helpers.push(helper);model.Nodes.push(helper);model.PivotPoints.push(helper.PivotPoint);
for(const s of source.Sequences) for(const Frame of s.Interval) {
  helper.Rotation!.Keys.push({Frame,Vector:new Float32Array([0,0,0,1])});
  helper.Translation!.Keys.push({Frame,Vector:new Float32Array([0,0,0])});
  helper.Scaling!.Keys.push({Frame,Vector:new Float32Array([1,1,1])});
}
const original = new Map<string,mdx.AnimVector>();tracks(source,(t,p)=>original.set(p,t));
let cursor = Math.max(...source.Sequences.map(s=>s.Interval[1]))+100;
const bindings = new Map<string,{index:number,seconds:number,contact?:number}>();
for(const action of actions) {
  const start=cursor,end=start+Math.round(action.frames*1000/60),index=model.Sequences.length;cursor=end+100;
  model.Sequences.push({...stand,Name:`Peon ${action.name}`,Interval:new Uint32Array([start,end]),NonLooping:!action.hold,MoveSpeed:0,Rarity:0,
    MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});
  tracks(model,(track,path)=>{
    const donor=original.get(path);if(!donor || onGlobalClock(donor))return;
    const first=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);if(!first)return;
    const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
    for(let f=0;f<=(action.hold?0:action.frames);f++) {
      const [pitch,yaw]=node?joint(node.Name,poseAt(action,f)):[0,0];
      const Vector=match?rotate(first.Vector,pitch,yaw):first.Vector.slice();
      track.Keys.push({...first,Frame:Math.round(start+f*(end-start)/action.frames),Vector,
        ...(first.InTan?{InTan:Vector.slice()}:{}),...(first.OutTan?{OutTan:Vector.slice()}: {})});
    }
  });
  const translations:mdx.AnimKeyframe[]=[];
  for(let f=0;f<=(action.hold?0:action.frames);f++) {
    const g=poseAt(action,f),Frame=Math.round(start+f*(end-start)/action.frames);
    helper.Rotation!.Keys.push({Frame,Vector:rotate(new Float32Array([0,0,0,1]),(g.roll??0)+(g.lean??0),g.yaw??0)});
    helper.Scaling!.Keys.push({Frame,Vector:new Float32Array([1,1,1-(g.tuck??0)])});
    const key={Frame,Vector:new Float32Array([0,0,g.height??0])};translations.push(key);helper.Translation!.Keys.push(key);
  }
  if(!action.air) {
    const drawn=new DrawnModel(generateMDX(model),1);
    for(let f=0;f<=(action.hold?0:action.frames);f++) {
      const vertices=drawn.triangles(index,f/60,1);let lowest=Infinity;
      for(let i=1;i<vertices.length;i+=2)lowest=Math.min(lowest,vertices[i]!);
      ensure(Number.isFinite(lowest),`${action.name}: missing body`);
      translations[f]!.Vector[2]-=lowest-(poseAt(action,f).height??0);
    }
  }
  bindings.set(action.name,{index,seconds:(end-start)/1000,...(action.contact?{contact:action.contact}:{})});
}
const victimPummel = bindings.get("victimPummel");
ensure(victimPummel?.index === 70, "Peon victim-pummel index changed");
const victimSequence = model.Sequences[victimPummel.index]!;
const [victimFirst, victimLast] = victimSequence.Interval;
const victimContact = victimFirst! + 1000;
// Victims share a half-second contact; a separate interval retains every other clip's keys.
tracks(model, track => {
  if (onGlobalClock(track)) return;
  for (const key of track.Keys) if (key.Frame >= victimFirst! && key.Frame <= victimLast!) {
    key.Frame = cursor + (key.Frame <= victimContact
      ? Math.round((key.Frame - victimFirst!) / (victimContact - victimFirst!) * 500)
      : 500 + Math.round((key.Frame - victimContact) / (victimLast! - victimContact) * 500));
  }
  track.Keys.sort((a, b) => a.Frame - b.Frame);
});
victimSequence.Interval = new Uint32Array([cursor, cursor + 1000]);
bindings.set("victimPummel", { index: victimPummel.index, seconds: 1, contact: 0.5 });
cursor += 1100;
const victimAction = actions.findIndex(action => action.name === "victimPummel");
const originalVictimAction = actions[victimAction]!;
actions[victimAction] = { ...originalVictimAction, frames: 60, contact: 0.5,
  phases: originalVictimAction.phases.map(p => ({ ...p, at: p.at <= 60 ? p.at / 2 : 30 + (p.at - 60) * 30 / 8 })) };
const lumberToss = bindings.get("neutralSpecial");
ensure(lumberToss?.index === 38, "Peon Lumber Toss index changed");
const lumberSequence = model.Sequences[lumberToss.index]!;
const [lumberFirst, lumberLast] = lumberSequence.Interval;
// Extra recovery holds the restored idle pose without moving the original throw keys.
tracks(model, track => {
  if (onGlobalClock(track)) return;
  const keys = track.Keys.filter(key => key.Frame >= lumberFirst! && key.Frame <= lumberLast!);
  for (const key of keys) key.Frame = cursor + key.Frame - lumberFirst!;
  track.Keys.sort((a, b) => a.Frame - b.Frame);
});
lumberSequence.Interval = new Uint32Array([cursor, cursor + 800]);
bindings.set("neutralSpecial", { index: lumberToss.index, seconds: 0.8 });
const lumberAction = actions.findIndex(action => action.name === "neutralSpecial");
actions[lumberAction] = { ...actions[lumberAction]!, frames: 48, phases: [...actions[lumberAction]!.phases, phase(48)] };
const bytes=encodeVerified(parseSource(generateMDX(model))),before=new DrawnModel(generateMDX(source),1),after=new DrawnModel(bytes,1);
for(const [index,s] of source.Sequences.entries())for(const t of [0,0.5,1]) {
  const a=before.triangles(index,(s.Interval[1]-s.Interval[0])*t/1000,1),b=after.triangles(index,(s.Interval[1]-s.Interval[0])*t/1000,1);
  ensure(a.length===b.length && a.every((v,i)=>Math.abs(v-b[i]!)<0.001),`Stock ${s.Name}: pose changed`);
}
const evidence=[];
for(const action of actions) {
  const binding=bindings.get(action.name)!;let travel=0,drift=0;
  const initial=after.triangles(binding.index,0,1);
  for(let f=1;f<=action.frames;f++) {
    const next=after.triangles(binding.index,f/60,1);ensure(next.length===initial.length && next.length>0,`${action.name}: body disappears`);
    for(let i=0;i<initial.length;i+=2) {const shift=Math.hypot(next[i]!-initial[i]!,next[i+1]!-initial[i+1]!);travel=Math.max(travel,shift);drift=Math.max(drift,shift);}
  }
  if(action.hold)ensure(drift<0.001,`${action.name}: held pose drifts ${drift}`);
  else if(!action.pain)ensure(travel>=5,`${action.name}: dead pose ${travel}`);
  const moments=action.phases.map(p=>Math.round(p.at));
  const capture=sheet(`Peon ${action.name}`,new DrawnModel(bytes,1.0),[1,-1].flatMap(facing=>moments.map(frame=>({frame,facing,clip:binding.index,seconds:frame/60,phase:AttackPhase.active,x:0,z:0,parts:[],strikes:[]}))),moments.length);
  await Bun.write(join(output,`${action.name}.png`),capture.png);
  evidence.push({name:action.name,...binding,travel});
}
const idle=before.triangles(9,0,1),pain=actions.filter(a=>a.pain).map(a=>after.triangles(bindings.get(a.name)!.index,0,1));
for(const [cell,p] of pain.entries())ensure(p.some((v,i)=>Math.abs(v-idle[i]!)>=8),`Pain ${cell}: insufficient recoil`);
for(let a=0;a<pain.length;a++)for(let b=a+1;b<pain.length;b++)ensure(pain[a]!.some((v,i)=>Math.abs(v-pain[b]![i]!)>2),`Pain ${a}/${b}: same pose`);
const modelPath=join(output,"hero-models/peon.mdx");await Bun.write(modelPath,bytes);chmodSync(modelPath,0o644);
const literal=(b:{index:number,seconds:number,contact?:number})=>`{ index: ${b.index}, seconds: ${seconds(b.seconds)}, aligned: true${b.contact?`, contact: ${seconds(b.contact)}`:""} }`;
const aliases:Record<string,string>={doubleJump:"jump",wallJump:"jump",wallTech:"tech",fallSpecial:"fall",downDamage:"knockdown",damageTumble:"knockdown",damageGround:"pain11",damageAir:"pain11",damageShield:"stop",smashCharge:"shield",neutralSpecialAir:"neutralSpecial",sideSpecialAir:"sideSpecial",upSpecialAir:"upSpecial",downSpecialAir:"downSpecial"};
await Bun.write(join(project,"ts/src/game/presentation/heroes/peonClips.ts"),[
  "// Generated by tools/animations/peon-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClipTable, HeroClip } from "../../sim/heroes/hero";',
  "export const PEON_FALLBACK_CLIP: HeroClip = { index: 9, seconds: 1.0 };", "export const PEON_CLIPS = {",
  "  idle: PEON_FALLBACK_CLIP,", "  walk: { index: 1, seconds: f32(0.6) },", "  dash: { index: 1, seconds: f32(0.6) },", "  run: { index: 1, seconds: f32(0.6) },",
  "  ko: { index: 15, seconds: f32(4.733) },", "  dizzy: { index: 12, seconds: f32(1.667) },",
  ...actions.filter(a=>!a.pain).map(a=>`  ${a.name}: ${literal(bindings.get(a.name)!)},`),
  ...Object.entries(aliases).map(([name,donor])=>`  ${name}: ${literal(bindings.get(donor)!)},`),
  "} as const satisfies HeroClipTable;", "export const PEON_PAIN_CLIPS: readonly HeroClip[] = [", ...actions.filter(a=>a.pain).map(a=>`  ${literal(bindings.get(a.name)!)},`), "];", "",
].join("\n"));
await Bun.write(join(output,"peon-clips.json"),JSON.stringify({sourceBytes:(await Bun.file(input).arrayBuffer()).byteLength,stockSequences:22,actions:evidence},null,2)+"\n");
console.log(`PEON_CLIPS_PASS: ${actions.length} authored clips; 22 stock sequences preserved; 9 distinct pain cells; ${bytes.byteLength} model bytes`);
