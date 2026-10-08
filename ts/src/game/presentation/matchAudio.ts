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
const RACES: Readonly<Record<Character, Race>> = {
  1: Race.human,
  2: Race.nightElf,
  3: Race.orc,
  4: Race.human,
  5: Race.nightElf,
  6: Race.undead,
  7: Race.human,
  8: Race.undead,
  9: Race.orc,
  10: Race.undead,
  11: Race.orc,
  12: Race.undead,
  13: Race.orc,
  14: Race.human,
  15: Race.undead,
  16: Race.orc,
  17: Race.orc,
  18: Race.orc,
  19: Race.orc,
  20: Race.human,
  21: Race.nightElf,
  26: Race.human,
};

export const characterRace = (character: Character): Race => RACES[character];

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
const VOICES: Readonly<Record<Character, readonly [string, string, string?, string?]>> = {
  1: ["Units\\Human\\Rifleman\\", "Rifleman"],
  2: ["Units\\NightElf\\HeroDemonHunter\\", "HeroDemonHunter"],
  3: ["Units\\Orc\\HeroBladeMaster\\", "HeroBladeMaster"],
  4: ["Units\\Human\\HeroMountainKing\\", "HeroMountainKing"],
  5: ["Units\\NightElf\\HeroWarden\\", "HeroWarden"],
  6: ["Units\\Undead\\HeroLich\\", "HeroLich"],
  7: ["Units\\Human\\Uther\\", "Uther"],
  8: ["Units\\Undead\\HeroDreadLord\\", "HeroDreadLord"],
  9: ["Units\\Orc\\HeroShadowHunter\\", "ShadowHunter"],
  10: ["Units\\Demon\\HeroPitLord\\", "HPitLord"],
  11: ["Units\\Creeps\\BeastMaster\\", "OgreBeastMaster"],
  12: ["Units\\Undead\\EvilArthas\\", "EvilArthas", "What"],
  13: ["Units\\Orc\\Thrall\\", "Thrall"],
  14: ["Units\\Human\\Jaina\\","Jaina","What"],
  15: ["Units\\Undead\\EvilSylvanas\\","EvilSylvanas"],
  16: ["Units\\Orc\\Cairne\\","Cairne"],
  17: ["Units\\Creeps\\PandarenBrewmaster\\","PandarenBrewmaster"],
  18: ["Units\\Orc\\Peon\\","Peon"],
  19: ["Units\\Creeps\\HeroTinker\\","HeroTinker"],
  20: ["Units\\Human\\Kael\\","Kael"],
  21: ["Units\\Creeps\\Murloc\\", "Murloc", "Ready", "YesAttack"],
  26: ["Units\\Creeps\\Kobold\\", "Kobold", "What", "YesAttack"],
};

function voice(character: Character, line: string): string {
  const [directory, prefix, ready, warcry] = VOICES[character];
  const spoken = line === "Ready" ? ready ?? line : line === "Warcry" ? warcry ?? line : line;
  return `${directory}${prefix}${spoken}1.flac`;
}

/** The line a hero says when trained: played when a player confirms that fighter. */
export const readyVoice = (character: Character): string => voice(character, "Ready");

/** The hero's battle cry: played for the winner on the results screen. */
export const warcryVoice = (character: Character): string => voice(character, "Warcry");

/** The model animation the winner plays at the results; models without one stand ready. */
export function victoryAnimation(character: Character): string {
  switch (character) { case Character.blademaster: case Character.forsakenPaladin: case Character.shadowHunter:
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
