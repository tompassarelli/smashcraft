import { stageBounds } from "./stageBounds";
import { assertEquals, assertGreaterThan, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { canStartAttackStyle } from "./conditions";
import { createFighter } from "./fighter";
import { attackDurationFramesForGrounding, attackStartupFrames } from "./moves";
import { resolveAttacks, beginFighterAttack } from "./attacks";
import { advanceFreezeTraps } from "./summons";
import { advanceSolo, controls, testWorld } from "./testWorld";
import { respawnFighter } from "./stocks";
import { createRoster } from "./roster";
import { f32 } from "wisp/src/sim/f32";
import { executeNext, testMatch } from "../match/testMatch";
import { fighterAt } from "./roster";
import { startFighterSpecial } from "./specials";
import { originalClipNamed } from "../assets/fighterOriginalClipInfo";

test("Frost Trap plays its laying animation and releases Rifleman after twenty frames", () => {
  const match = testMatch(3, Character.rifleman);
  const owner = fighterAt(match.world, 0);
  owner.motion.surface = 0;
  assertTrue(startFighterSpecial(owner, 0, 0, controls({ specialPressed: true, specialZ: -1 })));
  assertFalse(canStartAttackStyle(owner, AttackStyle.jab));
  for (let frame = 1; frame < 20; frame++) {
    executeNext(match);
    assertEquals(owner.special.action, SpecialAction.riflemanTrap);
    assertEquals(match.runtime.poses[0].clipIndex, originalClipNamed(Character.rifleman, "special down"));
    if (frame > 1) assertGreaterThan(match.runtime.poses[0].clipTime, 0.0);
    assertFalse(canStartAttackStyle(owner, AttackStyle.jab));
  }
  executeNext(match);
  assertEquals(owner.special.action, SpecialAction.none);
  assertTrue(canStartAttackStyle(owner, AttackStyle.jab));
  assertGreaterThan(owner.freezeTrap.life, 0);
  assertGreaterThan(owner.freezeTrap.cooldown, 0);
  beginFighterAttack(match.world, 0, AttackStyle.jab, false);
  assertEquals(owner.attack.style, AttackStyle.jab);
});

test("an unused Frost Trap expires after eight seconds and can be replaced", () => {
  const match = testMatch(3, Character.rifleman);
  const owner = fighterAt(match.world, 0);
  owner.motion.surface = 0;
  const lay = controls({ specialPressed: true, specialZ: -1 });
  assertTrue(startFighterSpecial(owner, 0, 0, lay));
  for (let frame = 1; frame < 480; frame++) executeNext(match);
  assertGreaterThan(owner.freezeTrap.life, 0);
  assertFalse(startFighterSpecial(owner, 0, 479, lay));
  executeNext(match);
  assertEquals(owner.freezeTrap.life, 0);
  assertTrue(startFighterSpecial(owner, 0, 480, lay));
});

test("a jump chosen fifteen frames after thaw leaves before a waiting trap can refreeze any fighter", () => {
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
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

test("a thawed fighter who stays on a waiting trap can be caught again only after the escape interval", () => {
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

test("shieldConsumesTrapWithoutFreezingAndHitBreaksIce", () => {
  const owner = createFighter(Character.rifleman, 0.0, 1);
  const target = createFighter(Character.archer, 0.0, -1);
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

test("trapConsumesOnContactButNotOwnerOrInvulnerableTarget", () => {
  const owner = createFighter(Character.rifleman, 0.0, 1);
  const target = createFighter(Character.archer, 0.0, -1);
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

test("freezeExpiresAfterThreeHundredFramesIncludingHitlag", () => {
  const target = createFighter(Character.archer, 0.0, 1);
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

test("koRespawnAndResetClearTrapAndFrozenState", () => {
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
