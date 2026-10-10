



import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS, type ParticipantSlot, participantActive } from "../input/participants";
import { type MatchState, Phase } from "../match/rules";
import type { Character } from "../sim/codes";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { BossKind, type ConfiguredMatch, RunOutcome, WinCondition, resetBossState } from "./runState";






function opponentSlot(player: number, humans: number, index: number): ParticipantSlot | undefined {
  let seen = 0;
  for (const watching of [false, true]) {
    for (const slot of PARTICIPANT_SLOTS) {
      if (slot === player || participantActive(humans, slot) !== watching) continue;
      if (seen === index) return slot;
      seen++;
    }
  }
  return undefined;
}


export function beginConfiguredRun(game: MatchState, player: ParticipantSlot, fighter: Character): void {
  const { run } = game;
  run.active = true;
  run.player = player;
  run.fighter = fighter;
  run.fight = 0;
  run.outcome = RunOutcome.none;
  run.cleared = false;
  run.frames = 0;
  run.damageTaken = 0.0;
  run.lastDamage = 0.0;
  run.continues = 0;
  run.savedHumanFighters = game.humanFighterMask;
  run.savedComputers = game.computerMask;
  run.savedStocks = game.stockCount;
  run.savedMinutes = game.timeLimitMinutes;
  run.savedHazards = game.hazards;
  run.savedItems = game.items.on;
}





export function applyConfiguredMatch(game: MatchState, entry: ConfiguredMatch): void {
  const { run } = game;
  const player = run.player;
  run.current = entry;
  run.outcome = RunOutcome.none;
  run.lastDamage = f32(entry.playerDamage);
  game.characterChoices[player] = entry.player ?? run.fighter;
  game.characterReadiness[player] = true;
  let computers = 0;
  for (let index = 0; index < entry.opponents.length; index++) {
    const opponent = entry.opponents[index];
    const slot = opponentSlot(player, game.humanMask, index);
    if (opponent === undefined || slot === undefined) continue;
    computers |= 1 << slot;
    game.characterChoices[slot] = opponent.character;
    game.cpuOpponents[slot] = opponent.opponent;
    game.cpuTiers[slot] = opponent.tier;
    game.characterReadiness[slot] = true;
  }
  game.humanFighterMask = 1 << player;
  game.computerMask = computers;
  game.stockCount = entry.playerStocks ?? entry.stocks;
  game.timeLimitMinutes = entry.timeMinutes;
  game.endless = false;
  game.training = false;
  game.automaticRematch = false;
  game.hazards = entry.hazards;
  game.items.on = false;
  game.stageChoice = entry.stage;
  game.stageResolved = true;
  game.rematchReadiness.fill(false);
  resetBossState(run.boss, entry.boss, entry.boss === BossKind.none ? 0 : entry.bossHealth);
  game.phase = Phase.stageMenu;
}


export function applyConfiguredStart(game: Readonly<MatchState>, world: Roster): void {
  const { run } = game;
  const entry = run.current;
  if (!run.active || entry === undefined) return;
  if (isActive(world, run.player)) {
    const player = fighterAt(world, run.player);
    player.status.stocks = entry.playerStocks ?? entry.stocks;
    player.status.damage = f32(entry.playerDamage);
  }
  for (let index = 0; index < entry.opponents.length; index++) {
    const opponent = entry.opponents[index];
    const slot = opponentSlot(run.player, game.humanMask, index);
    if (opponent === undefined || slot === undefined || !isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    fighter.status.stocks = opponent.stocks ?? entry.stocks;
    fighter.status.damage = f32(opponent.damage ?? 0.0);
  }
}


function configuredOutcome(game: Readonly<MatchState>, world: Readonly<Roster>): RunOutcome {
  const { run } = game;
  const entry = run.current;
  if (entry === undefined || game.interrupted) return RunOutcome.lost;
  const alive = isActive(world, run.player) && fighterAt(world, run.player).status.stocks > 0;
  const won = game.winner === run.player;
  switch (entry.win) {
    case WinCondition.survive: return alive && (game.timedOut || won) ? RunOutcome.won : RunOutcome.lost;
    case WinCondition.koWithinClock: return won && !game.timedOut ? RunOutcome.won : RunOutcome.lost;
    case WinCondition.defeatBoss: return alive && run.boss.health <= 0 ? RunOutcome.won : RunOutcome.lost;
    default: return won ? RunOutcome.won : RunOutcome.lost;
  }
}


export function trackConfiguredFrame(game: MatchState, world: Readonly<Roster>): void {
  const { run } = game;
  if (!run.active || !isActive(world, run.player)) return;
  const damage = fighterAt(world, run.player).status.damage;
  if (damage > run.lastDamage) run.damageTaken = f32(run.damageTaken + f32(damage - run.lastDamage));
  run.lastDamage = damage;
}


export function settleConfiguredMatch(game: MatchState, world: Readonly<Roster>): void {
  const { run } = game;
  if (!run.active || run.current === undefined) return;
  run.outcome = configuredOutcome(game, world);
  if (run.outcome === RunOutcome.won && run.current.last) run.cleared = true;
  run.frames += Math.max(0, game.matchFrame - game.startHold);
}
