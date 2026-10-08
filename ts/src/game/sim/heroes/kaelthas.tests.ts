import { assertEquals, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { isIntangible } from "../conditions";
import { createFighter } from "../fighter";
import { attackStartupFrames, isAerialAttack } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { updateProjectiles } from "../projectiles";
import { advanceFighter } from "../step";
import { fighterAt, type Controls, type Roster } from "../roster";
import { KAELTHAS_MOVES } from "./kaelthasMoves";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { projectedProjectile } from "../../presentation/projectilePose";
import { cancelSpecialState } from "../transitions";

const normalCases = [
  [AttackStyle.jab, 45.0, 0.0, 3.0], [AttackStyle.jab2, 50.0, 0.0, 4.0],
  [AttackStyle.forwardTilt, 95.0, 0.0, 8.0], [AttackStyle.forwardTiltUp, 95.0, 50.0, 8.0],
  [AttackStyle.forwardTiltDown, 95.0, -25.0, 8.0], [AttackStyle.upTilt, 10.0, 65.0, 8.0],
  [AttackStyle.downTilt, 85.0, -20.0, 6.0], [AttackStyle.dashAttack, 85.0, 0.0, 9.0],
  [AttackStyle.forwardSmash, 135.0, 0.0, 16.0], [AttackStyle.upSmash, 0.0, 90.0, 15.0],
  [AttackStyle.downSmash, 105.0, -20.0, 14.0], [AttackStyle.neutralAir, 45.0, 0.0, 7.0],
  [AttackStyle.forwardAir, 100.0, 0.0, 10.0], [AttackStyle.backAir, -120.0, 0.0, 11.0],
  [AttackStyle.upAir, 0.0, 85.0, 9.0], [AttackStyle.downAir, 0.0, -120.0, 12.0],
  [AttackStyle.getupAttack, -60.0, -20.0, 7.0], [AttackStyle.ledgeAttack, 80.0, 0.0, 7.0],
] as const;

function pair(x: number, facing = 1) {
  const owner = createFighter(Character.kaelthas, 0.0, facing);
  const target = createFighter(Character.rifleman, f32(x * facing), -facing);
  for (const fighter of [owner, target]) { fighter.motion.grounded = true; fighter.motion.surface = 0; }
  owner.mana.points = 40; target.mana.points = 60;
  return { owner, target, world: testWorld(owner, target) };
}

test("Kaelthas every normal starts after its tell, hits once and steals sphere mana in both facings [spec docs/design/kaelthas.md]", () => {
  for (const facing of [-1, 1]) for (const [style, x, z, damage] of normalCases) {
    const { owner, target, world } = pair(x, facing);
    owner.motion.grounded = !isAerialAttack(style); target.motion.grounded = false; target.motion.z = z;
    const move = KAELTHAS_MOVES.normals[style]; assertTrue(move !== undefined); if (move === undefined) continue;
    owner.attack.style = style; owner.attack.duration = move.totalFrames; owner.attack.frame = move.startupFrames - 1;
    resolveAttacks(world); assertEquals(target.status.damage, 0.0);
    owner.attack.frame++; resolveAttacks(world); assertEquals(target.status.damage, damage, `normal ${style}`);
    assertEquals(target.visuals.manaDrained, 1); assertGreaterThan(owner.mana.points, 40);
    owner.launch.hitlag = 0; target.launch.hitlag = 0; resolveAttacks(world); assertEquals(target.status.damage, damage);
  }
});

test("Kaelthas grab catches shield and every directional throw releases once [spec docs/design/kaelthas.md]", () => {
  for (const facing of [-1, 1]) for (const [action, release, damage] of [
    [GrabAction.throwForward, 14, 7.0], [GrabAction.throwBack, 17, 9.0], [GrabAction.throwUp, 16, 7.0], [GrabAction.throwDown, 18, 6.0],
  ] as const) {
    const { owner, target, world } = pair(55.0, facing); target.shield.raised = true;
    beginFighterAttack(world, 0, AttackStyle.grab, false); owner.attack.frame = attackStartupFrames(AttackStyle.grab, KAELTHAS_MOVES);
    resolveAttacks(world); assertEquals(owner.grab.target, 1);
    const input = controls({ grabThrowX: action === GrabAction.throwForward ? facing : action === GrabAction.throwBack ? -facing : 0, grabThrowZ: action === GrabAction.throwUp ? 1 : action === GrabAction.throwDown ? -1 : 0 });
    for (let tick = 1; tick <= release; tick++) testGrabFrame(world, [input, controls()], false);
    assertEquals(target.status.damage, damage); assertEquals(target.grab.owner, undefined); assertGreaterThan(target.launch.knockbackZ, 0.0);
    if (action === GrabAction.throwBack) assertLessThan(f32(target.launch.knockbackX * facing), 0.0);
    testGrabFrame(world, [input, controls()], false); assertEquals(target.status.damage, damage);
  }
});

function frame(world: Roster, input: Readonly<Controls> = controls(), targetInput: Readonly<Controls> = controls()): void {
  const rows = [input, targetInput];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, rows[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  beginDamageContacts();
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(fighterAt(world, slot), 0, 0, rows[slot] ?? controls());
  resolveAttacks(world); advanceSpecials(world, 0, 0, rows); updateProjectiles(world); finishDamageContacts(world);
}

test("Kaelthas Flame Strike leaves the hand on frame 12 and launches the first body it reaches once [spec docs/design/kaelthas.md]", () => {
  for (const facing of [-1, 1]) for (const [x, contact] of [[120.0, 12], [180.0, 19], [300.0, 32], [400.0, 43]] as const) {
    const { owner, target, world } = pair(x, facing);
    frame(world, controls({ specialPressed: true })); assertEquals(owner.special.action, SpecialAction.heroNeutral); assertEquals(owner.mana.points, 40);
    for (let tick = 2; tick < contact; tick++) frame(world);
    assertEquals(target.status.damage, 0.0, `before ${x}`);
    frame(world); assertEquals(target.status.damage, 12.0, `at ${x}`); assertGreaterThan(target.launch.knockbackZ, 0.0);
    for (let tick = contact + 1; tick <= 60; tick++) frame(world);
    assertEquals(target.status.damage, 12.0); assertEquals(owner.mana.points, 52);
  }
});

test("Kaelthas Flame Strike shows live fire travelling ahead from frame 12 to frame 44 [spec docs/design/kaelthas.md]", () => {
  for (const facing of [-1, 1]) {
    const { owner, world } = pair(1000.0, facing);
    frame(world, controls({ specialPressed: true }));
    for (let tick = 2; tick <= 11; tick++) frame(world);
    assertTrue(!projectedProjectile(owner, 0, true).visible);
    frame(world);
    const flame = projectedProjectile(owner, 0, true);
    assertTrue(flame.visible); assertTrue(flame.armed);
    assertEquals(flame.animationSequence, "birth"); assertEquals(flame.animationSeconds, f32(1.5 + f32(1 / 60)));
    const start = flame.x;
    for (let tick = 13; tick <= 44; tick++) frame(world);
    const last = projectedProjectile(owner, 0, true);
    assertTrue(last.visible); assertGreaterThan(f32((last.x - start) * facing), 250.0);
    frame(world); assertTrue(!projectedProjectile(owner, 0, true).visible);
  }
});

test("Kaelthas Flame Strike stops at a shield, misses after its life and keeps travelling when the caster is interrupted [spec docs/design/kaelthas.md]", () => {
  for (const facing of [-1, 1]) {
    const blocked = pair(180.0, facing);
    const defense = controls({ shield: true, shieldStrength: 1.0 });
    frame(blocked.world, controls({ specialPressed: true }), defense);
    for (let tick = 2; tick <= 19; tick++) frame(blocked.world, controls(), defense);
    assertTrue(!projectedProjectile(blocked.owner, 0, true).visible);
    for (let tick = 20; tick <= 60; tick++) frame(blocked.world, controls(), defense);
    assertEquals(blocked.target.status.damage, 0.0); assertEquals(blocked.owner.mana.points, 40);

    const late = pair(1000.0, facing);
    frame(late.world, controls({ specialPressed: true }));
    for (let tick = 2; tick <= 45; tick++) frame(late.world);
    late.target.motion.x = f32(400.0 * facing);
    late.target.motion.z = 0.0; late.target.motion.vz = 0.0; late.target.motion.grounded = true; late.target.motion.surface = 0;
    for (let tick = 46; tick <= 60; tick++) frame(late.world);
    assertEquals(late.target.status.damage, 0.0);

    const interrupted = pair(180.0, facing);
    frame(interrupted.world, controls({ specialPressed: true }));
    for (let tick = 2; tick <= 13; tick++) frame(interrupted.world);
    assertTrue(projectedProjectile(interrupted.owner, 0, true).visible);
    cancelSpecialState(interrupted.owner);
    for (let tick = 14; tick <= 60; tick++) frame(interrupted.world);
    assertEquals(interrupted.target.status.damage, 12.0); assertEquals(interrupted.owner.mana.points, 52);

    const early = pair(180.0, facing);
    frame(early.world, controls({ specialPressed: true }));
    for (let tick = 2; tick <= 11; tick++) frame(early.world);
    cancelSpecialState(early.owner);
    for (let tick = 12; tick <= 60; tick++) frame(early.world);
    assertEquals(early.target.status.damage, 0.0); assertTrue(!projectedProjectile(early.owner, 0, true).visible);
  }
});

test("Kaelthas Siphon transfers available mana only on body contact and shields stop it [spec #335]", () => {
  for (const facing of [-1, 1]) for (const blocked of [false, true]) {
    const { owner, target, world } = pair(115.0, facing); target.mana.points = 12;
    const defense = controls({ shield: blocked, shieldStrength: 1.0 });
    frame(world, controls({ specialPressed: true, specialX: facing }), defense);
    for (let tick = 2; tick <= 44; tick++) frame(world, controls(), defense);
    assertEquals(target.status.damage, blocked ? 0.0 : 4.0); assertEquals(owner.mana.points, blocked ? 40 : 56);
    assertEquals(target.mana.points, blocked ? 12 : 2);
  }
});

test("Kaelthas Banish protects only its authored window then strikes once [spec docs/design/kaelthas.md]", () => {
  const { owner, target, world } = pair(45.0); frame(world, controls({ specialPressed: true, specialZ: -1 }));
  assertEquals(owner.special.action, SpecialAction.heroDown); assertEquals(owner.mana.points, 40);
  for (let tick = 2; tick <= 12; tick++) { frame(world); if (tick >= 5) assertTrue(isIntangible(owner)); }
  for (let tick = 13; tick <= 50; tick++) frame(world); assertEquals(target.status.damage, 5.0); assertTrue(!isIntangible(owner));
});

test("Kaelthas Phoenix Flight at every meter level consumes the jump and finish helpless with snapshot state [spec docs/design/kaelthas.md] [invariant]", () => {
  for (const mana of [40, 0]) {
    const { owner, world } = pair(1000.0); owner.mana.points = mana; owner.motion.grounded = false; owner.motion.surface = undefined; owner.motion.z = 250.0;
    frame(world, controls({ specialPressed: true, specialZ: 1 })); assertEquals(owner.special.action, SpecialAction.heroUp);
    for (let tick = 2; tick <= 20; tick++) frame(world);
    const restored = createFighter(Character.kaelthas, 0.0, 1); copyFighterState(restored, owner, 3); assertEquals(firstFighterDifference(owner, restored, 3, 3), undefined);
    for (let tick = 21; tick <= 40; tick++) frame(world);
    assertEquals(owner.mana.points, mana); assertTrue(owner.motion.z > 300.0); assertTrue(owner.special.fall);
    assertEquals(owner.jump.remaining, 0);
  }
});

test("Kaelthas intentionally adapts Ultimate Mewtwo with the roster air-speed cap [reference] [spec docs/design/kaelthas.md]", () => {
  const fighter = createFighter(Character.kaelthas, 0.0, 1);
  assertNear(fighter.tuning.physics.weight, 79.0, f32(0.0001)); assertNear(fighter.tuning.physics.runSpeed, f32(13.53), f32(0.0001));
  assertNear(fighter.tuning.physics.airSpeed, 7.5, f32(0.0001));
});
