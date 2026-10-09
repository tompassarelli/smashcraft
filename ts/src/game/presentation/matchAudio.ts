


import { at } from "wisp/src/runtime/lookup";
import { Character } from "../sim/codes";
import { type StageTile, selectableStage } from "../menu/stageCatalog";


export const MatchCue = {
  three: 0, two: 1, one: 2, go: 3, game: 4, time: 5, stockLost: 6, lastStock: 7, hover: 8, confirm: 9, cheer: 10, meterReady: 11, itemSpawn: 12,
} as const;
export type MatchCue = (typeof MatchCue)[keyof typeof MatchCue];





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
  "Sound\\Interface\\ItemReceived.flac",
  "Sound\\Interface\\Hint.flac",
];

export const cueSound = (cue: MatchCue): string => at(CUE_SOUNDS, cue);



const MUSIC = "Sound\\Music\\mp3Music\\";


export const MENU_MUSIC = `${MUSIC}War3XMainScreen.flac`;





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


export const stageMusic = (stage: number): string => (selectableStage(stage) ? STAGE_MUSIC[stage] : STAGE_MUSIC[0]);

export const Race = { human: 0, orc: 1, nightElf: 2, undead: 3 } as const;
export type Race = (typeof Race)[keyof typeof Race];


const RACES: Readonly<Record<Character, Race>> = {
  23: Race.undead,
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
  22: Race.orc,
  24: Race.nightElf,
  25: Race.human,
};

export const characterRace = (character: Character): Race => RACES[character];


const VICTORY_MUSIC: readonly string[] = [
  `${MUSIC}HumanVictory.flac`, `${MUSIC}OrcVictory.flac`, `${MUSIC}NightElfVictory.flac`, `${MUSIC}UndeadVictory.flac`,
];


export const victoryMusic = (winner: Character | undefined): string | undefined =>
  winner === undefined ? undefined : at(VICTORY_MUSIC, characterRace(winner));






const VOICES: Readonly<Record<Exclude<Character, typeof Character.medivh>, readonly [string, string, string?, string?]>> = {
  23: ["Units\\Undead\\HeroCryptLord\\", "NerubianCryptLord"],
  1: ["Units\\Human\\Rifleman\\", "Rifleman"],
  2: ["Units\\NightElf\\HeroDemonHunter\\", "HeroDemonHunter"],
  3: ["Units\\Orc\\HeroBladeMaster\\", "HeroBladeMaster"],
  4: ["Units\\Human\\HeroMountainKing\\", "HeroMountainKing"],
  5: ["Units\\NightElf\\HeroWarden\\", "HeroWarden"],
  6: ["Units\\Undead\\HeroLich\\", "HeroLich"],
  7: ["Units\\Undead\\HeroDeathKnight\\", "DeathKnight"],
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
  22: ["Units\\Orc\\Hellscream\\", "Grom"],
  24: ["Units\\NightElf\\Furion\\", "Furion", "What"],
};

function voice(character: Character, line: string): string {
  if (character === Character.medivh) return `Sound\\Dialogue\\TutorialCampaign\\Tutorial01\\T01Medivh${line === "Ready" ? "02" : "59"}.flac`;
  const [directory, prefix, ready, warcry] = VOICES[character];
  const spoken = line === "Ready" ? ready ?? line : line === "Warcry" ? warcry ?? line : line;
  return `${directory}${prefix}${spoken}1.flac`;
}


export const readyVoice = (character: Character): string => voice(character, "Ready");


export const warcryVoice = (character: Character): string => voice(character, "Warcry");


export function victoryAnimation(character: Character): string {
  switch (character) { case Character.blademaster: case Character.forsakenPaladin: case Character.shadowHunter:
      return "stand victory";

    case Character.lich: case Character.pitLord:
      return "stand channel";
    default:
      return "stand ready";
  }
}


export function presentationSoundPaths(characters: readonly Character[], stages: readonly StageTile[]): string[] {
  const paths = [...CUE_SOUNDS, MENU_MUSIC, ...VICTORY_MUSIC];
  for (const stage of stages) paths.push(stageMusic(stage));
  for (const character of characters) paths.push(readyVoice(character), warcryVoice(character));
  return paths.filter((path, index) => paths.indexOf(path) === index);
}
