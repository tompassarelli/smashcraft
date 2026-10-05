// Starting a match, on every client at the same synchronized event: a fresh
// confirmed match, the stage, the developer scenario, the rollback epoch and
// its journal, then the fighters' renderers.
import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { resetMatchFrameInput } from "../../game/match/frameInput";
import { resetPoses } from "../../game/match/runtime";
import { initializeMatchFighters } from "../../game/match/step";
import { beginModelSoundEpoch, confirmModelSounds } from "../../game/render/modelSounds";
import { readyFile } from "../../game/shell/journalFiles";
import { initializeScenario } from "../../game/shell/scenarios";
import { usesPool } from "../../game/shell/build";
import { fighterAt, isActive } from "../../game/sim/roster";
import { writeLines } from "../fileio";
import { clearAllInputs } from "./inputs";
import { journalIdentity, publishMenu } from "./journal";
import { syncKeyEvents } from "./keyEvents";
import { makePreview } from "./preview";
import { beginRollbackEpoch } from "./rollback";
import type { ShellState } from "./state";
import { beginFighterRenderers, views } from "./ui";
import { LASTING, drawStage, pauseMatchPresentation, renderPersistentPresentation, setStatus } from "./view";

export function startMatch(s: ShellState): void {
  // Revoke the helper's menu before the match takes text focus.
  publishMenu(s);
  const wasPaused = s.session.paused;
  setStatus(s, "GO!", 1.0);
  const ui = views(s);
  for (const slot of PARTICIPANT_SLOTS) if (ui.settings[slot].isOpen()) ui.settings[slot].close();
  clearAllInputs(s);
  s.runtime.simulationFrame = 0;
  resetPoses(s.runtime);
  s.session.paused = false;
  resetMatchFrameInput(s.frameInput);
  s.runtime.botAttackDelays.fill(0.0);
  makePreview(s);
  initializeMatchFighters(s.game, s.world);
  drawStage(s);
  if (wasPaused) pauseMatchPresentation(s, false);
  initializeScenario(s.build.scenario, s.game, s.world);
  const { rollback } = s;
  if (rollback !== undefined) {
    rollback.active = beginRollbackEpoch(s, rollback);
    if (!rollback.active) setStatus(s, "The players could not connect. Restart the match.", LASTING);
    else if (rollback.journal !== undefined) {
      const file = readyFile(journalIdentity(s, rollback.epoch), {
        inputProfile: s.build.inputProfile, ingress: rollback.journal.ingress, delay: rollback.delay, rollback: rollback.window,
      });
      writeLines(file.name, file.lines);
    }
  }
  const pooled = usesPool(s.build) && rollback?.active === true;
  if (pooled && rollback !== undefined) beginModelSoundEpoch(s.sounds, rollback.epoch);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(s.world, slot)) continue;
    const participant = s.participants[slot];
    const fighter = fighterAt(s.world, slot);
    participant.pooled = beginFighterRenderers(s, slot, fighter.character, pooled);
    if (!pooled || rollback === undefined) continue;
    if (!participant.pooled) {
      setStatus(s, "This fighter is unavailable in the movement preview.", LASTING);
      continue;
    }
    if (participant.body !== undefined) {
      SetUnitTimeScale(participant.body.unit, 0.0);
      ShowUnit(participant.body.unit, false);
    }
    confirmModelSounds(s.sounds, rollback.epoch, 0, slot, fighter, s.runtime.poses[slot], ui.sounds);
  }
  renderPersistentPresentation(s);
  syncKeyEvents(s);
}
