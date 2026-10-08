// Recoveries played through captured rows and the frame executor: a fighter
// whose fall carries the ledge into its catch box snaps to it, one just
// outside the box falls past, and a ledge jump clears the wall below it.
import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, LedgeState } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
import { LEDGE_HANG_DEPTH, LEDGE_HANG_OUTSET, ledgeCatchBox } from "../sim/ledge";
import { fighterAt } from "../sim/roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";
import { type TestMatch, executeNext, testMatch } from "./testMatch";

const ROSTER = [Character.rifleman, Character.demonHunter] as const;

function ledgeEdge(side: number): number {
  return side < 0 ? surfaceLeft(0, 0, 0) : surfaceRight(0, 0, 0);
}

/** Slot 0 airborne `outside` beyond the `side` ledge and `below` it, facing the stage, with one air jump. */
function besideLedge(match: TestMatch, side: number, outside: number, below: number): Fighter {
  const fighter = fighterAt(match.world, 0);
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  fighter.motion.x = f32(ledgeEdge(side) + f32(side * outside));
  fighter.motion.z = f32(surfaceZ(0, 0, 0) - below);
  fighter.motion.vx = 0.0;
  fighter.motion.vz = 0.0;
  fighter.facing = -side;
  fighter.jump.remaining = 1;
  return fighter;
}

function depth(fighter: Fighter): number {
  return f32(surfaceZ(0, 0, 0) - fighter.motion.z);
}

interface Recovery {
  /** The frame that caught the ledge, or undefined. */
  readonly caught: number | undefined;
  /** Depths below the ledge after the two movements before the catch. */
  readonly previousDepth: number;
  readonly lastDepth: number;
  /** Whether any frame caught while the fighter was still rising. */
  readonly caughtRising: boolean;
}

/** Plays neutral frames, pressing jump on the first when asked, until a catch or the fall passes `deepest`. */
function playRecovery(match: TestMatch, fighter: Fighter, jumpFirst: boolean, deepest: number): Recovery {
  let previousDepth = depth(fighter);
  let lastDepth = previousDepth;
  for (let frame = 1; frame <= 240; frame++) {
    match.inputs.inputs[0].jumpPressed = jumpFirst && frame === 1;
    const rising = fighter.motion.deltaZ > 0;
    executeNext(match);
    if (fighter.ledge.state !== LedgeState.none) return { caught: frame, previousDepth, lastDepth, caughtRising: rising };
    previousDepth = lastDepth;
    lastDepth = depth(fighter);
    if (lastDepth > deepest) break;
  }
  return { caught: undefined, previousDepth, lastDepth, caughtRising: false };
}

function assertSnapped(fighter: Fighter, side: number): void {
  assertEquals(fighter.ledge.state, LedgeState.hang);
  assertEquals(fighter.ledge.side, side);
  assertEquals(fighter.facing, -side);
  assertEquals(fighter.motion.x, f32(ledgeEdge(side) + f32(side * LEDGE_HANG_OUTSET)));
  assertEquals(fighter.motion.z, f32(surfaceZ(0, 0, 0) - LEDGE_HANG_DEPTH));
}

test("a fighter falling beside the ledge within its catch box snaps to it as its feet pass the box's top [repro #47]", () => {
  for (const character of ROSTER) {
    const { reach, lowest } = ledgeCatchBox(character);
    for (const side of [-1, 1]) {
      const match = testMatch(3, character);
      const fighter = besideLedge(match, side, f32(reach - 6.0), 0.0);
      const recovery = playRecovery(match, fighter, false, 400.0);
      assertTrue(recovery.caught !== undefined);
      assertSnapped(fighter, side);
      // The catch came on the first movement that carried the ledge into the box.
      assertGreaterThan(recovery.lastDepth, lowest);
      assertFalse(recovery.previousDepth > lowest);
    }
  }
});

test("a double jump from below the ledge rises through the box, then snaps on the way down [repro #47]", () => {
  for (const character of ROSTER) {
    const { lowest, highest } = ledgeCatchBox(character);
    for (const side of [-1, 1]) {
      const match = testMatch(3, character);
      const fighter = besideLedge(match, side, 30.0, f32(highest + 60.0));
      const recovery = playRecovery(match, fighter, true, f32(highest + 120.0));
      assertTrue(recovery.caught !== undefined);
      assertFalse(recovery.caughtRising);
      assertSnapped(fighter, side);
      assertGreaterThan(recovery.lastDepth, lowest);
      assertFalse(recovery.previousDepth > lowest);
    }
  }
});

test("the same recoveries just beyond the catch box's reach fall past the ledge [repro #47]", () => {
  for (const character of ROSTER) {
    const { reach, highest } = ledgeCatchBox(character);
    for (const side of [-1, 1]) {
      const falling = testMatch(3, character);
      const besideFall = besideLedge(falling, side, f32(reach + 1.0), 0.0);
      assertEquals(playRecovery(falling, besideFall, false, f32(highest + 60.0)).caught, undefined);
      assertEquals(besideFall.ledge.serial, 0);
      const jumping = testMatch(3, character);
      const fromBelow = besideLedge(jumping, side, f32(reach + 1.0), f32(highest + 60.0));
      assertEquals(playRecovery(jumping, fromBelow, true, f32(highest + 120.0)).caught, undefined);
      assertEquals(fromBelow.ledge.serial, 0);
    }
  }
});

test("a fall that starts just below the catch box falls past the ledge [repro #47]", () => {
  for (const character of ROSTER) {
    const { highest } = ledgeCatchBox(character);
    for (const side of [-1, 1]) {
      const match = testMatch(3, character);
      const fighter = besideLedge(match, side, 30.0, f32(highest + 1.0));
      assertEquals(playRecovery(match, fighter, false, f32(highest + 120.0)).caught, undefined);
    }
  }
});

test("a ledge jump rises past the main deck's side wall and lands on the stage [spec #52]", () => {
  for (const character of ROSTER) {
    const { reach } = ledgeCatchBox(character);
    for (const side of [-1, 1]) {
      const match = testMatch(3, character);
      const fighter = besideLedge(match, side, f32(reach - 6.0), 0.0);
      assertTrue(playRecovery(match, fighter, false, 400.0).caught !== undefined);
      executeNext(match);
      match.inputs.inputs[0].jumpPressed = true;
      executeNext(match);
      match.inputs.inputs[0].jumpPressed = false;
      assertEquals(fighter.ledge.state, LedgeState.none);
      for (let frame = 1; frame <= 120 && !fighter.motion.grounded; frame++) executeNext(match);
      assertTrue(fighter.motion.grounded);
      assertGreaterThan(fighter.surfaceRecovery.contactSerial, 0);
      assertEquals(fighter.motion.surface, 0);
      assertEquals(fighter.ledge.serial, 1);
    }
  }
});
