// Foreign model diagnostic: hold an authored contact pose independent of playback time.
import {parseMDX, generateMDX} from '../animations/node_modules/war3-model';

const destination = process.argv[2];
if (!destination) throw new Error('A probe build directory is required');
const model = parseMDX(await Bun.file(`${import.meta.dir}/../../build/animation-assets/ArcherFighter.mdx`).arrayBuffer());
const sequence = model.Sequences.find(s => s.Name === 'Up Tilt');
if (!sequence) throw new Error('Missing Up Tilt');
const [start, end] = sequence.Interval;
const visited = new WeakSet<object>();
function hold(value: unknown) {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || visited.has(value)) return;
    visited.add(value);
    if ('Keys' in value && Array.isArray(value.Keys)) {
        if ('GlobalSeqId' in value && typeof value.GlobalSeqId === 'number' && value.GlobalSeqId >= 0) return;
        const keys = value.Keys.filter(k => k.Frame >= start && k.Frame <= end);
        if (keys.length) {
            const closest = keys.reduce((a, b) => Math.abs(a.Frame - start - 250) < Math.abs(b.Frame - start - 250) ? a : b);
            value.Keys = [0, 1000].map(Frame => ({...closest, Frame}));
            if ('LineType' in value) value.LineType = 1;
        }
    }
    for (const child of Object.values(value)) hold(child);
}
hold(model);
sequence.Name = 'Stand';
sequence.Interval = new Uint32Array([0, 1000]);
model.Sequences = [sequence];
const bytes = generateMDX(model);
const hash = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
const name = `ArcherContact-${hash}.mdx`;
await Bun.write(`${destination}/imports/war3mapImported/${name}`, bytes);
await Bun.write(`${destination}/wurst/FighterContactPoseInfo.wurst`,
    `package FighterContactPoseInfo\npublic constant string CONTACT_MODEL = "war3mapImported\\\\${name}"\n`);
console.log(name, 'Up Tilt contact sampled at +250ms');
