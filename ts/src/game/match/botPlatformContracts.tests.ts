import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { clearAttackBuffer } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { Character, PlatformMove } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";
import { produceComputerInput } from "./botPlay";
import { createFrameControls } from "./controls";
import type { CpuTier } from "./cpuProfiles";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState } from "./rules";

const NEUTRAL = neutralControls();
const STAGE = 1;
const DECK = 1;
const FRAMES = 900;

interface PlatformUse { climbs: number; stands: number; wraps: number; drops: number; }

type Layout = "under" | "aboveTarget" | "aboveBelowTarget";

/** An idle opponent stands on a side platform (or below it); the computer starts under the platform or falling onto it: the platform moves it makes. */
function platformUse(tier: CpuTier, layout: Layout): PlatformUse {
  const deckX = (surfaceLeft(STAGE, DECK, 0) + surfaceRight(STAGE, DECK, 0)) / 2;
  const opponent = createFighter(Character.rifleman, deckX, 1);
  if (layout !== "aboveBelowTarget") {
    opponent.motion.z = surfaceZ(STAGE, DECK, 0);
    opponent.motion.surface = DECK;
  }
  const computer = createFighter(Character.rifleman, deckX + 60.0, -1);
  if (layout !== "under") {
    computer.motion.z = surfaceZ(STAGE, DECK, 0) + 900.0;
    computer.motion.grounded = false;
  }
  const world = createRoster(3, [opponent, computer]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = STAGE;
  match.timeLimitMinutes = 0;
  match.cpuOpponents[1] = "wren";
  match.cpuResolvedOpponents[1] = "wren";
  match.cpuTiers[1] = tier;
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const c = fighterAt(world, 1);
  const use: PlatformUse = { climbs: 0, stands: 0, wraps: 0, drops: 0 };
  let previous: number = c.platform.move;
  let previousGrounded = c.motion.grounded;
  for (let i = 1; i <= FRAMES; i++) {
    const frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      if (slot === 1) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
    }
    assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
    assertTrue(executeMatchFrame(row, match, world, controls, runtime, frame));
    const move = c.platform.move;
    if (move !== previous) {
      if (move === PlatformMove.ascent) use.climbs++;
      if (move === PlatformMove.wrapOver) use.wraps++;
      if (move === PlatformMove.descent && !previousGrounded) use.drops++;
    }
    if (previous === PlatformMove.ascent && move === PlatformMove.none && c.motion.grounded) use.stands++;
    previous = move;
    previousGrounded = c.motion.grounded;
  }
  return use;
}

test("expert computers climb, wrap to cross up and drop through platforms; rookies climb and stand only [spec #392]", () => {
  const under = platformUse("expert", "under");
  assertGreaterThan(under.climbs, 0);
  assertGreaterThan(under.wraps, 0);
  assertGreaterThan(platformUse("expert", "aboveTarget").wraps, 0);
  assertGreaterThan(platformUse("expert", "aboveBelowTarget").drops, 0);
  for (const layout of ["under", "aboveTarget", "aboveBelowTarget"] as const) {
    const rookie = platformUse("rookie", layout);
    assertEquals(rookie.wraps + rookie.drops, 0);
    assertEquals(rookie.stands, rookie.climbs);
  }
});
