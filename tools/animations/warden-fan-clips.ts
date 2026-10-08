import { chmodSync, cpSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { DrawnModel, sheet } from "../../ts/scripts/wisp/hurtboxView";
import { AttackPhase, Character } from "../../ts/src/game/sim/codes";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, fighters, onGlobalClock, parseSource, tracks } from "./original-clips";

const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/warden-fan-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
mkdirSync(output, { recursive: true });
cpSync(join(input, "hero-models"), join(output, "hero-models"), { recursive: true, dereference: true });
chmodSync(join(output, "hero-models"), 0o755);
const fighter = fighters.get(Character.warden)!; ensure(fighter, "missing Warden");
const source = parseSource(await Bun.file(join(input, fighter.source)).arrayBuffer());
const model = structuredClone(source);
const stand = source.Sequences.find(s => /^stand ready$/i.test(s.Name)); ensure(stand, "missing ready stance");
const originals = new Map<string, mdx.AnimVector>(); tracks(source, (track, path) => originals.set(path, track));
function pitch(q: Float32Array | Int32Array, degrees: number): Float32Array {
  const s = Math.sin(degrees * Math.PI / 360), c = Math.cos(degrees * Math.PI / 360);
  const [x = 0, y = 0, z = 0, w = 1] = q;
  return new Float32Array([c*x+s*z, c*y+s*w, c*z-s*x, c*w-s*y]);
}
function angle(name: string, frame: number, air: boolean): number {
  const coil = frame <= 5 ? frame / 5 : frame < 9 ? (9 - frame) / 4 : 0;
  const release = frame < 5 ? 0 : frame <= 9 ? (frame - 5) / 4 : frame <= 12 ? 1 : Math.max(0, (30 - frame) / 18);
  if (name === "Bone_Chest") return -22 * coil + 14 * release;
  if (name === "Bone_Head") return -8 * coil - 10 * release;
  if (name === "Bone_Arm1_R") return -35 * coil - 95 * release;
  if (name === "Bone_Arm1_L") return -35 * coil + 85 * release;
  if (/^Bone_Arm2_[LR]$/.test(name)) return 75 * coil - 25 * release;
  if (/^Bone_Hand_[LR]$/.test(name)) return -20 * coil + 20 * release;
  if (/^Bone_Leg1_[LR]$/.test(name)) return air ? -55 * Math.max(coil, release) : -10 * coil;
  if (/^Bone_Leg2_[LR]$/.test(name)) return air ? 85 * Math.max(coil, release) : 20 * coil;
  return 0;
}
const bindings: string[] = [];
let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
for (const air of [false, true]) {
  const name = air ? "Fan of Knives Air" : "Fan of Knives Ground";
  const existing = model.Sequences.findIndex(s => s.Name === name);
  const index = existing < 0 ? model.Sequences.length : existing;
  const start = existing < 0 ? cursor : model.Sequences[index]!.Interval[0], end = start + 633;
  cursor = end + 100;
  model.Sequences[index] = { ...stand, Name: name, Interval: new Uint32Array([start, end]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array([-250, -250, -150]), MaximumExtent: new Float32Array([250, 250, 300]), BoundsRadius: 400 };
  tracks(model, (track, path) => {
    const donor = originals.get(path); if (!donor || onGlobalClock(donor)) return;
    const key = donor.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]); if (!key) return;
    track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end);
    const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
    const node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
    for (let frame = 0; frame <= 38; frame++) {
      const degrees = node ? angle(node.Name, frame, air) : 0;
      const Vector = degrees ? pitch(key.Vector, degrees) : key.Vector.slice();
      track.Keys.push({ ...key, Frame: start + Math.round(frame * 1000 / 60), Vector,
        ...(key.InTan ? { InTan: Vector.slice(), OutTan: Vector.slice() } : {}) });
    }
  });
  bindings.push(`  ${air ? "air" : "ground"}: { index: ${index}, seconds: ${seconds(0.633)} },`);
  const bytes = generateMDX(model), moments = [0, 5, 9, 11, 20, 38];
  await Bun.write(join(output, `${name.replaceAll(" ", "-")}.png`), sheet(name, new DrawnModel(bytes, 1),
    [1, -1].flatMap(facing => moments.map(frame => ({ frame, facing, clip: index, seconds: frame / 60,
      phase: AttackPhase.none, x: 0, z: 0, parts: [], strikes: [] }))), moments.length).png);
}
const bytes = encodeVerified(parseSource(generateMDX(model)));
const before = new DrawnModel(generateMDX(source), 1), after = new DrawnModel(bytes, 1);
for (const [index, sequence] of source.Sequences.entries()) {
  if (sequence.Name.startsWith("Fan of Knives ")) continue;
  for (const t of [0, 0.5, 1]) {
    const time = (sequence.Interval[1] - sequence.Interval[0]) * t / 1000;
    const a = before.triangles(index, time, 1), b = after.triangles(index, time, 1);
    ensure(a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? Infinity)) < 0.001), `${sequence.Name}: previous clip changed`);
  }
}
chmodSync(join(output, fighter.source), 0o644); await Bun.write(join(output, fighter.source), bytes);
await Bun.write(join(project, "ts/src/game/presentation/wardenFanClipInfo.ts"), [
  "// Generated by tools/animations/warden-fan-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";', "export const WARDEN_FAN_CLIPS = {", ...bindings, "} as const;", "",
].join("\n"));
console.log(`WARDEN_FAN_CLIPS_PASS ground and air; ${source.Sequences.length} existing sequences preserved`);
