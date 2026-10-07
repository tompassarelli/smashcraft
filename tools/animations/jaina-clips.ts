// Stock Jaina's staff-and-cape rig; original geometry and textures remain private.
// Usage: bun tools/animations/jaina-clips.ts STOCK_JAINA.mdx PRIVATE_OUTPUT
import { mkdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackStyle, AttackPhase, Character, GrabAction } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/sim/heroes/registry";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { DOWN_DAMAGE_FRAMES, DOWN_ROLL_FRAMES, TECH_ROLL_FRAMES } from "../../ts/src/game/sim/down";
import { LEDGE_ROLL_FRAMES } from "../../ts/src/game/sim/ledge";
import { GROUND_ROLL_FRAMES } from "../../ts/src/game/sim/conditions";
import { seconds } from "./asset-info";
import { ensure, parseSource, tracks, onGlobalClock, encodeVerified } from "./original-clips";
const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/jaina-clips.ts STOCK_JAINA.mdx PRIVATE_OUTPUT");
const source = parseSource(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
ensure(source.Sequences.length === 9 && source.Bones.some(b => b.Name === "Bone_Staff"), "Expected original classic Jaina");
const stand = source.Sequences[0]!;
const hero = heroDefinition(Character.jaina); ensure(hero, "Register Jaina before exporting his clips");
interface Gesture { chest?: number; waist?: number; arm?: number; wrist?: number; leftArm?: number; head?: number; front?: number; back?: number; kneeFront?: number; kneeBack?: number; yaw?: number; lean?: number; }
interface Action { pose: HeroPose; frames: number; contact: number; gesture: Gesture; hold?: boolean; air?: boolean; roll?: number; }
const forward: Gesture = {chest:16,arm:-60,wrist:15,leftArm:-35,head:-8,front:12,back:-8};
const overhead: Gesture = {chest:-12,arm:-140,wrist:10,leftArm:-85,head:-10,front:-12,back:10};
const low: Gesture = {chest:48,arm:20,wrist:35,leftArm:-35,head:-28,front:-80,back:-70,kneeFront:130,kneeBack:120};
const back: Gesture = {chest:-12,arm:55,wrist:25,leftArm:-30,head:15,yaw:155,front:12,back:12};
const cast: Gesture = {chest:10,arm:-85,wrist:15,leftArm:-100,head:-10,front:8};
const brace: Gesture = {chest:20,arm:-35,wrist:25,leftArm:-50,head:-10,front:25,back:25};
const actions: Action[] = [];
const normals: readonly [HeroPose, AttackStyle, Gesture][] = [
 ["jab",AttackStyle.jab,{...forward,arm:-60,chest:10}], ["jab2",AttackStyle.jab2,{...forward,arm:-80}],
 ["forwardTilt",AttackStyle.forwardTilt,forward], ["forwardTiltUp",AttackStyle.forwardTiltUp,{...overhead,arm:-130}], ["forwardTiltDown",AttackStyle.forwardTiltDown,{...low,arm:-70}],
 ["upTilt",AttackStyle.upTilt,overhead], ["downTilt",AttackStyle.downTilt,low], ["dashAttack",AttackStyle.dashAttack,{...forward,lean:12}],
 ["forwardSmash",AttackStyle.forwardSmash,{...forward,chest:35,waist:-20,arm:-115,wrist:60}], ["upSmash",AttackStyle.upSmash,{...overhead,chest:-30,arm:-175}], ["downSmash",AttackStyle.downSmash,low],
 ["neutralAir",AttackStyle.neutralAir,{...forward,yaw:70}], ["forwardAir",AttackStyle.forwardAir,{...forward}], ["backAir",AttackStyle.backAir,back], ["upAir",AttackStyle.upAir,overhead], ["downAir",AttackStyle.downAir,{...low,lean:45,front:45}],
];
for (const [pose,style,gesture] of normals) { const move=hero.moves.normals[style];ensure(move,`${pose}: missing move timing`); actions.push({pose,frames:move.totalFrames,contact:move.startupFrames,gesture,air:pose.endsWith("Air")}); }
const extra: readonly [HeroPose,number,number,Gesture][] = [
 ["crouch",30,12,brace],["landing",8,2,brace],["shield",30,8,{...brace,leftArm:-100}],["airDodge",49,4,{...brace,lean:-25}], ["smashCharge",30,8,{...overhead,arm:-100}],["dizzy",60,25,{chest:-15,head:30,arm:20,leftArm:15}],
 ["turn",8,4,{yaw:140,chest:-12}], ["stop",8,3,{...brace,lean:-18}], ["jumpSquat",5,4,{...brace,front:55,back:55}],
 ["jump",24,7,{...overhead,front:-50,back:25,lean:-12}], ["doubleJump",24,7,{...cast,front:-45,back:35,lean:-20}], ["wallJump",24,7,{...overhead,lean:-25}], ["wallTech",26,6,brace],
 ["fall",30,12,{...brace,front:40,back:-20}], ["fallSpecial",30,12,{...brace,chest:45,head:20}], ["ledgeHang",30,10,{...cast,chest:45,front:-50}], ["ledgeClimb",25,10,{...overhead,lean:35}], ["ledgeAttack",40,20,forward],
 ["knockdown",30,25,{...brace,lean:85}], ["downDamage",DOWN_DAMAGE_FRAMES,8,{...brace,lean:75,head:30}], ["getUp",30,18,{...brace,lean:30}], ["getUpAttack",49,16,low],
 ["spotDodge",22,4,{...brace,lean:-30}], ["tech",26,8,{...brace,lean:45}],
 ["damageGround",24,3,{...brace,chest:-35,head:-30}], ["damageAir",24,3,{...brace,chest:-40,front:60}], ["damageTumble",30,9,{...brace,lean:70}], ["damageShield",24,3,{...brace,chest:-20}],
 ["grab",30,7,{...forward,leftArm:-105,chest:30}], ["grabHold",30,1,{...forward,leftArm:-100,chest:20}], ["grabbed",30,1,{chest:-35,waist:20,head:30,arm:25,leftArm:30}], ["pummel",24,8,{...forward,leftArm:-105,arm:-70}],
 ["throwForward",30,11,forward], ["throwBack",34,13,back], ["throwUp",30,11,overhead], ["throwDown",32,15,low],
 ["victimPummel",24,3,{chest:-25,waist:10,head:-25}], ["victimThrowForward",30,8,{chest:-35,waist:15,lean:-25}], ["victimThrowBack",34,8,{chest:35,waist:-15,lean:25}], ["victimThrowUp",30,8,{chest:-30,front:50,back:50,lean:-30}], ["victimThrowDown",32,8,{...brace,lean:70}],
];
for(const [pose,defaultFrames,defaultContact,gesture] of extra) { const throwCode=({pummel:GrabAction.pummel,throwForward:GrabAction.throwForward,throwBack:GrabAction.throwBack,throwUp:GrabAction.throwUp,throwDown:GrabAction.throwDown} as Partial<Record<HeroPose,GrabAction>>)[pose]; const thrown=throwCode===undefined?undefined:hero.moves.throws[throwCode]; const normalStyle=pose==="grab"?AttackStyle.grab:pose==="getUpAttack"?AttackStyle.getupAttack:pose==="ledgeAttack"?AttackStyle.ledgeAttack:undefined; const normalMove=normalStyle===undefined?undefined:hero.moves.normals[normalStyle]; const frames=thrown?.totalFrames??normalMove?.totalFrames??defaultFrames,contact=thrown?.contactFrame??normalMove?.startupFrames??defaultContact; actions.push({pose,frames,contact,gesture,hold:["grabHold","grabbed","shield","smashCharge","crouch","ledgeHang","knockdown","downDamage","fall","fallSpecial"].includes(pose),air:["airDodge","jump","doubleJump","wallJump","fall","fallSpecial","damageAir","damageTumble","victimThrowUp"].includes(pose)}); }
for(const pose of ["rollForward","techForward","getUpRollForward","ledgeRoll","rollBackward","techBackward","getUpRollBackward"] as const)actions.push({pose,frames:pose.startsWith("tech")?TECH_ROLL_FRAMES:pose.startsWith("getUp")?DOWN_ROLL_FRAMES:pose==="ledgeRoll"?LEDGE_ROLL_FRAMES:GROUND_ROLL_FRAMES,contact:10,gesture:{...brace,front:-75,back:-75,kneeFront:120,kneeBack:120},roll:pose.endsWith("Backward")?-1:1});
for(const [pose,key,gesture]of [["neutralSpecial","neutral",cast],["sideSpecial","side",{...cast,leftArm:-145}],["upSpecial","up",{...overhead,leftArm:-130,front:-55,back:35,lean:-15}],["downSpecial","down",{...low,leftArm:-80,front:100}]] as const){
 const move=hero.specials?.[key]; ensure(move,`${pose}: missing special`);
 for(const air of [false,true]) { const form = air ? move.air ?? move.ground : move.ground; const contact = Math.min(...[...(form.regions?.map(r=>r.firstFrame)??[]),...(form.motion?.map(r=>r.first)??[]),...(form.projectiles?.map(r=>r.spawnFrame)??[]),...(form.placement?[form.placement.frame]:[]),form.endFrame]); actions.push({pose:(air?`${pose}Air`:pose) as HeroPose,frames:form.endFrame,contact:Math.max(3,contact),gesture,air}); }
}
function rotated(q: ArrayLike<number>, y:number,z=0){const a=y*Math.PI/360,b=z*Math.PI/360;const u=[-Math.sin(a)*Math.sin(b),Math.sin(a)*Math.cos(b),Math.cos(a)*Math.sin(b),Math.cos(a)*Math.cos(b)];const [x=0,v=0,w=0,t=1]=Array.from(q);const [i=0,j=0,k=0,l=1]=u;return new Float32Array([l*x+i*t+j*w-k*v,l*v-i*w+j*t+k*x,l*w+i*v-j*x+k*t,l*t-i*x-j*v-k*w]);}
type Point = readonly [number, number, number];
type Phase = { frame: number; amount: number };
function multiply(a:ArrayLike<number>, b:ArrayLike<number>) {
 const [x=0,y=0,z=0,w=1]=Array.from(a),[i=0,j=0,k=0,l=1]=Array.from(b);
 const q=[w*i+x*l+y*k-z*j,w*j-x*k+y*l+z*i,w*k+x*j-y*i+z*l,w*l-x*i-y*j-z*k];
 const length=Math.hypot(...q);return new Float32Array(q.map(v=>v/length));
}
function scaledRotation(q:ArrayLike<number>,amount:number) {
 const a=Array.from(q),sign=(a[3]??1)<0?-1:1,w=Math.min(1,Math.max(-1,(a[3]??1)*sign)),angle=Math.acos(w),gain=Math.abs(Math.sin(angle))<0.00001?amount:Math.sin(angle*amount)/Math.sin(angle);
 return new Float32Array([(a[0]??0)*sign*gain,(a[1]??0)*sign*gain,(a[2]??0)*sign*gain,Math.cos(angle*amount)]);
}
function aimArm(index:number,start:number,action:Action,phases:readonly Phase[],left:boolean,target:Point,direction?:Point) {
 const renderer=new ModelRenderer(model),data=Reflect.get(renderer,"rendererData");renderer.setSequence(index);
 const side=left?"L":"R",arm=model.Nodes.find(n=>n?.Name===`Bone_Arm1_${side}ArchDruid`)!,elbow=model.Nodes.find(n=>n?.Name===`Bone_Arm2_${side}ArchDruid`)!,hand=model.Nodes.find(n=>n?.Name===`Bone_Hand_${side}ArchDruid`)!;
 const sample=start+Math.round(action.contact*1000/60);data.frame=sample;
 const base=(n:mdx.Node)=>source.Nodes[n.ObjectId]?.Rotation?.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1])?.Vector??new Float32Array([0,0,0,1]);
 const key=(n:mdx.Node,frame:number)=>n.Rotation!.Keys.find(k=>k.Frame===start+Math.round(frame*1000/60))!;
 const set=(n:mdx.Node,frame:number,q:Float32Array)=>{const k=key(n,frame);k.Vector=q;if(k.InTan){k.InTan=q.slice();k.OutTan=q.slice();}};
 const point=(n:mdx.Node):Point=>{const p=model.PivotPoints[n.ObjectId]!,m=data.nodes[n.ObjectId].matrix;return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];};
 const armBase=base(arm),elbowBase=base(elbow),handBase=base(hand),angles=[left?action.gesture.leftArm??0:action.gesture.arm??0,0,left?0:action.gesture.wrist??0,0];set(hand,action.contact,handBase.slice());
 const loss=()=>{set(arm,action.contact,rotated(armBase,angles[0]!,angles[1]!));set(elbow,action.contact,rotated(elbowBase,angles[2]!,angles[3]!));renderer.update(0);const p=point(hand);return p.reduce((sum,v,i)=>sum+(v-target[i]!)**2,0);};
 for(const step of [30,10,3,1])for(let pass=0;pass<2;pass++)for(let dim=0;dim<4;dim++){const origin=angles[dim]!,range=step===30?180:step*3;let best=loss(),angle=origin;for(let delta=-range;delta<=range;delta+=step){angles[dim]=origin+delta;const score=loss();if(score<best){best=score;angle=angles[dim]!;}}angles[dim]=angle;}
 loss();
 let handDelta=new Float32Array([0,0,0,1]);
 if(direction){const weapon=model.Nodes.find(n=>n?.Name.trim()==="Weapon Ref")!,tip=point(weapon),grip=point(hand),m=data.nodes[hand.Parent!].matrix;
  const local=(v:Point)=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[4]*v[0]+m[5]*v[1]+m[6]*v[2],m[8]*v[0]+m[9]*v[1]+m[10]*v[2]];
  const a=local([tip[0]-grip[0],tip[1]-grip[1],tip[2]-grip[2]]),b=local(direction),al=Math.hypot(...a),bl=Math.hypot(...b);for(let i=0;i<3;i++){a[i]!/=al;b[i]!/=bl;}
  const q=[a[1]!*b[2]!-a[2]!*b[1]!,a[2]!*b[0]!-a[0]!*b[2]!,a[0]!*b[1]!-a[1]!*b[0]!,1+a.reduce((s,v,i)=>s+v*b[i]!,0)],length=Math.hypot(...q);handDelta=new Float32Array(q.map(v=>v/length));
 }
 for(const {frame,amount}of phases){set(arm,frame,rotated(armBase,angles[0]!*amount,angles[1]!*amount));set(elbow,frame,rotated(elbowBase,angles[2]!*amount,angles[3]!*amount));if(direction)set(hand,frame,multiply(scaledRotation(handDelta,amount),handBase));}
}
function contactAim(pose:HeroPose):{hand:Point;direction:Point}|undefined {
 if(pose==="downAir")return {hand:[18,-18,30],direction:[0,0,-1]};
 if(pose==="upTilt"||pose==="upAir")return {hand:[8,-18,115],direction:[1,0,0]};
 if(pose==="upSmash"||pose==="throwUp"||pose==="upSpecial"||pose==="upSpecialAir")return {hand:[8,-18,113],direction:[0,0,1]};
 if(pose==="forwardTiltUp")return {hand:[32,-18,72],direction:[1,0,0.5]};
 if(pose==="forwardTiltDown")return {hand:[33,-18,47],direction:[1,0,-0.6]};
 if(pose==="downTilt"||pose==="downSmash"||pose==="getUpAttack"||pose==="throwDown"||pose==="downSpecial"||pose==="downSpecialAir")return {hand:[35,-18,28],direction:[1,0,-0.2]};
 if(pose==="backAir"||pose==="throwBack")return {hand:[-33,-18,65],direction:[-1,0,0]};
 if(["jab","jab2","forwardTilt","dashAttack","forwardSmash","neutralAir","forwardAir","ledgeAttack","getUpAttack","throwForward","neutralSpecial","neutralSpecialAir"].includes(pose))return {hand:[34,-18,62],direction:[1,0,0]};
 if(pose==="sideSpecial"||pose==="sideSpecialAir")return {hand:[21,-18,101],direction:[0.65,0,1]};
 return undefined;
}
function joint(name:string,g:Gesture):[number,number]{
 if(name==="Bone_Chest")return [g.chest??0,g.yaw??0];
 if(name==="Bone_PelvisArchDruid")return [g.waist??0,0];
 if(name==="Bone_Arm1_RArchDruid")return [g.arm??0,0];
 if(name==="Bone_Arm2_RArchDruid")return [g.wrist??0,0];
 if(name==="Bone_Arm1_LArchDruid")return [g.leftArm??0,0];
 if(name==="Bone_Head")return [g.head??0,0];
 if(/^Bone_Leg1_[LR]ArchDruid$/.test(name))return [name.includes("_L")?g.front??0:g.back??0,0];
 if(/^Bone_Leg2_[LR]ArchDruid$/.test(name))return [name.includes("_L")?g.kneeFront??Math.abs(g.front??0):g.kneeBack??Math.abs(g.back??0),0];
 if(name==="Bone_RootArchDruid")return [g.lean??0,0];
 return [0,0];
}
const originals=new Map<string,mdx.AnimVector>();tracks(source,(t,p)=>originals.set(p,t));
let cursor=Math.max(...source.Sequences.map(s=>s.Interval[1]))+100;
const bindings:string[]=[],damageBindings:string[]=[], records:unknown[]=[];
const damageActions:Action[]=[];
for(let height=0;height<3;height++)for(let strength=0;strength<3;strength++){const gain=[0.45,0.8,1.2][strength]!;damageActions.push({pose:"damageGround",frames:24,contact:3,hold:true,gesture:height===0?{front:65*gain,back:55*gain,waist:25*gain,chest:25*gain,head:-15*gain}:height===1?{chest:55*gain,waist:-25*gain,arm:30*gain,leftArm:35*gain}:{head:-45*gain,chest:-35*gain,arm:45*gain,leftArm:55*gain}});}
for(const [ordinal,action]of [...actions,...damageActions].entries()){
 const index=model.Sequences.length,start=cursor,end=start+Math.round(action.frames*1000/60);cursor=end+100;
 const name=ordinal<actions.length?`Jaina ${action.pose}`:`Jaina Damage ${Math.floor((ordinal-actions.length)/3)} ${((ordinal-actions.length)%3)}`;
 model.Sequences.push({...stand,Name:name,Interval:new Uint32Array([start,end]),NonLooping:true,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});
 const reverse=action.pose==="downSmash"?action.contact+3:action.pose==="getUpAttack"?action.contact+2:undefined;
 const phaseFrames=[...new Set([0,Math.max(1,action.contact-3),action.contact,Math.min(action.frames-1,action.contact+4),action.frames,...action.roll?[0.25,0.5,0.75].map(p=>Math.round(action.frames*p)):[],...reverse?[reverse]:[]])].sort((a,b)=>a-b);
 const phases=phaseFrames.map(frame=>({frame,amount:action.hold?1:action.roll?Math.sin(Math.PI*frame/action.frames):frame===0||frame===action.frames?0:frame===Math.max(1,action.contact-3)?-0.3:1}));
 tracks(model,(track,path)=>{
  const donor=originals.get(path);if(!donor||onGlobalClock(donor))return;let first=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);
  // Stock chest and left hand omit their identity pose in Stand.
  if(!first&&/^\.(Bones|Helpers)\.\d+\.(Rotation|Translation|Scaling)$/.test(path)){const Vector=new Float32Array(path.endsWith("Rotation")?[0,0,0,1]:path.endsWith("Scaling")?[1,1,1]:[0,0,0]);first={Frame:stand.Interval[0],Vector,...track.LineType>1?{InTan:Vector.slice(),OutTan:Vector.slice()}: {}};}
  if(!first)return;
  const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path),node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
  for(const {frame,amount}of phases){let Vector=first.Vector.slice();if(node){let[y,z]=joint(node.Name,action.gesture);if(node.Name==="Bone_RootArchDruid"&&action.roll)y=frame/action.frames*360*action.roll;else y*=amount;z*=amount;if(node.Name==="Bone_Chest"&&reverse&&frame>=reverse&&frame<action.frames)z=165;if(node.Name==="Bone_RootArchDruid"&&(action.pose==="getUp"||action.pose==="getUpAttack")&&frame<action.contact)y=85*(1-frame/action.contact);Vector=rotated(first.Vector,y,z);}
   const tangent=()=>match||track.LineType===mdx.LineType.Bezier?Vector.slice():new Float32Array(Vector.length);
   track.Keys.push({...first,Frame:start+Math.round(frame*1000/60),Vector,...first.InTan?{InTan:tangent(),OutTan:tangent()}: {}});
  }
 });
 const aim=contactAim(action.pose);if(ordinal<actions.length&&aim)aimArm(index,start,action,phases,false,aim.hand,aim.direction);
 if(reverse)aimArm(index,start,{...action,contact:reverse},phases.filter(p=>p.frame>=reverse),false,[-35,-18,28],[-1,0,-0.2]);
 if(["grab","grabHold","pummel","throwForward","neutralSpecial","neutralSpecialAir"].includes(action.pose))aimArm(index,start,action,phases,true,[36,12,65]);
 if(["sideSpecial","sideSpecialAir"].includes(action.pose))aimArm(index,start,action,phases,true,[27,12,112]);
 if(["downSpecial","downSpecialAir"].includes(action.pose))aimArm(index,start,action,phases,true,[35,12,32]);
 // Root translation grounds the articulated fighter; airborne actions retain their authored pose.
 const center=model.Nodes.find(b=>b.Name==="Bone_RootArchDruid");ensure(center,"No Jaina root");
 if(!center.Translation)center.Translation={LineType:1,GlobalSeqId:null,Keys:source.Sequences.flatMap(s=>Array.from(s.Interval).map(Frame=>({Frame,Vector:new Float32Array([0,0,0])})))};
 const beforeKeys=center.Translation.Keys.filter(k=>k.Frame<start);
 const drawn=new DrawnModel(generateMDX(model),1);
 const translations:mdx.AnimKeyframe[]=[];
 for(const {frame}of phases){const triangle=drawn.triangles(index,frame/60,1);let lowest=Infinity;for(let i=1;i<triangle.length;i+=2)lowest=Math.min(lowest,triangle[i]!);const old=center.Translation.Keys.find(k=>k.Frame===start+Math.round(frame*1000/60));translations.push({Frame:start+Math.round(frame*1000/60),Vector:new Float32Array([old?.Vector[0]??0,old?.Vector[1]??0,(old?.Vector[2]??0)-(action.air?0:lowest)]),...(center.Translation.LineType>1?{InTan:new Float32Array([0,0,0]),OutTan:new Float32Array([0,0,0])}:{})});}
 center.Translation.Keys=[...beforeKeys,...translations];
 const pairedContact=/^(pummel|throw|victimPummel|victimThrow)/.test(action.pose)?`, contact: ${seconds(action.contact/60)}`:"";
 const binding=`{ index: ${index}, seconds: ${seconds((end-start)/1000)}, aligned: true${pairedContact} }`;
 if(ordinal<actions.length)bindings.push(`  ${action.pose}: ${binding},`);else damageBindings.push(`  ${binding},`);
 records.push({pose:name,index,frames:action.frames,contact:action.contact});
}
const bytes=encodeVerified(parseSource(generateMDX(model)));mkdirSync(output,{recursive:true});await Bun.write(join(output,"jaina.mdx"),bytes);
await Bun.write(join(project,"ts/src/game/presentation/heroes/jainaClips.ts"),[
 "// Generated by tools/animations/jaina-clips.ts from the stock classic Jaina rig.",'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClip, HeroClipTable } from "../../sim/heroes/hero";',
 'export const JAINA_MODEL_FILE = "units\\\\human\\\\Jaina\\\\Jaina.mdl";',
 'export const JAINA_FALLBACK: HeroClip = { index: 0, seconds: f32(1.334) };',
 'export const JAINA_CLIPS = { idle: JAINA_FALLBACK, walk: { index: 6, seconds: 2.0 }, dash: { index: 6, seconds: 2.0 }, run: { index: 6, seconds: 2.0 }, ko: { index: 5, seconds: 2.0 },',...bindings,'} as const satisfies HeroClipTable;',
 'export const JAINA_DAMAGE_CLIPS: readonly HeroClip[] = [',...damageBindings,'];',"",
].join("\n"));
const finalDrawn=new DrawnModel(bytes,1.0);
const beforeDrawn=new DrawnModel(generateMDX(source),1.0);
for(const [index,sequence] of source.Sequences.entries()) for(const phase of [0,0.5,1]) { const time=(sequence.Interval[1]-sequence.Interval[0])*phase/1000; const before=beforeDrawn.triangles(index,time,1), after=finalDrawn.triangles(index,time,1); ensure(before.length===after.length&&before.every((v,i)=>Math.abs(v-after[i]!)<0.001),`Jaina stock clip ${index} changed`); }
for(const pose of ["forwardTilt","forwardTiltUp","forwardTiltDown","upTilt","downTilt","downSmash","backAir","downAir","neutralSpecial","sideSpecial","upSpecial","downSpecial","rollForward","getUp","getUpAttack","grab","grabHold","pummel","throwForward","throwBack","throwUp","throwDown"]){const i=actions.findIndex(a=>a.pose===pose),action=actions[i]!;const sequence=source.Sequences.length+i;const panels:PoseFrame[]=[1,-1].flatMap(facing=>[0,Math.max(1,action.contact-3),action.contact,action.contact+4,action.frames].map(frame=>({frame,phase:frame<action.contact?AttackPhase.startup:frame<=action.contact+4?AttackPhase.active:AttackPhase.recovery,x:0,z:0,facing,parts:[],strikes:[],clip:sequence,seconds:Math.min(action.frames,frame)/60})));await Bun.write(join(output,`${pose}.png`),sheet(`Jaina ${pose}`,finalDrawn,panels,5).png);}
await Bun.write(join(output,"jaina-clips.json"),JSON.stringify({stockSequences:source.Sequences.length,appended:records.length,records},null,2)+"\n");console.log(`JAINA_CLIPS_PASS ${records.length} authored clips; ${source.Sequences.length} stock sequences retained; private output ${output}`);
