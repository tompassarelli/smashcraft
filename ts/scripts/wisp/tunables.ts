// The values `bun wisp tune` changes in a running match (wisp:docs/tune.md):
// movement and jump values of each fighter and the ordinary hit's knockback.
// Each names its literal in the map's source; Keep writes there. Movement
// values are in Melee units, as melee() takes them, except the Demon
// Hunter's jump speeds, which are world units per frame. The input helper's
// stick deadzone is no tunable: it is a constant compiled into the helper
// (smashcraft:companion/src/stick.rs), outside the match a reload changes.
import type { Tunable } from "wisp/scripts/wisp/tune";

const TUNING = "src/game/sim/tuning.ts";
const KNOCKBACK = "src/game/sim/knockback.ts";

type Character = "rifleman" | "demonHunter";

const real = (group: string, name: string, path: readonly string[], min: number, max: number, step: number, file = TUNING): Tunable =>
  ({ name, group, file, path, kind: "f32", min, max, step });

function movement(character: Character, group: string): Tunable[] {
  const physics = (field: string) => ["AUTHORED_PHYSICS", character, field];
  const worldJumps = character === "demonHunter";
  return [
    real(group, `${group} run speed`, physics("runSpeed"), 0.5, 4.0, 0.01),
    worldJumps
      ? real(group, `${group} full jump speed (world units)`, physics("fullJumpSpeed"), 10.0, 40.0, 0.1)
      : real(group, `${group} full jump speed`, physics("fullJumpSpeed"), 1.5, 6.0, 0.01),
    worldJumps
      ? real(group, `${group} short jump speed (world units)`, physics("shortJumpSpeed"), 5.0, 30.0, 0.1)
      : real(group, `${group} short jump speed`, physics("shortJumpSpeed"), 0.5, 4.0, 0.01),
    real(group, `${group} gravity`, physics("gravity"), 0.05, 0.4, 0.001),
    real(group, `${group} fall speed`, physics("terminalSpeed"), 1.0, 5.0, 0.01),
    real(group, `${group} fast-fall speed`, physics("fastFallSpeed"), 1.5, 6.0, 0.01),
    { name: `${group} jump squat frames`, group, file: TUNING, path: physics("jumpSquatFrames"), kind: "int", min: 1, max: 10, step: 1 },
  ];
}

export const SMASHCRAFT_TUNABLES: readonly Tunable[] = [
  ...movement("rifleman", "Rifleman"),
  ...movement("demonHunter", "Demon Hunter"),
  real("Knockback", "Knockback growth (percent)", ["ORDINARY_HIT_GROWTH_PERCENT"], 25.0, 300.0, 1.0, KNOCKBACK),
  real("Knockback", "Base knockback", ["ORDINARY_HIT_BASE_KNOCKBACK"], 0.0, 80.0, 1.0, KNOCKBACK),
  real("Knockback", "Hitstun frames per knockback", ["HITSTUN_FRAMES_PER_KNOCKBACK"], 0.1, 1.0, 0.01, KNOCKBACK),
];
