import { join, relative, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { Effect } from 'effect';
import { headlessRender } from '../../ts/scripts/wisp/headlessRender';
import { assetsView, readManifest } from '../../ts/scripts/wisp/buildInputs';
import { CAIRNE_DE_PAIRS } from './hd-retarget';
import { convertHdBody, type HdRig } from './hd-models';
import { ensure, fighters } from './original-clips';

/** Each retargeted fighter's rig module (smashcraft:docs/design/hd-fighters.md); Lich King and Malfurion keep Classic bodies. */
export const HD_RIGS: ReadonlyMap<number, string | undefined> = new Map([
    [1, 'rifleman'], [2, 'illidan'], [3, 'blademaster'], [4, 'mountainking'], [5, 'warden'], [6, 'lich'],
    [7, 'forsakenpaladin'], [8, 'dreadlord'], [9, 'shadowhunter'], [10, 'pitlord'], [11, 'beastmaster'],
    [13, 'thrall'], [14, 'jaina'], [15, 'sylvanas'], [16, undefined], [17, 'chen'], [18, 'peon'], [19, 'tinker'],
    [20, 'kaelthas'], [21, 'murloc'], [22, 'grom'], [23, 'anubarak'], [25, 'medivh'], [26, 'kobold'],
]);
const CAIRNE_STOCK = 'units\\orc\\HeroTaurenChieftain\\HeroTaurenChieftain.mdx';

const [outputArg, ...rest] = process.argv.slice(2);
ensure(outputArg, 'usage: bun tools/animations/hd-roster.ts PRIVATE_OUTPUT [CHARACTER...]');
const output = resolve(outputArg);
ensure(relative(resolve(import.meta.dir, '../..'), output).startsWith('..'), 'HD bodies stay in private storage');
const only = rest.map(Number);

await Effect.runPromise(Effect.gen(function*() {
    const assets = assetsView(yield* readManifest());
    const project = headlessRender({ assets });
    mkdirSync(join(output, 'stock'), { recursive: true });
    for (const [character, rigName] of HD_RIGS) {
        if (only.length > 0 && !only.includes(character)) continue;
        const fighter = fighters.get(character)!;
        const report = yield* Effect.tryPromise({ try: async () => {
            const rig: HdRig & { stock?: string; stockPath?: string } = rigName === undefined ? { pairs: CAIRNE_DE_PAIRS } : await import(`./hd-rigs/${rigName}.ts`);
            const stockName = (rig.stock ?? rig.stockPath ?? CAIRNE_STOCK).replace(/^war3\.w3mod:_de\.w3mod:/, '').replaceAll('/', '\\');
            const stock = await project.resolveAsset(stockName, 'definitive');
            ensure(stock.bytes !== undefined && stock.selected?.layer === '_de.w3mod', `${fighter.name}: no stock Definitive ${stockName}`);
            const stockBytes = stock.bytes.slice().buffer;
            await Bun.write(join(output, 'stock', `${fighter.name}.mdx`), stockBytes);
            const { bytes, report } = await convertHdBody(await Bun.file(join(assets, fighter.source)).arrayBuffer(), stockBytes, character, rig);
            await Bun.write(join(output, `${fighter.name}.mdx`), bytes);
            return report;
        }, catch: cause => new Error(`Definitive ${fighter.name} export failed`, { cause }) });
        console.log(JSON.stringify(report));
    }
}));
