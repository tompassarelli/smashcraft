// Executing one confirmed match frame: the recorded row runs through the
// simulation, then each fighter's changes are announced, traced and shown.
// Callback matches also produce that row here, from synchronized key events.
import { hasPendingAttack, clearAttackBuffer } from "../../game/input/attackBuffer";
import { adaptInput } from "../../game/input/adapter";
import { commitEdges } from "../../game/input/keyboardCapture";
import { PARTICIPANT_SLOTS, type ParticipantSlot, participantActive } from "../../game/input/participants";
import { captureFrame, executeMatchFrame, hasNetworkRows, restoreMatchFrame } from "../../game/match/frameInput";
import { beginMomentFrame, keepMomentEnd, momentFrameRan, recordMomentRow } from "../../game/replay/moment";
import { Phase, beginRematchCountdown, computerActive, humanFighterActive } from "../../game/match/rules";
import { resultMessage, aerialName, fighterLabel } from "../../game/shell/messages";
import { produceScenarioComputerInput } from "../../game/shell/scenarios";
import { DownState } from "../../game/sim/codes";
import { canAttack } from "../../game/sim/conditions";
import { influenceOperands } from "../../game/sim/knockback";
import { canonicalReal } from "../../game/replay/canonical";
import type { Fighter } from "../../game/sim/fighter";
import { isAerialAttack } from "../../game/sim/moves";
import { fighterAt, isActive } from "../../game/sim/roster";
import { traceFrameInput, traceParticipant } from "./diagnostics";
import { confirmModelSounds } from "../../game/render/modelSounds";
import { type FrameObservation, type ShellState, activeRollback, localSlot } from "./state";
import { heldVisualFrame } from "../../game/shell/visualCapture";
import { clearMatchEffects, views } from "./ui";
import { traceInput } from "./trace";
import { probeRecording } from "./responseProbe";
import { MatchCue } from "../../game/presentation/matchAudio";
import { resultsView } from "../../game/presentation/matchCues";
import { RESULTS_DELAY_FRAMES } from "../../game/render/matchPresentation";
import { LASTING, announce, renderFighter, setStatus } from "./view";
import { writeMatchRecord } from "./matchRecords";
import { beginReplayFrame, endReplaySegment, replayFrameRan } from "./replays";

function observe(before: FrameObservation, fighter: Readonly<Fighter>): void {
  before.out = fighter.status.out;
  before.holding = fighter.grab.target !== undefined;
  before.actionable = canAttack(fighter);
  before.attack = fighter.attack.serial;
  before.jump = fighter.jump.serial;
  before.down = fighter.down.state;
  before.shieldBreak = fighter.shield.breakSerial;
  before.breakState = fighter.shield.breakState;
  before.ledge = fighter.ledge.state;
  before.special = fighter.special.action;
  before.grab = fighter.grab.action;
  before.di = fighter.launch.diSerial;
  before.damage = fighter.status.damage;
  before.form = fighter.special.form;
  before.ground = fighter.ground.action;
  before.facing = fighter.facing;
}

const bit = (value: boolean) => (value ? "1" : "0");

/** Announcements and trace lines for what the frame changed. */
function reportChanges(s: ShellState, slot: ParticipantSlot, before: Readonly<FrameObservation>, f: Readonly<Fighter>): void {
  if (s.trace.active && (before.ground !== f.ground.action || before.facing !== f.facing)) {
    traceParticipant(s, slot, `ground action ${f.ground.action} facing ${f.facing} dash-frame ${f.ground.dashFrame}`);
  }
  if (before.grab !== f.grab.action) traceParticipant(s, slot, `grab action ${f.grab.action} frame ${f.grab.frame} serial ${f.grab.serial}`);
  const holding = f.grab.target !== undefined;
  if (before.holding !== holding) traceParticipant(s, slot, `grab-hold ${holding ? "start" : "end"}`);
  if (before.special !== f.special.action) traceParticipant(s, slot, `special ${f.special.action} form ${f.special.form} action-frame ${f.special.frame} x ${R2S(f.motion.x)} z ${R2S(f.motion.z)}`);
  else if (before.form !== f.special.form) traceParticipant(s, slot, `special-form ${f.special.form} action ${f.special.action} action-frame ${f.special.frame} x ${R2S(f.motion.x)} z ${R2S(f.motion.z)}`);
  const actionable = canAttack(f);
  if (s.trace.active && (f.down.state !== before.down || actionable !== before.actionable)) {
    traceParticipant(s, slot, `recovery down ${f.down.state} actionable ${bit(actionable)} hitlag ${f.launch.hitlag} hitstun ${f.launch.hitstun} damage ${R2S(f.status.damage)}`);
  }
  if (f.shield.breakSerial > before.shieldBreak) announce(s, `${fighterLabel(s.game, slot)}'s shield broke!`);
  if (before.breakState !== f.shield.breakState) traceParticipant(s, slot, `shield-break ${f.shield.breakState} z ${R2S(f.motion.z)} remaining ${R2S(f.shield.breakRemaining)}`);
  if (before.ledge !== f.ledge.state) traceParticipant(s, slot, `ledge ${f.ledge.state} x ${R2S(f.motion.x)} z ${R2S(f.motion.z)}`);
  if (before.jump !== f.jump.serial) traceParticipant(s, slot, `applied jump ${f.jump.serial} double ${bit(f.jump.isDouble)} z ${R2S(f.motion.z)}`);
  if (before.damage !== f.status.damage) traceParticipant(s, slot, `damage ${R2S(f.status.damage)} hitlag ${f.launch.hitlag} hitstun ${f.launch.hitstun}`);
  const influence = s.trace.active && before.di !== f.launch.diSerial ? influenceOperands(f) : undefined;
  if (influence !== undefined) {
    // Exact x, z, stick x, stick z, degrees, radians and angle, so a replay can repeat the DI operation by operation.
    const { x, z, stickX, stickZ, degrees, angleRadians } = influence;
    const exact = [x, z, stickX, stickZ, degrees, angleRadians, f.launch.diAngleDegrees].map(value => canonicalReal(value)).join(" ");
    traceParticipant(s, slot, `di ${f.launch.diSerial} ${exact}`);
  }
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

/**
 * Before a confirmed frame's controls are made: the replay and the moment
 * record start, or keep the match as the frame finds it. A callback match
 * calls it before its computers choose their controls, which change the
 * match (their attack delays); a rollback match's applyFrame calls it.
 */
function beginRecordedFrame(s: ShellState, frame: number): void {
  beginReplayFrame(s, frame);
  beginMomentFrame(s.moment.recorder, frame, s.world, s.game, s.controls, s.runtime);
}

/** Runs the frame the frame input captured, then presents its confirmed result; `recorded` when the caller began its record. */
export function applyFrame(s: ShellState, recorded = false): void {
  const { world, runtime } = s;
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot)) observe(s.participants[slot].before, fighterAt(world, slot));
  const frame = s.frameInput.frame;
  if (frame === undefined) return;
  const { recorder } = s.moment;
  if (!recorded) beginRecordedFrame(s, frame);
  views(s).match.observe(s.game, world);
  // The speculative match usually ran this frame on this row already. The
  // response probe and the integrity trace read the step's own observations.
  const rollback = activeRollback(s);
  const ran = rollback !== undefined && !s.trace.active && !probeRecording(s.probe) ? rollback.playback.confirmedState(rollback.epoch, frame, s.frameInput) : undefined;
  if (!(ran === undefined ? executeMatchFrame(s.frameInput, s.game, world, s.controls, runtime, frame) : restoreMatchFrame(s.frameInput, s.game, world, s.controls, runtime, frame, ran))) return;
  if (hasNetworkRows(s.frameInput)) {
    for (const slot of PARTICIPANT_SLOTS) if (participantActive(s.frameInput.networkMask, slot)) recordMomentRow(recorder, frame, slot, s.frameInput.network[slot]);
  }
  momentFrameRan(recorder, frame);
  replayFrameRan(s, frame);
  const ui = views(s);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const participant = s.participants[slot];
    const fighter = fighterAt(world, slot);
    reportChanges(s, slot, participant.before, fighter);
    if (participant.pooled && !confirmModelSounds(s.sounds, s.sounds.epoch ?? 0, runtime.simulationFrame, slot, fighter, runtime.poses[slot], ui.sounds)) {
      traceInput(s.trace, `model sound rejected confirmed frame ${runtime.simulationFrame} slot ${slot}`);
    }
    const held = heldVisualFrame(localSlot()) !== undefined;
    if (!held) ui.combat.presentConfirmed(runtime.simulationFrame, slot, runtime.frameImpacts[slot], s.trace.active
      ? (sound, volume, pitch) => traceInput(s.trace, `participant ${slot} frame ${runtime.simulationFrame} sound ${sound} volume ${volume} pitch ${canonicalReal(pitch)}`)
      : undefined);
    ui.combat.confirmContacts(runtime.simulationFrame, runtime.frameImpacts[slot]);
    if (!held) {
      renderFighter(s, slot, runtime.poses[slot], participant.before.out);
      ui.special.presentConfirmedAnimated(runtime.simulationFrame, fighter, slot);
    }
  }
  const cues = ui.match.presentConfirmed(s.game, world);
  if (s.game.phase !== Phase.result) return;
  clearMatchEffects(s);
  // The countdown changes the match between frames: the moment keeps it as its last frame left it.
  keepMomentEnd(recorder, world, s.game, s.controls, runtime);
  endReplaySegment(s);
  beginRematchCountdown(s.game, s.dev.rematchSeconds);
  const call = cues.find(cue => cue === MatchCue.game || cue === MatchCue.time);
  ui.match.beginResults(resultsView(s.game, world, ui.match.tally), call === undefined ? 0 : RESULTS_DELAY_FRAMES);
  writeMatchRecord(s);
  setStatus(s, resultMessage(s.game), LASTING);
}

/** A frame of a callback match: adapt each human's keys, choose the computers' controls, and run it. */
export function callbackMatchTick(s: ShellState): void {
  const frame = s.runtime.simulationFrame + 1;
  // A frame the input already captured isn't run again, so it starts no record.
  const fresh = s.frameInput.frame !== frame;
  if (fresh) beginRecordedFrame(s, frame);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!humanFighterActive(s.game, slot) || !isActive(s.world, slot)) continue;
    const participant = s.participants[slot];
    const commands = s.produced.commands[slot];
    recordMomentRow(s.moment.recorder, frame, slot, participant.capture.row);
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
  applyFrame(s, fresh);
}
