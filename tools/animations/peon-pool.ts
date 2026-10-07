import { mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { model as mdx } from "war3-model";
import { misplacedNodes } from "../../ts/scripts/clipNodes";
import { encodeVerified, ensure, hash, originalBodyClip, parseSource, removeBodyEffects, splitStaticLights, tracks, verifyPreservedBody } from "./original-clips";

const [input, output] = process.argv.slice(2).map(p => resolve(p));
const project = resolve(import.meta.dir, "../..");
ensure(input && output && relative(project, output).startsWith(".."), "usage: bun tools/animations/peon-pool.ts AUTHORED_PEON.mdx PRIVATE_OUTPUT");
const bytes = await Bun.file(input).arrayBuffer(), source = parseSource(bytes);
ensure(source.Sequences.length === 88, "Peon pool requires the complete authored 88-sequence model");
const components = splitStaticLights(source);
ensure(components.lights === null, "Stock Peon unexpectedly has a model light");
const bodySource = structuredClone(components.body);
removeBodyEffects(bodySource);
const sourceTracks = new Map<string, mdx.AnimVector>();
tracks(bodySource, (track, path) => sourceTracks.set(path, track));
const trackFamilies = [...new Set([...sourceTracks.keys()].map(path => path.replace(/\.\d+/g, ".*")))];
const omittedTrackFamilies = new Set<string>();
const imports = join(output, "imports/war3mapImported");
mkdirSync(imports, { recursive: true });
const clips = [];
let totalBytes = 0;
for (let index = 0; index < source.Sequences.length; index++) {
  const result = originalBodyClip(components.body, index);
  const { model, ...stats } = result;
  verifyPreservedBody(source, model);
  ensure(misplacedNodes(model).length === 0, `Peon/${index}: incorrectly numbered clip nodes`);
  const encoded = encodeVerified(model), sha256 = hash(encoded);
  const filename = `PeonOriginalClip${index}-${sha256}.mdx`;
  const modelPath = `war3mapImported\\${filename}`;
  await Bun.write(join(imports, filename), encoded);
  totalBytes += encoded.byteLength;
  for (const path of result.omittedEmptyTracks) omittedTrackFamilies.add(path.replace(/\.\d+/g, ".*"));
  clips.push({ ...stats, filename, modelPath, sha256, bytes: encoded.byteLength });
}
const record = { fighter: "Peon", source: "hero-models/peon.mdx", sourceSha256: hash(bytes), sourceBytes: bytes.byteLength,
  untrimmedSelectedBodyBytes: encodeVerified(originalBodyClip(components.body, 0, "untrimmed-reference").model).byteLength,
  bytes: totalBytes, trackFamilies, omittedTrackFamilies: [...omittedTrackFamilies], light: null, clips };
await Bun.write(join(output, "peon-original-clips-evidence.json"), JSON.stringify(record, null, 2) + "\n");
await Bun.write(join(output, "imports.json"), JSON.stringify(clips.map(clip => ({ file: `imports/war3mapImported/${clip.filename}`, entry: clip.modelPath })), null, 2) + "\n");
ensure(hash(await Bun.file(input).arrayBuffer()) === record.sourceSha256, "Peon source changed during export");
console.log(`PEON_POOL_PASS: ${clips.length} clips, ${totalBytes} bytes, original body and node checks passed`);
