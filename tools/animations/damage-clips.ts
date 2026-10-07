// Foreign MDX animation boundary: locally articulate each rig's existing
// joints, append clips, and preserve every shipped sequence and bone track.
import { chmodSync, cpSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/hurtboxView";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, fighters, onGlobalClock, parseSource, tracks } from "./original-clips";

const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/damage-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
mkdirSync(output, { recursive: true });
for (const family of ["animation-assets", "illidan-animation", "hero-models", "imported-models"]) {
  cpSync(join(input, family), join(output, family), { recursive: true, dereference: true });
  chmodSync(join(output, family), 0o755);
}

function pitch(q: Float32Array | Int32Array, degrees: number): Float32Array {
  const s = Math.sin(degrees * Math.PI / 360), c = Math.cos(degrees * Math.PI / 360);
  const [x = 0, y = 0, z = 0, w = 1] = q;
  return new Float32Array([c * x + s * z, c * y + s * w, c * z - s * x, c * w - s * y]);
}

// Pain travels through different body regions, rather than nine whole-body
// tilts. High recoils the face/chest; middle folds around the abdomen; low
// pulls the knees up and counterbalances the chest. Weapons inherit the arms.
function jointPitch(name: string, height: number, strength: number): number {
  const amount = [0.65, 1, 1.35][strength] ?? 1;
  const is = (pattern: RegExp) => pattern.test(name);
  if (is(/^(Bone_Root|Root)$/)) return amount * [-5, 5, -12][height]!;
  if (name === "Bone NECK") return amount * [32, 80, -50][height]!;
  if (is(/^(Bone_Chest|Chest)$/)) return amount * [12, 34, -24][height]!;
  if (is(/^(Bone_Head|Head)$/)) return amount * [-16, -28, -34][height]!;
  if (is(/^(Bone_Arm1_[LR]|UpArm[LR]|[RL]Shoulder|[RL]shoulder)$/)) return amount * [-16, -38, 22][height]!;
  if (is(/^(Bone_Arm2_[LR]|LowArm[LR]|[RL]elbow)$/)) return amount * [18, 38, 28][height]!;
  if (is(/^(Bone_Leg1_[LR]|UpperLeg[LR]|[RL]hip|Bone Front [LR] Leg01)$/)) {
    const left = /(_L|LegL|Lhip|Front L)/.test(name);
    return amount * (height === 0 ? (left ? -48 : 28) : height === 1 ? (left ? -12 : 16) : (left ? 22 : -18));
  }
  if (is(/^(Bone_Leg2_[LR]|LowerLeg[LR]|[RL]knee|Bone Front [LR] Shin01)$/)) return amount * (height === 0 ? 52 : 22);
  return 0;
}

const generated: string[] = [];
const evidence = [];
for (const [character, fighter] of fighters.entries()) {
  const source = parseSource(await Bun.file(join(input, fighter.source)).arrayBuffer());
  ensure(!source.Sequences.some(s => s.Name.startsWith("Damage Grid ")), `${fighter.name}: already contains damage grid`);
  const model = structuredClone(source);
  const stand = source.Sequences.find(s => /^stand ready$/i.test(s.Name)) ?? source.Sequences.find(s => /^stand(?:\s*-?\s*\d+)?$/i.test(s.Name));
  ensure(stand, `${fighter.name}: no standing donor`);
  const original = new Map<string, mdx.AnimVector>();
  tracks(source, (track, path) => original.set(path, track));
  let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
  const indices: number[] = [];
  const deformations: number[] = [];
  const bindings: string[] = [];
  for (let height = 0; height < 3; height++) for (let strength = 0; strength < 3; strength++) {
    const name = `${["Low", "Mid", "High"][height]} ${["Small", "Medium", "Large"][strength]}`;
    const index = model.Sequences.length, start = cursor, end = start + 400;
    cursor = end + 100;
    indices.push(index);
    model.Sequences.push({ ...stand, Name: `Damage Grid ${name}`, Interval: new Uint32Array([start, end]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
      MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
    tracks(model, (track, path) => {
      const donor = original.get(path);
      if (!donor || onGlobalClock(donor)) return;
      const keys = donor.Keys.filter(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]);
      const first = keys[0];
      if (!first) return;
      // Hold the standing donor's local transforms, then articulate its named
      // joints. Visibility/material channels retain the standing body.
      const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
      const node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
      const degrees = node ? (fighter.name === "Lich" && node.Name === "Bone_Head" ? 0 : jointPitch(node.Name, height, strength)) : 0;
      for (const [frame, recoil] of [[0, 1], [3, 1], [12, 0.85], [24, 0.75]]) {
        const transform = (q: Float32Array | Int32Array) => degrees ? pitch(q, degrees * recoil) : q.slice();
        track.Keys.push({ ...first, Frame: start + Math.round(frame! * 1000 / 60), Vector: transform(first.Vector),
          ...(first.InTan ? { InTan: transform(first.InTan) } : {}), ...(first.OutTan ? { OutTan: transform(first.OutTan) } : {}) });
      }
    });
    bindings.push(`    { index: ${index}, seconds: ${seconds(0.4)} },`);
  }
  const encoded = encodeVerified(parseSource(generateMDX(model)));
  const before = new DrawnModel(generateMDX(source), 1), after = new DrawnModel(encoded, 1);
  for (const [index, sequence] of source.Sequences.entries()) for (const t of [0, 0.5, 1]) {
    const time = (sequence.Interval[1] - sequence.Interval[0]) * t / 1000;
    const a = before.triangles(index, time, 1), b = after.triangles(index, time, 1);
    ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), `${fighter.name}/${sequence.Name}: existing pose changed`);
  }
  const idle = before.triangles(source.Sequences.indexOf(stand), 0, 1);
  for (const index of indices) {
    const pose = after.triangles(index, 0, 1);
    ensure(pose.length === idle.length && pose.length > 0, `${fighter.name}: damage body is missing`);
    let shift = 0;
    for (let i = 0; i < pose.length; i += 2) shift = Math.max(shift, Math.hypot(pose[i]! - idle[i]!, pose[i + 1]! - idle[i + 1]!));
    ensure(shift >= 8, `${fighter.name}/${model.Sequences[index]?.Name}: unreadable recoil ${shift}`);
    deformations.push(shift);
  }
  for (let a = 0; a < indices.length; a++) for (let b = a + 1; b < indices.length; b++) {
    const first = after.triangles(indices[a]!, 0, 1), second = after.triangles(indices[b]!, 0, 1);
    ensure(first.some((v, i) => Math.abs(v - second[i]!) > 2), `${fighter.name}: damage cells ${a}/${b} share a pose`);
  }
  chmodSync(join(output, fighter.source), 0o644);
  await Bun.write(join(output, fighter.source), encoded);
  generated.push(`  ${character}: [`, ...bindings, "  ],");
  evidence.push({ fighter: fighter.name, indices, deformations, existingSequences: source.Sequences.length });
  console.log(`DAMAGE_GRID_PASS ${fighter.name}: 9 distinct first-frame articulated reactions, old ${source.Sequences.length} sequences preserved`);
}
await Bun.write(join(project, "ts/src/game/presentation/damageClipInfo.ts"), [
  "// Generated by tools/animations/damage-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClip } from "../sim/heroes/hero";',
  "export const DAMAGE_CLIPS: Readonly<Record<number, readonly HeroClip[]>> = {", ...generated, "};", "",
].join("\n"));
await Bun.write(join(output, "damage-grid.json"), JSON.stringify(evidence, null, 2) + "\n");
