import { join, relative, resolve } from 'node:path';
import { unlink } from 'node:fs/promises';
import { Effect } from 'effect';
import { encodeVerified, fighters, hash, parseSource } from './original-clips';
import { timelineBody } from './timeline-body';
import { flashableSequences } from './white-flash-keys';
import { modelFacts } from '../../ts/node_modules/wisp/scripts/wisp/models';
import { MODEL_FACTS } from '../../ts/scripts/wisp/modelFacts';
import { DrawnModel } from '../../ts/scripts/wisp/hurtboxView';

const [assetsArg, outputArg, fighterName] = process.argv.slice(2);
if (assetsArg === undefined || outputArg === undefined || fighterName === undefined) throw new Error('usage: bun tools/animations/timeline-models.ts PRIVATE_ASSETS PRIVATE_POOL FIGHTER');
const assets = resolve(assetsArg), output = resolve(outputArg);
if (!relative(resolve(import.meta.dir, '../..'), output).startsWith('..')) throw new Error('Timeline bodies stay in private storage');
const fighter = fighters.find(fighter => fighter.name === fighterName);
if (fighter === undefined) throw new Error(`Unknown fighter ${fighterName}`);
await Effect.runPromise(Effect.tryPromise({ try: async () => {
    const source = parseSource(await Bun.file(join(assets, fighter.source)).arrayBuffer());
    const played = flashableSequences(fighters.indexOf(fighter), source.Sequences);
    const bytes = encodeVerified(timelineBody(source, played));
    const baseline = await Bun.file(join(assets, 'original-clips-static-lights/original-clips-evidence.json')).json();
    const reference = baseline.records.find((record: { fighter: string }) => record.fighter === fighter.name);
    if (reference === undefined) throw new Error(`Missing clip-pool reference for ${fighter.name}`);
    const timeline = new DrawnModel(bytes, 1);
    let samples = 0, maximumDifference = 0;
    for (const sequence of played) {
        const index = source.Sequences.indexOf(sequence), clip = reference.clips[index];
        const pool = new DrawnModel(await Bun.file(join(assets, 'original-clips-static-lights/imports/war3mapImported', clip.filename)).arrayBuffer(), 1);
        const duration = (sequence.Interval[1] - sequence.Interval[0]) / 1000;
        for (let frame = 0; frame <= Math.ceil(duration * 60); frame++) for (const facing of [-1, 1]) {
            const local = Math.min(duration, frame / 60);
            const expected = pool.triangles(0, (clip.timeline ? sequence.Interval[0] / 1000 : 0) + local, facing);
            const actual = timeline.triangles(0, sequence.Interval[0] / 1000 + local, facing);
            if (actual.length !== expected.length) throw new Error(`${fighter.name}/${index} frame ${frame}: visible triangle count changed`);
            for (let coordinate = 0; coordinate < actual.length; coordinate++) maximumDifference = Math.max(maximumDifference, Math.abs(actual[coordinate] - expected[coordinate]));
            if (maximumDifference > 0.001) throw new Error(`${fighter.name}/${index} frame ${frame}: drawn pose differs by ${maximumDifference}`);
            samples++;
        }
    }
    console.log(`HEADLESS_TIMELINE_POSES_PASS ${fighter.name}: ${played.length} clips, ${samples} both-facing frame samples, max ${maximumDifference} world units versus clip pool`);
    const sha256 = hash(bytes), filename = `${fighter.name}TimelineBody-${sha256}.mdx`;
    await Bun.write(join(output, 'imports/war3mapImported', filename), bytes);
    const evidencePath = join(output, 'original-clips-evidence.json');
    const evidence = await Bun.file(evidencePath).json();
    const record = evidence.records.find((record: { fighter: string }) => record.fighter === fighter.name);
    if (record === undefined) throw new Error(`No original clips for ${fighter.name}`);
    const oldBytes = record.bytes;
    const replacedFiles = new Set<string>(record.clips.map((clip: { filename: string }) => clip.filename));
    record.clips = record.clips.map((clip: object) => ({ ...clip, filename, modelPath: `war3mapImported\\${filename}`, sha256, bytes: bytes.byteLength, timeline: true }));
    record.bytes = bytes.byteLength + (record.light?.bytes ?? 0);
    evidence.totalBytes += record.bytes - oldBytes;
    await Bun.write(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
    for (const replaced of replacedFiles) if (replaced !== filename) await unlink(join(output, 'imports/war3mapImported', replaced));
    const metadataPath = join(import.meta.dir, '../../ts/src/game/assets/fighterOriginalClipInfo.ts');
    const modelPath = `war3mapImported\\${filename}`;
    let metadata = await Bun.file(metadataPath).text();
    const prefix = `modelPath: ${JSON.stringify(`war3mapImported\\${fighter.name}`).slice(0, -1)}`;
    metadata = metadata.split('\n').map(line => line.includes(`${prefix}OriginalClip`) || line.includes(`${prefix}TimelineBody`)
        ? line.replace(/modelPath: \"[^\"]+\"/, `modelPath: ${JSON.stringify(modelPath)}`).replace(/looping: (true|false)(?:, timeline: true)? \},$/, 'looping: $1, timeline: true },') : line).join('\n');
    if (!metadata.includes('readonly timeline?: boolean;')) metadata = metadata.replace('  readonly modelPath: string;', '  readonly modelPath: string;\n  readonly timeline?: boolean;');
    await Bun.write(metadataPath, metadata);
    const facts = Object.fromEntries(Object.entries(MODEL_FACTS).filter(([path]) => !path.startsWith(`war3mapImported\\${fighter.name}OriginalClip`) && !path.startsWith(`war3mapImported\\${fighter.name}TimelineBody`)));
    facts[`war3mapImported\\${filename}`] = modelFacts(new Uint8Array(bytes));
    await Bun.write(join(import.meta.dir, '../../ts/scripts/wisp/modelFacts.ts'), [
        '// Generated by `bun wisp view models` and tools/animations/timeline-models.ts from imported and stock models.',
        '// Regenerate instead of editing.',
        'import type { ModelFacts } from "wisp/scripts/wisp/models";', '',
        'export const MODEL_FACTS: Readonly<Record<string, ModelFacts>> = {',
        ...Object.keys(facts).sort().map(path => `  ${JSON.stringify(path)}: ${JSON.stringify(facts[path])},`),
        '};', '',
    ].join('\n'));
    console.log(`${fighter.name}: ${played.length}/${record.clips.length} played clips → one timeline; ${oldBytes} → ${record.bytes} raw bytes (${oldBytes - record.bytes} saved). Original materials, geometry, lights and sound-cue intervals preserved.`);
}, catch: cause => new Error('Timeline export failed', { cause }) }));
