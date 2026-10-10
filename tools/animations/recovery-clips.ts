

import { chmodSync, cpSync, lstatSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/hurtboxView";
import { Character } from "../../ts/src/game/sim/codes";
import { authoredPhysics } from "../../ts/src/game/sim/tuning";
import { seconds } from "./asset-info";
import { RECOVERY_CLIPS } from "../../ts/src/game/presentation/recoveryClipInfo";
import { fighters, ensure, parseSource, tracks, onGlobalClock, encodeVerified } from "./original-clips";

const [assets, output] = process.argv.slice(2).map(p => resolve(p));
const metadataOnly = process.argv.includes("--metadata-only");
const characterAt=process.argv.indexOf("--character"),selected=characterAt<0?undefined:Number(process.argv[characterAt+1]);
ensure(selected===undefined||selected===Character.dreadlord,"--character supports Dreadlord's recovery attacks (8)");
ensure(assets && output, "usage: bun tools/animations/recovery-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
const project = resolve(import.meta.dir, "../..");
ensure(relative(project, output).startsWith(".."), "Derived models must stay outside the checkout");
mkdirSync(output, { recursive: true });
for (const family of metadataOnly ? [] : ["animation-assets", "hero-models"]) {
  ensure(lstatSync(join(output, family), { throwIfNoEntry: false })?.isSymbolicLink() !== true,
    `${family}: staging must contain real directories, never input-store links`);
  cpSync(join(assets, family), join(output, family), { recursive: true, dereference: true });
  chmodSync(join(output, family), 0o755);
}

interface Phase { readonly at: number; readonly roll?: number; readonly yaw?: number; readonly lean?: number; readonly tuck?: number; readonly height?: number }
interface Action { readonly pose: string; readonly frames: number; readonly phases: readonly Phase[]; readonly airborne?: boolean; readonly attack?: boolean }
const roll = (sign: number, down = false): readonly Phase[] => [
  { at: 0, roll: down ? sign * 90 : 0, tuck: down ? 0.25 : 0 },
  { at: 0.14, roll: sign * 30, tuck: 0.28 },
  { at: 0.35, roll: sign * 135, tuck: 0.3 },
  { at: 0.65, roll: sign * 265, tuck: 0.3 },
  { at: 0.86, roll: sign * 350, tuck: 0.18 },
  { at: 1, roll: sign * 360, tuck: 0 },
];
function actions(character: number): Action[] {
  const transitions: Action[] = [
    { pose: "turn", frames: 8, phases: [{ at: 0, yaw: 180 }, { at: 0.4, yaw: 110, lean: -15 }, { at: 1, yaw: 0 }] },
    { pose: "stop", frames: 8, phases: [{ at: 0, lean: -20 }, { at: 0.4, lean: -25, tuck: 0.12 }, { at: 1 }] },
    { pose: "jumpSquat", frames: authoredPhysics(character).jumpSquatFrames, phases: [{ at: 0 }, { at: 0.6, tuck: 0.28, lean: 15 }, { at: 1, tuck: 0.3, lean: 12 }] },
    { pose: "airDodge", frames: 49, airborne: true, phases: [{ at: 0 }, { at: 0.08, tuck: 0.25, lean: -32 }, { at: 0.55, tuck: 0.25, lean: -32 }, { at: 1, lean: -10 }] },
    { pose: "tech", frames: 26, phases: [{ at: 0, roll: 85, tuck: 0.2 }, { at: 0.3, roll: 50, tuck: 0.35 }, { at: 0.65, roll: -10, tuck: 0.16 }, { at: 1 }] },
    { pose: "techForward", frames: 40, phases: roll(-1, true) },
    { pose: "techBackward", frames: 40, phases: roll(1, true) },
    { pose: "getUpRollForward", frames: 35, phases: roll(-1, true) },
    { pose: "getUpRollBackward", frames: 35, phases: roll(1, true) },
  ];
  if (character < 3) return transitions;
  return [...transitions,
    { pose: "rollForward", frames: 31, phases: roll(-1) },
    { pose: "rollBackward", frames: 31, phases: roll(1) },
    { pose: "spotDodge", frames: 22, phases: [{ at: 0 }, { at: 0.1, lean: -35, tuck: 0.22 }, { at: 0.7, lean: -35, tuck: 0.22 }, { at: 1 }] },
    { pose: "getUp", frames: 30, phases: [{ at: 0, roll: 90 }, { at: 0.3, roll: 70, tuck: 0.2 }, { at: 0.75, roll: 15, tuck: 0.1 }, { at: 1 }] },
    { pose: "getUpAttack", frames: 49, attack: true, phases: [{ at: 0, roll: 90 }, { at: 0.2, roll: 65 }, { at: 16 / 49, roll: 15, yaw: 0 }, { at: 19 / 49, roll: 15, yaw: 180 }, { at: 0.65, roll: 8, yaw: 180 }, { at: 1, yaw: 360 }] },
    { pose: "ledgeClimb", frames: 25, phases: [{ at: 0, lean: 65, height: -60 }, { at: 0.45, lean: 30, height: -15 }, { at: 1 }] },
    { pose: "ledgeRoll", frames: 36, phases: roll(-1, true) },
    { pose: "ledgeAttack", frames: 40, attack: true, phases: [{ at: 0, lean: 65, height: -60 }, { at: 0.3, lean: 20, height: -10 }, { at: 0.5, lean: 15 }, { at: 1 }] },
  ];
}
function phaseAt(phases: readonly Phase[], t: number): Required<Omit<Phase, "at">> {
  const a = phases.findLast(p => p.at <= t) ?? phases[0];
  const b = phases.find(p => p.at >= t) ?? phases.at(-1);
  ensure(a && b, "Empty motion phases");
  const blend = a.at === b.at ? 0 : (t - a.at) / (b.at - a.at);
  const v = (key: keyof Omit<Phase, "at">) => (a[key] ?? 0) * (1 - blend) + (b[key] ?? 0) * blend;
  return { roll: v("roll"), yaw: v("yaw"), lean: v("lean"), tuck: v("tuck"), height: v("height") };
}
function quaternion(y: number, z: number): Float32Array {
  const a = y * Math.PI / 360, b = z * Math.PI / 360;
  return new Float32Array([-Math.sin(a) * Math.sin(b), Math.sin(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.cos(a) * Math.cos(b)]);
}
const generated: string[] = [];
const records: unknown[] = [];
for (const [character, fighter] of fighters.entries()) {
  if(selected!==undefined&&character!==selected){
    const retained=RECOVERY_CLIPS[character as keyof typeof RECOVERY_CLIPS];
    if(retained)generated.push(`  ${character}: {`,...Object.entries(retained).map(([pose,clip])=>`    ${pose}: { index: ${clip.index}, seconds: ${seconds(clip.seconds)} },`),"  },");
    continue;
  }
  if (character === Character.demonHunter || character === Character.lichKing || character === Character.forsakenPaladin) continue;
  if (metadataOnly) {
    const model = parseSource(await Bun.file(join(output, fighter.source)).arrayBuffer());
    const bindings = actions(character).map(action => {
      const index = model.Sequences.findIndex(s => s.Name === `Recovery ${action.pose}`);
      const sequence = model.Sequences[index];
      ensure(sequence && sequence.NonLooping, `${fighter.name}/${action.pose}: retained action is missing or looping`);
      return `    ${action.pose}: { index: ${index}, seconds: ${seconds((sequence.Interval[1] - sequence.Interval[0]) / 1000)} },`;
    });
    generated.push(`  ${character}: {`, ...bindings, "  },");
    continue;
  }
  const source = parseSource(await Bun.file(join(assets, fighter.source)).arrayBuffer());
  const model = structuredClone(source);
  const retained=source.Helpers.find(n=>n.Name==="Recovery Motion");
  ensure(!retained||character===Character.dreadlord, `${fighter.name}: use an unmodified source when regenerating`);
  const stand = source.Sequences.find(s => /^stand ready$/i.test(s.Name)) ?? source.Sequences.find(s => /^stand(?:\s*-?\s*\d+)?$/i.test(s.Name));
  const attack = source.Sequences.find(s => /^attack(?:\s*-?\s*\d+)?$/i.test(s.Name));
  ensure(stand && attack, `${fighter.name}: no standing/attack donor`);
  const preview = new DrawnModel(generateMDX(source), 1);
  const standing = preview.triangles(source.Sequences.indexOf(stand), 0, 1);
  const heights = Array.from(standing).filter((_, i) => i % 2 === 1);
  const centre = (Math.min(...heights) + Math.max(...heights)) / 2;
  const id = model.Nodes.length;
  const helper: mdx.Helper = retained?model.Helpers.find(n=>n.ObjectId===retained.ObjectId)!:{ Name: "Recovery Motion", ObjectId: id, Parent: null, Flags: 0,
    PivotPoint: new Float32Array([0, 0, centre]),
    Rotation: { LineType: 1, GlobalSeqId: -1, Keys: [] }, Translation: { LineType: 1, GlobalSeqId: -1, Keys: [] }, Scaling: { LineType: 1, GlobalSeqId: -1, Keys: [] } };
  if(!retained){
  for (const node of [...model.Bones, ...model.Helpers, ...model.Attachments]) if (node.Parent == null) node.Parent = id;
  model.Helpers.push(helper); model.Nodes.push(helper); model.PivotPoints.push(helper.PivotPoint);

  for (const s of source.Sequences) for (const Frame of s.Interval) {
    helper.Rotation?.Keys.push({ Frame, Vector: new Float32Array([0, 0, 0, 1]) });
    helper.Translation?.Keys.push({ Frame, Vector: new Float32Array([0, 0, 0]) });
    helper.Scaling?.Keys.push({ Frame, Vector: new Float32Array([1, 1, 1]) });
  }
  }
  const originalTracks = new Map<string, mdx.AnimVector>();
  tracks(source, (track, path) => originalTracks.set(path, track));
  let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
  const bindings: string[] = [];
  const authored=retained?actions(character).filter(a=>a.attack):actions(character),rewritten=new Set<number>();
  for (const action of authored) {
    const driven=character===Character.dreadlord&&action.attack;
    const donor = action.attack&&!driven ? attack : stand;
    const existing=retained?model.Sequences.findIndex(s=>s.Name===`Recovery ${action.pose}`):-1;
    const start = existing<0?cursor:model.Sequences[existing]!.Interval[0], end = existing<0?start + Math.round(action.frames * 1000 / 60):model.Sequences[existing]!.Interval[1];
    const index = existing<0?model.Sequences.length:existing;rewritten.add(index);
    cursor = end + 100;
    if(existing<0)model.Sequences.push({ ...donor, Name: `Recovery ${action.pose}`, Interval: new Uint32Array([start, end]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
      MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
    if(existing>=0)for(const track of [helper.Rotation,helper.Translation,helper.Scaling])if(track)track.Keys=track.Keys.filter(k=>k.Frame<start||k.Frame>end);
    tracks(model, (track, path) => {
      const original = originalTracks.get(path);
      if (!original || onGlobalClock(original)) return;
      if(retained&&path.startsWith(`.Helpers.${model.Helpers.indexOf(helper)}.`))return;
      if(existing>=0)track.Keys=track.Keys.filter(k=>k.Frame<start||k.Frame>end);
      if(driven&&/^\.(Bones|Helpers)\.\d+\.Rotation$/.test(path)){
        const match=/^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path)!,node=model[match[1] as "Bones"|"Helpers"][Number(match[2])]!,first=original.Keys.find(k=>k.Frame>=stand.Interval[0]&&k.Frame<=stand.Interval[1]);
        if(!first)return;
        const chest=node.Name==="Bone_Chest",pelvis=node.Name==="Bone_Pelvis",body=chest||pelvis||/^Bone_Leg[12]_[LR]$/.test(node.Name),contact=action.pose==="getUpAttack"?16:20;
        const degrees=chest?50:pelvis?30:node.Name==="Bone_Head"?-15:/^Bone_Arm1_[LR]$/.test(node.Name)?node.Name.endsWith("_R")?-75:-50:/^Bone_Arm2_[LR]$/.test(node.Name)?-25:/^Bone_Leg1_[LR]$/.test(node.Name)?-45:/^Bone_Leg2_[LR]$/.test(node.Name)?65:0;
        for(let frame=0;frame<=action.frames;frame++){
          const coil=contact-3,peak=body?contact-1:contact,amount=frame<coil?-0.8*Math.sin(frame/coil*Math.PI/2):frame<=peak?-0.8+1.8*(frame-coil)/(peak-coil):frame<contact+4?1+0.25*(frame-peak)/(contact+4-peak):1.25*Math.max(0,1-(frame-contact-4)/(action.frames-contact-4));
          const turn=quaternion(degrees*amount,0),[x=0,y=0,z=0,w=1]=first.Vector,[a=0,b=0,c=0,d=1]=turn,Vector=new Float32Array([d*x+a*w+b*z-c*y,d*y-a*z+b*w+c*x,d*z+a*y-b*x+c*w,d*w-a*x-b*y-c*z]);
          track.Keys.push({...first,Frame:start+Math.round(frame*1000/60),Vector,...first.InTan?{InTan:Vector.slice(),OutTan:Vector.slice()}:{}});
        }
        track.Keys.sort((a,b)=>a.Frame-b.Frame);return;
      }


      const channelDonor = /^\.(Bones|Helpers|Attachments|CollisionShapes)\./.test(path) ? donor : stand;
      for (const key of original.Keys) if (key.Frame >= channelDonor.Interval[0] && key.Frame <= channelDonor.Interval[1]) {
        track.Keys.push({ ...key, Frame: Math.round(start + (key.Frame - channelDonor.Interval[0]) * (end - start) / (channelDonor.Interval[1] - channelDonor.Interval[0])) });
      }
      if(existing>=0)track.Keys.sort((a,b)=>a.Frame-b.Frame);
    });
    const translation: mdx.AnimKeyframe[] = [];
    for (let frame = 0; frame <= action.frames; frame++) {
      const p = phaseAt(action.phases, frame / action.frames), Frame = Math.round(start + frame * 1000 / 60);
      helper.Rotation?.Keys.push({ Frame, Vector: quaternion(p.roll + p.lean, p.yaw) });
      helper.Scaling?.Keys.push({ Frame, Vector: new Float32Array([1, 1, 1 - p.tuck]) });
      const key = { Frame, Vector: new Float32Array([0, 0, p.height]) };
      translation.push(key); helper.Translation?.Keys.push(key);
    }
    for(const track of [helper.Rotation,helper.Translation,helper.Scaling])track?.Keys.sort((a,b)=>a.Frame-b.Frame);
    if (!action.airborne) {
      const drawn = new DrawnModel(generateMDX(model), 1);
      for (let frame = 0; frame <= action.frames; frame++) {
        const triangle = drawn.triangles(index, frame / 60, 1);
        let lowest = Infinity;
        for (let i = 1; i < triangle.length; i += 2) lowest = Math.min(lowest, triangle[i] ?? Infinity);
        ensure(Number.isFinite(lowest), `${fighter.name}/${action.pose}: invisible body`);

        const p = phaseAt(action.phases, frame / action.frames);
        translation[frame]!.Vector[2] -= lowest - p.height;
      }
    }
    bindings.push(`    ${action.pose}: { index: ${index}, seconds: ${seconds((end - start) / 1000)} },`);
  }
  if(retained){bindings.length=0;for(const action of actions(character)){const index=model.Sequences.findIndex(s=>s.Name===`Recovery ${action.pose}`),sequence=model.Sequences[index];ensure(sequence,`${action.pose}: missing retained recovery`);bindings.push(`    ${action.pose}: { index: ${index}, seconds: ${seconds((sequence.Interval[1]-sequence.Interval[0])/1000)} },`);}}


  const packaged = parseSource(generateMDX(model));
  const encoded = encodeVerified(packaged);
  const finalPreview = new DrawnModel(encoded, 1);
    for (const [index, sequence] of source.Sequences.entries()) for (const progress of [0, 0.5, 1]) {
    if(rewritten.has(index))continue;
    const time = (sequence.Interval[1] - sequence.Interval[0]) * progress / 1000;
    const before = preview.triangles(index, time, 1), after = finalPreview.triangles(index, time, 1);
    ensure(before.length === after.length && before.every((v, i) => Math.abs(v - (after[i] ?? Infinity)) < 0.001),
      `${fighter.name}/${sequence.Name}: an existing posed body changed`);
  }
  for (const action of authored) {
    const index = model.Sequences.findIndex(s=>s.Name===`Recovery ${action.pose}`);
    const first = finalPreview.triangles(index, 0, 1);
    let motion = 0;
    for (let frame = 1; frame <= action.frames; frame++) {
      const after = finalPreview.triangles(index, frame / 60, 1);
      ensure(first.length === after.length, `${fighter.name}/${action.pose}: body disappears`);
      for (let i = 0; i < first.length; i += 2) motion = Math.max(motion,
        Math.hypot((after[i] ?? 0) - (first[i] ?? 0), (after[i + 1] ?? 0) - (first[i + 1] ?? 0)));
    }
    ensure(motion >= 5, `${fighter.name}/${action.pose}: held stance instead of an action (${motion})`);
  }
  chmodSync(join(output, fighter.source), 0o644);
  await Bun.write(join(output, fighter.source), encoded);
  generated.push(`  ${character}: {`, ...bindings, "  },");
  records.push({ fighter: fighter.name, source: fighter.source, originalSequences: source.Sequences.length, appended: authored.map(a => a.pose) });
  console.log(`RECOVERY_CLIPS_PASS ${fighter.name}: ${authored.length} ${retained?"reauthored":"appended"} actions, existing ${source.Sequences.length} indices preserved`);
}
await Bun.write(join(project, "ts/src/game/presentation/recoveryClipInfo.ts"), [
  "// Generated by tools/animations/recovery-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";',
  'import { type HeroClipTable } from "../sim/heroes/hero";', "",
  "export const RECOVERY_CLIPS = {", ...generated, "} as const satisfies Readonly<Record<number, HeroClipTable>>;", "",
].join("\n"));
if (!metadataOnly) await Bun.write(join(output, "recovery-clips.json"), JSON.stringify(records, null, 2) + "\n");
