import { expect, test } from 'bun:test';
import { model as mdx, parseMDL } from 'war3-model';
import { stageSkyMdl } from '../scripts/stageSky';
import { retargetHd, checkRetarget, parseHdBody, generateHdBody, checkBodySkin } from '../../tools/animations/hd-retarget';
import { encodeVerified, parseSource } from '../../tools/animations/original-clips';

test('authored translations survive out-of-order sequence intervals after HD export [repro #334]', () => {
    const classic = parseMDL(stageSkyMdl('stock.blp'));
    const hd = structuredClone(classic);
    const node = classic.Bones[0];
    const target = hd.Bones[0];
    if (node === undefined || target === undefined) throw new Error('Missing fixture bone');
    const stand = classic.Sequences[0];
    if (stand === undefined) throw new Error('Missing fixture sequence');
    stand.Name = 'Stand';
    stand.Interval = new Uint32Array([0, 100]);
    hd.Sequences = structuredClone(classic.Sequences);
    classic.Sequences.push({ ...structuredClone(stand), Name: 'Authored move', Interval: new Uint32Array([200, 300]) });
    node.Translation = { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [
        { Frame: 0, Vector: new Float32Array([0, 0, 0]) },
        { Frame: 200, Vector: new Float32Array([5, 0, 0]) },
        { Frame: 300, Vector: new Float32Array([5, 0, 0]) },
    ] };
    target.PivotPoint = new Float32Array([10, 0, 0]);
    hd.PivotPoints[target.ObjectId] = target.PivotPoint;
    classic.Sequences.push({ ...structuredClone(stand), Name: 'Earlier authored move', Interval: new Uint32Array([120, 160]) });
    node.Translation.Keys.splice(1, 0,
        { Frame: 120, Vector: new Float32Array([2, 0, 0]) },
        { Frame: 160, Vector: new Float32Array([2, 0, 0]) });
    const result = retargetHd(classic, hd, [[node.Name, target.Name]], classic.Sequences.slice(1));
    expect(Array.from(result.model.Bones[0]!.Translation!.Keys[0]!.Vector)).toEqual([2, 0, 0]);
    const measured = checkRetarget(result);
    expect(measured.units).toBeLessThanOrEqual(0.5);
    expect(measured.degrees).toBeLessThanOrEqual(0.5);
    const exportedKey = result.model.Bones[0]!.Translation!.Keys[0]!;
    exportedKey.Vector[0] += 1;
    expect(checkRetarget(result).units).toBeGreaterThan(0.5);
});

test('an absent required HD joint rejects the export [spec #334]', () => {
    const source = parseMDL(stageSkyMdl('stock.blp'));
    source.Sequences[0]!.Name = 'Stand';
    expect(() => retargetHd(source, source, [[source.Bones[0]!.Name, 'missing weapon']], source.Sequences)).toThrow('Unmapped required joint');
});

test('version 1800 retains four skin IDs and four weights stored as uint16 [repro #334]', () => {
    const model = parseMDL(stageSkyMdl('stock.blp'));
    model.Version = 1800;
    for (const geoset of model.Geosets) {
        geoset.SkinWeights = new Uint8Array(geoset.Vertices.length / 3 * 8);
        for (let i = 0; i < geoset.SkinWeights.length; i += 8) geoset.SkinWeights.set([0, 0, 0, 0, 128, 127, 0, 0], i);
    }
    const bytes = generateHdBody(model);
    const skin = Buffer.from(bytes).indexOf('SKIN');
    const raw = new DataView(bytes);
    expect(Array.from({ length: 8 }, (_, i) => raw.getUint16(skin + 8 + i * 2, true))).toEqual([0, 0, 0, 0, 128, 127, 0, 0]);
    const restored = parseHdBody(bytes);
    expect(restored.Geosets.map(geoset => geoset.SkinWeights)).toEqual(model.Geosets.map(geoset => geoset.SkinWeights));
    const source = parseSource(bytes);
    expect(new Uint8Array(encodeVerified(source))).toEqual(new Uint8Array(bytes));
});

test('skin IDs address bones independently of matrix-group order [repro #334]', () => {
    const model = parseMDL(stageSkyMdl('stock.blp'));
    const bone = model.Bones[0]!;
    const second = { ...structuredClone(bone), Name: 'Second bone', ObjectId: 1 };
    model.Bones.push(second);
    for (const geoset of model.Geosets) {
        geoset.Groups = [[second.ObjectId], [bone.ObjectId]];
        geoset.SkinWeights = new Uint8Array(geoset.Vertices.length / 3 * 8);
        for (let vertex = 0; vertex < geoset.SkinWeights.length; vertex += 8) geoset.SkinWeights.set([bone.ObjectId, 0, 0, 0, 255, 0, 0, 0], vertex);
    }
    expect(checkBodySkin(model).vertices).toBe(model.Geosets.reduce((sum, geoset) => sum + geoset.Vertices.length / 3, 0));
    model.Geosets[0]!.SkinWeights![0] = 2;
    expect(() => checkBodySkin(model)).toThrow('absent bone');
});
