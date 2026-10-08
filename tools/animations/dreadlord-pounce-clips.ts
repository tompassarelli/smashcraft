// Author #237's horizontal roll, healing bite and exposed recovery.
import { chmodSync, cpSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel, sheet } from "../../ts/scripts/wisp/hurtboxView";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { AttackPhase, Character } from "../../ts/src/game/sim/codes";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, fighters, onGlobalClock, parseSource, tracks } from "./original-clips";

const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/dreadlord-pounce-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
mkdirSync(output, { recursive: true });
cpSync(join(input, "hero-models"), join(output, "hero-models"), { recursive: true, dereference: true });
const fighter = fighters.get(Character.dreadlord)!; ensure(fighter, "Dreadlord missing");
const source = parseSource(await Bun.file(join(input, fighter.source)).arrayBuffer());
ensure(!source.Helpers.some(n => n.Name === "Pounce Motion"), "Pounce already authored");
const model = structuredClone(source), stand = source.Sequences[1]; ensure(stand, "Stand Ready missing");
const centre = 75;
const root = model.Nodes.length;
const helper: mdx.Helper = { Name: "Pounce Motion", ObjectId: root, Parent: null, Flags: 0,
  PivotPoint: new Float32Array([0, 0, centre]), Rotation: { LineType: 1, GlobalSeqId: -1, Keys: [] } };
for (const node of model.Nodes) if (node.Parent == null) node.Parent = root;
model.Helpers.push(helper); model.Nodes.push(helper); model.PivotPoints.push(helper.PivotPoint);
for (const sequence of source.Sequences) for (const Frame of sequence.Interval) helper.Rotation?.Keys.push({ Frame, Vector: new Float32Array([0, 0, 0, 1]) });
const originals = new Map<string, mdx.AnimVector>(); tracks(source, (t, p) => originals.set(p, t));
function rotation(x: number, y: number): Float32Array {
  const a = x * Math.PI / 360, b = y * Math.PI / 360;
  return new Float32Array([Math.sin(a)*Math.cos(b), Math.cos(a)*Math.sin(b), Math.sin(a)*Math.sin(b), Math.cos(a)*Math.cos(b)]);
}
function pitch(q: Float32Array | Int32Array, degrees: number): Float32Array {
  const s = Math.sin(degrees*Math.PI/360), c = Math.cos(degrees*Math.PI/360), [x=0,y=0,z=0,w=1]=q;
  return new Float32Array([c*x+s*z,c*y+s*w,c*z-s*x,c*w-s*y]);
}
let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
const bindings: string[] = [], indices: Record<string, number> = {};
for (const [name, frames] of [["travel",16],["bite",16],["recovery",34]] as const) {
  const start=cursor, end=start+Math.round(frames*1000/60), index=model.Sequences.length; cursor=end+100; indices[name]=index;
  model.Sequences.push({ ...stand, Name:`Pounce ${name}`, Interval:new Uint32Array([start,end]), NonLooping:true, MoveSpeed:0, Rarity:0,
    MinimumExtent:new Float32Array([-250,-250,-100]), MaximumExtent:new Float32Array([250,250,300]), BoundsRadius:400 });
  tracks(model,(track,path)=>{
    const donor=originals.get(path); if(!donor||onGlobalClock(donor)) return;
    const key=donor.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]); if(!key) return;
    const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const node=match?source[match[1] as "Bones"|"Helpers"][Number(match[2])]:undefined;
    for(let frame=0;frame<=frames;frame++) {
      const t=frame/frames, n=node?.Name??"";
      let amount=0;
      if(name==="travel") {
        if(/(Arm1|shoulder|UpArm)/i.test(n)) amount=/R/.test(n)?-65:-95;
        if(/(Leg1|hip|UpperLeg)/i.test(n)) amount=/R/.test(n)?-35:-70;
        if(/(Leg2|knee|LowerLeg)/i.test(n)) amount=95;
        if(/(Chest|NECK)/i.test(n)) amount=15;
      } else if(name==="bite") {
        const bite=Math.sin(Math.PI*t);
        if(/(Chest|NECK|Head)/i.test(n)) amount=50*bite;
        if(/(Arm1|shoulder|UpArm)/i.test(n)) amount=-90;
        if(/(Arm2|elbow|LowArm)/i.test(n)) amount=60+25*bite;
      } else {
        if(/(Chest|NECK)/i.test(n)) amount=30*(1-t);
        if(/(Leg1|hip|UpperLeg)/i.test(n)) amount=-40*(1-t);
        if(/(Leg2|knee|LowerLeg)/i.test(n)) amount=65*(1-t);
      }
      const Vector=amount?pitch(key.Vector,amount):key.Vector.slice();
      track.Keys.push({...key,Frame:start+Math.round(frame*1000/60),Vector,...(key.InTan?{InTan:Vector.slice(),OutTan:Vector.slice()}:{})});
    }
  });
  for(let frame=0;frame<=frames;frame++) {
    const t=frame/frames, roll=name==="travel"?360*t:0, lean=name==="travel"?80:name==="bite"?15*Math.sin(Math.PI*t):60*(1-t)*(1-t);
    helper.Rotation?.Keys.push({Frame:start+Math.round(frame*1000/60),Vector:rotation(roll,lean)});
  }
  bindings.push(`  ${name}: { index: ${index}, seconds: ${seconds((end-start)/1000)} },`);
}
const bytes=encodeVerified(parseSource(generateMDX(model)));
chmodSync(join(output,fighter.source),0o644); await Bun.write(join(output,fighter.source),bytes);
const drawn=new DrawnModel(bytes,characterModelScale(Character.dreadlord));
for(const [name,frames] of [["travel",16],["bite",16],["recovery",34]] as const) {
  const moments=name==="travel"?[0,4,8,12,16]:name==="bite"?[0,4,8,12,16]:[0,8,17,25,34];
  await Bun.write(join(output,`Dreadlord-${name}.png`),sheet(`Dreadlord ${name}`,drawn,[1,-1].flatMap(facing=>moments.map(frame=>({frame,facing,clip:indices[name],seconds:frame/60,phase:AttackPhase.none,x:0,z:0,parts:[],strikes:[]}))),moments.length).png);
}
await Bun.write(join(project,"ts/src/game/presentation/dreadlordPounceClipInfo.ts"),[
  "// Generated by tools/animations/dreadlord-pounce-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";',
  "export const DREADLORD_POUNCE_CLIPS = {",...bindings,"} as const;", "",
].join("\n"));
console.log(`POUNCE_CLIPS_PASS: 360 degrees around travel axis, 3 authored phases; ${source.Sequences.length} previous sequences preserved`);
