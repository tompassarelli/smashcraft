// Training (#120, smashcraft:docs/design/training-mode.md): the partner's
// settings, its inputs, and the readout of the last move, the advantage after
// a hit or shielded hit, and the combo. All of it is synchronized match
// state: rollback copies it, the replay difference compares it and the
// checksum folds it while training is on.
import { f32 } from "wisp/src/sim/f32";
import { type AttackBuffer, queueAttack } from "../input/attackBuffer";
import type { Direction } from "../input/inputRow";
import { PARTICIPANT_SLOTS, type Slots, participantActive } from "../input/participants";
import { copyFighterState } from "../replay/fighterState";
import { AttackStyle, Character, DownState } from "../sim/codes";
import { attackActive, attackStartup, canAttack, canShieldGrab, isTumbling } from "../sim/conditions";
import { type Fighter, createFighter } from "../sim/fighter";
import { type Controls, type Roster, createRoster, fighterAt, isActive, neutralControls } from "../sim/roster";
import { advanceFighterMotion } from "../sim/step";
import { respawnFighter } from "../sim/stocks";
import { botChoice } from "./botMoves";
import { Advantage, PartnerBehaviour, PartnerEscape, PartnerTech, type TrainingState, clearTrainingReadout } from "./trainingState";

/** A measurement that waits longer than this for both fighters is dropped. */
const MEASURE_LIMIT = 600;
/** The partner presses tech when the forecast lands it within this many frames (the press techs within 20). */
const TECH_LEAD_FRAMES = 12;

/** Whether a fighter could start an action now: attack, or grab out of its shield. */
export function canAct(f: Fighter): boolean {
  return !f.status.out && (canAttack(f) || canShieldGrab(f));
}

/** Every fighter back on its starting spot; computers take the partner's damage. */
export function resetTrainingPositions(state: TrainingState, world: Roster, computerMask: number, spawnX: (slot: number) => number): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    respawnFighter(world, slot, spawnX(slot));
    f.status.out = false;
    f.status.respawn = 0;
    f.facing = spawnX(slot) < 0 ? 1 : -1;
    if (participantActive(computerMask, slot)) f.status.damage = f32(state.damage);
  }
  clearTrainingReadout(state);
}

// Preallocated: overwritten for every slot at the start of every training frame, rollback included.
const beforeSerial: Slots<number> = [0, 0, 0, 0];
const beforeHit: Slots<number> = [0, 0, 0, 0];
const beforeShield: Slots<number> = [0, 0, 0, 0];
const beforeDamage: Slots<number> = [0.0, 0.0, 0.0, 0.0];
const beforeOut: Slots<boolean> = [false, false, false, false];

export function captureTrainingBefore(world: Roster): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    beforeSerial[slot] = f.attack.serial;
    beforeHit[slot] = f.visuals.hit;
    beforeShield[slot] = f.visuals.shield;
    beforeDamage[slot] = f.status.damage;
    beforeOut[slot] = f.status.out;
  }
}

function attackerOf(world: Roster, defender: number): number {
  const last = fighterAt(world, defender).hits.lastAttacker;
  if (last !== undefined && last !== defender && isActive(world, last)) return last;
  for (const slot of PARTICIPANT_SLOTS) if (slot !== defender && isActive(world, slot)) return slot;
  return -1;
}

/** After a training frame: the move a player started, contacts to measure, the combo, and a knocked-out partner's damage. */
export function advanceTrainingReadout(state: TrainingState, world: Roster, playerMask: number, computerMask: number): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    if (participantActive(computerMask, slot) && beforeOut[slot] && !f.status.out) f.status.damage = f32(state.damage);
    const style = f.attack.style;
    if (participantActive(playerMask, slot) && f.attack.serial !== beforeSerial[slot] && style !== undefined) {
      state.moveStyle = style;
      state.moveSlot = slot;
      state.moveStartup = attackStartup(f, style) + 1;
      state.moveActive = attackActive(f, style);
      state.moveTotal = f.attack.duration;
    }
  }
  if (state.measureFrames >= 0) state.measureFrames++;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    const hit = f.visuals.hit !== beforeHit[slot];
    const shielded = f.visuals.shield !== beforeShield[slot];
    if (!hit && !shielded) continue;
    const attacker = attackerOf(world, slot);
    if (attacker < 0) continue;
    state.measureFrames = 0;
    state.measureAttacker = attacker;
    state.measureDefender = slot;
    state.measureKind = hit ? Advantage.hit : Advantage.shield;
    state.attackerReady = -1;
    state.defenderReady = -1;
    if (!hit) continue;
    const damage = f32(f.status.damage - beforeDamage[slot]);
    if (state.comboOpen && state.comboDefender === slot) {
      state.comboHits++;
      state.comboDamage = f32(state.comboDamage + damage);
    } else {
      state.comboDefender = slot;
      state.comboHits = 1;
      state.comboDamage = damage;
    }
    state.comboOpen = true;
  }
  if (state.comboOpen && state.comboDefender >= 0 && isActive(world, state.comboDefender) && canAct(fighterAt(world, state.comboDefender))) state.comboOpen = false;
  if (state.measureFrames < 0) return;
  if (!isActive(world, state.measureAttacker) || !isActive(world, state.measureDefender) || state.measureFrames > MEASURE_LIMIT) {
    state.measureFrames = -1;
    return;
  }
  if (state.attackerReady < 0 && canAct(fighterAt(world, state.measureAttacker))) state.attackerReady = state.measureFrames;
  if (state.defenderReady < 0 && canAct(fighterAt(world, state.measureDefender))) state.defenderReady = state.measureFrames;
  if (state.attackerReady < 0 || state.defenderReady < 0) return;
  state.advantage = state.defenderReady - state.attackerReady;
  state.advantageKind = state.measureKind;
  state.measureFrames = -1;
}

interface Forecast { readonly fighter: Fighter; readonly world: Roster; readonly input: Controls }
// The partner's tech forecast: one fighter played forward alone with the held stick, made on first use.
let forecast: Forecast | undefined;

/** Whether the tumbling fighter, holding `direction`, reaches the floor within `frames`. */
function landsWithin(world: Roster, f: Readonly<Fighter>, stage: number, matchFrame: number, direction: number, frames: number): boolean {
  if (forecast === undefined) {
    const fighter = createFighter(Character.archer, 0.0, 1);
    forecast = { fighter, world: createRoster(1, [fighter]), input: neutralControls() };
  }
  copyFighterState(forecast.fighter, f, world.mask);
  forecast.fighter.grab.owner = undefined;
  forecast.fighter.grab.target = undefined;
  forecast.input.direction = direction;
  for (let offset = 1; offset <= frames; offset++) {
    advanceFighterMotion(forecast.world, 0, stage, matchFrame + offset, forecast.input, 0.0);
    if (forecast.fighter.down.state !== DownState.tumble) return true;
  }
  return false;
}

/** -1, 0 or 1 toward the fighter that last hit `f`, or toward the middle without one. */
function towardAttacker(world: Roster, slot: number): Direction {
  const f = fighterAt(world, slot);
  const attacker = attackerOf(world, slot);
  const target = attacker < 0 ? 0.0 : fighterAt(world, attacker).motion.x;
  return target < f.motion.x ? -1 : 1;
}

function techDirection(state: Readonly<TrainingState>, world: Roster, slot: number): number {
  const f = fighterAt(world, slot);
  const option = state.tech === PartnerTech.random ? PartnerTech.inPlace + botChoice(f.visuals.hit, slot * 3 + 1, 3) : state.tech;
  if (option === PartnerTech.toward) return towardAttacker(world, slot);
  return option === PartnerTech.away ? -towardAttacker(world, slot) : 0;
}

/**
 * The partner's inputs this frame; false leaves the frame to the computer
 * (Fight, with no escape or tech set for what is happening).
 */
export function trainingPartnerInput(state: Readonly<TrainingState>, world: Roster, slot: number, stage: number, matchFrame: number, frame: number, input: Controls, commands: AttackBuffer): boolean {
  const f = fighterAt(world, slot);
  if (f.launch.hitlag > 0) {
    if (state.escape === PartnerEscape.none) return state.behaviour !== PartnerBehaviour.fight;
    if (f.launch.diPending) {
      const option = state.escape === PartnerEscape.random ? PartnerEscape.toward + botChoice(f.visuals.hit, slot * 5 + 2, 2) : state.escape;
      input.direction = option === PartnerEscape.toward ? towardAttacker(world, slot) : -towardAttacker(world, slot);
    }
    return true;
  }
  if (isTumbling(f)) {
    if (state.tech === PartnerTech.none) return state.behaviour !== PartnerBehaviour.fight;
    const direction = techDirection(state, world, slot);
    input.direction = direction;
    input.techPressed = f.tech.pressAge >= 40 && f.motion.vz < 0 && landsWithin(world, f, stage, matchFrame, direction, TECH_LEAD_FRAMES);
    return true;
  }
  switch (state.behaviour) {
    case PartnerBehaviour.fight:
      return false;
    case PartnerBehaviour.shield:
      input.shield = true;
      input.shieldTriggerActive = true;
      input.shieldStrength = 1.0;
      return true;
    case PartnerBehaviour.crouch:
      input.down = true;
      input.verticalDirection = -1;
      return true;
    case PartnerBehaviour.jump:
      input.jumpHeld = true;
      input.jumpPressed = f.motion.grounded && canAttack(f);
      return true;
    case PartnerBehaviour.attack:
      if (f.motion.grounded && canAttack(f)) queueAttack(commands, { style: AttackStyle.jab, facing: towardAttacker(world, slot), frame, mayCharge: false });
      return true;
    default:
      return true;
  }
}
