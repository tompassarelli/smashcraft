

// Melee tumble requires knockback × common +0x154 = 0.4 to reach +0x160 = 32 (ftCo_Damage.c ftCo_8008DCE0).



// Non-tumble knockdown requires landing launch speed common +0x1E0 = 5 (ftCo_Damage.c ftCo_Damage_Coll).

import { assertEquals, assertGreaterThan, test } from "wisp/src/runtime/testing";
import { multiplyFloat32 } from "wisp/src/sim/binary32";
import { AttackStyle, Character, ContactKind, DownState } from "./codes";
import { isTumbling } from "./conditions";
import { collectDamageContact } from "./contacts";
import { type Fighter,  } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { type HitEffect, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { ordinaryHitKnockback } from "./knockback";
import { attackStartupFrames } from "./moves";
import { type Roster } from "./roster";
import { advanceFighter } from "./step";
import { contactBatch, controls, testWorld } from "./testWorld";

const MELEE_HITSTUN_PER_KNOCKBACK = 0.4000000059604645;
const MELEE_TUMBLE_LEVEL = 32.0;
const PERCENTS = [10.0, 50.0, 100.0] as const;

const MATCHUPS = [[Character.sylvanas, Character.rifleman], [Character.rifleman, Character.demonHunter], [Character.demonHunter, Character.sylvanas]] as const;
const LANDING_LIMIT_FRAMES = 600;

interface Landing {

  readonly frame: number | undefined;
  readonly state: DownState;
  readonly everDown: boolean;
}


function hitTarget(attackerCharacter: Character, targetCharacter: Character, effect: Readonly<HitEffect>, percent: number, airborne: boolean): { world: Roster; target: Fighter } {
  const facing = effect.launchX < 0 ? -1 : 1;
  const attacker = createReferenceFighter(attackerCharacter, -facing * 560.0, facing);
  const target = createReferenceFighter(targetCharacter, -facing * 500.0, -facing);
  target.status.damage = percent;
  if (airborne) {
    target.motion.grounded = false;
    target.motion.surface = undefined;
    target.motion.z = 120.0;
  }
  const world = testWorld(attacker, target);
  contactBatch(world, () => collectDamageContact(world, 0, 1, effect, facing, ContactKind.launch, true, undefined, false));
  return { world, target };
}


function land(world: Roster, target: Fighter, techFrame: number | undefined): Landing {
  let everDown = false;
  for (let frame = 1; frame <= LANDING_LIMIT_FRAMES; frame++) {
    advanceFighter(world, 1, 0, controls({ techPressed: frame === techFrame }), 0.0);
    if (target.status.out) break;
    const { state } = target.down;
    everDown = everDown || (state !== DownState.none && state !== DownState.tumble);
    if (target.motion.grounded && target.launch.hitlag === 0 && !isTumbling(target)) return { frame, state, everDown };
  }
  return { frame: undefined, state: target.down.state, everDown };
}

test("each fighter's moves tumble, tech and knock down by Melee's rule at low, medium and high percent [reference]", () => {
  const effect = emptyHitRegion();
  let tumbleLandings = 0;
  let footLandings = 0;
  for (const [attacker, target] of MATCHUPS) {
    for (const style of Object.values(AttackStyle)) {
      for (let index = 0; index < authoredHitRegionCount(style); index++) {
        const hit = { ...authoredHitRegion(effect, attacker, style, attackStartupFrames(style), 0, index).effect };
        if (hit.damage <= 0) continue;
        for (const percent of PERCENTS) {
          for (const airborne of [false, true]) {
            const label = `${attacker} style ${style} region ${index} at ${percent}%${airborne ? " airborne" : ""}`;
            const { world, target: fighter } = hitTarget(attacker, target, hit, percent, airborne);
            const knockback = ordinaryHitKnockback(percent, hit.damage, fighter.tuning.physics.weight, hit.growth, hit.base, 1.0);
            const tumbles = multiplyFloat32(knockback, MELEE_HITSTUN_PER_KNOCKBACK) >= MELEE_TUMBLE_LEVEL;
            assertEquals(isTumbling(fighter), tumbles, label);
            const missed = land(world, fighter, undefined);
            if (missed.frame === undefined) continue;
            if (!tumbles) {
              assertEquals(missed.state, DownState.none, label);
              assertEquals(missed.everDown, false, label);
              footLandings++;
              continue;
            }
            assertEquals(missed.state, DownState.bound, label);
            const teched = hitTarget(attacker, target, hit, percent, airborne);
            assertEquals(land(teched.world, teched.target, missed.frame).state, DownState.tech, label);
            tumbleLandings++;
          }
        }
      }
    }
  }
  assertGreaterThan(tumbleLandings, 100);
  assertGreaterThan(footLandings, 100);
});
