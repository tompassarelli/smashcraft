
import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, parseMDX, ModelRenderer, model as mdx } from "war3-model";
import { isDeepStrictEqual } from "node:util";
import { mat4, quat, vec3 } from "gl-matrix";
import { DrawnModel, sheet, type PoseFrame } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, AttackStyle, Character, GrabAction } from "../../ts/src/game/sim/codes";
import { drawnStrideSource, measureDrawnStride, type DrawnStride } from "../../ts/scripts/wisp/drawnMotion";
import { DRAWN_STRIDES } from "../../ts/src/game/presentation/drawnStrideInfo";
import type { HeroPose } from "../../ts/src/game/sim/heroes/hero";
import { CAIRNE_MOVES } from "../../ts/src/game/sim/heroes/cairneMoves";
import { CAIRNE_SPECIALS } from "../../ts/src/game/sim/heroes/cairneSpecials";
import { seconds } from "./asset-info";
function ensure(ok: unknown, why: string): asserts ok { if (!ok) throw new Error(why); }
function tracks(value: unknown, visit: (track: mdx.AnimVector, path: string) => void, path = "") {
  if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) return;
  if ("Keys" in value && Array.isArray(value.Keys)) { visit(value as mdx.AnimVector, path); return; }
  for (const [key, child] of Object.entries(value)) if (key !== "Nodes") tracks(child, visit, `${path}.${key}`);
}
const onGlobalClock=(track:mdx.AnimVector)=>track.GlobalSeqId!=null&&track.GlobalSeqId!==-1&&track.GlobalSeqId!==0xffffffff;
function parseSource(bytes:ArrayBuffer){const parsed=parseMDX(bytes);ensure(Buffer.from(generateMDX(parsed)).equals(Buffer.from(bytes)),"Stock MDX does not round trip");return parsed;}
function encodeVerified(value:mdx.Model){const bytes=generateMDX(value);ensure(isDeepStrictEqual(value,parseMDX(bytes)),"Authored MDX does not round trip");return bytes;}

const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/cairne-clips.ts STOCK_TAUREN.mdx PRIVATE_OUTPUT");
const source = parseSource(await Bun.file(input).arrayBuffer()), model = structuredClone(source);
ensure(source.Sequences.length === 12 && source.Nodes.some(n => n.Name === "Bone_Axe_Free"), "Expected classic Tauren Chieftain");
const stand = source.Sequences[4]!;
interface Gesture { chest?: number; head?: number; arm?: number; elbow?: number; free?: number; freeElbow?: number; hip?: number; knee?: number; lean?: number; yaw?: number; leftHip?: number; rightHip?: number }
interface Phase { frame: number; gesture: Gesture; target?: readonly [number,number] }
interface Action { pose: HeroPose; frames: number; contact: number; gesture: Gesture; prepTravel?: number; hold?: boolean; air?: boolean; roll?: number; first?: Gesture; phases?: readonly Phase[]; target?: readonly [number, number]; damage?: boolean }
const ready: Gesture = {};
const reach: Gesture = { chest: 22, arm: -75, elbow: 35, free: -48, hip: -12, knee: 18, head: -12 };
const high: Gesture = { chest: -18, arm: -160, elbow: -10, free: -105, hip: 12, knee: 8, head: -22 };
const low: Gesture = { chest: 50, arm: -38, elbow: 20, free: -50, hip: -50, knee: 75, head: -20 };
const back: Gesture = { ...reach, chest: -10, yaw: 130, arm: -110, free: -60 };
const brace: Gesture = { chest: 28, arm: -24, elbow: 40, free: -35, hip: -35, knee: 55, head: -12 };
const held: Gesture = { chest: 8, arm: -25, elbow: 20, free: -78, freeElbow: 12, hip: -8, knee: 12 };
const captive: Gesture = { chest: -25, head: -28, arm: 25, elbow: 55, free: 20, freeElbow: 45, hip: -30, knee: 38 };
const actions: Action[] = [];
const normals: readonly [HeroPose, AttackStyle, Gesture][] = [
  ["jab", AttackStyle.jab, {...reach, chest: 12, arm: -55}], ["jab2", AttackStyle.jab2, reach],
  ["forwardTilt", AttackStyle.forwardTilt, reach], ["forwardTiltUp", AttackStyle.forwardTiltUp, reach], ["forwardTiltDown", AttackStyle.forwardTiltDown, reach],
  ["upTilt", AttackStyle.upTilt, high], ["downTilt", AttackStyle.downTilt, low], ["dashAttack", AttackStyle.dashAttack, {...reach, lean: 24, chest: 32}],
  ["forwardSmash", AttackStyle.forwardSmash, {...reach, chest: 38, hip: -24}], ["upSmash", AttackStyle.upSmash, {...high, chest: -30}], ["downSmash", AttackStyle.downSmash, low],
  ["neutralAir", AttackStyle.neutralAir, reach], ["forwardAir", AttackStyle.forwardAir, {...reach, chest: 32}], ["backAir", AttackStyle.backAir, back],
  ["upAir", AttackStyle.upAir, {chest:-22,head:-38,arm:15,free:10,hip:28,knee:40}], ["downAir", AttackStyle.downAir, {...low, chest: 38, arm: -55}],
];
for (const [pose, style, gesture] of normals) {
  const move = CAIRNE_MOVES.normals[style]; ensure(move, `${pose}: missing timing`);
  const first = move.startupFrames;
  const sweeping = ["forwardTilt","forwardTiltUp","forwardTiltDown","forwardSmash","forwardAir","backAir","upTilt","downSmash","neutralAir"].includes(pose);
  const phases:Phase[]|undefined = sweeping ? move.regions.map(region => ({frame: region.firstFrame, target:[region.hit.strike!.x2,region.hit.strike!.z2],gesture: {...gesture,
    arm: (gesture.arm ?? 0) + ((region.hit.strike?.z2??0) > 130 ? -45 : (region.hit.strike?.z2??0) < 40 ? 45 : 0),
    yaw: (region.hit.strike?.x2??0) < 0 ? 145 : 0,
    chest: (gesture.chest ?? 0) + ((region.hit.strike?.z2??0) < 40 ? 20 : -8) }})) : undefined;
  actions.push({pose,frames:move.totalFrames,contact:first,gesture,phases,air:pose.endsWith("Air"),
    prepTravel: style===AttackStyle.dashAttack ? 40 : undefined,
    target: style===AttackStyle.upAir || style===AttackStyle.dashAttack ? undefined : [move.regions[0]!.hit.strike!.x2, move.regions[0]!.hit.strike!.z2]});
}
const extra: readonly [HeroPose, number, number, Gesture][] = [
  ["crouch",30,10,brace], ["landing",8,2,{...brace,chest:38}], ["shield",30,1,{...brace,free:-100}], ["smashCharge",30,1,{...high,arm:-110}],
  ["airDodge",49,4,{...brace,lean:-30}], ["dizzy",60,20,{chest:-15,head:35,arm:20,free:30,yaw:20}],
  ["turn",8,4,{chest:-10,yaw:130,hip:-15,knee:25}], ["stop",8,3,{...brace,lean:-20}], ["jumpSquat",5,4,brace],
  ["jump",24,6,{...high,hip:-35,knee:65}], ["doubleJump",24,6,{...high,hip:35,knee:45}], ["wallJump",24,6,{...reach,lean:-35,leftHip:-65,rightHip:25}],
  ["wallTech",26,6,{...brace,lean:-30}], ["fall",30,10,{chest:12,arm:-30,free:-50,hip:35,knee:45}], ["fallSpecial",30,10,{chest:38,arm:15,free:25,hip:45,knee:65}],
  ["ledgeHang",30,1,{chest:25,free:-165,freeElbow:5,hip:40,knee:60}], ["ledgeClimb",25,10,{...brace,lean:35,free:-105}], ["ledgeAttack",40,16,reach],
  ["knockdown",30,20,{...brace,lean:85}], ["downDamage",24,6,{...brace,lean:75,head:-35}], ["getUp",30,18,{...brace,lean:20}], ["getUpAttack",49,16,{...reach,yaw:100}],
  ["spotDodge",22,4,{...brace,lean:-25}], ["tech",26,8,{...brace,lean:45}],
  ["damageGround",24,3,{chest:-30,head:-30,arm:35,free:45}], ["damageAir",24,3,{chest:-45,hip:-35,knee:55,free:30}],
  ["damageTumble",30,9,{...brace,lean:100}], ["damageShield",24,3,{...brace,chest:-15,head:-20}],
  ["grab",45,11,held], ["grabHold",30,1,held], ["grabbed",30,1,captive], ["pummel",68,60,{...held,chest:26,arm:-60,elbow:60}],
  ["throwForward",45,19,{...held,chest:32,free:-115,freeElbow:-5}], ["throwBack",54,23,{...held,chest:-22,free:-175,yaw:125}],
  ["throwUp",32,21,{...held,chest:-25,free:-175,freeElbow:0,knee:0}], ["throwDown",51,24,{...held,chest:65,free:-35,hip:-35,knee:55}],
  ["victimPummel",68,60,{...captive,chest:45,head:-48}], ["victimThrowForward",45,19,{...captive,lean:-35,chest:-38,arm:-90}],
  ["victimThrowBack",54,23,{...captive,lean:40,yaw:-85,arm:-135}], ["victimThrowUp",32,21,{...captive,lean:-25,hip:-60,knee:20,free:-140}],
  ["victimThrowDown",51,24,{...captive,lean:75,chest:60,hip:-75,knee:80}],
];
for (const [pose, frames, contact, gesture] of extra) {
  const throwCode = ({pummel:GrabAction.pummel,throwForward:GrabAction.throwForward,throwBack:GrabAction.throwBack,throwUp:GrabAction.throwUp,throwDown:GrabAction.throwDown} as Partial<Record<HeroPose,GrabAction>>)[pose];
  const thrown = throwCode === undefined ? undefined : CAIRNE_MOVES.throws[throwCode];
  const move = pose === "grab" ? CAIRNE_MOVES.normals[AttackStyle.grab] : undefined;
  actions.push({pose,frames:thrown?.totalFrames ?? move?.totalFrames ?? frames,contact:thrown?.contactFrame ?? move?.startupFrames ?? contact,gesture,
    phases:pose==="getUpAttack"?[{frame:16,gesture:reach,target:[125,45]},{frame:17,gesture:high,target:[0,180]},{frame:18,gesture:back,target:[-125,45]}]:undefined,
    first: pose.startsWith("victim") ? captive : pose.startsWith("throw") || pose === "pummel" ? held : pose === "getUp" || pose === "getUpAttack" ? {...brace,lean:85} : undefined,
    hold:["crouch","shield","smashCharge","grabHold","grabbed","ledgeHang"].includes(pose),
    air:["airDodge","jump","doubleJump","wallJump","fall","fallSpecial","damageAir","damageTumble","victimThrowUp"].includes(pose)});
}
for (const pose of ["rollForward","rollBackward","techForward","techBackward","getUpRollForward","getUpRollBackward","ledgeRoll"] as const)
  actions.push({pose,frames:pose.startsWith("tech")?40:pose.startsWith("getUp")?35:pose==="ledgeRoll"?36:31,contact:10,gesture:brace,roll:pose.endsWith("Backward")?-1:1});
for (const [pose, key, gesture, contact] of [
  ["neutralSpecial","neutral",{...low,arm:-45,chest:45},24], ["sideSpecial","side",{...brace,leftHip:-70,rightHip:10,chest:20},20],
  ["upSpecial","up",{...high,hip:35,knee:55},11], ["downSpecial","down",{...brace,arm:-65,free:-65,head:30},6],
] as const) {
  const special = CAIRNE_SPECIALS[key]; ensure(special, `${pose}: missing special`);
  for (const air of [false,true]) { const form = air ? special.air ?? special.ground : special.ground;
    const charge: Gesture = {...brace,chest:-12,arm:-105,elbow:35,free:-75,freeElbow:25,lean:-8,yaw:-15,head:10};
    const wound: Gesture = {...charge,chest:-24,arm:-155,elbow:55,free:-110,hip:-45,knee:70,yaw:-25};
    actions.push({pose:(air?`${pose}Air`:pose) as HeroPose,frames:form.endFrame,contact,gesture,air:air||key==="up",
      first:key==="neutral"?charge:undefined,
      phases:key==="neutral"?[
        {frame:1,gesture:charge},{frame:12,gesture:wound},{frame:contact-1,gesture:wound},
        {frame:contact,gesture},{frame:contact+4,gesture},
      ]:undefined}); }
}
const damageActions: Action[] = [];
for (let height=0;height<3;height++) for (let strength=0;strength<3;strength++) {
  const gain=[0.55,0.9,1.3][strength]!;
  const gesture:Gesture = height===0 ? {hip:-55*gain,knee:75*gain,chest:24*gain,head:-12*gain,arm:25*gain,free:35*gain}
    : height===1 ? {chest:48*gain,head:-24*gain,hip:-22*gain,knee:25*gain,arm:-35*gain,free:-45*gain,yaw:18*gain}
    : {head:-50*gain,chest:-28*gain,arm:42*gain,free:55*gain,hip:15*gain,knee:22*gain};
  damageActions.push({pose:"damageGround",frames:24,contact:0,gesture,hold:true,damage:true});
}
function rotation(base: ArrayLike<number>, pitch:number, yaw=0): Float32Array {
  const q=quat.create(); quat.rotateY(q,q,pitch*Math.PI/180); quat.rotateZ(q,q,yaw*Math.PI/180);
  quat.multiply(q,q,Float32Array.from(base)); quat.normalize(q,q); return new Float32Array(q);
}
function joint(name:string,g:Gesture):[number,number] {
  if(name==="Root")return [g.lean??0,g.yaw??0];
  if(name==="Bone_Chest")return [g.chest??0,0]; if(name==="Bone_Head")return [g.head??0,0];
  if(name==="Bone_UpperArmR")return [g.arm??0,0]; if(name==="Bone_LowerArmR")return [g.elbow??0,0];
  if(name==="Bone_UpperArmL")return [g.free??0,0]; if(name==="Bone_LowerArmL")return [g.freeElbow??0,0];
  if(name==="Bone_UpperlegL")return [g.leftHip??g.hip??0,0]; if(name==="Bone_UpperlegR")return [g.rightHip??(g.hip??0)*0.55,0];
  if(/^Bone_Leg2[LR]$/.test(name))return [g.knee??0,0];
  return [0,0];
}
const blend=(a:Gesture,b:Gesture,t:number):Gesture=>Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(k=>[k,(a[k as keyof Gesture]??0)*(1-t)+(b[k as keyof Gesture]??0)*t]));
const originals=new Map<string,mdx.AnimVector>(); tracks(source,(track,path)=>originals.set(path,track));
const render=new ModelRenderer(model), data=Reflect.get(render,"rendererData");
const hand=model.Nodes.find(n=>n.Name==="Bone_HandR")!,weapon=model.Nodes.find(n=>n.Name==="Bone_Axe_Free")!,main=model.Nodes.find(n=>n.Name==="Main")!;
const evaluate=(index:number,frame:number)=>{render.setSequence(index);data.frame=model.Sequences[index]!.Interval[0]+Math.round(frame*1000/60);render.update(0);};
evaluate(4,0);
const handRest=mat4.clone(data.nodes[hand.ObjectId].matrix),axeRest=mat4.clone(data.nodes[weapon.ObjectId].matrix),offset=mat4.create();
ensure(mat4.invert(offset,handRest),"Hand's stock pose is singular"); mat4.multiply(offset,offset,axeRest);
const weaponRef=model.Nodes.find(n=>n.Name==="Weapon Ref")!,weaponPivot=model.PivotPoints[weaponRef.ObjectId]!;
const weaponPoint=vec3.fromValues(weaponPivot[0]!,weaponPivot[1]!,weaponPivot[2]!);vec3.transformMat4(weaponPoint,weaponPoint,data.nodes[weaponRef.ObjectId].matrix);
const inverseHand=mat4.create();ensure(mat4.invert(inverseHand,handRest),"Hand pose is singular");vec3.transformMat4(weaponPoint,weaponPoint,inverseHand);
let cursor=Math.max(...source.Sequences.map(s=>s.Interval[1]))+100;
const bindings:string[]=[],damageBindings:string[]=[],records:{pose:string;index:number;frames:number;contact:number}[]=[];
for (const [ordinal,action] of [...actions,...damageActions].entries()) {
  const index=model.Sequences.length,start=cursor,end=start+Math.round(action.frames*1000/60);cursor=end+100;
  const name=action.damage?`Cairne Pain ${Math.floor((ordinal-actions.length)/3)} ${(ordinal-actions.length)%3}`:`Cairne ${action.pose}`;
  model.Sequences.push({...stand,Name:name,Interval:new Uint32Array([start,end]),NonLooping:!action.hold,MoveSpeed:0,Rarity:0,
    MinimumExtent:new Float32Array([-320,-320,-200]),MaximumExtent:new Float32Array([320,320,360]),BoundsRadius:440});
  const coil=blend(ready,action.gesture,-0.32);
  const phases:Phase[]=action.roll ? [0,0.12,0.25,0.5,0.75,0.9,1].map(t=>({frame:Math.round(t*action.frames),gesture:{...blend(ready,brace,t===0||t===1?0:1),lean:t*360*action.roll!}})) : action.hold ? [{frame:0,gesture:action.gesture},{frame:action.frames,gesture:action.gesture}] : [
    {frame:0,gesture:action.first??ready},{frame:Math.max(1,action.contact-3),gesture:action.pose==="neutralSpecial"||action.pose==="neutralSpecialAir"
      ? action.phases?.[1]?.gesture??ready : blend(action.first??ready,coil,0.75)},
    ...(action.phases ?? [{frame:action.contact,gesture:action.gesture,target:action.target},{frame:Math.min(action.frames-1,action.contact+4),gesture:action.gesture,target:action.target}]),
    {frame:action.frames,gesture:action.pose==="pummel"||action.pose==="victimPummel"?action.first??ready:ready},
  ].sort((a,b)=>a.frame-b.frame).filter((p,i,array)=>i===0||p.frame!==array[i-1]?.frame);
  tracks(model,(track,path)=>{
    const donor=originals.get(path); if(!donor||onGlobalClock(donor))return;
    const first=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);if(!first)return;
    const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path),node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
    for(const phase of phases){const [pitch,yaw]=node?joint(node.Name,phase.gesture):[0,0];const Vector=node?rotation(first.Vector,pitch,yaw):first.Vector.slice();
      const tangent=()=>match||track.LineType===mdx.LineType.Bezier?Vector.slice():new Float32Array(Vector.length);
      track.Keys.push({...first,Frame:start+Math.round(phase.frame*1000/60),Vector,...first.InTan?{InTan:tangent(),OutTan:tangent()}: {}});}
  });


  const shoulder=model.Nodes.find(n=>n.Name==="Bone_UpperArmR")!,elbow=model.Nodes.find(n=>n.Name==="Bone_LowerArmR")!;
  const baseline=(node:mdx.Node)=>source.Nodes[node.ObjectId]!.Rotation!.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1])!.Vector;
  for(const phase of phases)if(phase.target){
    const armKey=shoulder.Rotation!.Keys.find(k=>k.Frame===start+Math.round(phase.frame*1000/60))!,elbowKey=elbow.Rotation!.Keys.find(k=>k.Frame===start+Math.round(phase.frame*1000/60))!;
    const angles=[phase.gesture.arm??0,0,phase.gesture.elbow??0,0];
    const loss=()=>{armKey.Vector=rotation(baseline(shoulder),angles[0]!,angles[1]!);elbowKey.Vector=rotation(baseline(elbow),angles[2]!,angles[3]!);
      evaluate(index,phase.frame);const point=vec3.create();vec3.transformMat4(point,weaponPoint,data.nodes[hand.ObjectId].matrix);
      return (point[0]!-phase.target![0])**2+(point[2]!-phase.target![1])**2;};
    for(let pass=0;pass<4;pass++)for(let axis=0;axis<4;axis++){let best=Infinity,bestAngle=angles[axis]!;for(let angle=-180;angle<=180;angle+=pass<2?15:5){angles[axis]=angle;const value=loss();if(value<best){best=value;bestAngle=angle;}}angles[axis]=bestAngle;}
    loss();for(const key of [armKey,elbowKey])if(key.InTan){key.InTan=key.Vector.slice();key.OutTan=key.Vector.slice();}
  }


  const addTransform=(node:mdx.Node,frame:number,matrix:mat4)=>{
    const pivot=model.PivotPoints[node.ObjectId]!,q=quat.create(),p=vec3.fromValues(pivot[0]!,pivot[1]!,pivot[2]!),v=vec3.create();
    mat4.getRotation(q,matrix);quat.normalize(q,q);vec3.transformQuat(v,p,q);
    const translation=new Float32Array([matrix[12]!-p[0]!+v[0]!,matrix[13]!-p[1]!+v[1]!,matrix[14]!-p[2]!+v[2]!]);
    for(const [property,Vector]of [["Rotation",new Float32Array(q)],["Translation",translation]] as const){
      const track=node[property];ensure(track,`${node.Name}: no ${property}`);const existing=track.Keys.find(k=>k.Frame===start+Math.round(frame*1000/60));
      const key={Frame:start+Math.round(frame*1000/60),Vector,...track.LineType>1?{InTan:property==="Rotation"?Vector.slice():new Float32Array(3),OutTan:property==="Rotation"?Vector.slice():new Float32Array(3)}: {}};
      if(existing)Object.assign(existing,key);else track.Keys.push(key);
    }
  };
  for(let frame=0;frame<=action.frames;frame++){
    evaluate(index,frame);const world=mat4.create(),local=mat4.create();mat4.multiply(world,data.nodes[hand.ObjectId].matrix,offset);
    ensure(mat4.invert(local,data.nodes[main.ObjectId].matrix),"Main pose is singular");mat4.multiply(local,local,world);addTransform(weapon,frame,local);
  }
  weapon.Rotation!.Keys.sort((a,b)=>a.Frame-b.Frame);weapon.Translation!.Keys.sort((a,b)=>a.Frame-b.Frame);

  const drawn=new DrawnModel(generateMDX(model),1);const rootTrack=main.Translation!;
  if(!action.air){const mainDonor=source.Nodes[main.ObjectId]!.Translation!.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1])!;
    for(let frame=0;frame<=action.frames;frame++){const vertices=drawn.triangles(index,frame/60,1);let floor=Infinity;for(let i=1;i<vertices.length;i+=2)floor=Math.min(floor,vertices[i]!);
      const Frame=start+Math.round(frame*1000/60),Vector=mainDonor.Vector.slice();Vector[2]=Vector[2]!-floor;
      if(action.prepTravel&&frame<action.contact){const wind=Math.max(1,action.contact-3);Vector[0]=Vector[0]!-action.prepTravel*(frame<=wind?frame/wind:(action.contact-frame)/(action.contact-wind));}
      const key={Frame,Vector,...rootTrack.LineType>1?{InTan:new Float32Array(3),OutTan:new Float32Array(3)}:{}};
      const previous=rootTrack.Keys.find(k=>k.Frame===Frame);if(previous)Object.assign(previous,key);else rootTrack.Keys.push(key);}
    rootTrack.Keys.sort((a,b)=>a.Frame-b.Frame);}
  const duration=(end-start)/1000;
  const victimContact=action.pose.startsWith("victim");
  const contact=action.pose.startsWith("throw")||victimContact||action.pose==="pummel"?`, contact: ${seconds(victimContact?0.5:action.contact/60)}`:"";
  const binding=`{ index: ${index}, seconds: ${seconds(victimContact?1:duration)}, aligned: true${contact} }`;
  if(action.damage)damageBindings.push(`  ${binding},`);else bindings.push(`  ${action.pose}: ${binding},`);
  records.push({pose:name,index,frames:victimContact?60:action.frames,contact:victimContact?30:action.contact});
}

for(const [ordinal,action]of actions.entries())if(action.pose.startsWith("victim")){
  const sequence=model.Sequences[source.Sequences.length+ordinal]!,[first,last]=sequence.Interval,contact=first+Math.round(action.contact*1000/60),start=cursor;cursor=start+1100;
  tracks(model,track=>{if(onGlobalClock(track))return;for(const key of track.Keys)if(key.Frame>=first&&key.Frame<=last)key.Frame=start+(key.Frame<=contact?Math.round((key.Frame-first)/(contact-first)*500):500+Math.round((key.Frame-contact)/(last-contact)*500));track.Keys.sort((a,b)=>a.Frame-b.Frame);});
  sequence.Interval=new Uint32Array([start,start+1000]);
}
const bytes=encodeVerified(parseSource(generateMDX(model)));mkdirSync(output,{recursive:true});await Bun.write(join(output,"herotaurenchieftain.mdx"),bytes);
await Bun.write(join(project,"ts/src/game/presentation/heroes/cairneClips.ts"),[
  "// Generated by tools/animations/cairne-clips.ts; regenerate instead of editing.", 'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClip, HeroClipTable } from "../../sim/heroes/hero";',
  'export const CAIRNE_FALLBACK: HeroClip = { index: 4, seconds: 2.0 };',
  'export const CAIRNE_CLIPS = { idle: { index: 0, seconds: f32(2.667) }, walk: { index: 3, seconds: 1.0 }, dash: { index: 3, seconds: 1.0 }, run: { index: 3, seconds: 1.0 }, ko: { index: 11, seconds: 2.0 },',
  ...bindings,'} as const satisfies HeroClipTable;', 'export const CAIRNE_DAMAGE_CLIPS: readonly HeroClip[] = [',...damageBindings,'];',"",
].join("\n"));
const before=new DrawnModel(generateMDX(source),1),after=new DrawnModel(bytes,1);
const strides:DrawnStride[]=Object.entries(DRAWN_STRIDES).flatMap(([character,row])=>row===undefined||Number(character)===Character.cairne?[]:
  (["walk","run"] as const).map(motion=>({character:Number(character) as Character,motion,...row[motion]})));
for(const motion of ["walk","run"] as const)strides.push(measureDrawnStride(bytes,after,Character.cairne,motion,"units\\orc\\HeroTaurenChieftain\\HeroTaurenChieftain.mdl"));
await Bun.write(join(project,"ts/src/game/presentation/drawnStrideInfo.ts"),drawnStrideSource(strides));
let preserved=0;
for(const [index,sequence]of source.Sequences.entries())for(const part of [0,0.5,1]){const time=(sequence.Interval[1]-sequence.Interval[0])*part/1000,a=before.triangles(index,time,1),b=after.triangles(index,time,1);
  ensure(a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i]!)<0.001),`${sequence.Name}: stock pose changed`);preserved++;}
const motions=actions.map((action,ordinal)=>{const index=source.Sequences.length+ordinal,first=after.triangles(index,0,1),contact=after.triangles(index,action.pose.startsWith("victim")?0.5:action.contact/60,1);let motion=0;
  ensure(first.length>0&&contact.length===first.length,`${action.pose}: body missing`);for(let i=0;i<first.length;i+=2)motion=Math.max(motion,Math.hypot(contact[i]!-first[i]!,contact[i+1]!-first[i+1]!));
  if(!action.hold)ensure(motion>=8,`${action.pose}: no local gesture (${motion})`);return {pose:action.pose,motion};});
const pain=damageActions.map((_,ordinal)=>after.triangles(source.Sequences.length+actions.length+ordinal,0,1));
for(let a=0;a<pain.length;a++)for(let b=a+1;b<pain.length;b++)ensure(pain[a]!.some((v,i)=>Math.abs(v-pain[b]![i]!)>2),`Pain ${a}/${b}: same silhouette`);
for(const pose of ["forwardTilt","upTilt","downTilt","downSmash","neutralAir","backAir","upAir","downAir","neutralSpecial","sideSpecial","upSpecial","downSpecial","rollForward","throwForward","throwBack","throwUp","throwDown"] as const){
  const ordinal=actions.findIndex(a=>a.pose===pose),action=actions[ordinal]!;
  const panels:PoseFrame[]=[1,-1].flatMap(facing=>[0,Math.max(1,action.contact-3),action.contact,Math.min(action.frames,action.contact+4),action.frames].map(frame=>({frame,phase:frame<action.contact?AttackPhase.startup:frame<=action.contact+4?AttackPhase.active:AttackPhase.recovery,x:0,z:0,facing,parts:[],strikes:[],clip:source.Sequences.length+ordinal,seconds:frame/60})));
  await Bun.write(join(output,`${pose}.png`),sheet(`Cairne ${pose}`,after,panels,5).png);
}
await Bun.write(join(output,"cairne-clips.json"),JSON.stringify({stockSequences:source.Sequences.length,preservedSamples:preserved,appended:records.length,records,motions},null,2)+"\n");
console.log(`CAIRNE_CLIPS_PASS ${records.length} clips; ${preserved} stock pose samples retained; nine distinct first pain poses; ${output}`);
