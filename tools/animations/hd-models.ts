import { resolve, relative } from 'node:path';
import { Effect } from 'effect';
import { parseMDX } from '../../ts/scripts/clipNodes';
import { CAIRNE_DE_PAIRS, checkBodySkin, checkRetarget, generateHdBody, parseHdBody, retargetHd, type RetargetOptions } from './hd-retarget';
import { timelineBody } from './timeline-body';
import { flashableSequences } from './white-flash-keys';
import { thinKeys } from '../../ts/scripts/keyThin';
import { fighters } from './original-clips';
import { victoryAnimation } from '../../ts/src/game/presentation/matchAudio';

export interface HdRig extends RetargetOptions { readonly pairs: readonly (readonly [string, string])[] }

/** One fighter's Definitive timeline body from its authored Classic model and the stock Definitive model. */
export async function convertHdBody(source: ArrayBuffer, stock: ArrayBuffer, character: number, rig: HdRig) {
    const fighter = fighters.get(character);
    if (fighter === undefined) throw new Error(`Unknown fighter ${character}`);
    const authored = parseMDX(source);
    const hd = parseHdBody(stock);
    // The Crypt Lord names a base-only glow; Definitive has the same stock art under this path (#346).
    for (const texture of hd.Textures) if (texture.Image.replaceAll('\\', '/').replace(/\.(blp|tif|dds|tga)$/i, '').toLowerCase() === 'replaceabletextures/teamglow/teamglow00') texture.Image = 'Textures\\TeamGlow0000.dds';
    const pairs = rig.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) throw new Error('Rig module must export a nonempty pairs array');
    const skin = checkBodySkin(hd);
    const normalize = (name: string) => name.replace(/\s+\d+$/, '').replaceAll(/\s+/g, '').toLowerCase();
    const victory = normalize(victoryAnimation(character));
    const selected = new Set(flashableSequences(character, authored.Sequences));
    for (const sequence of authored.Sequences) if (normalize(sequence.Name) === victory) selected.add(sequence);
    const sequences = authored.Sequences.filter(sequence => selected.has(sequence));
    const result = retargetHd(authored, hd, pairs, sequences, rig);
    const converted = checkRetarget(result);
    if (converted.units > 0.5 || converted.degrees > 0.5) throw new Error(`${fighter.name} retarget exceeds 0.5/0.5: ${JSON.stringify(converted)}`);
    for (const collision of result.model.CollisionShapes) delete result.model.Nodes[collision.ObjectId];
    result.model.CollisionShapes = [];
    const thinned = thinKeys(result.model, { position: 0.45, rotationDegrees: 0.45 });
    const timeline = timelineBody(thinned.model, sequences);
    const bytes = generateHdBody(timeline);
    const exported = parseHdBody(bytes);
    const exportedSkin = checkBodySkin(exported);
    if (skin.geosets !== exportedSkin.geosets || skin.vertices !== exportedSkin.vertices) throw new Error('Definitive export changed the mesh count');
    // Warcraft draws no body with more than 255 nodes (#346).
    const nodes = exported.Nodes.filter(node => node !== undefined).length;
    if (nodes > 255) throw new Error(`${fighter.name} Definitive body has ${nodes} nodes; Warcraft draws at most 255`);
    const measured = checkRetarget({ ...result, samples: result.samples.map(sample => ({ ...sample, sequence: 0 })) }, bytes);
    if (measured.units > 0.5 || measured.degrees > 0.5) throw new Error(`${fighter.name} timeline exceeds 0.5/0.5: ${JSON.stringify(measured)}`);
    return { bytes, report: { fighter: fighter.name, character, sequences: sequences.length, joints: result.mapped, fit: result.fit, props: result.props, nodes, skin: exportedSkin, converted, thinning: thinned.report, timeline: measured,
        importReason: 'Authored moves cannot be played on the unmodified stock Definitive model.' } };
}

if (import.meta.main) {
    const [sourcePath, stockPath, outputPath, ...options] = process.argv.slice(2);
    const option = (name: string) => { const index = options.indexOf(name); return index < 0 ? undefined : options[index + 1]; };
    const character = Number(option('--character') ?? 16);
    const rigPath = option('--rig');
    if (sourcePath === undefined || stockPath === undefined || outputPath === undefined) {
        throw new Error('usage: bun tools/animations/hd-models.ts AUTHORED.mdx STOCK_DEFINITIVE.mdx PRIVATE_OUTPUT.mdx [--character ID --rig PAIRS.ts]');
    }
    if (character !== 16 && rigPath === undefined) throw new Error('Every fighter needs its registered literal rig mapping');
    const output = resolve(outputPath);
    if (!relative(resolve(import.meta.dir, '../..'), output).startsWith('..')) throw new Error('HD bodies stay in private storage');
    await Effect.runPromise(Effect.tryPromise({ try: async () => {
        const rig: HdRig = rigPath === undefined ? { pairs: CAIRNE_DE_PAIRS } : await import(resolve(rigPath));
        const { bytes, report } = await convertHdBody(await Bun.file(sourcePath).arrayBuffer(), await Bun.file(stockPath).arrayBuffer(), character, rig);
        await Bun.write(output, bytes);
        console.log(JSON.stringify({ ...report, output }));
    }, catch: cause => new Error(`Definitive ${character} export failed`, { cause }) }));
}
