// Stage hazards through a controller's real input path (helperPads.ts), on
// their test stages: Dream Land's wind pushes standing fighters on its fixed
// cycle, and Kongo Jungle's barrel cannon catches a fighter, holds it and
// fires it on a press or by itself. The schedules follow the match frame alone.
import { assertDefined, assertEquals, assertFalse, assertGreaterThan, assertLessThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { meleeCos, meleeSin } from "../../sim/meleeScalarMath";
import { Character, DownState } from "../sim/codes";
import { isIntangible } from "../sim/conditions";
import { type Fighter, createFighter } from "../sim/fighter";
import { contactKnockback, ordinaryHitstunFrames } from "../sim/knockback";
import { fighterAt } from "../sim/roster";
import { CANNON_TEST_STAGE, CARRIED_TEST_STAGE, TIMED_TEST_STAGE, WIND_TEST_STAGE, surfaceLeft, surfaceRight, surfaceShiftX, surfaceShiftZ, surfaceZ } from "../sim/stage";
import { PLATFORM_CUE_FRAMES, framesUntilPlatformMoves } from "../presentation/stageHazards";
import {
  CANNON_BASE_KNOCKBACK, CANNON_HOLD_FRAMES, CANNON_RECATCH_FRAMES, CANNON_SHOT_FRAMES, CANNON_Z, WIND_BLOW_FRAMES, WIND_CALM_FRAMES,
  WIND_CUE_FRAMES, WIND_CYCLE_FRAMES, WIND_SPEED, WindPhase, cannonAim, cannonX, windDirection, windLeft, windPhase, windRight,
} from "../sim/stageHazards";
import { type Pad, type PadMatch, padMatch, playPads } from "./helperPads";
import { testMatch } from "./testMatch";

const NEUTRAL: Pad = {};

test("controllers ride a complete carried loop and rising-sinking timetable; every departure is warned 30 frames ahead", () => {
  for (const [stage, period] of [[CARRIED_TEST_STAGE, 920], [TIMED_TEST_STAGE, 420]] as const) {
    const match = testMatch(3, Character.archer);
    match.game.stageChoice = stage;
    const fighter = fighterAt(match.world, 0);
    fighter.motion.surface = 1;
    fighter.motion.x = f32(f32(surfaceLeft(stage, 1, 0) + surfaceRight(stage, 1, 0)) / 2);
    fighter.motion.z = surfaceZ(stage, 1, 0);
    const run = padMatch(match, "carried-platform");
    let departures = 0;
    for (let frame = 1; frame <= period; frame++) {
      const moving = surfaceShiftX(stage, 1, frame) !== 0 || surfaceShiftZ(stage, 1, frame) !== 0;
      const wasMoving = surfaceShiftX(stage, 1, frame - 1) !== 0 || surfaceShiftZ(stage, 1, frame - 1) !== 0;
      if (moving && !wasMoving) {
        departures++;
        assertEquals(framesUntilPlatformMoves(stage, frame - 1 - PLATFORM_CUE_FRAMES), PLATFORM_CUE_FRAMES);
      }
      playPads(run, NEUTRAL, NEUTRAL);
      assertTrue(fighter.motion.grounded);
      assertEquals(fighter.motion.surface, 1);
      assertNear(fighter.motion.x, f32(f32(surfaceLeft(stage, 1, frame) + surfaceRight(stage, 1, frame)) / 2), 0.0010000000474974513);
      assertEquals(fighter.motion.z, surfaceZ(stage, 1, frame));
    }
    assertEquals(departures, stage === CARRIED_TEST_STAGE ? 4 : 2);
  }
});

function windMatch(): PadMatch {
  const match = testMatch(3, Character.archer);
  match.game.stageChoice = WIND_TEST_STAGE;
  match.world.fighters[0] = createFighter(Character.archer, 240.0, 1);
  match.world.fighters[1] = createFighter(Character.rifleman, -300.0, -1);
  return padMatch(match, "wind");
}

/** Plays neutral frames through `last`, checking each frame's motion of both fighters along x. */
function playWind(run: PadMatch, last: number, check: (frame: number, first: number, second: number) => void): void {
  const { world, runtime } = run.match;
  while (runtime.simulationFrame < last) {
    const first = fighterAt(world, 0).motion.x;
    const second = fighterAt(world, 1).motion.x;
    playPads(run, NEUTRAL, NEUTRAL);
    check(runtime.simulationFrame, f32(fighterAt(world, 0).motion.x - first), f32(fighterAt(world, 1).motion.x - second));
  }
}

test("Whispy's wind waits, warns for 45 frames, then pushes standing fighters on its side 0.2 Melee units a frame, alternating sides", () => {
  const run = windMatch();
  const gust = WIND_CALM_FRAMES + WIND_CUE_FRAMES;
  assertEquals(windPhase(1), WindPhase.calm);
  assertEquals(windPhase(WIND_CALM_FRAMES + 1), WindPhase.cue);
  assertEquals(windPhase(gust + 1), WindPhase.blowing);
  assertEquals(windPhase(WIND_CYCLE_FRAMES + 1), WindPhase.calm);
  assertEquals(windDirection(gust + 1), 1);
  assertEquals(windDirection(WIND_CYCLE_FRAMES + gust + 1), -1);
  // Calm and the warning move no one.
  playWind(run, gust, (_frame, first, second) => {
    assertEquals(first, 0.0);
    assertEquals(second, 0.0);
  });
  // The first gust blows right: the fighter right of center moves, the one left of center does not.
  playWind(run, WIND_CYCLE_FRAMES, (_frame, first, second) => {
    assertNear(first, WIND_SPEED, 0.0001);
    assertEquals(second, 0.0);
  });
  const pushed = fighterAt(run.match.world, 0);
  assertNear(pushed.motion.x, f32(240.0 + f32(WIND_BLOW_FRAMES * WIND_SPEED)), 0.01);
  assertTrue(pushed.motion.grounded);
  // The next gust blows left, after the same wait and warning; it stops pushing at its box's outer edge, short of the ledge.
  playWind(run, WIND_CYCLE_FRAMES + gust, (_frame, first, second) => {
    assertEquals(first, 0.0);
    assertEquals(second, 0.0);
  });
  playWind(run, 2 * WIND_CYCLE_FRAMES, (_frame, first, second) => {
    assertEquals(first, 0.0);
    assertTrue(second === 0.0 || Math.abs(f32(second + WIND_SPEED)) < 0.0001);
  });
  const left = fighterAt(run.match.world, 1);
  assertLessThan(left.motion.x, windLeft(WIND_TEST_STAGE, -1) + 2.0);
  assertGreaterThan(left.motion.x, windLeft(WIND_TEST_STAGE, -1) - 2.0);
  assertTrue(left.motion.grounded);
  assertLessThan(windRight(WIND_TEST_STAGE, 1), 600.0);
});

function cannonMatch(): PadMatch & { readonly victim: Fighter; readonly other: Fighter } {
  const match = testMatch(3, Character.archer);
  match.game.stageChoice = CANNON_TEST_STAGE;
  // Both fall onto the cannon at its left end; it catches only the first in slot order.
  const victim = createFighter(Character.rifleman, cannonX(1), 1);
  const other = createFighter(Character.archer, f32(cannonX(1) + 20.0), -1);
  for (const fighter of [victim, other]) {
    fighter.motion.grounded = false;
    fighter.motion.z = f32(CANNON_Z + 40.0);
  }
  match.world.fighters[0] = victim;
  match.world.fighters[1] = other;
  return { ...padMatch(match, "cannon"), victim, other };
}

/** The shot along the cannon's aim on `frame`: Melee's knockback from base knockback alone. */
function assertFiredAlongAim(victim: Fighter, frame: number): void {
  const knockback = contactKnockback(victim.status.damage, 0.0, victim.tuning.physics.weight, 0.0, CANNON_BASE_KNOCKBACK, 1.0);
  assertEquals(knockback, CANNON_BASE_KNOCKBACK);
  assertEquals(victim.cannon.held, undefined);
  assertEquals(victim.cannon.cooldown, CANNON_RECATCH_FRAMES);
  assertEquals(victim.launch.hitstun, ordinaryHitstunFrames(CANNON_BASE_KNOCKBACK));
  assertEquals(victim.down.state, DownState.tumble);
  const aim = cannonAim(frame);
  const speed = f32(victim.launch.diLaunchSpeed);
  assertEquals(victim.launch.knockbackX, f32(speed * meleeSin(aim)));
  assertEquals(victim.launch.knockbackZ, f32(speed * meleeCos(aim)));
  assertEquals(victim.motion.x, cannonX(frame));
  assertEquals(victim.motion.z, CANNON_Z);
}

test("the cannon catches the first fighter to touch it, holds it intangible as it swings, and fires it 11 frames after Attack", () => {
  const run = cannonMatch();
  const { victim, other } = run;
  playPads(run, NEUTRAL, NEUTRAL);
  assertEquals(victim.cannon.held, 0);
  assertEquals(other.cannon.held, undefined);
  assertTrue(isIntangible(victim));
  for (let frame = 2; frame <= 30; frame++) {
    playPads(run, NEUTRAL, NEUTRAL);
    assertEquals(victim.motion.x, cannonX(frame));
    assertEquals(victim.motion.z, CANNON_Z);
    assertEquals(other.cannon.held, undefined);
  }
  // Attack begins the shot; it leaves CANNON_SHOT_FRAMES later.
  playPads(run, { attack: true }, NEUTRAL);
  assertEquals(victim.cannon.firing, 1);
  const shot = 31 + CANNON_SHOT_FRAMES - 1;
  while (run.match.runtime.simulationFrame < shot - 1) {
    playPads(run, NEUTRAL, NEUTRAL);
    assertTrue(victim.cannon.held !== undefined);
  }
  playPads(run, NEUTRAL, NEUTRAL);
  assertFiredAlongAim(victim, shot);
  // The shot clears the deck and leaves the fighter in play; the cannon does not catch it again on the way.
  let highest = victim.motion.z;
  for (let frame = 0; frame < 240; frame++) {
    playPads(run, NEUTRAL, NEUTRAL);
    highest = Math.max(highest, victim.motion.z);
    assertFalse(victim.status.out);
  }
  assertGreaterThan(highest, 0.0);
});

test("a held fighter that presses nothing is fired when the hold runs out", () => {
  const run = cannonMatch();
  const { victim } = run;
  playPads(run, NEUTRAL, NEUTRAL);
  assertEquals(victim.cannon.held, 0);
  while (assertDefined(victim.cannon.held) < CANNON_HOLD_FRAMES - 1) playPads(run, NEUTRAL, NEUTRAL);
  assertEquals(victim.cannon.firing, undefined);
  playPads(run, NEUTRAL, NEUTRAL);
  assertEquals(victim.cannon.firing, 1);
  const shot = 1 + CANNON_HOLD_FRAMES + CANNON_SHOT_FRAMES - 1;
  while (run.match.runtime.simulationFrame < shot) playPads(run, NEUTRAL, NEUTRAL);
  assertFiredAlongAim(victim, shot);
  // Its immunity lasts CANNON_RECATCH_FRAMES; the other fighter, still beside the cannon's path, may be caught meanwhile.
  for (let frame = 0; frame < CANNON_RECATCH_FRAMES; frame++) playPads(run, NEUTRAL, NEUTRAL);
  assertEquals(victim.cannon.cooldown, 0);
});
