import { sweepSeed } from "../../runtime/sweep";


import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { AttackStyle, Character, DownState, LedgeState, SpecialAction } from "../sim/codes";
import { snapToLedge } from "../sim/ledge";
import { attackActive, attackStartup } from "../sim/conditions";
import { createFighter } from "../sim/fighter";
import { attackStartupFrames } from "../sim/moves";
import { type Controls, copyControls, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { createFrameControls } from "./controls";
import { captureFrame, createMatchFrameInput, executeMatchFrame } from "./frameInput";
import { createPacingAndPresentation } from "./pacingAndPresentation";
import { produceComputerInput } from "./botPlay";
import {
  Phase, copyMatchState, createMatchState, keepsStocks, requestStageSelect, requestStart, resolveStocks, selectCharacter,
  setHitAreas, setParticipants, setPartnerDamage, setTraining, stepPartnerBehaviour, stepPartnerEscape, stepPartnerTech, timedMatch,
} from "./rules";
import { matchSpawnX } from "./step";
import { canAct, latchPresses, releasePresses } from "./training";
import { Advantage, PartnerBehaviour, PartnerEscape, PartnerTech } from "./trainingState";
import { HitAreaKind, collectHitAreas, createHitAreaList } from "../presentation/hitAreas";
import { attackCapsule, emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { authoredHitRegion, emptyHitRegion } from "../sim/hitRegions";
import { HurtContact, fighterHurtParts, strikeHurtContact } from "../sim/hurtboxes";

const NEUTRAL = neutralControls();


function trainingMatch(behaviour: number, gap = 30.0, character: Character = Character.rifleman) {
  const world = createRoster(3, [createFighter(character, -gap / 2, 1), createFighter(character, gap / 2, -1)]);
  const game = createMatchState();
  game.phase = Phase.match;
  game.stageChoice = 0;
  game.humanMask = 1;
  game.humanFighterMask = 1;
  game.computerMask = 2;
  game.training = true;
  game.trainer.behaviour = behaviour;
  const produced = createFrameControls();
  const controls = createFrameControls();
  const runtime = createPacingAndPresentation();
  const row = createMatchFrameInput();
  const step = (player?: (input: Controls, frame: number) => void) => {
    const frame = runtime.simulationFrame + 1;
    for (const slot of PARTICIPANT_SLOTS) {
      if (!isActive(world, slot)) continue;
      copyControls(produced.inputs[slot], NEUTRAL);
      clearAttackBuffer(produced.commands[slot]);
      if (slot === 1) produceComputerInput(game, world, runtime, 1, frame, produced.inputs[1], produced.commands[1]);
      else player?.(produced.inputs[0], frame);
    }
    assertTrue(captureFrame(row, frame, world.mask, produced, runtime));
    assertTrue(executeMatchFrame(row, game, world, controls, runtime, frame));
  };
  const jab = () => step((_, frame) => queueAttack(produced.commands[0], { style: AttackStyle.jab, facing: 1, frame, mayCharge: false }));
  const until = (done: () => boolean, frames: number) => {
    for (let i = 0; i < frames && !done(); i++) step();
    assertTrue(done());
  };
  return { world, game, produced, runtime, step, jab, until, player: fighterAt(world, 0), partner: fighterAt(world, 1) };
}


function escapeDirection(escape: number, hitSerial: number): number {
  const match = trainingMatch(PartnerBehaviour.stand, 30.0);
  match.game.trainer.escape = escape;
  const { partner, world, game, runtime, produced } = match;
  partner.launch.hitlag = 1;
  partner.launch.diPending = true;
  partner.hits.lastAttacker = 0;
  partner.visuals.hit = hitSerial;
  produceComputerInput(game, world, runtime, 1, 1, produced.inputs[1], produced.commands[1]);
  return produced.inputs[1].direction;
}


function techOutcome(tech: number, hitSerial = 1): { state: number; direction: number } {
  const match = trainingMatch(PartnerBehaviour.stand, 120.0);
  match.game.trainer.tech = tech;
  const { partner } = match;
  partner.down.state = DownState.tumble;
  partner.launch.hitstun = 30;
  partner.motion.grounded = false;
  partner.motion.surface = undefined;
  partner.motion.z = f32(partner.motion.z + 150.0);
  partner.hits.lastAttacker = 0;
  partner.visuals.hit = hitSerial;
  match.until(() => partner.down.state !== DownState.tumble, 240);
  return { state: partner.down.state, direction: partner.down.direction };
}

test("readoutShowsTheMoveAndTheAdvantageOnShieldAndOnHit [k1 scenario]", () => {
  for (const behaviour of [PartnerBehaviour.shield, PartnerBehaviour.stand]) {
    const match = trainingMatch(behaviour, 24.0);
    const { player, partner, game } = match;
    for (let i = 0; i < 12; i++) match.step();
    match.jab();
    assertEquals(game.trainer.moveStyle, AttackStyle.jab);
    assertEquals(game.trainer.moveStartup, attackStartupFrames(AttackStyle.jab, player.tuning.moves) + 1);
    assertEquals(game.trainer.moveStartup, attackStartup(player, AttackStyle.jab) + 1);
    assertEquals(game.trainer.moveActive, attackActive(player, AttackStyle.jab));
    assertEquals(game.trainer.moveTotal, player.attack.duration);

    let contact = -1;
    let playerReady = -1;
    let partnerReady = -1;
    for (let frame = 0; frame < 200 && (playerReady < 0 || partnerReady < 0); frame++) {
      const hits = partner.visuals.hit + partner.visuals.shield;
      match.step();
      if (partner.visuals.hit + partner.visuals.shield !== hits) {
        contact = frame;
        playerReady = -1;
        partnerReady = -1;
        continue;
      }
      if (contact < 0) continue;
      if (playerReady < 0 && canAct(player)) playerReady = frame - contact;
      if (partnerReady < 0 && canAct(partner)) partnerReady = frame - contact;
    }
    assertTrue(contact >= 0);
    assertEquals(game.trainer.advantageKind, behaviour === PartnerBehaviour.shield ? Advantage.shield : Advantage.hit);
    assertEquals(game.trainer.advantage, partnerReady - playerReady);
  }
});
