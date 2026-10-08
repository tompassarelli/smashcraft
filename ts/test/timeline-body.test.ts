import { expect, test } from 'bun:test';
import { originalClip, originalClipCount } from '../src/game/assets/fighterOriginalClipInfo';
import { Character } from '../src/game/sim/codes';

test("Mountain King's normal body stores its mesh once across all clips [spec #308]", () => {
    const clips = Array.from({ length: originalClipCount(Character.mountainKing) }, (_, index) => originalClip(Character.mountainKing, index));
    expect(clips.length).toBeGreaterThan(0);
    expect(new Set(clips.map(clip => clip?.modelPath)).size).toBe(1);
    expect(clips.every(clip => clip?.timeline === true)).toBe(true);
});

import { generateMDX, model as mdx, parseMDL } from 'war3-model';
import { timelineBody } from '../../tools/animations/timeline-body';
import { originalBodyClip } from '../../tools/animations/original-clips';
import { stageSkyMdl } from '../scripts/stageSky';
import { DrawnModel } from '../scripts/wisp/hurtboxView';

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
