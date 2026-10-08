import { mat4, quat, vec3 } from '../../ts/node_modules/gl-matrix';
import { ModelRenderer, model as mdx, parseMDX, generateMDX } from '../../ts/scripts/clipNodes';
import { skinChunks } from '../../ts/scripts/mdxCodec';
import { tracks, onGlobalClock } from './original-clips';

export const CAIRNE_DE_PAIRS: readonly (readonly [string, string])[] = [
    ['Root', 'root'], ['Bone_Chest', 'bone_chest'], ['Bone_Neck', 'neck'],
    ['Bone_Head', 'bone_head'], ['Bone_Pelvis', 'pelvis'],
    ['Bone_Totum', 'totem'], ['Axe', 'weapon'],
    ...(['L', 'R'] as const).flatMap(side => [
        [`Bone_Clavical${side}`, `scapula_${side}`],
        [`Bone_UpperArm${side}`, `scapula_${side}|shoulder_l`],
        [`Bone_LowerArm${side}`, `elbow_${side}`],
        [`Bone_Hand${side}`, `wrist_${side}`],
        [`Bone_Upperleg${side}`, `hip_${side}`],
        [`Bone_Leg2${side}`, `knee_${side}`],
        [`Bone_Leg3${side}`, `ankle_${side}`],
        [`Bone_Foot${side}`, `toes_${side}`],
    ] as const),
    ...[1, 2, 3, 4].map(index => [`Bone_Tail${index}`, `tail${index}`] as const),
];

/** Match bodies use no camera; version 1800's camera record extends the old layout. */
export function parseHdBody(bytes: ArrayBuffer): mdx.Model {
    return parseMDX(skinChunks(bytes, false, true));
}

export function generateHdBody(model: mdx.Model): ArrayBuffer {
    return skinChunks(generateMDX(model), true, true);
}

export function checkBodySkin(model: mdx.Model) {
    const boneIds = new Set(model.Bones.map(bone => bone.ObjectId));
    let vertices = 0;
    for (const geoset of model.Geosets) {
        const skin = geoset.SkinWeights;
        if (skin === undefined || skin.length !== geoset.Vertices.length / 3 * 8) throw new Error('Definitive mesh has an incomplete skin');
        const matrices = new Set(geoset.Groups.flat());
        for (let vertex = 0; vertex < skin.length; vertex += 8) {
            let weight = 0;
            for (let influence = 0; influence < 4; influence++) {
                weight += skin[vertex + 4 + influence];
                if (skin[vertex + 4 + influence] === 0) continue;
                // SKIN IDs address node matrices directly, independently of matrix-group order.
                const id = skin[vertex + influence];
                if (!boneIds.has(id) || !matrices.has(id)) throw new Error('Definitive skin names an absent bone');
            }
            if (weight !== 255) throw new Error('Definitive skin weights do not sum to 255');
            vertices++;
        }
    }
    return { geosets: model.Geosets.length, vertices };
}


interface RenderState { frame: number; nodes: { matrix: mat4 }[] }
function evaluator(model: mdx.Model) {
    const renderer = new ModelRenderer(model);
    const state = Reflect.get(renderer, 'rendererData') as RenderState;
    return (sequence: number, frame: number) => {
        renderer.setSequence(sequence);
        state.frame = frame;
        renderer.update(0);
        return state.nodes.map(node => node && mat4.clone(node.matrix));
    };
}

function inverse(matrix: mat4): mat4 {
    const result = mat4.invert(mat4.create(), matrix);
    if (result === null) throw new Error('Singular retarget transform');
    return result;
}

function registrationFactors(matrix: mat4): readonly [mat4, mat4, mat4] {
    const a = Array.from({ length: 3 }, (_, row) => Array.from({ length: 3 }, (_, column) => matrix[column * 4 + row]));
    const stretchSquared = Array.from({ length: 3 }, (_, row) => Array.from({ length: 3 }, (_, column) =>
        a.reduce((sum, values) => sum + values[row] * values[column], 0)));
    const basis = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let iteration = 0; iteration < 32; iteration++) {
        let p = 0, q = 1;
        for (const [row, column] of [[0, 2], [1, 2]])
            if (Math.abs(stretchSquared[row][column]) > Math.abs(stretchSquared[p][q])) { p = row; q = column; }
        if (Math.abs(stretchSquared[p][q]) < 1e-12) break;
        const angle = 0.5 * Math.atan2(2 * stretchSquared[p][q], stretchSquared[q][q] - stretchSquared[p][p]);
        const c = Math.cos(angle), s = Math.sin(angle);
        const pp = stretchSquared[p][p], qq = stretchSquared[q][q], pq = stretchSquared[p][q];
        stretchSquared[p][p] = c * c * pp - 2 * c * s * pq + s * s * qq;
        stretchSquared[q][q] = s * s * pp + 2 * c * s * pq + c * c * qq;
        stretchSquared[p][q] = stretchSquared[q][p] = 0;
        for (let row = 0; row < 3; row++) {
            if (row !== p && row !== q) {
                const rp = stretchSquared[row][p], rq = stretchSquared[row][q];
                stretchSquared[row][p] = stretchSquared[p][row] = c * rp - s * rq;
                stretchSquared[row][q] = stretchSquared[q][row] = s * rp + c * rq;
            }
            const bp = basis[row][p], bq = basis[row][q];
            basis[row][p] = c * bp - s * bq;
            basis[row][q] = s * bp + c * bq;
        }
    }
    const scales = stretchSquared.map((row, index) => Math.sqrt(row[index]));
    if (scales.some(value => !Number.isFinite(value) || value < 1e-8)) throw new Error('Singular Stand registration');
    const left = mat4.create(), diagonal = mat4.create(), right = mat4.create();
    for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
        left[column * 4 + row] = a[row].reduce((sum, value, index) => sum + value * basis[index][column], 0) / scales[column];
        right[column * 4 + row] = basis[column][row];
    }
    if (mat4.determinant(left) < 0) {
        for (let row = 0; row < 3; row++) left[8 + row] *= -1;
        scales[2] *= -1;
    }
    for (let axis = 0; axis < 3; axis++) {
        left[12 + axis] = matrix[12 + axis];
        diagonal[axis * 5] = scales[axis];
    }
    // R*S = (R*Q)*D*Q^-1. Only D stretches; all three factors stay constant.
    return [left, diagonal, right];
}

function appendTransform(node: mdx.Node, matrix: mat4, frame: number): void {
    const rotation = mat4.getRotation(quat.create(), matrix);
    quat.normalize(rotation, rotation);
    const scaling = mat4.getScaling(vec3.create(), matrix);
    const pivot = node.PivotPoint;
    const translation = new Float32Array([0, 1, 2].map(axis => matrix[12 + axis] - pivot[axis]
        + matrix[axis] * pivot[0] + matrix[axis + 4] * pivot[1] + matrix[axis + 8] * pivot[2]));
    for (const [kind, vector] of [['Translation', translation], ['Rotation', rotation], ['Scaling', scaling]] as const) {
        node[kind] ??= { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [] };
        node[kind].Keys.push({ Frame: frame, Vector: new Float32Array(vector) });
    }
}

export interface RetargetSample { sequence: number; frame: number; expected: ReadonlyMap<number, mat4> }
export interface RetargetResult { model: mdx.Model; samples: RetargetSample[]; mapped: number }

export function retargetHd(source: mdx.Model, hd: mdx.Model, pairs: readonly (readonly [string, string])[], sequences: readonly mdx.Sequence[], visibilityPairs: readonly (readonly [number, number])[] = []): RetargetResult {
    const model = structuredClone(hd);
    const referenceSequence = (rig: mdx.Model) => {
        const ready = rig.Sequences.findIndex(sequence => /^Stand Ready(?:\s+\d+)?$/.test(sequence.Name));
        return ready >= 0 ? ready : rig.Sequences.findIndex(sequence => /^Stand(?:\s*-?\s*\d+)?$/.test(sequence.Name));
    };
    const sourceStand = referenceSequence(source);
    const hdStand = referenceSequence(hd);
    if (sourceStand < 0 || hdStand < 0) throw new Error('Retarget needs a Stand reference in both rigs');
    const sourceAt = evaluator(source), hdAt = evaluator(hd);
    const sourceReference = sourceAt(sourceStand, source.Sequences[sourceStand].Interval[0]);
    const hdReference = hdAt(hdStand, hd.Sequences[hdStand].Interval[0]);
    const correspondence = new Map<number, number>();
    for (const [classic, definitive] of pairs) {
        const from = source.Nodes.find(node => node?.Name === classic);
        const to = model.Bones.find(node => node.Name === definitive);
        if (from === undefined || to === undefined) throw new Error(`Unmapped required joint ${classic} → ${definitive}`);
        if (correspondence.has(to.ObjectId)) throw new Error(`Repeated Definitive target ${definitive}`);
        correspondence.set(to.ObjectId, from.ObjectId);
    }
    const referenceLocal = new Map(model.Bones.map(node => [node.ObjectId, node.Parent == null
        ? hdReference[node.ObjectId]
        : mat4.multiply(mat4.create(), inverse(hdReference[node.Parent]), hdReference[node.ObjectId])]));
    const registration = new Map([...correspondence].map(([to, from]) => [to,
        mat4.multiply(mat4.create(), inverse(sourceReference[from]), hdReference[to])]));
    const hdBones = [...model.Bones];
    for (const node of hdBones) { delete node.Translation; delete node.Rotation; delete node.Scaling; }
    const sourceNodes = new Map<number, number>();
    const globalOffset = model.GlobalSequences.length;
    model.GlobalSequences.push(...source.GlobalSequences);
    const copyAncestor = (id: number): number => {
        const existing = sourceNodes.get(id);
        if (existing !== undefined) return existing;
        const original = source.Nodes[id];
        if (original === undefined) throw new Error(`Missing authored ancestor ${id}`);
        const parent = original.Parent == null ? null : copyAncestor(original.Parent);
        const ObjectId = model.Nodes.length;
        const node: mdx.Bone = {
            Name: `Authored ${original.Name}`, ObjectId, Parent: parent, Flags: original.Flags,
            PivotPoint: new Float32Array(original.PivotPoint), GeosetId: null, GeosetAnimId: null,
        };
        for (const kind of ['Translation', 'Rotation', 'Scaling'] as const) {
            const track = original[kind];
            if (track === undefined) continue;
            node[kind] = structuredClone(track);
            if (onGlobalClock(track)) node[kind].GlobalSeqId = track.GlobalSeqId! + globalOffset;
        }
        model.Bones.push(node);
        model.Nodes.push(node);
        model.PivotPoints.push(node.PivotPoint);
        sourceNodes.set(id, ObjectId);
        return ObjectId;
    };
    const constantTransforms = new Map(referenceLocal);
    for (const [to, from] of correspondence) {
        let parent = copyAncestor(from);
        const factors = registrationFactors(registration.get(to)!);
        for (const [index, factor] of factors.entries()) {
            if (index === 2) {
                model.Nodes[to].Parent = parent;
                constantTransforms.set(to, factor);
                continue;
            }
            const ObjectId = model.Nodes.length;
            const node: mdx.Bone = {
                Name: `Registration ${index} ${model.Nodes[to].Name}`, ObjectId, Parent: parent, Flags: 0,
                PivotPoint: new Float32Array(3), GeosetId: null, GeosetAnimId: null,
            };
            model.Bones.push(node); model.Nodes.push(node); model.PivotPoints.push(node.PivotPoint);
            constantTransforms.set(ObjectId, factor);
            parent = ObjectId;
        }
    }
    const samples: RetargetSample[] = [];
    for (const sequence of sequences) {
        const index = source.Sequences.indexOf(sequence), [start, end] = sequence.Interval;
        const frames = new Set<number>([start, end]);
        tracks(source, track => { if (!onGlobalClock(track)) for (const key of track.Keys) if (key.Frame >= start && key.Frame <= end) frames.add(key.Frame); });
        for (const frame of [...frames].sort((a, b) => a - b)) {
            const reference = sourceAt(index, frame);
            if (frame === start || frame === end) for (const [id, matrix] of constantTransforms)
                appendTransform(model.Nodes[id], matrix, frame);
            samples.push({ sequence: index, frame, expected: new Map([...correspondence].map(([id, from]) =>
                [id, mat4.multiply(mat4.create(), reference[from], registration.get(id)!)])) });
        }
    }
    model.Sequences = structuredClone(source.Sequences);
    // Extra HD facial/cloth materials hold their stock Stand values through authored intervals.
    tracks(model, (track, path) => {
        if (path.startsWith('.Bones.') || onGlobalClock(track)) return;
        const first = track.Keys.find(key => key.Frame >= hd.Sequences[hdStand].Interval[0] && key.Frame <= hd.Sequences[hdStand].Interval[1]) ?? track.Keys[0];
        if (first === undefined) throw new Error(`Empty HD track ${path}`);
        track.LineType = mdx.LineType.DontInterp;
        track.Keys = sequences.flatMap(sequence => [...sequence.Interval].map(Frame => ({ Frame, Vector: new Float32Array(first.Vector) })));
    });
    for (const [classic, definitive] of visibilityPairs) {
        if (source.Geosets[classic] === undefined || model.Geosets[definitive] === undefined) throw new Error(`Missing visibility mesh ${classic} → ${definitive}`);
        const alpha = source.GeosetAnims.find(animation => animation.GeosetId === classic)?.Alpha ?? 1;
        let animation = model.GeosetAnims.find(animation => animation.GeosetId === definitive);
        if (animation === undefined) {
            animation = { GeosetId: definitive, Flags: 0, Alpha: 1, Color: new Float32Array([1, 1, 1]) };
            model.GeosetAnims.push(animation);
        }
        animation.Alpha = structuredClone(alpha);
        if (typeof animation.Alpha !== 'number' && onGlobalClock(animation.Alpha)) animation.Alpha.GlobalSeqId = animation.Alpha.GlobalSeqId! + globalOffset;
    }
    // Authored sequence indices stay stable even when their intervals are out of order.
    tracks(model, track => track.Keys.sort((left, right) => left.Frame - right.Frame));
    return { model, samples, mapped: correspondence.size };
}

/** Degrees `actual` is turned from `expected` in world space. */
export function rotationError(expected: mat4, actual: mat4): number {
    // A registration stretch leaves the pose matrix sheared, and a quaternion read off a sheared matrix can
    // jump tens of degrees for a fraction-of-a-degree turn; actual * expected^-1 cancels the shared stretch.
    const turn = quat.normalize(quat.create(), mat4.getRotation(quat.create(), mat4.multiply(mat4.create(), actual, inverse(expected))));
    return 2 * Math.acos(Math.min(1, Math.abs(turn[3]))) * 180 / Math.PI;
}

export function checkRetarget(result: RetargetResult, bytes = generateHdBody(result.model)) {
    const model = parseHdBody(bytes), at = evaluator(model);
    let units = 0, degrees = 0, worst = '';
    for (const sample of result.samples) {
        const actual = at(sample.sequence, sample.frame);
        for (const [id, expected] of sample.expected) {
            const pivot = model.Nodes[id].PivotPoint;
            const distance = vec3.distance(vec3.transformMat4(vec3.create(), pivot, expected), vec3.transformMat4(vec3.create(), pivot, actual[id]));
            const angle = rotationError(expected, actual[id]);
            if (!Number.isFinite(distance + angle)) throw new Error('Non-finite HD pose');
            if (distance > units || angle > degrees) worst = `${model.Sequences[sample.sequence].Name}/${model.Nodes[id].Name}@${sample.frame}`;
            units = Math.max(units, distance); degrees = Math.max(degrees, angle);
        }
    }
    tracks(model, (track, path) => { if (track.Keys.length === 0) throw new Error(`Empty HD track ${path}`); });
    return { units, degrees, worst, samples: result.samples.length, bytes: bytes.byteLength };
}
