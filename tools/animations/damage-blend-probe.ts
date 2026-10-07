// Native animation boundary probe: keep one interrupted clip and one pain
// pose in the same model, so Warcraft can blend its actual current skeleton.
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { DrawnModel } from "../../ts/scripts/wisp/hurtboxView";
import { encodeVerified, ensure, hash, onGlobalClock, parseSource, tracks } from "./original-clips";
import { type model as mdx } from "war3-model";
import { renumberNodes } from "../../ts/scripts/clipNodes";

const [assets, output] = process.argv.slice(2).map(p => resolve(p));
ensure(assets && output && !output.startsWith(resolve(import.meta.dir, "../..")), "usage: bun tools/animations/damage-blend-probe.ts PRIVATE_ASSETS PRIVATE_OUTPUT");
const family = join(assets, "original-clips-static-lights");
const evidence = await Bun.file(join(family, "original-clips-evidence.json")).json();
const archer = evidence.records.find((r: { fighter: string }) => r.fighter === "Archer");
ensure(archer, "Archer clip pool missing");
const source = archer.clips.find((c: { name: string }) => /^stand ready$/i.test(c.name)) ?? archer.clips.find((c: { name: string }) => /^stand$/i.test(c.name));
const attack = archer.clips.find((c: { name: string }) => c.name === "Forward Tilt");
const pain = archer.clips.find((c: { name: string }) => c.name === "Damage Grid Mid Medium");
ensure(source && pain, "Native blend probe needs stand and middle-medium pain");
const frozen = parseSource(await Bun.file(join(family, "imports/war3mapImported", pain.filename)).arrayBuffer());
const [painSequence] = frozen.Sequences;
ensure(painSequence, "Pain sequence missing");
const originalPain = new DrawnModel(encodeVerified(frozen), 1);
const helper = frozen.Helpers.find(n => n.Name === "Recovery Motion");
if (helper) {
  ensure(helper.Parent == null && helper.Flags === 0, "Probe recovery parent is not an ordinary root");
  for (const [track, identity] of [[helper.Translation, [0, 0, 0]], [helper.Rotation, [0, 0, 0, 1]], [helper.Scaling, [1, 1, 1]]] as const) {
    ensure(track && !onGlobalClock(track) && track.Keys.length > 0 && track.Keys.every(k => identity.every((v, i) => k.Vector[i] === v)),
      "Probe recovery parent changes the pain pose");
  }
  ensure(frozen.Geosets.every(g => g.Groups.every(group => !group.includes(helper.ObjectId))), "Probe skin depends on recovery parent");
  frozen.Helpers = frozen.Helpers.filter(n => n !== helper);
  for (const node of frozen.Nodes) if (node.Parent === helper.ObjectId) node.Parent = null;
  renumberNodes(frozen);
  const alignedPain = new DrawnModel(encodeVerified(frozen), 1);
  for (const t of [0, 0.05, 0.1, 0.2, 0.4]) {
    const a = originalPain.triangles(0, t, 1), b = alignedPain.triangles(0, t, 1);
    ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), "Probe helper removal changed the pain pose");
  }
}
// Presentation may advance the native animation during its blend; keep the
// target skeleton exactly at its first pain pose throughout that interval.
tracks(frozen, track => {
  if (onGlobalClock(track)) return;
  const first = track.Keys.find(k => k.Frame === painSequence.Interval[0]);
  if (!first) return;
  for (const key of track.Keys) {
    key.Vector = first.Vector.slice();
    if (first.InTan) key.InTan = first.InTan.slice();
    if (first.OutTan) key.OutTan = first.OutTan.slice();
  }
});
const probeModels: { path: string; sourceName: string; sourceSeconds: number }[] = [];
for (const donor of [source, ...(attack ? [attack] : [])]) {
  const base = parseSource(await Bun.file(join(family, "imports/war3mapImported", donor.filename)).arrayBuffer());
  ensure(isDeepStrictEqual(base.PivotPoints, frozen.PivotPoints), "Probe skeleton pivots differ");
  ensure(base.Nodes.every((n, i) => n.Name === frozen.Nodes[i]?.Name && n.Parent === frozen.Nodes[i]?.Parent), "Probe hierarchy differs");
  const model = structuredClone(base);
  model.Sequences.push({ ...painSequence, Name: "Stand Hit" });
  model.Geosets.forEach((g, i) => { const pose = frozen.Geosets[i]?.Anims[0]; if (pose) g.Anims.push(pose); });
  const targetTracks = new Map<string, mdx.AnimVector>();
  tracks(model, (t, p) => targetTracks.set(p, t));
  tracks(frozen, (t, p) => {
    if (onGlobalClock(t)) return;
    const previous = targetTracks.get(p);
    if (previous) previous.Keys.push(...structuredClone(t.Keys));
    else {
      const parts = p.slice(1).split("."), property = parts.pop();
      ensure(property, "Probe track has no property");
      let owner: object = model;
      for (const part of parts) owner = Reflect.get(owner, part);
      Reflect.set(owner, property, structuredClone(t));
    }
  });
  const bytes = encodeVerified(model);
  const before = new DrawnModel(await Bun.file(join(family, "imports/war3mapImported", donor.filename)).arrayBuffer(), 1);
  const after = new DrawnModel(bytes, 1);
  const duration = (base.Sequences[0]!.Interval[1] - base.Sequences[0]!.Interval[0]) / 1000;
  for (const t of [0, duration / 2, duration]) {
    const a = before.triangles(0, t, 1), b = after.triangles(0, t, 1);
    ensure(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.001), "Probe changed its interrupted clip");
  }
  const first = after.triangles(1, 0, 1), held = after.triangles(1, 0.1, 1);
  const painFirst = originalPain.triangles(0, 0, 1);
  ensure(first.length === painFirst.length && first.every((v, i) => Math.abs(v - painFirst[i]!) < 0.001), "Probe target changed its first pain pose");
  ensure(first.every((v, i) => Math.abs(v - held[i]!) < 0.001), "Probe pain pose moves during its blend");
  const path = join(output, `ArcherBlend-${donor.sequenceIndex}-${hash(bytes)}.mdx`);
  await Bun.write(path, bytes);
  probeModels.push({ path: `war3mapImported\\${path.split("/").at(-1)}`, sourceName: donor.name, sourceSeconds: Math.fround(duration / 2) });
  console.log(JSON.stringify({ path, sourceIndex: donor.sequenceIndex, sourceName: donor.name, animations: ["Stand", "Stand Hit"], blendSeconds: 0.05 }));
}
await Bun.write(resolve(import.meta.dir, "../../ts/src/platform/damageBlendProbeModels.ts"),
  `// Generated by smashcraft:tools/animations/damage-blend-probe.ts. Diagnostic only.\nexport const DAMAGE_BLEND_PROBE_MODELS = ${JSON.stringify(probeModels, null, 2)} as const;\n`);
