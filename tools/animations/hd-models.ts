import { model as mdx } from '../../ts/scripts/clipNodes';
import { checkBodySkin, checkRetarget, generateHdBody, parseHdBody, retargetHd } from './hd-retarget';
import { canonicalMotion, classicSkeleton, rigNode, type FighterRig } from './canonical-rig';
import { timelineBody } from './timeline-body';
import { flashableSequences } from './white-flash-keys';
import { thinKeys } from '../../ts/scripts/keyThin';
import { encodeVerified, fighters, parseSource } from './original-clips';
import { DEFINITIVE_FIGHTERS } from '../../ts/src/game/assets/definitiveFighters';
import type { Character } from '../../ts/src/game/sim/codes';
import { victoryAnimation } from '../../ts/src/game/presentation/matchAudio';

const normalize = (name: string) => name.replace(/\s+\d+$/, '').replaceAll(/\s+/g, '').toLowerCase();

/** The sequence indices each body plays: the fighter's production clips, and in Definitive its victory pose too. */
export interface PlayedMoves { readonly classic: readonly number[]; readonly definitive: readonly number[] }
export function playedMoves(character: number, motion: mdx.Model): PlayedMoves {
    const played = flashableSequences(character, motion.Sequences).map(sequence => motion.Sequences.indexOf(sequence));
    const victory = normalize(victoryAnimation(character));
    const definitive = new Set(played);
    motion.Sequences.forEach((sequence, index) => { if (normalize(sequence.Name) === victory) definitive.add(index); });
    return { classic: played, definitive: [...definitive].sort((a, b) => a - b) };
}
const selected = (model: mdx.Model, indices: readonly number[]) => model.Sequences.filter((_, index) => indices.includes(index));

/** One fighter's Classic timeline body, generated from its canonical motion through the Classic mapping. */
export function classicBody(motion: mdx.Model, rig: FighterRig, played: readonly number[]): ArrayBuffer {
    const thinned = thinKeys(classicSkeleton(motion, rig)).model;
    return encodeVerified(timelineBody(thinned, selected(thinned, played)));
}

/** One fighter's Definitive timeline body, generated from its canonical motion onto the stock Definitive model. */
export function definitiveBody(motion: mdx.Model, stock: ArrayBuffer, rig: FighterRig, played: readonly number[]) {
    const character = rig.character;
    const fighter = fighters.get(character) ?? { name: `Fighter ${character}` };
    const hd = parseHdBody(stock);
    // The Crypt Lord names a base-only glow; Definitive has the same stock art under this path (#346).
    for (const texture of hd.Textures) if (texture.Image.replaceAll('\\', '/').replace(/\.(blp|tif|dds|tga)$/i, '').toLowerCase() === 'replaceabletextures/teamglow/teamglow00') texture.Image = 'Textures\\TeamGlow0000.dds';
    const pairs = rig.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) throw new Error('A Definitive rig needs a nonempty pairs array');
    const skin = checkBodySkin(hd);
    const sequences = selected(motion, played);
    const result = retargetHd(motion, hd, pairs.map(([joint, bone]) => [rigNode(joint), bone] as const), sequences, rig);
    const converted = checkRetarget(result);
    if (converted.units > 0.5 || converted.degrees > 0.5) throw new Error(`${fighter.name} retarget exceeds 0.5/0.5: ${JSON.stringify(converted)}`);
    for (const collision of result.model.CollisionShapes) delete result.model.Nodes[collision.ObjectId];
    result.model.CollisionShapes = [];
    const thinned = thinKeys(result.model, { position: 0.45, rotationDegrees: 0.45 });
    const timeline = timelineBody(thinned.model, sequences);
    const bytes = generateHdBody(timeline);
    const exported = parseHdBody(bytes);
    const exportedSkin = checkBodySkin(exported);
    if (skin.geosets !== exportedSkin.geosets || skin.vertices !== exportedSkin.vertices) throw new Error('Definitive export changed the mesh count');
    // Warcraft draws no body with more than 255 nodes (#346).
    const nodes = exported.Nodes.filter(node => node !== undefined).length;
    if (nodes > 255) throw new Error(`${fighter.name} Definitive body has ${nodes} nodes; Warcraft draws at most 255`);
    const measured = checkRetarget({ ...result, samples: result.samples.map(sample => ({ ...sample, sequence: 0 })) }, bytes);
    if (measured.units > 0.5 || measured.degrees > 0.5) throw new Error(`${fighter.name} timeline exceeds 0.5/0.5: ${JSON.stringify(measured)}`);
    return { bytes, report: { fighter: fighter.name, character, sequences: sequences.length, joints: result.mapped, fit: result.fit, props: result.props, nodes, skin: exportedSkin, converted, thinning: thinned.report, timeline: measured,
        importReason: 'Authored moves cannot be played on the unmodified stock Definitive model.' } };
}

/**
 * Both looks' bodies from one canonical motion (#366). A fighter without an approved Definitive body draws its
 * Classic body in Definitive too, so `definitive` is undefined.
 */
export function fighterBodies(motion: mdx.Model, rig: FighterRig, stock: ArrayBuffer | undefined, moves = playedMoves(rig.character, motion)) {
    const classic = classicBody(motion, rig, moves.classic);
    if (!DEFINITIVE_FIGHTERS.has(rig.character as Character)) return { classic, definitive: undefined };
    if (stock === undefined) throw new Error(`Fighter ${rig.character} needs its stock Definitive model`);
    return { classic, definitive: definitiveBody(motion, stock, rig, moves.definitive) };
}

/** Today's canonical motion source: the authored Classic model, mapped onto the rig. */
export const authoredMotion = (authored: ArrayBuffer, rig: FighterRig) => canonicalMotion(parseSource(authored), rig);
