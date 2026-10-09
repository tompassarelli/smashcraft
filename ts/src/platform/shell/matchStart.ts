import type { QuickStageSettings } from "../../game/shell/devSettings";
import { showBackdrop, showStageFog, showStageLighting } from "./stageScenery";



import { PARTICIPANT_SLOTS } from "../../game/input/participants";
import { resetMatchFrameInput } from "../../game/match/frameInput";
import { clearPresentationHistory } from "../../game/match/pacingAndPresentation";
import { clearBotMemory } from "../../game/match/botPerception";
import { clearBotStrategy } from "../../game/match/botStrategy";
import { initializeMatchFighters } from "../../game/match/step";
import { beginModelSoundEpoch, confirmModelSounds } from "../../game/render/modelSounds";
import { stageMusic } from "../../game/presentation/matchAudio";
import { readyFile, stageDrawnFile } from "../../game/shell/journalFiles";
import { initializeScenario } from "../../game/shell/scenarios";
import { classicIntro } from "../../game/classic/classicText";
import { loreIntro } from "../../game/classic/loreBattles";
import { type Scenario, usesPool } from "../../game/shell/build";
import { fighterAt, isActive } from "../../game/sim/roster";
import { surfaceCount } from "../../game/sim/stage";
import { writeLines } from "wisp/src/platform/fileio";
import { clearAllInputs } from "./inputs";
import { journalIdentity, publishMenu } from "./journal";
import { syncKeyEvents } from "./keyEvents";
import { makePreview } from "./preview";
import { beginRollbackEpoch } from "./rollback";
import type { ShellState } from "./state";
import { beginFighterRenderers, views } from "./ui";
import { LASTING, drawStage, pauseMatchPresentation, renderPersistentPresentation, setStatus } from "./view";

export function startMatch(s: ShellState, scenario: Scenario = s.build.scenario, stageSettings?: QuickStageSettings): void {

  publishMenu(s);
  const wasPaused = s.session.paused;

  setStatus(s, s.game.startHold === 0 ? "GO!" : "", s.game.startHold === 0 ? 1.0 : 0.0);
  const ui = views(s);
  for (const slot of PARTICIPANT_SLOTS) if (ui.settings[slot].isOpen()) ui.settings[slot].close();
  clearAllInputs(s);
  s.runtime.simulationFrame = 0;
  clearPresentationHistory(s.runtime);
  s.session.paused = false;
  resetMatchFrameInput(s.frameInput);
  s.runtime.botAttackDelays.fill(0.0);
  clearBotMemory(s.runtime.botMemory);
  for (const strategy of s.runtime.botStrategies) clearBotStrategy(strategy);
  makePreview(s);
  initializeMatchFighters(s.game, s.world);


  if (s.drawnStage !== s.game.stageChoice || s.stageDecks.length !== surfaceCount(s.game.stageChoice)) drawStage(s);
  if (stageSettings?.lighting !== undefined) showStageLighting(s, stageSettings.lighting === "stage");
  if (stageSettings?.backdrop !== undefined) showBackdrop(s, stageSettings.backdrop === "on");
  if (stageSettings?.fog !== undefined) showStageFog(s, stageSettings.fog === "on");
  if (stageSettings?.view !== undefined) s.viewExtreme = stageSettings.view === "off" ? undefined : stageSettings.view;
  if (wasPaused) pauseMatchPresentation(s, false);
  initializeScenario(scenario, s.game, s.world);
  ui.classic?.beginMatch(s.game);
  if (s.game.run.active) setStatus(s, s.game.lore ? loreIntro(s.game) : classicIntro(s.game), 5.0);
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
  if (s.build.devConsole) {

    const drawn = stageDrawnFile(journalIdentity(s, rollback?.epoch ?? 0), s.drawnStage, s.stageDecks.length);
    writeLines(drawn.name, drawn.lines);
  }

  const pooled = usesPool(s.build) && rollback?.active !== false;

  if (pooled) beginModelSoundEpoch(s.sounds, rollback?.epoch ?? (s.sounds.epoch ?? 0) + 1);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(s.world, slot)) continue;
    const participant = s.participants[slot];
    const fighter = fighterAt(s.world, slot);
    participant.pooled = beginFighterRenderers(s, slot, fighter.character, pooled);

    if (!participant.pooled) continue;
    if (participant.body !== undefined) {
      SetUnitTimeScale(participant.body.unit, 0.0);
      ShowUnit(participant.body.unit, false);
    }
    confirmModelSounds(s.sounds, s.sounds.epoch ?? 0, 0, slot, fighter, s.runtime.poses[slot], ui.sounds);
  }
  ui.match.beginMatch(stageMusic(s.game.stageChoice), s.game, s.world);
  renderPersistentPresentation(s);
  syncKeyEvents(s);
}
