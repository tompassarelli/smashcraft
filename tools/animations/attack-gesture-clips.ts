// Foreign MDX boundary: authored contact gestures append to immutable fighter inputs.
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel, sheet } from "../../ts/scripts/wisp/hurtboxView";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { AttackPhase, AttackStyle, type Character } from "../../ts/src/game/sim/codes";
import { createFighter } from "../../ts/src/game/sim/fighter";
import { heroDefinition } from "../../ts/src/game/sim/heroes/registry";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { attackStartupFrames, attackDurationFramesForGrounding } from "../../ts/src/game/sim/moves";
import { heroCueWindows } from "../../ts/src/game/presentation/specialCues";
import { ROSTER_ATTACK_CLIPS } from "../../ts/src/game/presentation/rosterAttackClipInfo";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, fighters, onGlobalClock, parseSource, tracks } from "./original-clips";
import { attackGestureBaseModel } from "./recovery-model";

const PLAN: Readonly<Record<number, readonly HeroPose[]>> = {
  2: ["jab3"],
  4: ["jab", "jab2", "upTilt", "upSmash", "neutralAir", "upAir", "backAir", "dashAttack", "forwardAir"],
  5: ["jab3", "forwardTiltDown", "downTilt", "neutralAir", "backAir", "downSmash", "dashAttack", "forwardAir", "upSmash", "upAir", "upTilt", "forwardTiltUp"],
  6: ["forwardTiltDown", "downTilt", "backAir", "downSpecial", "forwardTilt", "forwardTiltUp", "upTilt", "forwardSmash", "upSmash", "downSmash", "dashAttack", "forwardAir", "upAir"],
  8: ["jab2", "jab3", "downTilt", "forwardSmash", "forwardAir", "backAir", "upAir", "upTilt", "neutralAir"],
  9: ["jab3", "forwardTilt", "forwardTiltUp", "upTilt", "dashAttack", "forwardAir", "upSmash", "upAir", "forwardSmash"],
  10: ["forwardTilt", "forwardAir", "upAir", "neutralAir"],
  11: ["jab2", "jab3", "forwardTilt", "forwardTiltDown", "downTilt", "dashAttack", "backAir", "upSmash", "neutralAir", "upAir", "forwardAir", "downSpecial"],
  12: ["forwardTiltDown"],
};

// Torso, leading upper arm, off arm, leading elbow, wrist, leading hip, knee, body lean.
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

// A rig whose shared profile draws too little toward the strike, or a jab as long as its forward tilt (#163), gets its own.
const FIGHTER_CONTACT: Readonly<Record<number, Readonly<Record<string, readonly number[]>>>> = {
  2: { jab3: [-17, -69, 0, 3, 25, 1, -2, 40] },
  4: { jab: [-7, 1, 78, -1, -90, 15, 10, 1], jab2: [70, -2, -91, -18, -90, -13, 5, -25], upTilt: [34, -145, -103, 15, 35, -5, -1, 0], dashAttack: [30, 10, -60, -40, 0, 15, 20, 12] },
  6: { forwardTilt: [-10, -45, 5, -2, -1, 0, 0, 10], forwardTiltDown: [25, -70, 10, 0, 0, 0, 0, 12], downTilt: [20, -68, 15, -10, -10, 0, 0, 25], dashAttack: [28, -84, -5, 1, 2, 0, 0, 10] },
  8: { jab2: [-12, -48, -42, 38, -20, 18, -8, 10], jab3: [3, -75, 80, -52, 25, 6, 35, 5], downTilt: [15, 35, 50, -15, -60, -83, 95, 10] },
  9: { jab3: [23, -75, 45, -2, 25, -24, 35, 5], forwardTilt: [50, -75, 35, -15, 65, -18, 22, -20], dashAttack: [48, -75, 65, -22, 50, -65, 100, -5] },
  10: { forwardTilt: [32, -95, 35, -48, -22, -18, 22, 20] },
  11: {
    jab2: [-57, -48, -42, 38, -20, 18, -8, 0], jab3: [-17, -75, 45, -42, 25, -24, 35, 0], forwardTilt: [32, -55, 35, 12, 18, -18, 22, 0],
    forwardTiltDown: [33, -10, -60, -32, -45, -35, 48, 0], dashAttack: [48, -65, 65, -2, 15, -65, 100, 0],
  },
  12: { forwardTiltDown: [8, 15, -30, -32, -45, -35, 48, 0] },
};
// How far the fighter draws back before the strike, as a fraction of the contact pose (0.3 unless named).
const DRAW_BACK: Readonly<Record<number, Readonly<Record<string, number>>>> = {
  4: { jab: 0.5, upTilt: 1 }, 8: { downTilt: 0.4 }, 11: { jab2: 0.4 },
};
const contactProfile=(pose: HeroPose, character: number)=>FIGHTER_CONTACT[character]?.[pose]??CONTACT[pose];
// A strike centred on the body draws by leaving the floor: the hop's height, landing on the contact frame.
const HOP: Readonly<Record<number, Readonly<Record<string, number>>>> = {
  4: { dashAttack: 36 },
};

function joint(name: string, pose: HeroPose, character: number): number {
  if (wardenWeaponPose(character, pose)) return name === "Bone_Head" ? 4 : name === "Bone_Arm1_L" ? 20 : name === "Bone_Arm2_L" ? -10 : name === "Bone_Arm1_R" || name === "Bone_Arm2_R" ? 1 : 0;
  const p=contactProfile(pose,character);ensure(p,`missing contact profile ${pose}`);
  const left=/(?:_L|ArmL|HandL|LegL|^L(?:hip|knee|shoulder|elbow|hand))$/i.test(name);
  const heavy=character===4||character===7||character===10, scale=heavy?0.8:character===9?1.12:1;
  if(/^(Bone_Chest|Chest|Bone NECK|Stomach)$/.test(name))return p[0]!*scale;
  if(/^(Bone_Pelvis|Pelvis|Bone Koto Waist01)$/.test(name))return -p[0]!*0.25;
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

const wardenWeaponPose = (character: number, pose: HeroPose) => character === 5 && ["jab3", "forwardTiltDown", "downTilt", "dashAttack", "upSmash", "upAir", "upTilt", "forwardTiltUp"].includes(pose);

function aimWardenWeapon(model: mdx.Model, index: number, start: number, contact: number, total: number, pose: HeroPose) {
  const nodes = [...model.Bones, ...model.Helpers, ...model.Attachments];
  const named = (name: string) => { const node = nodes.find(n => n.Name === name); ensure(node, name); return node; };
  const arm = [named("Bone_Arm1_R"), named("Bone_Arm2_R")], hand = named("Bone_Hand_R"), tip = named("Weapon Ref");
  const renderer = new ModelRenderer(model); renderer.setSequence(index);
  const data = Reflect.get(renderer, "rendererData") as { frame: number; nodes: { matrix: Float32Array }[] };
  const position = (node: mdx.Node) => { const m = data.nodes[node.ObjectId]!.matrix, v = model.PivotPoints[node.ObjectId]!; return [m[0]!*v[0]!+m[4]!*v[1]!+m[8]!*v[2]!+m[12]!, m[1]!*v[0]!+m[5]!*v[1]!+m[9]!*v[2]!+m[13]!, m[2]!*v[0]!+m[6]!*v[1]!+m[10]!*v[2]!+m[14]!]; };
  data.frame = start; renderer.update(0);
  const initialHand = position(hand), initialTip = position(tip);
  const targets: Readonly<Record<string, readonly [number[], number[]]>> = {
    jab3: [[58,-27,99],[108,-28,99]],
    forwardTiltDown: [[50,-27,66],[95,-28,35]],
    downTilt: [[39,-27,64],[79,-28,28]],
    dashAttack: [[58,-27,89],[105,-28,74]],
    upSmash: [[0,-27,140],[0,-28,193]],
    upTilt: [[12,-27,137],[12,-28,190]],
    upAir: [[20,-27,132],[49,-28,177]],
    forwardTiltUp: [[28,-27,128],[63,-28,168]],
  };
  const [targetHand,targetTip] = targets[pose]!;
  for (let frame = 0; frame <= total; frame++) {
    const at = start + Math.round(frame*1000/60); data.frame = at; renderer.update(0);
    const anticipation = Math.max(1,contact-2);
    const weight = frame < anticipation ? -0.3*Math.sin(frame/anticipation*Math.PI/2) : frame <= contact ? -0.3+1.3*(frame-anticipation)/(contact-anticipation) : frame < contact+3 ? 1 : Math.max(0,1-(frame-contact-3)/(total-contact-3));
    const target = (from: number[], to: number[]) => from.map((v,i) => v+(to[i]!-v)*weight);
    const aim = (node: mdx.Node, effector: mdx.Node, target: number[]) => {
      const origin = position(node), a = position(effector).map((v,i) => v-origin[i]!), b = target.map((v,i) => v-origin[i]!);
      const an = Math.hypot(...a), bn = Math.hypot(...b); if (an < 0.001 || bn < 0.001) return;
      const av = a.map(v => v/an), bv = b.map(v => v/bn), cross = [av[1]!*bv[2]!-av[2]!*bv[1]!, av[2]!*bv[0]!-av[0]!*bv[2]!, av[0]!*bv[1]!-av[1]!*bv[0]!], length = Math.hypot(...cross); if (length < 0.00001) return;
      const axis = cross.map(v => v/length), parent = node.Parent == null ? undefined : data.nodes[node.Parent]?.matrix;
      const local = parent ? [0,1,2].map(i => (axis[0]!*parent[i*4]!+axis[1]!*parent[i*4+1]!+axis[2]!*parent[i*4+2]!)/Math.hypot(parent[i*4]!,parent[i*4+1]!,parent[i*4+2]!)) : axis;
      const key = node.Rotation?.Keys.find(k => k.Frame === at); ensure(key, `${node.Name}: missing contact key`);
      const angle = Math.acos(Math.max(-1,Math.min(1,av.reduce((sum,v,i) => sum+v*bv[i]!,0))))/2, s = Math.sin(angle), q = key.Vector, [x,y,z] = local;
      const [u,v,w,t] = q, d = Math.cos(angle), p = [x!*s,y!*s,z!*s];
      const vector = new Float32Array([d*u!+p[0]!*t!+p[1]!*w!-p[2]!*v!, d*v!-p[0]!*w!+p[1]!*t!+p[2]!*u!, d*w!+p[0]!*v!-p[1]!*u!+p[2]!*t!, d*t!-p[0]!*u!-p[1]!*v!-p[2]!*w!]);
      const norm = Math.hypot(...vector); key.Vector = vector.map(v => v/norm); if (key.InTan) { key.InTan = key.Vector.slice(); key.OutTan = key.Vector.slice(); } renderer.update(0);
    };
    for (let iteration = 0; iteration < 12; iteration++) for (const node of arm.toReversed()) aim(node,hand,target(initialHand,targetHand));
    aim(hand,tip,target(initialTip,targetTip));
  }
}

const [inputArg,outputArg,...options]=process.argv.slice(2),input=resolve(inputArg??""),output=resolve(outputArg??""),project=resolve(import.meta.dir,"../..");
const only=options[0]==="--character"?Number(options[1]):undefined;
ensure(input&&output&&relative(project,output).startsWith(".."),"usage: bun tools/animations/attack-gesture-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
mkdirSync(output,{recursive:true});
// A retained binding is written as the shortest decimal of its f32 seconds, as a freshly authored one is.
const authoredSeconds=(value:number)=>{for(let digits=1;digits<17;digits++){const decimal=Number(value.toPrecision(digits));if(Math.fround(decimal)===value)return decimal;}return value;};
const bindings:string[]=[],records:object[]=only!==undefined&&await Bun.file(join(output,"attack-gestures.json")).exists()
  ? (await Bun.file(join(output,"attack-gestures.json")).json() as {character:number}[]).filter(r=>r.character!==only) : [];
if(only!==undefined)for(const [id,table]of Object.entries(ROSTER_ATTACK_CLIPS))if(Number(id)!==only) {
  bindings.push(`  ${id}: {`);
  for(const [pose,clip]of Object.entries(table))if(clip)bindings.push(`    ${pose}: { index: ${clip.index}, seconds: ${seconds(authoredSeconds(clip.seconds))} },`);
  bindings.push("  },");
}
for(const [id,poses]of Object.entries(PLAN)) {
  if(only!==undefined&&Number(id)!==only)continue;
  const character=Number(id) as Character,f=fighters.get(character)!;ensure(f,"missing fighter");
  // A published model already carries its gestures: author again from the model they were appended to.
  const published=parseSource(await Bun.file(join(input,f.source)).arrayBuffer()),base=attackGestureBaseModel(published);
  const source=base?parseSource(generateMDX(base)):published;
  ensure(!source.Sequences.some(s=>s.Name.startsWith("Attack Gesture ")),`${f.name}: input already has roster gestures`);
  const model=structuredClone(source),stand=source.Sequences.find(s=>/^stand ready$/i.test(s.Name))??source.Sequences.find(s=>/^stand(?:\s*-?\s*1)?$/i.test(s.Name));
  ensure(stand,`${f.name}: missing stand`);
  const before=new DrawnModel(generateMDX(source),1),originals=new Map<string,mdx.AnimVector>(); tracks(source,(t,p)=>originals.set(p,t));
  const root=model.Nodes.length,helper:mdx.Helper={Name:"Attack Gesture",ObjectId:root,Parent:null,Flags:0,PivotPoint:new Float32Array([0,0,60]),Rotation:{LineType:1,GlobalSeqId:-1,Keys:[]}};
  for(const node of [...model.Bones,...model.Helpers,...model.Attachments])if(node.Parent==null)node.Parent=root;
  model.Helpers.push(helper);model.Nodes.push(helper);model.PivotPoints.push(helper.PivotPoint);
  const hops=HOP[character]??{},hop:mdx.AnimVector|undefined=Object.keys(hops).length?{LineType:1,GlobalSeqId:-1,Keys:[]}:undefined;if(hop)helper.Translation=hop;
  for(const sequence of source.Sequences)for(const Frame of sequence.Interval) {
    helper.Rotation?.Keys.push({Frame,Vector:new Float32Array([0,0,0,1])});
    hop?.Keys.push({Frame,Vector:new Float32Array([0,0,0])});
  }
  let cursor=Math.max(...source.Sequences.map(s=>s.Interval[1]))+100;
  const drawnFrames=[];bindings.push(`  ${id}: {`);
  for(const pose of poses) {
    const special=pose==="downSpecial"?heroDefinition(character)?.specials?.down.ground:undefined;
    const style=pose==="downSpecial"?undefined:AttackStyle[pose as keyof typeof AttackStyle];
    const moves=createFighter(character,0,1).tuning.moves;
    const contact=special?heroCueWindows(special,1).active.first:attackStartupFrames(style!,moves);
    const total=special?special.endFrame:attackDurationFramesForGrounding(style!,!pose.endsWith("Air"),moves);
    ensure(contact>0&&total>contact,`${f.name}/${pose}: invalid timing`);
    const start=cursor,end=start+Math.round(total*1000/60),index=model.Sequences.length;cursor=end+100;
    model.Sequences.push({...stand,Name:`Attack Gesture ${pose}`,Interval:new Uint32Array([start,end]),NonLooping:true,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});
    let articulated=0;const back=DRAW_BACK[character]?.[pose]??0.3;
    tracks(model,(track,path)=>{
      const donor=originals.get(path);if(!donor||onGlobalClock(donor))return;
      const key=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);if(!key)return;
      const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path),node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
      const amount=node?joint(node.Name,pose,character):0;if(amount)articulated++;
      for(let frame=0;frame<=total;frame++) {
        const anticipation=Math.max(1,contact-2);
        const amountAt=frame<anticipation?-back*Math.sin(frame/anticipation*Math.PI/2):frame<=contact?-back+(1+back)*(frame-anticipation)/(contact-anticipation):frame<contact+3?1+0.18*(frame-contact)/3:1.18*Math.max(0,1-(frame-contact-3)/(total-contact-3));
        const Vector=amount?rotate(key.Vector,amount*amountAt):key.Vector.slice();
        track.Keys.push({...key,Frame:start+Math.round(frame*1000/60),Vector,...key.InTan?{InTan:Vector.slice(),OutTan:Vector.slice()}: {}});
      }
    });
    ensure(articulated>=4,`${f.name}/${pose}: only ${articulated} moving joints`);
    for(let frame=0;frame<=total;frame++) {
      const arc=frame<=contact?Math.sin(frame/contact*Math.PI/2):Math.max(0,1-(frame-contact)/(total-contact));
      helper.Rotation?.Keys.push({Frame:start+Math.round(frame*1000/60),Vector:rotate(new Float32Array([0,0,0,1]),wardenWeaponPose(character,pose)?0:contactProfile(pose,character)![7]!*arc)});
    }
    if(hop)for(let frame=0;frame<=total;frame++)hop.Keys.push({Frame:start+Math.round(frame*1000/60),Vector:new Float32Array([0,0,frame<contact?(hops[pose]??0)*Math.sin(Math.PI*frame/contact):0])});
    if (wardenWeaponPose(character,pose)) aimWardenWeapon(model,index,start,contact,total,pose);
    const binding=`{ index: ${index}, seconds: ${seconds((end-start)/1000)}${wardenWeaponPose(character,pose)?", aligned: true":""} }`;
    bindings.push(`    ${pose}: ${binding},`);
    if(special)for(const suffix of ["Air","FollowUp","FollowUpAir"])bindings.push(`    ${pose}${suffix}: ${binding},`);
    const moments=[Math.max(1,contact-3),contact,Math.min(total-1,contact+5)];
    for(const facing of [1,-1])for(const frame of moments)drawnFrames.push({frame,facing,clip:index,seconds:frame/60,phase:AttackPhase.active,x:0,z:0,parts:[],strikes:[]});
    records.push({character,pose,index,contact,total,articulated,source:f.source,contactSeconds:contact/60,aligned:false});
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
// Fighters stay in Character order whichever one --character regenerated.
function byFighter(lines:readonly string[]):string[]{const blocks:string[][]=[];for(const line of lines){if(/^  \d+: \{$/.test(line))blocks.push([]);blocks.at(-1)?.push(line);}return blocks.sort((a,b)=>parseInt(a[0]??"")-parseInt(b[0]??"")).flat();}
await Bun.write(join(project,"ts/src/game/presentation/rosterAttackClipInfo.ts"),["// Generated by tools/animations/attack-gesture-clips.ts; regenerate instead of editing.",'import { f32 } from "wisp/src/sim/f32";','import type { HeroClipTable } from "../sim/heroes/hero";',"export const ROSTER_ATTACK_CLIPS = {",...byFighter(bindings),"} as const satisfies Readonly<Record<number, HeroClipTable>>;",""].join("\n"));
await Bun.write(join(output,"attack-gestures.json"),JSON.stringify(records,null,2)+"\n");
