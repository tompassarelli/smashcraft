// Illidan's Fel Rush side special with its Vengeful Retreat and Chaos Strike
// branches, and the mana his hits drain (#147, smashcraft:docs/design/illidan.md),
// through the ordinary match step: inputs and attack commands in, state out.
import { assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { ATTACK_BUFFER_FRAMES, type AttackBuffer, attackBuffer, queueAttack } from "../input/attackBuffer";
import { type FrameControls, createFrameControls } from "../match/controls";
import { Phase, createMatchState } from "../match/rules";
import { stepMatch } from "../match/step";
import { AttackStyle, Character, SpecialAction } from "./codes";
import { canAttack } from "./conditions";
import { type Fighter, createFighter } from "./fighter";
import { DEMON_HUNTER_THROW_DRAIN } from "./hitRegions";
import { takenManaGain } from "./mana";
import { type Controls, copyControls, createRoster } from "./roster";
import {
  CHAOS_STRIKE_FORM, FEL_RUSH_BRANCH_FIRST, FEL_RUSH_BRANCH_LAST, FEL_RUSH_FRAMES, FEL_RUSH_SPEED, FEL_RUSH_TELL_LAST,
  VENGEFUL_RETREAT_FORM, VENGEFUL_RETREAT_FRAMES,
} from "./specials";
import { controls } from "./testWorld";

const RUSH = FEL_RUSH_SPEED * 10;

/** The next frame is the action's last: an attack queued for the frame after it starts there (a jab, or an aerial in the air). */
function actsOnTheNextFrame(d: Duel, facing: number): void {
  const last = d.step();
  assertEquals(d.illidan.special.action, SpecialAction.none);
  assertEquals(d.illidan.attack.style, undefined);
  queueAttack(d.commands[0], { style: AttackStyle.jab, facing: facing < 0 ? -1 : 1, frame: last + 1, mayCharge: false });
  d.step();
  assertTrue(d.illidan.attack.style !== undefined);
}

interface Duel {
  readonly illidan: Fighter;
  readonly target: Fighter;
  readonly commands: readonly [AttackBuffer, AttackBuffer];
  /**
   * Mana drained from the target so far: each frame it took damage, its mana
   * change less the shared comeback gain for being hit (smashcraft:docs/design/mana.md).
   */
  drained: number;
  /** One match frame with these controls for Illidan and the target; returns the frame number. */
  step(first?: Readonly<Controls>, second?: Readonly<Controls>): number;
  run(frames: number, first?: Readonly<Controls>, second?: Readonly<Controls>): void;
}

/** Illidan at 0 facing right and an Archer `gap` ahead facing him, both standing on the main deck. */
function duel(gap: number, character: Character = Character.archer): Duel {
  const game = createMatchState();
  game.phase = Phase.match;
  const illidan = createFighter(Character.demonHunter, 0.0, 1);
  const target = createFighter(character, gap, -1);
  const world = createRoster(3, [illidan, target]);
  const commands: [AttackBuffer, AttackBuffer] = [attackBuffer(ATTACK_BUFFER_FRAMES), attackBuffer(ATTACK_BUFFER_FRAMES)];
  let frame = 0;
  const frameControls = (first: Readonly<Controls>, second: Readonly<Controls>): FrameControls => {
    const out = createFrameControls();
    copyControls(out.inputs[0], first);
    copyControls(out.inputs[1], second);
    out.commands[0] = commands[0];
    out.commands[1] = commands[1];
    return out;
  };
  const step = (first: Readonly<Controls> = controls(), second: Readonly<Controls> = controls()) => {
    frame++;
    const mana = target.mana.points;
    const damage = target.status.damage;
    stepMatch(game, world, frameControls(first, second), frame);
    if (target.status.damage > damage) d.drained += mana - target.mana.points + takenManaGain(target.status.damage - damage);
    return frame;
  };
  const d: Duel = {
    illidan, target, commands, step, drained: 0,
    run: (frames, first, second) => { for (let i = 0; i < frames; i++) step(first, second); },
  };
  // Settle on the deck before the scripted inputs.
  d.run(3);
  return d;
}

const sideB = (side: number) => controls({ specialPressed: true, specialX: side, direction: side });
const SHIELD = controls({ shield: true, shieldStrength: 1.0 });

/** Presses Fel Rush (frame 1) and holds nothing through `frame`, the last frame stepped. */
function rushTo(d: Duel, frame: number, side = 1, second: Readonly<Controls> = controls()): void {
  d.step(sideB(side), second);
  d.run(frame - 1, controls(), second);
}

test("Fel Rush: still through the tell, 200 units on frames 6-15 the way the stick points, acting again on frame 30", () => {
  for (const side of [-1, 1]) {
    const d = duel(420.0);
    const start = d.illidan.motion.x;
    rushTo(d, FEL_RUSH_TELL_LAST, side);
    assertEquals(d.illidan.special.action, SpecialAction.demonHunterFelRush);
    assertEquals(d.illidan.facing, side);
    assertEquals(d.illidan.motion.x, start);
    d.run(15 - FEL_RUSH_TELL_LAST);
    assertTrue(Math.abs(f32(f32(d.illidan.motion.x - start) - side * RUSH)) < 1.0);
    const end = d.illidan.motion.x;
    d.run(FEL_RUSH_FRAMES - 15 - 1);
    assertTrue(Math.abs(f32(d.illidan.motion.x - end)) < 1.0);
    actsOnTheNextFrame(d, side);
  }
});

test("Fel Rush in the air: level through the rush, once per airtime, never helpless", () => {
  const d = duel(420.0);
  d.step(controls({ jumpPressed: true, jumpHeld: true }));
  d.run(14, controls({ jumpHeld: true }));
  assertFalse(d.illidan.motion.grounded);
  d.step(sideB(1));
  const height = d.illidan.motion.z;
  d.run(14);
  assertTrue(Math.abs(f32(d.illidan.motion.z - height)) < 0.01);
  d.run(FEL_RUSH_FRAMES - 15 + 1 + 40);
  assertFalse(d.illidan.special.fall);
  if (!d.illidan.motion.grounded) {
    d.step(sideB(1));
    assertEquals(d.illidan.special.action, SpecialAction.none);
  }
  d.run(120);
  assertTrue(d.illidan.motion.grounded);
  d.step(sideB(1));
  assertEquals(d.illidan.special.action, SpecialAction.demonHunterFelRush);
});

test("Fel Rush passes through a body, popping it up for 6 and draining 4 mana", () => {
  const d = duel(120.0);
  d.target.mana.points = 50;
  d.step(sideB(1));
  // The hit's freeze holds the rush; it still runs its ten frames.
  for (let i = 0; i < 40 && d.illidan.special.frame < 15; i++) d.step();
  assertEquals(d.target.status.damage, 6.0);
  assertEquals(d.drained, 4);
  assertGreaterThan(d.illidan.motion.x, d.target.motion.x);
  assertFalse(d.target.motion.grounded);
  assertTrue(d.illidan.special.hit);
});

test("Fel Rush counterplay: a raised shield stops it short, takes no drain, and the rush with no branch is punished", () => {
  const d = duel(170.0);
  d.target.mana.points = 50;
  d.run(4, controls(), SHIELD);
  assertTrue(d.target.shield.raised);
  rushTo(d, 15, 1, SHIELD);
  assertLessThan(d.illidan.motion.x, d.target.motion.x);
  assertEquals(d.target.status.damage, 0.0);
  assertEquals(d.target.mana.points, 50);
  assertGreaterThan(d.target.visuals.shield, 0);
  // The defender drops the shield and jabs; Illidan is still in the rush's recovery.
  let frame = d.step();
  while (!canAttack(d.target) && frame < 60) frame = d.step();
  queueAttack(d.commands[1], { style: AttackStyle.jab, facing: -1, frame: frame + 1, mayCharge: false });
  d.run(8);
  assertGreaterThan(d.illidan.status.damage, 0.0);
});

test("Fel Rush counterplay: a hit during the tell stops it before it moves", () => {
  const d = duel(60.0);
  const start = d.illidan.motion.x;
  const frame = d.step(sideB(1));
  queueAttack(d.commands[1], { style: AttackStyle.jab, facing: -1, frame, mayCharge: false });
  d.run(FEL_RUSH_TELL_LAST);
  assertGreaterThan(d.illidan.status.damage, 0.0);
  assertEquals(d.illidan.special.action, SpecialAction.none);
  d.run(15);
  assertLessThan(Math.abs(f32(d.illidan.motion.x - start)), 60.0);
});

test("Vengeful Retreat: a special press in frames 10-24 vaults back, acting on its frame 17; outside the window nothing", () => {
  for (const press of [FEL_RUSH_BRANCH_FIRST - 1, FEL_RUSH_BRANCH_FIRST, FEL_RUSH_BRANCH_LAST, FEL_RUSH_BRANCH_LAST + 1]) {
    const d = duel(420.0);
    rushTo(d, press - 1);
    const at = d.illidan.motion.x;
    d.step(sideB(1));
    const branched = press >= FEL_RUSH_BRANCH_FIRST && press <= FEL_RUSH_BRANCH_LAST;
    assertEquals(d.illidan.special.form, branched ? VENGEFUL_RETREAT_FORM : 0);
    if (!branched) continue;
    d.run(VENGEFUL_RETREAT_FRAMES - 2);
    assertLessThan(d.illidan.motion.x, f32(at - 100.0));
    assertFalse(d.illidan.special.fall);
    actsOnTheNextFrame(d, 1);
  }
});

test("Vengeful Retreat counterplay: no intangibility, so a chasing hit lands during the vault", () => {
  const d = duel(420.0);
  rushTo(d, 11);
  d.step(sideB(1));
  assertEquals(d.illidan.special.form, VENGEFUL_RETREAT_FORM);
  for (let frame = 1; frame <= 10; frame++) {
    assertFalse(d.illidan.status.invincible > 0);
    d.step();
  }
});

test("Chaos Strike: an attack press slashes toward the held stick for 10 and drains 10; the other side misses", () => {
  for (const back of [false, true]) for (const held of [1, -1]) {
    const d = duel(420.0);
    d.target.mana.points = 50;
    rushTo(d, 15);
    d.target.motion.x = f32(d.illidan.motion.x + (back ? -80.0 : 80.0));
    d.step(controls({ attackPressed: true, direction: held }));
    assertEquals(d.illidan.special.form, CHAOS_STRIKE_FORM);
    d.run(8);
    const faces = held < 0 ? -1 : 1;
    const hits = (back && faces < 0) || (!back && faces > 0);
    assertEquals(d.target.status.damage, hits ? 10.0 : 0.0);
    assertEquals(d.drained, hits ? 10 : 0);
  }
});

test("Drain on hit: a normal and a throw drain their authored amounts, a shield none, and mana floors at 0", () => {
  const jab = duel(70.0);
  jab.target.mana.points = 50;
  queueAttack(jab.commands[0], { style: AttackStyle.jab, facing: 1, frame: jab.step(), mayCharge: false });
  jab.run(8);
  assertGreaterThan(jab.target.status.damage, 0.0);
  assertEquals(jab.drained, 3);
  assertGreaterThan(jab.target.visuals.manaDrained, 0);

  const shielded = duel(70.0);
  shielded.target.mana.points = 50;
  shielded.run(4, controls(), SHIELD);
  queueAttack(shielded.commands[0], { style: AttackStyle.jab, facing: 1, frame: shielded.step(controls(), SHIELD), mayCharge: false });
  shielded.run(8, controls(), SHIELD);
  assertEquals(shielded.target.mana.points, 50);
  assertEquals(shielded.target.visuals.manaDrained, 0);

  const floor = duel(70.0);
  floor.target.mana.points = 2;
  queueAttack(floor.commands[0], { style: AttackStyle.jab, facing: 1, frame: floor.step(), mayCharge: false });
  floor.run(8);
  assertEquals(floor.drained, 2);

  const thrown = duel(60.0);
  thrown.target.mana.points = 50;
  queueAttack(thrown.commands[0], { style: AttackStyle.grab, facing: 1, frame: thrown.step(), mayCharge: false });
  thrown.run(12);
  assertEquals(thrown.target.grab.owner, 0);
  thrown.step(controls({ grabThrowX: 1 }));
  thrown.run(40);
  assertEquals(thrown.drained, DEMON_HUNTER_THROW_DRAIN);

  // Another fighter's hits drain nothing.
  const other = duel(70.0);
  other.illidan.character = Character.archer;
  other.target.mana.points = 50;
  queueAttack(other.commands[0], { style: AttackStyle.jab, facing: 1, frame: other.step(), mayCharge: false });
  other.run(8);
  assertGreaterThan(other.target.status.damage, 0.0);
  assertEquals(other.drained, 0);
});
