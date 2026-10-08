// Sloped decks (#193): walking, running, landing, floor techs and ledge
// catches on Yoshi's Story's main deck, the slope test stage.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState, LedgeState } from "./codes";
import { type Fighter,  } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { LEDGE_CLIMB_FRAMES, resolveLedges } from "./ledge";
import { setWorldMotionValue } from "./motion";
import type { Controls } from "./roster";
import { SLOPE_TEST_STAGE, STRATHOLME_STAGE, mainDeckRight, mainDeckZ, surfaceZAt } from "./stage";
import { advanceSolo, controls, seedTechWindow, testWorld } from "./testWorld";
import { melee } from "./tuning";

const STAGE = SLOPE_TEST_STAGE;
const RISE = melee(3.5);

/** A fighter standing on the slope test stage's main deck at `x`. */
function standing(character: Character, x: number, facing: number): Fighter {
  const fighter = createReferenceFighter(character, x, facing);
  fighter.motion.surface = 0;
  fighter.motion.z = surfaceZAt(STAGE, 0, 0, x);
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  return fighter;
}

function currentDownState(fighter: Fighter): DownState { return fighter.down.state; }

function onLine(fighter: Fighter): void {
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.motion.surface, 0);
  assertEquals(fighter.motion.z, surfaceZAt(STAGE, 0, 0, fighter.motion.x));
}

test("walking down and back up a slope keeps the fighter on the line, moving ground speed along it [spec #193]", () => {
  for (const side of [-1, 1]) {
    const fighter = standing(Character.sylvanas, f32(side * 380.0), side);
    const input = controls({ direction: side, walking: true });
    let crossedSlope = false;
    for (let frame = 0; frame < 400 && Math.abs(fighter.motion.x) < 540.0; frame++) {
      const before = fighter.motion.x;
      advanceSolo(fighter, STAGE, input, 0.0);
      onLine(fighter);
      if (Math.abs(before) > 430.0 && fighter.motion.vx !== 0) {
        crossedSlope = true;
        // Melee moves ground speed along the floor line: the slope takes its horizontal share.
        assertLessThan(Math.abs(f32(fighter.motion.x - before)), Math.abs(fighter.motion.vx));
      }
    }
    assertTrue(crossedSlope);
    assertLessThan(fighter.motion.z, f32(RISE / 2));
    input.direction = -side;
    for (let frame = 0; frame < 400 && Math.abs(fighter.motion.x) > 300.0; frame++) {
      advanceSolo(fighter, STAGE, input, 0.0);
      onLine(fighter);
    }
    assertEquals(fighter.motion.z, RISE);
  }
});

test("running down a slope never leaves the ground, and running off the ledge falls [spec #193]", () => {
  for (const character of [Character.sylvanas, Character.rifleman, Character.demonHunter]) {
    for (const side of [-1, 1]) {
      const fighter = standing(character, f32(side * 200.0), side);
      const input = controls({ direction: side });
      let frame = 0;
      for (; frame < 200 && Math.abs(fighter.motion.x) <= mainDeckRight(STAGE); frame++) {
        advanceSolo(fighter, STAGE, input, 0.0);
        if (!fighter.motion.grounded) break;
        onLine(fighter);
      }
      assertGreaterThan(Math.abs(fighter.motion.x), 590.0);
      for (let more = 0; more < 10; more++) advanceSolo(fighter, STAGE, input, 0.0);
      assertFalse(fighter.motion.grounded);
      assertLessThan(fighter.motion.z, mainDeckZ(STAGE));
    }
  }
});

test("a fighter falling onto a slope lands on the line under it [spec #193]", () => {
  for (const x of [-560.0, -510.0, -450.0, 0.0, 450.0, 510.0, 560.0]) {
    const fighter = createReferenceFighter(Character.sylvanas, x, 1);
    fighter.motion.grounded = false;
    fighter.motion.z = 120.0;
    setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
    fighter.motion.vz = -2.0;
    const input = controls();
    for (let frame = 0; frame < 120 && !fighter.motion.grounded; frame++) {
      assertGreaterThan(fighter.motion.z, f32(surfaceZAt(STAGE, 0, 0, fighter.motion.x) - f32(0.001)));
      advanceSolo(fighter, STAGE, input, 0.0);
    }
    onLine(fighter);
    assertEquals(fighter.motion.x, x);
    // It stays there, standing.
    for (let frame = 0; frame < 30; frame++) advanceSolo(fighter, STAGE, input, 0.0);
    onLine(fighter);
    assertEquals(fighter.motion.x, x);
  }
});

function tumbleOnto(x: number, input: Readonly<Controls>): Fighter {
  const fighter = createReferenceFighter(Character.sylvanas, x, 1);
  fighter.motion.grounded = false;
  fighter.down.state = DownState.tumble;
  fighter.launch.hitstun = 100;
  fighter.motion.z = f32(surfaceZAt(STAGE, 0, 0, x) + 1);
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  fighter.motion.vz = -2.0;
  seedTechWindow(fighter, 10);
  advanceSolo(fighter, STAGE, input, 0.0);
  return fighter;
}

test("a floor tech on a slope techs in place or rolls along the line [spec #193]", () => {
  for (const direction of [-1, 0, 1]) {
    const input = controls({ direction });
    const fighter = tumbleOnto(-510.0, input);
    assertEquals(fighter.down.state, direction === 0 ? DownState.tech : DownState.techRoll);
    onLine(fighter);
    const startX = fighter.motion.x;
    for (let frame = 0; frame < 60 && fighter.down.state !== DownState.none; frame++) {
      advanceSolo(fighter, STAGE, controls(), 0.0);
      onLine(fighter);
    }
    assertEquals(fighter.down.state, DownState.none);
    if (direction === 0) assertEquals(fighter.motion.x, startX);
    else assertGreaterThan(f32(direction * f32(fighter.motion.x - startX)), 30.0);
  }
});

test("a missed tech on a slope knocks down on the line, and the get-up stands there [spec #193]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 520.0, 1);
  fighter.motion.grounded = false;
  fighter.down.state = DownState.tumble;
  fighter.launch.hitstun = 100;
  fighter.motion.z = f32(surfaceZAt(STAGE, 0, 0, 520.0) + 1);
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  fighter.motion.vz = -2.0;
  advanceSolo(fighter, STAGE, controls(), 0.0);
  assertEquals(fighter.down.state, DownState.bound);
  onLine(fighter);
  for (let frame = 0; frame < 200 && currentDownState(fighter) !== DownState.none; frame++) {
    advanceSolo(fighter, STAGE, controls({ getupStandPressed: frame > 40 }), 0.0);
    onLine(fighter);
  }
  assertEquals(fighter.down.state, DownState.none);
});

test("the ledges at a slope's foot are grabbable corners, and the climb ends on the line [spec #193]", () => {
  for (const side of [-1, 1]) {
    const fighter = createReferenceFighter(Character.sylvanas, f32(side * 620.0), -side);
    fighter.motion.grounded = false;
    fighter.motion.z = -80.0;
    fighter.motion.vz = -2.0;
    fighter.motion.deltaZ = -2.0;
    fighter.jump.remaining = 0;
    const input = controls();
    resolveLedges(testWorld(fighter, createReferenceFighter(Character.rifleman, 0.0, 1)), STAGE, [input, controls()]);
    assertEquals(fighter.ledge.state, LedgeState.hang);
    advanceSolo(fighter, STAGE, input, 0.0);
    input.getupDirectionPressed = true;
    input.getupDirection = -side;
    advanceSolo(fighter, STAGE, input, 0.0);
    assertEquals(fighter.ledge.state, LedgeState.climb);
    const climb = controls();
    for (let tick = 1; tick <= LEDGE_CLIMB_FRAMES; tick++) {
      advanceSolo(fighter, STAGE, climb, 0.0);
      // The climb never passes into the deck.
      assertTrue(fighter.motion.z <= f32(surfaceZAt(STAGE, 0, 0, fighter.motion.x) + f32(0.001)));
    }
    assertEquals(fighter.ledge.state, LedgeState.none);
    onLine(fighter);
    assertGreaterThan(fighter.motion.z, mainDeckZ(STAGE));
    for (let frame = 0; frame < 20; frame++) advanceSolo(fighter, STAGE, climb, 0.0);
    onLine(fighter);
  }
});

test("selectable Stratholme's outer slope supports running and landing below its balconies [spec #193]", () => {
  const fighter = createReferenceFighter(Character.sylvanas, 550.0, -1);
  fighter.motion.grounded = false;
  fighter.motion.z = 80.0;
  setWorldMotionValue(fighter.motion.meleeZ, fighter.motion.z);
  for (let frame = 0; frame < 120 && !fighter.motion.grounded; frame++) advanceSolo(fighter, STRATHOLME_STAGE, controls(), 0.0);
  assertEquals(fighter.motion.surface, 0);
  assertEquals(fighter.motion.z, surfaceZAt(STRATHOLME_STAGE, 0, 0, fighter.motion.x));
  for (let frame = 0; frame < 20; frame++) {
    advanceSolo(fighter, STRATHOLME_STAGE, controls({ direction: -1 }), 0.0);
    assertTrue(fighter.motion.grounded);
    assertEquals(fighter.motion.z, surfaceZAt(STRATHOLME_STAGE, 0, 0, fighter.motion.x));
  }
});
