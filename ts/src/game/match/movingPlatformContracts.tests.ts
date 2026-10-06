// Controllers pass through the companion row, journal and synchronized frame executor.
import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState, LedgeState } from "../sim/codes";
import { fighterAt } from "../sim/roster";
import { DRIFTING_DECK_STAGE, PATTERNED_DECKS_STAGE, mainDeckRight, surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";
import { padMatch, playPads } from "./helperPads";
import { testMatch } from "./testMatch";

function onDeck(stage: number, deck: number, frame = 0) {
  const match = testMatch(3, Character.archer);
  match.game.stageChoice = stage;
  match.game.matchFrame = frame;
  const fighter = fighterAt(match.world, 0);
  fighter.motion.x = f32(f32(surfaceLeft(stage, deck, frame) + surfaceRight(stage, deck, frame)) / 2);
  fighter.motion.z = surfaceZ(stage, deck, frame);
  fighter.motion.surface = deck;
  const other = fighterAt(match.world, 1);
  other.motion.x = -550.0;
  return { ...padMatch(match, "moving-platform"), fighter };
}

// Fighter_procUpdate adds mpGetSpeed to grounded position, even in hitlag.
test("neutral and shielding controllers ride complete back-and-forth, loop and lift cycles", () => {
  for (const [stage, deck, frames] of [[DRIFTING_DECK_STAGE, 1, 600], [PATTERNED_DECKS_STAGE, 1, 420], [PATTERNED_DECKS_STAGE, 2, 500]] as const) {
    const run = onDeck(stage, deck);
    const startX = run.fighter.motion.x;
    const startZ = run.fighter.motion.z;
    for (let frame = 1; frame <= frames; frame++) {
      playPads(run, frame < 100 ? { trigger: true } : {}, {});
      assertTrue(run.fighter.motion.grounded);
      assertEquals(run.fighter.motion.surface, deck);
      assertEquals(run.fighter.motion.z, surfaceZ(stage, deck, run.match.game.matchFrame));
      assertNear(run.fighter.motion.x, f32(f32(surfaceLeft(stage, deck, frame) + surfaceRight(stage, deck, frame)) / 2), 0.0010000000474974513);
    }
    assertNear(run.fighter.motion.x, startX, 0.0010000000474974513);
    assertEquals(run.fighter.motion.z, startZ);
  }
});

test("a deck carries its grounded fighter during hitlag", () => {
  const run = onDeck(DRIFTING_DECK_STAGE, 1);
  run.fighter.launch.hitlag = 10;
  const before = run.fighter.motion.x;
  playPads(run, {}, {});
  assertGreaterThan(run.fighter.launch.hitlag, 0);
  assertNear(run.fighter.motion.x, f32(before + 2.5), 0.0010000000474974513);
});

// mpCheckFloorRemap maps the old endpoint by the line's motion before crossing.
test("a falling fighter lands on a rising deck and a jumping controller leaves it", () => {
  const run = onDeck(PATTERNED_DECKS_STAGE, 1, 100);
  const fighter = run.fighter;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  fighter.motion.z = f32(fighter.motion.z + 1.0);
  fighter.motion.vz = -2.0;
  playPads(run, {}, {});
  assertTrue(fighter.motion.grounded);
  assertEquals(fighter.motion.surface, 1);
  assertEquals(fighter.motion.z, surfaceZ(PATTERNED_DECKS_STAGE, 1, 101));
  while (fighter.landing.lag > 0) playPads(run, {}, {});
  for (let frame = 0; frame < 8; frame++) playPads(run, { y: 1.0 }, {});
  assertFalse(fighter.motion.grounded);
  assertGreaterThan(fighter.motion.z, surfaceZ(PATTERNED_DECKS_STAGE, 1, run.match.game.matchFrame));
});

test("a fresh down press drops through a moving deck and lands on the main deck", () => {
  const run = onDeck(DRIFTING_DECK_STAGE, 1);
  playPads(run, {}, {});
  playPads(run, { y: -1.0 }, {});
  assertFalse(run.fighter.motion.grounded);
  for (let frame = 0; frame < 100 && !run.fighter.motion.grounded; frame++) playPads(run, {}, {});
  assertTrue(run.fighter.motion.grounded);
  assertEquals(run.fighter.motion.surface, 0);
});

test("a controller trigger techs on a moving deck and its recovery rides the deck", () => {
  const run = onDeck(DRIFTING_DECK_STAGE, 1);
  const fighter = run.fighter;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  fighter.motion.z = f32(fighter.motion.z + 1.0);
  fighter.motion.vz = -2.0;
  fighter.down.state = DownState.tumble;
  fighter.launch.hitstun = 50;
  playPads(run, { trigger: true }, {});
  assertEquals(fighter.down.state, DownState.tech);
  assertTrue(fighter.motion.grounded);
  const x = fighter.motion.x;
  for (let frame = 0; frame < 5; frame++) playPads(run, {}, {});
  assertNear(fighter.motion.x, f32(x + 12.5), 0.0010000000474974513);
});

// GrSt.dat line 0 and GrIz.dat lines 0–2 are platforms without LINE_FLAG_LEDGE.
test("moving platform edges cannot be grabbed; the main ledge remains grabbable", () => {
  const run = onDeck(DRIFTING_DECK_STAGE, 1);
  const fighter = run.fighter;
  fighter.motion.grounded = false;
  fighter.motion.surface = undefined;
  fighter.motion.x = f32(surfaceRight(DRIFTING_DECK_STAGE, 1, 0) + 15.0);
  fighter.motion.z = 150.0;
  fighter.motion.vz = -2.0;
  fighter.facing = -1;
  for (let frame = 0; frame < 5; frame++) playPads(run, {}, {});
  assertEquals(fighter.ledge.state, LedgeState.none);
  fighter.motion.x = f32(mainDeckRight(DRIFTING_DECK_STAGE) + 15.0);
  fighter.motion.z = -10.0;
  fighter.motion.deltaZ = -2.0;
  for (let frame = 0; frame < 10 && fighter.ledge.state === LedgeState.none; frame++) playPads(run, {}, {});
  assertEquals(fighter.ledge.state, LedgeState.hang);
});
