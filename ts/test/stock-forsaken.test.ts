import { expect, test } from 'bun:test';
import { parseMDL, model as mdx } from 'war3-model';
import { stageSkyMdl } from '../scripts/stageSky';
import { checkStockGeosets, restoreStockForsaken } from '../../tools/animations/stock-forsaken';

function stockBody() {
    const model = parseMDL(stageSkyMdl('private.blp'));
    model.Version = 1800;
    const original = model.Geosets[0];
    const bone = model.Bones[0];
    if (original === undefined || bone === undefined) throw new Error('Missing fixture body');
    original.Name = 'Head';
    original.SkinWeights = new Uint8Array(original.Vertices.length / 3 * 8);
    for (let offset = 0; offset < original.SkinWeights.length; offset += 8) {
        original.SkinWeights[offset] = bone.ObjectId;
        original.SkinWeights[offset + 4] = 255;
    }
    const sword = structuredClone(original);
    sword.Name = 'Sword';
    model.Geosets.push(sword);
    return model;
}

test('restoring stock Forsaken keeps head and sword geometry while retaining shipped motion [repro #328]', () => {
    const stock = stockBody(), authored = structuredClone(stock);
    authored.Version = 1100;
    authored.Geosets = [];
    const bone = authored.Bones[0];
    if (bone === undefined) throw new Error('Missing fixture bone');
    bone.Translation = { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [
        { Frame: 0, Vector: new Float32Array([0, 0, 0]) },
        { Frame: 1000, Vector: new Float32Array([5, 0, 0]) },
    ] };
    expect(() => checkStockGeosets(stock, authored, authored.Sequences)).toThrow('missing or changed');
    const restored = restoreStockForsaken(stock, authored);
    expect(restored.Version).toBe(1800);
    expect(restored.Bones[0]?.Translation).toEqual(bone.Translation);
    expect(checkStockGeosets(stock, restored, restored.Sequences).required.map(geoset => geoset.name)).toEqual(['Head', 'Sword']);
});

test('the stock geoset check rejects an invisible head and incomplete sword weights [repro #328]', () => {
    const stock = stockBody(), hidden = structuredClone(stock);
    hidden.GeosetAnims = [{ GeosetId: 0, Alpha: 0, Color: new Float32Array([1, 1, 1]), Flags: 0 }];
    expect(() => checkStockGeosets(stock, hidden, hidden.Sequences)).toThrow('is hidden');
    const incomplete = structuredClone(stock);
    const skin = incomplete.Geosets[1]?.SkinWeights;
    if (skin === undefined) throw new Error('Missing fixture sword skin');
    skin[4] = 0;
    expect(() => checkStockGeosets(stock, incomplete, incomplete.Sequences)).toThrow('incomplete weights');
});
