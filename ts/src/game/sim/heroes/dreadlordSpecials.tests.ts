// Dreadlord's specials through the production special, projectile, grab and
// contact steps: costs, Carrion Swarm, Sleep (#132), Vampiric Pounce's command
// grab, feint and bite heal,
// and Bat Ascension's steerable rise with its free form.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, HeroStatusKind, ProjectileKind, SpecialAction } from "../codes";
import { beginDamageContacts, finishDamageContacts } from "../contacts";
import { type Fighter, createFighter } from "../fighter";
import { advanceGrabs, captureGrabPauses, resolveGrabs } from "../grabs";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
import { advanceHeroStatus } from "../heroSpecialRules";
import { regenerateMana } from "../mana";
import { maskHeroStatusControls } from "../heroStatus";
import { attackBuffer } from "../../input/attackBuffer";
import { updateProjectiles } from "../projectiles";
import { type Controls, type Roster, createRoster } from "../roster";
import { advanceSpecials, startFighterSpecial } from "../specials";
import { advanceFighter } from "../step";
import { controls } from "../testWorld";
import { copyFighterState } from "../../replay/fighterState";
import { firstFighterDifference } from "../../replay/difference";
import { VAMPIRIC_HEAL_CAP } from "../passives";

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
  advanceSpecials(world, 0, 0, inputs);
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

/** Sleeps the victim with an orb from 200 away; returns once it is asleep, and the frame count it took. */
function slept(airborne = false): { world: Roster; owner: Fighter; victim: Fighter } {
  const p = pair(200.0);
  frame(p.world, down);
  let asleep = false;
  for (let f = 2; f <= 70 && !asleep; f++) {
    if (airborne) {
      p.victim.motion.grounded = false;
      p.victim.motion.surface = undefined;
      p.victim.motion.z = 10.0;
      p.victim.motion.vz = 0.0;
    }
    frame(p.world);
    asleep = p.victim.status.condition === HeroStatusKind.sleep;
  }
  assertTrue(asleep);
  return p;
}

/** Frames until the victim wakes, with the masking and mashing a match applies to its input `mash(frame)`. */
function framesAsleep(world: Roster, victim: Fighter, mash: (frame: number) => Readonly<Controls>): number {
  const commands = attackBuffer(0);
  for (let f = 1; f <= 200; f++) {
    const input = { ...mash(f) };
    maskHeroStatusControls(victim, input, commands);
    frame(world, controls(), input);
    if (victim.status.condition !== HeroStatusKind.sleep) return f;
  }
  return 200;
}

test("Sleep sleeps a grounded body 70 frames and an airborne one 24, then 240 frames of immunity; a shield stops it", () => {
  const grounded = slept();
  assertEquals(grounded.victim.status.damage, 2.0);
  assertEquals(grounded.victim.status.conditionFrames, 70);
  const held = framesAsleep(grounded.world, grounded.victim, () => controls());
  assertEquals(held, 70);
  assertEquals(grounded.victim.status.conditionImmunity[0], 240);
  const air = slept(true);
  assertEquals(air.victim.status.conditionFrames, 24);
  const guarded = pair(200.0);
  frame(guarded.world, down, shield);
  for (let f = 2; f <= 80; f++) frame(guarded.world, controls(), shield);
  assertEquals(guarded.victim.status.condition, HeroStatusKind.none);
  assertEquals(guarded.victim.status.damage, 0.0);
});

test("the sleeper mashes out sooner, never before its frame 24, and a damaging hit wakes it at once", () => {
  const mashing = slept();
  // A fresh grab-mash press every other frame and the stick flipping.
  const woke = framesAsleep(mashing.world, mashing.victim, (f) => controls({ grabMashPressed: floorMod(f, 2) === 0, direction: floorMod(f, 4) < 2 ? 1 : -1 }));
  assertLessThan(woke, 40);
  assertGreaterThan(woke, 21);
  const hit = slept();
  hit.victim.motion.x = f32(hit.owner.motion.x + 60.0);
  hit.victim.facing = -1;
  hit.owner.facing = 1;
  for (let f = 0; f < 40; f++) frame(hit.world);
  beginFighterAttack(hit.world, 0, AttackStyle.jab, false);
  for (let f = 0; f < 8; f++) frame(hit.world);
  assertGreaterThan(hit.victim.status.damage, 2.0);
  assertEquals(hit.victim.status.condition, HeroStatusKind.none);
  // Immune for 240 frames: a second orb does not sleep it again.
  hit.owner.mana.points = 100;
  frame(hit.world, down);
  for (let f = 2; f <= 60; f++) frame(hit.world);
  assertEquals(hit.victim.status.condition, HeroStatusKind.none);
});

test("Vampiric Pounce grabs through a shield, bites 16 frames after the catch and recovers 28 frames", () => {
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

test("a whiffed Vampiric Pounce ends on frame 53 and cannot catch a fighter still in throw hitstun", () => {
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

test("air Vampiric Pounce claws for 9 once per airtime and ends helpless", () => {
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
  assertLessThan(Math.abs(full.rise - f32(2.0) * H), f32(0.12) * H);
  assertLessThan(Math.abs(full.across - f32(0.8) * H), f32(0.1) * H);
  assertTrue(full.owner.special.fall);
  assertEquals(full.owner.mana.points, 85);
  const straight = ascend(100, 0);
  assertLessThan(Math.abs(straight.across), 1.0);
  const back = ascend(100, -1);
  assertLessThan(back.across, -f32(0.7) * H);
  const free = ascend(10, 1);
  assertEquals(free.owner.mana.points, 10);
  assertLessThan(Math.abs(free.rise - f32(1.4) * H), f32(0.12) * H);
  assertLessThan(Math.abs(free.across - f32(0.3) * H), f32(0.1) * H);
  assertFalse(free.owner.status.invincible > 0);
});

test("replaying Vampiric Pounce from a restored snapshot reproduces both fighters", () => {
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

test("Vampiric Pounce loses to a jab thrown into its approach and whiffs on a retreat", () => {
  const read = pair(f32(f32(1.2) * H));
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

test("side special again on approach frames 3-12 feints into a 0.7H backward hop with no grab, free, ending on frame 18", () => {
  const { world, owner, victim } = pair(f32(f32(1.2) * H));
  frame(world, side);
  assertEquals(owner.mana.points, 80);
  for (let f = 2; f <= 5; f++) frame(world);
  const x = owner.motion.x;
  frame(world, side);
  assertEquals(owner.special.action, SpecialAction.heroSide);
  assertEquals(owner.mana.points, 80);
  for (let f = 2; f <= 11; f++) frame(world);
  assertLessThan(owner.motion.x, f32(x - f32(f32(0.6) * H)));
  for (let f = 12; f <= 18; f++) frame(world);
  assertEquals(owner.special.action, SpecialAction.none);
  assertEquals(owner.special.grabFrame, 0);
  assertEquals(victim.grab.owner, undefined);
  // Pressed on frame 13, too late: the pounce runs on.
  const late = pair(f32(f32(1.2) * H));
  frame(late.world, side);
  for (let f = 2; f <= 12; f++) frame(late.world);
  frame(late.world, side);
  for (let f = 14; f <= 19; f++) frame(late.world);
  assertGreaterThan(late.owner.special.grabFrame, 0);
});

test("Vampiric Pounce's bite heals Dreadlord 4 percent, at most 12 a stock", () => {
  const { world, owner, victim } = pair(H, Character.archer);
  owner.status.damage = 30.0;
  // Vampiric Aura (sim/passives.ts) also heals on every third bite; spend its budget so only the bite heals here.
  owner.passive.spent = VAMPIRIC_HEAL_CAP;
  for (let pounce = 0; pounce < 4; pounce++) {
    owner.mana.points = 100;
    victim.motion.x = f32(owner.motion.x + H);
    victim.launch.throwHitstun = false;
    victim.launch.hitstun = 0;
    frame(world, side);
    for (let f = 0; f < 120 && owner.special.action === SpecialAction.heroSide; f++) frame(world);
    for (let f = 0; f < 60; f++) frame(world);
    assertEquals(owner.status.damage, f32(30.0 - Math.min(12.0, 4.0 * (pounce + 1))));
  }
  assertEquals(owner.status.guardHealed, 12.0);
});
