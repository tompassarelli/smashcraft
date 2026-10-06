// Dreadlord's specials through the production special, projectile, grab and
// contact steps: costs, Carrion Swarm, Sleep Orb, Night Pounce's command grab
// and Bat Ascension's steerable rise with its free form.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, HeroStatusKind, ProjectileKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { advanceGrabs, captureGrabPauses, resolveGrabs } from "../grabs";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus, regenerateMana } from "../heroSpecialRules";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";

const H = HERO_REFERENCE_HEIGHT;

/** One match-ordered frame: motion, grabs, special starts, contacts, specials, projectiles, resources. */
function frame(world: Roster, first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()): void {
  const inputs = [first, second];
  for (let slot = 0; slot < 2; slot++) advanceFighter(world, slot, 0, inputs[slot] ?? controls(), slot === 0 ? -240.0 : 240.0);
  captureGrabPauses(world);
  resolveGrabs(world);
  beginDamageContacts();
  advanceGrabs(world, inputs);
  for (let slot = 0; slot < 2; slot++) startFighterSpecial(world.fighters[slot]!, 0, 0, inputs[slot] ?? controls());
  resolveAttacks(world);
  advanceSpecials(world, 0, 0);
  updateProjectiles(world);
  for (let slot = 0; slot < 2; slot++) {
    regenerateMana(world.fighters[slot]!);
    advanceHeroStatus(world.fighters[slot]!);
  }
  finishDamageContacts(world);
  resolveGrabs(world);
}

function pair(gap: number, target = Character.archer): { world: Roster; owner: Fighter; victim: Fighter } {
  const owner = createFighter(Character.dreadlord, -gap * 0.5, 1);
  const victim = createFighter(target, gap * 0.5, -1);
  const world = createRoster(3, [owner, victim]);
  for (let i = 0; i < 3; i++) frame(world);
  return { world, owner, victim };
}

const neutral = controls({ specialPressed: true });
const side = controls({ specialPressed: true, specialX: 1, direction: 1 });
const up = controls({ specialPressed: true, specialZ: 1, verticalDirection: 1 });
const down = controls({ specialPressed: true, specialZ: -1 });
const shield = controls({ shield: true, shieldStrength: 1.0 });

/** Plays frames 2..last of a special the press on frame 1 started. */
function play(world: Roster, last: number, first = controls(), second = controls()): void {
  for (let f = 2; f <= last; f++) frame(world, first, second);
}

test("Dreadlord's specials spend their listed mana once on entry", () => {
  for (const [input, cost] of [[neutral, 5], [side, 20], [up, 15], [down, 25]] as const) {
    const { world, owner } = pair(1000.0);
    frame(world, input);
    assertTrue(owner.special.action !== SpecialAction.none);
    assertEquals(owner.mana.points, 100 - cost);
    play(world, 10);
    assertEquals(owner.mana.points, 100 - cost);
  }
});

test("Carrion Swarm releases one reflectable cloud on frame 20 and hits once for 7", () => {
  const { world, owner, victim } = pair(260.0);
  frame(world, neutral);
  play(world, 19);
  assertEquals(owner.projectiles.filter(p => p.life > 0).length, 0);
  frame(world);
  const cloud = owner.projectiles.find(p => p.life > 0 && p.kind === ProjectileKind.hero);
  assertTrue(cloud?.spec?.reflectable === true);
  for (let f = 0; f < 40; f++) frame(world);
  assertEquals(victim.status.damage, 7.0);
  assertEquals(owner.special.action, SpecialAction.none);
});

test("Sleep Orb sleeps a body it reaches for 20 frames, not one behind a shield", () => {
  const slept = pair(200.0);
  frame(slept.world, down);
  let asleep = false;
  for (let f = 2; f <= 70 && !asleep; f++) {
    frame(slept.world);
    asleep = slept.victim.status.condition === HeroStatusKind.sleep;
  }
  assertTrue(asleep);
  assertEquals(slept.victim.status.damage, 2.0);
  for (let f = 0; f < 20; f++) frame(slept.world);
  assertEquals(slept.victim.status.condition, HeroStatusKind.none);
  assertEquals(slept.victim.status.conditionImmunity[0], 180);
  const guarded = pair(200.0);
  frame(guarded.world, down, shield);
  for (let f = 2; f <= 70; f++) frame(guarded.world, controls(), shield);
  assertEquals(guarded.victim.status.condition, HeroStatusKind.none);
  assertEquals(guarded.victim.status.damage, 0.0);
});

test("Night Pounce grabs through a shield, bites 16 frames after the catch and recovers 28 frames", () => {
  const { world, owner, victim } = pair(H, Character.archer);
  frame(world, side, shield);
  let caught = 0;
  for (let f = 2; f <= 19 && caught === 0; f++) {
    frame(world, controls(), shield);
    caught = owner.special.grabFrame;
  }
  assertTrue(caught >= 17 && caught <= 19);
  assertEquals(owner.grab.target, 1);
  assertEquals(victim.grab.owner, 0);
  for (let f = caught + 1; f < caught + 16; f++) frame(world);
  assertEquals(victim.status.damage, 0.0);
  frame(world);
  assertEquals(victim.status.damage, 9.0);
  assertEquals(owner.grab.target, undefined);
  assertTrue(victim.launch.throwHitstun);
  assertGreaterThan(victim.launch.knockbackX, 0.0);
  // The bite's hitlag pauses the timeline; the action's last frame is catch + 16 + 28.
  let lastFrame = 0;
  for (let f = 0; f < 120 && owner.special.action === SpecialAction.heroSide; f++) {
    lastFrame = owner.special.frame;
    frame(world);
  }
  assertEquals(owner.special.action, SpecialAction.none);
  assertEquals(lastFrame + 1, caught + 16 + 28);
});

test("a whiffed Night Pounce ends on frame 53 and cannot catch a fighter still in throw hitstun", () => {
  const whiff = pair(1000.0);
  frame(whiff.world, side);
  play(whiff.world, 52);
  assertEquals(whiff.owner.special.action, SpecialAction.heroSide);
  frame(whiff.world);
  assertEquals(whiff.owner.special.action, SpecialAction.none);
  assertEquals(whiff.owner.special.grabFrame, 0);
  const regrab = pair(H);
  regrab.victim.launch.throwHitstun = true;
  regrab.victim.launch.hitstun = 200;
  regrab.victim.motion.grounded = true;
  frame(regrab.world, side);
  play(regrab.world, 20);
  assertEquals(regrab.owner.special.grabFrame, 0);
  assertEquals(regrab.victim.grab.owner, undefined);
});

test("air Night Pounce claws for 9 once per airtime and ends helpless", () => {
  const { world, owner, victim } = pair(110.0);
  for (const f of [owner, victim]) {
    f.motion.grounded = false;
    f.motion.surface = undefined;
    f.motion.z = 1500.0;
  }
  frame(world, side);
  assertEquals(owner.special.form, 1);
  for (let f = 0; f < 120 && owner.special.action !== SpecialAction.none; f++) frame(world);
  assertEquals(victim.status.damage, 9.0);
  assertTrue(owner.special.fall);
  frame(world, side);
  assertEquals(owner.special.action, SpecialAction.none);
});

/** Height and drift of a Bat Ascension from the ground with the stick held to one side or neutral. */
function ascend(points: number, stickSide: number): { rise: number; across: number; owner: Fighter } {
  const { world, owner } = pair(600.0);
  owner.mana.points = points;
  const startX = owner.motion.x;
  const startZ = owner.motion.z;
  // Steering starts with the rise on frame 9; each motion frame's velocity moves the next frame.
  const held = controls({ direction: stickSide });
  frame(world, up);
  let top = startZ;
  for (let f = 2; f <= 33; f++) {
    frame(world, f >= 9 ? held : controls());
    top = Math.max(top, owner.motion.z);
  }
  return { rise: top - startZ, across: owner.motion.x - startX, owner };
}

test("Bat Ascension rises 2.0H and steers up to 0.8H; below 15 mana the free form rises 1.4H and steers 0.3H", () => {
  const full = ascend(100, 1);
  assertLessThan(Math.abs(full.rise - 2.0 * H), 0.12 * H);
  assertLessThan(Math.abs(full.across - 0.8 * H), 0.1 * H);
  assertTrue(full.owner.special.fall);
  assertEquals(full.owner.mana.points, 85);
  const straight = ascend(100, 0);
  assertLessThan(Math.abs(straight.across), 1.0);
  const back = ascend(100, -1);
  assertLessThan(back.across, -0.7 * H);
  const free = ascend(10, 1);
  assertEquals(free.owner.mana.points, 10);
  assertLessThan(Math.abs(free.rise - 1.4 * H), 0.12 * H);
  assertLessThan(Math.abs(free.across - 0.3 * H), 0.1 * H);
  assertFalse(free.owner.status.invincible > 0);
});

test("replaying Night Pounce from a restored snapshot reproduces both fighters", () => {
  const { world, owner, victim } = pair(H);
  const savedOwner = createFighter(Character.dreadlord, 0.0, 1);
  const savedVictim = createFighter(Character.archer, 0.0, 1);
  copyFighterState(savedOwner, owner, 3);
  copyFighterState(savedVictim, victim, 3);
  const run = () => {
    frame(world, side);
    play(world, 70);
  };
  run();
  const endOwner = createFighter(Character.dreadlord, 0.0, 1);
  const endVictim = createFighter(Character.archer, 0.0, 1);
  copyFighterState(endOwner, owner, 3);
  copyFighterState(endVictim, victim, 3);
  assertEquals(victim.status.damage, 9.0);
  copyFighterState(owner, savedOwner, 3);
  copyFighterState(victim, savedVictim, 3);
  run();
  assertEquals(firstFighterDifference(endOwner, owner, 3, 3), undefined);
  assertEquals(firstFighterDifference(endVictim, victim, 3, 3), undefined);
});

test("Night Pounce loses to a jab thrown into its approach and whiffs on a retreat", () => {
  const read = pair(f32(1.2 * H));
  frame(read.world, side);
  for (let f = 2; f <= 16; f++) {
    if (f === 11) beginFighterAttack(read.world, 1, AttackStyle.jab, false);
    frame(read.world);
  }
  assertGreaterThan(read.owner.status.damage, 0.0);
  assertEquals(read.owner.special.grabFrame, 0);
  assertEquals(read.victim.grab.owner, undefined);
  const retreat = pair(1.5 * H);
  const away = controls({ direction: 1 });
  frame(retreat.world, side, away);
  for (let f = 2; f <= 20; f++) frame(retreat.world, controls(), away);
  assertEquals(retreat.owner.special.grabFrame, 0);
  assertEquals(retreat.victim.grab.owner, undefined);
});
