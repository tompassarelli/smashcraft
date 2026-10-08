// Foreign MDX boundary: append paired gestures to the existing rig. Simulation
// owns the pair's positions and release; local joints supply the silhouette.
import { chmodSync, cpSync, lstatSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { generateMDX, model as mdx } from "war3-model";
import { AttackStyle, Character } from "../../ts/src/game/sim/codes";
import { heroDefinition } from "../../ts/src/game/sim/heroes/registry";
import { attackDurationFramesForGrounding, attackStartupFrames, characterAttackActiveFrames, PUMMEL_CONTACT_FRAME } from "../../ts/src/game/sim/moves";
import { seconds } from "./asset-info";
import { encodeVerified, ensure, fighters, onGlobalClock, parseSource, tracks } from "./original-clips";

const [input, output] = process.argv.slice(2, 4).map(p => resolve(p));
const characterAt = process.argv.indexOf("--character");
const selectedCharacter = characterAt < 0 ? undefined : Number(process.argv[characterAt + 1]);
ensure(selectedCharacter === undefined || Number.isInteger(selectedCharacter) && selectedCharacter >= 3 && selectedCharacter < fighters.length,
  "--character takes an expansion fighter's character code");
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/grab-clips.ts PRIVATE_ASSETS PRIVATE_OUTPUT [--character ID]");
const metadata = join(project, "ts/src/game/presentation/grabClipInfo.ts");
// The mesh evaluator imports production pose selection, which reads this
// generated table even during the first authoring run.
if (!await Bun.file(metadata).exists()) await Bun.write(metadata, 'import type { HeroClipTable } from "../sim/heroes/hero";\nexport const GRAB_CLIPS: Readonly<Record<number, HeroClipTable>> = {};\n');
const { DrawnModel } = await import("../../ts/scripts/wisp/hurtboxView");
mkdirSync(output, { recursive: true });
for (const family of ["hero-models", "imported-models"]) {
  ensure(lstatSync(join(output, family), { throwIfNoEntry: false })?.isSymbolicLink() !== true, `${family}: output must be a private real directory`);
  cpSync(join(input, family), join(output, family), { recursive: true, dereference: true });
  chmodSync(join(output, family), 0o755);
}

interface Gesture { readonly chest: number; readonly head: number; readonly grip: number; readonly elbow: number; readonly free: number; readonly knee: number; readonly twist: number }
const held: Gesture = { chest: 12, head: -8, grip: -72, elbow: -15, free: 18, knee: 9, twist: -8 };
const captive: Gesture = { chest: -24, head: -18, grip: -18, elbow: 46, free: -32, knee: 16, twist: 12 };
const neutral: Gesture = { chest: 0, head: 0, grip: 0, elbow: 0, free: 0, knee: 0, twist: 0 };
interface Action { readonly pose: string; readonly first: Gesture; readonly coil: Gesture; readonly contact: Gesture; readonly last: Gesture; readonly hold?: boolean }
const gesture = (base: Gesture, change: Partial<Gesture>): Gesture => ({ ...base, ...change });
const actions: readonly Action[] = [
  { pose: "grab", first: neutral, coil: gesture(held, { chest: -12, grip: -30 }), contact: held, last: neutral },
  { pose: "grabHold", first: held, coil: held, contact: held, last: held, hold: true },
  { pose: "grabbed", first: captive, coil: captive, contact: captive, last: captive, hold: true },
  { pose: "pummel", first: held, coil: gesture(held, { chest: -14, free: -60, twist: -22 }), contact: gesture(held, { chest: 30, free: -100, elbow: 30, twist: 24 }), last: held },
  { pose: "victimPummel", first: captive, coil: captive, contact: gesture(captive, { chest: 48, head: -40, grip: -45, knee: 28 }), last: captive },
  { pose: "throwForward", first: held, coil: gesture(held, { chest: -18, grip: -38, twist: -28 }), contact: gesture(held, { chest: 36, grip: -100, elbow: -8, free: -72, twist: 30 }), last: neutral },
  { pose: "victimThrowForward", first: captive, coil: gesture(captive, { chest: 36 }), contact: gesture(captive, { chest: -46, head: -34, grip: -95, free: -65, knee: 40, twist: -16 }), last: neutral },
  { pose: "throwBack", first: held, coil: gesture(held, { chest: -14, grip: -118, free: -70, twist: -32 }), contact: gesture(held, { chest: -32, grip: -180, free: -148, twist: 70, knee: 24 }), last: gesture(neutral, { chest: -8, twist: 95 }) },
  { pose: "victimThrowBack", first: captive, coil: gesture(captive, { chest: -28, grip: -110, knee: 48 }), contact: gesture(captive, { chest: -68, grip: -156, free: -130, knee: 68, twist: -50 }), last: neutral },
  { pose: "throwUp", first: held, coil: gesture(held, { chest: 30, grip: -46, knee: 32 }), contact: gesture(held, { chest: -22, grip: -168, elbow: -5, free: -140, head: -25, knee: 0 }), last: gesture(neutral, { grip: -35 }) },
  { pose: "victimThrowUp", first: captive, coil: gesture(captive, { chest: 35, knee: 48 }), contact: gesture(captive, { chest: -30, grip: -168, free: -145, knee: 8, head: -42 }), last: neutral },
  { pose: "throwDown", first: held, coil: gesture(held, { chest: -18, grip: -148, free: -98 }), contact: gesture(held, { chest: 66, grip: -36, free: -32, elbow: -5, knee: 36, head: 12 }), last: gesture(neutral, { chest: 12, knee: 10 }) },
  { pose: "victimThrowDown", first: captive, coil: gesture(captive, { chest: -24, grip: -118, knee: 45 }), contact: gesture(captive, { chest: 76, head: -8, grip: -40, free: 36, knee: 70, twist: 25 }), last: neutral },
];

function blend(a: Gesture, b: Gesture, t: number): Gesture {
  const v = (key: keyof Gesture) => a[key] * (1 - t) + b[key] * t;
  return { chest: v("chest"), head: v("head"), grip: v("grip"), elbow: v("elbow"), free: v("free"), knee: v("knee"), twist: v("twist") };
}
function phasesFor(action: Action, character: number): readonly { readonly at: number; readonly pose: Gesture }[] {
  const moves = heroDefinition(character)?.moves;
  const duration = attackDurationFramesForGrounding(AttackStyle.grab, true, moves);
  const contact = action.pose === "grab" ? attackStartupFrames(AttackStyle.grab, moves) / duration : 0.5;
  const activeEnd = action.pose === "grab" ? contact + characterAttackActiveFrames(character, AttackStyle.grab, moves) / duration : 0.6;
  const coil = action.pose === "grab" ? Math.max(0, contact - 2 / duration)
    : action.pose === "victimPummel" ? contact - contact / PUMMEL_CONTACT_FRAME : 0.3;
  // Frostmourne's guard otherwise obscures the reaching shoulder at contact.
  const contactPose = character === Character.lichKing && action.pose === "grab" ? gesture(action.contact, { chest: 18 }) : action.contact;
  return [{ at: 0, pose: action.first }, { at: coil, pose: action.coil }, { at: contact, pose: contactPose }, { at: activeEnd, pose: contactPose }, { at: 1, pose: action.last }];
}
function at(action: Action, character: number, t: number): Gesture {
  if (action.hold) return action.first;
  const phases = phasesFor(action, character);
  const a = phases.findLast(p => p.at <= t), b = phases.find(p => p.at >= t);
  ensure(a && b, "Gesture sample outside its phases");
  return blend(a.pose, b.pose, a.at === b.at ? 0 : (t - a.at) / (b.at - a.at));
}
function rotate(q: Float32Array | Int32Array, pitch: number, yaw = 0): Float32Array {
  const y = pitch * Math.PI / 360, z = yaw * Math.PI / 360;
  const a = [-Math.sin(y) * Math.sin(z), Math.sin(y) * Math.cos(z), Math.cos(y) * Math.sin(z), Math.cos(y) * Math.cos(z)];
  const [x = 0, v = 0, w = 0, s = 1] = q;
  return new Float32Array([a[3]! * x + a[0]! * s + a[1]! * w - a[2]! * v,
    a[3]! * v - a[0]! * w + a[1]! * s + a[2]! * x,
    a[3]! * w + a[0]! * v - a[1]! * x + a[2]! * s,
    a[3]! * s - a[0]! * x - a[1]! * v - a[2]! * w]);
}
function articulation(name: string, pose: Gesture, fighter: string): [number, number] {
  // Different bodies keep their characteristic mechanics: dwarves drive a
  // compact shoulder, agile fighters twist, heavy fighters commit the chest.
  const heavy = fighter === "PitLord" || fighter === "Beastmaster" ? 1.15 : fighter === "MountainKing" ? 0.85 : 1;
  const agile = fighter === "Warden" || fighter === "Blademaster" || fighter === "ShadowHunter" ? 1.2 : 1;
  // The classic Lich's arm chains use mesh names: the two shoulder cylinders
  // parent the upper-arm meshes and their hand meshes, rather than Bone_Arm*.
  if (fighter === "Lich") {
    if (name === "Mesh01") return [pose.chest * 0.7, pose.twist];
    if (name === "Cylinder07") return [pose.grip, 0];
    if (name === "Cylinder06") return [pose.free, 0];
    if (name === "Mesh05") return [pose.elbow, 0];
    if (name === "Mesh04") return [-pose.elbow * 0.5, 0];
  }
  if (/^(Bone_Chest|Chest)$/.test(name)) return [pose.chest * heavy, pose.twist * agile];
  if (name === "Bone NECK") return [pose.chest * 1.35, pose.twist];
  if (/^(Bone_Head|Head)$/.test(name)) return [fighter === "Lich" ? 0 : pose.head, 0];
  if (/^(Bone_Arm1_L|UpArmL|Lshoulder)$/.test(name)) return [pose.grip, 0];
  if (/^(Bone_Arm1_R|UpArmR|RShoulder)$/.test(name)) return [pose.free, 0];
  if (/^(Bone_Arm2_L|LowArmL|Lelbow)$/.test(name)) return [pose.elbow, 0];
  if (/^(Bone_Arm2_R|LowArmR|Relbow)$/.test(name)) return [-pose.elbow * 0.5, 0];
  if (/^(Bone_Leg1_[LR]|UpperLeg[LR]|[RL]hip|Bone Front [LR] Leg01)$/.test(name)) return [/(_L|LegL|Lhip|Front L)/.test(name) ? -pose.knee : pose.knee * 0.35, 0];
  if (/^(Bone_Leg2_[LR]|LowerLeg[LR]|[RL]knee)$/.test(name)) return [pose.knee, 0];
  return [0, 0];
}

const generated: string[] = [], evidence = [];
for (const [character, fighter] of fighters.entries()) {
  // His own rig carries his paired grabs.
  if (character < 3 || character === Character.uther) continue;
  const source = parseSource(await Bun.file(join(input, fighter.source)).arrayBuffer());
  const stand = source.Sequences.find(s => /^stand ready$/i.test(s.Name)) ?? source.Sequences.find(s => /^stand(?:\s*-?\s*\d+)?$/i.test(s.Name));
  ensure(stand, `${fighter.name}: standing donor missing`);
  const model = structuredClone(source), originals = new Map<string, mdx.AnimVector>();
  tracks(source, (track, path) => originals.set(path, track));
  let cursor = Math.max(...source.Sequences.map(s => s.Interval[1])) + 100;
  const bindings: string[] = [], indices: number[] = [];
  const rewritten = new Set<number>();
  for (const action of actions) {
    const existing = model.Sequences.findIndex(s => s.Name === `Paired Grab ${action.pose}`);
    const index = existing < 0 ? model.Sequences.length : existing;
    const start = existing < 0 ? cursor : model.Sequences[index]!.Interval[0];
    const end = existing < 0 ? start + 1000 : model.Sequences[index]!.Interval[1];
    cursor = end + 100; indices.push(index);
    const alignment = action.pose === "grab" ? " aligned: true," : action.hold ? "" : ` contact: ${seconds(0.5)},`;
    bindings.push(`    ${action.pose}: { index: ${index}, seconds: ${seconds(1)},${alignment} },`);
    if (existing >= 0 && selectedCharacter !== undefined && selectedCharacter !== character) continue;
    rewritten.add(index);
    if (existing < 0) model.Sequences.push({ ...stand, Name: `Paired Grab ${action.pose}`, Interval: new Uint32Array([start, end]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
      MinimumExtent: new Float32Array([-300, -300, -200]), MaximumExtent: new Float32Array([300, 300, 350]), BoundsRadius: 400 });
    tracks(model, (track, path) => {
      const donor = originals.get(path);
      if (!donor || onGlobalClock(donor)) return;
      const first = donor.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]);
      if (!first) return;
      if (existing >= 0) track.Keys = track.Keys.filter(k => k.Frame < start || k.Frame > end);
      const match = /^\.(Bones|Helpers)\.(\d+)\.Rotation$/.exec(path);
      const node = match ? source[match[1] as "Bones" | "Helpers"][Number(match[2])] : undefined;
      for (const { at: t } of phasesFor(action, character)) {
        const [pitch, yaw] = node ? articulation(node.Name, at(action, character, t), fighter.name) : [0, 0];
        const transform = (q: Float32Array | Int32Array) => pitch || yaw ? rotate(q, pitch, yaw) : q.slice();
        const Vector = transform(first.Vector);
        if (match) {
          // Imported rotation keys can be quantized below unit length;
          // spherical interpolation then moves even between equal keys.
          const norm = Math.hypot(...Vector);
          ensure(norm > 0, `${fighter.name}/${node?.Name}: zero rotation quaternion`);
          for (let i = 0; i < Vector.length; i++) Vector[i] = Vector[i]! / norm;
        }
        // Donor handles describe its old motion. Flat handles keep held
        // gestures still and ease between the newly authored local poses.
        const tangent = () => match || track.LineType === mdx.LineType.Bezier ? Vector.slice() : new Float32Array(Vector.length);
        track.Keys.push({ ...first, Frame: start + Math.round(t * (end - start)), Vector,
          ...(first.InTan ? { InTan: tangent() } : {}), ...(first.OutTan ? { OutTan: tangent() } : {}) });
      }
      if (existing >= 0) track.Keys.sort((a, b) => a.Frame - b.Frame);
    });
  }
  const encoded = encodeVerified(parseSource(generateMDX(model)));
  const before = new DrawnModel(generateMDX(source), 1), after = new DrawnModel(encoded, 1);
  for (const [index, s] of source.Sequences.entries()) for (const t of [0, 0.5, 1]) {
    if (rewritten.has(index)) continue;
    const time = (s.Interval[1] - s.Interval[0]) * t / 1000, a = before.triangles(index, time, 1), b = after.triangles(index, time, 1);
    ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), `${fighter.name}/${s.Name}: existing pose changed`);
  }
  const contactPoses: Float32Array[] = [], motions: number[] = [];
  for (const [offset, action] of actions.entries()) {
    const index = indices[offset]!, first = after.triangles(index, 0, 1), contact = after.triangles(index, 0.5, 1);
    ensure(first.length > 0 && first.length === contact.length, `${fighter.name}/${action.pose}: missing body`);
    let motion = 0;
    for (let frame = 1; frame <= 60; frame++) {
      const pose = after.triangles(index, frame / 60, 1);
      ensure(pose.length === first.length, `${fighter.name}/${action.pose}: body disappears`);
      for (let i = 0; i < first.length; i += 2) motion = Math.max(motion, Math.hypot(pose[i]! - first[i]!, pose[i + 1]! - first[i + 1]!));
    }
    if (action.hold) ensure(motion < 0.001, `${fighter.name}/${action.pose}: the held pose drifts (${motion})`);
    else ensure(motion >= 8, `${fighter.name}/${action.pose}: no readable local action (${motion})`);
    motions.push(motion);
    if (/^(victim)?[Tt]hrow/.test(action.pose)) contactPoses.push(contact);
  }
  for (let a = 0; a < contactPoses.length; a++) for (let b = a + 1; b < contactPoses.length; b++) ensure(contactPoses[a]!.some((v, i) => Math.abs(v - contactPoses[b]![i]!) > 4), `${fighter.name}: throw contacts ${a}/${b} have the same silhouette`);
  chmodSync(join(output, fighter.source), 0o644);
  await Bun.write(join(output, fighter.source), encoded);
  generated.push(`  ${character}: {`, ...bindings, "  },");
  evidence.push({ fighter: fighter.name, indices, motions, existingSequences: source.Sequences.length });
  console.log(`PAIRED_GRAB_PASS ${fighter.name}: 13 articulated clips, 8 distinct throw contacts; old ${source.Sequences.length} sequences preserved`);
}
await Bun.write(metadata, [
  "// Generated by tools/animations/grab-clips.ts; regenerate instead of editing.",
  'import { f32 } from "wisp/src/sim/f32";', 'import type { HeroClipTable } from "../sim/heroes/hero";',
  "export const GRAB_CLIPS = {", ...generated, "} as const satisfies Readonly<Record<number, HeroClipTable>>;", "",
].join("\n"));
await Bun.write(join(output, "paired-grabs.json"), JSON.stringify(evidence, null, 2) + "\n");
