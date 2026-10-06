// The computer opponent's contracts (#56): it never leaves the stage chasing
// an opponent who stands on it, it gets up from jab resets, and the same
// start plays the same match.
import { assertEquals, assertGreaterThan, assertLessThan, assertTrue, test } from "wisp/src/runtime/testing";
import { clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../input/participants";
import { stateChecksum } from "../replay/canonical";
import { AttackStyle, Character, DownState } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { surfaceLeft, surfaceRight } from "../sim/stage";
import { produceComputerInput } from "./botPlay";
import { createFrameControls } from "./controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { Phase, createMatchState } from "./rules";

const NEUTRAL = neutralControls();

/** A two-fighter match on `stage` where the slots in `computers` play themselves and the rest stand still unless `human` acts. */
function computerMatch(characters: readonly [Character, Character], xs: readonly [number, number], stage: number, computers: number) {
  const world = createRoster(3, [createFighter(characters[0], xs[0], xs[0] < xs[1] ? 1 : -1), createFighter(characters[1], xs[1], xs[1] < xs[0] ? 1 : -1)]);
  const match = createMatchState();
  match.phase = Phase.match;
  match.stageChoice = stage;
  match.timeLimitMinutes = 0;
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const step = (human?: (slot: ParticipantSlot, frame: number) => void) => {
    const frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      if ((computers & (1 << slot)) !== 0) produceComputerInput(match, world, runtime, slot, frame, produced.inputs[slot], produced.commands[slot]);
      else human?.(slot, frame);
    }
    assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
    assertTrue(executeMatchFrame(row, match, world, controls, runtime, frame));
  };
  return { world, match, controls, runtime, produced, step };
}

test("computerChasesToTheEdgeWithoutLeavingTheStage", () => {
  // The #12 soak's self-destruct: a computer chasing an opponent at the deck's edge ran off it.
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    for (const side of [-1, 1]) {
      const edge = side < 0 ? surfaceLeft(0, 0) : surfaceRight(0, 0);
      const game = computerMatch([Character.rifleman, character], [edge - side * 10.0, -side * 200.0], 0, 2);
      const computer = fighterAt(game.world, 1);
      for (let frame = 1; frame <= 480; frame++) {
        game.step();
        assertTrue(computer.motion.grounded || (computer.motion.x >= surfaceLeft(0, 0) && computer.motion.x <= surfaceRight(0, 0)));
      }
      assertEquals(computer.status.stocks, 3);
      assertGreaterThan(fighterAt(game.world, 0).visuals.hit, 0);
    }
  }
});

test("computerGetsUpUnderJabResets", () => {
  // A 5-damage jab on a lying fighter resets it; a computer that lay still was reset until time ran out.
  for (const character of [Character.archer, Character.rifleman, Character.demonHunter]) {
    const game = computerMatch([Character.rifleman, character], [-60.0, 0.0], 0, 2);
    const computer = fighterAt(game.world, 1);
    computer.status.damage = 100.0;
    computer.down.state = DownState.bound;
    computer.down.frame = 1;
    let resets = 0;
    const resetting = () => computer.down.state === DownState.damage;
    for (let frame = 1; frame <= 300; frame++) {
      const reset = resetting();
      game.step((slot, now) => queueAttack(game.produced.commands[slot], { style: AttackStyle.jab, facing: 1, frame: now, mayCharge: false }));
      if (resetting() && !reset) resets++;
    }
    assertGreaterThan(resets, 0);
    assertLessThan(resets, 3);
  }
});

test("computerMatchesRepeatFromTheSameStart", () => {
  for (const stage of [0, 1]) {
    const checksums: string[] = [];
    let landed = 0;
    for (let run = 0; run < 2; run++) {
      const game = computerMatch([Character.archer, Character.demonHunter], [-240.0, 240.0], stage, 3);
      for (let frame = 1; frame <= 600; frame++) game.step();
      checksums.push(stateChecksum(game));
      landed = fighterAt(game.world, 0).visuals.hit + fighterAt(game.world, 1).visuals.hit;
    }
    assertEquals(checksums[0], checksums[1]);
    assertGreaterThan(landed, 0);
  }
});
