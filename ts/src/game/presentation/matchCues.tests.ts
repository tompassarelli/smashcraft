import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { VERIFIED_STOCK_SOUNDS } from "../assets/stockSoundInfo";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { executeNext, testMatch } from "../match/testMatch";
import { Phase } from "../match/rules";
import { Character } from "../sim/codes";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { fighterAt } from "../sim/roster";
import { MENU_MUSIC, MatchCue, cueSound, presentationSoundPaths, readyVoice, stageMusic, victoryMusic, warcryVoice } from "./matchAudio";
import {
  type CueObservation, type MatchTally, confirmedFrameCues, createCueObservation, createMatchTally, createMenuCues, createMenuObservation,
  menuFrameCues, observeForCues, resultsView,
} from "./matchCues";
import type { TestMatch } from "../match/testMatch";

const verified = (path: string): boolean => VERIFIED_STOCK_SOUNDS[path] !== undefined;

test("every match sound, theme and voice line is a stock path found in the game", () => {
  const stages = STAGE_CATALOG.map(stage => stage.id);
  for (const path of presentationSoundPaths(SELECTABLE_CHARACTERS, stages)) assertEquals(verified(path), true, path);
  for (const stage of stages) assertEquals(verified(stageMusic(stage)), true, `stage ${stage}`);
  assertTrue(verified(MENU_MUSIC));
  for (const character of SELECTABLE_CHARACTERS) {
    assertEquals(verified(readyVoice(character)), true, `ready ${character}`);
    assertEquals(verified(warcryVoice(character)), true, `warcry ${character}`);
    const theme = victoryMusic(character);
    assertEquals(theme !== undefined && verified(theme), true, `victory ${character}`);
  }
  for (let cue = 0; cue <= MatchCue.cheer; cue++) assertEquals(verified(cueSound(cue as MatchCue)), true, `cue ${cue}`);
  assertEquals(victoryMusic(undefined), undefined);
});

/** Runs one confirmed frame as the shell presents it: observe, execute, then read its cues. */
function presentFrame(match: TestMatch, observation: CueObservation, tally: MatchTally, cues: MatchCue[]): void {
  observeForCues(observation, match.game, match.world);
  executeNext(match);
  confirmedFrameCues(observation, match.game, match.world, tally, cues);
}

/** Puts `slot` past the left blast zone with `attacker`'s hit the last it took. */
function knockOut(match: TestMatch, slot: number, attacker: number): void {
  const fighter = fighterAt(match.world, slot);
  fighter.hits.lastAttacker = attacker;
  fighter.motion.x = -100000.0;
}

test("knockouts, the last stock and GAME! each cue once, on their confirmed frame, and the results tally them", () => {
  const match = testMatch(3, Character.archer);
  match.game.stockCount = 2;
  for (const slot of [0, 1]) fighterAt(match.world, slot).status.stocks = 2;
  const observation = createCueObservation();
  const tally = createMatchTally();
  const cues: MatchCue[] = [];
  presentFrame(match, observation, tally, cues);
  assertEquals(cues.length, 0);
  knockOut(match, 1, 0);
  presentFrame(match, observation, tally, cues);
  assertEquals(cues.join(","), `${MatchCue.stockLost},${MatchCue.lastStock}`);
  presentFrame(match, observation, tally, cues);
  assertEquals(cues.length, 0, "a knockout cues once");
  for (let frame = 0; frame < 120 && fighterAt(match.world, 1).status.out; frame++) presentFrame(match, observation, tally, cues);
  assertFalse(fighterAt(match.world, 1).status.out);
  knockOut(match, 1, 0);
  presentFrame(match, observation, tally, cues);
  assertEquals(match.game.phase, Phase.result);
  assertEquals(cues.join(","), `${MatchCue.stockLost},${MatchCue.game}`);
  assertEquals(tally.kos.join(","), "2,0,0,0");
  assertEquals(tally.falls.join(","), "0,2,0,0");
  const view = resultsView(match.game, match.world, tally);
  assertEquals(view.winner, Character.archer);
  assertEquals(view.rows.length, 2);
  assertTrue(view.rows[0]?.winner === true && view.rows[0]?.slot === 0);
  assertEquals(view.rows[0]?.text, "WINNER  Player 1 · Archer\nStocks 2  ·  Damage 0%  ·  KOs 2  ·  Falls 0");
  assertEquals(view.rows[1]?.text, "Player 2 · Archer\nStocks 0  ·  Damage 0%  ·  KOs 0  ·  Falls 2");
});

test("a match that runs out of time calls TIME!", () => {
  const match = testMatch(3, Character.archer);
  match.game.timeLimitMinutes = 1;
  match.game.remainingFrames = 1;
  const observation = createCueObservation();
  const tally = createMatchTally();
  const cues: MatchCue[] = [];
  presentFrame(match, observation, tally, cues);
  assertEquals(match.game.phase, Phase.result);
  assertEquals(cues.join(","), `${MatchCue.time}`);
});

test("selection sounds: hovering a tile, confirming a fighter, changing a confirmed fighter and choosing stages", () => {
  const { game } = testMatch(3, Character.archer);
  game.phase = Phase.characterMenu;
  game.characterReadiness.fill(false);
  const before = createMenuObservation();
  const cues = createMenuCues();
  menuFrameCues(before, game, undefined, cues);
  assertFalse(cues.hover || cues.confirm || cues.fighters.length > 0);
  menuFrameCues(before, game, 2, cues);
  assertTrue(cues.hover);
  menuFrameCues(before, game, 2, cues);
  assertFalse(cues.hover);
  game.characterChoices[1] = Character.rifleman;
  game.characterReadiness[1] = true;
  menuFrameCues(before, game, 2, cues);
  assertEquals(cues.fighters.join(","), "1");
  menuFrameCues(before, game, 2, cues);
  assertEquals(cues.fighters.length, 0);
  game.characterChoices[1] = Character.demonHunter;
  menuFrameCues(before, game, 2, cues);
  assertEquals(cues.fighters.join(","), "1");
  game.phase = Phase.stageMenu;
  menuFrameCues(before, game, undefined, cues);
  assertTrue(cues.confirm);
  game.stageChoice = 3;
  menuFrameCues(before, game, undefined, cues);
  assertTrue(cues.hover && !cues.confirm);
});
