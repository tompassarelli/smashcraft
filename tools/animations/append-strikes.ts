import { chmodSync } from "node:fs";
import { relative, resolve } from "node:path";
import { generateMDX, parseMDL, model as mdx } from "war3-model";
import { DrawnModel } from "../../ts/scripts/wisp/hurtboxView";
import { encodeVerified, ensure, onGlobalClock, parseSource, tracks } from "./original-clips";

const NODE_LISTS = ["Bones", "Helpers", "Attachments", "Lights", "ParticleEmitters", "ParticleEmitters2", "ParticleEmitterPopcorns", "RibbonEmitters", "EventObjects", "CollisionShapes"] as const;

const [exportedArg, publishedArg, outputArg, ...names] = process.argv.slice(2);
ensure(exportedArg && publishedArg && outputArg && names.length > 0,
  "usage: bun tools/animations/append-strikes.ts EXPORTED.mdl PUBLISHED.mdx OUTPUT.mdx CLIP_NAME...");
const output = resolve(outputArg);
ensure(relative(resolve(import.meta.dir, "../.."), output).startsWith(".."), "authored models stay in private storage");

const exported = parseMDL(await Bun.file(exportedArg).text());
const publishedBytes = await Bun.file(publishedArg).arrayBuffer();
const published = parseSource(publishedBytes);
const model = structuredClone(published);

const nodePath = (path: string, from: mdx.Model) => {
  const anim = /^\.GeosetAnims\.(\d+)(\..+)$/.exec(path);
  if (anim) return `GeosetAnims:${from.GeosetAnims[Number(anim[1])]!.GeosetId}${anim[2]}`;
  const match = /^\.(\w+)\.(\d+)(\..+)$/.exec(path);
  if (!match || !(NODE_LISTS as readonly string[]).includes(match[1]!)) return path;
  const list = (from as unknown as Record<string, { Name: string }[]>)[match[1]!]!;
  return `${match[1]}:${list[Number(match[2])]!.Name}${match[3]}`;
};
const targets = new Map<string, mdx.AnimVector>();
tracks(model, (track, path) => targets.set(nodePath(path, model), track));
const owners = new Map<string, { owner: Record<string, unknown>; key: string }>();
for (const list of NODE_LISTS) for (const node of (model as unknown as Record<string, Record<string, unknown>[] | undefined>)[list] ?? [])
  for (const key of ["Translation", "Rotation", "Scaling", "Visibility"]) owners.set(`${list}:${node.Name}.${key}`, { owner: node, key });

const stand = published.Sequences.find(s => s.Name === "Stand Ready");
ensure(stand, "published model has no Stand Ready");
let cursor = Math.max(...published.Sequences.map(s => s.Interval[1])) + 100;
const added: { index: number; source: mdx.Sequence; start: number }[] = [];
for (const name of names) {
  ensure(!published.Sequences.some(s => s.Name === name), `${name} is already published`);
  const source = exported.Sequences.find(s => s.Name === name);
  ensure(source, `exported model has no ${name}`);
  const [from, to] = source.Interval, offset = cursor - from;
  const sourceTracks = new Map<string, mdx.AnimVector>();
  tracks(exported, (track, path) => { if (!onGlobalClock(track)) sourceTracks.set(nodePath(path, exported), track); });
  for (const [path, track] of sourceTracks) {
    const keys = track.Keys.filter(k => k.Frame >= from && k.Frame <= to).map(k => ({ ...structuredClone(k), Frame: k.Frame + offset }));
    if (keys.length === 0) continue;
    let target = targets.get(path);
    if (target === undefined) {
      const slot = owners.get(path);
      ensure(slot, `${name}: no published track for ${path}`);
      target = { ...structuredClone(track), Keys: [] };
      slot.owner[slot.key] = target;
      targets.set(path, target);
    }
    target.Keys.push(...keys);
  }
  for (const [path, track] of targets) {
    if (onGlobalClock(track) || sourceTracks.has(path) || track.Keys.some(k => k.Frame >= cursor)) continue;
    const rest = track.Keys.find(k => k.Frame >= stand.Interval[0] && k.Frame <= stand.Interval[1]);
    if (rest === undefined) continue;
    for (const Frame of [cursor, cursor + to - from]) track.Keys.push({ ...structuredClone(rest), Frame });
  }
  added.push({ index: model.Sequences.length, source, start: cursor });
  model.Sequences.push({ ...structuredClone(stand), Name: name, Interval: new Uint32Array([cursor, cursor + to - from]), NonLooping: true, MoveSpeed: 0, Rarity: 0,
    MinimumExtent: new Float32Array(source.MinimumExtent), MaximumExtent: new Float32Array(source.MaximumExtent), BoundsRadius: Math.fround(source.BoundsRadius) });
  cursor += to - from + 100;
}

const bytes = encodeVerified(model);
const before = new DrawnModel(publishedBytes, 1), after = new DrawnModel(bytes, 1), authored = new DrawnModel(generateMDX(exported), 1);
for (const [index, s] of published.Sequences.entries()) for (const t of [0, 0.5, 1]) {
  const time = (s.Interval[1] - s.Interval[0]) * t / 1000, a = before.triangles(index, time, 1), b = after.triangles(index, time, 1);
  ensure(a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? Infinity)) < 0.001), `${s.Name}: published clip changed`);
}
let largest = 0;
for (const { index, source } of added) {
  const sourceIndex = exported.Sequences.indexOf(source), frames = Math.round((source.Interval[1] - source.Interval[0]) * 60 / 1000);
  for (let frame = 0; frame <= frames; frame++) {
    const a = authored.triangles(sourceIndex, frame / 60, 1), b = after.triangles(index, frame / 60, 1);
    ensure(a.length === b.length, `${source.Name} frame ${frame}: visible triangle count differs from the authored export`);
    for (let i = 0; i < a.length; i++) largest = Math.max(largest, Math.abs(a[i]! - b[i]!));
  }
}
ensure(largest < 0.01, `appended clips differ from the authored export by ${largest}`);
await Bun.write(output, bytes);
chmodSync(output, 0o644);
console.log(`APPEND_STRIKES_PASS ${added.map(a => `${a.source.Name}=${a.index}`).join(", ")}; ${published.Sequences.length} published clips preserved; max ${largest.toFixed(5)} units from the export`);
