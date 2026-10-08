// Air drift and jump momentum across the roster (#190;
// smashcraft:docs/gameplay-design.md, "Air drift and jump momentum"): each
// fighter's air values against the documented band, the horizontal speed a
// jump out of a dash or run keeps, and a dash -> jump -> aerial that crosses
// over a shielding opponent and meets its shield from behind. Played through
// the match frame executor from controller rows (src/game/match/padScene.ts).
// `bun scripts/airDrift.ts` prints the roster table.
import { Action } from "../src/game/input/actions";
import { AttackStyle, type Character } from "../src/game/sim/codes";
import type { Fighter } from "../src/game/sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { WORLD_UNITS_PER_MELEE_UNIT } from "../src/game/sim/tuning";
import { fighter, frame, scene, solo } from "../src/game/match/padScene";

/** The documented bands, Melee units a frame (smashcraft:docs/gameplay-design.md). */
export const AIR_SPEED_BAND = { min: 0.75, max: 1.25 } as const;
export const AIR_ACCELERATION_BAND = { min: 0.04, max: 0.1 } as const;

const units = (world: number): number => world / WORLD_UNITS_PER_MELEE_UNIT;

type Held = readonly Action[];

export interface Takeoff {
  /** Ground velocity entering the takeoff frame, world units a frame. */
  readonly ground: number;
  /** Velocity the takeoff frame leaves. */
  readonly takeoff: number;
  /** Velocity after `HELD_AFTER_TAKEOFF` further frames holding forward. */
  readonly held: number;
}

export const HELD_AFTER_TAKEOFF = 10;

/**
 * Holds right from a standing start for `groundFrames` (a dash below the
 * roster's 13 initial-dash frames, a run beyond), presses jump with it held
 * (a full hop), and keeps holding right after takeoff.
 */
export function dashJump(character: Character, groundFrames: number): Takeoff {
  const s = solo(0, character, -300.0, 1);
  const f = fighter(s);
  for (let n = 0; n < groundFrames; n++) frame(s, [Action.moveRight]);
  let ground = f.motion.vx;
  frame(s, [Action.moveRight, Action.jump]);
  for (let n = 0; n < 20 && f.motion.grounded; n++) {
    ground = f.motion.vx;
    frame(s, [Action.moveRight, Action.jump]);
  }
  if (f.motion.grounded) throw new Error(`${fighterName(character)} never left the ground`);
  const takeoff = f.motion.vx;
  for (let n = 0; n < HELD_AFTER_TAKEOFF; n++) frame(s, [Action.moveRight, Action.jump]);
  return { ground, takeoff, held: f.motion.vx };
}

const AERIALS = [AttackStyle.backAir, AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.downAir, AttackStyle.upAir] as const;

/** The press that starts `style` in the air: attack alone for a neutral air, the C-stick otherwise, leaving the stick holding right. */
function aerialPress(self: Fighter, style: AttackStyle): Held {
  switch (style) {
    case AttackStyle.neutralAir: return [Action.attack];
    case AttackStyle.forwardAir: return [self.facing > 0 ? Action.smashRight : Action.smashLeft];
    case AttackStyle.backAir: return [self.facing > 0 ? Action.smashLeft : Action.smashRight];
    case AttackStyle.upAir: return [Action.smashUp];
    default: return [Action.smashDown];
  }
}

/** The shielding defender stands here facing left, toward the attacker. */
const DEFENDER_X = 150.0;
/** The attacker's start, world units in front of the shield: 40 Melee units, outside every standing aerial's reach. */
export const CROSS_UP_DISTANCE = 240.0;
/** Dash frames before the jump press: well into the dash, at its speed. */
export const CROSS_UP_DASH_FRAMES = 8;
const LAST_PRESS = 70;

export interface CrossUp {
  readonly hop: "short" | "full";
  readonly aerial: AttackStyle;
  /** The aerial's press, frames from the first dash frame (1). */
  readonly press: number;
  /** Attacker minus defender x when the aerial met the shield: positive is behind the defender. */
  readonly behind: number;
}

/** Where one attempt's aerial first met the shield, or undefined when it missed or never started. */
function attempt(character: Character, full: boolean, style: AttackStyle, press: number): number | undefined {
  const s = scene(0, [{ character, x: DEFENDER_X - CROSS_UP_DISTANCE, facing: 1 }, { character, x: DEFENDER_X, facing: -1 }]);
  const a = fighter(s, 0);
  const b = fighter(s, 1);
  const jump = CROSS_UP_DASH_FRAMES + 1;
  let serial = -1;
  for (let n = 1; n <= LAST_PRESS + 60; n++) {
    const held: Action[] = [Action.moveRight];
    if (n === jump || (full && n > jump)) held.push(Action.jump);
    if (n === press) held.push(...aerialPress(a, style));
    frame(s, held, [Action.rightTrigger]);
    if (n === press) {
      if (a.attack.style !== style || a.motion.grounded) return undefined;
      serial = a.attack.serial;
    }
    if (b.visuals.shield + b.visuals.shieldReflect > 0) return serial >= 0 && a.attack.serial === serial && b.facing < 0 ? a.motion.x - b.motion.x : undefined;
    if (n > press && a.motion.grounded) return undefined;
  }
  return undefined;
}

/**
 * The first dash -> short or full hop -> aerial, holding toward the shield
 * throughout, whose aerial meets the shield from behind the defender; undefined
 * when none does.
 */
export function crossUp(character: Character): CrossUp | undefined {
  for (const hop of ["short", "full"] as const) {
    for (const aerial of AERIALS) {
      for (let press = CROSS_UP_DASH_FRAMES + 2; press <= LAST_PRESS; press++) {
        const behind = attempt(character, hop === "full", aerial, press);
        if (behind !== undefined && behind > 0) return { hop, aerial, press, behind };
      }
    }
  }
  return undefined;
}

const AERIAL_NAMES: { readonly [style: number]: string } = {
  [AttackStyle.neutralAir]: "neutral air", [AttackStyle.forwardAir]: "forward air", [AttackStyle.backAir]: "back air",
  [AttackStyle.upAir]: "up air", [AttackStyle.downAir]: "down air",
};

export function rosterTable(): string[] {
  const lines = [
    `| Fighter | Air speed | Air acceleration | Air friction | Jump momentum × | Jump initial | Jump cap | Dash-jump takeoff | Run-jump takeoff | Cross-up from ${units(CROSS_UP_DISTANCE)} |`,
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const character of SELECTABLE_CHARACTERS) {
    const p = fighter(solo(0, character)).tuning.physics;
    const dash = dashJump(character, CROSS_UP_DASH_FRAMES);
    const run = dashJump(character, 24);
    const up = crossUp(character);
    const cross = up === undefined ? "none" : `${up.hop} hop ${AERIAL_NAMES[up.aerial]}, press ${up.press}`;
    lines.push(`| ${fighterName(character)} | ${units(p.airSpeed).toFixed(2)} | ${units(p.airAcceleration).toFixed(3)} | ${units(p.airFriction).toFixed(3)} | ${p.jumpMomentum.toFixed(2)} | ${units(p.jumpHorizontalSpeed).toFixed(2)} | ${units(p.jumpHorizontalCap).toFixed(2)} | ${units(dash.takeoff).toFixed(2)} | ${units(run.takeoff).toFixed(2)} | ${cross} |`);
  }
  return lines;
}

if (import.meta.main) console.log(rosterTable().join("\n"));
