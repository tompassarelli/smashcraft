


import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { queueAttack } from "../input/attackBuffer";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { canAttack } from "./conditions";
import { FEL_LUNGE_BASE, FEL_LUNGE_CHARGE, SMASH_MAX_CHARGE_FRAMES, attackDurationFrames, attackDurationFramesForGrounding, attackStartupFrames } from "./moves";
import { authoredHitRegion, authoredHitRegionCount, emptyHitRegion } from "./hitRegions";
import { SELECTABLE_CHARACTERS } from "./heroes/registry";
import { authoredTuning } from "./tuning";
import { EYE_BLAST_MARKS, eyeBlastMark } from "../presentation/eyeBlastMarker";
import { EYE_BLAST_FORM, EYE_BLAST_LAST, EYE_BLAST_REACH, EYE_BLAST_WINDUP, FLAME_CRASH_FORM, FLAME_CRASH_FRAMES, FLAME_CRASH_HANG_LAST, FLAME_CRASH_LANDING_FORM, flameCrashRegion } from "./specials";
import { ROSTER_MANA } from "./mana";
import { type Duel, duel, lift } from "./testDuel";
import { controls } from "./testWorld";

const SHIELD = controls({ shield: true, shieldStrength: 1.0 });
const downB = controls({ specialPressed: true, specialZ: -1, verticalDirection: -1, down: true });
const damageAt = (style: AttackStyle, activeFrame: number): number =>
  authoredHitRegion(emptyHitRegion(), Character.demonHunter, style, attackStartupFrames(style) + activeFrame, 0, 0).effect.damage;
const PLUNGE = flameCrashRegion(FLAME_CRASH_FORM, FLAME_CRASH_HANG_LAST + 1);
const BURST = flameCrashRegion(FLAME_CRASH_LANDING_FORM, 1).effect;


function attack(d: Duel, style: AttackStyle, mayCharge = false, first = controls(), second = controls()): void {
  const frame = d.step(first, second);
  queueAttack(d.commands[0], { style, facing: d.illidan.facing < 0 ? -1 : 1, frame: frame + 1, mayCharge });
}


function finish(d: Duel, frames: number, first = controls(), second = controls()): void {
  d.step(first, second);
  for (let i = 0; i < frames && d.illidan.attack.style !== undefined; i++) d.step(first, second);
}

test("Shear: forward tilt deals 9 at a low angle, blocked by shield without draining meter [spec #148] [spec docs/design/illidan.md]", () => {
  const d = duel(110.0);
  d.target.mana.points = 60;
  attack(d, AttackStyle.forwardTilt);
  finish(d, 40);
  assertEquals(d.target.status.damage, damageAt(AttackStyle.forwardTilt, 0));
  assertEquals(d.target.visuals.manaDrained, 0);
  const blocked = duel(110.0);
  blocked.target.mana.points = 60;
  blocked.run(4, controls(), SHIELD);
  attack(blocked, AttackStyle.forwardTilt, false, controls(), SHIELD);
  finish(blocked, 40, controls(), SHIELD);
  assertEquals(blocked.target.status.damage, 0.0);
  assertEquals(blocked.target.mana.points, 60);
});

test("Flames of Azzinoth: the glaives strike both sides out to 190 for 14, and the fire wall burns once more [spec docs/design/illidan.md]", () => {
  for (const side of [-1, 1]) {
    const d = duel(170.0);
    d.target.mana.points = 50;
    d.target.motion.x = f32(side * 170.0);
    attack(d, AttackStyle.downSmash);
    finish(d, 60);
    assertEquals(d.target.status.damage, damageAt(AttackStyle.downSmash, 0));
    assertEquals(d.target.visuals.manaDrained, 0);
  }

  const late = duel(400.0);
  attack(late, AttackStyle.downSmash);
  for (let i = 0; i < 40 && late.illidan.attack.frame < 8 + 3; i++) late.step();
  late.target.motion.x = 150.0;
  finish(late, 60);
  assertEquals(late.target.status.damage, damageAt(AttackStyle.downSmash, 3));
});

test("Flames of Azzinoth counterplay: a shield holds both parts and acts with the smash still running; a jump clears the fire [spec docs/design/illidan.md]", () => {
  const d = duel(90.0);
  d.run(4, controls(), SHIELD);
  attack(d, AttackStyle.downSmash, false, controls(), SHIELD);
  for (let i = 0; i < 18; i++) d.step(controls(), SHIELD);
  assertEquals(d.target.status.damage, 0.0);

  d.step();
  for (let i = 0; i < 20 && !canAttack(d.target); i++) d.step();
  assertEquals(d.illidan.attack.style, AttackStyle.downSmash);
  assertGreaterThan(attackDurationFrames(AttackStyle.downSmash) - d.illidan.attack.frame, 10);

  const over = duel(400.0);
  attack(over, AttackStyle.downSmash);
  for (let i = 0; i < 40 && over.illidan.attack.frame < 8 + 3; i++) over.step();
  over.target.motion.x = 100.0;
  lift(over.target, 230.0);
  over.step();
  assertEquals(over.target.status.damage, 0.0);
});

const EYE_BLAST_PRESS = controls({ specialPressed: true, shield: true, shieldStrength: 1.0 });

test("Fel Lunge: forward smash travels 40, or 70 fully charged, and fires no beam at a target 420 away [spec #379]", () => {
  for (const charge of [0, SMASH_MAX_CHARGE_FRAMES]) {
    const d = duel(420.0);
    const held = controls({ attackHeld: true });
    attack(d, AttackStyle.forwardSmash, true, charge > 0 ? held : controls());
    const start = d.illidan.motion.x;
    d.run(charge + 6, charge > 0 ? held : controls());
    finish(d, 80);
    assertEquals(d.target.status.damage, 0.0);
    assertEquals(f32(d.illidan.motion.x - start), charge > 0 ? f32(FEL_LUNGE_BASE + FEL_LUNGE_CHARGE) : FEL_LUNGE_BASE);
  }
  const near = duel(150.0);
  attack(near, AttackStyle.forwardSmash);
  finish(near, 80);
  assertEquals(near.target.status.damage, 10.0);
});

test("Fel Lunge's full-charge reach stays inside the roster's forward smash band [spec #379]", () => {
  const out = emptyHitRegion();
  let illidan = 0.0;
  let widest = 0.0;
  for (const character of SELECTABLE_CHARACTERS) {
    const moves = authoredTuning(character).moves;
    let reach = 0.0;
    for (let frame = 0; frame < attackDurationFramesForGrounding(AttackStyle.forwardSmash, true, moves); frame++) {
      for (let index = 0; index < authoredHitRegionCount(AttackStyle.forwardSmash, moves); index++) {
        const region = authoredHitRegion(out, character, AttackStyle.forwardSmash, frame, 0, index, moves);
        if (region.effect.damage > 0.0) reach = Math.max(reach, region.strike === undefined ? region.maxX : Math.max(region.strike.x1, region.strike.x2) + region.strike.radius);
      }
    }
    reach += moves?.normals[AttackStyle.forwardSmash]?.startupTravelX ?? 0.0;
    if (character === Character.demonHunter) illidan = reach + FEL_LUNGE_BASE + FEL_LUNGE_CHARGE;
    else widest = Math.max(widest, reach);
  }
  assertGreaterThan(illidan, 0.0);
  assertTrue(illidan <= widest);
});

test("Eye Blast: a grounded EX neutral special spending one meter segment, with a 24-frame windup and ground marker before a beam reaching 645 [spec #379]", () => {
  const d = duel(420.0);
  d.illidan.mana.points = 100;
  d.target.mana.points = 50;
  d.step(EYE_BLAST_PRESS);
  assertEquals(d.illidan.special.action, SpecialAction.demonHunterManaBurn);
  assertEquals(d.illidan.special.form, EYE_BLAST_FORM);
  assertEquals(d.illidan.mana.points, 100 - ROSTER_MANA.exCost);
  assertGreaterThan(EYE_BLAST_WINDUP + 1, 20);
  while (d.illidan.special.frame < EYE_BLAST_WINDUP) {
    for (let mark = 0; mark < EYE_BLAST_MARKS; mark++) assertTrue(eyeBlastMark(d.illidan, mark) !== undefined);
    assertEquals(d.target.status.damage, 0.0);
    d.step();
  }
  assertEquals(d.target.status.damage, 0.0);
  d.run(EYE_BLAST_LAST - EYE_BLAST_WINDUP);
  assertEquals(d.target.status.damage, 13.0);
  assertEquals(EYE_BLAST_REACH, 645.0);

  const empty = duel(420.0);
  empty.illidan.mana.points = ROSTER_MANA.exCost - 1;
  empty.step(EYE_BLAST_PRESS);
  assertEquals(empty.illidan.special.form, 0);
  assertEquals(empty.illidan.mana.points, ROSTER_MANA.exCost - 1);
});

test("Eye Blast counterplay: the beam runs low along the floor, so a fighter above it is not hit [spec docs/design/illidan.md]", () => {
  const d = duel(420.0);
  d.illidan.mana.points = 100;
  d.step(EYE_BLAST_PRESS);
  lift(d.target, 140.0);
  for (let i = 0; i < EYE_BLAST_LAST + 2; i++) {
    d.target.motion.x = 420.0;
    d.target.motion.z = 140.0;
    d.target.motion.vz = 0.0;
    d.step();
  }
  assertEquals(d.target.status.damage, 0.0);
});


function forwardAir(percent: number, gap: number, sdi: boolean): number {
  const d = duel(gap);
  d.target.status.damage = percent;
  lift(d.illidan, 650.0);
  lift(d.target, 650.0);

  attack(d, AttackStyle.forwardTilt);
  const away = controls({ sdiPulse: true, sdiX: 1 });
  for (let i = 0; i < 30; i++) {
    const before = d.target.status.damage;

    d.step(controls(), sdi && d.target.launch.hitlag > 0 ? away : controls());
    if (sdi && d.target.status.damage > before && before === percent) for (let f = 0; f < 12 && d.target.launch.hitlag > 0; f++) d.step(controls(), away);
  }
  return f32(d.target.status.damage - percent);
}

test("Twin-glaive forward air: the link and the launcher both connect at 0, 50 and 100 percent [spec docs/design/illidan.md]", () => {
  for (const percent of [0.0, 50.0, 100.0]) assertEquals(forwardAir(percent, 100.0, false), f32(damageAt(AttackStyle.forwardAir, 0) + damageAt(AttackStyle.forwardAir, 4)));
});

test("Twin-glaive forward air counterplay: SDI away from the link escapes the launcher [spec docs/design/illidan.md]", () => {
  assertEquals(forwardAir(0.0, 150.0, false), f32(damageAt(AttackStyle.forwardAir, 0) + damageAt(AttackStyle.forwardAir, 4)));
  assertEquals(forwardAir(0.0, 150.0, true), damageAt(AttackStyle.forwardAir, 0));
});

test("Flame Crash: hangs, plunges and spikes an airborne fighter below; a grounded one is launched up [spec docs/design/illidan.md]", () => {
  const air = duel(40.0);
  lift(air.illidan, 500.0);
  lift(air.target, 300.0);
  air.step(downB);
  assertEquals(air.illidan.special.action, SpecialAction.demonHunterImmolate);
  const height = air.illidan.motion.z;
  air.run(3);
  assertTrue(Math.abs(f32(air.illidan.motion.z - height)) < f32(0.01));
  for (let i = 0; i < 12 && air.target.status.damage === 0.0; i++) {
    air.target.motion.z = 300.0;
    air.target.motion.vz = 0.0;
    air.step();
  }
  assertEquals(air.target.status.damage, PLUNGE.effect.damage);
  assertLessThan(air.target.launch.knockbackZ, 0.0);

  const ground = duel(30.0);
  lift(ground.illidan, 200.0);
  ground.step(downB);
  for (let i = 0; i < 20 && ground.target.status.damage === 0.0; i++) ground.step();
  assertEquals(ground.target.status.damage, PLUNGE.groundedEffect?.damage);
  assertGreaterThan(ground.target.launch.knockbackZ, 0.0);
});

test("Flame Crash: landing bursts beside him for 8, and a shielding fighter acts while his landing still runs [spec docs/design/illidan.md]", () => {
  const d = duel(120.0);
  d.target.mana.points = 50;
  lift(d.illidan, 150.0);
  d.step(downB);
  for (let i = 0; i < 20 && d.illidan.special.form !== FLAME_CRASH_LANDING_FORM; i++) d.step();
  assertEquals(d.illidan.special.form, FLAME_CRASH_LANDING_FORM);
  d.run(3);
  assertEquals(d.target.status.damage, BURST.damage);
  assertEquals(d.drained, BURST.manaDrain);

  const blocked = duel(80.0);
  blocked.run(4, controls(), SHIELD);
  lift(blocked.illidan, 150.0);
  blocked.step(downB, SHIELD);
  for (let i = 0; i < 20 && blocked.illidan.special.form !== FLAME_CRASH_LANDING_FORM; i++) blocked.step(controls(), SHIELD);
  blocked.run(4, controls(), SHIELD);
  assertEquals(blocked.target.status.damage, 0.0);
  blocked.step();
  for (let i = 0; i < 20 && !canAttack(blocked.target); i++) blocked.step();

  assertEquals(blocked.illidan.special.action, SpecialAction.demonHunterImmolate);

  assertGreaterThan(blocked.illidan.special.duration - blocked.illidan.special.frame, attackStartupFrames(AttackStyle.jab));
});

test("Flame Crash counterplay: offstage it never lands and leaves him helpless; it has no jump cancel [spec docs/design/illidan.md]", () => {
  const d = duel(400.0);
  d.illidan.motion.x = -900.0;
  lift(d.illidan, 2000.0);
  d.step(downB);
  d.run(8, controls({ jumpPressed: true, jumpHeld: true }));
  assertEquals(d.illidan.special.action, SpecialAction.demonHunterImmolate);
  d.run(FLAME_CRASH_FRAMES);
  assertTrue(d.illidan.special.fall);
  assertFalse(d.illidan.motion.grounded);
});
