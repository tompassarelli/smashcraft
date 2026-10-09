





import { ModelRenderer, model as mdx } from 'war3-model';


export const KEY_BOUND = { position: 0.5, rotationDegrees: 0.5 } as const;
export type KeyBound = { readonly position: number, readonly rotationDegrees: number };

export interface KeyThinReport {
    readonly keysBefore: number;
    readonly keysAfter: number;
    readonly maxPosition: number;
    readonly maxRotationDegrees: number;
    readonly samples: number;

    readonly worst: string;
}

type Vec = ArrayLike<number>;

const at = (values: ArrayLike<number>, i: number): number => values[i] ?? 0;
function keyAt(keys: readonly mdx.AnimKeyframe[], i: number): mdx.AnimKeyframe {
    const key = keys[i];
    if (key === undefined) throw new Error(`no key ${i}`);
    return key;
}
const channels = ['Translation', 'Rotation', 'Scaling'] as const;
type Channel = typeof channels[number];


function transforms(model: mdx.Model, visit: (track: mdx.AnimVector, node: mdx.Node, channel: Channel) => void): void {
    for (const node of [...model.Bones, ...model.Helpers, ...model.Attachments, ...model.CollisionShapes]) for (const channel of channels) {
        const animated = node[channel];
        if (typeof animated !== 'object' || animated === null || !('Keys' in animated)) continue;
        if (animated.GlobalSeqId != null && animated.GlobalSeqId !== -1 && animated.GlobalSeqId !== 0xffffffff) continue;
        visit(animated, node, channel);
    }
}

function slerp(a: Vec, b: Vec, t: number): number[] {
    let [bx, by, bz, bw] = [at(b, 0), at(b, 1), at(b, 2), at(b, 3)];
    let cos = at(a, 0) * bx + at(a, 1) * by + at(a, 2) * bz + at(a, 3) * bw;
    if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let s0 = 1 - t, s1 = t;
    if (1 - cos > 1e-6) { const omega = Math.acos(cos), sin = Math.sin(omega); s0 = Math.sin((1 - t) * omega) / sin; s1 = Math.sin(t * omega) / sin; }
    return [s0 * at(a, 0) + s1 * bx, s0 * at(a, 1) + s1 * by, s0 * at(a, 2) + s1 * bz, s0 * at(a, 3) + s1 * bw];
}


function interpolate(track: mdx.AnimVector, quaternion: boolean, left: mdx.AnimKeyframe, right: mdx.AnimKeyframe, frame: number): number[] {
    const a = left.Vector, b = right.Vector;
    if (left.Frame === right.Frame || track.LineType === mdx.LineType.DontInterp) return [...a];
    const t = (frame - left.Frame) / (right.Frame - left.Frame);
    const curved = track.LineType === mdx.LineType.Hermite || track.LineType === mdx.LineType.Bezier;
    if (quaternion) {
        if (!curved) return slerp(a, b, t);
        const ends = Float32Array.from(slerp(a, b, t)), tangents = Float32Array.from(slerp(left.OutTan ?? a, right.InTan ?? b, t));
        return slerp(ends, tangents, 2 * t * (1 - t));
    }
    if (!curved) return [...a].map((x, i) => x + t * (at(b, i) - x));
    const out = left.OutTan ?? a, inn = right.InTan ?? b, tt = t * t;
    const f = track.LineType === mdx.LineType.Hermite
        ? [tt * (2 * t - 3) + 1, tt * (t - 2) + t, tt * (t - 1), tt * (3 - 2 * t)]
        : [(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * tt * (1 - t), tt * t];
    return [...a].map((x, i) => x * at(f, 0) + at(out, i) * at(f, 1) + at(inn, i) * at(f, 2) + at(b, i) * at(f, 3));
}

function difference(quaternion: boolean, a: ArrayLike<number>, b: ArrayLike<number>): number {
    if (quaternion) {
        // Float32 keys are not exactly unit length, so acos of their dot product loses small angles.
        const sign = at(a, 0) * at(b, 0) + at(a, 1) * at(b, 1) + at(a, 2) * at(b, 2) + at(a, 3) * at(b, 3) < 0 ? -1 : 1;
        let minus = 0, plus = 0;
        for (let i = 0; i < 4; i++) { minus += (at(a, i) - sign * at(b, i)) ** 2; plus += (at(a, i) + sign * at(b, i)) ** 2; }
        return 4 * Math.atan2(Math.sqrt(minus), Math.sqrt(plus));
    }
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (at(a, i) - at(b, i)) ** 2;
    return Math.sqrt(sum);
}


function levers(model: mdx.Model): Map<number, number> {
    const lever = new Map<number, number>();
    const pivot = (id: number) => model.PivotPoints[id] ?? new Float32Array(3);
    for (const node of model.Nodes) {
        if (!node) continue;
        let ancestor = node.Parent;
        for (let guard = 0; ancestor != null && ancestor >= 0 && guard < model.Nodes.length; guard++) {
            const a = pivot(ancestor), p = pivot(node.ObjectId);
            lever.set(ancestor, Math.max(lever.get(ancestor) ?? 0, Math.hypot(at(p, 0) - at(a, 0), at(p, 1) - at(a, 1), at(p, 2) - at(a, 2))));
            ancestor = model.Nodes[ancestor]?.Parent;
        }
    }
    return lever;
}


function thinTrack(track: mdx.AnimVector, quaternion: boolean, sequences: readonly mdx.Sequence[], tolerance: number): void {
    const keys = track.Keys;
    if (keys.length < 3) return;
    const keep = keys.map(key => !sequences.some(sequence => key.Frame >= at(sequence.Interval, 0) && key.Frame <= at(sequence.Interval, 1)));
    for (const sequence of sequences) {
        const inside = keys.flatMap((key, index) => key.Frame >= at(sequence.Interval, 0) && key.Frame <= at(sequence.Interval, 1) ? [index] : []);
        if (inside.length) { keep[inside[0] ?? 0] = true; keep[inside.at(-1) ?? 0] = true; }
    }
    const curved = track.LineType === mdx.LineType.Hermite || track.LineType === mdx.LineType.Bezier;

    const fits = (a: number, c: number) => {
        for (let j = a + 1; j < c; j++) {
            if (track.LineType === mdx.LineType.DontInterp) { if (difference(quaternion, keyAt(keys, j).Vector, keyAt(keys, a).Vector) !== 0) return false; continue; }
            if (difference(quaternion, interpolate(track, quaternion, keyAt(keys, a), keyAt(keys, c), keyAt(keys, j).Frame), keyAt(keys, j).Vector) > tolerance) return false;
        }
        if (curved) for (let j = a; j < c; j++) {
            const mid = (keyAt(keys, j).Frame + keyAt(keys, j + 1).Frame) / 2;
            if (difference(quaternion, interpolate(track, quaternion, keyAt(keys, a), keyAt(keys, c), mid), interpolate(track, quaternion, keyAt(keys, j), keyAt(keys, j + 1), mid)) > tolerance) return false;
        }
        return true;
    };
    for (let start = 0; start < keys.length - 1;) {
        let end = start + 1;
        while (end < keys.length && !keep[end]) end++;
        if (end === keys.length) break;
        for (let anchor = start; anchor < end;) {
            let reach = anchor + 1;
            while (reach < end && fits(anchor, reach + 1)) reach++;
            keep[reach] = true;
            anchor = reach;
        }
        start = end;
    }
    track.Keys = keys.filter((_, index) => keep[index]);
}

function thinned(source: mdx.Model, bound: KeyBound, scale: number): mdx.Model {
    const model = structuredClone(source), lever = levers(model);
    const radians = bound.rotationDegrees * Math.PI / 180;
    transforms(model, (track, node, channel) => {
        const reach = lever.get(node.ObjectId) ?? 0;
        const tolerance = scale * (channel === 'Translation' ? bound.position
            : channel === 'Rotation' ? Math.min(radians, bound.position / Math.max(reach, 1e-6))
            : bound.position / Math.max(reach, 1));
        thinTrack(track, channel === 'Rotation', model.Sequences, tolerance);
    });
    return model;
}

function nodeMatrices(renderer: ModelRenderer): readonly { readonly matrix: Float32Array }[] {
    const data: unknown = Reflect.get(renderer, 'rendererData');
    const nodes: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'nodes') : undefined;
    if (!Array.isArray(nodes)) throw new Error('war3-model renderer has no posed nodes');
    return nodes;
}

function setFrame(renderer: ModelRenderer, frame: number): void {
    Reflect.set(Reflect.get(renderer, 'rendererData'), 'frame', frame);
    renderer.update(0);
}


function rotationAngle(a: Float32Array, b: Float32Array): number | undefined {
    const column = (m: Float32Array, c: number) => {
        const length = Math.hypot(at(m, c * 4), at(m, c * 4 + 1), at(m, c * 4 + 2));
        return length < 1e-4 ? undefined : [at(m, c * 4) / length, at(m, c * 4 + 1) / length, at(m, c * 4 + 2) / length];
    };
    const ra = [0, 1, 2].map(c => column(a, c)), rb = [0, 1, 2].map(c => column(b, c));
    if (ra.some(c => c === undefined) || rb.some(c => c === undefined)) return undefined;

    const r = (i: number, j: number) => (ra[i] ?? []).reduce((sum, x, k) => sum + x * at(rb[j] ?? [], k), 0);
    const sin = Math.hypot(r(2, 1) - r(1, 2), r(0, 2) - r(2, 0), r(1, 0) - r(0, 1)) / 2;
    return Math.atan2(sin, (r(0, 0) + r(1, 1) + r(2, 2) - 1) / 2) * 180 / Math.PI;
}


export function poseError(source: mdx.Model, candidate: mdx.Model): { maxPosition: number, maxRotationDegrees: number, samples: number, worst: string } {
    const before = new ModelRenderer(source), after = new ModelRenderer(candidate);
    const frames = new Set<number>();
    transforms(source, track => { for (const key of track.Keys) frames.add(key.Frame); });
    const sorted = [...frames].sort((a, b) => a - b);
    let maxPosition = 0, maxRotationDegrees = 0, samples = 0, worst = '';
    const nodes = source.Nodes.filter(node => node != null);
    source.Sequences.forEach((sequence, index) => {
        const [start, end] = [at(sequence.Interval, 0), at(sequence.Interval, 1)];
        const inside = [start, ...sorted.filter(frame => frame > start && frame < end), end];
        const sample = inside.flatMap((frame, i) => i === 0 ? [frame] : [((inside[i - 1] ?? frame) + frame) / 2, frame]);
        before.setSequence(index); after.setSequence(index);
        for (const frame of sample) {
            setFrame(before, frame); setFrame(after, frame);
            const a = nodeMatrices(before), b = nodeMatrices(after);
            for (const node of nodes) {
                const ma = a[node.ObjectId]?.matrix, mb = b[node.ObjectId]?.matrix;
                if (ma === undefined || mb === undefined) continue;
                const p = source.PivotPoints[node.ObjectId] ?? new Float32Array(3);
                let squared = 0;
                for (let row = 0; row < 3; row++) {
                    const d = (at(ma, row) - at(mb, row)) * at(p, 0) + (at(ma, 4 + row) - at(mb, 4 + row)) * at(p, 1) + (at(ma, 8 + row) - at(mb, 8 + row)) * at(p, 2) + at(ma, 12 + row) - at(mb, 12 + row);
                    squared += d * d;
                }
                if (Math.sqrt(squared) > maxPosition) worst = `${sequence.Name} @${frame} node ${node.Name}`;
                maxPosition = Math.max(maxPosition, Math.sqrt(squared));
                maxRotationDegrees = Math.max(maxRotationDegrees, rotationAngle(ma, mb) ?? 0);
            }
            samples++;
        }
    });
    return { maxPosition, maxRotationDegrees, samples, worst };
}

const keyCount = (model: mdx.Model) => { let count = 0; transforms(model, track => { count += track.Keys.length; }); return count; };






export function thinKeys(source: mdx.Model, bound: KeyBound = KEY_BOUND): { model: mdx.Model, report: KeyThinReport } {
    for (let scale = 0.5; scale > 0.01; scale *= 0.6) {
        const model = thinned(source, bound, scale), error = poseError(source, model);
        if (error.maxPosition <= bound.position && error.maxRotationDegrees <= bound.rotationDegrees)
            return { model, report: { keysBefore: keyCount(source), keysAfter: keyCount(model), ...error } };
    }
    return { model: structuredClone(source), report: { keysBefore: keyCount(source), keysAfter: keyCount(source), maxPosition: 0, maxRotationDegrees: 0, samples: 0, worst: '' } };
}







export function savedKeyBytes(source: mdx.Model, thinned: mdx.Model, interval: readonly number[]): number {
    const inside = (track: mdx.AnimVector) => track.Keys.reduce((count, key) => count + (key.Frame >= at(interval, 0) && key.Frame <= at(interval, 1) ? 1 : 0), 0);
    const before: number[] = [], after: number[] = [];
    transforms(source, (track, _node, channel) => {
        const curved = track.LineType === mdx.LineType.Hermite || track.LineType === mdx.LineType.Bezier;
        before.push(inside(track) * (4 + (channel === 'Rotation' ? 16 : 12) * (curved ? 3 : 1)));
    });
    transforms(thinned, (track, _node, channel) => {
        const curved = track.LineType === mdx.LineType.Hermite || track.LineType === mdx.LineType.Bezier;
        after.push(inside(track) * (4 + (channel === 'Rotation' ? 16 : 12) * (curved ? 3 : 1)));
    });
    if (before.length !== after.length) throw new Error('thinned model has different transform tracks');
    return before.reduce((sum, bytes, index) => sum + bytes - (after[index] ?? 0), 0);
}
