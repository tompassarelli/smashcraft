import { isDeepStrictEqual } from 'node:util';
import { ModelRenderer, model as mdx } from 'war3-model';

export function restoreStockForsaken(stock: mdx.Model, authored: mdx.Model): mdx.Model {
    const model = structuredClone(authored);
    const ids = new Map<number, number>();
    for (const bone of stock.Bones) {
        const target = model.Bones.find(candidate => candidate.Name === bone.Name);
        if (target === undefined || !isDeepStrictEqual(stock.PivotPoints[bone.ObjectId], model.PivotPoints[target.ObjectId])) {
            throw new Error(`Authored Forsaken changed stock joint ${bone.Name}`);
        }
        const parent = stock.Nodes[bone.Parent ?? -1]?.Name;
        if (parent !== model.Nodes[target.Parent ?? -1]?.Name) throw new Error(`${bone.Name}: stock parent changed`);
        ids.set(bone.ObjectId, target.ObjectId);
    }
    const remap = (id: number) => {
        const target = ids.get(id);
        if (target === undefined) throw new Error(`Stock Forsaken mesh uses unmapped joint ${id}`);
        return target;
    };
    model.Version = stock.Version;
    model.Geosets = structuredClone(stock.Geosets);
    for (const geoset of model.Geosets) {
        geoset.Groups = geoset.Groups.map(group => group.map(remap));
        if (geoset.SkinWeights !== undefined) for (let offset = 0; offset < geoset.SkinWeights.length; offset += 8) {
            for (let influence = 0; influence < 4; influence++) if (geoset.SkinWeights[offset + 4 + influence] > 0) {
                geoset.SkinWeights[offset + influence] = remap(geoset.SkinWeights[offset + influence]);
            }
        }
        geoset.Anims = model.Sequences.map(sequence => ({ MinimumExtent: sequence.MinimumExtent,
            MaximumExtent: sequence.MaximumExtent, BoundsRadius: sequence.BoundsRadius }));
    }
    model.Textures = structuredClone(stock.Textures);
    model.Materials = structuredClone(stock.Materials);
    model.TextureAnims = structuredClone(stock.TextureAnims);
    model.Cameras = [];
    return model;
}

export function checkStockGeosets(stock: mdx.Model, model: mdx.Model, sequences: readonly mdx.Sequence[]) {
    const renderer = new ModelRenderer(model), reference = new ModelRenderer(stock);
    const data = Reflect.get(renderer, 'rendererData'), stockData = Reflect.get(reference, 'rendererData');
    const stand = stock.Sequences.findIndex(sequence => /^Stand(?:\s+\d+)?$/.test(sequence.Name));
    if (stand < 0) throw new Error('Stock model has no Stand');
    reference.setSequence(stand); stockData.frame = stock.Sequences[stand].Interval[0]; reference.update(0);
    const required = stock.Geosets.flatMap((geoset, index) => stock.Materials[geoset.MaterialID].Layers.some(layer => layer.FilterMode <= 2)
        && stockData.geosetAlpha[index] > 0 ? [index] : []);
    for (const index of required) {
        const original = stock.Geosets[index], actual = model.Geosets[index];
        if (actual === undefined || !isDeepStrictEqual(original.Vertices, actual.Vertices)
            || !isDeepStrictEqual(original.Faces, actual.Faces)) throw new Error(`Stock geoset ${index}/${original.Name} is missing or changed`);
        const skin = actual.SkinWeights;
        if (skin === undefined || skin.length !== actual.Vertices.length / 3 * 8) throw new Error(`Stock geoset ${index} has incomplete skin`);
        for (let vertex = 0; vertex < skin.length; vertex += 8) {
            let weight = 0;
            for (let influence = 0; influence < 4; influence++) {
                weight += skin[vertex + 4 + influence];
                if (skin[vertex + 4 + influence] > 0 && model.Nodes[skin[vertex + influence]] === undefined) {
                    throw new Error(`Stock geoset ${index} vertex ${vertex / 8} uses an absent joint`);
                }
            }
            if (weight !== 255) throw new Error(`Stock geoset ${index} vertex ${vertex / 8} has incomplete weights`);
        }
    }
    let samples = 0;
    for (const sequence of sequences) {
        renderer.setSequence(model.Sequences.indexOf(sequence));
        const [start, end] = sequence.Interval;
        for (let frame = start; frame <= end; frame = Math.min(end, frame + 1000 / 60)) {
            data.frame = frame; renderer.update(0);
            for (const index of required) if (data.geosetAlpha[index] <= 0) {
                throw new Error(`${sequence.Name}@${frame}: stock geoset ${index}/${stock.Geosets[index].Name} is hidden`);
            }
            samples++;
            if (frame === end) break;
        }
    }
    return { required: required.map(index => ({ index, name: stock.Geosets[index].Name,
        vertices: stock.Geosets[index].Vertices.length / 3 })), samples };
}
