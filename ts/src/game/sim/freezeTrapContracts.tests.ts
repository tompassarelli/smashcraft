import { assertEquals, assertGreaterThan, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { canStartAttackStyle } from "./conditions";
import { type Fighter, createFighter } from "./fighter";
import { beginFighterAttack } from "./attacks";
import { FREEZE_TRAP_FREEZE_FRAMES, advanceFreezeTraps } from "./summons";
import { advanceSolo, controls, testWorld } from "./testWorld";
import { FREEZE_MINIMUM_FRAMES } from "./transitions";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { executeNext, testMatch } from "../match/testMatch";
import { fighterAt } from "./roster";
import { startFighterSpecial } from "./specials";
import { setHumanMask } from "../match/rules";
import { produceComputerInput } from "../match/botPlay";
import { sweep, sweepSeed } from "../../runtime/sweep";

test("Frost Trap appears at frame 22 and releases Rifleman at frame 38 [spec #325]", () => {
  const match = testMatch(3, Character.rifleman);
  const owner = fighterAt(match.world, 0);
  owner.motion.surface = 0;
  assertTrue(startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, specialZ: -1 })));
  assertFalse(canStartAttackStyle(owner, AttackStyle.jab));
  assertEquals(owner.freezeTrap.life, 0);
  for (let frame = 1; frame < 38; frame++) {
    executeNext(match);
    assertEquals(owner.special.action, SpecialAction.riflemanTrap);
    assertFalse(canStartAttackStyle(owner, AttackStyle.jab));
    if (frame < 22) assertEquals(owner.freezeTrap.life, 0);
    else assertGreaterThan(owner.freezeTrap.life, 0);
  }
  executeNext(match);
  assertEquals(owner.special.action, SpecialAction.none);
  assertTrue(canStartAttackStyle(owner, AttackStyle.jab));
  assertGreaterThan(owner.freezeTrap.life, 0);
  assertGreaterThan(owner.freezeTrap.cooldown, 0);
  beginFighterAttack(match.world, 0, AttackStyle.jab, false);
  assertEquals(owner.attack.style, AttackStyle.jab);
});

sweep("an Intermediate CPU punishes a point-blank trap before Rifleman can act in at least 4 of 24 match seeds, against 9-17 seen on six seed offsets [spec #325]", () => {
  let punishes = 0;
  for (let seed = 0; seed < 24; seed++) {
    const match = testMatch(3, Character.rifleman);
    match.game.matchSeed = sweepSeed(seed);
    const owner = fighterAt(match.world, 0);
    const target = fighterAt(match.world, 1);
    owner.motion.surface = 0;
    target.motion.surface = 0;
    target.motion.x = owner.motion.x + 60.0;
    target.facing = -1;
    setHumanMask(match.game, 1);
    match.game.cpuOpponents[1] = "wren";
    match.game.cpuResolvedOpponents[1] = "wren";
    match.game.cpuTiers[1] = "intermediate";
    assertTrue(startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, specialZ: -1 })));
    for (let frame = 1; frame < 60 && !canStartAttackStyle(owner, AttackStyle.jab); frame++) {
      produceComputerInput(match.game, match.world, match.runtime, 1, frame, match.inputs.inputs[1], match.inputs.commands[1]);
      executeNext(match);
      if (owner.status.damage > 0) { punishes++; break; }
    }
  }
  assertGreaterThan(punishes, 3);
});

test("a jump chosen fifteen frames after thaw leaves before a waiting trap can refreeze any fighter [spec docs/gameplay-design.md]", () => {
  for (const character of [Character.rifleman, Character.demonHunter]) {
    for (const [direction, verticalDirection] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      const match = testMatch(3, character);
      const owner = fighterAt(match.world, 0);
      const target = fighterAt(match.world, 1);
      owner.character = Character.rifleman;
      target.motion.surface = 0;
      target.status.frozenFrames = 1;
      owner.freezeTrap.life = 900;
      owner.freezeTrap.surface = target.motion.surface;
      owner.freezeTrap.x = target.motion.x;
      executeNext(match);
      assertEquals(target.status.frozenFrames, 0);
      match.inputs.inputs[1].direction = direction;
      match.inputs.inputs[1].verticalDirection = verticalDirection;
      for (let frame = 1; frame <= 20; frame++) {
        match.inputs.inputs[1].jumpPressed = frame === 15;
        match.inputs.inputs[1].jumpHeld = frame >= 15;
        executeNext(match);
        assertEquals(target.status.frozenFrames, 0);
      }
      assertFalse(target.motion.grounded);
      assertGreaterThan(owner.freezeTrap.life, 0);
    }
  }
});

function trapFrozenRifleman(): Fighter {
  const owner = createFighter(Character.rifleman, 0.0, 1);
  const target = createFighter(Character.rifleman, 0.0, -1);
  owner.motion.surface = 0;
  target.motion.surface = 0;
  owner.freezeTrap.life = 30;
  owner.freezeTrap.x = 0.0;
  owner.freezeTrap.surface = 0;
  advanceFreezeTraps(testWorld(owner, target));
  assertEquals(target.status.frozenFrames, FREEZE_TRAP_FREEZE_FRAMES);
  return target;
}

function thawFrame(rate: number, wiggle: boolean): number {
  const target = trapFrozenRifleman();
  let frame = 0;
  while (target.status.frozenFrames > 0) {
    frame++;
    const press = rate > 0 && (floorDiv(frame * rate, 60) !== floorDiv((frame - 1) * rate, 60) || frame === 1);
    const direction = wiggle ? (floorMod(floorDiv((frame - 1) * rate, 60), 2) === 0 ? 1 : -1) : 0;
    advanceSolo(target, 0, controls({ grabMashPressed: press, direction }), 0.0);
  }
  return frame;
}

test("mashing out of a freeze: the thaw frame by mash rate [spec docs/gameplay-design.md]", () => {

  assertEquals(thawFrame(0, false), 300);
  assertEquals(thawFrame(4, false), 195);
  assertEquals(thawFrame(8, false), 143);
  assertEquals(thawFrame(12, false), 115);
  assertEquals(thawFrame(8, true), 92);
  assertEquals(thawFrame(14, true), 61);
  assertEquals(thawFrame(30, true), FREEZE_MINIMUM_FRAMES);
});
