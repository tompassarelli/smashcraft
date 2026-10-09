import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackPhase, AttackStyle, Character, DASH_GRAB_REQUEST, GrabAction } from "../codes";
import { attackPhase } from "../conditions";
import { createFighter } from "../fighter";
import { SHARED_GRAB_REGION, authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "../hitRegions";
import { attackStartupFrames, grabActionDuration, grabContactFrame, isAerialAttack, smashDamageMultiplier } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { HurtContact, fighterHurtParts, strikeHurtContact } from "../hurtboxes";
import { MOUNTAIN_KING_MOVES, SHORT } from "./mountainKingMoves";
import { comboScene } from "../../match/comboRoute";
import { fighter, frameMasks } from "../../match/padScene";
import { Action, bit } from "../../input/actions";



const NORMAL_TIMINGS = [
  [AttackStyle.jab, 5, 2, 16, 0],
  [AttackStyle.upTilt, 8, 4, 22, 0],
  [AttackStyle.dashAttack, 11, 5, 26, 0],
  [AttackStyle.forwardSmash, 20, 3, 36, 0],
  [AttackStyle.upSmash, 17, 5, 32, 0],
  [AttackStyle.downSmash, 16, 6, 22, 0],
  [AttackStyle.neutralAir, 8, 6, 22, 15],
  [AttackStyle.forwardAir, 16, 3, 30, 21],
  [AttackStyle.backAir, 10, 3, 25, 15],
  [AttackStyle.upAir, 7, 4, 22, 13],
  [AttackStyle.downAir, 12, 5, 29, 20],
  [AttackStyle.grab, 8, 3, 24, 0],
] as const;

function attackPair(style: AttackStyle, frame: number, targetX: number, targetZ = 0.0, facing = 1, groundedTarget = true) {
  const owner = createFighter(Character.rifleman, 0.0, facing);
  owner.tuning.moves = MOUNTAIN_KING_MOVES;
  owner.motion.grounded = !isAerialAttack(style);
  const target = createFighter(Character.rifleman, f32(targetX * facing), -facing);
  target.motion.z = targetZ;
  target.motion.grounded = groundedTarget;
  const world = testWorld(owner, target);
  beginFighterAttack(world, 0, style, false);
  assertEquals(owner.attack.style, style);
  owner.attack.frame = frame;
  owner.attack.cooldown = owner.attack.duration - frame;
  return { owner, target, world };
}

test("Mountain King production phases match the adopted roster [spec docs/design/roster.md]", () => {
  for (const [style, first, active] of NORMAL_TIMINGS) {
    const { owner } = attackPair(style, 0, 1000.0);
    assertEquals(attackStartupFrames(style, owner.tuning.moves), first - 1);
    owner.attack.frame = first - 2;
    assertEquals(attackPhase(owner), AttackPhase.startup);
    owner.attack.frame = first - 1;
    assertEquals(attackPhase(owner), AttackPhase.active);
    owner.attack.frame = first + active - 2;
    assertEquals(attackPhase(owner), AttackPhase.active);
    owner.attack.frame++;
    assertEquals(attackPhase(owner), AttackPhase.recovery);
  }
});

test("Mountain King authored contact paths exist only on their adopted active frames [spec docs/design/roster.md]", () => {
  const out = emptyHitRegion();
  for (const [style, first, active, recovery] of NORMAL_TIMINGS) {
    const count = authoredHitRegionCount(style, MOUNTAIN_KING_MOVES);
    assertGreaterThan(count, 0);
    for (let actionFrame = 0; actionFrame < first + active + recovery; actionFrame++) {
      let live = 0;
      for (let index = 0; index < count; index++) {
        authoredHitRegion(out, Character.rifleman, style, actionFrame, 0, index, MOUNTAIN_KING_MOVES);
        if (out.window > 0) {
          live++;
          assertEquals(out.window, 1);
          assertTrue(style === AttackStyle.grab ? out.maxX === SHARED_GRAB_REGION.maxX && out.strike === undefined : out.strike !== undefined);
        }
      }
      assertEquals(live > 0, actionFrame >= first - 1 && actionFrame < first - 1 + active);
    }
  }
});

test("Mountain King hammer head wins overlaps and the close handle keeps its weaker hit [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const smash = [120.0, 40.0].map((x) => {
      const { target, world } = attackPair(AttackStyle.forwardSmash, 20, x, 0.0, facing);
      resolveAttacks(world);
      return target.status.damage;
    });
    assertGreaterThan(smash[1]!, 0.0);
    assertGreaterThan(smash[0]!, smash[1]!);
    const drop = ([[85.0, true], [20.0, false]] as const).map(([x, spike]) => {
      const { target, world } = attackPair(AttackStyle.forwardAir, 16, x, 0.0, facing, false);
      resolveAttacks(world);
      assertEquals(target.launch.knockbackZ < 0, spike);
      return target.status.damage;
    });
    assertGreaterThan(drop[1]!, 0.0);
    assertGreaterThan(drop[0]!, drop[1]!);
  }
});

test("Mountain King hammer-drop and double-boot spikes launch grounded targets upward [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const hammer = attackPair(AttackStyle.forwardAir, 16, 85.0, 0.0, facing, true);
    resolveAttacks(hammer.world);
    assertGreaterThan(hammer.target.status.damage, 0.0);
    assertGreaterThan(hammer.target.launch.knockbackX * facing, 0.0);
    assertGreaterThan(hammer.target.launch.knockbackZ, 0.0);
    const boots = attackPair(AttackStyle.downAir, 11, 0.0, -45.0, facing, true);
    resolveAttacks(boots.world);
    assertGreaterThan(boots.target.status.damage, 0.0);
    assertGreaterThan(boots.target.launch.knockbackZ, 0.0);
  }
});

test("Mountain King stone sweep contacts once across its front and back arcs [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const { owner, target, world } = attackPair(AttackStyle.downSmash, 15, 85.0, 0.0, facing);
    resolveAttacks(world);
    const swept = target.status.damage;
    assertGreaterThan(swept, 0.0);
    target.motion.x = f32(-85.0 * facing);
    owner.launch.hitlag = 0;
    owner.attack.frame = 18;
    resolveAttacks(world);
    assertEquals(target.status.damage, swept);
    const back = attackPair(AttackStyle.downSmash, 18, -85.0, 0.0, facing);
    resolveAttacks(back.world);
    assertGreaterThan(back.target.status.damage, 0.0);
    assertLessThan(back.target.launch.knockbackX * facing, 0.0);
  }
});

test("Mountain King angled axe hooks have distinct narrow paths and body attacks have no weapon reach [spec docs/design/roster.md]", () => {
  const straight = emptyHitRegion();
  const up = emptyHitRegion();
  const down = emptyHitRegion();
  authoredHitRegion(straight, Character.rifleman, AttackStyle.forwardTilt, 9, 0, 0, MOUNTAIN_KING_MOVES);
  authoredHitRegion(up, Character.rifleman, AttackStyle.forwardTiltUp, 9, 0, 0, MOUNTAIN_KING_MOVES);
  authoredHitRegion(down, Character.rifleman, AttackStyle.forwardTiltDown, 9, 0, 0, MOUNTAIN_KING_MOVES);
  assertGreaterThan(up.maxZ, straight.maxZ);
  assertLessThan(down.minZ, straight.minZ);
  assertGreaterThan(up.effect.launchZ, straight.effect.launchZ);
  assertLessThan(down.effect.launchZ, straight.effect.launchZ);
  for (const style of [AttackStyle.dashAttack, AttackStyle.neutralAir, AttackStyle.upAir]) {
    const region = emptyHitRegion();
    const first = attackStartupFrames(style, MOUNTAIN_KING_MOVES);
    for (let index = 0; index < authoredHitRegionCount(style, MOUNTAIN_KING_MOVES); index++) {
      authoredHitRegion(region, Character.rifleman, style, first, 0, index, MOUNTAIN_KING_MOVES);
      if (region.window > 0) {

        const reach = style === AttackStyle.dashAttack ? 28.0 : 24.0;
        assertTrue(region.minX >= -24.0);
        assertTrue(region.maxX <= reach);
      }
    }
  }
  const gap = attackPair(AttackStyle.upAir, 6, 72.0, 0.0, 1, false);
  resolveAttacks(gap.world);
  assertEquals(gap.target.status.damage, 0.0);
});

test("Mountain King standing grab uses scaled reach and its dash jab selects the body charge [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const catchable = attackPair(AttackStyle.grab, 7, 96.0, 0.0, facing);
    resolveAttacks(catchable.world);
    assertEquals(catchable.owner.grab.target, 1);
    assertEquals(catchable.target.grab.owner, 0);
    const outside = attackPair(AttackStyle.grab, 7, 97.0, 0.0, facing);
    resolveAttacks(outside.world);
    assertEquals(outside.owner.grab.target, undefined);
    const owner = createFighter(Character.rifleman, 0.0, facing);
    owner.tuning.moves = MOUNTAIN_KING_MOVES;
    owner.ground.dashFrame = 1;
    beginFighterAttack(testWorld(owner, createFighter(Character.rifleman, 1000.0, -facing)), 0, AttackStyle.jab, false);
    assertEquals(owner.attack.style, AttackStyle.dashAttack);
  }
  assertEquals(smashDamageMultiplier(0, MOUNTAIN_KING_MOVES), 1.0);
  assertEquals(smashDamageMultiplier(45, MOUNTAIN_KING_MOVES), 1.25);
  assertEquals(smashDamageMultiplier(100, MOUNTAIN_KING_MOVES), 1.25);
});

test("Mountain King dash grab extends standing reach with three startup and eleven total frames added [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    for (const [x, caught] of [[120.0, true], [121.0, false]] as const) {
      const owner = createFighter(Character.rifleman, 0.0, facing);
      owner.tuning.moves = MOUNTAIN_KING_MOVES;
      owner.ground.dashFrame = 1;
      const target = createFighter(Character.rifleman, f32(x * facing), -facing);
      const world = testWorld(owner, target);
      beginFighterAttack(world, 0, DASH_GRAB_REQUEST, false);
      assertEquals(owner.attack.style, AttackStyle.grab);
      assertTrue(owner.attack.dashGrab);
      assertEquals(owner.attack.duration, 45);
      owner.attack.frame = 9;
      assertEquals(attackPhase(owner), AttackPhase.startup);
      resolveAttacks(world);
      assertEquals(owner.grab.target, undefined);
      owner.attack.frame = 10;
      assertEquals(attackPhase(owner), AttackPhase.active);
      resolveAttacks(world);
      assertEquals(owner.grab.target !== undefined, caught);
    }
  }
});

const THROW_ROWS = [
  [GrabAction.throwForward, 14, 22, 35],
  [GrabAction.throwBack, 18, 27, 40],
  [GrabAction.throwUp, 16, 13, 90],
  [GrabAction.throwDown, 20, 26, 25],
] as const;

test("Mountain King throws release once on their roster frame with facing-relative launch [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    for (const [action, release, recovery, angle] of THROW_ROWS) {
      const { owner, target, world } = attackPair(AttackStyle.grab, 7, 40.0, 0.0, facing);
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
      assertEquals(grabContactFrame(action, owner.tuning.moves), release);
      assertEquals(grabActionDuration(action, owner.tuning.moves), release + recovery);
      const input = controls({
        grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0,
        grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0,
      });
      for (let tick = 1; tick < release; tick++) {
        testGrabFrame(world, [input, controls()], false);
        assertEquals(owner.grab.action, action);
        assertEquals(target.grab.owner, 0);
        assertEquals(target.status.damage, 0.0);
      }
      testGrabFrame(world, [input, controls()], false);
      assertEquals(target.grab.owner, undefined);
      assertEquals(owner.grab.target, undefined);
      const thrown = target.status.damage;
      assertGreaterThan(thrown, 0.0);
      assertTrue(target.launch.throwHitstun);
      assertGreaterThan(target.launch.hitstun, 0);
      assertGreaterThan(target.launch.knockbackZ, 0.0);
      if (angle === 90) assertEquals(target.launch.knockbackX, 0.0);
      else if (action === GrabAction.throwBack) assertLessThan(target.launch.knockbackX * facing, 0.0);
      else assertGreaterThan(target.launch.knockbackX * facing, 0.0);
      testGrabFrame(world, [input, controls()], false);
      assertEquals(target.status.damage, thrown);
    }
  }
});

test("Mountain King's limbs follow his swings while hammer and axe stay disjoint [spec docs/design/roster.md]", () => {
  for (const facing of [1, -1]) {
    const mk = createFighter(Character.rifleman, 0.0, facing);
    mk.tuning.moves = MOUNTAIN_KING_MOVES;
    const body = fighterHurtParts(mk)[0];
    assertTrue(body !== undefined);
    if (body !== undefined) assertNear(f32(f32(body.z2 - body.z1) + f32(2.0 * body.radius)), f32(HERO_REFERENCE_HEIGHT * f32(0.85)), f32(0.001));
    const foot = { x1: f32((SHORT - 8.0) * facing), z1: 10.0, x2: f32((SHORT - 8.0) * facing), z2: 10.0, radius: 2.0 };
    assertEquals(strikeHurtContact(foot, mk), HurtContact.none);
    mk.attack.style = AttackStyle.downTilt;
    for (const [frame, exposed] of [[6, false], [7, true], [9, true], [11, true], [12, false]] as const) {
      mk.attack.frame = frame;
      assertEquals(strikeHurtContact(foot, mk), exposed ? HurtContact.hit : HurtContact.none);
    }
    mk.attack.style = AttackStyle.forwardSmash;
    const out = emptyHitRegion();
    for (let frame = 19; frame <= 21; frame++) {
      mk.attack.frame = frame;
      for (let index = 0; index < 3; index++) {
        authoredHitRegion(out, Character.rifleman, AttackStyle.forwardSmash, frame, 0, index, MOUNTAIN_KING_MOVES);
        if (out.window === 0 || out.strike === undefined) continue;
        const head = { x1: f32(out.strike.x1 * facing), z1: out.strike.z1, x2: f32(out.strike.x2 * facing), z2: out.strike.z2, radius: out.strike.radius };
        assertEquals(strikeHurtContact(head, mk), HurtContact.none);
      }
    }
  }
});

test("Mountain King dash attack reaches a Rifleman-sized body [repro #359]", () => {

  const match = comboScene({ stage: 0, attacker: Character.mountainKing, defender: Character.rifleman, attackerX: -50.0, defenderX: 50.0, facing: 1, attackerZ: 0, defenderZ: 0, percent: 0 });
  for (let n = 1; n <= 40; n++) frameMasks(match, (slot) => (slot === 0 ? (n <= 6 ? bit(Action.moveRight) : n === 7 ? bit(Action.attack) : 0) : 0));
  assertGreaterThan(fighter(match, 1).status.damage, 13.0);
});
