// Foreign filesystem/JASS boundary. Packet semantics come from checked Wurst.
import { mkdir, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const [build, sourceSlot, corpusPath, output] = process.argv.slice(2);
if (!/^[A-Za-z0-9._-]+$/.test(build ?? '') || !/^[0-3]$/.test(sourceSlot ?? '') || !corpusPath || !output) {
    throw new Error('Usage: bun smashcraft:tools/netcode-probe/generate-vocabulary-fixtures.mjs BUILD_ID SOURCE_SLOT CHECKED_CORPUS OUTPUT_DIRECTORY');
}
const corpus = (await Bun.file(corpusPath).text()).trim().split('\n');
const alphabet = corpus.find(line => line.startsWith('VOCABULARY_ALPHABET '))?.split(' ')[1];
const maximum = Number(corpus.find(line => line.startsWith('VOCABULARY_MAX_BYTES '))?.split(' ')[1]);
if (alphabet?.length !== 64 || !Number.isInteger(maximum) || maximum >= 64) throw new Error('Missing checked protocol bounds');
const directory = resolve(output);
await mkdir(directory, { recursive: true });
const script = value => `function PreloadFiles takes nothing returns nothing\ncall BlzSetAbilityTooltip('$wsl', "${value}", 0)\nendfunction\n`;
const vocabulary = [...alphabet].map(script);
let files = 0;
let bytes = 0;
let packets = 0;
let markerCount = 0;
let minLength = maximum;
let maxLength = 0;
const usedScripts = new Set();
const paths = new Set();
async function publish(path, content) {
    if (paths.has(path)) throw new Error(`Duplicate corpus path ${path}`);
    paths.add(path);
    // Unique build directories are required; never replace an immutable packet.
    if (await Bun.file(path).exists()) throw new Error(`Already published: ${path}`);
    await Bun.write(`${path}.tmp`, content);
    await rename(`${path}.tmp`, path);
    files++;
    bytes += Buffer.byteLength(content);
}
for (const line of corpus) {
    if (!line.startsWith('VOCABULARY_CORPUS ')) continue;
    const [, sender, armText, sequenceText, wire] = line.split(' ');
    const arm = Number(armText);
    const sequence = Number(sequenceText);
    if (!/^[01]$/.test(sender) || ![1, 2, 4, 5].includes(arm) || sequence < 0 || sequence >= 300 || !wire || wire.length > maximum || [...wire].some(c => !alphabet.includes(c))) throw new Error(`Invalid corpus row: ${line}`);
    const base = join(directory, `smashcraft-vocabulary-${build}-s${sourceSlot}-p${sender}-a${arm}-n${String(sequence).padStart(3, '0')}`);
    minLength = Math.min(minLength, wire.length);
    maxLength = Math.max(maxLength, wire.length);
    if (arm % 3 === 1) {
        await publish(`${base}.pld`, script(wire));
    } else {
        for (let offset = 0; offset < wire.length; offset++) {
            const content = vocabulary[alphabet.indexOf(wire[offset])];
            usedScripts.add(content);
            await publish(`${base}-c${offset}.pld`, content);
        }
        const marker = vocabulary[wire.length];
        usedScripts.add(marker);
        // Atomic publication of this marker is the packet commit point.
        await publish(`${base}-length.pld`, marker);
        markerCount++;
    }
    packets++;
}
if (packets !== 2400 || markerCount !== 1200) throw new Error('Incomplete corpus');
const report = { build, sourceSlot: Number(sourceSlot), senders: [0, 1], packets, files, bytes, markerCount, minPacketBytes: minLength, maxPacketBytes: maxLength, protocolMaximumBytes: maximum, vocabularyScriptsUsed: usedScripts.size, vocabularyScriptsMaximum: vocabulary.length, vocabularyScriptBytes: Buffer.byteLength(vocabulary[0]), explicitlyPrewarmed: false };
await Bun.write(join(directory, 'fixture-summary.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
