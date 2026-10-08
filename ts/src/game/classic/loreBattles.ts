// Lore Battles (#305): twenty configured matches recreating Warcraft III
// moments, each one data entry played through Classic's engine
// (configuredMatch.ts). The list climbs from Rookie to Expert; a won battle
// is cleared on this client (loreClears.ts) and a lost one can be retried.
import { at } from "wisp/src/runtime/lookup";
import { type CpuOpponentId, type CpuTier } from "../match/cpuProfiles";
import { type MatchState, Phase, endConfiguredRun, firstHumanSlot } from "../match/rules";
import { stageInfo, type StageTile } from "../menu/stageCatalog";
import { Character } from "../sim/codes";
import { fighterName } from "../sim/heroes/registry";
import { bossDefinition, bossHealth } from "./bosses";
import { runTime } from "./classicText";
import { applyConfiguredMatch, beginConfiguredRun } from "./configuredMatch";
import { BossKind, type ConfiguredMatch, RunOutcome, WinCondition } from "./runState";

export interface LoreBattle extends ConfiguredMatch {
  readonly title: string;
  readonly player: Character;
}

const C = Character;
const IDENTITIES: readonly CpuOpponentId[] = ["vale", "ember", "flint", "kite", "rook", "wren"];

interface BattleSpec {
  readonly id: string;
  readonly title: string;
  readonly player: Character;
  /** The computers, all at `tier`. */
  readonly against: readonly Character[];
  readonly tier: CpuTier;
  readonly stage: StageTile;
  readonly win: WinCondition;
  readonly minutes: number;
  readonly playerStocks: number;
  readonly opponentStocks: number;
  readonly playerDamage?: number;
  readonly opponentDamage?: number;
  readonly hazards?: boolean;
  readonly speaker: string;
  readonly intro: string;
}

function battle(spec: BattleSpec): LoreBattle {
  return {
    id: `lore.${spec.id}`, title: spec.title, player: spec.player,
    opponents: spec.against.map((character, index) => ({
      character, opponent: at(IDENTITIES, index), tier: spec.tier, stocks: spec.opponentStocks, damage: spec.opponentDamage ?? 0,
    })),
    stage: spec.stage, stocks: spec.opponentStocks, playerStocks: spec.playerStocks, timeMinutes: spec.minutes,
    playerDamage: spec.playerDamage ?? 0, hazards: spec.hazards ?? true, win: spec.win, boss: BossKind.none, bossHealth: 0, last: true,
    speaker: spec.speaker, intro: spec.intro,
  };
}

/** A boss battle on the boss's own stage with hazards off, its health from `tier` (an index into CPU_TIERS). */
function bossBattle(id: string, title: string, player: Character, boss: BossKind, tier: number, minutes: number, playerStocks: number, intro: string): LoreBattle {
  const definition = bossDefinition(boss);
  return {
    id: `lore.${id}`, title, player, opponents: [], stage: definition?.stage ?? 2, stocks: playerStocks, playerStocks, timeMinutes: minutes,
    playerDamage: 0, hazards: false, win: WinCondition.defeatBoss, boss, bossHealth: bossHealth(boss, tier), last: true,
    speaker: definition?.name ?? "", intro,
  };
}

const { ko, survive, koWithinClock } = WinCondition;

export const LORE_BATTLES: readonly LoreBattle[] = [
  battle({
    id: "me-busy", title: "Me Busy, Leave Me Alone", player: C.peon, against: [C.tinker], tier: "rookie", stage: 12,
    win: survive, minutes: 1, playerStocks: 2, opponentStocks: 2, speaker: "Peon", intro: "Me busy. Leave me alone!",
  }),
  battle({
    id: "exodus", title: "Exodus of the Horde", player: C.thrall, against: [C.rifleman], tier: "rookie", stage: 11,
    win: ko, minutes: 3, playerStocks: 2, opponentStocks: 1, speaker: "Thrall", intro: "The humans have found our camps. Break through, and we sail west!",
  }),
  battle({
    id: "murlocs-tomb", title: "The Murloc's Tomb of Sargeras", player: C.murloc, against: [C.warden], tier: "rookie", stage: 7,
    win: survive, minutes: 1, playerStocks: 2, opponentStocks: 3, speaker: "Murloc", intro: "Mrglglgl! The jailor wants the shiny tomb back!",
  }),
  battle({
    id: "darkspear", title: "The Darkspear Rescue", player: C.shadowHunter, against: [C.murloc], tier: "beginner", stage: 3,
    win: ko, minutes: 3, playerStocks: 2, opponentStocks: 2, speaker: "Sen'jin", intro: "Da murlocs be draggin' my people to da sea witch, mon!",
  }),
  battle({
    id: "thunder-brew", title: "The Brewmaster's Thunder Brew", player: C.chen, against: [C.peon], tier: "beginner", stage: 13,
    win: koWithinClock, minutes: 2, playerStocks: 2, opponentStocks: 2, opponentDamage: 40,
    speaker: "Chen Stormstout", intro: "Someone drank my thunder brew. Now someone gets a lesson!",
  }),
  battle({
    id: "culling", title: "The Culling of Stratholme", player: C.forsakenPaladin, against: [C.dreadlord], tier: "beginner", stage: 6,
    win: koWithinClock, minutes: 2, playerStocks: 2, opponentStocks: 1, speaker: "Arthas", intro: "This entire city must be purged.",
  }),
  battle({
    id: "frostmourne", title: "Frostmourne", player: C.lichKing, against: [C.mountainKing], tier: "beginner", stage: 2,
    win: ko, minutes: 3, playerStocks: 2, opponentStocks: 2, speaker: "Muradin Bronzebeard", intro: "Leave it be, Arthas. Forget this business and lead your men home.",
  }),
  battle({
    id: "dalaran", title: "The Siege of Dalaran", player: C.lich, against: [C.kaelthas], tier: "intermediate", stage: 0,
    win: survive, minutes: 2, playerStocks: 2, opponentStocks: 3, speaker: "Kel'Thuzad", intro: "Hold the circle until the Book of Medivh calls my master forth!",
  }),
  battle({
    id: "mannoroth", title: "The Death of Mannoroth", player: C.blademaster, against: [C.pitLord], tier: "intermediate", stage: 13,
    win: ko, minutes: 3, playerStocks: 2, opponentStocks: 2, opponentDamage: 30,
    speaker: "Thrall", intro: "The blood curse is broken, Grom. Take your vengeance on Mannoroth!",
  }),
  battle({
    id: "proudmoore", title: "The Admiral's Landing", player: C.beastmaster, against: [C.rifleman, C.mountainKing], tier: "intermediate", stage: 11,
    win: ko, minutes: 3, playerStocks: 3, opponentStocks: 1, speaker: "Rexxar", intro: "Proudmoore's marines burn the Horde's shore. Misha, hunt!",
  }),
  battle({
    id: "silvermoon", title: "The Gates of Silvermoon", player: C.sylvanas, against: [C.lichKing], tier: "intermediate", stage: 4,
    win: survive, minutes: 2, playerStocks: 2, opponentStocks: 3, playerDamage: 30,
    speaker: "Sylvanas Windrunner", intro: "You'll not pass the gates of Silvermoon while I still draw breath!",
  }),
  battle({
    id: "hyjal-alliance", title: "Mount Hyjal: Jaina's Stand", player: C.jaina, against: [C.lich, C.dreadlord], tier: "advanced", stage: 10,
    win: survive, minutes: 2, playerStocks: 3, opponentStocks: 2, speaker: "Jaina Proudmoore", intro: "Rage Winterchill marches on our base. Hold until the Horde is ready!",
  }),
  battle({
    id: "hyjal-horde", title: "Mount Hyjal: The Horde Holds", player: C.cairne, against: [C.pitLord], tier: "advanced", stage: 10,
    win: survive, minutes: 2, playerStocks: 2, opponentStocks: 3, playerDamage: 40,
    speaker: "Cairne Bloodhoof", intro: "Azgalor's fire reaches the totems. Stand fast, my brothers. The Earthmother watches!",
  }),
  battle({
    id: "skull", title: "The Skull of Gul'dan", player: C.demonHunter, against: [C.dreadlord], tier: "advanced", stage: 14,
    win: koWithinClock, minutes: 2, playerStocks: 2, opponentStocks: 2, speaker: "Tichondrius", intro: "Drink of the Skull, night elf, and become what you were meant to be.",
  }),
  battle({
    id: "maiev", title: "The Hunt for Illidan", player: C.warden, against: [C.demonHunter], tier: "advanced", stage: 7,
    win: koWithinClock, minutes: 3, playerStocks: 2, opponentStocks: 2, speaker: "Maiev Shadowsong", intro: "You will not escape me this time, Illidan.",
  }),
  bossBattle("archimonde", "The Battle of Mount Hyjal", C.warden, BossKind.archimonde, 3, 5, 2,
    "The World Tree is mine. Your feeble races will burn with this world!"),
  battle({
    id: "magtheridon", title: "Lord of Outland", player: C.kaelthas, against: [C.pitLord], tier: "expert", stage: 14,
    win: ko, minutes: 3, playerStocks: 2, opponentStocks: 2, speaker: "Magtheridon", intro: "Illidan sends a blood elf to take my citadel? Hellfire is mine!",
  }),
  bossBattle("kiljaeden", "Kil'jaeden's Ultimatum", C.demonHunter, BossKind.kiljaeden, 4, 5, 2,
    "You have failed me, Illidan. Destroy the Lich King, or know my wrath."),
  battle({
    id: "frozen-throne", title: "Illidan at the Frozen Throne", player: C.demonHunter, against: [C.lichKing], tier: "expert", stage: 2,
    win: koWithinClock, minutes: 2, playerStocks: 1, opponentStocks: 1, speaker: "Arthas", intro: "Look at you, Illidan. You failed. And now you die.",
  }),
  bossBattle("ascension", "The Ascension", C.lichKing, BossKind.lichKing, 4, 5, 2,
    "Now, champion. Shatter the ice that binds me, and we shall be one."),
];

export const loreBattle = (index: number): LoreBattle | undefined => LORE_BATTLES[index];

/** Fighter selection with Lore Battles chosen: the first player's start begins the chosen battle. */
export function startLore(game: MatchState, slot: number): boolean {
  const first = firstHumanSlot(game);
  const entry = loreBattle(game.loreBattle);
  if (game.phase !== Phase.characterMenu || !game.lore || game.run.active || first === undefined || slot !== first || entry === undefined) return false;
  beginConfiguredRun(game, first, entry.player);
  game.run.fight = game.loreBattle;
  applyConfiguredMatch(game, entry);
  return true;
}

export const LoreStep = { none: 0, retry: 1, menu: 2 } as const;
export type LoreStep = (typeof LoreStep)[keyof typeof LoreStep];

/** The player's confirm at a result: a clear returns to the menu with the next battle chosen, a loss retries. */
export function continueLore(game: MatchState, slot: number): LoreStep {
  const { run } = game;
  const entry = run.current;
  if (game.phase !== Phase.result || !run.active || !game.lore || slot !== run.player || entry === undefined) return LoreStep.none;
  if (run.cleared) {
    game.loreBattle = Math.min(LORE_BATTLES.length - 1, run.fight + 1);
    endConfiguredRun(game);
    return LoreStep.menu;
  }
  run.continues++;
  applyConfiguredMatch(game, entry);
  return LoreStep.retry;
}

export function goalText(entry: Readonly<ConfiguredMatch>): string {
  const clock = runTime(entry.timeMinutes * 60 * 60);
  switch (entry.win) {
    case WinCondition.survive: return `Survive ${clock}`;
    case WinCondition.koWithinClock: return `KO them within ${clock}`;
    case WinCondition.defeatBoss: return `Defeat ${bossDefinition(entry.boss)?.name ?? "the boss"}`;
    default: return "Win the match";
  }
}

/** The battle stepper's value at fighter selection. */
export function loreBattleSetting(index: number, cleared: boolean): string {
  const entry = loreBattle(index);
  if (entry === undefined) return "";
  return `${index + 1}/${LORE_BATTLES.length} ${entry.title}${cleared ? " |cff40ff40(cleared)|r" : ""}`;
}

/** Under the stepper: who fights whom, where, the goal, and the client's clears. */
export function loreBattleSummary(index: number, clears: number): string {
  const entry = loreBattle(index);
  if (entry === undefined) return "";
  const against = entry.boss === BossKind.none ? entry.opponents.map(opponent => fighterName(opponent.character)).join(" and ") : bossDefinition(entry.boss)?.name ?? "";
  const tier = entry.opponents[0]?.tier;
  const level = tier === undefined ? "" : ` (${tier.charAt(0).toUpperCase()}${tier.slice(1)})`;
  return `${fighterName(entry.player)} vs ${against}${level} · ${stageInfo(entry.stage).name} · ${goalText(entry)}\n${clears} of ${LORE_BATTLES.length} cleared`;
}

/** Shown as a battle starts: its title, goal and transmission. */
export function loreIntro(game: Readonly<MatchState>): string {
  const entry = loreBattle(game.run.fight);
  if (entry === undefined) return "";
  return `${entry.title} — ${goalText(entry)}\n${entry.speaker}: "${entry.intro}"`;
}

export function loreResultMessage(game: Readonly<MatchState>): string {
  const entry = loreBattle(game.run.fight);
  return game.run.outcome === RunOutcome.won ? `Lore Battle cleared: ${entry?.title ?? ""}!` : "Defeated.";
}

export function loreResultHelp(game: Readonly<MatchState>, confirm: string): string {
  if (game.run.cleared) return `Press ${confirm} to return to the battle list.`;
  return `Press ${confirm} to try again. Back returns to the battle list.`;
}
