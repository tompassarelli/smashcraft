import { stageBounds } from "./stageBounds";
import { assertEquals, assertGreaterThan, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { canStartAttackStyle } from "./conditions";
import { type Fighter, createFighter } from "./fighter";
import { attackDurationFramesForGrounding, attackStartupFrames } from "./moves";
import { resolveAttacks, beginFighterAttack } from "./attacks";
import { FREEZE_TRAP_FREEZE_FRAMES, advanceFreezeTraps } from "./summons";
import { advanceSolo, controls, testWorld } from "./testWorld";
import { respawnFighter } from "./stocks";
import { MASH_FRAMES } from "./mash";
import { FREEZE_MINIMUM_FRAMES } from "./transitions";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { type Controls, createRoster } from "./roster";
import { f32 } from "wisp/src/sim/f32";
import { executeNext, testMatch } from "../match/testMatch";
import { fighterAt } from "./roster";
import { startFighterSpecial } from "./specials";
import { setHumanMask } from "../match/rules";
import { produceComputerInput } from "../match/botPlay";

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

test("an Intermediate CPU punishes a point-blank trap before Rifleman can act [spec #325]", () => {
  const match = testMatch(3, Character.rifleman);
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
  let punished = false;
  for (let frame = 1; frame < 38; frame++) {
    produceComputerInput(match.game, match.world, match.runtime, 1, frame, match.inputs.inputs[1], match.inputs.commands[1]);
    executeNext(match);
    if (owner.status.damage > 0) { punished = true; break; }
    assertFalse(canStartAttackStyle(owner, AttackStyle.jab));
  }
  assertTrue(punished);
});

test("an unused Frost Trap expires after eight seconds and can be replaced [spec docs/physics.md]", () => {
  const match = testMatch(3, Character.rifleman);
  const owner = fighterAt(match.world, 0);
  owner.motion.surface = 0;
  const lay = controls({ specialPressed: true, specialZ: -1 });
  assertTrue(startFighterSpecial(owner, 0, 0, lay));
  for (let frame = 1; frame < 22; frame++) executeNext(match);
  executeNext(match);
  for (let frame = 1; frame < 480; frame++) executeNext(match);
  assertGreaterThan(owner.freezeTrap.life, 0);
  assertFalse(startFighterSpecial(owner, 0, 501, lay));
  executeNext(match);
  assertEquals(owner.freezeTrap.life, 0);
  assertTrue(startFighterSpecial(owner, 0, 502, lay));
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

test("a thawed fighter who stays on a waiting trap can be caught again only after the escape interval [spec docs/physics.md]", () => {
  const match = testMatch(3, Character.rifleman);
  const owner = fighterAt(match.world, 0);
  const target = fighterAt(match.world, 1);
  target.motion.surface = 0;
  target.status.frozenFrames = 1;
  owner.freezeTrap.life = 900;
  owner.freezeTrap.surface = target.motion.surface;
  owner.freezeTrap.x = target.motion.x;
  executeNext(match);
  for (let frame = 1; frame < 20; frame++) {
    executeNext(match);
    assertEquals(target.status.frozenFrames, 0);
    assertGreaterThan(owner.freezeTrap.life, 0);
  }
  executeNext(match);
  assertEquals(target.status.frozenFrames, 300);
  assertEquals(owner.freezeTrap.life, 0);
});

test("shieldConsumesTrapWithoutFreezingAndHitBreaksIce [spec docs/physics.md]", () => {
  const owner = createFighter(Character.rifleman, 0.0, 1);
  const target = createFighter(Character.rifleman, 0.0, -1);
  owner.motion.surface = 0;
  target.motion.surface = 0;
  owner.freezeTrap.life = 30;
  owner.freezeTrap.x = 0.0;
  owner.freezeTrap.surface = 0;
  target.shield.raised = true;
  advanceFreezeTraps(testWorld(owner, target));
  assertEquals(owner.freezeTrap.life, 0);
  assertEquals(target.status.frozenFrames, 0);
  target.shield.raised = false;
  target.status.frozenFrames = 100;
  owner.motion.x = 0.0;
  beginFighterAttack(testWorld(owner, target), 0, AttackStyle.jab, false);
  owner.attack.frame = attackStartupFrames(AttackStyle.jab);
  owner.attack.duration = attackDurationFramesForGrounding(AttackStyle.jab, true);
  owner.attack.hit = false;
  target.motion.x = 100.0;
  resolveAttacks(testWorld(owner, target));
  assertGreaterThan(target.status.damage, 0.0);
  assertEquals(target.status.frozenFrames, 0);
  assertGreaterThan(target.status.freezeImmunityFrames, 0);
});

test("trapConsumesOnContactButNotOwnerOrInvulnerableTarget [spec docs/physics.md]", () => {
  const owner = createFighter(Character.rifleman, 0.0, 1);
  const target = createFighter(Character.rifleman, 0.0, -1);
  owner.motion.surface = 0;
  target.motion.surface = 0;
  owner.freezeTrap.life = 30;
  owner.freezeTrap.arming = 0;
  owner.freezeTrap.x = 0.0;
  owner.freezeTrap.surface = 0;
  target.status.invincible = 2;
  advanceFreezeTraps(testWorld(owner, target));
  assertEquals(owner.freezeTrap.life, 30);
  assertEquals(target.status.frozenFrames, 0);
  target.status.invincible = 0;
  advanceFreezeTraps(testWorld(owner, target));
  assertEquals(owner.freezeTrap.life, 0);
  assertEquals(target.status.frozenFrames, 300);
  assertEquals(owner.status.frozenFrames, 0);
});

test("freezeExpiresAfterThreeHundredFramesIncludingHitlag [spec docs/physics.md]", () => {
  const target = createFighter(Character.rifleman, 0.0, 1);
  target.status.frozenFrames = 300;
  target.launch.hitlag = 20;
  for (let frame = 1; frame < 300; frame++) advanceSolo(target, 0, controls(), -240.0);
  assertEquals(target.status.frozenFrames, 1);
  assertEquals(target.launch.hitlag, 20);
  advanceSolo(target, 0, controls(), -240.0);
  assertEquals(target.status.frozenFrames, 0);
  assertEquals(target.launch.hitlag, 20);
  assertFalse(canStartAttackStyle(target, AttackStyle.jab));
  target.launch.hitlag = 0;
  assertTrue(canStartAttackStyle(target, AttackStyle.jab));
});

test("koRespawnAndResetClearTrapAndFrozenState [spec docs/physics.md]", () => {
  const rifleman = createFighter(Character.rifleman, 0.0, 1);
  const world = createRoster(1, [rifleman]);
  rifleman.status.stocks = 2;
  rifleman.freezeTrap.life = 900;
  rifleman.freezeTrap.arming = 12;
  rifleman.freezeTrap.serial = 3;
  rifleman.status.frozenFrames = 120;
  rifleman.status.freezeImmunityFrames = 20;
  rifleman.motion.x = f32(stageBounds(0).blast.right + 0.0009765625);
  advanceSolo(rifleman, 0, controls(), -240.0);
  assertTrue(rifleman.status.out);
  assertEquals(rifleman.status.stocks, 1);
  assertEquals(rifleman.freezeTrap.life, 0);
  assertEquals(rifleman.status.frozenFrames, 0);
  assertEquals(rifleman.status.freezeImmunityFrames, 0);
  for (let frame = 1; frame <= 60; frame++) advanceSolo(rifleman, 0, controls(), -240.0);
  assertFalse(rifleman.status.out);
  assertEquals(rifleman.freezeTrap.serial, 0);
  assertEquals(rifleman.freezeTrap.life, 0);
  assertEquals(rifleman.freezeTrap.cooldown, 0);
  assertEquals(rifleman.status.frozenFrames, 0);
  rifleman.freezeTrap.life = 900;
  rifleman.freezeTrap.serial = 1;
  rifleman.status.frozenFrames = 12;
  rifleman.status.freezeImmunityFrames = 20;
  respawnFighter(world, 0, 240.0);
  assertEquals(rifleman.freezeTrap.serial, 0);
  assertEquals(rifleman.freezeTrap.life, 0);
  assertEquals(rifleman.status.frozenFrames, 0);
  assertEquals(rifleman.status.freezeImmunityFrames, 0);
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

test("each fresh press or new stick direction takes eight frames off a freeze, never ending it before frame sixty [spec docs/gameplay-design.md]", () => {
  const target = trapFrozenRifleman();
  const step = (input: Partial<Controls>) => advanceSolo(target, 0, controls(input), 0.0);
  step({});
  assertEquals(target.status.frozenFrames, FREEZE_TRAP_FREEZE_FRAMES - 1);

  step({ grabMashPressed: true, direction: 1, verticalDirection: 1 });
  assertEquals(target.status.frozenFrames, FREEZE_TRAP_FREEZE_FRAMES - 2 - 2 * MASH_FRAMES);

  step({ direction: 1, verticalDirection: 1 });
  step({});
  assertEquals(target.status.frozenFrames, FREEZE_TRAP_FREEZE_FRAMES - 4 - 2 * MASH_FRAMES);

  step({ direction: -1 });
  assertEquals(target.status.frozenFrames, FREEZE_TRAP_FREEZE_FRAMES - 5 - 3 * MASH_FRAMES);

  let frame = 5;
  while (target.status.frozenFrames > 0) {
    frame++;
    step({ grabMashPressed: true, direction: floorMod(frame, 2) === 0 ? 1 : -1 });
  }
  assertEquals(frame, FREEZE_MINIMUM_FRAMES);
  assertGreaterThan(target.status.freezeImmunityFrames, 0);
  assertEquals(target.grab.heldFrames, 0);
  assertEquals(target.grab.mashX, 0);
});


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

test("a held button does not mash a freeze [spec docs/gameplay-design.md]", () => {

  const target = trapFrozenRifleman();
  advanceSolo(target, 0, controls({ grabMashPressed: true, attackHeld: true, jumpHeld: true, shield: true }), 0.0);
  for (let frame = 2; frame <= 20; frame++) advanceSolo(target, 0, controls({ attackHeld: true, jumpHeld: true, shield: true }), 0.0);
  assertEquals(target.status.frozenFrames, FREEZE_TRAP_FREEZE_FRAMES - 20 - MASH_FRAMES);
});
