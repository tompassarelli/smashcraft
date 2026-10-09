


import { FILE_IO_OBJECT, FIGHTER_OBJECT_ORDER, FIGHTER_OBJECTS, type FighterObject } from "../src/game/objectData";

type Value =
  | { readonly kind: "int"; readonly value: number }
  | { readonly kind: "real"; readonly value: number }
  | { readonly kind: "string"; readonly value: string };

interface Modification {
  readonly field: string;
  readonly value: Value;

  readonly level?: number;
}

interface ObjectDefinition {
  readonly base: string;
  readonly id: number;
  readonly modifications: readonly Modification[];
}

const VALUE_TYPES = { int: 0, real: 1, string: 3 } as const;

const WURST_MARKER: Modification = { field: "wurs", value: { kind: "int", value: 42 } };

function encodeObjectData(definitions: readonly ObjectDefinition[], levels: boolean): Uint8Array {
  const bytes: number[] = [];
  const scratch = new DataView(new ArrayBuffer(4));
  const int32 = (value: number) => {
    scratch.setInt32(0, value, true);
    bytes.push(...new Uint8Array(scratch.buffer));
  };
  const text = (value: string) => bytes.push(...new TextEncoder().encode(value));
  const id = (value: string) => {
    if (!/^[\x20-\x7e]{4}$/.test(value)) throw new Error(`object-data ID must be four printable characters: ${value}`);
    text(value);
  };
  int32(2);
  int32(0);
  int32(definitions.length);
  for (const definition of definitions) {
    id(definition.base);
    scratch.setUint32(0, definition.id, false);
    bytes.push(...new Uint8Array(scratch.buffer));
    int32(definition.modifications.length);
    for (const { field, value, level = 0 } of definition.modifications) {
      id(field);
      int32(VALUE_TYPES[value.kind]);
      if (levels) {
        int32(level);
        int32(0);
      }
      if (value.kind === "int") int32(value.value);
      else if (value.kind === "real") {
        scratch.setFloat32(0, value.value, true);
        bytes.push(...new Uint8Array(scratch.buffer));
      } else {
        text(value.value);
        bytes.push(0);
      }
      bytes.push(0, 0, 0, 0);
    }
  }
  return Uint8Array.from(bytes);
}

function fighter(definition: FighterObject): ObjectDefinition {
  return {
    base: definition.base,
    id: definition.id,
    modifications: [
      WURST_MARKER,
      { field: "unam", value: { kind: "string", value: definition.name } },
      { field: "umdl", value: { kind: "string", value: definition.model } },
      { field: "uver", value: { kind: "int", value: definition.artVersion } },
      { field: "usca", value: { kind: "real", value: definition.scale } },
      { field: "uble", value: { kind: "real", value: definition.blendTime } },
      { field: "ussc", value: { kind: "real", value: definition.selectionScale } },
      { field: "umvs", value: { kind: "int", value: definition.moveSpeed } },
      { field: "ua1c", value: { kind: "real", value: definition.attackCooldown } },
    ],
  };
}


export function fighterUnits(): Uint8Array {
  return encodeObjectData(FIGHTER_OBJECT_ORDER.map(character => fighter(FIGHTER_OBJECTS[character])), false);
}


export function fileIoAbility(): Uint8Array {
  const { base, id, levels, tooltip } = FILE_IO_OBJECT;
  return encodeObjectData([{
    base,
    id,
    modifications: [
      WURST_MARKER,
      { field: "alev", value: { kind: "int", value: levels } },
      ...Array.from({ length: levels }, (_, index): Modification => ({ field: "atp1", value: { kind: "string", value: tooltip }, level: index + 1 })),
    ],
  }], true);
}
