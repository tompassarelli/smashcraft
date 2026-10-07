// Tinker's two stock rigs retain their geometry; authored actions append local
// joint motion and sequence-local visibility, with simulation owning travel.
import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { drawnStrideSource, type DrawnStride } from "../../ts/scripts/wisp/drawnMotion";
import { DRAWN_STRIDES } from "../../ts/src/game/presentation/drawnStrideInfo";
import { Character } from "../../ts/src/game/sim/codes";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, hash, onGlobalClock, originalBodyClip, parseSource, tracks } from "./original-clips";

interface Shape { chest?: number; head?: number; right?: number; left?: number; elbow?: number; legs?: number; knees?: number; root?: number; yaw?: number; height?: number }
interface Phase extends Shape { frame: number }
interface Action { pose: string; frames: number; contact?: number; phases: Phase[]; donor?: number; robot?: boolean; loop?: boolean }
const strike = (pose: string, first: number, active: number, recovery: number, contact: Shape, prepare: Shape = {chest: -12, right: -20, left: -15}, donor = 6): Action => ({
  pose, frames: first - 1 + active + recovery, donor, phases: [{frame: 0}, {frame: Math.max(1, first - 3), ...prepare},
    {frame: first - 1, ...contact}, {frame: first + active - 2, ...contact},
    {frame: first + active + 4, ...contact, chest: (contact.chest ?? 0) * 0.4}, {frame: first - 1 + active + recovery}],
});
const roll = (pose: string, frames: number, sign: number, floor = false): Action => ({pose,frames,phases:[
  {frame:0,root:floor?90:0}, {frame:4,root:sign*45,legs:35,knees:65}, {frame:Math.round(frames*.4),root:sign*145,legs:55,knees:80},
  {frame:Math.round(frames*.7),root:sign*285,legs:35,knees:65}, {frame:frames,root:sign*360}],});
const actions: Action[] = [
  strike("jab",4,2,12,{right:38,left:-12,chest:12,elbow:-25}),
  strike("jab2",4,2,12,{right:-12,left:42,chest:16,elbow:-30}),
  strike("jab3",6,3,18,{right:52,left:48,chest:22,elbow:-35}),
  strike("forwardTilt",8,3,20,{right:64,left:36,chest:18,elbow:-35}),
  strike("forwardTiltUp",8,3,20,{right:94,left:62,chest:-12,elbow:-20}),
  strike("forwardTiltDown",8,3,20,{right:28,left:15,chest:32,legs:32,knees:45}),
  strike("upTilt",7,4,22,{right:-90,left:-85,chest:-8,elbow:0}),
  strike("downTilt",6,3,19,{right:32,left:-28,chest:45,legs:45,knees:65,yaw:25}),
  strike("dashAttack",10,4,26,{right:50,left:46,chest:35,legs:22,knees:30}),
  strike("forwardSmash",20,4,34,{right:80,left:28,chest:30,elbow:-42},{right:-58,left:-28,chest:-20},16),
  strike("upSmash",17,5,32,{right:-90,left:-90,chest:-8,legs:-12},{right:8,left:8,chest:32,legs:35,knees:55}),
  strike("downSmash",16,6,32,{right:46,left:46,chest:32,yaw:155,legs:32,knees:45},{right:-24,left:20,chest:-15,yaw:-55}),
  strike("neutralAir",8,6,24,{right:90,left:-65,yaw:160,chest:10},{right:-35,left:30,yaw:-35,legs:25}),
  strike("forwardAir",10,3,24,{right:76,left:76,chest:22,elbow:-35,legs:20,knees:45}),
  strike("backAir",12,3,26,{right:-60,left:-45,chest:-32,legs:45,knees:55},{chest:25,right:22,left:20}),
  strike("upAir",8,4,23,{right:-95,left:-75,chest:-8,legs:35,knees:45}),
  strike("downAir",16,4,31,{right:25,left:25,chest:-18,legs:-22,knees:-15},{right:82,left:82,chest:25,legs:55,knees:75}),
  strike("grab",8,2,25,{right:68,left:68,chest:20,elbow:-35}),
  {pose:"grabHold",frames:30,loop:true,phases:[{frame:0,right:58,left:58,chest:14,elbow:-28},{frame:30,right:58,left:58,chest:14,elbow:-28}]},
  {pose:"grabbed",frames:30,loop:true,phases:[{frame:0,chest:30,head:-28,right:25,left:-18,legs:15,knees:30},{frame:30,chest:30,head:-28,right:25,left:-18,legs:15,knees:30}]},
  strike("pummel",5,1,7,{right:48,left:65,chest:22,head:15},{right:48,left:45,chest:10}),
  {...strike("throwForward",15,1,21,{right:92,left:86,chest:34,elbow:-45},{right:45,left:45,chest:-12}),contact:14},
  {...strike("throwBack",19,1,24,{right:105,left:95,chest:-28,yaw:180},{right:55,left:55,chest:15,yaw:35}),contact:18},
  {...strike("throwUp",16,1,8,{right:138,left:132,chest:-30},{right:35,left:35,chest:30,legs:25,knees:40}),contact:15},
  {...strike("throwDown",20,1,24,{right:18,left:18,chest:55,legs:45,knees:60},{right:125,left:115,chest:-20}),contact:19},
  {pose:"neutralSpecial",frames:43,phases:[{frame:0},{frame:10,chest:-12,right:25,left:25},{frame:14,chest:-30,right:55,left:55},{frame:18,chest:-10,right:30,left:30},{frame:20,chest:-32,right:62,left:62},{frame:24,chest:-10,right:30,left:30},{frame:26,chest:-35,right:66,left:66},{frame:35,chest:-10},{frame:43}]},
  strike("sideSpecial",25,1,23,{right:40,left:40,chest:45,legs:35,knees:55},{right:100,left:100,chest:-12}),
  {pose:"sideSpecialFollowUp",frames:36,phases:[{frame:0},{frame:12,right:85,left:85,chest:25},{frame:24,right:35,left:35,chest:-15},{frame:36}]},
  {pose:"upSpecial",frames:32,phases:[{frame:0},{frame:6,chest:28,legs:45,knees:65},{frame:7,chest:-20,right:-25,left:-25,legs:-15},{frame:20,chest:-12,right:-35,left:-35,legs:18,knees:25},{frame:29,chest:10,right:45,left:45,legs:40,knees:55},{frame:32,chest:10,legs:40,knees:55}]},
  {pose:"downSpecial",frames:46,robot:true,phases:[{frame:0},{frame:7,chest:25,right:85,left:85,legs:35,knees:45},{frame:8,chest:-15,right:-35,left:45},{frame:12,chest:20,right:30,left:30},{frame:14,chest:30,right:85,left:65,elbow:-40},{frame:18,chest:30,right:95,left:75,elbow:-40},{frame:23,chest:15,right:55,left:45},{frame:24,chest:35,right:90,left:90,legs:35,knees:55},{frame:35,chest:20,right:25,left:25},{frame:46}]},
  {pose:"turn",frames:8,phases:[{frame:0,yaw:180},{frame:4,yaw:100,chest:15},{frame:8}]},
  {pose:"stop",frames:8,phases:[{frame:0,chest:-30,legs:25,knees:35},{frame:4,chest:-35,legs:35,knees:45},{frame:8}]},
  {pose:"jumpSquat",frames:4,phases:[{frame:0},{frame:3,chest:28,legs:48,knees:70},{frame:4,chest:20,legs:35,knees:50}]},
  {pose:"jump",frames:20,phases:[{frame:0,chest:-18,legs:-15,knees:-10},{frame:8,chest:-15,right:-30,left:-30,legs:25,knees:35},{frame:20,chest:10,legs:35,knees:45}]},
  {pose:"doubleJump",frames:20,phases:[{frame:0,legs:35,knees:45},{frame:8,chest:-28,right:-40,left:-40,legs:-20},{frame:20,chest:10,legs:35,knees:45}]},
  {pose:"fall",frames:30,loop:true,phases:[{frame:0,chest:12,right:45,left:45,legs:35,knees:45},{frame:15,chest:5,right:35,left:35,legs:25,knees:35},{frame:30,chest:12,right:45,left:45,legs:35,knees:45}]},
  {pose:"landing",frames:12,phases:[{frame:0,chest:35,legs:45,knees:65},{frame:5,chest:20,legs:30,knees:45},{frame:12}]},
  {pose:"crouch",frames:30,loop:true,phases:[{frame:0,chest:35,legs:45,knees:65,right:30,left:30},{frame:30,chest:35,legs:45,knees:65,right:30,left:30}]},
  {pose:"shield",frames:30,loop:true,phases:[{frame:0,chest:-12,right:75,left:70,elbow:35},{frame:30,chest:-12,right:75,left:70,elbow:35}]},
  {pose:"smashCharge",frames:30,loop:true,phases:[{frame:0,chest:-18,right:-45,left:-25},{frame:15,chest:-22,right:-50,left:-28},{frame:30,chest:-18,right:-45,left:-25}]},
  {pose:"spotDodge",frames:22,phases:[{frame:0},{frame:3,chest:-40,legs:35,knees:60,right:65,left:65},{frame:15,chest:-40,legs:35,knees:60},{frame:22}]},
  {pose:"airDodge",frames:49,phases:[{frame:0},{frame:4,chest:-25,legs:55,knees:80,right:75,left:75},{frame:30,chest:-25,legs:55,knees:80},{frame:49,chest:12,legs:35,knees:45}]},
  roll("rollForward",31,-1),roll("rollBackward",31,1),roll("techForward",40,-1,true),roll("techBackward",40,1,true),roll("getUpRollForward",35,-1,true),roll("getUpRollBackward",35,1,true),roll("ledgeRoll",36,-1,true),
  {pose:"knockdown",frames:24,phases:[{frame:0,root:60,legs:15},{frame:12,root:90,legs:25,knees:35},{frame:24,root:90,legs:25,knees:35}]},
  {pose:"downDamage",frames:12,phases:[{frame:0,root:90},{frame:3,root:105,chest:25,legs:30,knees:50},{frame:12,root:90}]},
  {pose:"getUp",frames:30,phases:[{frame:0,root:90},{frame:10,root:65,legs:45,knees:60},{frame:24,root:15,chest:25,legs:35,knees:45},{frame:30}]},
  {pose:"tech",frames:26,phases:[{frame:0,root:85},{frame:6,root:45,legs:55,knees:75},{frame:18,root:-12,chest:25},{frame:26}]},
  {pose:"getUpAttack",frames:49,phases:[{frame:0,root:90},{frame:12,root:45,right:-25,left:-25},{frame:16,root:15,right:80,left:45,yaw:0},{frame:19,root:15,right:80,left:45,yaw:180},{frame:32,root:5,yaw:240},{frame:49,yaw:360}]},
  {pose:"ledgeHang",frames:30,loop:true,phases:[{frame:0,height:-65,right:120,left:110,legs:25,knees:35},{frame:30,height:-65,right:120,left:110,legs:25,knees:35}]},
  {pose:"ledgeClimb",frames:25,phases:[{frame:0,height:-65,right:120,left:110},{frame:12,height:-20,chest:35,right:75,left:70,legs:45,knees:65},{frame:25}]},
  {pose:"ledgeAttack",frames:40,phases:[{frame:0,height:-65,right:120,left:110},{frame:12,height:-15,chest:35},{frame:18,right:85,left:75,chest:30},{frame:22,right:85,left:75,chest:30},{frame:40}]},
  {pose:"wallJump",frames:20,phases:[{frame:0,chest:35,legs:50,knees:65},{frame:5,chest:-30,right:-25,left:-25,legs:-25},{frame:20,chest:12,legs:35,knees:45}]},
  {pose:"wallTech",frames:26,phases:[{frame:0,root:45,chest:35,legs:55,knees:75},{frame:8,root:-20,chest:-25,legs:-20},{frame:26,chest:12,legs:35,knees:45}]},
  {pose:"dizzy",frames:60,loop:true,phases:[{frame:0,chest:-20,head:30,right:-20,left:35},{frame:15,chest:25,head:-35,right:30,left:-25},{frame:30,chest:-20,head:30,right:-20,left:35},{frame:45,chest:25,head:-35,right:30,left:-25},{frame:60,chest:-20,head:30,right:-20,left:35}]},
];
for (const [height, h] of ["low","mid","high"].entries()) for (const [strength,s] of ["small","medium","large"].entries()) {
  const amount=[.65,1,1.4][strength]!;
  const contact: Shape = height===0 ? {chest:-20*amount,head:-18*amount,right:25*amount,left:-20*amount,legs:45*amount,knees:60*amount}
    : height===1 ? {chest:42*amount,head:-30*amount,right:-35*amount,left:-25*amount,legs:15*amount,knees:30*amount}
    : {chest:-25*amount,head:-48*amount,right:-35*amount,left:-30*amount,legs:-12*amount,knees:20*amount};
  actions.push({pose:`pain${h}${s}`,frames:24,phases:[{frame:0,...contact},{frame:3,...contact},{frame:24,...Object.fromEntries(Object.entries(contact).map(([k,v])=>[k,v*.75]))}]});
}
for (const [pose,frames,contact,shape] of [
  ["victimPummel",13,4,{chest:48,head:-32,right:35,left:-20}],
  ["victimThrowForward",36,14,{root:-35,chest:-30,legs:45,knees:60}],
  ["victimThrowBack",43,18,{root:45,chest:35,legs:45,knees:60,yaw:180}],
  ["victimThrowUp",24,15,{chest:-30,right:-35,left:-35,legs:-15}],
  ["victimThrowDown",44,19,{root:90,chest:35,legs:40,knees:60}],
  ["damageShield",18,4,{chest:-30,right:90,left:85,elbow:45}],
] as const) actions.push({pose,frames,phases:[{frame:0,chest:25,right:55,left:55},
  {frame:Math.max(1,contact-3),chest:35,right:65,left:65},{frame:contact,...shape},
  {frame:frames,...shape}]});
const [inputArg,outputArg] = process.argv.slice(2);
ensure(inputArg&&outputArg,"usage: bun tools/animations/tinker-clips.ts SOURCE.mdx PRIVATE_OUTPUT");
const input=resolve(inputArg), output=resolve(outputArg), project=resolve(import.meta.dir,"../..");
ensure(relative(project,output).startsWith(".."),"Derived Warcraft assets must be outside the checkout");
mkdirSync(join(output,"hero-models"),{recursive:true});
const source=parseSource(await Bun.file(input).arrayBuffer()), model=structuredClone(source);
ensure(source.Sequences.length===23,"Tinker authoring requires the unmodified classic 23-sequence model");
const helperId=model.Nodes.length;
const motion:mdx.Helper={Name:"Tinker Floor Motion",ObjectId:helperId,Parent:null,Flags:0,
  PivotPoint:new Float32Array([0,0,0]),Translation:{LineType:1,GlobalSeqId:null,Keys:[]}};
for(const node of [...model.Bones,...model.Helpers,...model.Attachments,...model.CollisionShapes])if(node.Parent==null)node.Parent=helperId;
model.Helpers.push(motion);model.Nodes.push(motion);model.PivotPoints.push(motion.PivotPoint);
for(const sequence of source.Sequences)for(const Frame of sequence.Interval)
  motion.Translation!.Keys.push({Frame,Vector:new Float32Array([0,0,0])});
const original=new Map<string,mdx.AnimVector>(); tracks(source,(t,p)=>original.set(p,t));
function sample(track: mdx.AnimVector, sequence: number, progress=0): Float32Array | Int32Array {
  const seq=source.Sequences[sequence]!, keys=track.Keys.filter(k=>k.Frame>=seq.Interval[0]!&&k.Frame<=seq.Interval[1]!);
  if (!keys.length) return new Float32Array(track===undefined?[]:track.Keys[0]!.Vector.length===4?[0,0,0,1]:track.Keys[0]!.Vector.length===3?[0,0,0]:[1]);
  const frame=seq.Interval[0]!+(seq.Interval[1]!-seq.Interval[0]!)*progress;
  const a=keys.findLast(k=>k.Frame<=frame)??keys[0]!, b=keys.find(k=>k.Frame>=frame)??keys.at(-1)!;
  if(track.LineType===0||a.Frame===b.Frame) return a.Vector.slice();
  const t=(frame-a.Frame)/(b.Frame-a.Frame), sign=a.Vector.length===4&&a.Vector.reduce((sum,v,i)=>sum+v*b.Vector[i]!,0)<0?-1:1;
  const vector=Float32Array.from(a.Vector,(v,i)=>v*(1-t)+b.Vector[i]!*sign*t);
  if(vector.length===4){ const length=Math.hypot(...vector); for(let i=0;i<4;i++)vector[i]/=length; } return vector;
}
function shapeAt(action:Action,frame:number):Shape {
  const a=action.phases.findLast(p=>p.frame<=frame)??action.phases[0]!,b=action.phases.find(p=>p.frame>=frame)??action.phases.at(-1)!;
  const t=a.frame===b.frame?0:(frame-a.frame)/(b.frame-a.frame);
  return Object.fromEntries(["chest","head","right","left","elbow","legs","knees","root","yaw","height"].map(k=>[k,((a as Record<string,number>)[k]??0)*(1-t)+((b as Record<string,number>)[k]??0)*t]));
}
function rotate(q:Float32Array|Int32Array,degrees:number,axis=1):Float32Array {
  const r=[0,0,0,Math.cos(degrees*Math.PI/360)];r[axis]=Math.sin(degrees*Math.PI/360);
  const [x,y,z,w]=q as Float32Array, [a,b,c,d]=r;
  return new Float32Array([d!*x!+a!*w!+b!*z!-c!*y!,d!*y!-a!*z!+b!*w!+c!*x!,d!*z!+a!*y!-b!*x!+c!*w!,d!*w!-a!*x!-b!*y!-c!*z!]);
}
function angle(name:string,p:Shape):number {
  if (/^Bone_Chest/.test(name)) return p.chest??0;
  if (/^Bone_Head/.test(name)) return p.head??0;
  if (/BackPack_ArmRight(?:1|07)/.test(name)) return p.right??0;
  if (/BackPack_ArmLeft(?:1|07)/.test(name)) return p.left??0;
  if (/BackPack_Arm(?:Right|Left)(?:2|08)/.test(name)) return p.elbow??0;
  if (/Bone_Arm1_[LR]/.test(name)) return (name.includes("_R")?p.right??0:p.left??0)*.35;
  if (/Bone_Arm2_[LR]/.test(name)) return (p.elbow??0)*.5;
  if (/^Bone_Leg1/.test(name)) return (p.legs??0)*(name.includes("_L")?1:-.7);
  if (/^Bone_Leg2/.test(name)) return p.knees??0;
  if (/^Bone_Root01$|^Bone_MainTank_Tank$|^Dummy01_Tank$/.test(name)) return p.root??0;
  return 0;
}
let cursor=Math.max(...source.Sequences.map(s=>s.Interval[1]!))+100;
const bindings:string[]=[], records:{pose:string,index:number,frames:number,motion?:number}[]=[];
for(const action of actions) {
  const index=model.Sequences.length,start=cursor,end=start+Math.round(action.frames*1000/60);cursor=end+100;
  const donor=source.Sequences[action.donor??6]!;
  model.Sequences.push({...donor,Name:`Tinker ${action.pose}`,Interval:new Uint32Array([start,end]),NonLooping:!action.loop,MoveSpeed:0,Rarity:0,
    MinimumExtent:new Float32Array([-300,-300,-150]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:450});
  tracks(model,(track,path)=>{
    const old=original.get(path);if(!old||onGlobalClock(old))return;
    const match=/^\.(Bones|Helpers)\.(\d+)\.(Rotation|Translation|Scaling)$/.exec(path);
    const node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
    for(const frame of [...new Set([...action.phases.map(p=>p.frame), ...(action.robot?[7,8,23,24]:[])])].sort((a,b)=>a-b)){
      const robot=action.robot&&frame>=8&&frame<=23;
      const sequence=robot?14:action.donor??6;
      const p=shapeAt(action,frame);
      let vector=sample(old,sequence);
      if(path.endsWith(".Scaling")&&!old.Keys.some(k=>k.Frame>=source.Sequences[sequence]!.Interval[0]!&&k.Frame<=source.Sequences[sequence]!.Interval[1]!))vector=new Float32Array([1,1,1]);
      if(match?.[3]==="Rotation"&&node){vector=rotate(vector,angle(node.Name,p)); if(/^Bone_Root01$|^Dummy01_Tank$/.test(node.Name))vector=rotate(vector,p.yaw??0,2);}
      if(match?.[3]==="Translation"&&node?.Name==="Bone_Root01") vector[2]+=(p.height??0);
      track.Keys.push({Frame:start+Math.round(frame*1000/60),Vector:vector,...(old.LineType>=2?{InTan:vector.slice(),OutTan:vector.slice()}:{})});
    }
  });
  for(const Frame of [start,end])motion.Translation!.Keys.push({Frame,Vector:new Float32Array([0,0,0])});
  bindings.push(`  ${action.pose}: { index: ${index}, seconds: ${seconds((end-start)/1000)}, aligned: true${action.contact===undefined?"":`, contact: ${seconds(action.contact/60)}`} },`);
  records.push({pose:action.pose,index,frames:action.frames});
}
// Local articulation can lift feet or rotate a shoulder below the stage.
// A sequence-only parent plants the rendered support without changing physics.
const unplanted=new DrawnModel(generateMDX(model),1);
for(const [offset,action]of actions.entries()){
  if (/Air$|^(jump|doubleJump|fall|airDodge|wallJump|wallTech|upSpecial|ledgeHang|ledgeClimb|ledgeAttack)/.test(action.pose))continue;
  const sequence=model.Sequences[23+offset]!,start=sequence.Interval[0]!,end=sequence.Interval[1]!;
  motion.Translation!.Keys=motion.Translation!.Keys.filter(k=>k.Frame<start||k.Frame>end);
  for(let frame=0;frame<=action.frames;frame++){
    const triangles=unplanted.triangles(23+offset,frame/60,1);let lowest=Infinity;
    for(let i=1;i<triangles.length;i+=2)lowest=Math.min(lowest,triangles[i]!);
    motion.Translation!.Keys.push({Frame:start+Math.round(frame*1000/60),Vector:new Float32Array([0,0,-lowest])});
  }
}
const packaged=parseSource(generateMDX(model)),encoded=encodeVerified(packaged),drawn=new DrawnModel(encoded,1),before=new DrawnModel(generateMDX(source),1);
for(const [index,s]of source.Sequences.entries())for(const progress of [0,.5,1]){
  const time=(s.Interval[1]!-s.Interval[0]!)*progress/1000,a=before.triangles(index,time,1),b=drawn.triangles(index,time,1);
  ensure(a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i]!)<.001),`${s.Name}: existing stock action changed`);
}
for(const record of records){
  const first=drawn.triangles(record.index,0,1);ensure(first.length>0,`${record.pose}: empty body`);
  let motion=0;for(let frame=1;frame<=record.frames;frame++){const next=drawn.triangles(record.index,frame/60,1);ensure(next.length>0,`${record.pose}: disappearing body`);if(next.length===first.length)for(let i=0;i<first.length;i++)motion=Math.max(motion,Math.abs(next[i]!-first[i]!));}
  record.motion=motion;
  if (!/^(grabHold|grabbed|crouch|shield|ledgeHang|pain|victim)/.test(record.pose))
    ensure(motion>=5,`${record.pose}: action lacks visible motion (${motion})`);
}
for(const pose of ["upTilt","upSmash","upAir"]){
  const action=actions.find(a=>a.pose===pose)!,record=records.find(r=>r.pose===pose)!;
  const contact=action.phases[2]!.frame,triangles=drawn.triangles(record.index,contact/60,1);
  let highest=0;for(let i=1;i<triangles.length;i+=2)highest=Math.max(highest,triangles[i]!);
  ensure(highest>160,`${pose}: overhead claw remains inside the body (${highest})`);
}
const pain=records.filter(r=>r.pose.startsWith("pain"));
for(let a=0;a<pain.length;a++)for(let b=a+1;b<pain.length;b++){
  const first=drawn.triangles(pain[a]!.index,0,1),second=drawn.triangles(pain[b]!.index,0,1);
  ensure(first.length===second.length&&first.some((v,i)=>Math.abs(v-second[i]!)>2),`Pain cells ${a}/${b} share a silhouette`);
}
await Bun.write(join(output,"hero-models/herotinker.mdx"),encoded);
for(let index=0;!process.argv.includes("--no-pool")&&index<packaged.Sequences.length;index++){
  const clip=originalBodyClip(packaged,index),bytes=encodeVerified(clip.model),sha=hash(bytes);
  await Bun.write(join(output,`pooled/imports/war3mapImported/TinkerOriginalClip${index}-${sha}.mdx`),bytes);
}
await Bun.write(join(project,"ts/src/game/presentation/heroes/tinkerClipInfo.ts"),[
  "// Generated by tools/animations/tinker-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClipTable, HeroClip } from "../../sim/heroes/hero";',
  "export const TINKER_AUTHORED_CLIPS = {",...bindings.filter(b=>!b.includes("pain")),"} as const satisfies HeroClipTable;",
  "export const TINKER_DAMAGE_CLIPS: readonly HeroClip[] = [",...records.filter(r=>r.pose.startsWith("pain")).map(r=>`  { index: ${r.index}, seconds: ${seconds(.4)} },`),"];"] .join("\n")+"\n");
await Bun.write(join(output,"tinker-clips.json"),JSON.stringify({source:input,stockSequences:23,sequences:packaged.Sequences.length,records,robotVisibilityFrames:[8,23]},null,2)+"\n");
const strides:DrawnStride[]=Object.entries(DRAWN_STRIDES).filter(([key])=>Number(key)!==19).flatMap(([key,row])=>row?["walk","run"].map(motion=>({character:Number(key) as Character,motion:motion as "walk"|"run",...row[motion as "walk"|"run"]})):[]);
const walkSamples=Array.from({length:61},(_,frame)=>drawn.triangles(0,frame/60,1)),walkFirst=walkSamples[0]!;
let walkFloor=Infinity;for(let i=1;i<walkFirst.length;i+=2)walkFloor=Math.min(walkFloor,walkFirst[i]!);
let strideSum=0,strideCount=0;
for(let index=0;index<walkFirst.length;index+=2){
  let low=0,left=Infinity,right=-Infinity;
  for(const vertices of walkSamples){if(vertices[index+1]!<walkFloor+15)low++;left=Math.min(left,vertices[index]!);right=Math.max(right,vertices[index]!);}
  if(low>10){strideSum+=2*(right-left);strideCount++;}
}
const strideSpeed=strideSum/Math.max(1,strideCount);ensure(strideSpeed>0,"Tinker Walk lacks a drawn stride");
for(const gait of ["walk","run"]as const)strides.push({character:Character.tinker,motion:gait,clip:0,model:"units\\creeps\\HeroTinker\\HeroTinker.mdl",speed:strideSpeed});
await Bun.write(join(project,"ts/src/game/presentation/drawnStrideInfo.ts"),drawnStrideSource(strides));
const selected=["jab","upTilt","downTilt","neutralAir","grab","throwBack","upSpecial","downSpecial"];
for(const pose of selected){const r=records.find(r=>r.pose===pose)!;
  const times=pose==="downSpecial"?[0,7,8,14,18,23,24,35,46]:[0,Math.round(r.frames*.2),Math.round(r.frames*.4),Math.round(r.frames*.7),r.frames];
  const frames:PoseFrame[]=[1,-1].flatMap(facing=>times.map(frame=>({frame,phase:0,x:0,z:0,facing,parts:[],strikes:[],clip:r.index,seconds:frame/60})));
  await Bun.write(join(output,`${pose}-both-facings.png`),sheet(pose,drawn,frames,times.length).png);
}
console.log(`TINKER_CLIPS_PASS ${records.length} authored actions, 23 stock sequences preserved, ${packaged.Sequences.length} model sequences`);
