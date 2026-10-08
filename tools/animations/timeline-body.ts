import { model as mdx, renumberNodes } from '../../ts/scripts/clipNodes';
import { bounds, onGlobalClock, removeBodyEffects, splitStaticLights, tracks, verifyPreservedBody } from './original-clips';

export function timelineBody(source: mdx.Model, sequences: readonly mdx.Sequence[]): mdx.Model {
    const model = splitStaticLights(source).body;
    removeBodyEffects(model);
    const first = sequences[0];
    if (first === undefined) throw new Error('Timeline body has no sequences');
    // Missing sequence-local channels use the native static backing, not neighbouring clips.
    tracks(model, (track, path) => {
        if (onGlobalClock(track)) return;
        const transform = /^\.(Bones|Helpers|Attachments|CollisionShapes)\.\d+\.(Translation|Rotation|Scaling)$/.test(path);
        const alpha = /^\.(GeosetAnims\.\d+|Materials\.\d+\.Layers\.\d+)\.Alpha$/.test(path);
        const color = /^\.GeosetAnims\.\d+\.Color$/.test(path);
        const visibility = /^\.Attachments\.\d+\.Visibility$/.test(path);
        if (!transform && !alpha && !color && !visibility) throw new Error(`Unsupported timeline channel ${path}`);
        const defaults = alpha || visibility ? [1] : color || path.endsWith('Scaling') ? [1, 1, 1] : path.endsWith('Rotation') ? [0, 0, 0, 1] : [0, 0, 0];
        const keys = track.Keys.filter(key => sequences.some(sequence => key.Frame >= sequence.Interval[0] && key.Frame <= sequence.Interval[1]));
        if (keys.length === 0) {
            const parts = path.slice(1).split('.');
            const property = parts.pop();
            if (property === undefined) throw new Error(`Missing track property ${path}`);
            let owner: object = model;
            for (const part of parts) owner = Reflect.get(owner, part);
            if (alpha) Reflect.set(owner, property, 1);
            else if (color) Reflect.set(owner, property, new Float32Array([1, 1, 1]));
            else Reflect.deleteProperty(owner, property);
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
                    // Native clips clamp outside their first/last key; those unused handles now join the hold.
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
    return model;
}
