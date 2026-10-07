// Append movement-only gestures without changing shipped action sequences.
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
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/jump-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
mkdirSync(output, { recursive: true });
cpSync(join(input, "hero-models"), join(output, "hero-models"), { recursive: true, dereference: true });
chmodSync(join(output, "hero-models"), 0o755);
const gestures = [
  { character: Character.blademaster, poses: ["doubleJump"], flip: true },
  { character: Character.warden, poses: ["doubleJump"], flip: true },
  { character: Character.lich, poses: ["doubleJump"], flip: false },
  { character: Character.dreadlord, poses: ["jump", "doubleJump"], flip: false },
  { character: Character.shadowHunter, poses: ["jump", "doubleJump"], flip: false },
] as const;
function pitch(q: Float32Array | Int32Array, degrees: number): Float32Array {
  const s = Math.sin(degrees * Math.PI / 360), c = Math.cos(degrees * Math.PI / 360);
  const [x = 0, y = 0, z = 0, w = 1] = q;
  return new Float32Array([c*x+s*z, c*y+s*w, c*z-s*x, c*w-s*y]);
}
function tuck(name: string): number {
  if (/^(Bone_Chest|Chest|Bone NECK)$/.test(name)) return 24;
  if (/^(Bone_Head|Head)$/.test(name)) return 18;
  if (/^(Bone_Arm1_[LR]|UpArm[LR]|[RL][Ss]houlder)$/.test(name)) return -65;
  if (/^(Bone_Arm2_[LR]|LowArm[LR]|[RL]elbow)$/.test(name)) return 55;
  if (/^(Bone_Leg1_[LR]|UpperLeg[LR]|[RL]hip)$/.test(name)) return -85;
  if (/^(Bone_Leg2_[LR]|LowerLeg[LR]|[RL]knee)$/.test(name)) return 115;
  if (/^(Cylinder06|Cylinder07)$/.test(name)) return -50;
  return 0;
}
const bindings: string[] = [];
for (const gesture of gestures) {
  const fighter = fighters[gesture.character]; ensure(fighter, "missing fighter");
  const source = parseSource(await Bun.file(join(input, fighter.source)).arrayBuffer());
  ensure(!source.Helpers.some(n => n.Name === "Jump Motion"), `${fighter.name}: jump clips already authored`);
  const model = structuredClone(source);
  const stand = source.Sequences.find(s => /^stand ready$/i.test(s.Name)) ?? source.Sequences.find(s => /^stand(?:\s*-?\s*1)?$/i.test(s.Name));
  ensure(stand, `${fighter.name}: missing stand`);
  const before = new DrawnModel(generateMDX(source), 1);
  const body = before.triangles(source.Sequences.indexOf(stand), 0, 1);
  const heights = Array.from(body).filter((_, i) => i % 2 === 1);
  const centre = (Math.min(...heights) + Math.max(...heights)) / 2;
  const root = model.Nodes.length;
  const helper: mdx.Helper = { Name: "Jump Motion", ObjectId: root, Parent: null, Flags: 0,
    PivotPoint: new Float32Array([0, 0, centre]), Rotation: { LineType: 1, GlobalSeqId: -1, Keys: [] } };
  for (const node of [...model.Bones, ...model.Helpers, ...model.Attachments]) if (node.Parent == null) node.Parent = root;
  model.Helpers.push(helper); model.Nodes.push(helper); model.PivotPoints.push(helper.PivotPoint);
  for (const sequence of source.Sequences) for (const Frame of sequence.Interval) helper.Rotation?.Keys.push({ Frame, Vector: new Float32Array([0, 0, 0, 1]) });
  const originals = new Map<string, mdx.AnimVector>(); tracks(source, (t, p) => originals.set(p, t));
  let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
  bindings.push(`  ${gesture.character}: {`);
  for (const pose of gesture.poses) {
    const frames = pose === "doubleJump" ? 30 : 24;
    const start = cursor, end = start + Math.round(frames * 1000 / 60), index = model.Sequences.length;
    cursor = end + 100;
    model.Sequences.push({ ...stand, Name: `Jump Motion ${pose}`, Interval: new Uint32Array([start, end]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
      MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
    let articulated = 0;
    tracks(model, (track, path) => {
      const donor = originals.get(path); if (!donor || onGlobalClock(donor)) return;
      const key = donor.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]); if (!key) return;
      const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
      const node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
      const amount = node ? tuck(node.Name) : 0;
      if (amount) articulated++;
      for (let frame = 0; frame <= frames; frame++) {
        const t = frame / frames;
        const coil = Math.sin(Math.PI * Math.min(1, t / 0.85));
        const Vector = amount ? pitch(key.Vector, amount * coil) : key.Vector.slice();
        track.Keys.push({ ...key, Frame: start + Math.round(frame * 1000 / 60), Vector,
          ...(key.InTan ? { InTan: Vector.slice(), OutTan: Vector.slice() } : {}) });
      }
    });
    for (let frame = 0; frame <= frames; frame++) {
      const t = frame / frames;
      const progress = Math.max(0, Math.min(1, (t - 0.1) / 0.8));
      const turn = gesture.flip ? 360 * progress * progress * (3 - 2 * progress) : -18 * Math.sin(Math.PI * t);
      helper.Rotation?.Keys.push({ Frame: start + Math.round(frame * 1000 / 60), Vector: pitch(new Float32Array([0, 0, 0, 1]), turn) });
    }
    ensure(articulated >= 2, `${fighter.name}: missing jump articulation`);
    bindings.push(`    ${pose}: { index: ${index}, seconds: ${seconds((end - start) / 1000)} },`);
  }
  bindings.push("  },");
  const bytes = encodeVerified(parseSource(generateMDX(model))), after = new DrawnModel(bytes, 1);
  for (const [index, sequence] of source.Sequences.entries()) for (const fraction of [0, 0.5, 1]) {
    const time = (sequence.Interval[1] - sequence.Interval[0]) * fraction / 1000;
    const a = before.triangles(index, time, 1), b = after.triangles(index, time, 1);
    ensure(a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? Infinity)) < 0.001), `${fighter.name}/${sequence.Name}: previous clip changed`);
  }
  chmodSync(join(output, fighter.source), 0o644); await Bun.write(join(output, fighter.source), bytes);
  if (gesture.character === Character.blademaster) {
    const moments = [0, 5, 10, 15, 20, 25, 30];
    await Bun.write(join(output, "Blademaster-doubleJump.png"), sheet(fighter.name, new DrawnModel(bytes, characterModelScale(gesture.character)),
      [1, -1].flatMap(facing => moments.map(frame => ({ frame, facing, clip: source.Sequences.length, seconds: frame / 60,
        phase: AttackPhase.none, x: 0, z: 0, parts: [], strikes: [] }))), moments.length).png);
  }
  console.log(`JUMP_CLIPS_PASS ${fighter.name}: ${gesture.poses.length} movement gestures, ${source.Sequences.length} previous clips preserved`);
}
await Bun.write(join(project, "ts/src/game/presentation/jumpClipInfo.ts"), [
  "// Generated by tools/animations/jump-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClipTable } from "../sim/heroes/hero";',
  "export const JUMP_CLIPS = {", ...bindings, "} as const satisfies Readonly<Record<number, HeroClipTable>>;", "",
].join("\n"));
