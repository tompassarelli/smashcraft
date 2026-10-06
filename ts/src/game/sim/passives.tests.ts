// Hero passives (#148, smashcraft:docs/design/passives.md): each fighter's
// passive procs on its stated count, its stated counter denies it, its
// window clears it, and snapshots and the checksum carry its state.
import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { copyFighterState } from "../replay/fighterState";
import { AttackStyle, Character, ContactKind, HeroStatusKind, HitOrigin } from "./codes";
import { beginDamageContacts, collectDamageContact, finishDamageContacts } from "./contacts";
import { type Fighter, createFighter } from "./fighter";
import type { HitEffect } from "./hitRegions";
import { LONG_RIFLE_LIFE, advancePassive, passivePips } from "./passives";
import { spawnBlasterShot } from "./projectiles";
import { type Roster, createRoster, fighterAt } from "./roster";
import { respawnFighter } from "./stocks";

const strike = (damage: number): HitEffect => ({ damage, growth: 60.0, base: 20.0, launchX: f32(0.8), launchZ: f32(0.6), electric: false });

function pair(attacker: Character, defender: Character = Character.archer): { world: Roster; source: Fighter; target: Fighter } {
  const source = createFighter(attacker, -100.0, 1);
  const target = createFighter(defender, 100.0, -1);
  return { world: createRoster(3, [source, target]), source, target };
}

let serial = 100;

/** One contact from slot `from` to slot `to`, resolved alone; melee contacts come from a fresh attack. */
function hit(world: Roster, from: number, to: number, effect: HitEffect, origin: HitOrigin, shield = false, kind: ContactKind = ContactKind.launch): void {
  const source = fighterAt(world, from);
  if (origin === HitOrigin.melee) {
    source.attack.style ??= AttackStyle.forwardTilt;
    source.attack.serial = ++serial;
  }
  beginDamageContacts();
  collectDamageContact(world, from, to, effect, from === 0 ? 1 : -1, kind, origin === HitOrigin.melee, undefined, shield, undefined, origin);
  finishDamageContacts(world);
}

/** Lands `count` contacts, clearing the target's reaction between them. */
function land(world: Roster, count: number, effect: HitEffect, origin: HitOrigin, from = 0, to = 1): void {
  for (let index = 0; index < count; index++) hit(world, from, to, effect, origin);
}

test("Blademaster: the fourth landed sword hit is a Critical Strike, x1.5 and at most +6", () => {
  const { world, source, target } = pair(Character.blademaster);
  land(world, 3, strike(8.0), HitOrigin.melee);
  assertEquals(source.passive.stacks, 3);
  assertTrue(passivePips(source).ready);
  const before = target.status.damage;
  hit(world, 0, 1, strike(8.0), HitOrigin.melee);
  assertEquals(target.status.damage - before, 12.0);
  assertEquals(source.passive.stacks, 0);
  assertEquals(source.passive.serial, 1);
  land(world, 3, strike(8.0), HitOrigin.melee);
  const capped = target.status.damage;
  hit(world, 0, 1, strike(16.0), HitOrigin.melee);
  assertEquals(target.status.damage - capped, 22.0);
});

test("Blademaster: a shield spends the ready crit for nothing, Wind Cutter gives no pip and the window clears pips", () => {
  const { world, source, target } = pair(Character.blademaster);
  land(world, 3, strike(8.0), HitOrigin.melee);
  hit(world, 0, 1, strike(8.0), HitOrigin.melee, true);
  assertEquals(source.passive.stacks, 0);
  assertEquals(target.status.damage, 24.0);
  hit(world, 0, 1, strike(6.0), HitOrigin.projectile);
  assertEquals(source.passive.stacks, 0);
  hit(world, 0, 1, strike(8.0), HitOrigin.melee);
  for (let frame = 0; frame < 179; frame++) advancePassive(source);
  assertEquals(source.passive.stacks, 1);
  advancePassive(source);
  assertEquals(source.passive.stacks, 0);
});

test("a multi-hit move counts once per target per attack", () => {
  const { world, source } = pair(Character.blademaster);
  source.attack.style = AttackStyle.jab;
  source.attack.serial = 7;
  for (let index = 0; index < 3; index++) {
    beginDamageContacts();
    collectDamageContact(world, 0, 1, strike(3.0), 1, ContactKind.launch, true, undefined, false, undefined, HitOrigin.melee);
    finishDamageContacts(world);
  }
  assertEquals(source.passive.stacks, 1);
});

test("Mountain King: the third landed hit Bashes for 10 more hitstun frames; a shield spends it", () => {
  const plain = pair(Character.blademaster);
  hit(plain.world, 0, 1, strike(10.0), HitOrigin.melee);
  const baseline = plain.target.launch.hitstun;
  const { world, source, target } = pair(Character.mountainKing);
  land(world, 2, strike(10.0), HitOrigin.melee);
  target.status.damage = 0.0;
  hit(world, 0, 1, strike(10.0), HitOrigin.melee);
  assertEquals(target.launch.hitstun, baseline + 10);
  land(world, 2, strike(10.0), HitOrigin.projectile);
  assertEquals(source.passive.stacks, 2);
  hit(world, 0, 1, strike(10.0), HitOrigin.melee, true);
  assertEquals(source.passive.stacks, 0);
});

test("Warden: a landed aerial in the air returns one aerial jump, once per airtime, renewed on landing", () => {
  const { world, source } = pair(Character.warden);
  source.motion.grounded = false;
  source.jump.remaining = 0;
  source.attack.style = AttackStyle.forwardAir;
  hit(world, 0, 1, strike(8.0), HitOrigin.melee, true);
  assertEquals(source.jump.remaining, 0);
  hit(world, 0, 1, strike(8.0), HitOrigin.melee);
  assertEquals(source.jump.remaining, 1);
  assertFalse(passivePips(source).ready);
  source.jump.remaining = 0;
  hit(world, 0, 1, strike(8.0), HitOrigin.melee);
  assertEquals(source.jump.remaining, 0);
  source.motion.grounded = true;
  advancePassive(source);
  assertTrue(passivePips(source).ready);
});

test("Archer: the third landed arrow deals double damage, still without hitstun; a shield spends it", () => {
  const { world, source, target } = pair(Character.archer, Character.blademaster);
  land(world, 2, strike(6.0), HitOrigin.arrow);
  assertEquals(source.passive.stacks, 2);
  const before = target.status.damage;
  hit(world, 0, 1, strike(6.0), HitOrigin.arrow, false, ContactKind.damageOnly);
  assertEquals(target.status.damage - before, 12.0);
  land(world, 2, strike(6.0), HitOrigin.arrow);
  hit(world, 0, 1, strike(6.0), HitOrigin.arrow, true);
  assertEquals(source.passive.stacks, 0);
  land(world, 3, strike(6.0), HitOrigin.melee);
  assertEquals(source.passive.stacks, 0);
});

test("Rifleman: every fourth blaster shot fired is a Long Rifle shot that flies farther", () => {
  const rifleman = createFighter(Character.rifleman, 0.0, 1);
  const shots: boolean[] = [];
  for (let index = 0; index < 8; index++) {
    for (const projectile of rifleman.projectiles) projectile.life = 0;
    spawnBlasterShot(rifleman, index + 1, true);
    const fired = rifleman.projectiles.find((projectile) => projectile.life > 0);
    shots.push(fired?.longRifle === true);
    if (fired?.longRifle === true) assertEquals(fired.life, LONG_RIFLE_LIFE);
  }
  assertEquals(shots.join(","), "false,false,false,true,false,false,false,true");
});

test("Illidan has no passive: his hits count for nothing", () => {
  const { world, source } = pair(Character.demonHunter);
  land(world, 5, strike(8.0), HitOrigin.melee);
  assertEquals(source.passive.stacks, 0);
  assertEquals(passivePips(source).of, 0);
});

test("Lich: the third melee hit to reach him chills its striker; projectiles and throws add nothing", () => {
  const { world, source: lich, target: striker } = pair(Character.lich, Character.blademaster);
  land(world, 3, strike(6.0), HitOrigin.projectile, 1, 0);
  hit(world, 1, 0, strike(6.0), HitOrigin.throw, false, ContactKind.throw);
  assertEquals(lich.passive.stacks, 0);
  land(world, 2, strike(6.0), HitOrigin.melee, 1, 0);
  assertEquals(lich.passive.stacks, 2);
  assertEquals(striker.status.condition, HeroStatusKind.none);
  hit(world, 1, 0, strike(6.0), HitOrigin.melee);
  assertEquals(striker.status.condition, HeroStatusKind.chill);
  assertEquals(lich.passive.stacks, 0);
});

test("Uther: three blocked hits ready Devotion, the next launch is 0.8 as strong and throws ignore it", () => {
  const plain = pair(Character.blademaster, Character.uther);
  plain.target.status.damage = 60.0;
  hit(plain.world, 0, 1, strike(12.0), HitOrigin.melee);
  const baseline = plain.target.launch.hitstun;
  const { world, target: uther } = pair(Character.blademaster, Character.uther);
  for (let index = 0; index < 3; index++) hit(world, 0, 1, strike(2.0), HitOrigin.melee, true);
  assertTrue(passivePips(uther).ready);
  hit(world, 0, 1, strike(4.0), HitOrigin.throw, false, ContactKind.throw);
  assertTrue(passivePips(uther).ready);
  uther.status.damage = 60.0;
  hit(world, 0, 1, strike(12.0), HitOrigin.melee);
  assertTrue(uther.launch.hitstun < baseline);
  assertEquals(uther.passive.stacks, 0);
});

test("Dreadlord: every third landed melee hit or throw heals him 2%, at most 8% a stock; projectiles give nothing", () => {
  const { world, source: dreadlord } = pair(Character.dreadlord);
  dreadlord.status.damage = 30.0;
  land(world, 3, strike(6.0), HitOrigin.projectile);
  assertEquals(dreadlord.passive.stacks, 0);
  land(world, 2, strike(6.0), HitOrigin.melee);
  hit(world, 0, 1, strike(6.0), HitOrigin.throw, false, ContactKind.throw);
  assertEquals(dreadlord.status.damage, 28.0);
  land(world, 12, strike(6.0), HitOrigin.melee);
  assertEquals(dreadlord.status.damage, 22.0);
  assertEquals(dreadlord.passive.spent, 8.0);
  respawnFighter(world, 0, 0.0);
  assertEquals(dreadlord.passive.spent, 0.0);
});

test("Shadow Hunter: glaive and ward hits charge voodoo, his next landed melee hit spends it for +2% a pip", () => {
  const { world, source, target } = pair(Character.shadowHunter);
  land(world, 3, strike(5.0), HitOrigin.voodoo);
  assertEquals(source.passive.stacks, 2);
  const before = target.status.damage;
  hit(world, 0, 1, strike(9.0), HitOrigin.melee);
  assertEquals(target.status.damage - before, 13.0);
  land(world, 1, strike(5.0), HitOrigin.voodoo);
  hit(world, 0, 1, strike(9.0), HitOrigin.melee, true);
  assertEquals(source.passive.stacks, 0);
});

test("passive state rides snapshots and clears on a new stock", () => {
  const { world, source } = pair(Character.blademaster);
  land(world, 2, strike(8.0), HitOrigin.melee);
  const copy = createFighter(Character.blademaster, 0.0, 1);
  copyFighterState(copy, source, 3);
  assertEquals(copy.passive.stacks, 2);
  assertEquals(copy.passive.window, source.passive.window);
  assertEquals(copy.passive.lastKey, source.passive.lastKey);
  respawnFighter(world, 0, 0.0);
  assertEquals(source.passive.stacks, 0);
  assertEquals(source.passive.window, 0);
});

test("Pit Lord: the third cleaver contact, hit or blocked, cleaves: +3% on a body, double shield damage on a shield", () => {
  const { world, source, target } = pair(Character.pitLord, Character.blademaster);
  hit(world, 0, 1, strike(10.0), HitOrigin.melee, true);
  hit(world, 0, 1, strike(10.0), HitOrigin.melee);
  assertEquals(source.passive.stacks, 2);
  const before = target.status.damage;
  hit(world, 0, 1, strike(10.0), HitOrigin.melee);
  assertEquals(target.status.damage - before, 13.0);
  const plain = pair(Character.pitLord, Character.blademaster);
  const full = plain.target.shield.energy;
  hit(plain.world, 0, 1, strike(10.0), HitOrigin.melee, true);
  const oneBlock = full - plain.target.shield.energy;
  land(world, 2, strike(10.0), HitOrigin.projectile);
  assertEquals(source.passive.stacks, 0);
  land(world, 2, strike(10.0), HitOrigin.melee);
  const shield = target.shield.energy;
  hit(world, 0, 1, strike(10.0), HitOrigin.melee, true);
  assertTrue(shield - target.shield.energy > oneBlock);
  assertEquals(source.passive.stacks, 0);
});

test("Beastmaster: his hit and his bear's bite on one target within 40 frames make a pair; the second gets +3%", () => {
  const { world, source, target } = pair(Character.beastmaster);
  hit(world, 0, 1, strike(8.0), HitOrigin.melee);
  assertTrue(passivePips(source).ready);
  const before = target.status.damage;
  hit(world, 0, 1, strike(8.0), HitOrigin.summon);
  assertEquals(target.status.damage - before, 11.0);
  assertFalse(passivePips(source).ready);
  hit(world, 0, 1, strike(8.0), HitOrigin.summon);
  for (let frame = 0; frame < 40; frame++) advancePassive(source);
  const late = target.status.damage;
  hit(world, 0, 1, strike(8.0), HitOrigin.melee);
  assertEquals(target.status.damage - late, 8.0);
  const shielded = target.status.damage;
  hit(world, 0, 1, strike(8.0), HitOrigin.summon, true);
  hit(world, 0, 1, strike(8.0), HitOrigin.melee);
  assertEquals(target.status.damage - shielded, 8.0);
});
