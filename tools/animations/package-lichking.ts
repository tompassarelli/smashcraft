// Foreign model boundary: splice the Lich King's authored clips (lichking.py)
// into Kwaliti's MDX. The Blender round trip drops the model's particle
// emitters and restructures its nodes, so the shipped file is the original
// model, unchanged, with each authored sequence appended after the built-ins
// (whose indices never move): skeleton keys from the authored export, and every
// other track (emitter and geoset animation, events) from the clip's donor
// built-in, scaled to the new length. Then it regenerates the clip metadata.
//   bun tools/animations/package-lichking.ts SOURCE.mdx AUTHORED_DIR OUT.mdx
import { generateMDX, parseMDL, parseMDX } from "war3-model";
import { join } from "node:path";

const [sourcePath, authoredDir, outPath] = process.argv.slice(2);
if (!sourcePath || !authoredDir || !outPath) throw new Error("usage: package-lichking.ts SOURCE.mdx AUTHORED_DIR OUT.mdx");
const model = parseMDX(await Bun.file(sourcePath).arrayBuffer());
const authored = parseMDL(await Bun.file(join(authoredDir, "LichKingFighter.mdl")).text());
const clips: { readonly authored: readonly { readonly name: string; readonly source: string }[] } = await Bun.file(join(authoredDir, "clips.json")).json();

interface Key { Frame: number; Vector: Float32Array | Int32Array; InTan?: Float32Array | Int32Array; OutTan?: Float32Array | Int32Array }
interface Track { LineType: number; GlobalSeqId: number | null; Keys: Key[] }
const isTrack = (value: unknown): value is Track =>
  typeof value === "object" && value !== null && Array.isArray((value as Track).Keys) && typeof (value as Track).LineType === "number";

const byName = (name: string) => {
  const sequence = model.Sequences.find((candidate) => candidate.Name === name);
  if (sequence === undefined) throw new Error(`source model has no ${name}`);
  return sequence;
};
/** An authored sequence's place: its interval in the Blender export, in the shipped model, and its donor's. */
const placed: { from: [number, number]; to: [number, number]; donor: [number, number] }[] = [];
const GAP = 100;
let cursor = Math.max(...model.Sequences.map((sequence) => sequence.Interval[1])) + GAP;
for (const clip of clips.authored) {
  const sequence = authored.Sequences.find((candidate) => candidate.Name === clip.name);
  if (sequence === undefined) throw new Error(`authored export has no ${clip.name}`);
  const donor = byName(clip.source);
  const length = sequence.Interval[1] - sequence.Interval[0];
  const to: [number, number] = [cursor, cursor + length];
  cursor += length + GAP;
  placed.push({ from: [sequence.Interval[0], sequence.Interval[1]], to, donor: [donor.Interval[0], donor.Interval[1]] });
  model.Sequences.push({
    ...donor, Name: clip.name, Interval: new Uint32Array(to), NonLooping: sequence.NonLooping, MoveSpeed: 0, Rarity: 0,
    // Frostmourne reaches far past the stock bounds in the authored swings.
    MinimumExtent: new Float32Array([-240, -120, -160]), MaximumExtent: new Float32Array([300, 120, 320]), BoundsRadius: 320,
  });
}

const within = (frame: number, [start, end]: readonly [number, number]) => frame >= start && frame <= end;
const scaled = (frame: number, from: readonly [number, number], to: readonly [number, number]) =>
  Math.round(to[0] + (frame - from[0]) * (to[1] - to[0]) / Math.max(1, from[1] - from[0]));

/**
 * The authored clips key every bone on every frame; keep only the keys linear
 * interpolation between kept neighbours cannot reproduce within `tolerance`
 * (per component: units, or quaternion components).
 */
function thinned(run: Key[], tolerance: number): Key[] {
  if (run.length <= 2) return run;
  const kept = [run[0]!];
  let anchor = 0;
  for (let next = 2; next < run.length; next++) {
    const a = run[anchor]!, b = run[next]!;
    const fits = run.slice(anchor + 1, next).every((key) => {
      const t = (key.Frame - a.Frame) / (b.Frame - a.Frame);
      return Array.from(key.Vector).every((value, i) => Math.abs(a.Vector[i]! + (b.Vector[i]! - a.Vector[i]!) * t - value) <= tolerance);
    });
    if (!fits) {
      anchor = next - 1;
      kept.push(run[anchor]!);
    }
  }
  kept.push(run.at(-1)!);
  return kept;
}

// Skeleton: the authored keys, node by node (the export renames a few nodes "Bone_NAME").
const skeleton = new Set<Track>();
for (const node of [...model.Bones, ...model.Helpers]) {
  const source = [...authored.Bones, ...authored.Helpers].find((candidate) => candidate.Name === node.Name || candidate.Name === `Bone_${node.Name}`);
  if (source === undefined) throw new Error(`authored export lost node ${node.Name}`);
  for (const kind of ["Translation", "Rotation"] as const) {
    const track = node[kind] as unknown as Track | undefined;
    const keys = source[kind] as unknown as Track | undefined;
    if (track === undefined || keys === undefined) throw new Error(`${node.Name} ${kind} has no keyed track to extend`);
    skeleton.add(track);
    for (const { from, to } of placed) {
      const run = keys.Keys.filter((key) => within(key.Frame, from)).map((key) => ({ ...key, Frame: to[0] + key.Frame - from[0] }));
      track.Keys.push(...thinned(run, kind === "Rotation" ? 0.002 : 0.05));
    }
  }
  const scaling = source.Scaling as unknown as Track | undefined;
  for (const key of scaling?.Keys ?? []) {
    if (Array.from(key.Vector).some((value) => Math.abs(value - 1) > 1e-3)) throw new Error(`${node.Name} scales; the shipped skeleton keys only translation and rotation`);
  }
}

// Everything else animated (emitters, geoset colour and alpha, visibility): the donor's keys, scaled.
const extend = (value: unknown, seen: Set<unknown>): void => {
  if (typeof value !== "object" || value === null || seen.has(value) || ArrayBuffer.isView(value)) return;
  seen.add(value);
  if (isTrack(value)) {
    if (skeleton.has(value) || value.GlobalSeqId !== null && value.GlobalSeqId !== undefined && value.GlobalSeqId >= 0) return;
    const original = [...value.Keys];
    for (const { to, donor } of placed) {
      for (const key of original) if (within(key.Frame, donor)) value.Keys.push({ ...key, Frame: scaled(key.Frame, donor, to) });
    }
    return;
  }
  for (const child of Object.values(value)) extend(child, seen);
};
for (const [field, value] of Object.entries(model)) if (field !== "Sequences" && field !== "EventObjects") extend(value, new Set());
for (const event of model.EventObjects) {
  const frames = Array.from(event.EventTrack ?? []);
  for (const { to, donor } of placed) for (const frame of [...frames]) if (within(frame, donor)) frames.push(scaled(frame, donor, to));
  event.EventTrack = new Uint32Array(frames);
}

const bytes = generateMDX(model);
await Bun.write(outPath, bytes);

const rows = model.Sequences.map((sequence, index) => {
  // Whole 60 Hz frames: the authored clips are keyed one per game frame.
  const frames = Math.round((sequence.Interval[1] - sequence.Interval[0]) * 60 / 1000);
  if (!(frames > 0)) throw new Error(`${sequence.Name} must have a positive duration`);
  return `  ${JSON.stringify(sequence.Name)}: { index: ${index}, frames: ${frames} },`;
});
const info = join(import.meta.dir, "../../ts/src/game/presentation/heroes/lichKingClipInfo.ts");
await Bun.write(info, [
  "// Generated by tools/animations/package-lichking.ts from the authored Lich King model; regenerate instead of editing.",
  "",
  "/** Every sequence of the Lich King's model by name: its index and length in 60 Hz frames. */",
  "export const LICH_KING_SEQUENCES = {",
  ...rows,
  "} as const;",
  "",
].join("\n"));
console.log(`Lich King model packaged: ${model.Sequences.length} sequences, ${bytes.byteLength} bytes -> ${outPath}`);
