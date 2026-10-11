import { mat4, quat, vec3 } from '../../ts/node_modules/gl-matrix';
import { ModelRenderer, model as mdx } from '../../ts/scripts/clipNodes';
import { generateHdBody, parseHdBody } from './hd-retarget';
import { AttackStyle } from '../../ts/src/game/sim/codes';
import { WARDEN_MOVES } from '../../ts/src/game/sim/heroes/wardenMoves';

export function fitWardenBlade(motion: mdx.Model, bytes: ArrayBuffer) {
    const source = parseHdBody(bytes), model = structuredClone(source);
    const weapon = model.Nodes.find(node => node?.Name === 'Wep01_R0_0_jnt');
    const classicWeapon = motion.Nodes.find(node => node?.Name === '@weapon');
    if (weapon === undefined || classicWeapon === undefined || weapon.Parent == null) throw new Error('Warden blade attachment is missing');
    const tip = vec3.fromValues(-8.521499633789062, -53.64099884033203, 14.718500137329102);
    const classicTip = vec3.fromValues(-11.125900268554688, -48.87200164794922, 6.704820156097412);
    const renderer = new ModelRenderer(source), classicRenderer = new ModelRenderer(motion);
    const state = Reflect.get(renderer, 'rendererData') as { frame: number; nodes: { matrix: mat4 }[] };
    const classicState = Reflect.get(classicRenderer, 'rendererData') as typeof state;
    renderer.setSequence(0);
    let samples = 0;
    for (const name of ['neutralAir', 'forwardAir'] as const) {
        const index = motion.Sequences.findIndex(sequence => sequence.Name === `Attack Gesture ${name}`);
        const sequence = motion.Sequences[index];
        if (sequence === undefined) throw new Error(`Warden ${name} is missing`);
        const [start, end] = sequence.Interval;
        const move = WARDEN_MOVES.normals[AttackStyle[name]];
        if (move === undefined) throw new Error(`Warden ${name} timing is missing`);
        const lastActive = move.startupFrames + move.activeFrames - 1, total = (end - start) * 60 / 1000;
        classicRenderer.setSequence(index);
        const keys: Record<'Translation' | 'Rotation' | 'Scaling', mdx.AnimKeyframe[]> = { Translation: [], Rotation: [], Scaling: [] };
        for (let frame = start; frame <= end; frame = Math.min(end, frame + 4)) {
            state.frame = frame; renderer.update(0);
            classicState.frame = frame; classicRenderer.update(0);
            const matrix = state.nodes[weapon.ObjectId].matrix;
            const pivot = vec3.transformMat4(vec3.create(), weapon.PivotPoint, matrix);
            const from = vec3.sub(vec3.create(), vec3.transformMat4(vec3.create(), tip, matrix), pivot);
            const to = vec3.sub(vec3.create(), vec3.transformMat4(vec3.create(), classicTip, classicState.nodes[classicWeapon.ObjectId].matrix), pivot);
            const localFrame = (frame - start) * 60 / 1000;
            const weight = localFrame < move.startupFrames ? localFrame / move.startupFrames
                : localFrame <= lastActive ? 1 : Math.max(0, (total - localFrame) / (total - lastActive));
            const scale = 1 + (vec3.length(to) / vec3.length(from) - 1) * weight;
            const turn = quat.rotationTo(quat.create(), vec3.normalize(vec3.create(), from), vec3.normalize(vec3.create(), to));
            quat.slerp(turn, quat.create(), turn, weight);
            const fitted = mat4.fromTranslation(mat4.create(), pivot);
            mat4.multiply(fitted, fitted, mat4.fromQuat(mat4.create(), turn));
            mat4.scale(fitted, fitted, [scale, scale, scale]);
            mat4.translate(fitted, fitted, vec3.negate(vec3.create(), pivot));
            mat4.multiply(fitted, fitted, matrix);
            const parentInverse = mat4.invert(mat4.create(), state.nodes[weapon.Parent].matrix);
            if (parentInverse === null) throw new Error('Warden blade parent is singular');
            const local = mat4.multiply(mat4.create(), parentInverse, fitted), p = weapon.PivotPoint;
            const translation = new Float32Array([0, 1, 2].map(axis => local[axis + 12] - p[axis]
                + local[axis] * p[0] + local[axis + 4] * p[1] + local[axis + 8] * p[2]));
            const rotation = quat.normalize(quat.create(), mat4.getRotation(quat.create(), local));
            const scaling = mat4.getScaling(vec3.create(), local);
            for (const [kind, vector] of [['Translation', translation], ['Rotation', rotation], ['Scaling', scaling]] as const) {
                keys[kind].push({ Frame: frame, Vector: new Float32Array(vector) });
            }
            samples++;
            if (frame === end) break;
        }
        for (const kind of ['Translation', 'Rotation', 'Scaling'] as const) {
            const track = weapon[kind];
            if (track === undefined || track.LineType !== mdx.LineType.Linear) throw new Error(`Warden blade ${kind} must be linear`);
            track.Keys = track.Keys.filter(key => key.Frame < start || key.Frame > end).concat(keys[kind]).sort((a, b) => a.Frame - b.Frame);
        }
    }
    return { bytes: generateHdBody(model), report: { sequences: 2, samples, attachment: 'Fixed weapon pivot; visible blade follows the authored Classic tip.' } };
}
