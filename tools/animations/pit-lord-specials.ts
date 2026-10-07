import { chmodSync, cpSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel, type PoseFrame, sheet } from "../../ts/scripts/wisp/hurtboxView";
import { characterModelScale } from "../../ts/src/game/presentation/modelScale";
import { AttackPhase, Character } from "../../ts/src/game/sim/codes";
import { PIT_LORD_SPECIALS } from "../../ts/src/game/sim/heroes/pitLordSpecials";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";

const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/pit-lord-specials.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
mkdirSync(output, { recursive: true });
cpSync(join(input, "hero-models"), join(output, "hero-models"), { recursive: true, dereference: true });
const file = "hero-models/heropitlord.mdx";
const source = parseSource(await Bun.file(join(input, file)).arrayBuffer());
const model = structuredClone(source);
const stand = source.Sequences.find(s => /^stand$/i.test(s.Name));
ensure(stand, "Pit Lord needs his standing pose");
type Pose = Readonly<Record<string, number>>;
const ready: Pose = {};
const gestures = [
  { slot: "neutral", name: "Howl of Terror", first: 15, last: 18,
    prepare: { chest: 22, head: 15, arm: -25, elbow: 40, front: -15, shin: 30 },
    active: { chest: -24, head: -28, arm: -95, elbow: -20, front: 12, back: -10 } },
  { slot: "side", name: "Ruin Charge", first: 19, last: 26,
    prepare: { chest: 35, head: -10, arm: 25, elbow: 35, front: -40, back: -45, shin: 65 },
    active: { waist: 10, chest: 45, head: -30, arm: 35, elbow: 10, front: 45, back: -45, shin: -20 } },
  { slot: "up", name: "Abyssal Leap", first: 13, last: 18,
    prepare: { waist: 8, chest: 25, head: 15, arm: -30, elbow: 50, front: -55, back: -55, shin: 90 },
    active: { waist: -12, chest: -35, head: -15, arm: -90, elbow: 15, front: -85, back: 20, shin: -35 } },
  { slot: "down", name: "Rain of Fire", first: 25, last: 37,
    prepare: { chest: -22, head: -30, arm: -145, elbow: 20, front: -10, back: 12 },
    active: { chest: 28, head: 15, arm: -55, elbow: 20, front: 18, back: -12 } },
] as const;

function degrees(name: string, pose: Pose): number {
  const part = name === "Bone Koto Waist01" ? "waist" : name === "Bone_Chest" ? "chest"
    : name === "Bone_Head" ? "head" : /^Bone_Arm1_/.test(name) ? "arm"
      : /^Bone_Arm2_/.test(name) ? "elbow" : /^Bone Front [LR] Leg01$/.test(name) ? "front"
        : /^Bone Back [LR] Leg01$/.test(name) ? "back" : /^Bone (Front|Back) [LR] Shin01$/.test(name) ? "shin" : "";
  return pose[part] ?? 0;
}

function pitch(q: Float32Array | Int32Array, angle: number): Float32Array {
  const s = Math.sin(angle * Math.PI / 360), c = Math.cos(angle * Math.PI / 360);
  const [x = 0, y = 0, z = 0, w = 1] = q;
  const v = new Float32Array([c*x+s*z, c*y+s*w, c*z-s*x, c*w-s*y]);
  const norm = Math.hypot(...v);
  for (let i = 0; i < v.length; i++) v[i] = v[i]! / norm;
  return v;
}

const bindings: string[] = [], frames: PoseFrame[] = [], modified = new Set<number>();
for (const g of gestures) {
  const total = PIT_LORD_SPECIALS[g.slot].ground.endFrame;
  const name = `Special ${g.name}`, existing = source.Sequences.findIndex(s => s.Name === name);
  const index = existing < 0 ? model.Sequences.length : existing;
  const start = existing < 0 ? Math.max(...model.Sequences.map(s => s.Interval[1])) + 100 : model.Sequences[index]!.Interval[0];
  const end = start + Math.round(total * 1000 / 60);
  modified.add(index);
  model.Sequences[index] = { ...stand, Name: name, Interval: new Uint32Array([start, end]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 400]), BoundsRadius: 450 };
  const originals = new Map<string, mdx.AnimVector>();
  tracks(source, (t, p) => originals.set(p, t));
  tracks(model, (track, path) => {
    const donor = originals.get(path);
    if (!donor || onGlobalClock(donor)) return;
    const first = donor.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]);
    if (!first) return;
    track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end);
    const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
    const poses: readonly (readonly [number, Pose])[] = [[0, ready], [g.first - 4, g.prepare], [g.first, g.active], [g.last, g.active], [total - 5, ready], [total, ready]];
    for (const [frame, pose] of poses) {
      const angle = node ? degrees(node.Name, pose) : 0;
      const Vector = angle ? pitch(first.Vector, angle) : first.Vector.slice();
      const tangent = () => match || track.LineType === mdx.LineType.Bezier ? Vector.slice() : new Float32Array(Vector.length);
      track.Keys.push({ ...first, Frame: start + Math.round(frame * 1000 / 60), Vector, ...first.InTan ? { InTan: tangent(), OutTan: tangent() } : {} });
    }
  });
  for (const facing of [1, -1]) for (const frame of [g.first - 4, g.first, total - 5]) frames.push({ frame, phase: frame < g.first ? AttackPhase.startup : frame <= g.last ? AttackPhase.active : AttackPhase.recovery, x: 0, z: 0, facing, parts: [], strikes: [], clip: index, seconds: frame / 60 });
  const clip = `{ index: ${index}, seconds: ${seconds((end-start)/1000)}, aligned: true }`;
  bindings.push(`  ${g.slot}Special: ${clip}, ${g.slot}SpecialAir: ${clip},`);
}
const bytes = encodeVerified(parseSource(generateMDX(model)));
const before = new DrawnModel(generateMDX(source), 1), after = new DrawnModel(bytes, 1);
for (const [clip, s] of source.Sequences.entries()) if (!modified.has(clip)) for (const t of [0, 0.5, 1]) {
  const time = (s.Interval[1] - s.Interval[0]) * t / 1000;
  const a = before.triangles(clip, time, 1), b = after.triangles(clip, time, 1);
  ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), `${s.Name}: previous pose changed`);
}
chmodSync(join(output, file), 0o644);
await Bun.write(join(output, file), bytes);
const view = sheet("Pit Lord specials", new DrawnModel(bytes, characterModelScale(Character.pitLord)), frames, 6);
await Bun.write(join(output, "pit-lord-specials.png"), view.png);
await Bun.write(join(project, "ts/src/game/presentation/heroes/pitLordClipInfo.ts"), [
  "// Generated by tools/animations/pit-lord-specials.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClipTable } from "../../sim/heroes/hero";',
  "export const PIT_LORD_SPECIAL_CLIPS = {", ...bindings, "} as const satisfies HeroClipTable;", "",
].join("\n"));
console.log(`Pit Lord: four special clips authored; ${source.Sequences.length - [...modified].filter(i => i < source.Sequences.length).length} earlier clips preserved`);
