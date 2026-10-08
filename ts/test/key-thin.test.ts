import { expect, test } from 'bun:test';
import { generateMDX, parseMDL } from 'war3-model';
import { KEY_BOUND, poseError, savedKeyBytes, thinKeys } from '../scripts/keyThin';
import { fighterName, SELECTABLE_CHARACTERS } from '../src/game/sim/heroes/registry';

// An arm: a root bone turning about Z at a steady rate, with a 3 degree
// flick at frame 500, and a hand 100 units out on it.
function arm(): string {
  const keys: string[] = [];
  for (let frame = 0; frame <= 1000; frame += 10) {
    const degrees = frame * 0.05 + (frame === 500 ? 3 : 0), half = degrees * Math.PI / 360;
    keys.push(`${frame}: { 0, 0, ${Math.fround(Math.sin(half))}, ${Math.fround(Math.cos(half))} },`);
  }
  const extent = 'MinimumExtent { -200, -200, -200 }, MaximumExtent { 200, 200, 200 }, BoundsRadius 200,';
  return `Version { FormatVersion 800, }
Model "arm" { NumGeosets 1, NumBones 2, BlendTime 0, ${extent} }
Sequences 1 { Anim "Stand" { Interval { 0, 1000 }, ${extent} } }
Textures 1 { Bitmap { Image "arm.blp", } }
Materials 1 { Material { Layer { FilterMode None, static TextureID 0, static Alpha 1, } } }
Geoset {
  Vertices 3 { { 0, 0, 0 }, { 100, 0, 0 }, { 0, 10, 0 }, }
  Normals 3 { { 0, 0, 1 }, { 0, 0, 1 }, { 0, 0, 1 }, }
  TVertices 3 { { 0, 0 }, { 1, 0 }, { 0, 1 }, }
  VertexGroup { 0, 1, 0, }
  Faces 1 3 { Triangles { { 0, 1, 2 }, } }
  Groups 2 2 { Matrices { 0 }, Matrices { 1 }, }
  ${extent} Anim { ${extent} } MaterialID 0, SelectionGroup 0,
}
Bone "Root" { ObjectId 0, GeosetId 0, GeosetAnimId None,
  Rotation ${keys.length} { Linear, ${keys.join('\n')} }
}
Bone "Hand" { ObjectId 1, Parent 0, GeosetId 0, GeosetAnimId None, }
PivotPoints 2 { { 0, 0, 0 }, { 100, 0, 0 }, }
`;
}

test('thinning drops keys a steady turn reproduces, keeps the flick, and holds the drawn hand within 0.5 units and 0.5 degrees [reference]', () => {
  const source = parseMDL(arm());
  const { model, report } = thinKeys(source);
  const frames = model.Bones[0]!.Rotation;
  if (typeof frames !== 'object' || !('Keys' in frames)) throw new Error('Root rotation lost its keys');
  expect(report.keysBefore).toBe(101);
  expect(frames.Keys.length).toBeLessThan(20);
  expect(frames.Keys.some(key => key.Frame === 500)).toBe(true);
  // war3-model's renderer draws both models: the error is its pose, not the thinner's arithmetic.
  const error = poseError(source, model);
  expect(error.maxPosition).toBeLessThanOrEqual(KEY_BOUND.position);
  expect(error.maxRotationDegrees).toBeLessThanOrEqual(KEY_BOUND.rotationDegrees);
});

test('the bytes thinning reports saved are the encoded model\'s shrinkage [invariant]', () => {
  const source = parseMDL(arm());
  const { model } = thinKeys(source);
  expect(savedKeyBytes(source, model, [0, 1000])).toBe(generateMDX(source).byteLength - generateMDX(model).byteLength);
});

test("every fighter's thinned clips stay within 0.5 units and 0.5 degrees of the source pose and are no larger [spec #314]", async () => {
  const rows = (await Bun.file(new URL('fixtures/key-thin.tsv', import.meta.url)).text()).trim().split('\n').filter(line => !line.startsWith('#')).slice(1);
  expect(rows.map(row => row.split('\t')[0]).sort()).toEqual(SELECTABLE_CHARACTERS.map(character => fighterName(character).replaceAll(/[^A-Za-z]/g, '')).sort());
  for (const row of rows) {
    const [fighter, keysBefore, keysAfter, bytesBefore, bytesAfter, maxPosition, maxRotationDegrees] = row.split('\t');
    expect({ fighter, fewer: Number(keysAfter) <= Number(keysBefore), smaller: Number(bytesAfter) <= Number(bytesBefore) }).toEqual({ fighter, fewer: true, smaller: true });
    expect({ fighter, position: Number(maxPosition) <= KEY_BOUND.position, rotation: Number(maxRotationDegrees) <= KEY_BOUND.rotationDegrees })
      .toEqual({ fighter, position: true, rotation: true });
  }
});
