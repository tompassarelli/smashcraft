import { ModelRenderer } from 'war3-model';
import { mat4, quat, vec3 } from 'gl-matrix';
import { model as mdx, parseMDX, generateMDX } from '../../ts/scripts/clipNodes';
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
    return parseMDX(hdChunks(bytes, false));
}

export function generateHdBody(model: mdx.Model): ArrayBuffer {
    return hdChunks(generateMDX(model), true);
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

function hdChunks(bytes: ArrayBuffer, writing: boolean): ArrayBuffer {
    const data = new Uint8Array(bytes), view = new DataView(bytes);
    const chunks = [data.slice(0, 4)];
    let version = 800;
    for (let offset = 4; offset < data.length;) {
        if (offset + 8 > data.length) throw new Error('Truncated HD chunk');
        const size = view.getUint32(offset + 4, true), end = offset + 8 + size;
        if (end > data.length) throw new Error('Truncated HD chunk body');
        const tag = new TextDecoder().decode(data.subarray(offset, offset + 4));
        if (tag === 'VERS') version = view.getUint32(offset + 8, true);
        if (tag === 'GEOS' && version >= 1800) {
            const geosets: Uint8Array[] = [];
            for (let start = offset + 8; start < end;) {
                const length = view.getUint32(start, true), stop = start + length;
                if (stop > end || length < 12) throw new Error('Truncated HD geoset');
                const geoset = data.slice(start, stop);
                const skin = Buffer.from(geoset).indexOf('SKIN');
                if (skin < 0) geosets.push(geoset);
                else {
                    const count = new DataView(geoset.buffer).getUint32(skin + 4, true);
                    const width = writing ? 1 : 2, next = skin + 8 + count * width;
                    if (Buffer.from(geoset.subarray(next, next + 4)).toString() !== 'UVAS') throw new Error('Unexpected HD skin layout');
                    const packed = new Uint8Array(count * (writing ? 2 : 1));
                    for (let i = 0; i < count; i++) {
                        const value = writing ? geoset[skin + 8 + i] : new DataView(geoset.buffer).getUint16(skin + 8 + i * 2, true);
                        if (value > 255) throw new Error('HD skin value exceeds the model parser limit');
                        packed[i * (writing ? 2 : 1)] = value;
                    }
                    const changed = new Uint8Array(skin + 8 + packed.length + length - next);
                    changed.set(geoset.subarray(0, skin + 8)); changed.set(packed, skin + 8); changed.set(geoset.subarray(next), skin + 8 + packed.length);
                    new DataView(changed.buffer).setUint32(0, changed.length, true);
                    geosets.push(changed);
                }
                start = stop;
            }
            const changed = new Uint8Array(8 + geosets.reduce((sum, geoset) => sum + geoset.length, 0));
            changed.set(data.subarray(offset, offset + 4)); new DataView(changed.buffer).setUint32(4, changed.length - 8, true);
            let cursor = 8; for (const geoset of geosets) { changed.set(geoset, cursor); cursor += geoset.length; }
            chunks.push(changed);
        } else if (tag !== 'CAMS') chunks.push(data.slice(offset, end));
        offset = end;
    }
    const output = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output.buffer;
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

export function retargetHd(source: mdx.Model, hd: mdx.Model, pairs: readonly (readonly [string, string])[], sequences: readonly mdx.Sequence[]): RetargetResult {
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
    for (const node of model.Bones) { delete node.Translation; delete node.Rotation; delete node.Scaling; }
    const samples: RetargetSample[] = [];
    for (const sequence of sequences) {
        const index = source.Sequences.indexOf(sequence), [start, end] = sequence.Interval;
        const frames = new Set<number>([start, end]);
        tracks(source, track => { if (!onGlobalClock(track)) for (const key of track.Keys) if (key.Frame >= start && key.Frame <= end) frames.add(key.Frame); });
        for (const frame of [...frames].sort((a, b) => a - b)) {
            const reference = sourceAt(index, frame), desired = new Map<number, mat4>();
            const world = (node: mdx.Node): mat4 => {
                const cached = desired.get(node.ObjectId);
                if (cached !== undefined) return cached;
                const from = correspondence.get(node.ObjectId);
                const parent = node.Parent == null ? undefined : model.Nodes[node.Parent];
                const result = from !== undefined
                    ? mat4.multiply(mat4.create(), reference[from], registration.get(node.ObjectId)!)
                    : parent === undefined ? mat4.clone(referenceLocal.get(node.ObjectId)!)
                    : mat4.multiply(mat4.create(), world(parent), referenceLocal.get(node.ObjectId)!);
                desired.set(node.ObjectId, result);
                return result;
            };
            for (const node of model.Bones) {
                const target = world(node);
                if (!correspondence.has(node.ObjectId)) {
                    if (frame === start || frame === end) appendTransform(node, referenceLocal.get(node.ObjectId)!, frame);
                    continue;
                }
                const local = node.Parent == null ? target : mat4.multiply(mat4.create(), inverse(world(model.Nodes[node.Parent])), target);
                appendTransform(node, local, frame);
            }
            samples.push({ sequence: index, frame, expected: new Map([...correspondence].map(([id]) => [id, desired.get(id)!])) });
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
    // Authored sequence indices stay stable even when their intervals are out of order.
    tracks(model, track => track.Keys.sort((left, right) => left.Frame - right.Frame));
    return { model, samples, mapped: correspondence.size };
}

export function checkRetarget(result: RetargetResult, bytes = generateHdBody(result.model)) {
    const model = parseHdBody(bytes), at = evaluator(model);
    let units = 0, degrees = 0, worst = '';
    for (const sample of result.samples) {
        const actual = at(sample.sequence, sample.frame);
        for (const [id, expected] of sample.expected) {
            const pivot = model.Nodes[id].PivotPoint;
            const distance = vec3.distance(vec3.transformMat4(vec3.create(), pivot, expected), vec3.transformMat4(vec3.create(), pivot, actual[id]));
            const left = quat.normalize(quat.create(), mat4.getRotation(quat.create(), expected));
            const right = quat.normalize(quat.create(), mat4.getRotation(quat.create(), actual[id]));
            const angle = 2 * Math.acos(Math.min(1, Math.abs(quat.dot(left, right)))) * 180 / Math.PI;
            if (!Number.isFinite(distance + angle)) throw new Error('Non-finite HD pose');
            if (distance > units || angle > degrees) worst = `${model.Sequences[sample.sequence].Name}/${model.Nodes[id].Name}@${sample.frame}`;
            units = Math.max(units, distance); degrees = Math.max(degrees, angle);
        }
    }
    tracks(model, (track, path) => { if (track.Keys.length === 0) throw new Error(`Empty HD track ${path}`); });
    return { units, degrees, worst, samples: result.samples.length, bytes: bytes.byteLength };
}
