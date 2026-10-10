
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel, sampleAttack, sheet } from "../../ts/scripts/wisp/hurtboxView";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { AttackPhase, AttackStyle, type Character } from "../../ts/src/game/sim/codes";
import { createFighter } from "../../ts/src/game/sim/fighter";
import { heroDefinition } from "../../ts/src/game/sim/heroes/registry";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { attackStartupFrames, attackDurationFramesForGrounding } from "../../ts/src/game/sim/moves";
import { FIGHTER_ULTIMATES } from "../../ts/src/game/sim/ultimates";
import { heroCueWindows } from "../../ts/src/game/presentation/specialCues";
import { ROSTER_ATTACK_CLIPS } from "../../ts/src/game/presentation/rosterAttackClipInfo";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, fighters, onGlobalClock, parseSource, tracks } from "./original-clips";
import { attackGestureBaseModel } from "./recovery-model";

const PLAN: Readonly<Record<number, readonly HeroPose[]>> = {
  2: ["jab3"],
  4: ["jab", "jab2", "upTilt", "upSmash", "neutralAir", "upAir", "backAir", "dashAttack", "forwardAir"],
  5: ["jab3", "forwardTiltDown", "downTilt", "neutralAir", "backAir", "downSmash", "dashAttack", "forwardAir", "upSmash", "upAir", "upTilt", "forwardTiltUp", "neutralSpecial", "jab", "jab2", "forwardTilt", "forwardSmash", "sideSpecial", "ultimate"],
  6: ["forwardTiltDown", "downTilt", "backAir", "downSpecial", "forwardTilt", "forwardTiltUp", "upTilt", "forwardSmash", "upSmash", "downSmash", "dashAttack", "forwardAir", "upAir"],
  8: ["jab2", "jab3", "downTilt", "forwardSmash", "forwardAir", "backAir", "upAir", "upTilt", "neutralAir", "neutralSpecial", "downSpecial", "ultimate"],
  9: ["jab3", "forwardTilt", "forwardTiltUp", "upTilt", "dashAttack", "forwardAir", "upSmash", "upAir", "forwardSmash", "downTilt"],
  10: ["forwardTilt", "forwardAir", "upAir", "neutralAir"],
  11: ["jab2", "jab3", "forwardTilt", "forwardTiltDown", "downTilt", "dashAttack", "backAir", "upSmash", "neutralAir", "upAir", "forwardAir", "downSpecial"],
  12: ["forwardTiltDown"],
};


const CONTACT: Readonly<Record<string, readonly number[]>> = {
  jab: [12, -22, 38, -15, 0, -10, 18, 0], jab2: [-12, -48, -12, 38, -20, 18, -8, 0], jab3: [28, -75, 45, -42, 25, -24, 35, 0],
  forwardTilt: [22, -40, 35, -28, 18, -18, 22, 0], forwardTiltUp: [-16, -105, 18, -20, 30, 12, 22, 0],
  forwardTiltDown: [38, 15, -30, -32, -45, -35, 48, 0], upTilt: [-24, -145, -70, 15, 35, 15, 18, 0],
  downTilt: [50, 35, 10, -15, -60, -68, 95, 0], forwardSmash: [42, -62, -45, -50, 40, -25, 35, 0],
  upSmash: [-35, -165, -145, -20, 70, 25, 15, 0], downSmash: [62, 30, -50, -40, -80, -48, 70, 0],
  dashAttack: [48, -65, 65, -32, 15, -65, 100, 0], neutralAir: [12, -110, 80, -48, 35, -70, 80, -12],
  forwardAir: [45, -78, 35, -42, 80, -45, 72, 22], backAir: [-30, 55, -130, -10, -55, 85, 105, -28],
  upAir: [-42, -155, -110, -32, 55, -60, 80, -8], downSpecial: [28, -88, -88, 70, -20, -20, 32, 0],
};

function rotate(q: Float32Array | Int32Array, degrees: number, axis = 1): Float32Array {
  const v = [0, 0, 0]; v[axis] = Math.sin(degrees * Math.PI / 360);
  const [a=0,b=0,c=0]=v,d=Math.cos(degrees*Math.PI/360),[x=0,y=0,z=0,w=1]=q;
  const out=new Float32Array([d*x+a*w+b*z-c*y,d*y-a*z+b*w+c*x,d*z+a*y-b*x+c*w,d*w-a*x-b*y-c*z]);
  const norm=Math.hypot(...out); for(let i=0;i<4;i++)out[i]=out[i]!/norm;return out;
}


const FIGHTER_CONTACT: Readonly<Record<number, Readonly<Record<string, readonly number[]>>>> = {
  2: { jab3: [-17, -69, 0, 3, 25, 1, -2, 40] },
  4: { jab: [-7, 1, 78, -1, -90, 15, 10, 1], jab2: [70, -2, -91, -18, -90, -13, 5, -25], upTilt: [34, -145, -103, 15, 35, -5, -1, 0], dashAttack: [30, 10, -60, -40, 0, 15, 20, 12] },
  6: { forwardTilt: [-10, -45, 5, -2, -1, 0, 0, 10], forwardTiltDown: [25, -70, 10, 0, 0, 0, 0, 12], downTilt: [20, -68, 15, -10, -10, 0, 0, 25], dashAttack: [28, -84, -5, 1, 2, 0, 0, 10] },
  8: {
    jab2: [36, -70, -45, -28, 20, -35, 50, 16],
    downTilt: [55, -52, -38, -18, -35, -70, 100, 20],
    forwardAir: [48, -80, -42, -28, 35, -55, 80, 22],
    backAir: [-42, 70, 42, -25, -35, 55, 80, -22],
    jab3: [44, -68, -35, -32, 20, -42, 65, 18],
    neutralAir: [35, -75, -100, -25, 25, -55, 80, 20],
    upAir: [-44, -145, -100, -25, 40, -55, 80, -22],
    upTilt: [-38, -135, -90, -20, 30, -35, 55, -18],
    forwardSmash: [58, -85, -55, -35, 45, -65, 90, 24],
    neutralSpecial: [48, -72, -45, -25, 30, -45, 65, 20],
    downSpecial: [42, -65, -40, -28, 25, -40, 60, 18],
    ultimate: [55, -78, -55, -30, 35, -55, 80, 22],
  },
  9: { jab3: [23, -75, 45, -2, 25, -24, 35, 5], forwardTilt: [50, -75, 35, -15, 65, -18, 22, -20], dashAttack: [48, -75, 65, -22, 50, -65, 100, -5], downTilt: [22, 35, 45, -15, -60, -40, 55, 0] },
  10: { forwardTilt: [32, -95, 35, -48, -22, -18, 22, 20] },
  11: {
    jab2: [-57, -48, -42, 38, -20, 18, -8, 0], jab3: [-17, -75, 45, -42, 25, -24, 35, 0], forwardTilt: [32, -55, 35, 12, 18, -18, 22, 0],
    forwardTiltDown: [33, -10, -60, -32, -45, -35, 48, 0], dashAttack: [48, -65, 65, -2, 15, -65, 100, 0],
  },
  12: { forwardTiltDown: [8, 15, -30, -32, -45, -35, 48, 0] },
  5: {
    jab3: [42, 0, 70, -40, 0, -50, 70, 12], forwardTiltDown: [48, 0, 60, -40, 0, -58, 80, 14], downTilt: [55, 0, 40, -30, 0, -75, 105, 16],
    dashAttack: [52, 0, 75, -45, 0, -70, 100, 16], forwardTiltUp: [-26, 0, 55, -30, 0, -45, 60, -10], upTilt: [-38, 0, 80, -35, 0, 35, 25, -12],
    upSmash: [-42, 0, 110, -40, 0, 30, 20, -14], upAir: [-48, 0, 95, -40, 0, -70, 95, -20], neutralSpecial: [40, -120, 70, -45, 35, -55, 75, 14], ultimate: [-30, -120, 70, -45, 35, 40, -20, -10],
    jab: [30, 0, 55, -30, 0, -40, 55, 8], jab2: [34, 0, 65, -30, 0, -45, 60, -8], forwardTilt: [45, 0, 70, -40, 0, -55, 75, 12],
    forwardSmash: [55, 0, 95, -45, 0, -70, 100, 18], sideSpecial: [55, -95, 75, -40, 25, -75, 100, 16],
  },
};

const DRAW_BACK: Readonly<Record<number, Readonly<Record<string, number>>>> = {
  4: { jab: 0.5, upTilt: 1 }, 8: { downTilt: 0.4 }, 11: { jab2: 0.4 },
};
const DREADLORD_DRIVE = new Set<HeroPose>(["jab3", "neutralAir", "upAir", "upTilt", "jab2", "downTilt", "forwardAir", "backAir", "forwardSmash", "neutralSpecial", "downSpecial", "ultimate"]);
const contactProfile=(pose: HeroPose, character: number)=>FIGHTER_CONTACT[character]?.[pose]??CONTACT[pose];

const HOP: Readonly<Record<number, Readonly<Record<string, number>>>> = {
  4: { dashAttack: 36 },
};

function joint(name: string, pose: HeroPose, character: number): number {
  if (character === 9 && pose === "downTilt" && /^(Beard1|Beard2)$/.test(name)) return -15;
  if (wardenWeaponPose(character, pose) && /^Bone_(Arm[12]|Hand)_R$/.test(name)) return 1;
  const p=contactProfile(pose,character);ensure(p,`missing contact profile ${pose}`);
  const left=/(?:_L|ArmL|HandL|LegL|^L(?:hip|knee|shoulder|elbow|hand))$/i.test(name);
  const heavy=character===4||character===7||character===10, scale=heavy?0.8:character===9?1.12:1;
  if(/^(Bone_Chest|Chest|Bone NECK|Stomach)$/.test(name))return p[0]!*scale;
  if(/^(Bone_Pelvis|Pelvis|Bone Koto Waist01)$/.test(name))return p[0]!*(character===8&&DREADLORD_DRIVE.has(pose)?0.55:-0.25);
  if(/^(Bone_Head|Head)$/.test(name))return -p[0]!*0.45;
  if(/^(Bone_Arm1_[LR]|UpArm[LR]|[RL][Ss]houlder)$/.test(name))return p[left?2:1]!*scale;
  if(/^(Bone_Arm2_[LR]|LowArm[LR]|[RL]elbow)$/.test(name))return p[3]!*(left?-0.5:1);
  if(/^(Bone_Hand_[LR]|Hand[LR]|[RL]hand)$/.test(name))return p[4]!*(left?-0.5:1);
  if(/^(Bone_Leg1_[LR]|UpperLeg[LR]|[RL]hip)$/.test(name))return left?p[5]!:p[5]!*-0.35;
  if(/^(Bone_Leg2_[LR]|LowerLeg[LR]|[RL]knee)$/.test(name))return left?p[6]!:p[6]!*0.2;
  if(character===6) {
    if(name==="Mesh01")return p[0]!;
    if(/^(Cylinder06|Cylinder07)$/.test(name))return name==="Cylinder06"?p[1]!:p[2]!;
    if(/^(Mesh04|Mesh05)$/.test(name))return p[3]!;
    if(/^(Mesh02|Mesh03)$/.test(name))return p[4]!;
  }
  if(/^Bone (Front|Back) [LR] Leg01$/.test(name))return p[5]!*(name.includes("Front")?0.65:-0.15);
  if(/^Bone (Front|Back) [LR] Shin01$/.test(name))return p[6]!*(name.includes("Front")?0.6:0.1);
  return 0;
}


function blend(from: ArrayLike<number>, to: ArrayLike<number>, weight: number): Float32Array {
  let dot = 0; for (let i = 0; i < 4; i++) dot += from[i]!*to[i]!;
  const sign = dot < 0 ? -1 : 1, vector = new Float32Array(4); for (let i = 0; i < 4; i++) vector[i] = from[i]!*(1-weight)+sign*to[i]!*weight;
  const norm = Math.hypot(...vector); return vector.map(v => v/norm);
}


function strikeDirection(pose: HeroPose): number[] {
  if (pose === "ultimate") return [-1, 0];
  if (pose.endsWith("Special")) return [1, 0];
  const frames = sampleAttack(5 as Character, AttackStyle[pose as keyof typeof AttackStyle], 1, pose.endsWith("Air"));
  const first = frames.find(f => f.phase === AttackPhase.active && f.strikes.length > 0), strike = first?.strikes[0]; ensure(first && strike, `${pose}: no active strike`);
  const [x1,z1,x2,z2] = [strike.x1-first.x, strike.z1-first.z-50, strike.x2-first.x, strike.z2-first.z-50], far = Math.hypot(x2,z2) >= Math.hypot(x1,z1) ? [x2,z2] : [x1,z1], length = Math.hypot(...far) || 1;
  return far.map(v => v/length);
}

const WARDEN_LUNGE: Readonly<Record<string, readonly number[]>> = {
  upSmash: [5, 10, 10, 1, 0], upAir: [0, 0, 0, 1, 0], jab3: [40, 50, 15, 0, 0, 1], dashAttack: [40, 50, 15, 0, 0, 1], forwardTiltUp: [80, 100, 15, 0, 0, 1], forwardSmash: [40, 50, 15, 0, 0, 1], neutralSpecial: [10, 20, 10, 0, 0, 1], ultimate: [15, 35, 5, 0, 0, 1], sideSpecial: [20, 40, 30, 1, 0],
};

const wardenWeaponPose = (character: number, pose: HeroPose) => character === 5 && ["jab3", "forwardTiltDown", "downTilt", "dashAttack", "upSmash", "upAir", "upTilt", "forwardTiltUp", "jab", "jab2", "forwardTilt", "forwardSmash", "neutralSpecial", "sideSpecial", "ultimate"].includes(pose);

function aimWeaponContact(model: mdx.Model, index: number, start: number, contact: number, total: number, pose: HeroPose, shadowLow = false) {
  const nodes = [...model.Bones, ...model.Helpers, ...model.Attachments];
  const named = (name: string) => { const node = nodes.find(n => n.Name === name); ensure(node, name); return node; };
  const arm = [named("Bone_Arm1_R"), named("Bone_Arm2_R")], hand = named("Bone_Hand_R"), tip = named("Weapon Ref");
  const renderer = new ModelRenderer(model); renderer.setSequence(index);
  const data = Reflect.get(renderer, "rendererData") as { frame: number; nodes: { matrix: Float32Array }[] };
  const position = (node: mdx.Node) => { const m = data.nodes[node.ObjectId]!.matrix, v = model.PivotPoints[node.ObjectId]!; return [m[0]!*v[0]!+m[4]!*v[1]!+m[8]!*v[2]!+m[12]!, m[1]!*v[0]!+m[5]!*v[1]!+m[9]!*v[2]!+m[13]!, m[2]!*v[0]!+m[6]!*v[1]!+m[10]!*v[2]!+m[14]!]; };
  data.frame = start; renderer.update(0);
  const initialHand = position(hand), initialTip = position(tip);

  const turnAt = (node: mdx.Node, axis: number[], full: number, at: number) => {
    const parent = node.Parent == null ? undefined : data.nodes[node.Parent]?.matrix;
    const local = parent ? [0,1,2].map(i => (axis[0]!*parent[i*4]!+axis[1]!*parent[i*4+1]!+axis[2]!*parent[i*4+2]!)/Math.hypot(parent[i*4]!,parent[i*4+1]!,parent[i*4+2]!)) : axis;
    const key = node.Rotation?.Keys.find(k => k.Frame === at); ensure(key, `${node.Name}: missing contact key`);
    const angle = full/2, s = Math.sin(angle), q = key.Vector, [x,y,z] = local;
    const [u,v,w,t] = q, d = Math.cos(angle), p = [x!*s,y!*s,z!*s];
    const vector = new Float32Array([d*u!+p[0]!*t!+p[1]!*w!-p[2]!*v!, d*v!-p[0]!*w!+p[1]!*t!+p[2]!*u!, d*w!+p[0]!*v!-p[1]!*u!+p[2]!*t!, d*t!-p[0]!*u!-p[1]!*v!-p[2]!*w!]);
    const norm = Math.hypot(...vector); key.Vector = vector.map(v => v/norm); if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); } renderer.update(0);
  };
  const targets: Readonly<Record<string, readonly [number[], number[]]>> = {
    jab3: [[58,-27,99],[108,-28,99]],
    forwardTiltDown: [[50,-27,66],[95,-28,35]],
    downTilt: [[39,-27,64],[79,-28,28]],
    dashAttack: [[58,-27,89],[105,-28,74]],
    upSmash: [[8,-27,150],[8,-28,210]],
    upTilt: [[12,-27,137],[12,-28,190]],
    upAir: [[18,-27,148],[36,-28,205]],
    forwardTiltUp: [[28,-27,128],[63,-28,168]],
    jab: [[40,-27,95],[82,-28,95]],
    jab2: [[42,-27,100],[84,-28,101]],
    forwardTilt: [[75,-27,100],[125,-28,101]],
    forwardSmash: [[90,-27,108],[140,-28,112]],
    neutralSpecial: [[70,-27,105],[118,-28,108]],
    ultimate: [[-40,-27,105],[-88,-28,110]],
    sideSpecial: [[80,-27,92],[130,-28,88]],
  };
  const [targetHand,targetTip] = shadowLow ? [[72,-27,28],[145,-28,12]] : targets[pose]!;

  const via = pose === "upTilt" ? [[50,-27,100],[100,-28,105]] as const : undefined;
  const solved = [...arm, hand], held = new Map<mdx.Node, Float32Array>();
  const tuned = process.env[`W180_${pose}`] ?? process.env.W180;
  const [B = 0, F = 0, O = 0, ARM = 1, SWEEP = 0, SNAP = 0] = shadowLow ? [] : tuned ? tuned.split(",").map(Number) : WARDEN_LUNGE[pose] ?? [30, 40, 15, 0.5, 0, 1];
  const lungeAxis = (() => { const [x, z] = strikeDirection(pose); const up = pose.endsWith("Air") ? z! : Math.max(0, z!)*0.6, n = Math.hypot(x!, up) || 1; return [x!/n, 0, up/n]; })();
  const anticipationAt = Math.max(1,contact-2), late = pose.startsWith("jab") || pose.endsWith("Special") || pose === "ultimate" ? 1 : 2, lunge = (frame: number) => frame < anticipationAt ? -B*Math.sin(frame/anticipationAt*Math.PI/2)
    : frame <= contact ? -B+(B+F)*(contact > anticipationAt ? (frame-anticipationAt)/(contact-anticipationAt) : 1)
    : frame <= contact+late ? F+O*Math.sin((frame-contact)/late*Math.PI/2)
    : (F+O)*Math.max(0,1-(frame-contact-late)/Math.max(1,total-contact-late));
  const lungeRoot = named("Bone_Root");
  for (let frame = 0; frame <= total; frame++) {
    const key = lungeRoot.Translation?.Keys.find(k => k.Frame === start + Math.round(frame*1000/60)); ensure(key, "Bone_Root: missing lunge key");
    key.Vector = key.Vector.map((v,i) => v+lunge(frame)*lungeAxis[i]!); if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); }
  }
  const across = [lungeAxis[2]!, 0, -lungeAxis[0]!], swept = new Map<mdx.Node, Float32Array>();
  for (let frame = 0; frame <= total; frame++) {
    const at = start + Math.round(frame*1000/60); data.frame = at; renderer.update(0);
    const aim = (node: mdx.Node, effector: mdx.Node, target: number[]) => {
      const origin = position(node), a = position(effector).map((v,i) => v-origin[i]!), b = target.map((v,i) => v-origin[i]!);
      const an = Math.hypot(...a), bn = Math.hypot(...b); if (an < 0.001 || bn < 0.001) return;
      const av = a.map(v => v/an), bv = b.map(v => v/bn), cross = [av[1]!*bv[2]!-av[2]!*bv[1]!, av[2]!*bv[0]!-av[0]!*bv[2]!, av[0]!*bv[1]!-av[1]!*bv[0]!], length = Math.hypot(...cross); if (length < 0.00001) return;
      turn(node, cross.map(v => v/length), Math.acos(Math.max(-1,Math.min(1,av.reduce((sum,v,i) => sum+v*bv[i]!,0)))));
    };
    const turn = (node: mdx.Node, axis: number[], full: number) => turnAt(node, axis, full, at);

    if (frame > contact) {
      const keys = solved.map(node => { const key = node.Rotation?.Keys.find(k => k.Frame === at); ensure(key, `${node.Name}: missing recovery key`); return key; });
      if (frame <= contact+3 && SWEEP) {
        keys.forEach((key,i) => { key.Vector = held.get(solved[i]!)!.slice(); }); renderer.update(0);
        const sweep = SWEEP*(frame-contact)/3, shift = (scale: number) => lungeAxis.map((v,i) => v*(lunge(frame)-F)+across[i]!*sweep*scale);
        for (let iteration = 0; iteration < 12; iteration++) for (const node of arm.toReversed()) aim(node,hand,targetHand.map((v,i) => v+shift(0.5)[i]!));
        aim(hand,tip,targetTip.map((v,i) => v+shift(1.5)[i]!));
        if (frame === contact+3 || frame === total) keys.forEach((key,i) => swept.set(solved[i]!, key.Vector.slice()));
      } else {
        const from = swept.size ? swept : held, weight = frame < contact+3 ? 1 : Math.max(0,1-(frame-contact-3)/(total-contact-3));
        keys.forEach((key,i) => { key.Vector = blend(key.Vector, from.get(solved[i]!)!, weight); });
      }
      keys.forEach(key => { if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); } });
      continue;
    }
    const anticipation = Math.max(1,contact-2);
    const target = (from: number[], to: number[], through?: readonly number[]) => {
      if (through && frame === contact-1) return [...through];
      const reach = to.map((v,i) => v-F*lungeAxis[i]!), cocked = reach.map((v,i) => v+(from[i]!-v)*1.3*ARM);
      const body = frame < anticipation ? from.map((v,i) => v+(cocked[i]!-v)*(SNAP ? 1 : Math.sin(frame/anticipation*Math.PI/2))) : cocked.map((v,i) => v+(reach[i]!-v)*(contact > anticipation ? (frame-anticipation)/(contact-anticipation) : 1));
      return body.map((v,i) => v+lunge(frame)*lungeAxis[i]!);
    };
    const base = solved.map(node => node.Rotation!.Keys.find(k => k.Frame === at)!.Vector.slice());
    for (let iteration = 0; iteration < 12; iteration++) for (const node of arm.toReversed()) aim(node,hand,target(initialHand,targetHand,via?.[0]));
    aim(hand,tip,target(initialTip,targetTip,via?.[1]));
    if (frame === contact) {

      const keys = solved.map(node => node.Rotation!.Keys.find(k => k.Frame === at)!), solution = keys.map(k => k.Vector.slice());
      const direction = strikeDirection(pose), length = 1;
      const reach = () => { const t = new DrawnModel(generateMDX(model),1).triangles(index,contact/60,1); let r = -Infinity; for (let i = 0; i < t.length; i += 2) r = Math.max(r,(t[i]!*direction[0]!+(t[i+1]!-50)*direction[1]!)/length); return r; };
      let best = 1, most = -Infinity;
      if (!via && !shadowLow) for (let step = 20; step >= 0; step--) {
        keys.forEach((key,i) => { key.Vector = blend(base[i]!, solution[i]!, step/20); }); renderer.update(0);
        const r = reach(); if (r > most + 0.01) { most = r; best = step/20; }
      }
      keys.forEach((key,i) => { key.Vector = blend(base[i]!, solution[i]!, best); if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); } });
      renderer.update(0);

      if (pose === "upSmash" || pose === "upAir") {
        const handKey = keys[keys.length-1]!, unrolled = handKey.Vector.slice(), top = () => { const t = new DrawnModel(generateMDX(model),1).triangles(index,contact/60,1); let z = -Infinity; for (let i = 1; i < t.length; i += 2) z = Math.max(z,t[i]!); return z; };
        let roll = 0, tallest = top();
        for (let step = 1; step < 24; step++) {
          handKey.Vector = unrolled.slice(); renderer.update(0);
          const h = position(hand), w = position(tip), axis = w.map((v,i) => v-h[i]!), n = Math.hypot(...axis);
          turn(hand, axis.map(v => v/n), step*Math.PI/12); const z = top(); if (z > tallest + 0.01) { tallest = z; roll = step; }
        }
        handKey.Vector = unrolled.slice(); renderer.update(0);
        if (roll) { const h = position(hand), w = position(tip), axis = w.map((v,i) => v-h[i]!), n = Math.hypot(...axis); turn(hand, axis.map(v => v/n), roll*Math.PI/12); }
      }
      keys.forEach((key,i) => held.set(solved[i]!, key.Vector.slice()));
    }
  }
  if (shadowLow) floorSolve(model, data, renderer, start, total, turnAt, named);

  if (pose === "upSmash" || pose === "upAir") {
    const root = named("Bone_Root"), anticipation = Math.max(1,contact-2);
    for (let frame = anticipation; frame <= total; frame++) {
      const key = root.Translation?.Keys.find(k => k.Frame === start + Math.round(frame*1000/60)); ensure(key, "Bone_Root: missing lift key");
      const weight = frame <= contact ? (frame-anticipation)/(contact-anticipation) : frame < contact+3 ? 1 : Math.max(0,1-(frame-contact-3)/(total-contact-3));
      key.Vector = key.Vector.map((v,i) => i === 2 ? v+2*weight : v);
    }
  }
}






function floorSolve(model: mdx.Model, data: { frame: number; nodes: { matrix: Float32Array }[] }, renderer: ModelRenderer, start: number, total: number,
  turnAt: (node: mdx.Node, axis: number[], full: number, at: number) => void, named: (name: string) => mdx.Node) {
  const FLOOR = -2, CLEAR = FLOOR + 0.5;
  const children = new Map<number, number[]>(); for (const n of model.Nodes) if (n.Parent != null) children.set(n.Parent, [...children.get(n.Parent) ?? [], n.ObjectId]);
  const subtree = (id: number): number[] => [id, ...(children.get(id) ?? []).flatMap(subtree)];
  const visible = model.Geosets.flatMap((g, i) => model.Materials[g.MaterialID]?.Layers.some(l => Number(l.FilterMode) <= 2) ? [i] : []);

  const vertices = visible.flatMap(gi => { const g = model.Geosets[gi]!; return Array.from({ length: g.Vertices.length/3 }, (_, v) => {
    const sk = g.SkinWeights, bones = sk ? Array.from(sk.subarray(v*8, v*8+4)) : [...g.Groups[g.VertexGroup[v]!]!];
    const weights = sk ? Array.from(sk.subarray(v*8+4, v*8+8), w => w/255) : bones.map(() => 1/Math.max(1, bones.length));
    const owner = bones[weights.indexOf(Math.max(...weights))]!;
    return { gi, p: [g.Vertices[v*3]!, g.Vertices[v*3+1]!, g.Vertices[v*3+2]!], bones, weights, owner };
  }); });
  const lowest = (owners?: Set<number>) => { let z = Infinity; for (const v of vertices) {
    if (owners && !owners.has(v.owner)) continue; if (((data as unknown as { geosetAlpha: number[] }).geosetAlpha[v.gi] ?? 1) <= 0) continue;
    let h = 0; v.bones.forEach((b, k) => { const m = data.nodes[b]?.matrix; if (m) h += (m[2]!*v.p[0]!+m[6]!*v.p[1]!+m[10]!*v.p[2]!+m[14]!)*v.weights[k]!; }); z = Math.min(z, h);
  } return z; };
  const chains = [["Beard1","Beard03","Beard04","Beard2"], ["Bone_Arm1_L","Bone_Arm2_L","Bone_Hand_L"], ["Bone_Leg1_L","Bone_Leg2_L","Bone_Foot_L"]].map(c => c.map(named));
  const root = named("Bone_Root");
  for (let frame = 1; frame < total; frame++) {
    const at = start + Math.round(frame*1000/60); data.frame = at; renderer.update(0);
    for (const chain of chains) for (const node of chain) {
      const owners = new Set(subtree(node.ObjectId)); if (lowest(owners) >= CLEAR) break;
      const key = node.Rotation?.Keys.find(k => k.Frame === at); ensure(key, `${node.Name}: missing floor key`);
      const original = key.Vector.slice(), restore = () => { key.Vector = original.slice(); if (key.InTan) { key.InTan = original.slice(); key.OutTan = original.slice(); } renderer.update(0); };
      let best = 0, height = lowest(owners);
      for (let step = 1; step <= 60; step++) for (const sign of [1, -1]) {
        restore(); turnAt(node, [0,1,0], sign*step*Math.PI/60, at); const z = lowest(owners);
        if (height < CLEAR && z > height + 0.01) { height = z; best = sign*step; }
        if (z >= CLEAR) { step = 61; break; }
      }
      restore(); if (best) turnAt(node, [0,1,0], best*Math.PI/60, at);
    }
    const sink = FLOOR + 0.25 - lowest();
    if (sink > 0) {
      const key = root.Translation?.Keys.find(k => k.Frame === at); ensure(key, "Bone_Root: missing floor lift key");
      key.Vector = key.Vector.map((v,i) => i === 2 ? v+sink : v); if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); }
      renderer.update(0);
    }
  }
}

const [inputArg,outputArg,...options]=process.argv.slice(2),input=resolve(inputArg??""),output=resolve(outputArg??""),project=resolve(import.meta.dir,"../..");
const only=options[0]==="--character"?Number(options[1]):undefined;
const selectedPose = options.includes("--pose") ? options[options.indexOf("--pose") + 1] as HeroPose : undefined;
ensure(selectedPose === undefined || only !== undefined, "--pose requires --character");
ensure(input&&output&&relative(project,output).startsWith(".."),"usage: bun tools/animations/attack-gesture-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
mkdirSync(output,{recursive:true});

const authoredSeconds=(value:number)=>{for(let digits=1;digits<17;digits++){const decimal=Number(value.toPrecision(digits));if(Math.fround(decimal)===value)return decimal;}return value;};
const bindings:string[]=[],records:object[]=only!==undefined&&await Bun.file(join(output,"attack-gestures.json")).exists()
  ? (await Bun.file(join(output,"attack-gestures.json")).json() as {character:number}[]).filter(r=>r.character!==only) : [];
if(only!==undefined)for(const [id,table]of Object.entries(ROSTER_ATTACK_CLIPS))if(Number(id)!==only) {
  bindings.push(`  ${id}: {`);
  for(const [pose,clip]of Object.entries(table))if(clip)bindings.push(`    ${pose}: { index: ${clip.index}, seconds: ${seconds(authoredSeconds(clip.seconds))}${"aligned" in clip && clip.aligned ? ", aligned: true" : ""} },`);
  bindings.push("  },");
}
for(const [id,poses]of Object.entries(PLAN)) {
  if(only!==undefined&&Number(id)!==only)continue;
  const character=Number(id) as Character,f=fighters.get(character)!;ensure(f,"missing fighter");

  const published=parseSource(await Bun.file(join(input,f.source)).arrayBuffer()),base=selectedPose ? undefined : attackGestureBaseModel(published);
  const source=base?parseSource(generateMDX(base)):published;
  ensure(selectedPose !== undefined || !source.Sequences.some(s=>s.Name.startsWith("Attack Gesture ")),`${f.name}: input already has roster gestures`);
  ensure(selectedPose === undefined || !source.Sequences.some(s=>s.Name === `Attack Gesture ${selectedPose}`), `${f.name}: selected gesture already exists`);
  const model=structuredClone(source),stand=source.Sequences.find(s=>/^stand ready$/i.test(s.Name))??source.Sequences.find(s=>/^stand(?:\s*-?\s*1)?$/i.test(s.Name));
  ensure(stand,`${f.name}: missing stand`);
  const before=new DrawnModel(generateMDX(source),1),originals=new Map<string,mdx.AnimVector>(); tracks(source,(t,p)=>originals.set(p,t));
  const retainedHelper = selectedPose ? model.Helpers.find(n => n.Name === "Attack Gesture") : undefined;
  const root=model.Nodes.length,helper:mdx.Helper=retainedHelper ?? {Name:"Attack Gesture",ObjectId:root,Parent:null,Flags:0,PivotPoint:new Float32Array([0,0,60]),Rotation:{LineType:1,GlobalSeqId:-1,Keys:[]}};
  if (!retainedHelper) {
  for(const node of [...model.Bones,...model.Helpers,...model.Attachments])if(node.Parent==null)node.Parent=root;
  model.Helpers.push(helper);model.Nodes.push(helper);model.PivotPoints.push(helper.PivotPoint);
  }
  const hops=HOP[character]??{},hop:mdx.AnimVector|undefined=Object.keys(hops).length||character===8?{LineType:1,GlobalSeqId:-1,Keys:[]}:undefined;if(hop)helper.Translation=hop;
  if (!retainedHelper) for(const sequence of source.Sequences)for(const Frame of sequence.Interval) {
    helper.Rotation?.Keys.push({Frame,Vector:new Float32Array([0,0,0,1])});
    hop?.Keys.push({Frame,Vector:new Float32Array([0,0,0])});
  }
  let cursor=Math.max(...source.Sequences.map(s=>s.Interval[1]))+100;
  const drawnFrames=[];bindings.push(`  ${id}: {`);
  if (selectedPose) for (const [pose,clip] of Object.entries(ROSTER_ATTACK_CLIPS[only as keyof typeof ROSTER_ATTACK_CLIPS])) if (pose !== selectedPose) bindings.push(`    ${pose}: { index: ${clip.index}, seconds: ${seconds(authoredSeconds(clip.seconds))}${"aligned" in clip && clip.aligned ? ", aligned: true" : ""} },`);
  for(const pose of poses) {
    if (selectedPose && pose !== selectedPose) continue;
    const special=pose==="ultimate"?FIGHTER_ULTIMATES[character]:pose==="downSpecial"?heroDefinition(character)?.specials?.down.ground:pose==="neutralSpecial"?heroDefinition(character)?.specials?.neutral.ground:pose==="sideSpecial"?heroDefinition(character)?.specials?.side.ground:undefined;
    const style=special?undefined:AttackStyle[pose as keyof typeof AttackStyle];
    const moves=createFighter(character,0,1).tuning.moves;
    const contact=special?heroCueWindows(special,1).active.first-(character===5&&(pose==="neutralSpecial"||pose==="ultimate")?1:0):attackStartupFrames(style!,moves);
    const total=special?special.endFrame:attackDurationFramesForGrounding(style!,!pose.endsWith("Air"),moves);
    ensure(contact>0&&total>contact,`${f.name}/${pose}: invalid timing`);
    const start=cursor,end=start+Math.round(total*1000/60),index=model.Sequences.length;cursor=end+100;
    model.Sequences.push({...stand,Name:`Attack Gesture ${pose}`,Interval:new Uint32Array([start,end]),NonLooping:true,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});
    const driven=character===8&&DREADLORD_DRIVE.has(pose);
    let articulated=0;const back=driven?0.9:DRAW_BACK[character]?.[pose]??0.3;
    tracks(model,(track,path)=>{
      const donor=originals.get(path);if(!donor||onGlobalClock(donor))return;
      const key=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);if(!key)return;
      const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path),node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
      if (node?.Name === "Attack Gesture") return;
      const amount=node?joint(node.Name,pose,character):0;if(amount)articulated++;
      for(let frame=0;frame<=total;frame++) {
        const body=driven&&/^(Bone_Chest|Bone_Pelvis|Bone_Leg[12]_[LR])$/.test(node?.Name??"");
        const anticipation=Math.max(1,contact-2),peak=body?Math.max(anticipation+1,contact-1):contact;
        const follow=driven&&!body&&(pose==="upAir"||pose==="upTilt")?0.5:driven?1.35:1.18;
        const amountAt=frame<anticipation?-back*Math.sin(frame/anticipation*Math.PI/2):frame<=peak?-back+(1+back)*(peak>anticipation?(frame-anticipation)/(peak-anticipation):1):frame<contact+3?1+(follow-1)*(frame-peak)/(contact+3-peak):follow*Math.max(0,1-(frame-contact-3)/(total-contact-3));
        const Vector=amount?rotate(key.Vector,amount*amountAt):key.Vector.slice();
        track.Keys.push({...key,Frame:start+Math.round(frame*1000/60),Vector,...key.InTan?{InTan:Vector.slice(),OutTan:Vector.slice()}: {}});
      }
    });
    ensure(articulated>=4,`${f.name}/${pose}: only ${articulated} moving joints`);
    for(let frame=0;frame<=total;frame++) {
      const anticipation=Math.max(1,contact-2),peak=Math.max(anticipation+1,contact-1);
      const arc=driven?(frame<anticipation?-0.9*Math.sin(frame/anticipation*Math.PI/2):frame<=peak?-0.9+1.9*(frame-anticipation)/(peak-anticipation):frame<contact+3?1+0.35*(frame-peak)/(contact+3-peak):1.35*Math.max(0,1-(frame-contact-3)/(total-contact-3))):frame<=contact?Math.sin(frame/contact*Math.PI/2):Math.max(0,1-(frame-contact)/(total-contact));
      helper.Rotation?.Keys.push({Frame:start+Math.round(frame*1000/60),Vector:rotate(new Float32Array([0,0,0,1]),contactProfile(pose,character)![7]!*arc)});
      if(hop&&driven)hop.Keys.push({Frame:start+Math.round(frame*1000/60),Vector:new Float32Array([(pose==="backAir"?-26:26)*arc,0,pose.endsWith("Air")?10*arc:0])});
    }
    if(hop&&!driven)for(let frame=0;frame<=total;frame++)hop.Keys.push({Frame:start+Math.round(frame*1000/60),Vector:new Float32Array([0,0,frame<contact?(hops[pose]??0)*Math.sin(Math.PI*frame/contact):0])});
    const shadowLow = character === 9 && pose === "downTilt";
    if (wardenWeaponPose(character,pose) || shadowLow) aimWeaponContact(model,index,start,contact,total,pose,shadowLow);
    const binding=`{ index: ${index}, seconds: ${seconds((end-start)/1000)}${wardenWeaponPose(character,pose) || shadowLow?", aligned: true":""} }`;
    bindings.push(`    ${pose}: ${binding},`);
    if(special&&pose!=="ultimate")for(const suffix of ["Air","FollowUp","FollowUpAir"])bindings.push(`    ${pose}${suffix}: ${binding},`);
    const moments=[Math.max(1,contact-3),contact,Math.min(total-1,contact+5)];
    for(const facing of [1,-1])for(const frame of moments)drawnFrames.push({frame,facing,clip:index,seconds:frame/60,phase:AttackPhase.active,x:0,z:0,parts:[],strikes:[]});
    records.push({character,pose,index,contact,total,articulated,source:f.source,contactSeconds:contact/60,aligned:wardenWeaponPose(character,pose) || shadowLow});
  }
  bindings.push("  },");
  const bytes=encodeVerified(parseSource(generateMDX(model))),after=new DrawnModel(bytes,1);
  for(const [index,s]of source.Sequences.entries())for(const t of [0,0.5,1]) {
    const time=(s.Interval[1]-s.Interval[0])*t/1000,a=before.triangles(index,time,1),b=after.triangles(index,time,1);
    ensure(a.length===b.length&&a.every((v,i)=>Math.abs(v-(b[i]??Infinity))<0.001),`${f.name}/${s.Name}: previous clip changed`);
  }
  const target=join(output,f.source);mkdirSync(dirname(target),{recursive:true});await Bun.write(target,bytes);chmodSync(target,0o644);
  await Bun.write(join(output,`${f.name}-attack-gestures.png`),sheet(f.name,new DrawnModel(bytes,characterModelScale(character)),drawnFrames,6).png);
  console.log(`ATTACK_GESTURES_PASS ${f.name}: ${poses.length} gestures, ${source.Sequences.length} old clips preserved`);
}

function byFighter(lines:readonly string[]):string[]{const blocks:string[][]=[];for(const line of lines){if(/^  \d+: \{$/.test(line))blocks.push([]);blocks.at(-1)?.push(line);}return blocks.sort((a,b)=>parseInt(a[0]??"")-parseInt(b[0]??"")).flat();}
await Bun.write(join(project,"ts/src/game/presentation/rosterAttackClipInfo.ts"),["// Generated by tools/animations/attack-gesture-clips.ts; regenerate instead of editing.",'import { f32 } from "wisp/src/sim/f32";','import type { HeroClipTable } from "../sim/heroes/hero";',"export const ROSTER_ATTACK_CLIPS = {",...byFighter(bindings),"} as const satisfies Readonly<Record<number, HeroClipTable>>;",""].join("\n"));
await Bun.write(join(output,"attack-gestures.json"),JSON.stringify(records,null,2)+"\n");
