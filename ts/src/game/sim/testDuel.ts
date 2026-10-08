// A two-fighter match driven through the ordinary match step for scripted
// input-path tests: Illidan's kit (#147) and its counterplay.
import { ATTACK_BUFFER_FRAMES, type AttackBuffer, attackBuffer } from "../input/attackBuffer";
import { type FrameControls, createFrameControls } from "../match/controls";
import { Phase, createMatchState } from "../match/rules";
import { stepMatch } from "../match/step";
import { Character } from "./codes";
import { type Fighter, createFighter } from "./fighter";
import { takenManaGain } from "./mana";
import { type Controls, copyControls, createRoster } from "./roster";
import { controls } from "./testWorld";

export interface Duel {
  readonly illidan: Fighter;
  readonly target: Fighter;
  readonly commands: readonly [AttackBuffer, AttackBuffer];
  /**
   * Mana drained from the target so far: each frame it took damage, its mana
   * change less the shared comeback gain for being hit (smashcraft:docs/design/mana.md).
   */
  drained: number;
  /** One match frame with these controls for Illidan and the target; returns the frame number. */
  readonly step: (this: void, first?: Readonly<Controls>, second?: Readonly<Controls>) => number;
  readonly run: (this: void, frames: number, first?: Readonly<Controls>, second?: Readonly<Controls>) => void;
}

/** Illidan at 0 facing right and a fighter `gap` ahead facing him, both settled on the main deck. */
export function duel(gap: number, character: Character = Character.rifleman): Duel {
  const game = createMatchState();
  game.phase = Phase.match;
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  const target = createFighter(character, gap, -1);
  const world = createRoster(3, [illidan, target]);
  const commands: [AttackBuffer, AttackBuffer] = [attackBuffer(ATTACK_BUFFER_FRAMES), attackBuffer(ATTACK_BUFFER_FRAMES)];
  let frame = 0;
  const frameControls = (first: Readonly<Controls>, second: Readonly<Controls>): FrameControls => {
    const out = createFrameControls();
    copyControls(out.inputs[0], first);
    copyControls(out.inputs[1], second);
    out.commands[0] = commands[0];
    out.commands[1] = commands[1];
    return out;
  };
  const d: Duel = {
    illidan, target, commands, drained: 0,
    step: (first = controls(), second = controls()) => {
      frame++;
      const mana = target.mana.points;
      const damage = target.status.damage;
      stepMatch(game, world, frameControls(first, second), frame);
      if (target.status.damage > damage) d.drained += mana - target.mana.points + takenManaGain(target.status.damage - damage);
      return frame;
    },
    run: (frames, first, second) => { for (let i = 0; i < frames; i++) d.step(first, second); },
  };
  d.run(3);
  return d;
}

/** Puts the fighter in the air at `z`, at rest. */
export function lift(f: Fighter, z: number): void {
  f.motion.grounded = false;
  f.motion.surface = undefined;
  f.motion.z = z;
  f.motion.vz = 0.0;
  f.motion.vx = 0.0;
}
