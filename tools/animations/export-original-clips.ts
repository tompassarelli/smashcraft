// Original-sequence clip models for the pooled fighter presentation, and the
// TypeScript module that names them. The clips derive from the original
// fighter models, so they stay in private storage outside the checkout.
// Usage: bun tools/animations/export-original-clips.ts --assets PRIVATE_ASSETS --out OUTPUT
//   [--extractor CASC_EXTRACT --storage WARCRAFT_DIR] [--metadata-only | --keep-unchanged]
// --metadata-only checks OUTPUT's retained clips against the current sources
// and writes only the module. --keep-unchanged keeps OUTPUT's retained clips
// (hash-checked) for each fighter whose source is unchanged and exports the rest. With --extractor and --storage, a hero's stock
// model missing from PRIVATE_ASSETS/hero-models is first extracted there from
// the game's archives (the CascLib extractor smashcraft:tools/animations/extract.sh builds).
import {join, resolve, relative} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {generateMDX, model as mdx} from 'war3-model';
import {attackGestureBaseModel, swordGestureBaseModel, wardenFanBaseModel, damageBaseModel, downAirBaseModel, drillBaseModel, grabBaseModel, jumpBaseModel, locomotionBaseModel, pounceBaseModel, pitLordSpecialBaseModel, recoveryBaseModel} from './recovery-model';
import {seconds} from './asset-info';
import {mkdirSync} from 'node:fs';
import {fighters, ensure, hash, parseSource, encodeVerified, tracks, verifyPreservedBody, removeBodyEffects,
    originalBodyClip, splitStaticLights, staticLightGate, onGlobalClock} from './original-clips';
import {misplacedNodes} from '../../ts/scripts/clipNodes';
import {KEY_BOUND, savedKeyBytes, thinKeys, type KeyThinReport} from '../../ts/scripts/keyThin';

const project = resolve(import.meta.dir, '../..');
const option = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const assetsOption = option('--assets'), outputOption = option('--out');
const extractor = option('--extractor'), storage = option('--storage');
ensure(assetsOption !== undefined && outputOption !== undefined,
    'usage: bun tools/animations/export-original-clips.ts --assets PRIVATE_ASSETS --out OUTPUT [--metadata-only]');
const assets = resolve(assetsOption), output = resolve(outputOption);
ensure(relative(project, output).startsWith('..'), 'Clips derive from the original models: write them outside the checkout');
const metadataOnly = process.argv.includes('--metadata-only');
const keepUnchanged = process.argv.includes('--keep-unchanged');
// --only A,B exports just those fighters' clips and evidence, for parallel exports merged by a later --keep-unchanged run.
const only = option('--only')?.split(',');
const retained = metadataOnly || keepUnchanged ? await Bun.file(join(output, 'original-clips-evidence.json')).json() : null;
const moduleClips: string[][] = [], moduleNames: string[][] = [], moduleLights: (string | null)[] = [];
const clipLiteral = (modelPath: string, interval: readonly number[], looping: boolean, timeline = false) =>
    `{ modelPath: ${JSON.stringify(modelPath)}, startSeconds: ${seconds(Number((interval[0] / 1000).toFixed(3)))}, endSeconds: ${seconds(Number((interval[1] / 1000).toFixed(3)))}, looping: ${looping}${timeline ? ", timeline: true" : ""} },`;
const records = [], keyThinRows: string[] = [];
let totalBytes = 0, theoreticalFullSourceBytes = 0, theoreticalUntrimmedBodyBytes = 0;
const started = performance.now();
for (const [character, fighter] of fighters) {
    if (only !== undefined && !only.includes(fighter.name)) continue;
    const sourcePath = join(assets, fighter.source);
    if (fighter.stock !== undefined && !await Bun.file(sourcePath).exists()) {
        ensure(extractor !== undefined && storage !== undefined, `${fighter.name}: ${sourcePath} is missing; pass --extractor and --storage to extract ${fighter.stock}`);
        mkdirSync(join(sourcePath, '..'), {recursive: true});
        const run = Bun.spawnSync([extractor, storage, fighter.stock, sourcePath], {stderr: 'pipe'});
        ensure(run.exitCode === 0, `${fighter.name}: extracting ${fighter.stock} failed: ${run.stderr.toString().trim()}`);
    }
    const bytes = await Bun.file(join(assets, fighter.source)).arrayBuffer();
    const sourceSha256 = hash(bytes), original = parseSource(bytes);
    const retainedRecord = retained?.records.find((record: {fighter: string}) => record.fighter === fighter.name);
    const retainedThin = isDeepStrictEqual(retainedRecord?.keyThin?.bound, KEY_BOUND);
    if (metadataOnly) ensure(retainedRecord?.sourceSha256 === sourceSha256 && retainedThin, `${fighter.name}: retained clips have a different source or key bound`);
    const reuse = metadataOnly || (keepUnchanged && retainedThin && retainedRecord?.sourceSha256 === sourceSha256);
    // Clips are cut from the source with redundant transform keys removed (#314).
    const thin = reuse ? {model: original, report: retainedRecord.keyThin.report as KeyThinReport} : thinKeys(original);
    const source = thin.model;
    // An additive recovery pass leaves old clips unchanged. Admit the cache
    // only when removing its identity helper/suffix reconstructs the exact
    // previously exported input bytes; changed base art takes the full path.
    const base = !reuse && keepUnchanged && retainedThin && retainedRecord ? attackGestureBaseModel(original) ?? swordGestureBaseModel(original) ?? locomotionBaseModel(original) ?? pounceBaseModel(original) ?? wardenFanBaseModel(original) ?? pitLordSpecialBaseModel(original) ?? jumpBaseModel(original) ?? downAirBaseModel(original) ?? grabBaseModel(original) ?? drillBaseModel(original) ?? damageBaseModel(original) ?? recoveryBaseModel(original) : undefined;
    const reusePrefix = base && hash(generateMDX(base)) === retainedRecord.sourceSha256 ? base.Sequences.length : 0;
    if (reusePrefix) console.log(`${fighter.name}: exact base SHA retained, exporting ${source.Sequences.length - reusePrefix} added clips`);
    const components = splitStaticLights(source);
    let light: {filename: string, modelPath: string, sha256: string, bytes: number} | null = null;
    if (components.lights) {
        ensure(misplacedNodes(components.lights).length === 0, `${fighter.name}: light nodes ${misplacedNodes(components.lights).join('; ')}`);
        const encoded = encodeVerified(components.lights), sha256 = hash(encoded);
        const filename = `${fighter.name}OriginalLight-${sha256}.mdx`;
        light = {filename, modelPath: `war3mapImported\\${filename}`, sha256, bytes: encoded.byteLength};
        if (reuse || reusePrefix > 0) {
            ensure(isDeepStrictEqual(retainedRecord.light, light), `${fighter.name}: retained light metadata differs`);
            ensure(hash(await Bun.file(join(output, 'imports/war3mapImported', filename)).arrayBuffer()) === sha256,
                `${fighter.name}: retained light bytes differ`);
        } else await Bun.write(join(output, 'imports/war3mapImported', filename), encoded);
    } else if (reuse || reusePrefix > 0) ensure(retainedRecord.light === null, `${fighter.name}: unexpected retained light`);
    const bodySource = structuredClone(components.body);
    removeBodyEffects(bodySource);
    const sourceTracks = new Map<string, mdx.AnimVector>();
    tracks(bodySource, (track, path) => sourceTracks.set(path, track));
    const trackFamilies = [...new Set([...sourceTracks.keys()].map(path => path.replace(/\.\d+/g, '.*')))];
    const omittedTrackFamilies = new Set<string>();
    const untrimmedBytes = encodeVerified(originalBodyClip(components.body, 0, 'untrimmed-reference').model).byteLength;
    theoreticalFullSourceBytes += bytes.byteLength * source.Sequences.length;
    theoreticalUntrimmedBodyBytes += untrimmedBytes * source.Sequences.length;
    const clips = [];
    let fighterBytes = light?.bytes ?? 0, unthinnedBytes = light?.bytes ?? 0;
    const fighterClips: string[] = [];
    const countedClips = new Set<string>();
    moduleClips[character] = fighterClips;
    moduleLights[character] = light?.modelPath ?? null;
    for (let index = 0; index < source.Sequences.length; index++) {
        if (reuse || index < reusePrefix) {
            const clip = retainedRecord.clips[index];
            ensure(clip.sequenceIndex === index && clip.name === source.Sequences[index].Name,
                `${fighter.name}/${index}: retained sequence metadata differs`);
            ensure(hash(await Bun.file(join(output, 'imports/war3mapImported', clip.filename)).arrayBuffer()) === clip.sha256,
                `${fighter.name}/${index}: retained clip bytes differ`);
            fighterClips.push(clipLiteral(clip.modelPath, clip.interval, clip.looping, clip.timeline));
            clips.push(clip);
            if (!countedClips.has(clip.filename)) {
                fighterBytes += clip.bytes;
                unthinnedBytes += clip.unthinnedBytes;
                countedClips.add(clip.filename);
            }
            continue;
        }
        const result = originalBodyClip(components.body, index);
        const {model, ...stats} = result;
        verifyPreservedBody(source, model);
        ensure(misplacedNodes(model).length === 0, `${fighter.name}/${index}: ${misplacedNodes(model).join('; ')}`);
        ensure(model.Lights.length === 0, `${fighter.name}/${index}: body clip still owns illumination`);
        ensure(isDeepStrictEqual(model.Sequences[0], {...source.Sequences[index], Name: 'Stand'}), `${fighter.name}/${index}: source sequence changed`);
        ensure(isDeepStrictEqual(model.Info, source.Info), `${fighter.name}/${index}: source model metadata changed`);
        const outputTracks = new Map<string, mdx.AnimVector>();
        tracks(model, (track, path) => outputTracks.set(path, track));
        const expectedOmissions: string[] = [];
        for (const [path, original] of sourceTracks) {
            const keys = onGlobalClock(original) ? original.Keys : original.Keys.filter(key => key.Frame >= result.interval[0] && key.Frame <= result.interval[1]);
            if (keys.length) {
                ensure(isDeepStrictEqual(outputTracks.get(path), {...original, Keys: keys}),
                    `${fighter.name}/${index}${path}: retained track missing or changed`);
            } else {
                ensure(!outputTracks.has(path), `${fighter.name}/${index}${path}: zero-key animation chunk remains`);
                const alpha = /^\.GeosetAnims\.(\d+)\.Alpha$/.exec(path);
                const color = /^\.GeosetAnims\.(\d+)\.Color$/.exec(path);
                const layerAlpha =/^\.Materials\.(\d+)\.Layers\.(\d+)\.Alpha$/.exec(path);
                if (alpha) ensure(model.GeosetAnims[Number(alpha[1])].Alpha === 1, `${fighter.name}/${index}${path}: static backing changed`);
                else if (layerAlpha) ensure(model.Materials[Number(layerAlpha[1])].Layers[Number(layerAlpha[2])].Alpha === 1,
                    `${fighter.name}/${index}${path}: static backing changed`);
                else if (color) ensure(isDeepStrictEqual(model.GeosetAnims[Number(color[1])].Color, new Float32Array([1, 1, 1])),
                    `${fighter.name}/${index}${path}: static backing changed`);
                // Absent attachment visibility keeps the attachment shown.
                else if (!/^\.Attachments\.\d+\.Visibility$/.test(path)) ensure(/^\.(Bones|Helpers|Attachments|CollisionShapes)\.\d+\.(Translation|Rotation|Scaling)$/.test(path), `${path}: unchecked empty-channel backing`);
                expectedOmissions.push(path);
                omittedTrackFamilies.add(path.replace(/\.\d+/g, '.*'));
            }
        }
        ensure([...outputTracks.keys()].every(path => sourceTracks.has(path)), `${fighter.name}/${index}: unexpected track added`);
        ensure(isDeepStrictEqual(result.omittedEmptyTracks, expectedOmissions), `${fighter.name}/${index}: omission coverage mismatch`);
        const encoded = encodeVerified(model), sha256 = hash(encoded);
        const filename = `${fighter.name}OriginalClip${index}-${sha256}.mdx`;
        const modelPath = `war3mapImported\\${filename}`;
        await Bun.write(join(output, 'imports/war3mapImported', filename), encoded);
        const clipUnthinnedBytes = encoded.byteLength + savedKeyBytes(original, source, result.interval);
        fighterBytes += encoded.byteLength;
        unthinnedBytes += clipUnthinnedBytes;
        fighterClips.push(clipLiteral(modelPath, result.interval, result.looping));
        clips.push({...stats, filename, modelPath, sha256, bytes: encoded.byteLength, unthinnedBytes: clipUnthinnedBytes});
    }
    // Names without a numeric variant choose the first authored variant. This
    // makes rollback selection stable; native random variant parity is separate.
    const names = new Map<string, number>();
    source.Sequences.forEach((sequence, index) => names.set(sequence.Name.toLowerCase(), index));
    source.Sequences.forEach((sequence, index) => {
        const family = sequence.Name.toLowerCase().replace(/\s*-?\s*\d+$/, '').trim();
        if (!names.has(family)) names.set(family, index);
    });
    moduleNames[character] = [...names].map(([name, index]) => `[${JSON.stringify(name)}, ${index}],`);
    ensure(hash(await Bun.file(join(assets, fighter.source)).arrayBuffer()) === sourceSha256, `${fighter.name}: source changed during export`);
    totalBytes += fighterBytes;
    records.push({fighter: fighter.name, source: fighter.source, sourceSha256, sourceBytes: bytes.byteLength,
        untrimmedSelectedBodyBytes: untrimmedBytes, bytes: fighterBytes, unthinnedBytes, keyThin: {bound: KEY_BOUND, report: thin.report}, trackFamilies,
        omittedTrackFamilies: reuse ? retainedRecord.omittedTrackFamilies : [...omittedTrackFamilies], light, clips});
    if (reuse) unthinnedBytes = retainedRecord.unthinnedBytes;
    const r = thin.report;
    keyThinRows.push([fighter.name, r.keysBefore, r.keysAfter, unthinnedBytes, fighterBytes, r.maxPosition.toFixed(4), r.maxRotationDegrees.toFixed(4)].join('\t'));
    console.log(`${fighter.name}: keys ${r.keysBefore} -> ${r.keysAfter}, ${unthinnedBytes - fighterBytes} bytes saved (${unthinnedBytes} -> ${fighterBytes}), max ${r.maxPosition.toFixed(3)} units, ${r.maxRotationDegrees.toFixed(3)} deg`);
    console.log(`${fighter.name}: ${clips.length} clips, ${fighterBytes} bytes; ${reuse ? 'retained source/clip hashes' : 'exact original-key and MDX checks'} PASS`);
}
const lightCases = moduleLights.flatMap((path, character) => path === null ? [] : [`  if (character === ${character}) return ${JSON.stringify(path)};`]);
const typescript = [
    '// Generated by tools/animations/export-original-clips.ts from the original fighter models; regenerate instead of editing.',
    '// The original-model clip pool: one model per original sequence, so a clip plays by setting its time.',
    'import { f32 } from "wisp/src/sim/f32";',
    '',
    'export interface FighterOriginalClip {',
    '  readonly modelPath: string;',
    '  readonly timeline?: boolean;',
    '  readonly startSeconds: number;',
    '  readonly endSeconds: number;',
    '  readonly looping: boolean;',
    '}',
    '',
    '/** The light model\'s animation while its fighter is shown, and while hidden. */',
    `export const ORIGINAL_LIGHT_ACTIVE_ANIMATION = ${JSON.stringify(staticLightGate.activeAnimation)};`,
    `export const ORIGINAL_LIGHT_INACTIVE_ANIMATION = ${JSON.stringify(staticLightGate.inactiveAnimation)};`,
    `export const ORIGINAL_LIGHT_GATE_SECONDS = ${seconds(staticLightGate.seconds)};`,
    '',
    '/** Each character\'s clips by original sequence index. */',
    'const CLIPS: ReadonlyMap<number, readonly FighterOriginalClip[]> = new Map([',
    ...moduleClips.flatMap((clips, character) => [`  // ${fighters.get(character)!.name}`, `  [${character}, [`, ...clips.map(line => `    ${line}`), '  ]],' ]),
    ']);',
    '',
    '/** Each character\'s lowercase original sequence names; a name without its numeric variant selects the first variant. */',
    'const NAMED: ReadonlyMap<number, ReadonlyMap<string, number>> = new Map([',
    ...moduleNames.flatMap((names, character) => [`  // ${fighters.get(character)!.name}`, `  [${character}, new Map<string, number>([`, ...names.map(line => `    ${line}`), '  ])],']),
    ']);',
    '',
    '/** Clips 0 to count - 1 exist for this character. */',
    'export function originalClipCount(character: number): number {',
    '  return CLIPS.get(character)?.length ?? 0;',
    '}',
    '',
    '/** The light model that accompanies this character\'s clips, if it has one. */',
    'export function originalLightPath(character: number): string | undefined {',
    ...lightCases,
    '  return undefined;',
    '}',
    '',
    '/** The clip for an original sequence index; times are seconds within the clip. */',
    'export function originalClip(character: number, sequenceIndex: number): FighterOriginalClip | undefined {',
    '  return CLIPS.get(character)?.[sequenceIndex];',
    '}',
    '',
    '/** The sequence index of an original sequence name, such as "walk alternate". */',
    'export function originalClipNamed(character: number, name: string): number | undefined {',
    '  return NAMED.get(character)?.get(name);',
    '}',
];
const metadataPath = join(project, 'ts/src/game/assets/fighterOriginalClipInfo.ts');
if (only === undefined) await Bun.write(metadataPath, typescript.join('\n') + '\n');
else {
    let current = await Bun.file(metadataPath).text();
    ensure(current.includes('const CLIPS: Readonly<Record'), 'Narrow export expects the production Record clip tables');
    for (const [character, clips] of moduleClips.entries()) if (clips !== undefined) {
        const replaceRow = (label: string, row: string, close: string) => {
            const start = current.indexOf(`const ${label}:`), end = current.indexOf('\n};', start);
            ensure(start >= 0 && end > start, `Missing ${label} table`);
            const section = current.slice(start, end).replace(new RegExp(`\\n  ${character}: [\\s\\S]*?\\n  ${close},`), '');
            current = current.slice(0, start) + section + `\n${row}` + current.slice(end);
        };
        replaceRow('CLIPS', `  ${character}: [\n${clips.map(line => `    ${line}`).join('\n')}\n  ],`, '\\]');
        replaceRow('NAMED', `  ${character}: new Map<string, number>([\n${moduleNames[character]!.map(line => `    ${line}`).join('\n')}\n  ]),`, '\\]\\)');
        const path = moduleLights[character];
        current = current.replace(new RegExp(`\\n  if \\(character === ${character}\\) return [^\\n]+;`), '');
        if (path) current = current.replace('export function originalLightPath(character: number): string | undefined {', `export function originalLightPath(character: number): string | undefined {\n  if (character === ${character}) return ${JSON.stringify(path)};`);
    }
    await Bun.write(metadataPath, current);
    const fixturePath = join(project, 'ts/test/fixtures/key-thin.tsv');
    const fixture = await Bun.file(fixturePath).text();
    const names = new Set(records.map(record => record.fighter));
    await Bun.write(fixturePath, [...fixture.trimEnd().split('\n').filter(line => !names.has(line.split('\t')[0]!)), ...keyThinRows].join('\n') + '\n');
}
if (only === undefined) await Bun.write(join(project, 'ts/test/fixtures/key-thin.tsv'), ['# Generated by tools/animations/export-original-clips.ts: each fighter\'s clip keys and bytes before and after key thinning (#314), and the posed skeleton\'s largest drift.',
    'fighter\tkeysBefore\tkeysAfter\tbytesBefore\tbytesAfter\tmaxPosition\tmaxRotationDegrees', ...keyThinRows].join('\n') + '\n');
if (!metadataOnly) await Bun.write(join(output, 'original-clips-evidence.json'), JSON.stringify({
    status: 'full-roster-structural-checks-pass-static-light-visibility-gate-native-pending',
    policy: 'Out-of-interval keys and emptied animation chunks removed; retained keys, order, tangents, interpolation, sequence flags and times unchanged. Required original static backing retained. Zero-key chunks require an explicit diagnostic mode. Global-clock tracks kept whole; unsupported empty-channel backing semantics rejected. Events, particles and ribbons omitted. Independent static lights extracted once per fighter with original illumination and remapped node/pivot tables; reversible visibility gate added. Animated or parented lights rejected.',
    staticLightGate,
    nativeEvidence: {omissionRun: '20261002102859948', selectedSourceComparisons: 26, selectedSourceComparisonsExact: 26,
        separateZeroLightIntensityRun: '20261002103744679', sourceComparisonsExact: 12, illidanRestorationsExact: 4,
        independentStaticLightRun: '20261002131240774', independentStaticLightComparisonsExact: 18},
    nativeLimits: ['Native fidelity covers the selected diagnostic clips and times, not all 223 source sequences.',
        'The standalone light visibility gate still requires native verification.',
        'Full-roster resident memory, creation cost and replay restoration latency have not been measured.'],
    sequenceCount: records.reduce((count, record) => count + record.clips.length, 0), totalBytes,
    theoreticalFullSourceBytes, theoreticalUntrimmedBodyBytes,
    reductionFromFullSourcePercent: 100 * (1 - totalBytes / theoreticalFullSourceBytes),
    records: only === undefined || retained === null ? records : [...retained.records.filter((record: {fighter: string}) => !only.includes(record.fighter)), ...records],
}, null, 2) + '\n');
console.log(`ORIGINAL_CLIP_EXPORT_PASS ${totalBytes}/${theoreticalFullSourceBytes} bytes in ${((performance.now() - started) / 1000).toFixed(2)}s; full-roster native coverage remains unproven`);
