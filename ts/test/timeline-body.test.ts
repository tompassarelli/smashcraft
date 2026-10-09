import { expect, test } from 'bun:test';
import { originalClip, originalClipCount } from '../src/game/assets/fighterOriginalClipInfo';
import { SELECTABLE_CHARACTERS, fighterName } from '../src/game/sim/heroes/registry';
import { FIGHTER_OBJECTS } from '../src/game/objectData';
import { MODEL_FACTS } from '../scripts/wisp/modelFacts';

test("every selectable fighter's normal body stores its mesh once across all clips [spec #308]", () => {
    for (const character of SELECTABLE_CHARACTERS) {
        const clips = Array.from({ length: originalClipCount(character) }, (_, index) => originalClip(character, index));
        expect(clips.length, fighterName(character)).toBeGreaterThan(0);
        expect(new Set(clips.map(clip => clip?.modelPath)).size, fighterName(character)).toBe(1);
        expect(clips.every(clip => clip?.timeline === true), fighterName(character)).toBe(true);
    }
});

test("every selectable fighter's in-match body has every geoset and triangle of the model its unit and victory pose draw [invariant]", () => {
    for (const character of SELECTABLE_CHARACTERS) {
        const body = MODEL_FACTS[originalClip(character, 0)?.modelPath ?? ''], whole = MODEL_FACTS[FIGHTER_OBJECTS[character].model];
        expect(body === undefined ? undefined : [body.geosets, body.triangles], fighterName(character)).toEqual(whole === undefined ? undefined : [whole.geosets, whole.triangles]);
        expect(whole, fighterName(character)).toBeDefined();
    }
});

import { generateMDX, model as mdx, parseMDL } from 'war3-model';
import { timelineBody } from '../../tools/animations/timeline-body';
import { originalBodyClip } from '../../tools/animations/original-clips';
import { stageSkyMdl } from '../scripts/stageSky';
import { DrawnModel } from '../scripts/wisp/hurtboxView';

test('timeline bodies remove empty global-clock tracks that crash Warcraft on load [repro #284]', () => {
    const source = parseMDL(stageSkyMdl('test.tga'));
    const bone = source.Bones[0];
    if (bone === undefined) throw new Error('Missing authored fixture bone');
    source.GlobalSequences = [1000];
    bone.Rotation = { LineType: mdx.LineType.Linear, GlobalSeqId: 0, Keys: [] };
    const body = timelineBody(source, source.Sequences);
    expect(body.Bones[0]?.Rotation).toBeUndefined();
});

test('held clip edges keep the reference mesh at every frame: Hermite scaling and nonunit quaternion holds [repro #308]', () => {
    const nonunit = new Float32Array([-0.22460900247097015, 0.34179699420928955, -0.11767599731683731, 0.9023439884185791]);
    const identity = new Float32Array([0, 0, 0, 1]);
    const one = () => new Float32Array([1, 1, 1]);
    const hermite = (bone: mdx.Bone) => {
        bone.Scaling = { LineType: mdx.LineType.Hermite, GlobalSeqId: null, Keys: [
            { Frame: 400, Vector: one(), InTan: one(), OutTan: one() },
            { Frame: 800, Vector: new Float32Array([2, 2, 2]), InTan: one(), OutTan: one() },
        ] };
    };
    const rotation = (first: Float32Array, last: Float32Array) => (bone: mdx.Bone) => {
        bone.Rotation = { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [
            { Frame: 400, Vector: first }, { Frame: 800, Vector: last },
        ] };
    };
    for (const hold of [hermite, rotation(nonunit, identity), rotation(identity, nonunit)]) {
        const source = parseMDL(stageSkyMdl('test.tga'));
        const sequence = source.Sequences[0], bone = source.Bones[0];
        if (sequence === undefined || bone === undefined) throw new Error('Missing authored fixture body');
        sequence.Interval = new Uint32Array([100, 1000]);
        hold(bone);
        const pool = new DrawnModel(generateMDX(originalBodyClip(source, 0).model), 0.01);
        const timeline = new DrawnModel(generateMDX(timelineBody(source, [sequence])), 0.01);
        for (let frame = 0; frame <= 54; frame++) for (const facing of [-1, 1]) {
            const expected = pool.triangles(0, frame / 60, facing);
            const actual = timeline.triangles(0, (100 + frame * 1000 / 60) / 1000, facing);
            expect(actual.length).toBe(expected.length);
            expect(Math.max(...actual.map((value, index) => Math.abs(value - (expected[index] ?? Infinity))))).toBeLessThan(0.001);
        }
    }
});

test('a nonunit hold skins its vertices to a bone, not a helper, so HD and Definitive draw them in place [repro #319]', () => {
    const source = parseMDL(stageSkyMdl('test.tga'));
    const sequence = source.Sequences[0], bone = source.Bones[0];
    if (sequence === undefined || bone === undefined) throw new Error('Missing authored fixture body');
    sequence.Interval = new Uint32Array([100, 1000]);
    bone.Rotation = { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [
        { Frame: 400, Vector: new Float32Array([-0.22460900247097015, 0.34179699420928955, -0.11767599731683731, 0.9023439884185791]) },
        { Frame: 800, Vector: new Float32Array([0, 0, 0, 1]) },
    ] };
    const body = timelineBody(source, [sequence]);
    const bones = new Set(body.Bones.map(node => node.ObjectId));
    const skinned = body.Geosets.flatMap(geoset => geoset.Groups.flat());
    expect(body.Helpers.some(node => node.Name?.endsWith(' hold stretch'))).toBe(true);
    expect(skinned.filter(id => !bones.has(id)).map(id => body.Nodes[id]?.Name)).toEqual([]);
});

test('Definitive Tinker held texture translation survives every authored timeline interval [repro #334]', () => {
    const source = parseMDL(stageSkyMdl('test.tga'));
    const sequence = source.Sequences[0];
    if (sequence === undefined) throw new Error('Missing authored fixture sequence');
    sequence.Interval = new Uint32Array([100, 200]);
    source.Sequences.push({ ...sequence, Name: 'Attack', Interval: new Uint32Array([400, 500]) });
    source.TextureAnims = [{ Translation: { LineType: mdx.LineType.DontInterp, GlobalSeqId: null,
        Keys: [{ Frame: 100, Vector: new Float32Array([0.25, 0, 0]) }, { Frame: 400, Vector: new Float32Array([0.25, 0, 0]) }] } }];
    source.Materials[0].Layers[0].TVertexAnimId = 0;
    const body = timelineBody(source, source.Sequences);
    expect(body.TextureAnims[0]?.Translation?.Keys.map(key => [key.Frame, ...key.Vector])).toEqual([
        [100, 0.25, 0, 0], [200, 0.25, 0, 0], [400, 0.25, 0, 0], [500, 0.25, 0, 0],
    ]);
    expect(body.Materials[0].Layers[0].TVertexAnimId).toBe(0);
});
