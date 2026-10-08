import { join, relative, resolve } from 'node:path';
import { Effect } from 'effect';
import { captureScene, renderScenes, type RenderScene } from '../../ts/node_modules/wisp/scripts/wisp/headlessRender';
import { createStandaloneSession, NEUTRAL_INPUT } from '../../ts/scripts/wisp/standalone';
import { headlessRender } from '../../ts/scripts/wisp/headlessRender';
import { assetsView, readManifest } from '../../ts/scripts/wisp/buildInputs';
import { originalClip } from '../../ts/src/game/assets/fighterOriginalClipInfo';
import { SELECTABLE_CHARACTERS, fighterName } from '../../ts/src/game/sim/heroes/registry';
import { ensure, fighters, parseSource } from './original-clips';
import { flashableSequences } from './white-flash-keys';
import { checkTimelineGeosets } from './timeline-geosets';

const [outputArg] = process.argv.slice(2);
ensure(outputArg, 'usage: bun tools/animations/stand-captures.ts PRIVATE_OUTPUT');
const output = resolve(outputArg);
ensure(relative(resolve(import.meta.dir, '../..'), output).startsWith('..'), 'Captures stay private');

await Effect.runPromise(Effect.gen(function*() {
    const assets = assetsView(yield* readManifest());
    const scenes: RenderScene[] = [];
    let clips = 0, samples = 0, visible = 0;
    for (const character of SELECTABLE_CHARACTERS) {
        const fighter = fighters.get(character), clip = originalClip(character, 0);
        ensure(fighter !== undefined && clip?.timeline, `Missing timeline for ${fighterName(character)}`);
        const checked = yield* Effect.tryPromise({ try: async () => {
            const source = parseSource(await Bun.file(join(assets, fighter.source)).arrayBuffer());
            const timeline = parseSource(await Bun.file(join(assets, 'original-clips-static-lights/imports', clip.modelPath.replaceAll('\\', '/'))).arrayBuffer());
            return checkTimelineGeosets(source, timeline, flashableSequences(character, source.Sequences));
        }, catch: cause => new Error(`${fighterName(character)}: geoset check failed`, { cause }) });
        clips += checked.clips; samples += checked.samples; visible += checked.visible;
        console.log(`TIMELINE_GEOSETS_PASS ${fighterName(character)} ${JSON.stringify(checked)}`);
        const session = yield* Effect.tryPromise({ try: () => createStandaloneSession({ presentation: 'pool-confirmed', script: `#! chat -dev quick pair ${fighterName(character)} / ${fighterName(character)}` }), catch: cause => new Error('Stand capture setup failed', { cause }) });
        try {
            for (let frame = 0; frame < 90; frame++) session.step(NEUTRAL_INPUT);
            scenes.push({ ...captureScene(session.client, { visibleOnly: true }), frame: character });
        } finally { session.close(); }
    }
    const project = headlessRender({ assets });
    for (const graphics of ['classic', 'definitive'] as const) {
        const images = yield* renderScenes(project, scenes, join(output, graphics), graphics);
        for (const image of images) ensure(image.notDrawn.length === 0, `${graphics}/${image.frame}: ${image.notDrawn.join('; ')}`);
        console.log(`STAND_FRAMES_PASS ${graphics}: ${images.length} fighters, ${images.length * 2} both-facing bodies`);
    }
    console.log(`ROSTER_GEOSETS_PASS ${SELECTABLE_CHARACTERS.length} fighters, ${clips} clips, ${samples} sampled frames, ${visible} visible geoset samples; ${output}`);
}));
