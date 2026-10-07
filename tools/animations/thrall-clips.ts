// Stock Thrall's mounted rig; original geometry and textures remain private.
// Usage: bun tools/animations/thrall-clips.ts STOCK_THRALL.mdx PRIVATE_OUTPUT
import { mkdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackStyle, AttackPhase, Character, GrabAction } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/sim/heroes/registry";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { seconds } from "./asset-info";
import { measureDrawnStride, drawnStrideSource } from "../../ts/scripts/wisp/drawnMotion";
import { DRAWN_STRIDES } from "../../ts/src/game/presentation/drawnStrideInfo";
import { ensure, parseSource, tracks, onGlobalClock, encodeVerified } from "./original-clips";
const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/thrall-clips.ts STOCK_THRALL.mdx PRIVATE_OUTPUT");
const source = parseSource(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
ensure(source.Sequences.length === 7 && source.Bones.some(b => b.Name === "Hammer"), "Expected original classic mounted Thrall");
const stand = source.Sequences[0]!;
const hero = heroDefinition(Character.thrall); ensure(hero, "Register Thrall before exporting his clips");
interface Gesture { chest?: number; waist?: number; arm?: number; wrist?: number; leftArm?: number; head?: number; wolf?: number; neck?: number; front?: number; back?: number; yaw?: number; lean?: number; }
interface Action { pose: HeroPose; frames: number; contact: number; gesture: Gesture; hold?: boolean; air?: boolean; roll?: number; }
const forward: Gesture = {chest:20,waist:-10,arm:-95,wrist:35,leftArm:-35,head:-10,neck:-8,front:15};
const overhead: Gesture = {chest:-18,waist:10,arm:-165,wrist:25,leftArm:-65,head:-15,wolf:-8,front:-30,back:15};
const low: Gesture = {chest:10,waist:5,arm:-25,wrist:0,leftArm:-35,head:-15,wolf:5,neck:10,front:-55,back:15};
const back: Gesture = {chest:-15,waist:-20,arm:55,wrist:35,leftArm:-40,head:15,yaw:150,neck:-10};
const cast: Gesture = {chest:-20,waist:8,arm:-115,wrist:20,leftArm:-120,head:-20,neck:-10,front:-10};
const brace: Gesture = {chest:35,waist:10,arm:-45,wrist:25,leftArm:-60,head:-20,wolf:6,front:35,back:35};
const actions: Action[] = [];
const normals: readonly [HeroPose, AttackStyle, Gesture][] = [
 ["jab",AttackStyle.jab,{...forward,arm:-60,chest:10}], ["jab2",AttackStyle.jab2,{...forward,arm:-80}],
 ["forwardTilt",AttackStyle.forwardTilt,forward], ["forwardTiltUp",AttackStyle.forwardTiltUp,{...overhead,arm:-130}], ["forwardTiltDown",AttackStyle.forwardTiltDown,{...low,arm:-70}],
 ["upTilt",AttackStyle.upTilt,overhead], ["downTilt",AttackStyle.downTilt,low], ["dashAttack",AttackStyle.dashAttack,{...forward,lean:12,wolf:10}],
 ["forwardSmash",AttackStyle.forwardSmash,{...forward,chest:35,waist:-20,arm:-115,wrist:60}], ["upSmash",AttackStyle.upSmash,{...overhead,chest:-30,arm:-175}], ["downSmash",AttackStyle.downSmash,{...low,chest:70,yaw:45}],
 ["neutralAir",AttackStyle.neutralAir,{...forward,yaw:70}], ["forwardAir",AttackStyle.forwardAir,{...forward,wolf:12}], ["backAir",AttackStyle.backAir,back], ["upAir",AttackStyle.upAir,overhead], ["downAir",AttackStyle.downAir,{...low,front:-65,neck:15}],
];
for (const [pose,style,gesture] of normals) { const move=hero.moves.normals[style];ensure(move,`${pose}: missing move timing`); actions.push({pose,frames:move.totalFrames,contact:move.startupFrames,gesture,air:pose.endsWith("Air")}); }
const extra: readonly [HeroPose,number,number,Gesture][] = [
 ["crouch",30,12,brace],["landing",8,2,brace],["shield",30,8,{...brace,leftArm:-100}],["airDodge",49,4,{...brace,lean:-25}], ["smashCharge",30,8,{...overhead,arm:-100}],["dizzy",60,25,{chest:-15,head:30,arm:20,leftArm:15,neck:15}],
 ["turn",8,4,{yaw:140,chest:-12,neck:-15}], ["stop",8,3,{...brace,lean:-18}], ["jumpSquat",5,4,{...brace,wolf:12,front:55,back:55}],
 ["jump",24,7,{...overhead,front:-50,back:25,lean:-12}], ["doubleJump",24,7,{...cast,front:-45,back:35,lean:-20}], ["wallJump",24,7,{...overhead,lean:-25}], ["wallTech",26,6,brace],
 ["fall",30,12,{...brace,front:40,back:-20}], ["fallSpecial",30,12,{...brace,chest:45,head:20}], ["ledgeHang",30,10,{...cast,chest:45,front:-50}], ["ledgeClimb",25,10,{...overhead,lean:35}], ["ledgeAttack",40,20,forward],
 ["knockdown",30,25,{...brace,lean:85}], ["downDamage",24,8,{...brace,lean:75,head:30}], ["getUp",30,18,{...brace,lean:30}], ["getUpAttack",49,16,{...forward,yaw:160}],
 ["spotDodge",22,4,{...brace,lean:-30}], ["tech",26,8,{...brace,lean:45}],
 ["damageGround",24,3,{...brace,chest:-35,head:-30}], ["damageAir",24,3,{...brace,chest:-40,front:60}], ["damageTumble",30,9,{...brace,lean:70}], ["damageShield",24,3,{...brace,chest:-20}],
 ["grab",30,7,{...forward,leftArm:-105,chest:30}], ["grabHold",30,1,{...forward,leftArm:-100,chest:20}], ["grabbed",30,1,{chest:-35,waist:20,head:30,arm:25,leftArm:30}], ["pummel",24,8,{...forward,leftArm:-105,arm:-70}],
 ["throwForward",30,11,forward], ["throwBack",34,13,back], ["throwUp",30,11,overhead], ["throwDown",32,15,low],
 ["victimPummel",24,3,{chest:-25,waist:10,head:-25}], ["victimThrowForward",30,8,{chest:-35,waist:15,lean:-25}], ["victimThrowBack",34,8,{chest:35,waist:-15,lean:25}], ["victimThrowUp",30,8,{chest:-30,front:50,back:50,lean:-30}], ["victimThrowDown",32,8,{...brace,lean:70}],
];
for(const [pose,defaultFrames,defaultContact,gesture] of extra) { const throwCode=({pummel:GrabAction.pummel,throwForward:GrabAction.throwForward,throwBack:GrabAction.throwBack,throwUp:GrabAction.throwUp,throwDown:GrabAction.throwDown} as Partial<Record<HeroPose,GrabAction>>)[pose]; const thrown=throwCode===undefined?undefined:hero.moves.throws[throwCode]; const normalStyle=pose==="grab"?AttackStyle.grab:pose==="getUpAttack"?AttackStyle.getupAttack:pose==="ledgeAttack"?AttackStyle.ledgeAttack:undefined; const normalMove=normalStyle===undefined?undefined:hero.moves.normals[normalStyle]; const frames=thrown?.totalFrames??normalMove?.totalFrames??defaultFrames,contact=thrown?.contactFrame??normalMove?.startupFrames??defaultContact; actions.push({pose,frames,contact,gesture,hold:["grabHold","grabbed","shield","smashCharge","crouch","ledgeHang"].includes(pose),air:["airDodge","jump","doubleJump","wallJump","fall","fallSpecial","damageAir","damageTumble","victimThrowUp"].includes(pose)}); }
for(const pose of ["rollForward","techForward","getUpRollForward","ledgeRoll","rollBackward","techBackward","getUpRollBackward"] as const)actions.push({pose,frames:pose.startsWith("tech")?40:31,contact:10,gesture:brace,roll:pose.endsWith("Backward")?-1:1});
for(const [pose,key,gesture]of [["neutralSpecial","neutral",cast],["sideSpecial","side",{...cast,leftArm:-145,neck:-18}],["upSpecial","up",{...overhead,leftArm:-130,front:-55,back:35,lean:-15}],["downSpecial","down",{...low,leftArm:-110,chest:30,front:-40}]] as const){
 const move=hero.specials?.[key]; ensure(move,`${pose}: missing special`);
 for(const air of [false,true]) { const form = air ? move.air ?? move.ground : move.ground; const contact = Math.min(...[...(form.regions?.map(r=>r.firstFrame)??[]),...(form.motion?.map(r=>r.first)??[]),...(form.projectiles?.map(r=>r.spawnFrame)??[])]); actions.push({pose:(air?`${pose}Air`:pose) as HeroPose,frames:form.endFrame,contact:Number.isFinite(contact)?Math.max(3,contact):12,gesture,air}); }
}
function rotated(q: ArrayLike<number>, y:number,z=0){const a=y*Math.PI/360,b=z*Math.PI/360;const u=[-Math.sin(a)*Math.sin(b),Math.sin(a)*Math.cos(b),Math.cos(a)*Math.sin(b),Math.cos(a)*Math.cos(b)];const [x=0,v=0,w=0,t=1]=Array.from(q);const [i=0,j=0,k=0,l=1]=u;return new Float32Array([l*x+i*t+j*w-k*v,l*v-i*w+j*t+k*x,l*w+i*v-j*x+k*t,l*t-i*x-j*v-k*w]);}
function joint(name:string,g:Gesture):[number,number]{
 if(name==="Bone_Chest")return [g.chest??0,0];if(name==="Bone Rider Waist")return [g.waist??0,g.yaw??0];if(name==="Bone Rider R Arm")return [g.arm??0,0];if(name==="Bone Rider R Wrist")return [g.wrist??0,0];if(name==="Bone Rider L Arm")return [g.leftArm??0,0];if(name==="Bone_Head")return [g.head??0,0];if(name==="Bone Wolf Waist")return [g.wolf??0,0];if(name==="Bone Wolf Neck")return [g.neck??0,0];if(/^Bone Front [LR] Leg$/.test(name))return [g.front??0,0];if(/^Bone Back [LR] Leg$/.test(name))return [g.back??0,0];if(name==="Bone Center")return [g.lean??0,0];return [0,0];
}
const originals=new Map<string,mdx.AnimVector>();tracks(source,(t,p)=>originals.set(p,t));
const retainedFile=Bun.file(join(output,"thrall.mdx"));
const retained=await retainedFile.exists()?parseSource(await retainedFile.arrayBuffer()):undefined;
let cursor=Math.max(...(retained?.Sequences??source.Sequences).map(s=>s.Interval[1]))+100;
const bindings:string[]=[],damageBindings:string[]=[], records:unknown[]=[];
const damageActions:Action[]=[];
for(let height=0;height<3;height++)for(let strength=0;strength<3;strength++){const gain=[0.45,0.8,1.2][strength]!;damageActions.push({pose:"damageGround",frames:24,contact:3,hold:true,gesture:height===0?{front:65*gain,back:55*gain,wolf:18*gain,waist:25*gain,chest:25*gain,head:-15*gain}:height===1?{chest:55*gain,waist:-25*gain,arm:30*gain,leftArm:35*gain,wolf:8*gain}:{head:-45*gain,chest:-35*gain,arm:45*gain,leftArm:55*gain,neck:-15*gain}});}
for(const [ordinal,action]of [...actions,...damageActions].entries()){
 const index=model.Sequences.length;
 const name=ordinal<actions.length?`Thrall ${action.pose}`:`Thrall Damage ${Math.floor((ordinal-actions.length)/3)} ${((ordinal-actions.length)%3)}`;
 const previous=retained?.Sequences[index];
 if(previous)ensure(previous.Name===name,`${name}: existing clip index changed`);
 const duration=Math.round(action.frames*1000/60);
 const reuse=previous!==undefined&&previous.Interval[1]-previous.Interval[0]===duration;
 const start=reuse?previous.Interval[0]:cursor,end=start+duration;
 if(!reuse)cursor=end+100;
 model.Sequences.push({...stand,Name:name,Interval:new Uint32Array([start,end]),NonLooping:true,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});
 const phaseFrames=[0,Math.max(1,action.contact-3),action.contact,Math.min(action.frames-1,action.contact+4),action.frames];
 const phases=phaseFrames.map((frame,i)=>({frame,amount:i===0?0:i===1?-0.3:i===4?(action.hold?1:0):1}));
 tracks(model,(track,path)=>{
  const donor=originals.get(path);if(!donor||onGlobalClock(donor))return;let first=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);
  if(!first && /^\.(Bones|Helpers)\.\d+\.(Rotation|Translation|Scaling)$/.test(path)){const Vector=new Float32Array(path.endsWith("Rotation")?[0,0,0,1]:path.endsWith("Scaling")?[1,1,1]:[0,0,0]);first={Frame:stand.Interval[0],Vector,...track.LineType>1?{InTan:Vector.slice(),OutTan:Vector.slice()}: {}};}
  if(!first)return;
  const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path),node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
  for(const {frame,amount}of phases){let Vector=first.Vector.slice();if(node){let[y,z]=joint(node.Name,action.gesture);if(node.Name==="Bone Center"&&action.roll)y=frame/action.frames*360*action.roll;else y*=amount;z*=amount;Vector=rotated(first.Vector,y,z);}
   const tangent=()=>match||track.LineType===mdx.LineType.Bezier?Vector.slice():new Float32Array(Vector.length);
   track.Keys.push({...first,Frame:start+Math.round(frame*1000/60),Vector,...first.InTan?{InTan:tangent(),OutTan:tangent()}: {}});
  }
 });
 tracks(model,track=>{if(!onGlobalClock(track))track.Keys.sort((a,b)=>a.Frame-b.Frame);});
 // Root translation grounds the articulated mount; airborne actions retain their authored pose.
 const center=model.Nodes.find(b=>b.Name==="Bone Center");ensure(center,"No mount root");
 if(!center.Translation)center.Translation={LineType:1,GlobalSeqId:null,Keys:source.Sequences.flatMap(s=>Array.from(s.Interval).map(Frame=>({Frame,Vector:new Float32Array([0,0,0])})))};
 if (["jab","jab2","forwardTilt","forwardTiltUp","forwardTiltDown","upTilt","downTilt","dashAttack","forwardSmash","upSmash","downSmash","neutralAir","forwardAir","backAir","upAir","downAir","throwForward","throwBack","throwUp","throwDown"].includes(action.pose)) {
  const target = action.pose.includes("Up") || action.pose.startsWith("up") ? [5,180] : action.pose==="downAir" ? [20,105] : action.pose.includes("Down") || action.pose.startsWith("down") ? [30,110] : action.pose.includes("Back") || action.pose.startsWith("back") ? [-65,135] : [60,130];

  const renderer = new ModelRenderer(model), data = Reflect.get(renderer,"rendererData");renderer.setSequence(index);data.frame=start+Math.round(action.contact*1000/60);
  const arm=model.Nodes.find(n=>n.Name==="Bone Rider R Arm")!,wrist=model.Nodes.find(n=>n.Name==="Bone Rider R Wrist")!,weapon=model.Nodes.find(n=>n.Name==="Weapon Ref")!,pivot=model.PivotPoints[weapon.ObjectId]!;
  const donor=(n:mdx.Model["Nodes"][number])=>source.Nodes[n.ObjectId]!.Rotation!.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1])!.Vector;
  const armBase=donor(arm),wristBase=donor(wrist);
  const set=(n:mdx.Model["Nodes"][number],base:ArrayLike<number>,y:number,z:number)=>{ for(const {frame,amount}of phases) {const key=n.Rotation!.Keys.find(k=>k.Frame===start+Math.round(frame*1000/60))!;key.Vector=rotated(base,y*amount,z*amount);if(key.InTan){key.InTan=key.Vector.slice();key.OutTan=key.Vector.slice();}} };
  let angles=[0,0,0,0];
  const loss=()=>{set(arm,armBase,angles[0]!,angles[1]!);set(wrist,wristBase,angles[2]!,angles[3]!);renderer.update(0);const mat=data.nodes[weapon.ObjectId].matrix;const x=mat[0]*pivot[0]+mat[4]*pivot[1]+mat[8]*pivot[2]+mat[12],z=mat[2]*pivot[0]+mat[6]*pivot[1]+mat[10]*pivot[2]+mat[14];return (x-target[0]!)**2+(z-target[1]!)**2;};
  for(let pass=0;pass<4;pass++)for(let dim=0;dim<4;dim++){let best=Infinity,bestAngle=0;for(let value=-180;value<=180;value+=pass<2?15:5){angles[dim]=value;const distance=loss();if(distance<best){best=distance;bestAngle=value;}}angles[dim]=bestAngle;}
  loss();

 }
 const beforeKeys=center.Translation.Keys.filter(k=>k.Frame<start||k.Frame>end);
 const drawn=new DrawnModel(generateMDX(model),1);
 const translations:mdx.AnimKeyframe[]=[];
 for(const {frame}of phases){const triangle=drawn.triangles(index,frame/60,1);let lowest=Infinity;for(let i=1;i<triangle.length;i+=2)lowest=Math.min(lowest,triangle[i]!);const old=center.Translation.Keys.find(k=>k.Frame===start+Math.round(frame*1000/60));translations.push({Frame:start+Math.round(frame*1000/60),Vector:new Float32Array([old?.Vector[0]??0,old?.Vector[1]??0,(old?.Vector[2]??0)-(action.air?0:lowest)]),...(center.Translation.LineType>1?{InTan:new Float32Array([0,0,0]),OutTan:new Float32Array([0,0,0])}:{})});}
 center.Translation.Keys=[...beforeKeys,...translations];
 const binding=`{ index: ${index}, seconds: ${seconds((end-start)/1000)}, aligned: true }`;
 if(ordinal<actions.length)bindings.push(`  ${action.pose}: ${binding},`);else damageBindings.push(`  ${binding},`);
 records.push({pose:name,index,frames:action.frames,contact:action.contact});
}
tracks(model,track=>{if(!onGlobalClock(track))track.Keys.sort((a,b)=>a.Frame-b.Frame);});
const bytes=encodeVerified(parseSource(generateMDX(model)));mkdirSync(output,{recursive:true});await Bun.write(join(output,"thrall.mdx"),bytes);
await Bun.write(join(project,"ts/src/game/presentation/heroes/thrallClips.ts"),[
 "// Generated by tools/animations/thrall-clips.ts from the stock classic Thrall rig.",'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClip, HeroClipTable } from "../../sim/heroes/hero";',
 'export const THRALL_MODEL_FILE = "units\\\\orc\\\\Thrall\\\\Thrall.mdl";',
 'export const THRALL_FALLBACK: HeroClip = { index: 0, seconds: f32(1.367) };',
 'export const THRALL_CLIPS = { idle: THRALL_FALLBACK, walk: { index: 2, seconds: f32(0.9) }, dash: { index: 2, seconds: f32(0.9) }, run: { index: 2, seconds: f32(0.9) }, ko: { index: 5, seconds: f32(2.667) },',...bindings,'} as const satisfies HeroClipTable;',
 'export const THRALL_DAMAGE_CLIPS: readonly HeroClip[] = [',...damageBindings,'];',"",
].join("\n"));
const finalDrawn=new DrawnModel(bytes,1.0);
const strides=Object.entries(DRAWN_STRIDES).flatMap(([character,data])=>data?(["walk","run"] as const).map(motion=>({character:Number(character) as Character,motion,...data[motion]})):[]).filter(row=>row.character!==Character.thrall);
for(const motion of ["walk","run"] as const)strides.push(measureDrawnStride(bytes,finalDrawn,Character.thrall,motion,"units\\orc\\Thrall\\Thrall.mdl"));
await Bun.write(join(project,"ts/src/game/presentation/drawnStrideInfo.ts"),drawnStrideSource(strides));
for(const pose of ["forwardTilt","upTilt","downTilt","backAir","downAir","neutralSpecial","sideSpecial","upSpecial","downSpecial","rollForward","throwForward","throwBack","throwUp","throwDown"]){const i=actions.findIndex(a=>a.pose===pose),action=actions[i]!;const sequence=source.Sequences.length+i;const panels:PoseFrame[]=[1,-1].flatMap(facing=>[0,Math.max(1,action.contact-3),action.contact,action.contact+4,action.frames].map(frame=>({frame,phase:frame<action.contact?AttackPhase.startup:frame<=action.contact+4?AttackPhase.active:AttackPhase.recovery,x:0,z:0,facing,parts:[],strikes:[],clip:sequence,seconds:Math.min(action.frames,frame)/60})));await Bun.write(join(output,`${pose}.png`),sheet(`Thrall ${pose}`,finalDrawn,panels,5).png);}
await Bun.write(join(output,"thrall-clips.json"),JSON.stringify({stockSequences:source.Sequences.length,appended:records.length,records},null,2)+"\n");console.log(`THRALL_CLIPS_PASS ${records.length} authored clips; ${source.Sequences.length} stock sequences retained; private output ${output}`);
