import { resolve, relative } from 'node:path';
import { Effect } from 'effect';
import { parseMDX } from '../../ts/scripts/clipNodes';
import { CAIRNE_DE_PAIRS, checkBodySkin, checkRetarget, generateHdBody, parseHdBody, retargetHd } from './hd-retarget';
import { timelineBody } from './timeline-body';
import { flashableSequences } from './white-flash-keys';
import { thinKeys } from '../../ts/scripts/keyThin';
import { fighters } from './original-clips';
import { victoryAnimation } from '../../ts/src/game/presentation/matchAudio';

const [sourcePath, stockPath, outputPath, ...options] = process.argv.slice(2);
const option = (name: string) => { const index = options.indexOf(name); return index < 0 ? undefined : options[index + 1]; };
const character = Number(option('--character') ?? 16);
const rigPath = option('--rig');
const fighter = fighters.get(character);
if (fighter === undefined) throw new Error(`Unknown fighter ${character}`);
if (sourcePath === undefined || stockPath === undefined || outputPath === undefined) {
    throw new Error('usage: bun tools/animations/hd-models.ts AUTHORED.mdx STOCK_DEFINITIVE.mdx PRIVATE_OUTPUT.mdx [--character ID --rig PAIRS.ts]');
}
if (character !== 16 && rigPath === undefined) throw new Error('Every fighter needs its registered literal rig mapping');
const output = resolve(outputPath);
if (!relative(resolve(import.meta.dir, '../..'), output).startsWith('..')) throw new Error('HD bodies stay in private storage');
await Effect.runPromise(Effect.tryPromise({ try: async () => {
    const source = parseMDX(await Bun.file(sourcePath).arrayBuffer());
    const hd = parseHdBody(await Bun.file(stockPath).arrayBuffer());
    const rig = rigPath === undefined ? { pairs: CAIRNE_DE_PAIRS } : await import(resolve(rigPath));
    const pairs = rig.pairs as readonly (readonly [string, string])[];
    if (!Array.isArray(pairs) || pairs.length === 0) throw new Error('Rig module must export a nonempty pairs array');
    const skin = checkBodySkin(hd);
    const normalize = (name: string) => name.replace(/\s+\d+$/, '').replaceAll(/\s+/g, '').toLowerCase();
    const victory = normalize(victoryAnimation(character));
    const selected = new Set(flashableSequences(character, source.Sequences));
    for (const sequence of source.Sequences) if (normalize(sequence.Name) === victory) selected.add(sequence);
    const sequences = source.Sequences.filter(sequence => selected.has(sequence));
    const result = retargetHd(source, hd, pairs, sequences, rig.visibilityPairs);
    const converted = checkRetarget(result);
    if (converted.units > 0.5 || converted.degrees > 0.5) throw new Error(`${fighter.name} retarget exceeds 0.5/0.5: ${JSON.stringify(converted)}`);
    for (const collision of result.model.CollisionShapes) delete result.model.Nodes[collision.ObjectId];
    result.model.CollisionShapes = [];
    const thinned = thinKeys(result.model, { position: 0.45, rotationDegrees: 0.45 });
    const timeline = timelineBody(thinned.model, sequences);
    const bytes = generateHdBody(timeline);
    const exportedSkin = checkBodySkin(parseHdBody(bytes));
    if (skin.geosets !== exportedSkin.geosets || skin.vertices !== exportedSkin.vertices) throw new Error('Definitive export changed the mesh count');
    const measured = checkRetarget({ ...result, samples: result.samples.map(sample => ({ ...sample, sequence: 0 })) }, bytes);
    if (measured.units > 0.5 || measured.degrees > 0.5) throw new Error(`${fighter.name} timeline exceeds 0.5/0.5: ${JSON.stringify(measured)}`);
    await Bun.write(output, bytes);
    console.log(JSON.stringify({ fighter: fighter.name, character, sequences: sequences.length, joints: result.mapped, skin: exportedSkin, converted, thinning: thinned.report, timeline: measured,
        importReason: 'Authored moves cannot be played on the unmodified stock Definitive model.', output }));
}, catch: cause => new Error(`Definitive ${fighter.name} export failed`, { cause }) }));
