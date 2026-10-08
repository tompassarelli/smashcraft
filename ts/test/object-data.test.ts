import { expect, test } from "bun:test";
import { fighterUnits } from "../scripts/objectData";
import { FIGHTER_OBJECT_ORDER, FIGHTER_OBJECTS } from "../src/game/objectData";

/** Independent format-2 reader: verify the archive's field IDs, types and values. */
function readUnits(bytes: Uint8Array): Map<number, Map<string, string | number>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const int = () => { const value = view.getInt32(offset, true); offset += 4; return value; };
  const id = () => { const value = view.getUint32(offset, false); offset += 4; return value; };
  const field = () => String.fromCharCode(...bytes.slice(offset, offset += 4));
  const text = () => {
    const start = offset;
    while (bytes[offset] !== 0 && offset < bytes.length) offset++;
    const value = new TextDecoder().decode(bytes.slice(start, offset));
    offset++;
    return value;
  };
  expect(int()).toBe(2);
  expect(int()).toBe(0);
  const count = int();
  const objects = new Map<number, Map<string, string | number>>();
  for (let object = 0; object < count; object++) {
    id();
    const objectId = id();
    const modifications = int();
    const values = new Map<string, string | number>();
    for (let modification = 0; modification < modifications; modification++) {
      const name = field();
      const type = int();
      let value: string | number;
      if (type === 0) value = int();
      else if (type === 1) { value = view.getFloat32(offset, true); offset += 4; }
      else if (type === 3) value = text();
      else throw new Error(`unexpected object field type ${type}`);
      values.set(name, value);
      expect(int()).toBe(0);
    }
    objects.set(objectId, values);
  }
  expect(offset).toBe(bytes.length);
  return objects;
}

test("the fighter archive encodes the shared runtime declaration [invariant]", () => {
  const objects = readUnits(fighterUnits());
  expect(objects.size).toBe(FIGHTER_OBJECT_ORDER.length);
  for (const character of FIGHTER_OBJECT_ORDER) {
    const definition = FIGHTER_OBJECTS[character];
    expect(objects.get(definition.id)).toEqual(new Map<string, string | number>([
      ["wurs", 42], ["unam", definition.name], ["umdl", definition.model], ["uver", definition.artVersion],
      ["usca", definition.scale], ["uble", definition.blendTime], ["ussc", definition.selectionScale],
      ["umvs", definition.moveSpeed], ["ua1c", definition.attackCooldown],
    ]));
  }
});
