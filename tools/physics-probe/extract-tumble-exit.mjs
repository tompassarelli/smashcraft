// Foreign recording intake: retain numerical telemetry, not parser implementation.
import { createHash } from 'node:crypto';
const project = new URL('../../', import.meta.url);
const parserRoot = new URL('build/slippi-intake/node_modules/@slippi/slippi-js/', project);
const metadata = await Bun.file(new URL('package.json', parserRoot)).json();
if (metadata.version !== '9.1.3') throw Error('Unexpected parser version');
const { SlippiGame } = await import(new URL('dist/browser/index.esm.js', parserRoot).href);
const bytes = await Bun.file(new URL('build/slippi-intake/tech-tester.slp', project)).arrayBuffer();
const sha256 = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
if (sha256 !== '05f02093dcbe2314ca0aa9547f596ac2295f3d831c72ee9b52fa70a215060351') throw Error('Unexpected recording');
const game = new SlippiGame(bytes);
const settings = game.getSettings(), frames = game.getFrames();
if (settings.isPAL !== false) throw Error('Expected NTSC recording');
const samples = [2980, 2981, 2982].map(frame => {
    const { pre, post } = frames[frame].players[0];
    return { frame, action: post.actionStateId, actionFrame: post.actionStateCounter,
        x: post.positionX, y: post.positionY, airborne: post.isAirborne,
        hitlag: post.hitlagRemaining, joystickX: pre.joystickX,
        joystickY: pre.joystickY, buttons: pre.physicalButtons,
        velocities: post.selfInducedSpeeds };
});
if (samples[0].action !== 38 || samples[1].action !== 29 || samples[2].action !== 29) throw Error('Unexpected transition');
const facts = { id: 'slippi-ntsc-digital-tumble-exit',
    source: 'https://raw.githubusercontent.com/project-slippi/slippi-js/ff815345e641836a331191320c0f6eae21542a5f/slp/techTester.slp',
    sourceRevision: 'ff815345e641836a331191320c0f6eae21542a5f', sourceSha256: sha256,
    parser: { package: '@slippi/slippi-js', version: metadata.version, license: metadata.license, scope: 'Unmodified local intake; numerical telemetry retained.' },
    recording: { slpVersion: settings.slpVersion, isPAL: settings.isPAL, gameRevision: null, stageId: settings.stageId, playerIndex: 0 },
    limitations: ['Recording does not identify retail revision; this is supporting NTSC ordering evidence, not revision-specific certification.',
        'Production fixture checks action selection and horizontal self drift only; full airborne knockback arithmetic and vertical trajectory are separate claims.'], samples };
await Bun.write(new URL('docs/smash-melee-reference/slippi-ntsc-tumble-exit.json', project), JSON.stringify(facts, null, 2) + '\n');
console.log(JSON.stringify({ sourceSha256: sha256, samples: samples.length, actions: samples.map(s => s.action) }));
