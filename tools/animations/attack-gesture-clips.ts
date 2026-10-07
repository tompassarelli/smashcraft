// Foreign MDX boundary: authored contact gestures append to immutable fighter inputs.
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
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

const PLAN: Readonly<Record<number, readonly HeroPose[]>> = {
  0: ["dashAttack"], 2: ["jab3"],
  4: ["jab", "jab2", "upTilt", "upSmash", "neutralAir", "upAir", "backAir", "dashAttack", "forwardAir"],
  5: ["jab3", "forwardTiltDown", "downTilt", "neutralAir", "backAir", "downSmash", "dashAttack", "forwardAir", "upSmash", "upAir"],
  6: ["forwardTiltDown", "downTilt", "backAir", "downSpecial", "forwardTilt", "forwardTiltUp", "upTilt", "forwardSmash", "upSmash", "downSmash", "dashAttack", "forwardAir", "upAir"],
  7: ["jab2", "downTilt", "neutralAir", "forwardTiltUp", "forwardTiltDown", "forwardSmash", "downSmash", "dashAttack", "forwardAir", "upSmash", "upAir"],
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

function joint(name: string, pose: HeroPose, character: number): number {
  const p=CONTACT[pose];ensure(p,`missing contact profile ${pose}`);
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

const [inputArg,outputArg,...options]=process.argv.slice(2),input=resolve(inputArg??""),output=resolve(outputArg??""),project=resolve(import.meta.dir,"../..");
const only=options[0]==="--character"?Number(options[1]):undefined;
ensure(input&&output&&relative(project,output).startsWith(".."),"usage: bun tools/animations/attack-gesture-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
mkdirSync(output,{recursive:true});
const bindings:string[]=[],records:object[]=only!==undefined&&await Bun.file(join(output,"attack-gestures.json")).exists()
  ? (await Bun.file(join(output,"attack-gestures.json")).json() as {character:number}[]).filter(r=>r.character!==only) : [];
if(only!==undefined)for(const [id,table]of Object.entries(ROSTER_ATTACK_CLIPS))if(Number(id)!==only) {
  bindings.push(`  ${id}: {`);
  for(const [pose,clip]of Object.entries(table))if(clip)bindings.push(`    ${pose}: { index: ${clip.index}, seconds: ${seconds(clip.seconds)} },`);
  bindings.push("  },");
}
for(const [id,poses]of Object.entries(PLAN)) {
  if(only!==undefined&&Number(id)!==only)continue;
  const character=Number(id) as Character,f=fighters[character];ensure(f,"missing fighter");
  const source=parseSource(await Bun.file(join(input,f.source)).arrayBuffer());
  ensure(!source.Sequences.some(s=>s.Name.startsWith("Attack Gesture ")),`${f.name}: input already has roster gestures`);
  const model=structuredClone(source),stand=source.Sequences.find(s=>/^stand ready$/i.test(s.Name))??source.Sequences.find(s=>/^stand(?:\s*-?\s*1)?$/i.test(s.Name));
  ensure(stand,`${f.name}: missing stand`);
  const before=new DrawnModel(generateMDX(source),1),originals=new Map<string,mdx.AnimVector>(); tracks(source,(t,p)=>originals.set(p,t));
  const root=model.Nodes.length,helper:mdx.Helper={Name:"Attack Gesture",ObjectId:root,Parent:null,Flags:0,PivotPoint:new Float32Array([0,0,60]),Rotation:{LineType:1,GlobalSeqId:-1,Keys:[]}};
  for(const node of [...model.Bones,...model.Helpers,...model.Attachments])if(node.Parent==null)node.Parent=root;
  model.Helpers.push(helper);model.Nodes.push(helper);model.PivotPoints.push(helper.PivotPoint);
  for(const sequence of source.Sequences)for(const Frame of sequence.Interval)helper.Rotation?.Keys.push({Frame,Vector:new Float32Array([0,0,0,1])});
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
    let articulated=0;
    tracks(model,(track,path)=>{
      const donor=originals.get(path);if(!donor||onGlobalClock(donor))return;
      const key=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);if(!key)return;
      const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path),node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
      const amount=node?joint(node.Name,pose,character):0;if(amount)articulated++;
      for(let frame=0;frame<=total;frame++) {
        const anticipation=Math.max(1,contact-2);
        const amountAt=frame<anticipation?-0.3*Math.sin(frame/anticipation*Math.PI/2):frame<=contact?-0.3+1.3*(frame-anticipation)/(contact-anticipation):frame<contact+3?1+0.18*(frame-contact)/3:1.18*Math.max(0,1-(frame-contact-3)/(total-contact-3));
        const Vector=amount?rotate(key.Vector,amount*amountAt):key.Vector.slice();
        track.Keys.push({...key,Frame:start+Math.round(frame*1000/60),Vector,...key.InTan?{InTan:Vector.slice(),OutTan:Vector.slice()}: {}});
      }
    });
    ensure(articulated>=4,`${f.name}/${pose}: only ${articulated} moving joints`);
    for(let frame=0;frame<=total;frame++) {
      const arc=frame<=contact?Math.sin(frame/contact*Math.PI/2):Math.max(0,1-(frame-contact)/(total-contact));
      helper.Rotation?.Keys.push({Frame:start+Math.round(frame*1000/60),Vector:rotate(new Float32Array([0,0,0,1]),CONTACT[pose]![7]!*arc)});
    }
    const binding=`{ index: ${index}, seconds: ${seconds((end-start)/1000)} }`;
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
await Bun.write(join(project,"ts/src/game/presentation/rosterAttackClipInfo.ts"),["// Generated by tools/animations/attack-gesture-clips.ts; regenerate instead of editing.",'import { f32 } from "wisp/src/sim/f32";','import type { HeroClipTable } from "../sim/heroes/hero";',"export const ROSTER_ATTACK_CLIPS = {",...bindings,"} as const satisfies Readonly<Record<number, HeroClipTable>>;",""].join("\n"));
await Bun.write(join(output,"attack-gestures.json"),JSON.stringify(records,null,2)+"\n");
