// Foreign fixture boundary: authored JASS files consumed by Warcraft Preloader.
import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const [build, sourceSlotText, output] = process.argv.slice(2);
if (!build || !/^[A-Za-z0-9._-]+$/.test(build) || !/^[0-3]$/.test(sourceSlotText ?? '') || !output) {
    throw new Error('Usage: bun smashcraft:tools/netcode-probe/generate-preloader-source-fixtures.mjs BUILD_ID SOURCE_SLOT OUTPUT_DIRECTORY');
}
const directory = resolve(output);
await mkdir(directory, { recursive: true });
let count = 0;
for (let sender = 0; sender < 4; sender++) {
    for (let arm = 1; arm <= 4; arm++) {
        for (let sequence = 0; sequence < 300; sequence++) {
            const suffix = String(sequence).padStart(3, '0');
            const value = arm === 2 || arm === 3 ? 'D0B0000000000000' : `D0B${suffix}0000000000`;
            const comment = arm === 3 ? suffix : '000';
            const script = `function PreloadFiles takes nothing returns nothing\n// ${comment}\ncall BlzSetAbilityTooltip('$wsl', "${value}", 0)\nendfunction\n`;
            const filename = `smashcraft-preloader-source-${build}-s${sourceSlotText}-p${sender}-a${arm}-n${suffix}.pld`;
            await Bun.write(join(directory, filename), script);
            count++;
        }
    }
}
console.log(`Wrote ${count} authored fixtures to ${directory}; copy the complete set to each client's CustomMapData directory. No files were preloaded.`);
