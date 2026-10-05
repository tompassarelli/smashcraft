// Developer diagnostics written from the shell's state: the input trace's
// match lines and checksums, and the ready marker probe scripts wait for.
import { hasPendingAttack, type AttackBuffer } from "../../game/input/attackBuffer";
import { pulsePending } from "../../game/input/directionalInput";
import { encodeBindings } from "../../game/input/keyBindings";
import { PARTICIPANT_SLOTS, type ParticipantSlot } from "../../game/input/participants";
import { directionX, directionZ } from "../../game/input/playerKeys";
import { characterFor, characterReady, computerActive, fighterMask, firstHumanSlot, humanActive, humanFighterActive } from "../../game/match/rules";
import { captureReplaySnapshot } from "../../game/replay/snapshot";
import { stateChecksum } from "../../game/replay/canonical";
import { fighterAt, isActive, type Controls } from "../../game/sim/roster";
import { floorMod } from "wisp/src/sim/intMath";
import { INPUT_START_FILE, MELEE_READY_FILE, traceStartLine } from "../../runtime/gameFiles";
import { writeLines } from "wisp/src/platform/fileio";
import { type ShellState, activeRollback, localSlot } from "./state";
import { views } from "./ui";
import { beginInputTrace, closeTraceWindow, finishInputTrace, traceInput, traceParticipantWindow, traceSeconds } from "./trace";

const bit = (value: boolean) => (value ? "1" : "0");

export function traceParticipant(s: ShellState, slot: number, entry: string): void {
  traceInput(s.trace, `participant ${slot} frame ${s.runtime.simulationFrame} phase ${s.game.phase} ${entry}`);
}

/** The confirmed match's canonical checksum. */
export function confirmedChecksum(s: ShellState): string {
  captureReplaySnapshot(s.diagnostic, s.world, s.game, s.controls, s.runtime);
  return stateChecksum(s.diagnostic);
}

function traceConfirmedState(s: ShellState): void {
  const first = firstHumanSlot(s.game);
  if (first === undefined || s.participants[first].body === undefined) return;
  const started = traceSeconds(s.trace);
  const state = confirmedChecksum(s);
  const elapsed = traceSeconds(s.trace) - started;
  traceInput(s.trace, `confirmed frame ${s.runtime.simulationFrame} state ${state}`);
  traceInput(s.trace, `checksum native-seconds ${R2S(elapsed)}`);
}

export function traceSelectionState(s: ShellState, reason: string): void {
  if (!s.trace.active) return;
  const { game } = s;
  traceInput(s.trace, `selection ${reason} phase ${game.phase} connected ${game.humanMask} human-fighters ${game.humanFighterMask} computers ${game.computerMask} fighters ${fighterMask(game)}`);
  for (const slot of PARTICIPANT_SLOTS) {
    const mode = humanFighterActive(game, slot) ? "HMN" : computerActive(game, slot) ? "CPU" : "EMPTY";
    traceInput(s.trace, `selection slot ${slot} mode ${mode} choice ${characterFor(game, slot) ?? -1} ready ${bit(characterReady(game, slot))}`);
  }
}

export function startInputTrace(s: ShellState): void {
  beginInputTrace(s.trace);
  const stamps = s.rollback?.keyboard?.stamps;
  if (stamps !== undefined) for (const stamp of stamps) stamp.traced = false;
  traceInput(s.trace, `start ${s.build.id} input ${s.build.inputProfile} presentation ${s.build.presentation}`);
  traceInput(s.trace, `humans ${s.game.humanCount} frame ${s.runtime.simulationFrame} phase ${s.game.phase}`);
  traceConfirmedState(s);
  traceSelectionState(s, "trace-start");
  const receiptStarted = traceSeconds(s.trace);
  writeLines(INPUT_START_FILE, [traceStartLine(s.build.id)]);
  traceInput(s.trace, `trace-start receipt native-seconds ${R2S(traceSeconds(s.trace) - receiptStarted)}`);
}

/** A callback-driven frame's sampled input, when it carries a press. */
export function traceFrameInput(s: ShellState, slot: ParticipantSlot, input: Readonly<Controls>, attacks: Readonly<AttackBuffer>, frame: number): void {
  const attacking = hasPendingAttack(attacks, frame);
  if (!s.trace.active || !(input.jumpPressed || input.airDodgePressed || input.specialPressed || attacking)) return;
  const attack = attacking ? attacks.pending?.style ?? -1 : -1;
  traceInput(s.trace, `participant ${slot} frame ${frame} phase ${s.game.phase} sampled x ${input.direction} z ${input.verticalDirection} jump ${bit(input.jumpPressed)} dodge ${bit(input.airDodgePressed)} special ${bit(input.specialPressed)} attack ${attack}`);
}

/** The local player's slot, or the first human's for an observer. */
export function localParticipantSlot(s: Readonly<ShellState>): ParticipantSlot | undefined {
  const slot = localSlot();
  return PARTICIPANT_SLOTS.find(candidate => candidate === slot && humanActive(s.game, candidate)) ?? firstHumanSlot(s.game);
}

/** Active play the trace observes before it ends; pauses don't count. */
function traceLength(s: Readonly<ShellState>): number {
  if (s.build.responseProbe) return 1200;
  return s.build.scenario === "shield-break" || s.build.scenario === "ledge" ? 600 : 300;
}

/** One game callback of trace: local samples, and once a second the checksum and schedule summary. */
export function traceTick(s: ShellState): void {
  const { trace } = s;
  if (!trace.active) return;
  trace.ticks++;
  // Callback timestamps stay intact, but a chat pause cannot use up the post-resume observation.
  if (s.session.paused) trace.pausedTicks++;
  const local = localParticipantSlot(s);
  if (local !== undefined && s.participants[local].body !== undefined && isActive(s.world, local)) {
    const { keys } = s.participants[local];
    const fighter = fighterAt(s.world, local);
    const axes = directionX(keys) + 3 * directionZ(keys);
    const pulse = pulsePending(keys.directions);
    if (axes !== trace.lastAxes || pulse || floorMod(trace.ticks, 60) === 0) {
      traceInput(trace, `sample ${axes} pulse ${pulse ? `${keys.directions.pulseX}:${keys.directions.pulseZ}` : "none"} hitlag ${fighter.launch.hitlag}`);
      trace.lastAxes = axes;
    }
    if (trace.lastDodge !== fighter.dodge.airFrame || trace.lastLandingLag !== fighter.landing.lag) {
      traceInput(trace, `motion air ${fighter.dodge.airFrame} landing ${fighter.landing.lag} x ${R2S(fighter.motion.x)} z ${R2S(fighter.motion.z)}`);
      trace.lastDodge = fighter.dodge.airFrame;
      trace.lastLandingLag = fighter.landing.lag;
    }
  }
  if (floorMod(trace.ticks, 60) === 0) {
    traceConfirmedState(s);
    const rollback = activeRollback(s);
    if (rollback !== undefined) {
      for (const slot of PARTICIPANT_SLOTS) {
        if (!isActive(s.world, slot)) continue;
        const missing = views(s).fighters[slot]?.pool?.missingSelections;
        if (missing !== undefined) traceInput(trace, `local presentation ${s.build.presentation} participant ${slot} admitted ${bit(s.participants[slot].pooled)} missing-selections ${missing}`);
        traceParticipantWindow(trace, slot);
      }
      const { schedule } = rollback;
      closeTraceWindow(trace, {
        known: schedule.knownThrough(), confirmed: schedule.nextConfirmedFrame() - 1, rollback: schedule.rollbackFrames(),
        speculative: schedule.speculativeFrame(), target: schedule.captureTarget(), batchPending: rollback.keyboard?.outgoing.size() ?? rollback.journal?.outgoing.pending() ?? 0,
      }, rollback.journal?.readyMask ?? 0);
    }
  }
  if (trace.ticks - trace.pausedTicks >= traceLength(s)) finishInputTrace(trace);
}

/** Written once the local bindings are ready: probe scripts wait for it before driving keys. */
export function writeReadyMarker(s: ShellState): void {
  const local = localParticipantSlot(s);
  if (s.readyMarkerWritten || local === undefined || !s.participants[local].bindings.ready) return;
  s.readyMarkerWritten = true;
  const lines = [
    `BUILD ${s.build.id}`,
    `INPUT ${s.build.inputProfile} PRESENTATION ${s.build.presentation}`,
    `SCENARIO ${s.build.scenario}`,
    `BINDINGS ${encodeBindings(s.participants[local].bindings.bindings)}`,
    `HUMANS ${s.game.humanMask} FIGHTERS ${s.world.mask}`,
  ];
  for (const slot of PARTICIPANT_SLOTS) {
    if (isActive(s.world, slot)) lines.push(`BINDINGS${slot} ${humanActive(s.game, slot) ? encodeBindings(s.participants[slot].bindings.bindings) : "BOT"}`);
  }
  writeLines(MELEE_READY_FILE, lines);
}
