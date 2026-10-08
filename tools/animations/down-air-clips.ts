// Foreign MDX boundary: append down-air gestures while retaining shipped clips.
import { chmodSync, cpSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/hurtboxView";
import { Character, AttackStyle } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/sim/heroes/registry";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, fighters, onGlobalClock, parseSource, tracks } from "./original-clips";
const [input, output] = process.argv.slice(2, 4).map(p => resolve(p));
const characterAt = process.argv.indexOf("--character");
const selected = characterAt < 0 ? undefined : Number(process.argv[characterAt + 1]);
ensure(selected === undefined || selected === Character.lich, "--character supports Lich's contact repair (6)");
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/down-air-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
mkdirSync(output, {recursive:true});
cpSync(join(input,"hero-models"),join(output,"hero-models"),{recursive:true,dereference:true});
chmodSync(join(output,"hero-models"),0o755);
const gestures = [
  {character:Character.blademaster,name:"Sword Plunge",chest:12,wrist:95,arm:15,knee:85},
  {character:Character.mountainKing,name:"Boot Stomp",chest:-15,wrist:0,arm:-65,knee:0},
  {character:Character.lich,name:"Frost Press",chest:48,wrist:45,arm:20,knee:0},
  {character:Character.dreadlord,name:"Claw Dive",chest:45,wrist:40,arm:25,knee:70},
  {character:Character.pitLord,name:"Four Hooves",chest:-15,wrist:0,arm:-70,knee:0},
  {character:Character.beastmaster,name:"Twin Axe Drop",chest:35,wrist:90,arm:-15,knee:65},
];
function pitch(q: Float32Array | Int32Array, degrees: number): Float32Array {
  const s=Math.sin(degrees*Math.PI/360),c=Math.cos(degrees*Math.PI/360),[x=0,y=0,z=0,w=1]=q;
  const v=new Float32Array([c*x+s*z,c*y+s*w,c*z-s*x,c*w-s*y]);
  const norm=Math.hypot(...v);for(let i=0;i<v.length;i++)v[i]=v[i]!/norm;return v;
}
function joint(name:string,g:typeof gestures[number],coil:boolean):number {
  if (/^(Bone_Chest|Chest|Bone NECK)$/.test(name)) return coil?-20:g.chest;
  if (name === "Bone_Head" && g.character!==Character.lich) return coil?-10:20;
  if (g.character===Character.lich) {
    if(name==="Recovery Motion")return coil?-10:60;
    if(name==="Mesh01")return coil?-18:5;
    if(/^(Cylinder06|Cylinder07)$/.test(name))return coil?-115:-15;
    if(/^(Mesh04|Mesh05)$/.test(name))return coil?30:15;
    if(/^(Mesh02|Mesh03)$/.test(name))return coil?0:65;
  }
  if (/^(Bone_Arm1_[LR]|UpArm[LR]|[RL][Ss]houlder)$/.test(name))return coil?-125:g.arm;
  if (/^(Bone_Arm2_[LR]|LowArm[LR]|[RL]elbow)$/.test(name))return coil?55:0;
  if (/^(Bone_Hand_[LR]|Hand[LR])$/.test(name))return coil?0:g.wrist;
  if (/^(Bone_Leg1_[LR]|UpperLeg[LR]|[RL]hip)$/.test(name)) {
    const left=/(_L|LegL|Lhip)/.test(name);return coil?-70:left?-g.knee:0;
  }
  if (/^(Bone_Leg2_[LR]|LowerLeg[LR]|[RL]knee)$/.test(name))return coil?110:name.endsWith("_L")?g.knee:0;
  if (/^Bone (Front|Back) [LR] Leg01$/.test(name))return coil?-55:25;
  if (/^Bone (Front|Back) [LR] Shin01$/.test(name))return coil?90:-30;
  return 0;
}
const bindings:string[]=[], records=[];
for(const g of gestures){
  const f=fighters[g.character],hero=heroDefinition(g.character),move=hero?.moves.normals[AttackStyle.downAir];ensure(f&&move,"missing fighter move");
  const source=parseSource(await Bun.file(join(input,f.source)).arrayBuffer()),model=structuredClone(source);
  const stand=source.Sequences.find(s=>/^stand(?:\s*-?\s*1)?$/i.test(s.Name))??source.Sequences.find(s=>/^stand ready$/i.test(s.Name));ensure(stand,"missing stand");
  const name=`Down Air ${g.name}`,existing=source.Sequences.findIndex(s=>s.Name===name);
  if (selected !== undefined && g.character !== selected) {
    ensure(existing >= 0, `${f.name}: retained down air missing`);
    const sequence = source.Sequences[existing]!;
    bindings.push(`  ${g.character}: { downAir: { index: ${existing}, seconds: ${seconds((sequence.Interval[1]-sequence.Interval[0])/1000)}, aligned: true } },`);
    continue;
  }
  const index=existing<0?source.Sequences.length:existing,start=existing<0?Math.max(...source.Sequences.map(s=>s.Interval[1]))+100:source.Sequences[index]!.Interval[0];
  const end=existing<0?start+Math.round(move.totalFrames*1000/60):source.Sequences[existing]!.Interval[1];
  model.Sequences[index]={...stand,Name:name,Interval:new Uint32Array([start,end]),NonLooping:true,MoveSpeed:0,Rarity:0,
    MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400};
  const originals=new Map<string,mdx.AnimVector>();tracks(source,(t,p)=>originals.set(p,t));
  let joints=0;
  tracks(model,(track,path)=>{
    const donor=originals.get(path);if(!donor||onGlobalClock(donor))return;
    const first=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);if(!first)return;
    track.Keys=track.Keys.filter(k=>k.Frame<start||k.Frame>end);
    const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path),node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
    if(node&&joint(node.Name,g,false)!==0)joints++;
    for(const [frame,coil]of [[0,false],[Math.max(1,move.startupFrames-3),true],[move.startupFrames,false],[move.startupFrames+move.activeFrames,false],[move.totalFrames,false]] as const){
      const degrees=node?joint(node.Name,g,coil):0;
      const returning=frame===0||frame===move.totalFrames;
      const Vector=degrees&&!returning?pitch(first.Vector,degrees):first.Vector.slice();
      const tangent=()=>match||track.LineType===mdx.LineType.Bezier?Vector.slice():new Float32Array(Vector.length);
      track.Keys.push({...first,Frame:start+Math.round(frame*1000/60),Vector,...first.InTan?{InTan:tangent(),OutTan:tangent()}: {}});
    }
    track.Keys.sort((a,b)=>a.Frame-b.Frame);
  });
  ensure(joints>=4,`${f.name}: insufficient articulated joints`);
  const bytes=encodeVerified(parseSource(generateMDX(model)));
  const before=new DrawnModel(generateMDX(source),1),after=new DrawnModel(bytes,1);
  for(const [clip,s]of source.Sequences.entries())if(clip!==existing)for(const t of [0,0.5,1]){
    const seconds=(s.Interval[1]-s.Interval[0])*t/1000,a=before.triangles(clip,seconds,1),b=after.triangles(clip,seconds,1);
    ensure(a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i]!)<0.001),`${f.name}/${s.Name}: previous clip changed`);
  }
  chmodSync(join(output,f.source),0o644);await Bun.write(join(output,f.source),bytes);
  bindings.push(`  ${g.character}: { downAir: { index: ${index}, seconds: ${seconds((end-start)/1000)}, aligned: true } },`);
  records.push({character:g.character,name,index,joints,first:move.startupFrames,last:move.startupFrames+move.activeFrames-1,frames:move.totalFrames});
  console.log(`DOWN_AIR_PASS ${f.name}: ${name} #${index}, ${joints} articulated joints, ${source.Sequences.length} prior clips preserved`);
}
await Bun.write(join(project,"ts/src/game/presentation/downAirClipInfo.ts"),[
  "// Generated by tools/animations/down-air-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";','import type { HeroClipTable } from "../sim/heroes/hero";',
  "export const DOWN_AIR_CLIPS = {",...bindings,"} as const satisfies Readonly<Record<number, HeroClipTable>>;","",
].join("\n"));
await Bun.write(join(output,"down-air-clips.json"),JSON.stringify(records,null,2)+"\n");
