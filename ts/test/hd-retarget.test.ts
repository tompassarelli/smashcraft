import { expect, test } from 'bun:test';
import { model as mdx, parseMDL } from 'war3-model';
import { stageSkyMdl } from '../scripts/stageSky';
import { retargetHd, checkRetarget, rotationError, parseHdBody, generateHdBody, checkBodySkin } from '../../tools/animations/hd-retarget';
import { encodeVerified, parseSource } from '../../tools/animations/original-clips';
import { DrawnModel } from '../scripts/wisp/hurtboxView';
import { timelineBody } from '../../tools/animations/timeline-body';
import { mat4, quat } from 'gl-matrix';

test('registered alternate meshes retain authored hide and show keys in the Definitive timeline [spec #334]', () => {
    const source = parseMDL(stageSkyMdl('stock.blp'));
    source.Sequences[0]!.Name = 'Stand';
    source.Sequences[0]!.Interval = new Uint32Array([0, 100]);
    source.Sequences.push({ ...structuredClone(source.Sequences[0]!), Name: 'Alternate form', Interval: new Uint32Array([200, 300]) });
    const alpha = { LineType: mdx.LineType.DontInterp, GlobalSeqId: null, Keys: [
        { Frame: 200, Vector: new Float32Array([0]) },
        { Frame: 250, Vector: new Float32Array([1]) },
    ] };
    source.GeosetAnims.push({ GeosetId: 0, Flags: 0, Alpha: alpha, Color: new Float32Array([1, 1, 1]) });
    const hd = structuredClone(source);
    hd.GeosetAnims[0]!.Alpha = 1;
    const result = retargetHd(source, hd, [[source.Bones[0]!.Name, hd.Bones[0]!.Name]], source.Sequences, [[0, 0]]);
    const timeline = parseHdBody(generateHdBody(timelineBody(result.model, source.Sequences)));
    const output = timeline.GeosetAnims[0]!.Alpha;
    if (typeof output === 'number') throw new Error('Alternate form lost its animation');
    expect(output.Keys.find(key => key.Frame === 0)?.Vector[0]).toBe(1);
    expect(output.Keys.find(key => key.Frame === 200)?.Vector[0]).toBe(0);
    expect(output.Keys.find(key => key.Frame === 250)?.Vector[0]).toBe(1);
});

test('a nonuniform authored recovery squash preserves rotated Definitive joints and bone-only skin [repro #334]', () => {
    const classic = parseMDL(stageSkyMdl('stock.blp'));
    classic.Sequences[0]!.Name = 'Stand';
    classic.Sequences[0]!.Interval = new Uint32Array([0, 100]);
    const hd = structuredClone(classic);
    hd.Version = 1800;
    const node = classic.Bones[0]!, target = hd.Bones[0]!;
    target.Rotation = { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [
        { Frame: 0, Vector: new Float32Array([0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)]) },
    ] };
    target.PivotPoint = new Float32Array([10, 0, 10]);
    hd.PivotPoints[target.ObjectId] = target.PivotPoint;
    for (const geoset of hd.Geosets) {
        geoset.Vertices = geoset.Vertices.slice(0, 9);
        geoset.Normals = geoset.Normals.slice(0, 9);
        geoset.VertexGroup = geoset.VertexGroup.slice(0, 3);
        geoset.Faces = new Uint16Array([0, 1, 2]);
        geoset.TVertices = geoset.TVertices.map(values => values.slice(0, 6));
        geoset.SkinWeights = new Uint8Array(geoset.Vertices.length / 3 * 8);
        for (let i = 0; i < geoset.SkinWeights.length; i += 8) geoset.SkinWeights.set([0, 0, 0, 0, 255, 0, 0, 0], i);
    }
    classic.Sequences.push({ ...structuredClone(classic.Sequences[0]!), Name: 'Recovery squash', Interval: new Uint32Array([200, 300]) });
    node.Scaling = { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [
        { Frame: 0, Vector: new Float32Array([1, 1, 1]) },
        { Frame: 200, Vector: new Float32Array([1, 1, 0.15]) },
        { Frame: 300, Vector: new Float32Array([1, 1, 0.15]) },
    ] };
    const sequences = classic.Sequences.slice(1);
    const result = retargetHd(classic, hd, [[node.Name, target.Name]], sequences);
    const bytes = generateHdBody(timelineBody(result.model, sequences));
    const measured = checkRetarget({ ...result, samples: result.samples.map(sample => ({ ...sample, sequence: 0 })) }, bytes);
    expect(measured.units).toBeLessThanOrEqual(0.5);
    expect(measured.degrees).toBeLessThanOrEqual(0.5);
    expect(checkBodySkin(parseHdBody(bytes))).toEqual(checkBodySkin(hd));
    const drawn = new DrawnModel(bytes, 1).triangles(0, 0.2, 1);
    let corner = 0;
    for (const geoset of hd.Geosets) for (const vertex of geoset.Faces) {
        const x = geoset.Vertices[vertex * 3]!, z = geoset.Vertices[vertex * 3 + 2]!;
        const rotatedX = 10 + (x - 10 + z - 10) / Math.sqrt(2);
        const rotatedZ = 10 + (-(x - 10) + z - 10) / Math.sqrt(2);
        expect(drawn[corner++]).toBeCloseTo(rotatedX, 2);
        expect(drawn[corner++]).toBeCloseTo(rotatedZ * 0.15, 2);
    }
});

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
    const authored = result.model.Bones.find(bone => bone.Name === `Authored ${node.Name}`);
    expect(Array.from(authored!.Translation!.Keys.find(key => key.Frame === 120)!.Vector)).toEqual([2, 0, 0]);
    const measured = checkRetarget(result);
    expect(measured.units).toBeLessThanOrEqual(0.5);
    expect(measured.degrees).toBeLessThanOrEqual(0.5);
    const exportedKey = result.model.Bones[0]!.Translation!.Keys[0]!;
    exportedKey.Vector[0] += 1;
    expect(checkRetarget(result).units).toBeGreaterThan(0.5);
});

test('a sheared Stand registration retains its fixed stretch through authored motion [repro #334]', () => {
    const classic = parseMDL(stageSkyMdl('stock.blp'));
    classic.Sequences[0]!.Name = 'Stand';
    classic.Sequences[0]!.Interval = new Uint32Array([0, 100]);
    const hd = structuredClone(classic);
    const node = classic.Bones[0]!, target = hd.Bones[0]!;
    target.Rotation = { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [
        { Frame: 0, Vector: new Float32Array([0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)]) },
    ] };
    classic.Sequences.push({ ...structuredClone(classic.Sequences[0]!), Name: 'Authored move', Interval: new Uint32Array([200, 300]) });
    node.Scaling = { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [
        { Frame: 0, Vector: new Float32Array([1, 1, 0.15]) },
        { Frame: 200, Vector: new Float32Array([1, 1, 1]) },
        { Frame: 300, Vector: new Float32Array([1, 1, 1]) },
    ] };
    const sequences = classic.Sequences.slice(1);
    const result = retargetHd(classic, hd, [[node.Name, target.Name]], sequences);
    const bytes = generateHdBody(timelineBody(result.model, sequences));
    const measured = checkRetarget({ ...result, samples: result.samples.map(sample => ({ ...sample, sequence: 0 })) }, bytes);
    expect(measured.units).toBeLessThanOrEqual(0.5);
    expect(measured.degrees).toBeLessThanOrEqual(0.5);
});

test('a 0.2 degree turn of a joint sheared by its Stand registration measures 0.2 degrees [repro #334]', () => {


    const turn = (axis: [number, number, number], degrees: number) =>
        mat4.fromQuat(mat4.create(), quat.setAxisAngle(quat.create(), axis, degrees * Math.PI / 180));
    const sheared = mat4.multiply(mat4.create(), mat4.fromScaling(mat4.create(), [1, 0.25, 1]), turn([Math.SQRT1_2, Math.SQRT1_2, 0], 240));
    const expected = mat4.multiply(mat4.create(), turn([0, 0, 1], 30), sheared);
    const actual = mat4.multiply(mat4.create(), turn([1, 0, 0], 0.2), expected);
    expect(rotationError(expected, actual)).toBeCloseTo(0.2, 2);
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

test('[repro wisp#84] raw Definitive silhouettes apply all four skin influences with weights totaling 255', () => {
    const model = parseMDL(stageSkyMdl('stock.blp'));
    model.Version = 1800;
    const bone = model.Bones[0]!;
    bone.Translation = { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: new Float32Array([5, 0, 0]) }] };
    const second = { ...structuredClone(bone), Name: 'Second bone', ObjectId: 1 };
    second.Translation!.Keys[0]!.Vector[0] = 10;
    model.Bones.push(second);
    model.PivotPoints.push(new Float32Array([0, 0, 0]));
    for (const geoset of model.Geosets) {
        geoset.Vertices = geoset.Vertices.slice(0, 9);
        geoset.Normals = geoset.Normals.slice(0, 9);
        geoset.VertexGroup = geoset.VertexGroup.slice(0, 3);
        geoset.Faces = new Uint16Array([0, 1, 2]);
        geoset.TVertices = geoset.TVertices.map(values => values.slice(0, 6));
        geoset.SkinWeights = new Uint8Array(geoset.Vertices.length / 3 * 8);
        for (let vertex = 0; vertex < geoset.SkinWeights.length; vertex += 8) geoset.SkinWeights.set([0, 1, 0, 1, 64, 64, 64, 63], vertex);
    }
    const drawn = new DrawnModel(generateHdBody(model), 1).triangles(0, 0, 1);
    let corner = 0;
    for (const geoset of model.Geosets) for (const vertex of geoset.Faces) {
        expect(drawn[corner++]).toBeCloseTo((geoset.Vertices[vertex * 3] ?? 0) + (5 * 128 + 10 * 127) / 255, 3);
        expect(drawn[corner++]).toBeCloseTo(geoset.Vertices[vertex * 3 + 2] ?? 0, 3);
    }
});
