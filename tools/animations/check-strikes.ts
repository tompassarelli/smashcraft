// Checks a strike re-export (strikes.py, #156) against the model it replaced:
// every sequence other than the re-authored ones keeps the same keys, times
// taken from its own start, and the same flags.
// Usage: bun tools/animations/check-strikes.ts BEFORE.mdx AFTER.mdx 'Name,Name,...'
import {parseMDX, model as mdx} from 'war3-model';
import {isDeepStrictEqual} from 'node:util';
import {tracks} from './original-clips';

const [beforePath, afterPath, names] = process.argv.slice(2);
if (!beforePath || !afterPath || names === undefined) throw new Error('usage: check-strikes.ts BEFORE.mdx AFTER.mdx NAMES');
const authored = new Set(names.split(','));
const before = parseMDX(await Bun.file(beforePath).arrayBuffer());
const after = parseMDX(await Bun.file(afterPath).arrayBuffer());

/** Each track's keys inside a sequence, with frames counted from its start. */
function clip(model: mdx.Model, name: string) {
    const sequence = model.Sequences.find(s => s.Name === name);
    if (sequence === undefined) throw new Error(`${name}: missing sequence`);
    const [start, end] = sequence.Interval;
    const keys = new Map<string, unknown>();
    tracks(model, (track, path) => {
        if (track.GlobalSeqId != null && track.GlobalSeqId !== -1) return;
        // The exporter may list geoset animations in either order; name each by its geoset.
        const geoset = /^\.GeosetAnims\.(\d+)\./.exec(path);
        const key = geoset ? path.replace(/^\.GeosetAnims\.\d+/, `.GeosetOf.${model.GeosetAnims[Number(geoset[1])]?.GeosetId}`) : path;
        keys.set(key, track.Keys.filter(k => k.Frame >= start && k.Frame <= end)
            .map(k => ({...k, Frame: k.Frame - start})));
    });
    return {length: end - start, looping: !sequence.NonLooping, keys};
}

const changed: string[] = [];
let kept = 0;
for (const sequence of before.Sequences) {
    if (authored.has(sequence.Name)) continue;
    // Sequence lengths are whole milliseconds of a 24 fps timeline; a re-export may round either way.
    const a = clip(before, sequence.Name), b = clip(after, sequence.Name);
    const same = Math.abs(a.length - b.length) <= 1 && a.looping === b.looping && [...a.keys].every(([path, keys]) => {
        const other = b.keys.get(path) as {Frame: number}[] | undefined;
        const mine = keys as {Frame: number}[];
        return other !== undefined && other.length === mine.length
            && mine.every((k, i) => Math.abs(k.Frame - (other[i]?.Frame ?? NaN)) <= 1 && isDeepStrictEqual({...k, Frame: 0}, {...other[i], Frame: 0}));
    });
    if (same) kept++; else changed.push(sequence.Name);
}
const missing = [...authored].filter(name => !after.Sequences.some(s => s.Name === name));
console.log(`STRIKE_PRESERVATION kept ${kept}, changed ${changed.length}${changed.length ? `: ${changed.join(', ')}` : ''}; re-authored ${authored.size - missing.length}${missing.length ? `, missing ${missing.join(', ')}` : ''}`);
if (changed.length || missing.length || before.Sequences.length !== after.Sequences.length) process.exit(1);
