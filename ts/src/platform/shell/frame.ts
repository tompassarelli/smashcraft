// Executing one confirmed match frame: the recorded row runs through the
// simulation, then each fighter's changes are announced, traced and shown.
// Callback matches also produce that row here, from synchronized key events.
import { hasPendingAttack, clearAttackBuffer } from "../../game/input/attackBuffer";
import { adaptInput } from "../../game/input/adapter";
import { commitEdges } from "../../game/input/keyboardCapture";
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../../game/input/participants";
import { captureFrame, copyExecutedInput, executeMatchFrame } from "../../game/match/frameInput";
import { Phase, computerActive, humanFighterActive } from "../../game/match/rules";
import { resultMessage, aerialName, fighterLabel } from "../../game/shell/messages";
import { produceScenarioComputerInput } from "../../game/shell/scenarios";
import { DownState } from "../../game/sim/codes";
import { canAttack } from "../../game/sim/conditions";
import type { Fighter } from "../../game/sim/fighter";
import { isAerialAttack } from "../../game/sim/moves";
import { fighterAt, isActive } from "../../game/sim/roster";
import { traceFrameInput, traceParticipant } from "./diagnostics";
import { confirmModelSounds } from "../../game/render/modelSounds";
import { type FrameObservation, type ShellState, activeRollback } from "./state";
import { clearMatchEffects, views } from "./ui";
import { traceInput } from "./trace";
import { LASTING, announce, renderFighter, setStatus } from "./view";

function observe(before: FrameObservation, fighter: Readonly<Fighter>): void {
  before.out = fighter.status.out;
  before.holding = fighter.grab.target !== undefined;
  before.actionable = canAttack(fighter);
  before.attack = fighter.attack.serial;
  before.jump = fighter.jump.serial;
  before.down = fighter.down.state;
  before.lCancel = fighter.landing.lCancelSerial;
  before.shieldBreak = fighter.shield.breakSerial;
  before.breakState = fighter.shield.breakState;
  before.ledge = fighter.ledge.state;
  before.special = fighter.special.action;
  before.grab = fighter.grab.action;
}

const bit = (value: boolean) => (value ? "1" : "0");

/** Announcements and trace lines for what the frame changed. */
function reportChanges(s: ShellState, slot: ParticipantSlot, before: Readonly<FrameObservation>, f: Readonly<Fighter>): void {
  if (before.grab !== f.grab.action) traceParticipant(s, slot, `grab action ${f.grab.action} frame ${f.grab.frame} serial ${f.grab.serial}`);
  const holding = f.grab.target !== undefined;
  if (before.holding !== holding) traceParticipant(s, slot, `grab-hold ${holding ? "start" : "end"}`);
  if (before.special !== f.special.action) traceParticipant(s, slot, `special ${f.special.action} action-frame ${f.special.frame} x ${R2S(f.motion.x)} z ${R2S(f.motion.z)}`);
  const actionable = canAttack(f);
  if (s.trace.active && (f.down.state !== before.down || actionable !== before.actionable)) {
    traceParticipant(s, slot, `recovery down ${f.down.state} actionable ${bit(actionable)} hitlag ${f.launch.hitlag} hitstun ${f.launch.hitstun} damage ${R2S(f.status.damage)}`);
  }
  if (f.shield.breakSerial > before.shieldBreak) announce(s, `${fighterLabel(s.game, slot)}'s shield broke!`);
  if (before.breakState !== f.shield.breakState) traceParticipant(s, slot, `shield-break ${f.shield.breakState} z ${R2S(f.motion.z)} remaining ${R2S(f.shield.breakRemaining)}`);
  if (before.ledge !== f.ledge.state) traceParticipant(s, slot, `ledge ${f.ledge.state} x ${R2S(f.motion.x)} z ${R2S(f.motion.z)}`);
  if (before.jump !== f.jump.serial) traceParticipant(s, slot, `applied jump ${f.jump.serial} double ${bit(f.jump.isDouble)} z ${R2S(f.motion.z)}`);
  if (f.landing.lCancelSerial > before.lCancel) announce(s, "L-cancel!");
  if (before.down !== f.down.state) {
    if (f.down.state === DownState.tech) announce(s, "Tech!");
    else if (f.down.state === DownState.techRoll) announce(s, "Tech roll!");
  }
  if (before.attack !== f.attack.serial) {
    traceParticipant(s, slot, `applied attack ${f.attack.serial} style ${f.attack.style ?? -1}`);
    const name = f.attack.style !== undefined && isAerialAttack(f.attack.style) ? aerialName(f.attack.style) : undefined;
    if (name !== undefined) announce(s, name);
  }
}

/** Runs the frame the frame input captured, then presents its confirmed result. */
export function applyFrame(s: ShellState): void {
  const { world, runtime } = s;
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) observe(s.participants[slot].before, fighterAt(world, slot));
  const frame = s.frameInput.frame;
  if (frame === undefined || !executeMatchFrame(s.frameInput, s.game, world, s.controls, runtime, frame)) return;
  const rollback = activeRollback(s);
  const ui = views(s);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const participant = s.participants[slot];
    const fighter = fighterAt(world, slot);
    if (rollback !== undefined) copyExecutedInput(s.frameInput, slot, s.produced.inputs[slot]);
    reportChanges(s, slot, participant.before, fighter);
    if (participant.pooled && !confirmModelSounds(s.sounds, rollback?.epoch ?? 0, runtime.simulationFrame, slot, fighter, runtime.poses[slot], ui.sounds)) {
      traceInput(s.trace, `model sound rejected confirmed frame ${runtime.simulationFrame} slot ${slot}`);
    }
    renderFighter(s, slot, runtime.poses[slot], participant.before.out);
    ui.special.presentConfirmedAnimated(runtime.simulationFrame, fighter, slot);
  }
  if (s.game.phase !== Phase.result) return;
  clearMatchEffects(s);
  setStatus(s, resultMessage(s.game), LASTING);
}

/** A frame of a callback match: adapt each human's keys, choose the computers' controls, and run it. */
export function callbackMatchTick(s: ShellState): void {
  const frame = s.runtime.simulationFrame + 1;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!humanFighterActive(s.game, slot) || !isActive(s.world, slot)) continue;
    const participant = s.participants[slot];
    const commands = s.produced.commands[slot];
    adaptInput(participant.capture.row, fighterAt(s.world, slot), frame, s.produced.inputs[slot], commands);
    commitEdges(participant.capture);
    if (hasPendingAttack(commands, frame)) participant.lastNormalStyle = commands.pending?.style;
  }
  for (const slot of PARTICIPANT_SLOTS) {
    if (computerActive(s.game, slot) && isActive(s.world, slot)) produceScenarioComputerInput(s.build.scenario, s.game, s.world, s.runtime, s.produced, slot, frame);
  }
  if (!captureFrame(s.frameInput, frame, s.world.mask, s.produced, s.runtime)) return;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(s.world, slot)) continue;
    traceFrameInput(s, slot, s.produced.inputs[slot], s.produced.commands[slot], frame);
    clearAttackBuffer(s.produced.commands[slot]);
  }
  applyFrame(s);
}
