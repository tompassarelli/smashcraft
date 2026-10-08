// The match's announcer cues, music and voice lines: Warcraft III's own
// sounds by in-game path. tools/presentation/stock-sounds.ts checks every
// path here against the installed game and records it in stockSoundInfo.ts.
import { at } from "wisp/src/runtime/lookup";
import { Character } from "../sim/codes";
import { type StageTile, selectableStage } from "../menu/stageCatalog";

/** Moments the match calls out; each plays one stock sound. */
export const MatchCue = {
  three: 0, two: 1, one: 2, go: 3, game: 4, time: 5, stockLost: 6, lastStock: 7, hover: 8, confirm: 9, cheer: 10, meterReady: 11,
} as const;
export type MatchCue = (typeof MatchCue)[keyof typeof MatchCue];

/** By MatchCue. */
const CUE_SOUNDS: readonly string[] = [
  "Sound\\Interface\\BattleNetTick.flac",
  "Sound\\Interface\\BattleNetTick.flac",
  "Sound\\Interface\\BattleNetTick.flac",
  "Sound\\Interface\\GameFound.flac",
  "Sound\\Cinematics\\BellTollAlliance.flac",
  "Sound\\Cinematics\\BellTollAlliance.flac",
  "Sound\\Interface\\BattleNetDeath1.flac",
  "Sound\\Interface\\Warning.flac",
  "Sound\\Interface\\MouseOver1.flac",
  "Sound\\Interface\\BigButtonClick.flac",
  "Sound\\Cinematics\\CrowdCheer1.flac",
  "Sound\\Interface\\GameFound.flac",
];

export const cueSound = (cue: MatchCue): string => at(CUE_SOUNDS, cue);

/** Each cue's on-screen call; empty for cues that are only heard. */
const CUE_TEXT: readonly string[] = ["3", "2", "1", "GO!", "GAME!", "TIME!", "", "", "", "", "", ""];

export const cueText = (cue: MatchCue): string => at(CUE_TEXT, cue);

const MUSIC = "Sound\\Music\\mp3Music\\";

/** Fighter selection and the stage menu. */
export const MENU_MUSIC = `${MUSIC}War3XMainScreen.flac`;

/**
 * Each stage's theme from the Warcraft III soundtrack, chosen for the
 * fighters who call it home (smashcraft:docs/design/stage-music.md).
 */
const STAGE_MUSIC: Readonly<Record<StageTile, string>> = {
  0: `${MUSIC}Human1.flac`,
  2: `${MUSIC}LichKingTheme.flac`,
  3: `${MUSIC}OrcX1.flac`,
  4: `${MUSIC}NaxxramasWalking1.flac`,
  6: `${MUSIC}ArthasTheme.flac`,
  7: `${MUSIC}NagaTheme.flac`,
  10: `${MUSIC}NightElf1.flac`,
  11: `${MUSIC}HumanX1.flac`,
  12: `${MUSIC}Human3.flac`,
  13: `${MUSIC}NightElf2.flac`,
  14: `${MUSIC}IllidansTheme.flac`,
};

/** An unknown stage plays the test arena's theme. */
export const stageMusic = (stage: number): string => (selectableStage(stage) ? STAGE_MUSIC[stage] : STAGE_MUSIC[0]);

export const Race = { human: 0, orc: 1, nightElf: 2, undead: 3 } as const;
export type Race = (typeof Race)[keyof typeof Race];

/** By Character. */
const RACES: readonly Race[] = [
  Race.nightElf, Race.human, Race.nightElf, Race.orc, Race.human, Race.nightElf, Race.undead, Race.human, Race.undead, Race.orc,
  // Pit Lord: the game lists him as undead.
  Race.undead,
  // Beastmaster: the orcish Rexxar.
  Race.orc,
  // The Lich King: the Scourge.
  Race.undead,
  Race.orc, Race.human, Race.undead, Race.orc, Race.orc, Race.orc, Race.orc, Race.human,
  // Murloc: a Broken Isles creep, fought there in the night elves' Terror of the Tides.
  Race.nightElf,
];

export const characterRace = (character: Character): Race => at(RACES, character);

/** By Race: the stinger Warcraft III plays when that race wins. */
const VICTORY_MUSIC: readonly string[] = [
  `${MUSIC}HumanVictory.flac`, `${MUSIC}OrcVictory.flac`, `${MUSIC}NightElfVictory.flac`, `${MUSIC}UndeadVictory.flac`,
];

/** A draw has no winner's theme. */
export const victoryMusic = (winner: Character | undefined): string | undefined =>
  winner === undefined ? undefined : at(VICTORY_MUSIC, characterRace(winner));

/**
 * By Character: the unit's sound directory, the prefix of its voice files, and
 * the line it says when chosen where the unit has no Ready line (a campaign hero),
 * and its battle cry where it has no Warcry line (a creep).
 */
const VOICES: readonly (readonly [string, string, string?, string?])[] = [
  ["Units\\NightElf\\Archer\\", "Archer"],
  ["Units\\Human\\Rifleman\\", "Rifleman"],
  ["Units\\NightElf\\HeroDemonHunter\\", "HeroDemonHunter"],
  ["Units\\Orc\\HeroBladeMaster\\", "HeroBladeMaster"],
  ["Units\\Human\\HeroMountainKing\\", "HeroMountainKing"],
  ["Units\\NightElf\\HeroWarden\\", "HeroWarden"],
  ["Units\\Undead\\HeroLich\\", "HeroLich"],
  ["Units\\Human\\Uther\\", "Uther"],
  ["Units\\Undead\\HeroDreadLord\\", "HeroDreadLord"],
  ["Units\\Orc\\HeroShadowHunter\\", "ShadowHunter"],
  ["Units\\Demon\\HeroPitLord\\", "HPitLord"],
  ["Units\\Creeps\\BeastMaster\\", "OgreBeastMaster"],
  // Evil Arthas, the Lich King's own voice; a campaign hero with no Ready line.
  ["Units\\Undead\\EvilArthas\\", "EvilArthas", "What"],
  ["Units\\Orc\\Thrall\\", "Thrall"],
  ["Units\\Human\\Jaina\\","Jaina","What"],
  ["Units\\Undead\\EvilSylvanas\\","EvilSylvanas"],
  ["Units\\Orc\\Cairne\\","Cairne"],
  ["Units\\Creeps\\PandarenBrewmaster\\","PandarenBrewmaster"],
  ["Units\\Orc\\Peon\\","Peon"],
  ["Units\\Creeps\\HeroTinker\\","HeroTinker"],
  ["Units\\Human\\Kael\\","Kael"],
  ["Units\\Creeps\\Murloc\\", "Murloc", "Ready", "YesAttack"],
];

function voice(character: Character, line: string): string {
  const [directory, prefix, ready, warcry] = at(VOICES, character);
  const spoken = line === "Ready" ? ready ?? line : line === "Warcry" ? warcry ?? line : line;
  return `${directory}${prefix}${spoken}1.flac`;
}

/** The line a hero says when trained: played when a player confirms that fighter. */
export const readyVoice = (character: Character): string => voice(character, "Ready");

/** The hero's battle cry: played for the winner on the results screen. */
export const warcryVoice = (character: Character): string => voice(character, "Warcry");

/** The model animation the winner plays at the results; models without one stand ready. */
export function victoryAnimation(character: Character): string {
  switch (character) {
    case Character.archer: case Character.blademaster: case Character.forsakenPaladin: case Character.shadowHunter:
      return "stand victory";
    // Pit Lord has no ready stance; he roars.
    case Character.lich: case Character.pitLord:
      return "stand channel";
    default:
      return "stand ready";
  }
}

/** Every sound and track above, for the stock-asset check. */
export function presentationSoundPaths(characters: readonly Character[], stages: readonly StageTile[]): string[] {
  const paths = [...CUE_SOUNDS, MENU_MUSIC, ...VICTORY_MUSIC];
  for (const stage of stages) paths.push(stageMusic(stage));
  for (const character of characters) paths.push(readyVoice(character), warcryVoice(character));
  return paths.filter((path, index) => paths.indexOf(path) === index);
}
