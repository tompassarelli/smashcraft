import { clearAttackBuffer, hasPendingAttack, holdAttack, takeAttack } from "../input/attackBuffer";
import { attackStyleForGrounding } from "../input/combat";
import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";
import { beginFighterAttack, resolveAttacks } from "../sim/attacks";
import { AttackStyle, DASH_GRAB_REQUEST } from "../sim/codes";
import { canStartAttackStyle, inGrabContext } from "../sim/conditions";
import { beginDamageContacts, finishDamageContacts } from "../sim/contacts";
import { advanceGrabs, captureGrabPauses, resolveGrabs } from "../sim/grabs";
import { resolveLedges } from "../sim/ledge";
import { carryOnMovingDecks } from "../sim/movingDecks";
import { observedActions, resetObservedActions } from "../sim/observations";
import { updateProjectiles } from "../sim/projectiles";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { regenerateShield } from "../sim/shield";
import { advanceSpecials, startFighterSpecial } from "../sim/specials";
import { advanceHeroStatus, regenerateMana } from "../sim/heroSpecialRules";
import { advanceFighterMotion } from "../sim/step";
import { advanceStageCannon } from "../sim/stageHazards";
import { advanceFreezeTraps } from "../sim/summons";
import { advanceMatchCamera } from "../sim/matchCamera";
import { advanceOffscreenDamage } from "../sim/offscreenDamage";
import type { FrameControls } from "./controls";
import { type MatchState, Phase, advanceClock, humanFighterActive, resolveStocks } from "./rules";

export const observedFrameLegalActions: Slots<number> = [0, 0, 0, 0];
export const observedFrameStartedActions: Slots<number> = [0, 0, 0, 0];

// Preallocated: every match frame, including rollback, overwrites this scratch.
const hadDashGrabWindow: Slots<boolean> = [false, false, false, false];
const wasGrabbed: Slots<boolean> = [false, false, false, false];
const beforeOut: Slots<boolean> = [false, false, false, false];

export function initializeMatchFighters(game: Readonly<MatchState>, world: Roster): void {
  game.camera.initialized = false;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const absent = game.practice && !humanFighterActive(game, slot);
    const fighter = fighterAt(world, slot);
    fighter.status.stocks = absent ? 0 : game.stockCount;
    fighter.status.out = absent;
  }
}

export function matchSpawnX(slot: number): number {
  if (slot === 0) return -240.0;
  if (slot === 1) return 240.0;
  return slot === 2 ? -80.0 : 80.0;
}

/** Command buffers admit the eleven ground request codes. */
function requestedStyle(style: number | undefined): AttackStyle | undefined {
  switch (style) {
    case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7: case 8: case 9: case 10: return style;
    default: return undefined;
  }
}

export function stepMatch(game: MatchState, world: Roster, controls: FrameControls, frame: number): void {
  if (game.phase !== Phase.match) return;
  game.matchFrame++;
  const { stageChoice: stage, matchFrame } = game;
  carryOnMovingDecks(world, stage, matchFrame);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    observedFrameLegalActions[slot] = 0;
    observedFrameStartedActions[slot] = 0;
    beforeOut[slot] = f.status.out;
    hadDashGrabWindow[slot] = f.ground.dashGrabWindow > 0 && f.status.frozenFrames === 0 && f.launch.hitlag <= 1;
    wasGrabbed[slot] = inGrabContext(f);
    if (wasGrabbed[slot]) clearAttackBuffer(controls.commands[slot]);
    controls.inputs[slot].attackRequested = hasPendingAttack(controls.commands[slot], frame) && f.status.frozenFrames === 0;
  }
  resolveLedges(world, stage, controls.inputs);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    resetObservedActions();
    advanceFighterMotion(world, slot, stage, matchFrame, controls.inputs[slot], matchSpawnX(slot));
    observedFrameLegalActions[slot] = observedActions.legal;
    observedFrameStartedActions[slot] = observedActions.started;
  }
  advanceStageCannon(world, stage, matchFrame, controls.inputs);
  captureGrabPauses(world);
  resolveGrabs(world);
  beginDamageContacts();
  advanceGrabs(world, controls.inputs);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot) || wasGrabbed[slot]) continue;
    resetObservedActions();
    const started = startFighterSpecial(fighterAt(world, slot), stage, matchFrame, controls.inputs[slot]);
    observedFrameLegalActions[slot] |= observedActions.legal;
    if (started) observedFrameStartedActions[slot] |= 64;
  }
  advanceFreezeTraps(world);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    const commands = controls.commands[slot];
    if (f.status.frozenFrames > 0) clearAttackBuffer(commands);
    // An attack pressed during a parried hit's freeze waits for its first actionable frame.
    if (f.launch.hitlag > 0 && f.shield.perfectActionFrames > 0) holdAttack(commands, frame);
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
  advanceSpecials(world, stage, matchFrame, controls.inputs);
  updateProjectiles(world, stage, matchFrame);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    regenerateShield(f);
    regenerateMana(f);
    advanceHeroStatus(f);
  }
  finishDamageContacts(world);
  resolveGrabs(world);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    if (inGrabContext(f)) clearAttackBuffer(controls.commands[slot]);
    if ((game.practice || game.endless) && f.status.out && !beforeOut[slot]) {
      f.status.stocks = game.stockCount;
      f.status.respawn = 60;
    }
  }
  resolveStocks(game, world);
  advanceMatchCamera(game.camera, world, game.stageChoice);
  advanceOffscreenDamage(world, game.camera, game.practice);
  advanceClock(game, world);
}
