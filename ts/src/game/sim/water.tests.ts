// The Tomb of Sargeras sea (smashcraft:docs/design/water-stage.md, #277):
// the tide's timetable and push, floating, swimming, the water jump and the
// hydra, each pinned to the design's numbers.
import { assertEquals, assertNear, test } from "wisp/src/runtime/testing";
import { FROZEN_THRONE_STAGE, TOMB_OF_SARGERAS_STAGE } from "./stage";
import { SEA_SURFACE_Z, TIDE_SPEED, framesUntilTideTurns, seaLeft, seaRight, tideDirection, tideNextDirection, tidePush } from "./stageHazards";

const TOMB = TOMB_OF_SARGERAS_STAGE;
const UNDER = SEA_SURFACE_Z - 10.0;

test("the tide pushes 4.8 a frame right through frame 540, is slack from 541, pushes left from 601 and right again from 1201 [spec docs/design/water-stage.md]", () => {
  assertNear(TIDE_SPEED, 4.800000190734863, 0.0010000000474974513);
  assertEquals(tidePush(TOMB, 1, 0.0, UNDER), TIDE_SPEED);
  assertEquals(tidePush(TOMB, 540, 0.0, UNDER), TIDE_SPEED);
  assertEquals(tidePush(TOMB, 541, 0.0, UNDER), 0.0);
  assertEquals(tidePush(TOMB, 600, 0.0, UNDER), 0.0);
  assertEquals(tidePush(TOMB, 601, 0.0, UNDER), -TIDE_SPEED);
  assertEquals(tidePush(TOMB, 1140, 0.0, UNDER), -TIDE_SPEED);
  assertEquals(tidePush(TOMB, 1141, 0.0, UNDER), 0.0);
  assertEquals(tidePush(TOMB, 1201, 0.0, UNDER), TIDE_SPEED);
  // The slack names the coming direction and counts down to it.
  assertEquals(tideDirection(541), 0);
  assertEquals(tideNextDirection(541), -1);
  assertEquals(framesUntilTideTurns(541), 60);
  assertEquals(framesUntilTideTurns(600), 1);
  assertEquals(framesUntilTideTurns(601), 0);
  assertEquals(tideNextDirection(1141), 1);
});

test("the sea spans blast line to blast line below z -360 on the Tomb only; the deck and the air above the surface are never pushed [spec docs/design/water-stage.md]", () => {
  assertNear(seaLeft(TOMB), -1562.5999755859375, 0.10000000149011612);
  assertNear(seaRight(TOMB), 1562.5999755859375, 0.10000000149011612);
  assertEquals(tidePush(TOMB, 1, 1500.0, SEA_SURFACE_Z), TIDE_SPEED);
  assertEquals(tidePush(TOMB, 1, 0.0, SEA_SURFACE_Z + 1.0), 0.0);
  assertEquals(tidePush(TOMB, 1, 0.0, 0.0), 0.0);
  assertEquals(tidePush(FROZEN_THRONE_STAGE, 1, 0.0, UNDER), 0.0);
});
