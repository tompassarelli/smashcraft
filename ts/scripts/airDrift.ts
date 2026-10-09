






import { Action } from "../src/game/input/actions";
import { AttackStyle, type Character } from "../src/game/sim/codes";
import type { Fighter } from "../src/game/sim/fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "../src/game/sim/heroes/registry";
import { WORLD_UNITS_PER_MELEE_UNIT } from "../src/game/sim/tuning";
import { fighter, frame, scene, solo, type Scene } from "../src/game/match/padScene";
import { copyReplayState } from "../src/game/replay/snapshot";
import { resetMatchFrameInput } from "../src/game/match/frameInput";


export const AIR_SPEED_BAND = { min: 0.75, max: 1.25 } as const;
export const AIR_ACCELERATION_BAND = { min: 0.04, max: 0.1 } as const;

const units = (world: number): number => world / WORLD_UNITS_PER_MELEE_UNIT;

type Held = readonly Action[];

export interface Takeoff {
  
  readonly ground: number;
  
  readonly takeoff: number;
  
  readonly held: number;
}

export const HELD_AFTER_TAKEOFF = 10;






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


function aerialPress(self: Fighter, style: AttackStyle): Held {
  switch (style) {
    case AttackStyle.neutralAir: return [Action.attack];
    case AttackStyle.forwardAir: return [self.facing > 0 ? Action.smashRight : Action.smashLeft];
    case AttackStyle.backAir: return [self.facing > 0 ? Action.smashLeft : Action.smashRight];
    case AttackStyle.upAir: return [Action.smashUp];
    default: return [Action.smashDown];
  }
}


const DEFENDER_X = 150.0;

export const CROSS_UP_DISTANCE = 240.0;

export const CROSS_UP_DASH_FRAMES = 8;
const LAST_PRESS = 70;

export interface CrossUp {
  readonly hop: "short" | "full";
  readonly aerial: AttackStyle;
  
  readonly press: number;
  
  readonly behind: number;
}


function attempt(s: Scene, full: boolean, style: AttackStyle, press: number): number | undefined {
  const a = fighter(s, 0);
  const b = fighter(s, 1);
  const jump = CROSS_UP_DASH_FRAMES + 1;
  let serial = -1;
  for (let n = press; n <= LAST_PRESS + 60; n++) {
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






export function crossUp(character: Character): CrossUp | undefined {
  const placements = [{ character, x: DEFENDER_X - CROSS_UP_DISTANCE, facing: 1 }, { character, x: DEFENDER_X, facing: -1 }];
  const trial = scene(0, placements);
  const trialState = { world: trial.world, match: trial.game, controls: trial.controls, runtime: trial.runtime };
  for (const hop of ["short", "full"] as const) {
    for (const aerial of AERIALS) {
      const prefix = scene(0, placements);
      const prefixState = { world: prefix.world, match: prefix.game, controls: prefix.controls, runtime: prefix.runtime };
      for (let press = CROSS_UP_DASH_FRAMES + 2; press <= LAST_PRESS; press++) {
        while (prefix.runtime.simulationFrame < press - 1) {
          const n = prefix.runtime.simulationFrame + 1;
          const held = n === CROSS_UP_DASH_FRAMES + 1 || (hop === "full" && n > CROSS_UP_DASH_FRAMES + 1)
            ? [Action.moveRight, Action.jump] : [Action.moveRight];
          frame(prefix, held, [Action.rightTrigger]);
        }
        copyReplayState(trialState, prefixState);
        resetMatchFrameInput(trial.row);
        for (let slot = 0; slot < prefix.previous.length; slot++) trial.previous[slot] = prefix.previous[slot] ?? 0;
        const behind = attempt(trial, hop === "full", aerial, press);
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
