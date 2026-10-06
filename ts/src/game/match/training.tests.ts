// Training (#120): partner behaviours, escapes and techs, the frame readout,
// the combo counter and the reset, through the frame executor.
import { assertEquals, assertFalse, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { clearAttackBuffer, queueAttack } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { stateChecksum } from "../replay/canonical";
import { firstStateDifference } from "../replay/difference";
import { AttackStyle, Character, DownState } from "../sim/codes";
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
import { canAct } from "./training";
import { Advantage, PartnerBehaviour, PartnerEscape, PartnerTech } from "./trainingState";
import { HitAreaKind, collectHitAreas, createHitAreaList } from "../presentation/hitAreas";
import { attackCapsule, emptyCapsule, placeCapsule } from "../physics/contactGeometry";
import { authoredHitRegion, emptyHitRegion } from "../sim/hitRegions";
import { HurtContact, fighterHurtParts, strikeHurtContact } from "../sim/hurtboxes";
import { trainingReadout } from "../shell/messages";

const NEUTRAL = neutralControls();

/** A player in slot 0 and the partner (a computer) in slot 1, `gap` apart on the test deck, in training. */
function trainingMatch(behaviour: number, gap = 30.0, character = Character.rifleman) {
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

test("trainingIsARuleAtFighterSelectionWithNoClockOrLostStocks", () => {
  const game = createMatchState();
  setParticipants(game, 1, 2);
  selectCharacter(game, 0, Character.rifleman);
  setTraining(game, 0, true);
  stepPartnerBehaviour(game, 0, 1);
  stepPartnerBehaviour(game, 0, -2);
  stepPartnerEscape(game, 0, -1);
  stepPartnerTech(game, 0, 2);
  setPartnerDamage(game, 0, 120);
  setPartnerDamage(game, 0, 125);
  setPartnerDamage(game, 0, 310);
  setHitAreas(game, 0, true);
  setHitAreas(game, 1, false);
  assertEquals(game.trainer.behaviour, PartnerBehaviour.fight);
  assertEquals(game.trainer.escape, PartnerEscape.random);
  assertEquals(game.trainer.tech, PartnerTech.toward);
  assertEquals(game.trainer.damage, 120);
  assertTrue(game.trainer.showHitAreas);
  assertTrue(requestStageSelect(game, 0));
  assertTrue(requestStart(game, 0));
  assertTrue(game.training);
  assertFalse(game.practice);
  assertFalse(timedMatch(game));
  assertTrue(keepsStocks(game));
  setTraining(game, 0, false);
  assertTrue(game.training);
  const world = createRoster(3, [createFighter(0, 0, 1), createFighter(1, 0, -1)]);
  fighterAt(world, 1).status.stocks = 0;
  resolveStocks(game, world);
  assertEquals(game.phase, Phase.match);
  const copy = createMatchState();
  copyMatchState(copy, game);
  assertEquals(copy.trainer.damage, 120);
  assertTrue(copy.training);
});

test("trainingStateIsInTheChecksumOnlyInTraining", () => {
  const match = trainingMatch(PartnerBehaviour.stand);
  const state = { world: match.world, match: match.game, controls: createFrameControls(), runtime: match.runtime };
  const before = stateChecksum(state);
  const other = trainingMatch(PartnerBehaviour.stand);
  const otherState = { world: other.world, match: other.game, controls: createFrameControls(), runtime: other.runtime };
  match.game.trainer.comboHits = 3;
  assertTrue(stateChecksum(state) !== before);
  assertEquals(firstStateDifference(otherState, state), "match.trainer.comboHits");
  match.game.training = false;
  other.game.training = false;
  assertEquals(stateChecksum(state), stateChecksum(otherState));
});

test("partnerBehaviours", () => {
  const stand = trainingMatch(PartnerBehaviour.stand, 200.0);
  for (let i = 0; i < 60; i++) stand.step();
  assertTrue(stand.partner.motion.grounded && !stand.partner.shield.raised && !stand.partner.motion.crouching && stand.partner.attack.serial === 0);
  const shield = trainingMatch(PartnerBehaviour.shield, 200.0);
  shield.until(() => shield.partner.shield.raised, 20);
  const crouch = trainingMatch(PartnerBehaviour.crouch, 200.0);
  crouch.until(() => crouch.partner.motion.crouching, 20);
  const jump = trainingMatch(PartnerBehaviour.jump, 200.0);
  jump.until(() => !jump.partner.motion.grounded, 20);
  jump.until(() => jump.partner.motion.grounded, 200);
  jump.until(() => !jump.partner.motion.grounded, 40);
  const attack = trainingMatch(PartnerBehaviour.attack, 200.0);
  attack.until(() => attack.partner.attack.serial >= 3, 200);
  assertEquals(attack.partner.attack.style ?? AttackStyle.jab, AttackStyle.jab);
  // Fight hands every frame to the computer, which closes the distance.
  const fight = trainingMatch(PartnerBehaviour.fight, 300.0);
  const start = fight.partner.motion.x;
  for (let i = 0; i < 90; i++) fight.step();
  assertTrue(fight.partner.motion.x < start - 20.0 || fight.partner.attack.serial > 0);
});

/** The stick the partner holds on its hitlag's last frame for each escape. */
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

test("partnerEscapes", () => {
  // The player stands to the partner's left.
  assertEquals(escapeDirection(PartnerEscape.toward, 1), -1);
  assertEquals(escapeDirection(PartnerEscape.away, 1), 1);
  assertEquals(escapeDirection(PartnerEscape.none, 1), 0);
  let toward = 0;
  let away = 0;
  for (let hit = 1; hit <= 40; hit++) {
    const direction = escapeDirection(PartnerEscape.random, hit);
    assertEquals(escapeDirection(PartnerEscape.random, hit), direction);
    if (direction < 0) toward++;
    else if (direction > 0) away++;
  }
  assertEquals(toward + away, 40);
  assertGreaterThan(toward, 5);
  assertGreaterThan(away, 5);
});

/** Where a tumbling partner ends up: its down state and roll direction once it lands. */
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

test("partnerTechs", () => {
  assertEquals(techOutcome(PartnerTech.none).state, DownState.bound);
  assertEquals(techOutcome(PartnerTech.inPlace).state, DownState.tech);
  // The player stands to the partner's left: toward rolls left, away rolls right.
  const toward = techOutcome(PartnerTech.toward);
  assertEquals(toward.state, DownState.techRoll);
  assertEquals(toward.direction, -1);
  const away = techOutcome(PartnerTech.away);
  assertEquals(away.state, DownState.techRoll);
  assertEquals(away.direction, 1);
  const seen: boolean[] = [false, false, false];
  for (let hit = 1; hit <= 12; hit++) {
    const outcome = techOutcome(PartnerTech.random, hit);
    assertTrue(outcome.state === DownState.tech || outcome.state === DownState.techRoll);
    seen[outcome.state === DownState.tech ? 0 : outcome.direction < 0 ? 1 : 2] = true;
  }
  assertEquals(seen.join(), "true,true,true");
});

test("readoutShowsTheMoveAndTheAdvantageOnShieldAndOnHit", () => {
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
    // Count independently: frames from the contact until each fighter can act.
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

test("comboCountsOnlyHitsThePartnerCouldNotActBetween", () => {
  const match = trainingMatch(PartnerBehaviour.stand, 24.0);
  const { game, partner } = match;
  for (let i = 0; i < 12; i++) match.step();
  match.jab();
  match.until(() => game.trainer.comboHits === 1, 30);
  const first = game.trainer.comboDamage;
  assertGreaterThan(first, 0.0);
  assertTrue(game.trainer.comboOpen);
  match.until(() => canAct(partner) && !game.trainer.comboOpen, 120);
  // A second hit after the partner could act starts a new combo.
  match.until(() => canAct(match.player), 120);
  match.jab();
  match.until(() => partner.visuals.hit === 2, 30);
  assertEquals(game.trainer.comboHits, 1);
  // A hit while the partner still cannot act adds to the combo.
  const third = trainingMatch(PartnerBehaviour.stand, 24.0);
  for (let i = 0; i < 12; i++) third.step();
  third.jab();
  third.until(() => third.game.trainer.comboHits === 1, 30);
  third.until(() => third.partner.launch.hitlag === 0, 30);
  assertTrue(third.game.trainer.comboOpen);
  // Held frozen (as by a trap), it cannot act before the next hit.
  third.partner.status.frozenFrames = 200;
  third.until(() => canAct(third.player), 120);
  third.jab();
  third.until(() => third.partner.visuals.hit === 2, 30);
  assertEquals(third.game.trainer.comboHits, 2);
  assertEquals(third.game.trainer.comboDamage, f32(first + first));
});

test("bothShieldsAndAttackResetEveryFighterAndThePartnersDamage", () => {
  const match = trainingMatch(PartnerBehaviour.stand, 24.0);
  match.game.trainer.damage = 80;
  for (let i = 0; i < 12; i++) match.step();
  match.jab();
  match.until(() => match.partner.visuals.hit === 1, 30);
  for (let i = 0; i < 30; i++) match.step();
  match.step(input => { input.resetPressed = true; });
  assertEquals(match.partner.status.damage, f32(80.0));
  assertEquals(match.game.trainer.comboHits, 0);
  assertEquals(match.game.trainer.moveStyle, -1);
  for (const slot of [0, 1]) assertEquals(fighterAt(match.world, slot).motion.x, matchSpawnX(slot));
});

test("hitAreasListTheBodyAndTheActiveStrikesContactUses", () => {
  const match = trainingMatch(PartnerBehaviour.stand, 200.0);
  const { player } = match;
  const list = createHitAreaList();
  collectHitAreas(player, list);
  const parts = fighterHurtParts(player);
  assertEquals(list.count, parts.length);
  match.jab();
  const startup = attackStartup(player, AttackStyle.jab);
  while (player.attack.frame < startup) match.step();
  collectHitAreas(player, list);
  const strikes = list.areas.slice(0, list.count).filter(area => area.kind === HitAreaKind.strike);
  assertGreaterThan(strikes.length, 0);
  const region = emptyHitRegion();
  authoredHitRegion(region, player.character, AttackStyle.jab, player.attack.frame, 0, 0, player.tuning.moves);
  const expected = placeCapsule(emptyCapsule(), attackCapsule(emptyCapsule(), AttackStyle.jab, region), player.motion.x, player.motion.z, player.facing);
  const strike = strikes[0]?.capsule;
  assertTrue(strike !== undefined && strike.x1 === expected.x1 && strike.z1 === expected.z1 && strike.x2 === expected.x2 && strike.z2 === expected.z2 && strike.radius === expected.radius);
  // A target standing in the drawn strike is hit by it.
  const target = createFighter(Character.rifleman, f32((expected.x1 + expected.x2) / 2.0), -1);
  target.motion.z = player.motion.z;
  assertEquals(strikeHurtContact(expected, target), HurtContact.hit);
});

test("readoutText", () => {
  const state = createMatchState().trainer;
  assertEquals(trainingReadout(state), "");
  state.moveStyle = AttackStyle.forwardSmash;
  state.moveStartup = 12;
  state.moveActive = 3;
  state.moveTotal = 40;
  state.advantage = -8;
  state.advantageKind = Advantage.shield;
  state.comboHits = 3;
  state.comboDamage = f32(27.5);
  assertEquals(trainingReadout(state), "Forward smash: hits on frame 12 · 3 active · 40 total\n-8 on shield\nCombo: 3 hits · 27%");
});
