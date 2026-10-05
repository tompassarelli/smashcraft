// Object data (war3map.w3u and war3map.w3a, format 2) for the objects that the
// Wurst build creates at compile time: the fighter units of FighterAssets.wurst
// and the channel ability that the pinned standard library's FileIO
// (WurstStdlib2 e3714f629113, Apache-2.0) generates for '$wsl'.

type Value =
  | { readonly kind: "int"; readonly value: number }
  | { readonly kind: "real"; readonly value: number }
  | { readonly kind: "string"; readonly value: string };

interface Modification {
  readonly field: string;
  readonly value: Value;
  /** Ability data is per level; unit data has no levels. */
  readonly level?: number;
}

interface ObjectDefinition {
  readonly base: string;
  readonly id: string;
  readonly modifications: readonly Modification[];
}

const VALUE_TYPES = { int: 0, real: 1, string: 3 } as const;
/** Marks objects the Wurst compiler generated; kept so the output matches the Wurst build byte for byte. */
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
  int32(0); // No changed original objects.
  int32(definitions.length);
  for (const definition of definitions) {
    id(definition.base);
    id(definition.id);
    int32(definition.modifications.length);
    for (const { field, value, level = 0 } of definition.modifications) {
      id(field);
      int32(VALUE_TYPES[value.kind]);
      if (levels) {
        int32(level);
        int32(0); // Data column.
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

export interface FighterModels {
  readonly archer: string;
  readonly rifleman: string;
  readonly demonHunter: string;
}

function fighter(base: string, id: string, name: string, model: string): ObjectDefinition {
  return {
    base,
    id,
    modifications: [
      WURST_MARKER,
      { field: "unam", value: { kind: "string", value: name } },
      { field: "umdl", value: { kind: "string", value: model } },
      { field: "uver", value: { kind: "int", value: 0 } },
      { field: "usca", value: { kind: "real", value: 1 } },
      { field: "uble", value: { kind: "real", value: 0 } },
      { field: "ussc", value: { kind: "real", value: 0 } },
    ],
  };
}

/** war3map.w3u: the three fighter unit types. */
export function fighterUnits(models: FighterModels): Uint8Array {
  return encodeObjectData([
    fighter("earc", "mfar", "Archer", models.archer),
    fighter("hrif", "mfrf", "Rifleman", models.rifleman),
    fighter("earc", "mfdh", "Illidan", models.demonHunter),
  ], false);
}

/** war3map.w3a: FileIO's channel ability, whose 64 tooltips carry file contents into the game. */
export function fileIoAbility(): Uint8Array {
  const levels = 64;
  return encodeObjectData([{
    base: "ANcl",
    id: "$wsl",
    modifications: [
      WURST_MARKER,
      { field: "alev", value: { kind: "int", value: levels } },
      ...Array.from({ length: levels }, (_, index): Modification => ({ field: "atp1", value: { kind: "string", value: " " }, level: index + 1 })),
    ],
  }], true);
}
