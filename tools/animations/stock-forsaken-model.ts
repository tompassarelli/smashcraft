import { resolve, relative } from 'node:path';
import { Effect } from 'effect';
import { parseMDX } from '../../ts/scripts/clipNodes';
import { generateHdBody, parseHdBody } from './hd-retarget';
import { flashableSequences } from './white-flash-keys';
import { tracks } from './original-clips';
import { checkStockGeosets, restoreStockForsaken } from './stock-forsaken';
import { isDeepStrictEqual } from 'node:util';
import { Character } from '../../ts/src/game/sim/codes';

const [stockPath, authoredPath, outputPath] = process.argv.slice(2);
if (stockPath === undefined || authoredPath === undefined || outputPath === undefined) {
    throw new Error('usage: bun tools/animations/stock-forsaken-model.ts STOCK_CLASSIC_FORSAKEN.mdx AUTHORED_FORSAKEN.mdx PRIVATE_OUTPUT.mdx');
}
const output = resolve(outputPath);
if (!relative(resolve(import.meta.dir, '../..'), output).startsWith('..')) throw new Error('Stock art stays in private storage');
await Effect.runPromise(Effect.tryPromise({ try: async () => {
    const stock = parseHdBody(await Bun.file(stockPath).arrayBuffer());
    const authored = parseMDX(await Bun.file(authoredPath).arrayBuffer());
    const model = restoreStockForsaken(stock, authored);
    const bytes = generateHdBody(model), decoded = parseHdBody(bytes);
    const sequences = flashableSequences(Character.forsakenPaladin, decoded.Sequences);
    const geosets = checkStockGeosets(stock, decoded, sequences);
    for (const bone of authored.Bones) {
        const target = decoded.Bones.find(candidate => candidate.Name === bone.Name);
        if (target === undefined || !['Translation', 'Rotation', 'Scaling'].every(key => isDeepStrictEqual(Reflect.get(bone, key), Reflect.get(target, key)))) {
            throw new Error(`${bone.Name}: shipped motion changed`);
        }
    }
    tracks(decoded, (track, path) => { if (track.Keys.length === 0) throw new Error(`Empty track ${path}`); });
    await Bun.write(output, bytes);
    console.log(JSON.stringify({ fighter: 'Forsaken Paladin', version: decoded.Version, bytes: bytes.byteLength,
        authoredSequences: decoded.Sequences.length, preservedBones: authored.Bones.length, geosets, output }));
}, catch: cause => new Error('Stock Forsaken export failed', { cause }) }));
