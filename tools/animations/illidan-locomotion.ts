// Append authored Blender motion to the shipped Illidan without re-exporting older clips.
import { chmodSync, cpSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDL, generateMDX, parseMDL, parseMDX, type model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/hurtboxView";
import { ensure, onGlobalClock, parseSource, tracks } from "./original-clips";

const [assets, authored, output] = process.argv.slice(2).map(p => resolve(p));
ensure(assets && authored && output, "usage: bun tools/animations/illidan-locomotion.ts PRIVATE_ASSETS AUTHORED_DIR PRIVATE_OUTPUT");
ensure(relative(resolve(import.meta.dir, "../.."), output).startsWith(".."), "Illidan art stays outside the checkout");
mkdirSync(output, { recursive: true });
cpSync(join(assets, "illidan-animation"), output, { recursive: true, dereference: true });
const sourceBytes = await Bun.file(join(output, "DemonHunterFighter.mdx")).arrayBuffer();
const source = parseSource(sourceBytes), model = structuredClone(source);
const motion = parseMDL(await Bun.file(join(authored, "locomotion.mdl")).text());
const donor = source.Sequences.find(s => s.Name === "Combat Idle");
ensure(donor, "Illidan has no combat idle donor");
const originals = new Map<string, mdx.AnimVector>();
tracks(source, (track, path) => originals.set(path, track));
const names = ["Locomotion Walk", "Locomotion Run", "Locomotion Initial Dash Burst"];
let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
const clips = await Bun.file(join(output, "clips.json")).json() as { name: string; seconds: number }[];
for (const name of names) {
  ensure(!source.Sequences.some(s => s.Name === name), "Author against the input preceding the locomotion suffix");
  const sequence = motion.Sequences.find(s => s.Name === name);
  ensure(sequence, `${name}: Blender export missing`);
  const start = cursor, length = sequence.Interval[1] - sequence.Interval[0], end = start + length;
  cursor = end + 100;
  model.Sequences.push({ ...donor, Name: name, Interval: new Uint32Array([start, end]), NonLooping: sequence.NonLooping, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array([-200, -150, -20]), MaximumExtent: new Float32Array([200, 150, 230]), BoundsRadius: 300 });
  tracks(model, (track, path) => {
    const original = originals.get(path);
    if (!original || onGlobalClock(original)) return;
    const skeletal = /^\.(Bones|Helpers)\.(\d+)\.(Rotation|Translation|Scaling)$/.exec(path);
    const node = skeletal ? source[skeletal[1] as "Bones" | "Helpers"][Number(skeletal[2])] : undefined;
    const authoredNode = node ? motion.Nodes.find(n => n?.Name === node.Name) : undefined;
    const authoredTrack = skeletal && authoredNode ? authoredNode[skeletal[3] as "Rotation" | "Translation" | "Scaling"] : undefined;
    const run = authoredTrack?.Keys.filter(k => k.Frame >= sequence.Interval[0] && k.Frame <= sequence.Interval[1]);
    if (node && run?.length) {
      ensure(track.LineType === authoredTrack?.LineType, `${node.Name}: interpolation differs from shipped rig`);
      track.Keys.push(...run.map(k => ({ ...k, Frame: start + k.Frame - sequence.Interval[0] })));
    } else {
      const first = original.Keys.find(k => k.Frame >= donor.Interval[0] && k.Frame <= donor.Interval[1]);
      if (!first) return;
      track.Keys.push({ ...first, Frame: start }, { ...first, Frame: end });
    }
  });
  clips.push({ name, seconds: length / 1000 });
}
const bytes = generateMDX(model), before = new DrawnModel(sourceBytes, 1), after = new DrawnModel(bytes, 1);
for (const [index, sequence] of source.Sequences.entries()) for (const progress of [0, .5, 1]) {
  const seconds = (sequence.Interval[1] - sequence.Interval[0]) * progress / 1000;
  const a = before.triangles(index, seconds, 1), b = after.triangles(index, seconds, 1);
  ensure(a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? Infinity)) < .001), `${sequence.Name}: older pose changed`);
}
const packaged = parseMDX(bytes);
ensure(packaged.Sequences.length === source.Sequences.length + 3, "Three motion clips must append");
for (const file of ["DemonHunterFighter.mdx", "demonhunter-fighter.mdl", "clips.json", "bindings.json"]) chmodSync(join(output, file), 0o644);
await Bun.write(join(output, "DemonHunterFighter.mdx"), bytes);
await Bun.write(join(output, "demonhunter-fighter.mdl"), generateMDL(packaged));
await Bun.write(join(output, "clips.json"), JSON.stringify(clips, null, 2));
await Bun.write(join(output, "bindings.json"), JSON.stringify(clips.map(c => ({ ...c, index: model.Sequences.findIndex(s => s.Name === c.name) })), null, 2));
console.log("ILLIDAN_LOCOMOTION_PASS", source.Sequences.length, "old clips preserved; appended", names.join(", "));
