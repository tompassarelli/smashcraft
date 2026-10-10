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

test("every match sound, theme and voice line is a stock path found in the game [k4 reference native]", () => {
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

test("every selectable stage plays its own stock Warcraft track [k3 measure docs/design/stage-music.md]", () => {
  const tracks: string[] = [];
  for (const stage of STAGE_CATALOG) {
    const track = stageMusic(stage.id) as string | undefined;
    assertEquals(track !== undefined && verified(track), true, `${stage.name} (${stage.id}) has no stock track`);
    assertEquals(tracks.includes(track!), false, `${stage.name} (${stage.id}) shares ${track}`);
    tracks.push(track!);
  }
});


function presentFrame(match: TestMatch, observation: CueObservation, tally: MatchTally, cues: MatchCue[]): void {
  observeForCues(observation, match.game, match.world);
  executeNext(match);
  confirmedFrameCues(observation, match.game, match.world, tally, cues);
}


function knockOut(match: TestMatch, slot: number, attacker: number): void {
  const fighter = fighterAt(match.world, slot);
  fighter.hits.lastAttacker = attacker;
  fighter.motion.x = -100000.0;
}

test("knockouts, the last stock and GAME! each cue once, on their confirmed frame, and the results tally them [k1 scenario]", () => {
  const match = testMatch(3, Character.rifleman);
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
  assertEquals(view.winner, Character.rifleman);
  assertEquals(view.rows.length, 2);
  assertTrue(view.rows[0]?.winner === true && view.rows[0]?.slot === 0);
});
