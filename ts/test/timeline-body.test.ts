import { expect, test } from 'bun:test';
import { originalClip, originalClipCount } from '../src/game/assets/fighterOriginalClipInfo';
import { SELECTABLE_CHARACTERS, fighterName } from '../src/game/sim/heroes/registry';

test("every selectable fighter's normal body stores its mesh once across all clips [spec #308]", () => {
    for (const character of SELECTABLE_CHARACTERS) {
        const clips = Array.from({ length: originalClipCount(character) }, (_, index) => originalClip(character, index));
        expect(clips.length, fighterName(character)).toBeGreaterThan(0);
        expect(new Set(clips.map(clip => clip?.modelPath)).size, fighterName(character)).toBe(1);
        expect(clips.every(clip => clip?.timeline === true), fighterName(character)).toBe(true);
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

test('padding a held Hermite clip edge keeps the drawn pose still [repro #308]', () => {
    const source = parseMDL(stageSkyMdl('test.tga'));
    const sequence = source.Sequences[0], bone = source.Bones[0];
    if (sequence === undefined || bone === undefined) throw new Error('Missing authored fixture body');
    sequence.Interval = new Uint32Array([100, 1000]);
    bone.Scaling = { LineType: mdx.LineType.Hermite, GlobalSeqId: null, Keys: [
        { Frame: 400, Vector: new Float32Array([1, 1, 1]), InTan: new Float32Array([1, 1, 1]), OutTan: new Float32Array([1, 1, 1]) },
        { Frame: 800, Vector: new Float32Array([2, 2, 2]), InTan: new Float32Array([1, 1, 1]), OutTan: new Float32Array([1, 1, 1]) },
    ] };
    const pool = new DrawnModel(generateMDX(originalBodyClip(source, 0).model), 0.01);
    const timeline = new DrawnModel(generateMDX(timelineBody(source, [sequence])), 0.01);
    for (const frame of [0, 1, 6, 12, 25, 37, 50, 54]) {
        const expected = pool.triangles(0, frame / 60, 1);
        const actual = timeline.triangles(0, 0.1 + frame / 60, 1);
        expect(actual.length).toBe(expected.length);
        expect(Math.max(...actual.map((value, index) => Math.abs(value - (expected[index] ?? Infinity))))).toBeLessThan(0.001);
    }
});

test('nonunit quaternion holds keep the reference mesh at both clip edges [repro #308]', () => {
    const nonunit = new Float32Array([-0.22460900247097015, 0.34179699420928955, -0.11767599731683731, 0.9023439884185791]);
    const identity = new Float32Array([0, 0, 0, 1]);
    for (const [first, last] of [[nonunit, identity], [identity, nonunit]]) {
        const source = parseMDL(stageSkyMdl('test.tga'));
        const sequence = source.Sequences[0], bone = source.Bones[0];
        if (sequence === undefined || bone === undefined) throw new Error('Missing authored fixture body');
        sequence.Interval = new Uint32Array([100, 1000]);
        bone.Rotation = { LineType: mdx.LineType.Linear, GlobalSeqId: null, Keys: [
            { Frame: 400, Vector: first }, { Frame: 800, Vector: last },
        ] };
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
