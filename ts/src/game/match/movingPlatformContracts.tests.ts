
import { assertEquals, assertFalse, assertGreaterThan, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState, LedgeState } from "../sim/codes";
import { fighterAt } from "../sim/roster";
import { DRIFTING_DECK_STAGE, PATTERNED_DECKS_STAGE, mainDeckRight, surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";
import { padMatch, playPads } from "./helperPads";
import { testMatch } from "./testMatch";

function onDeck(stage: number, deck: number, frame = 0) {
  const match = testMatch(3, Character.rifleman);
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


test("neutral and shielding controllers ride complete back-and-forth, loop and lift cycles [k1 scenario]", () => {
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
