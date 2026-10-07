// Illidan's raid-boss normals and Flame Crash (#147, smashcraft:docs/design/illidan.md):
// Shear, Flames of Azzinoth, Eye Blast, the twin-glaive forward air and the
// aerial down special, each with its counterplay, through the ordinary match step.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { queueAttack } from "../input/attackBuffer";
import { AttackStyle, SpecialAction } from "./codes";
import { canAttack } from "./conditions";
import { EYE_BLAST_CHARGE_FRAMES, attackDurationFrames, attackStartupFrames } from "./moves";
import { FLAME_CRASH_FRAMES, FLAME_CRASH_LANDING_FORM } from "./specials";
import { type Duel, duel, lift } from "./testDuel";
import { controls } from "./testWorld";

const SHIELD = controls({ shield: true, shieldStrength: 1.0 });
const downB = controls({ specialPressed: true, specialZ: -1, verticalDirection: -1, down: true });

/** Queues an attack for Illidan on the next frame. */
function attack(d: Duel, style: AttackStyle, mayCharge = false, first = controls(), second = controls()): void {
  const frame = d.step(first, second);
  queueAttack(d.commands[0], { style, facing: d.illidan.facing < 0 ? -1 : 1, frame: frame + 1, mayCharge });
}

/** Steps until Illidan's attack ends (at most `frames`). */
function finish(d: Duel, frames: number, first = controls(), second = controls()): void {
  d.step(first, second);
  for (let i = 0; i < frames && d.illidan.attack.style !== undefined; i++) d.step(first, second);
}

test("Shear: forward tilt cuts 12 mana for 9 at a low angle, and a shield stops the drain", () => {
  const d = duel(110.0);
  d.target.mana.points = 60;
  attack(d, AttackStyle.forwardTilt);
  finish(d, 40);
  assertEquals(d.target.status.damage, 9.0);
  assertEquals(d.drained, 12);
  const blocked = duel(110.0);
  blocked.target.mana.points = 60;
  blocked.run(4, controls(), SHIELD);
  attack(blocked, AttackStyle.forwardTilt, false, controls(), SHIELD);
  finish(blocked, 40, controls(), SHIELD);
  assertEquals(blocked.target.status.damage, 0.0);
  assertEquals(blocked.target.mana.points, 60);
});

test("Flames of Azzinoth: the glaives strike both sides out to 190 for 14, and the fire wall burns once more", () => {
  for (const side of [-1, 1]) {
    const d = duel(170.0);
    d.target.motion.x = f32(side * 170.0);
    attack(d, AttackStyle.downSmash);
    finish(d, 60);
    assertEquals(d.target.status.damage, 14.0);
    assertEquals(d.drained, 8);
  }
  // A fighter who walks into the fire after the glaives burns for 3.
  const late = duel(400.0);
  attack(late, AttackStyle.downSmash);
  for (let i = 0; i < 40 && late.illidan.attack.frame < 8 + 3; i++) late.step();
  late.target.motion.x = 150.0;
  finish(late, 60);
  assertEquals(late.target.status.damage, 3.0);
});

test("Flames of Azzinoth counterplay: a shield holds both parts and acts with the smash still running; a jump clears the fire", () => {
  const d = duel(90.0);
  d.run(4, controls(), SHIELD);
  attack(d, AttackStyle.downSmash, false, controls(), SHIELD);
  for (let i = 0; i < 18; i++) d.step(controls(), SHIELD);
  assertEquals(d.target.status.damage, 0.0);
  // Dropping the shield, the defender acts with the smash still running: a punish window.
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

test("Eye Blast: forward smash charged 20 frames becomes a floor beam reaching 400 and draining 10; uncharged it does not reach", () => {
  for (const charge of [0, EYE_BLAST_CHARGE_FRAMES + 2]) {
    const d = duel(420.0);
    const held = controls({ attackHeld: true });
    attack(d, AttackStyle.forwardSmash, true, charge > 0 ? held : controls());
    d.run(charge + 6, charge > 0 ? held : controls());
    finish(d, 80);
    if (charge === 0) {
      assertEquals(d.target.status.damage, 0.0);
    } else {
      assertGreaterThan(d.target.status.damage, 10.0);
      assertEquals(d.drained, 10);
    }
  }
});

test("Eye Blast counterplay: the beam runs low along the floor, so a fighter above it is not hit", () => {
  const d = duel(420.0);
  const held = controls({ attackHeld: true });
  attack(d, AttackStyle.forwardSmash, true, held);
  d.run(EYE_BLAST_CHARGE_FRAMES + 2, held);
  lift(d.target, 140.0);
  d.target.motion.x = 420.0;
  for (let i = 0; i < 12; i++) {
    d.target.motion.z = 140.0;
    d.target.motion.vz = 0.0;
    d.step();
  }
  assertEquals(d.target.status.damage, 0.0);
});

/** Illidan and the target in the air `gap` apart; forward air on the next frame. Returns the target's damage after the move. */
function forwardAir(percent: number, gap: number, sdi: boolean): number {
  const d = duel(gap);
  d.target.status.damage = percent;
  lift(d.illidan, 650.0);
  lift(d.target, 650.0);
  // In the air a forward tilt command is the forward air.
  attack(d, AttackStyle.forwardTilt);
  const away = controls({ sdiPulse: true, sdiX: 1 });
  for (let i = 0; i < 30; i++) {
    const before = d.target.status.damage;
    // The victim taps away on every frame of the link's freeze.
    d.step(controls(), sdi && d.target.launch.hitlag > 0 ? away : controls());
    if (sdi && d.target.status.damage > before && before === percent) for (let f = 0; f < 12 && d.target.launch.hitlag > 0; f++) d.step(controls(), away);
  }
  return f32(d.target.status.damage - percent);
}

test("Twin-glaive forward air: the link and the launcher both connect at 0, 50 and 100 percent", () => {
  for (const percent of [0.0, 50.0, 100.0]) assertEquals(forwardAir(percent, 100.0, false), 5.0);
});

test("Twin-glaive forward air counterplay: SDI away from the link escapes the launcher", () => {
  assertEquals(forwardAir(0.0, 150.0, false), 5.0);
  assertEquals(forwardAir(0.0, 150.0, true), 2.0);
});

test("Flame Crash: hangs, plunges and spikes an airborne fighter below; a grounded one is launched up", () => {
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
  assertEquals(air.target.status.damage, 9.0);
  assertLessThan(air.target.launch.knockbackZ, 0.0);

  const ground = duel(30.0);
  lift(ground.illidan, 200.0);
  ground.step(downB);
  for (let i = 0; i < 20 && ground.target.status.damage === 0.0; i++) ground.step();
  assertEquals(ground.target.status.damage, 9.0);
  assertGreaterThan(ground.target.launch.knockbackZ, 0.0);
});

test("Flame Crash: landing bursts beside him for 8, and a shielding fighter acts while his landing still runs", () => {
  const d = duel(120.0);
  lift(d.illidan, 150.0);
  d.step(downB);
  for (let i = 0; i < 20 && d.illidan.special.form !== FLAME_CRASH_LANDING_FORM; i++) d.step();
  assertEquals(d.illidan.special.form, FLAME_CRASH_LANDING_FORM);
  d.run(3);
  assertEquals(d.target.status.damage, 8.0);
  assertEquals(d.drained, 6);

  const blocked = duel(80.0);
  blocked.run(4, controls(), SHIELD);
  lift(blocked.illidan, 150.0);
  blocked.step(downB, SHIELD);
  for (let i = 0; i < 20 && blocked.illidan.special.form !== FLAME_CRASH_LANDING_FORM; i++) blocked.step(controls(), SHIELD);
  blocked.run(4, controls(), SHIELD);
  assertEquals(blocked.target.status.damage, 0.0);
  blocked.step();
  for (let i = 0; i < 20 && !canAttack(blocked.target); i++) blocked.step();
  // The defender acts with Flame Crash's landing still running: a punish window.
  assertEquals(blocked.illidan.special.action, SpecialAction.demonHunterImmolate);
  // Even after the shield's release lag, more frames than a jab's 4-frame startup remain.
  assertGreaterThan(blocked.illidan.special.duration - blocked.illidan.special.frame, attackStartupFrames(AttackStyle.jab));
});

test("Flame Crash counterplay: offstage it never lands and leaves him helpless; it has no jump cancel", () => {
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
