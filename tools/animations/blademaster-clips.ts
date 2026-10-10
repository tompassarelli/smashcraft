
import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, ModelRenderer, model as mdx } from "war3-model";
import { DrawnModel, sheet } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, AttackStyle, Character, GrabAction } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/sim/heroes/registry";
import { seconds } from "./asset-info";
import { swordGestureBaseModel } from "./recovery-model";
import { encodeVerified, ensure, fighters, onGlobalClock, parseSource, tracks } from "./original-clips";

const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/blademaster-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
const fighter = fighters.get(Character.blademaster)!; ensure(fighter, "missing Blademaster");
const shipped = parseSource(await Bun.file(join(input, fighter.source)).arrayBuffer());
const source = swordGestureBaseModel(shipped) ?? shipped;
const sword = source.Nodes.find(n => n?.Name === "Sword"), rightHand = source.Nodes.find(n => n?.Name === "Bone_Hand_R");
ensure(sword && rightHand, "missing sword grip");
const grip = new Float32Array([94.21669006347656, -66.13787841796875, 72.99081420898438]);
sword.PivotPoint = grip; source.PivotPoints[sword.ObjectId] = grip;
const gripOffset = Float32Array.from(grip, (value, axis) => rightHand.PivotPoint[axis]! - value);
sword.Translation = { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: source.Sequences.flatMap(s => [s.Interval[0], s.Interval[1]].map(Frame => ({ Frame, Vector: gripOffset.slice() }))) };
const model = structuredClone(source), hero = heroDefinition(Character.blademaster); ensure(hero, "missing moves");
const stand = source.Sequences.find(s => s.Name === "Stand Ready"); ensure(stand, "missing guard");
type V = readonly [number, number, number];
interface Pose { hand: V; tip: V; lean: number; twist: number; knee: number; offhand: number; legSplit:number }
const pose = (hand: V, tip: V, lean = 0, twist = 0, knee = 12, offhand = 25, legSplit=0): Pose => ({hand, tip, lean, twist, knee, offhand, legSplit});
const guard = pose([26,-25,100],[100,-25,145]);
const coil = pose([-16,-25,135],[-65,-20,180],-12,-20,24,35);
const lowCoil = pose([-22,-24,65],[-85,-24,95],16,-24,40,45);
const gestures = [
  {key:"jab",name:"Jab Quick Cut",style:AttackStyle.jab,prep:pose([10,-26,120],[-45,-25,170],-5,-12),hit:pose([46,-24,76],[128,-24,65],8,8,16),exit:pose([42,-25,64],[65,-24,12],12,16)},
  {key:"jab2",name:"Jab Returning Cut",style:AttackStyle.jab2,prep:pose([30,-24,58],[78,-24,8],14,18),hit:pose([48,-24,74],[135,-24,91],3,-12,20),exit:pose([15,-25,126],[-40,-24,160],-4,-20)},
  {key:"forwardTilt",name:"Tilt Level Cut",style:AttackStyle.forwardTilt,prep:coil,hit:pose([50,-24,86],[145,-24,85],12,12,20),exit:pose([45,-25,62],[85,-25,5],18,25,28)},
  {key:"forwardTiltUp",name:"Tilt Rising Cut",style:AttackStyle.forwardTiltUp,prep:pose([-12,-25,72],[-60,-25,20],15,-18,26),hit:pose([40,-24,115],[115,-24,182],-8,14,14),exit:pose([5,-25,140],[-55,-25,204],-12,24)},
  {key:"forwardTiltDown",name:"Tilt Falling Cut",style:AttackStyle.forwardTiltDown,prep:pose([6,-24,132],[-40,-24,206],-12,-18),hit:pose([48,-24,60],[132,-24,18],20,10,34),exit:pose([25,-25,46],[42,-25,-15],28,22,38)},
  {key:"upTilt",name:"Tilt Overhead Arc",style:AttackStyle.upTilt,prep:pose([32,-25,72],[100,-25,22],10,-15),hit:pose([12,-25,143],[25,-25,236],-10,8,14),exit:pose([-32,-25,124],[-114,-25,154],-7,20)},
  {key:"downTilt",name:"Tilt Low Poke",style:AttackStyle.downTilt,prep:lowCoil,hit:pose([48,-24,43],[145,-24,20],27,8,44,55),exit:pose([42,-24,40],[136,-24,8],24,12,40)},
  {key:"dashAttack",name:"Dash Lunging Cut",style:AttackStyle.dashAttack,prep:pose([-8,-25,104],[-75,-25,147],6,-28,28),hit:pose([61,-24,80],[155,-24,58],28,18,34,65),exit:pose([52,-24,56],[116,-24,-8],30,30,40)},
  {key:"forwardSmash",name:"Smash Shoulder Cleave",style:AttackStyle.forwardSmash,prep:pose([-25,-24,139],[-65,-24,220],-20,-32,36,60),hit:pose([52,-24,112],[150,-24,50],35,35,50,80),exit:pose([44,-24,48],[96,-24,-20],32,40,42)},
  {key:"upSmash",name:"Smash Sky Splitter",style:AttackStyle.upSmash,prep:pose([-8,-24,58],[-62,-24,0],24,-20,48,50),hit:pose([12,-24,150],[12,-24,252],-16,10,10,65),exit:pose([-25,-24,143],[-88,-24,214],-10,22,18)},
  {key:"downSmash",name:"Smash Front Rear Sweep",style:AttackStyle.downSmash,prep:lowCoil,hit:pose([50,-24,40],[146,-24,12],18,35,72,90),exit:pose([-48,-24,39],[-146,-24,8],23,-35,65,70),second:16},
  {key:"neutralAir",name:"Air Crescent Slash",style:AttackStyle.neutralAir,prep:pose([-15,-24,121],[-70,-24,172],-9,-18,48,50),hit:pose([48,-24,99],[140,-24,117],4,12,38,55),exit:pose([-40,-24,96],[-130,-24,121],-5,-25,54,65),second:12},
  {key:"forwardAir",name:"Air Forward Cleave",style:AttackStyle.forwardAir,prep:pose([-5,-24,144],[-45,-24,225],-15,-22,55,50),hit:pose([52,-24,95],[140,-24,49],16,18,40,60),exit:pose([43,-24,52],[90,-24,-25],22,30,64,65)},
  {key:"backAir",name:"Air Turning Back Cut",style:AttackStyle.backAir,prep:pose([26,-24,130],[95,-24,192],-10,20,52,45),hit:pose([-42,-24,100],[-138,-24,83],-12,-55,44,65),exit:pose([-40,-24,112],[-115,-24,174],-6,-65,62,60)},
  {key:"upAir",name:"Air Upward Pierce",style:AttackStyle.upAir,prep:pose([10,-24,88],[52,-24,6],20,-12,62,45),hit:pose([7,-24,147],[7,-24,246],-14,10,80,70,65),exit:pose([24,-24,136],[62,-24,219],-5,18,64,55,35)},
  {key:"throwBack",name:"Throw Back Heave",style:undefined,prep:pose([40,-24,105],[100,-24,148],10,18,30,75),hit:pose([-40,-24,140],[-125,-24,196],-18,-45,28,90),exit:pose([-30,-24,119],[-100,-24,150],-6,-55,20,55)},
] as const;

function writeBindings(bindings: readonly string[], names: readonly string[]) {
  return Bun.write(join(project,"ts/src/game/presentation/blademasterClipInfo.ts"),["// Generated by tools/animations/blademaster-clips.ts; regenerate instead of editing.",'import { f32 } from "wisp/src/sim/f32";','import type { HeroClipTable } from "../sim/heroes/hero";',"export const BLADEMASTER_AUTHORED_CLIPS = {",...bindings,"} as const satisfies HeroClipTable;","","export const BLADEMASTER_AUTHORED_CLIP_NAMES = {",...names,"} as const;",""].join("\n"));
}

const authoredGround = (style: AttackStyle | undefined) => style !== undefined && [AttackStyle.jab, AttackStyle.jab2, AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt, AttackStyle.dashAttack].includes(style);


function multiply(a: ArrayLike<number>, b: ArrayLike<number>): Float32Array {
  const [x,y,z,w]=Array.from(a),[u,v,t,s]=Array.from(b);
  const q=new Float32Array([w*u+x*s+y*t-z*v,w*v-x*t+y*s+z*u,w*t+x*v-y*u+z*s,w*s-x*u-y*v-z*t]);
  const n=Math.hypot(...q);return q.map(v=>v/n);
}
function rotate(q: ArrayLike<number>, axis: V, degrees: number) {
  const a=degrees*Math.PI/360,s=Math.sin(a);return multiply([axis[0]*s,axis[1]*s,axis[2]*s,Math.cos(a)],q);
}
const donor = new Map<string, mdx.AnimVector>(); tracks(source,(t,p)=>donor.set(p,t));
const base = new Map<string, Float32Array>();
for (const [path,t] of donor) {
  if(onGlobalClock(t))continue;
  const k=t.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);
  if(k)base.set(path,Float32Array.from(k.Vector));
}
const nodes=[...model.Bones,...model.Helpers], nodeByName=(name:string)=>{const n=nodes.find(n=>n.Name===name);ensure(n,name);return n;};
const arm=[nodeByName("Bone_Arm1_R"),nodeByName("Bone_Arm2_R")],hand=nodeByName("Bone_Hand_R"),tip=nodeByName("Shimmer");
let cursor=Math.max(...source.Sequences.map(s=>s.Interval[1]))+100;
interface ClipRecord { pose:string; name:string; index:number; first:number; last:number; total:number; seconds:number; strikeSeconds:number; controlFrames:number[] }
const records: ClipRecord[]=[],bindings:string[]=[],names:string[]=[];
for(const g of gestures){
  const move=g.style===undefined?undefined:hero.moves.normals[g.style];
  const thrown=hero.moves.throws[GrabAction.throwBack];ensure(move||thrown,"missing timing");
  const first=move?.startupFrames??thrown!.contactFrame,total=move?.totalFrames??thrown!.totalFrames;
  const last=first+(move?.activeFrames??1)-1;
  const start=cursor,end=start+Math.round(total*1000/60),index=model.Sequences.length;cursor=end+100;
  model.Sequences.push({...stand,Name:`Sword Gesture ${g.name}`,Interval:new Uint32Array([start,end]),NonLooping:true,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-300,-300,-200]),MaximumExtent:new Float32Array([300,300,350]),BoundsRadius:400});
  const controlFrames=[0,Math.max(1,first-3),first,("second" in g?g.second:last+2),total];
  const poses=[guard,g.prep,g.hit,g.exit,guard];
  const rotations=new Map<number,Float32Array[]>();
  for(let phase=0;phase<poses.length;phase++){
    const p=poses[phase]!;
    const temp=structuredClone(source);
    temp.Sequences.push(model.Sequences[index]!);
    tracks(temp,(t,path)=>{const v=base.get(path);if(!v||onGlobalClock(t))return;const nodeMatch=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);const n=nodeMatch?temp[nodeMatch[1] as "Bones"|"Helpers"][Number(nodeMatch[2])]:undefined;
      let q=v.slice();
      if(n){
        if(n.Name==="Bone_Chest")q=rotate(rotate(q,[0,1,0],p.lean),[0,0,1],p.twist);
        if(n.Name==="Bone_Pelvis")q=rotate(q,[0,0,1],-p.twist*0.35);
        if(n.Name==="Bone_Head")q=rotate(q,[0,1,0],-p.lean*0.4);
        if(n.Name==="Bone_Arm1_L")q=rotate(q,[0,1,0],-p.offhand);
        if(n.Name==="Bone_Arm2_L")q=rotate(q,[0,1,0],p.offhand*0.5);
        if(/^Bone_Leg1_[LR]$/.test(n.Name))q=rotate(q,[0,1,0],-p.knee*(n.Name.endsWith("L")?0.7:0.4)+p.legSplit*(n.Name.endsWith("L")?1:-1));
        if(/^Bone_Leg2_[LR]$/.test(n.Name))q=rotate(q,[0,1,0],p.knee*(p.legSplit&&n.Name.endsWith("L")?0.35:1));
      }
      t.LineType=mdx.LineType.Linear;t.Keys.push({Frame:start,Vector:q});
    });
    const renderer=new ModelRenderer(temp);renderer.setSequence(source.Sequences.length);
    const data=Reflect.get(renderer,"rendererData") as {frame:number;nodes:{matrix:Float32Array}[]};data.frame=start;renderer.update(0);
    const position=(n:mdx.Node):number[]=>{const m=data.nodes[n.ObjectId]!.matrix,v=temp.PivotPoints[n.ObjectId]!;return [m[0]!*v[0]!+m[4]!*v[1]!+m[8]!*v[2]!+m[12]!,m[1]!*v[0]!+m[5]!*v[1]!+m[9]!*v[2]!+m[13]!,m[2]!*v[0]!+m[6]!*v[1]!+m[10]!*v[2]!+m[14]!];};
    const aim=(joint:mdx.Node,effector:mdx.Node,target:V)=>{
      const origin=position(joint),a=position(effector).map((v,i)=>v-origin[i]!),b=target.map((v,i)=>v-origin[i]!);const an=Math.hypot(...a),bn=Math.hypot(...b);if(an<0.001||bn<0.001)return;
      const av=a.map(v=>v/an),bv=b.map(v=>v/bn),cross=[av[1]!*bv[2]!-av[2]!*bv[1]!,av[2]!*bv[0]!-av[0]!*bv[2]!,av[0]!*bv[1]!-av[1]!*bv[0]!],cn=Math.hypot(...cross);if(cn<0.00001)return;
      const axis=cross.map(v=>v/cn),parent=joint.Parent==null?undefined:data.nodes[joint.Parent]?.matrix;
      const local=parent?[0,1,2].map(i=>(axis[0]!*parent[i*4]!+axis[1]!*parent[i*4+1]!+axis[2]!*parent[i*4+2]!)/Math.hypot(parent[i*4]!,parent[i*4+1]!,parent[i*4+2]!)):axis;
      const n=temp.Nodes[joint.ObjectId]!,key=n.Rotation?.Keys.at(-1);ensure(key,"missing joint rotation");key.Vector=rotate(key.Vector,local as unknown as V,Math.acos(Math.max(-1,Math.min(1,av.reduce((s,v,i)=>s+v*bv[i]!,0))))*180/Math.PI);renderer.update(0);
    };
    if(phase!==0&&phase!==poses.length-1){
      for(let iteration=0;iteration<12;iteration++)for(const joint of arm.toReversed())aim(joint,hand,p.hand);
      aim(hand,tip,p.tip);
    }
    for(const n of [...temp.Bones,...temp.Helpers])if(n.Rotation){const q=n.Rotation.Keys.at(-1)?.Vector;if(q){const list=rotations.get(n.ObjectId)??[];list.push(Float32Array.from(q));rotations.set(n.ObjectId,list);}}
  }
  tracks(model,(t,path)=>{const v=base.get(path);if(!v||onGlobalClock(t))return;const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path),n=match?model[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
    for(let phase=0;phase<controlFrames.length;phase++){const Vector=n?rotations.get(n.ObjectId)?.[phase]??v:v;t.Keys.push({Frame:start+Math.round(controlFrames[phase]!*1000/60),Vector:Vector.slice(),...(t.LineType>=mdx.LineType.Hermite?{InTan:Vector.slice(),OutTan:Vector.slice()}: {})});}
  });
  bindings.push(`  ${g.key}: { index: ${index}, seconds: ${seconds((end-start)/1000)}${authoredGround(g.style) ? ", aligned: true" : ""} },`);
  names.push(`  ${g.key}: ${JSON.stringify(`Sword Gesture ${g.name}`)},`);
  records.push({pose:g.key,name:`Sword Gesture ${g.name}`,index,first,last,total,seconds:(end-start)/1000,strikeSeconds:Math.round(first*1000/60)/1000,controlFrames});
}
const bytes=encodeVerified(parseSource(generateMDX(model))),before=new DrawnModel(generateMDX(source),1),after=new DrawnModel(bytes,1);
for(const [index,s]of source.Sequences.entries())for(const fraction of [0,0.5,1]){const t=(s.Interval[1]-s.Interval[0])*fraction/1000,a=before.triangles(index,t,1),b=after.triangles(index,t,1);ensure(a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i]!)<0.001),`${s.Name}: shipped pose changed`);}
mkdirSync(join(output,"hero-models"),{recursive:true});await Bun.write(join(output,fighter.source),bytes);
await writeBindings(bindings, names);
await Bun.write(join(output,"blademaster-clips.json"),JSON.stringify({sourceSequences:source.Sequences.length,records},null,2)+"\n");
const frames=records.flatMap(r=>[Math.max(1,r.first-3),r.first,r.controlFrames[3]!].map(frame=>({frame,facing:1,clip:r.index,seconds:frame/60,phase:AttackPhase.active,x:0,z:0,parts:[],strikes:[]})));
await Bun.write(join(output,"Blademaster-gestures.png"),sheet("Blademaster",after,frames,6).png);
for(const r of records)await Bun.write(join(output,`Blademaster-${r.pose}-hit.png`),sheet(r.name,after,[1,-1].map(facing=>({frame:r.first,facing,clip:r.index,seconds:r.strikeSeconds,phase:AttackPhase.active,x:0,z:0,parts:[],strikes:[]})),2).png);
const contacts=records.map(r=>after.triangles(r.index,r.strikeSeconds,1));
let closest=Infinity;
for(let i=0;i<contacts.length;i++)for(let j=0;j<i;j++){
  const a=contacts[i]!,b=contacts[j]!;ensure(a.length===b.length,"contact geometry changed");
  const delta=a.reduce((sum,v,k)=>sum+Math.abs(v-b[k]!),0)/a.length;closest=Math.min(closest,delta);
  ensure(delta>2,`${records[i]!.pose}/${records[j]!.pose}: repeated contact silhouette`);
}
console.log(`BLADEMASTER_CONTACT_PASS ${records.length} distinct hit poses; minimum mean vertex difference ${closest.toFixed(3)}`);
console.log(`BLADEMASTER_CLIPS_PASS ${gestures.length} authored gestures; ${source.Sequences.length*3} shipped poses preserved`);
