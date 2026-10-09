import { join, relative, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { Effect } from 'effect';
import { headlessRender } from '../../ts/scripts/wisp/headlessRender';
import { assetsView, readManifest } from '../../ts/scripts/wisp/buildInputs';
import { authoredMotion, fighterBodies } from './hd-models';
import { FIGHTER_RIGS } from './hd-rigs';
import { DEFINITIVE_FIGHTERS } from '../../ts/src/game/assets/definitiveFighters';
import type { Character } from '../../ts/src/game/sim/codes';
import { ensure, fighters, hash } from './original-clips';

const [outputArg, ...rest] = process.argv.slice(2);
ensure(outputArg, 'usage: bun tools/animations/hd-roster.ts PRIVATE_OUTPUT [CHARACTER...]');
const output = resolve(outputArg);
ensure(relative(resolve(import.meta.dir, '../..'), output).startsWith('..'), 'HD bodies stay in private storage');
const only = rest.map(Number);

await Effect.runPromise(Effect.gen(function*() {
    const assets = assetsView(yield* readManifest());
    const project = headlessRender({ assets });
    mkdirSync(join(output, 'stock'), { recursive: true });
    for (const [character, rig] of FIGHTER_RIGS) {
        if (only.length > 0 && !only.includes(character)) continue;
        const fighter = fighters.get(character)!;
        const report = yield* Effect.tryPromise({ try: async () => {
            let stock: ArrayBuffer | undefined;
            if (DEFINITIVE_FIGHTERS.has(character as Character)) {
                const stockName = (rig.stockPath ?? '').replace(/^war3\.w3mod:_de\.w3mod:/, '').replaceAll('/', '\\');
                const resolved = await project.resolveAsset(stockName, 'definitive');
                ensure(resolved.bytes !== undefined && resolved.selected?.layer === '_de.w3mod', `${fighter.name}: no stock Definitive ${stockName}`);
                stock = resolved.bytes.slice().buffer;
                await Bun.write(join(output, 'stock', `${fighter.name}.mdx`), stock);
            }
            const bodies = fighterBodies(authoredMotion(await Bun.file(join(assets, fighter.source)).arrayBuffer(), rig), rig, stock);
            await Bun.write(join(output, 'classic', `${fighter.name}TimelineBody-${hash(bodies.classic)}.mdx`), bodies.classic);
            if (bodies.definitive !== undefined) await Bun.write(join(output, `${fighter.name}.mdx`), bodies.definitive.bytes);
            return { fighter: fighter.name, classic: hash(bodies.classic), definitive: bodies.definitive?.report ?? 'Classic body in both looks' };
        }, catch: cause => new Error(`${fighter.name} body export failed`, { cause }) });
        console.log(JSON.stringify(report));
    }
}));
