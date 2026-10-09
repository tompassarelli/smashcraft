import { model as mdx, renumberNodes } from '../../ts/scripts/clipNodes';
import { bounds, onGlobalClock, removeBodyEffects, splitStaticLights, tracks, verifyPreservedBody } from './original-clips';

function clearTrack(model: mdx.Model, path: string): void {
    const parts = path.slice(1).split('.');
    const property = parts.pop();
    if (property === undefined) throw new Error(`Missing track property ${path}`);
    let owner: object = model;
    for (const part of parts) owner = Reflect.get(owner, part);
    if (/^\.(GeosetAnims\.\d+|Materials\.\d+\.Layers\.\d+)\.Alpha$/.test(path)) Reflect.set(owner, property, 1);
    else if (/^\.GeosetAnims\.\d+\.Color$/.test(path)) Reflect.set(owner, property, new Float32Array([1, 1, 1]));
    else Reflect.deleteProperty(owner, property);
}

function preserveNonunitHolds(source: mdx.Model, model: mdx.Model, sequences: readonly mdx.Sequence[]): void {
    for (const [index, original] of source.Bones.entries()) {
        const rotation = original.Rotation, bone = model.Bones[index];
        if (rotation === undefined || onGlobalClock(rotation) || bone.Rotation === undefined || rotation.LineType === mdx.LineType.DontInterp) continue;
        const holds: { start: number; end: number; vector: Float32Array }[] = [];
        for (const sequence of sequences) {
            const [start, end] = sequence.Interval;
            const active = rotation.Keys.filter(key => key.Frame >= start && key.Frame <= end);
            const first = active[0], last = active.at(-1);
            if (first !== undefined && first.Frame > start) holds.push({ start, end: first.Frame - 1, vector: new Float32Array(first.Vector) });
            if (last !== undefined && last.Frame < end) holds.push({ start: last.Frame + 1, end, vector: new Float32Array(last.Vector) });
        }
        const nonunit = holds.filter(hold => hold.vector.reduce((sum, value) => sum + value * value, 0) < 1 - 1e-6);
        if (nonunit.length === 0) continue;
        if (rotation.LineType !== mdx.LineType.Linear) throw new Error(`${original.Name}: unsupported nonunit rotation hold interpolation`);
        const identity = new Float32Array([0, 0, 0, 1]);
        const unitScale = new Float32Array([1, 1, 1]);
        const step = (vector: Float32Array): mdx.AnimVector => ({ LineType: mdx.LineType.DontInterp, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: vector }] });
        const axisTrack = step(identity), scaleTrack = step(unitScale), inverseTrack = step(identity);
        for (const { start, end, vector: q } of nonunit) {
            const [x, y, z, w] = q;
            const length = Math.hypot(x, y, z);
            if (length === 0) continue;
            const axis = [x / length, y / length, z / length];
            const real = 1 - 2 * length * length, imaginary = 2 * w * length;
            const scale = Math.hypot(real, imaginary), halfAngle = Math.atan2(imaginary, real) / 2;
            const polar = new Float32Array([...axis.map(value => value * Math.sin(halfAngle)), Math.cos(halfAngle)]);
            const axisRotation = axis[2] < -1 + 1e-10 ? new Float32Array([1, 0, 0, 0]) : new Float32Array([-axis[1], axis[0], 0, 1 + axis[2]]);
            const axisNorm = Math.hypot(...axisRotation);
            for (let component = 0; component < axisRotation.length; component++) axisRotation[component] /= axisNorm;
            const inverse = new Float32Array([-axisRotation[0], -axisRotation[1], -axisRotation[2], axisRotation[3]]);


            for (const frame of [start, end]) {
                const existing = bone.Rotation.Keys.find(key => key.Frame === frame);
                if (existing !== undefined) existing.Vector = polar;
                else bone.Rotation.Keys.push({ Frame: frame, Vector: polar });
            }
            for (const [track, vector, reset] of [[axisTrack, axisRotation, identity], [scaleTrack, new Float32Array([scale, scale, 1]), unitScale], [inverseTrack, inverse, identity]] as const) {
                track.Keys.push({ Frame: start, Vector: vector }, { Frame: end + 1, Vector: reset });
            }
        }
        bone.Rotation.Keys.sort((a, b) => a.Frame - b.Frame);
        const children = model.Nodes.filter(node => node.Parent === bone.ObjectId);
        let parent = bone.ObjectId;
        for (const [suffix, property, track] of [['axis', 'Rotation', axisTrack], ['stretch', 'Scaling', scaleTrack], ['inverse', 'Rotation', inverseTrack]] as const) {
            track.Keys.sort((a, b) => a.Frame - b.Frame);
            const id = model.PivotPoints.length;
            const node: mdx.Node = { Name: `${bone.Name} hold ${suffix}`, ObjectId: id, Parent: parent, Flags: 0, PivotPoint: new Float32Array(bone.PivotPoint), [property]: track };
            // HD and Definitive skin the moved vertices only when the final node is a bone.

            if (suffix === 'inverse') model.Bones.push({ ...node, GeosetId: bone.GeosetId, GeosetAnimId: bone.GeosetAnimId });
            else model.Helpers.push(node);
            model.PivotPoints.push(node.PivotPoint);
            parent = id;
        }
        for (const child of children) child.Parent = parent;
        for (const geoset of model.Geosets) {
            geoset.Groups = geoset.Groups.map(group => group.map(id => id === bone.ObjectId ? parent : id));
            if (geoset.SkinWeights !== undefined) for (let offset = 0; offset < geoset.SkinWeights.length; offset += 8) {
                for (let influence = 0; influence < 4; influence++) if (geoset.SkinWeights[offset + influence] === bone.ObjectId && geoset.SkinWeights[offset + 4 + influence] > 0) geoset.SkinWeights[offset + influence] = parent;
            }
        }
    }
    renumberNodes(model);
}

export function timelineBody(source: mdx.Model, sequences: readonly mdx.Sequence[]): mdx.Model {
    const model = splitStaticLights(source).body;
    removeBodyEffects(model);
    const first = sequences[0];
    if (first === undefined) throw new Error('Timeline body has no sequences');

    tracks(model, (track, path) => {
        if (onGlobalClock(track)) return;
        const transform = /^\.(Bones|Helpers|Attachments|CollisionShapes|TextureAnims)\.\d+\.(Translation|Rotation|Scaling)$/.test(path);
        const alpha = /^\.(GeosetAnims\.\d+|Materials\.\d+\.Layers\.\d+)\.Alpha$/.test(path);
        const color = /^\.GeosetAnims\.\d+\.Color$/.test(path);
        const visibility = /^\.Attachments\.\d+\.Visibility$/.test(path);
        if (!transform && !alpha && !color && !visibility) throw new Error(`Unsupported timeline channel ${path}`);
        const defaults = alpha || visibility ? [1] : color || path.endsWith('Scaling') ? [1, 1, 1] : path.endsWith('Rotation') ? [0, 0, 0, 1] : [0, 0, 0];
        const keys = track.Keys.filter(key => sequences.some(sequence => key.Frame >= sequence.Interval[0] && key.Frame <= sequence.Interval[1]));
        if (keys.length === 0) {
            clearTrack(model, path);
            return;
        }
        const added: mdx.AnimKeyframe[] = [];
        const flatHandle = (vector: Float32Array | Int32Array) => path.endsWith('Rotation') || track.LineType === mdx.LineType.Bezier
            ? new Float32Array(vector) : new Float32Array(vector.length);
        for (const sequence of sequences) {
            const [start, end] = sequence.Interval;
            const active = keys.filter(key => key.Frame >= start && key.Frame <= end);
            for (const [frame, edge, incoming] of [[start, active[0], true], [end, active.at(-1), false]] as const) {
                if (keys.some(key => key.Frame === frame)) continue;
                const key: mdx.AnimKeyframe = edge === undefined ? { Frame: frame, Vector: new Float32Array(defaults) } : { ...structuredClone(edge), Frame: frame };
                if (track.LineType >= mdx.LineType.Hermite) {
                    key.InTan = flatHandle(key.Vector);
                    key.OutTan = flatHandle(key.Vector);

                    if (edge !== undefined) edge[incoming ? 'InTan' : 'OutTan'] = flatHandle(edge.Vector);
                }
                added.push(key);
            }
        }
        track.Keys = [...keys, ...added].sort((a, b) => a.Frame - b.Frame);
    });
    model.Sequences = [{ ...first, Name: 'Stand', Interval: new Uint32Array([0, Math.max(...sequences.map(sequence => sequence.Interval[1]))]), NonLooping: true, ...bounds(sequences) }];
    for (const geoset of model.Geosets) geoset.Anims = [bounds(geoset.Anims.length > 0 ? geoset.Anims : [geoset])];
    renumberNodes(model);
    verifyPreservedBody(source, model);
    preserveNonunitHolds(source, model, sequences);
    tracks(model, (track, path) => { if (track.Keys.length === 0) clearTrack(model, path); });
    return model;
}
