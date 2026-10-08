import { resolve, relative } from 'node:path';
import { Effect } from 'effect';
import { parseMDX } from '../../ts/scripts/clipNodes';
import { CAIRNE_DE_PAIRS, checkBodySkin, checkRetarget, generateHdBody, parseHdBody, retargetHd } from './hd-retarget';
import { timelineBody } from './timeline-body';
import { flashableSequences } from './white-flash-keys';

const [sourcePath, stockPath, outputPath] = process.argv.slice(2);
if (sourcePath === undefined || stockPath === undefined || outputPath === undefined) {
    throw new Error('usage: bun tools/animations/hd-models.ts AUTHORED_CAIRNE.mdx STOCK_DEFINITIVE_CAIRNE.mdx PRIVATE_OUTPUT.mdx');
}
const output = resolve(outputPath);
if (!relative(resolve(import.meta.dir, '../..'), output).startsWith('..')) throw new Error('HD bodies stay in private storage');
await Effect.runPromise(Effect.tryPromise({ try: async () => {
    const source = parseMDX(await Bun.file(sourcePath).arrayBuffer());
    const hd = parseHdBody(await Bun.file(stockPath).arrayBuffer());
    const skin = checkBodySkin(hd);
    const sequences = flashableSequences(16, source.Sequences);
    const result = retargetHd(source, hd, CAIRNE_DE_PAIRS, sequences);
    const converted = checkRetarget(result);
    if (converted.units > 0.5 || converted.degrees > 0.5) throw new Error(`Cairne retarget exceeds 0.5/0.5: ${JSON.stringify(converted)}`);
    for (const collision of result.model.CollisionShapes) delete result.model.Nodes[collision.ObjectId];
    result.model.CollisionShapes = [];
    const timeline = timelineBody(result.model, sequences);
    const bytes = generateHdBody(timeline);
    const exportedSkin = checkBodySkin(parseHdBody(bytes));
    if (skin.geosets !== exportedSkin.geosets || skin.vertices !== exportedSkin.vertices) throw new Error('Definitive export changed the mesh count');
    const measured = checkRetarget({ ...result, samples: result.samples.map(sample => ({ ...sample, sequence: 0 })) }, bytes);
    if (measured.units > 0.5 || measured.degrees > 0.5) throw new Error(`Cairne timeline exceeds 0.5/0.5: ${JSON.stringify(measured)}`);
    await Bun.write(output, bytes);
    console.log(JSON.stringify({ fighter: 'Cairne', sequences: sequences.length, joints: result.mapped, skin: exportedSkin, converted, timeline: measured,
        importReason: 'Authored moves cannot be played on the unmodified stock Definitive model.', output }));
}, catch: cause => new Error('HD Cairne export failed', { cause }) }));
