import { isDeepStrictEqual } from 'node:util';
import { ModelRenderer, model as mdx } from '../../ts/scripts/clipNodes';

function visibility(model: mdx.Model) {
    const renderer = new ModelRenderer(model);
    const alpha: unknown = Reflect.get(renderer, 'findAlpha');
    const interpolation: unknown = Reflect.get(renderer, 'interp');
    if (typeof alpha !== 'function' || typeof interpolation !== 'object' || interpolation === null) throw new Error('Model renderer has no visibility sampler');
    const value: unknown = Reflect.get(interpolation, 'animVectorVal');
    if (typeof value !== 'function') throw new Error('Model renderer has no material sampler');
    return (sequence: number, frame: number, geoset: number) => {
        renderer.setSequence(sequence);
        renderer.setFrame(frame);
        const opacity: number = alpha.call(renderer, geoset);
        const material = model.Materials[model.Geosets[geoset].MaterialID];
        return opacity > 0 && material.Layers.some(layer => layer.FilterMode <= 2 && value.call(interpolation, layer.Alpha, 1) > 0);
    };
}

/** A timeline keeps the source's visible body parts at the same pose, including authored form changes. */
export function checkTimelineGeosets(source: mdx.Model, body: mdx.Model, sequences: readonly mdx.Sequence[]) {
    for (const [index, geoset] of source.Geosets.entries()) {
        const actual = body.Geosets[index];
        if (actual === undefined || !isDeepStrictEqual(geoset.Vertices, actual.Vertices) || !isDeepStrictEqual(geoset.Faces, actual.Faces)) {
            throw new Error(`Source geoset ${index}/${geoset.Name ?? 'body'} is missing or changed`);
        }
    }
    const reference = visibility(source), drawn = visibility(body);
    let samples = 0, visible = 0;
    for (const sequence of sequences) {
        const index = source.Sequences.indexOf(sequence);
        if (index < 0) throw new Error(`Unknown source sequence ${sequence.Name}`);
        const [start, end] = sequence.Interval;
        for (let frame = start; ; frame = Math.min(end, frame + 1000 / 60)) {
            for (let geoset = 0; geoset < source.Geosets.length; geoset++) {
                if (!reference(index, frame, geoset)) continue;
                if (!drawn(0, frame, geoset)) throw new Error(`${sequence.Name}@${frame}: source geoset ${geoset}/${source.Geosets[geoset].Name ?? 'body'} is hidden`);
                visible++;
            }
            samples++;
            if (frame === end) break;
        }
    }
    return { geosets: source.Geosets.length, clips: sequences.length, samples, visible };
}
