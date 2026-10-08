// Foreign MDX boundary: append articulated drills without changing prior clips.
import { chmodSync, cpSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel, sheet } from "../../ts/scripts/wisp/hurtboxView";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { AttackPhase, AttackStyle, Character } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/sim/heroes/registry";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, fighters, hash, onGlobalClock, parseSource, tracks } from "./original-clips";
import { drillBaseModel } from "./recovery-model";

const [input, output] = process.argv.slice(2).map(p => resolve(p));
ensure(input && output, "usage: bun tools/animations/drill-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
const project = resolve(import.meta.dir, "../..");
ensure(relative(project, output).startsWith(".."), "Derived models must stay outside the checkout");
mkdirSync(output, { recursive: true });
cpSync(join(input, "hero-models"), join(output, "hero-models"), { recursive: true, dereference: true });
chmodSync(join(output, "hero-models"), 0o755);

const axis = (component: number, degrees: number): Float32Array => {
  const angle = degrees * Math.PI / 360;
  const q = new Float32Array([0, 0, 0, Math.cos(angle)]);
  q[component] = Math.sin(angle);
  return q;
};
const multiply = (a: Float32Array | Int32Array, b: Float32Array): Float32Array => {
  const [x, y, z, w] = a, [u, v, s, t] = b;
  ensure(x !== undefined && y !== undefined && z !== undefined && w !== undefined && u !== undefined && v !== undefined && s !== undefined && t !== undefined, "Quaternion needs four components");
  return new Float32Array([w*u+x*t+y*s-z*v, w*v-x*s+y*t+z*u, w*s+x*v-y*u+z*t, w*t-x*u-y*v-z*s]);
};
const smooth = (t: number) => t*t*(3-2*t);
const interval = (sequence: mdx.Sequence): readonly [number, number] => {
  const start = sequence.Interval[0], end = sequence.Interval[1];
  ensure(start !== undefined && end !== undefined && end > start, `${sequence.Name}: invalid clip interval`);
  return [start, end];
};
const bindings: string[] = [];
const evidence: unknown[] = [];
for (const character of [Character.blademaster, Character.warden, Character.shadowHunter]) {
  const fighter = fighters.get(character)!, hero = heroDefinition(character);
  const move = hero?.moves.normals[AttackStyle.downAir];
  ensure(fighter && hero && move, `${character}: no drill`);
  const source = parseSource(await Bun.file(join(input, fighter.source)).arrayBuffer());
  ensure(!source.Helpers.some(n => n.Name === "Drill Motion"), `${fighter.name}: drill already appended`);
  const model = structuredClone(source);
  const stand = source.Sequences.find(s => /^stand ready$/i.test(s.Name)) ?? source.Sequences.find(s => /^stand(?:\s*-?\s*\d+)?$/i.test(s.Name));
  const donor = source.Sequences[hero.presentation.clips.downAir?.index ?? -1];
  ensure(stand && donor, `${fighter.name}: no pose donor`);
  const [standStart, standEnd] = interval(stand);
  const frames = move.totalFrames, first = move.startupFrames, last = first + move.activeFrames;
  const start = Math.max(...source.Sequences.map(s => interval(s)[1])) + 100, end = start + Math.round(frames*1000/60);
  const index = source.Sequences.length;
  model.Sequences.push({ ...donor, Name: "Drill Down Air", Interval: new Uint32Array([start,end]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array([-300,-300,-150]), MaximumExtent: new Float32Array([300,300,350]), BoundsRadius: 400 });
  const originals = new Map<string, mdx.AnimVector>();
  tracks(source, (track, path) => originals.set(path,track));
  tracks(model, (track,path) => {
    const original = originals.get(path);
    if (!original || onGlobalClock(original)) return;
    const sequence = stand;
    const [from, to] = interval(sequence);
    for (const key of original.Keys) if (key.Frame >= from && key.Frame <= to) {
      track.Keys.push({ ...key, Frame: Math.round(start+(key.Frame-from)*(end-start)/(to-from)) });
    }
  });
  const root = model.Nodes.length;
  const helper: mdx.Helper = { Name:"Drill Motion", ObjectId:root, Parent:null, Flags:0, PivotPoint:new Float32Array([0,0,45]),
    Rotation:{LineType:1,GlobalSeqId:-1,Keys:[]} };
  for (const node of [...model.Bones,...model.Helpers,...model.Attachments]) if (node.Parent == null) node.Parent=root;
  model.Helpers.push(helper); model.Nodes.push(helper); model.PivotPoints.push(helper.PivotPoint);
  for (const sequence of source.Sequences) for (const Frame of sequence.Interval) helper.Rotation?.Keys.push({Frame,Vector:axis(2,0)});
  // Body turns during contact; recovery decelerates into a recognisable stance.
  for (let frame=0;frame<=frames;frame++) {
    const active = Math.max(0,Math.min(1,(frame-first)/Math.max(1,last-first)));
    const entry = smooth(Math.min(1,frame/Math.max(1,first)));
    const exit = smooth(Math.max(0,(frame-last)/Math.max(1,frames-last)));
    const turns = character===Character.blademaster ? 1 : 2;
    const yaw = -35*entry+360*turns*active+35*exit;
    helper.Rotation?.Keys.push({Frame:Math.round(start+frame*1000/60),Vector:axis(2,yaw)});
  }
  const joints = ["Bone_Arm1_R","Bone_Arm1_L","Bone_Leg1_R","Bone_Leg1_L","Bone_Leg2_R","Bone_Leg2_L"];
  for (const name of joints) {
    const original = [...source.Bones, ...source.Helpers].find(n=>n.Name===name);
    const node = [...model.Bones, ...model.Helpers].find(n=>n.Name===name);
    ensure(original && node, `${fighter.name}: missing articulated joint ${name}`);
    ensure(original.Rotation && node.Rotation && !onGlobalClock(original.Rotation), `${name}: joint needs a local rotation track`);
    const base = original.Rotation.Keys.find(k=>k.Frame>=standStart && k.Frame<=standEnd)?.Vector ?? new Float32Array([0,0,0,1]);
    const rotation = node.Rotation;
    node.Rotation=rotation;
    rotation.Keys=rotation.Keys.filter(k=>k.Frame<start);
    for(let frame=0;frame<=frames;frame++) {
      const entry=smooth(Math.min(1,frame/Math.max(1,first))), exit=1-smooth(Math.max(0,(frame-last)/Math.max(1,frames-last)));
      const contact=Math.max(0,Math.min(1,(frame-first)/Math.max(1,last-first)));
      const pulse=frame<first || frame>last ? 0 : Math.sin(contact*Math.PI*4);
      const left=name.endsWith("_L"), arm=name.includes("Arm"), shin=name.includes("Leg2");
      const horizontal = character === Character.blademaster;
      const spread=arm ? (horizontal ? (left?45:-85) : (left?-15:20))+pulse*10 : shin ? (left?100:0)+pulse*5 : (left?-65:0)+pulse*5;
      const Vector=multiply(base,axis(1,spread*entry*exit));
      const key:mdx.AnimKeyframe={Frame:Math.round(start+frame*1000/60),Vector};
      if(rotation.LineType>1){key.InTan=new Float32Array(Vector);key.OutTan=new Float32Array(Vector);}
      rotation.Keys.push(key);
    }
  }
  const bytes=encodeVerified(parseSource(generateMDX(model)));
  const baseModel = drillBaseModel(parseSource(bytes));
  ensure(baseModel && hash(generateMDX(baseModel)) === hash(generateMDX(source)), `${fighter.name}: source prefix changed`);
  const before=new DrawnModel(generateMDX(source),1), after=new DrawnModel(bytes,1);
  for(const [clip,sequence]of source.Sequences.entries())for(const fraction of[0,0.5,1]){
    const [from,to] = interval(sequence);
    const time=(to-from)*fraction/1000;
    const a=before.triangles(clip,time,1),b=after.triangles(clip,time,1);
    ensure(a.length===b.length && a.every((v,i)=>Math.abs(v-(b[i]??Infinity))<0.001),`${fighter.name}/${clip}: prior body changed`);
  }
  const initial=after.triangles(index,first/60,1);let travel=0;
  for(let frame=first;frame<=last;frame++){
    const triangle=after.triangles(index,frame/60,1);
    ensure(triangle.length===initial.length,`${fighter.name}: drill body disappears`);
    for(let i=0;i<triangle.length;i++)travel=Math.max(travel,Math.abs((triangle[i]??0)-(initial[i]??0)));
  }
  ensure(travel>=30,`${fighter.name}: no visible drill motion (${travel})`);
  chmodSync(join(output,fighter.source),0o644);
  await Bun.write(join(output,fighter.source),bytes);
  const moments = [0, Math.floor(first/2), first, ...[0.25, 0.5, 0.75].map(t => Math.round(first+(last-first)*t)), last, frames];
  const silhouettes = sheet(fighter.name, new DrawnModel(bytes, characterModelScale(character)),
    [1,-1].flatMap(facing => moments.map(frame => ({frame, facing, clip:index, seconds:frame/60,
      phase:frame<first?AttackPhase.startup:frame<=last?AttackPhase.active:AttackPhase.recovery,
      x:0,z:0,parts:[],strikes:[]}))), moments.length);
  await Bun.write(join(output, `${fighter.name}-drill-silhouettes.png`), silhouettes.png);
  bindings.push(`  ${character}: { downAir: { index: ${index}, seconds: ${seconds((end-start)/1000)}, aligned: true } },`);
  evidence.push({character,fighter:fighter.name,source:fighter.source,index,frames,first,last,joints,travel});
  console.log(`DRILL_PASS ${fighter.name}: index ${index}, ${frames} frames, six articulated joints, travel ${travel.toFixed(1)}, ${source.Sequences.length} prior poses preserved`);
}
await Bun.write(join(project,"ts/src/game/presentation/drillClipInfo.ts"),[
  "// Generated by tools/animations/drill-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";',
  'import type { HeroClipTable } from "../sim/heroes/hero";',
  "export const DRILL_CLIPS = {",...bindings,"} as const satisfies Readonly<Record<number, HeroClipTable>>;", "",
].join("\n"));
await Bun.write(join(output,"drill-clips.json"),JSON.stringify(evidence,null,2)+"\n");
