import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack } from "./attacks";
import { AttackStyle, type Character } from "./codes";
import { createFighter, type Fighter } from "./fighter";
import { SELECTABLE_CHARACTERS, fighterName } from "./heroes/registry";
import { attackDurationFramesForGrounding } from "./moves";
import { fighterAt } from "./roster";
import { advanceFighter } from "./step";
import { controls, soloWorld } from "./testWorld";

const AERIALS = [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.upAir, AttackStyle.downAir] as const;

function airborne(character: Character, vx: number): Fighter {
  const fighter = createFighter(character, 0.0, 1);
  fighter.motion.grounded = false;
  fighter.motion.z = 1500.0;
  fighter.motion.vx = vx;
  return fighter;
}

for (const character of SELECTABLE_CHARACTERS) {
  test(`${fighterName(character)} aerials keep held-stick air drift through the whole move [spec melee]`, () => {
    for (const style of AERIALS) {
      for (const [start, stick] of [[0.0, 1], [0.0, -1], [1.0, -1], [-1.0, 0]] as const) {
        const probe = createFighter(character, 0.0, 1);
        const vx = f32(start * probe.tuning.physics.airCap);
        const attackWorld = soloWorld(airborne(character, vx));
        const driftWorld = soloWorld(airborne(character, vx));
        beginFighterAttack(attackWorld, 0, style, false);
        const attacker = fighterAt(attackWorld, 0);
        const drifter = fighterAt(driftWorld, 0);
        const input = controls({ direction: stick });
        const frames = attackDurationFramesForGrounding(style, false, attacker.tuning.moves);
        for (let frame = 1; frame <= frames; frame++) {
          advanceFighter(attackWorld, 0, 0, input, 0.0);
          advanceFighter(driftWorld, 0, 0, input, 0.0);
          if (attacker.motion.grounded || drifter.motion.grounded) break;
          if (attacker.motion.vx !== drifter.motion.vx) throw new Error(`style ${style} start=${start} stick=${stick} frame ${frame}: vx ${attacker.motion.vx} vs drift ${drifter.motion.vx}`);
        }
        assertEquals(attacker.motion.vx, drifter.motion.vx);
      }
    }
  });
}
