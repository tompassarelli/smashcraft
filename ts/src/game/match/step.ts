import { clearAttackBuffer, copyAttackBuffer, hasPendingAttack, holdAttack, takeAttack } from "../input/attackBuffer";
import { attackStyleForGrounding } from "../input/combat";
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS, type Slots, participantActive } from "../input/participants";
import { pushFighterBodies } from "../sim/bodyPush";
import { beginFighterAttack, resolveAttacks } from "../sim/attacks";
import { AttackStyle, DASH_GRAB_REQUEST } from "../sim/codes";
import { clearDash } from "../sim/groundMovement";
import { canStartAttackStyle, inGrabContext } from "../sim/conditions";
import { collectLavaContacts } from "../sim/lava";
import { beginDamageContacts, finishDamageContacts } from "../sim/contacts";
import { advanceGrabs, captureGrabPauses, resolveGrabs } from "../sim/grabs";
import { resolveLedges } from "../sim/ledge";
import { carryOnMovingDecks } from "../sim/movingDecks";
import { observedActions, resetObservedActions } from "../sim/observations";
import { updateProjectiles } from "../sim/projectiles";
import { advancePlacedObjects } from "../sim/placedObjects";
import { type Roster, copyControls, fighterAt, isActive, neutralControls } from "../sim/roster";
import { regenerateShield } from "../sim/shield";
import { advanceSpecials, startFighterSpecial } from "../sim/specials";
import { advanceHeroStatus } from "../sim/heroSpecialRules";
import { advanceItemBuff } from "../sim/itemBuffs";
import { advanceFighterMotion } from "../sim/step";
import { maskHeroStatusControls } from "../sim/heroStatus";
import { platformSpecialInput } from "../sim/platformMoves";
import { advanceStageCannon } from "../sim/stageHazards";
import { advanceWater, collectHydraContacts } from "../sim/water";
import { surfaceCount, surfaceLine, surfaceZAt } from "../sim/stage";
import { setWorldMotionValue } from "../sim/motion";
import { advanceFreezeTraps } from "../sim/summons";
import { steppedFrames } from "./frameCount";
import { advanceMatchCamera } from "../sim/matchCamera";
import { nextJab } from "../sim/moves";
import { advanceOffscreenDamage } from "../sim/offscreenDamage";
import type { FrameControls } from "./controls";
import { copyFighterState } from "../replay/fighterState";
import { type MatchState, Phase, advanceClock, holdingStart, humanFighterActive, keepsStocks, resolveStocks, stageClock } from "./rules";
import { advanceItems } from "./centreItem";
import { advanceMeterDrops } from "./meterDrops";

import { bossClock, collectBossContacts, strikeBoss } from "../classic/bosses";
import { applyConfiguredStart, settleConfiguredMatch, trackConfiguredFrame } from "../classic/configuredMatch";
import { BossKind } from "../classic/runState";
import { advanceTrainingReadout, captureTrainingBefore, resetTrainingPositions } from "./training";
import { advanceTutorial, beginLesson, captureTutorialBefore, tutorialOn } from "./tutorial";

export const observedFrameLegalActions: Slots<number> = [0, 0, 0, 0];
export const observedFrameStartedActions: Slots<number> = [0, 0, 0, 0];


export function clearObservedActions(): void {
  observedFrameLegalActions.fill(0);
  observedFrameStartedActions.fill(0);
}


const hadDashGrabWindow: Slots<boolean> = [false, false, false, false];
const wasGrabbed: Slots<boolean> = [false, false, false, false];
const beforeOut: Slots<boolean> = [false, false, false, false];
const HELD = neutralControls();

export function initializeMatchFighters(game: Readonly<MatchState>, world: Roster): void {
  game.camera.initialized = false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const absent = game.practice && !humanFighterActive(game, slot);
    const fighter = fighterAt(world, slot);
    fighter.status.stocks = absent ? 0 : game.stockCount;
    fighter.status.out = absent;
    if (game.training && participantActive(game.computerMask, slot)) fighter.status.damage = f32(game.trainer.damage);

    const { motion } = fighter;
    if (motion.grounded && surfaceCount(game.stageChoice) > 0 && surfaceLine(game.stageChoice, 0) !== undefined) {
      motion.surface = 0;
      motion.z = surfaceZAt(game.stageChoice, 0, game.matchFrame, motion.x);
      setWorldMotionValue(motion.meleeZ, motion.z);
    }
  }
  applyConfiguredStart(game, world);
}


const matchEnded = (game: Readonly<MatchState>): boolean => game.phase === Phase.result;


function resolveBossFight(game: MatchState, world: Roster): void {
  const { run } = game;
  if (game.phase !== Phase.match) return;
  const playerOut = !isActive(world, run.player) || fighterAt(world, run.player).status.stocks <= 0;
  if (run.boss.health > 0 && !playerOut) return;
  game.winner = run.boss.health <= 0 && !playerOut ? run.player : undefined;
  game.phase = Phase.result;
}

export function matchSpawnX(slot: number, participantMask = 0): number {
  if (participantMask !== 0) {
    let first = -1;
    let count = 0;
    for (const participant of PARTICIPANT_SLOTS) {
      if (!participantActive(participantMask, participant)) continue;
      if (first < 0) first = participant;
      count++;
    }
    if (count === 2) return slot === first ? -240.0 : 240.0;
  }
  if (slot === 0) return -240.0;
  if (slot === 1) return 240.0;
  return slot === 2 ? -80.0 : 80.0;
}


function requestedStyle(style: number | undefined): AttackStyle | undefined {
  switch (style) {
    case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7: case 8: case 9: case 10: return style;
    default: return undefined;
  }
}







export interface StepScope {
  slot: number;
  after: Readonly<{ world: Roster; controls: FrameControls }>;
}

export function stepMatch(game: MatchState, world: Roster, controls: FrameControls, frame: number, scope?: Readonly<StepScope>): void {
  if (game.phase !== Phase.match) return;
  steppedFrames.count++;
  game.matchFrame++;
  const stage = game.stageChoice;
  const stageFrame = stageClock(game);

  if (holdingStart(game)) {
    for (const slot of PARTICIPANT_SLOTS) {
      copyControls(controls.inputs[slot], HELD);
      clearAttackBuffer(controls.commands[slot]);
    }
  }
  if (game.training) {

    if (PARTICIPANT_SLOTS.some(slot => isActive(world, slot) && humanFighterActive(game, slot) && controls.inputs[slot].resetPressed)) {
      resetTrainingPositions(game.trainer, world, game.computerMask, matchSpawnX);
      for (const slot of PARTICIPANT_SLOTS) clearAttackBuffer(controls.commands[slot]);
    }
    captureTrainingBefore(world);
    if (tutorialOn(game.trainer)) {

      if (game.matchFrame === 1) beginLesson(game.trainer, world, game.computerMask, game.trainer.lesson);
      captureTutorialBefore(world);
    }
  }
  const mask = world.mask;
  if (scope !== undefined) world.mask = 1 << scope.slot;
  carryOnMovingDecks(world, stage, stageFrame);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    observedFrameLegalActions[slot] = 0;
    observedFrameStartedActions[slot] = 0;
    beforeOut[slot] = f.status.out;
    maskHeroStatusControls(f, controls.inputs[slot], controls.commands[slot]);
    hadDashGrabWindow[slot] = f.ground.dashGrabWindow > 0 && f.status.frozenFrames === 0 && f.launch.hitlag <= 1;
    wasGrabbed[slot] = inGrabContext(f);
    if (wasGrabbed[slot]) clearAttackBuffer(controls.commands[slot]);
    controls.inputs[slot].attackRequested = hasPendingAttack(controls.commands[slot], frame) && f.status.frozenFrames === 0;
  }
  resolveLedges(world, stage, controls.inputs);
  pushFighterBodies(world);

  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    resetObservedActions();
    const f = fighterAt(world, slot);
    const pending = controls.commands[slot].pending;
    const jumpCancel = pending?.style === AttackStyle.grab && hasPendingAttack(controls.commands[slot], frame) && f.motion.grounded && canStartAttackStyle(f, AttackStyle.grab) && (f.jump.squat > 0 || controls.inputs[slot].jumpPressed);
    if (jumpCancel) {
      f.jump.squat = 0;
      f.jump.dodgeQueued = false;
      f.jump.dodgeX = 0;
      f.jump.dodgeZ = 0;
      clearDash(f);
      f.ground.dashGrabWindow = 0;
      controls.inputs[slot].jumpPressed = false;
    }
    advanceFighterMotion(world, slot, stage, stageFrame, controls.inputs[slot], matchSpawnX(slot));
    if (jumpCancel) clearDash(f);
    observedFrameLegalActions[slot] = observedActions.legal;
    observedFrameStartedActions[slot] = observedActions.started;
  }
  advanceWater(world, stage, game.matchFrame, game.hazards);
  advanceItems(game, world, controls, frame);
  advanceMeterDrops(game, world);
  advanceStageCannon(world, stage, stageFrame, controls.inputs);

  captureGrabPauses(world);
  resolveGrabs(world);
  beginDamageContacts();
  collectLavaContacts(world, stage, stageFrame);
  collectHydraContacts(world, stage, game.matchFrame);
  const bossFight = game.run.active && game.run.boss.kind !== BossKind.none;
  if (bossFight && !holdingStart(game)) collectBossContacts(game.run.boss, world, bossClock(game.matchFrame, game.startHold), game.run.player);
  advanceGrabs(world, controls.inputs);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot) || wasGrabbed[slot]) continue;
    resetObservedActions();
    const special = fighterAt(world, slot);
    if (game.ultimatesOff) controls.inputs[slot].ultimatePressed = false;
    const started = startFighterSpecial(special, stage, stageFrame, platformSpecialInput(special, controls.inputs[slot]), world);
    observedFrameLegalActions[slot] |= observedActions.legal;
    if (started) observedFrameStartedActions[slot] |= 64;
  }
  advanceFreezeTraps(world);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    const commands = controls.commands[slot];
    if (f.status.frozenFrames > 0) clearAttackBuffer(commands);

    if (f.launch.hitlag > 0 && f.shield.perfectActionFrames > 0) holdAttack(commands, frame);

    if (f.launch.hitlag > 0 && commands.pending?.style === AttackStyle.jab && nextJab(f.attack.style) !== undefined) holdAttack(commands, frame);
    if (commands.pending?.style === AttackStyle.grab && f.shield.raised && (f.launch.hitlag > 0 || f.shield.stun > 0 || f.shield.drainResumePending)) holdAttack(commands, frame);
    const command = takeAttack(commands, frame, canStartAttackStyle(f, requestedStyle(commands.pending?.style)));
    const dashGrabInput = f.motion.grounded && f.ground.dashFrame > 0 && f.tuning.dashGrab.startupFrames > 0 && command?.style === AttackStyle.grab;
    const catchDash = f.ground.dashGrabWindow > 0 && command?.style === AttackStyle.grab && f.tuning.dashGrab.startupFrames > 0;
    const style = dashGrabInput || catchDash ? DASH_GRAB_REQUEST : attackStyleForGrounding(requestedStyle(command?.style), f.motion.grounded, f.facing, command?.facing ?? 0);
    if (catchDash) f.ground.dashGrabWindow = 0;
    if (f.motion.grounded && style !== undefined && command !== undefined && command.facing !== 0) f.facing = command.facing;
    const serial = f.attack.serial;
    const actionBits = style === AttackStyle.grab || style === DASH_GRAB_REQUEST ? 160 : 32;
    if (style !== undefined && canStartAttackStyle(f, style)) observedFrameLegalActions[slot] |= actionBits;
    beginFighterAttack(world, slot, style, command?.mayCharge === true && controls.inputs[slot].attackHeld);
    if (f.attack.serial !== serial) observedFrameStartedActions[slot] |= actionBits;
    if (hadDashGrabWindow[slot] && f.ground.dashGrabWindow > 0 && !f.attack.dashGrab) f.ground.dashGrabWindow = Math.max(0, f.ground.dashGrabWindow - 1);
  }
  resolveAttacks(world);
  if (bossFight) strikeBoss(game.run.boss, world, bossClock(game.matchFrame, game.startHold), game.run.player);
  advanceSpecials(world, stage, stageFrame, controls.inputs);
  updateProjectiles(world, stage, stageFrame);
  advancePlacedObjects(world);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    regenerateShield(f);
    advanceHeroStatus(f);
    advanceItemBuff(f);
  }
  finishDamageContacts(world);
  resolveGrabs(world);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    if (inGrabContext(f)) clearAttackBuffer(controls.commands[slot]);
    if (keepsStocks(game) && f.status.out && !beforeOut[slot]) {
      f.status.stocks = game.stockCount;
      f.status.respawn = 60;
    }
  }
  if (scope !== undefined) {
    world.mask = mask;
    for (const slot of PARTICIPANT_SLOTS) {
      if (slot === scope.slot || !isActive(world, slot)) continue;
      copyFighterState(fighterAt(world, slot), fighterAt(scope.after.world, slot), mask);
      copyAttackBuffer(controls.commands[slot], scope.after.controls.commands[slot]);
    }
  }
  if (bossFight) resolveBossFight(game, world);
  else resolveStocks(game, world);
  advanceMatchCamera(game.camera, world, game.stageChoice);
  advanceOffscreenDamage(world, game.camera, game.practice || game.training, scope === undefined ? mask : 1 << scope.slot);
  if (game.training) advanceTrainingReadout(game.trainer, world, game.humanFighterMask, game.computerMask);
  if (game.training && tutorialOn(game.trainer)) advanceTutorial(game.trainer, world, game.humanFighterMask, game.computerMask);
  advanceClock(game, world);
  if (game.run.active) {
    trackConfiguredFrame(game, world);
    if (matchEnded(game)) settleConfiguredMatch(game, world);
  }
}
