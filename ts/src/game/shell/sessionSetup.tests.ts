import { assertEquals, test } from "wisp/src/runtime/testing";
import { Phase, createMatchState, setParticipants } from "../match/rules";
import { Character } from "../sim/codes";
import { fighterName } from "../sim/heroes/registry";
import { applySetupCommand } from "./sessionSetup";

const twoPlayers = () => {
  const game = createMatchState();
  setParticipants(game, 3, 0);
  return game;
};

test("slot commands reach any tag combination from the lobby's, by the tag clicks' rule", () => {
  const game = twoPlayers();
  // The lobby's computer players in C and D, as a Battle.net lobby leaves them.
  game.computerMask = 12;
  assertEquals(applySetupCommand(game, 0, "-dev slots 3 0"), "dev: slots human-fighters=3 computers=0");
  assertEquals(`${game.humanFighterMask} ${game.computerMask}`, "3 0");
  for (const [humans, computers] of [[7, 0], [3, 4], [11, 4], [3, 12]] as const) {
    assertEquals(applySetupCommand(game, 0, `-dev slots ${humans} ${computers}`), `dev: slots human-fighters=${humans} computers=${computers}`);
    assertEquals(`${game.humanFighterMask} ${game.computerMask}`, `${humans} ${computers}`);
  }
  // Player 2 may change only their own tag; overlapping masks and other spellings are refused.
  assertEquals(applySetupCommand(game, 1, "-dev slots 3 0"), "dev: slots refused");
  assertEquals(applySetupCommand(game, 0, "-dev slots 3 3"), "dev: slots refused");
  assertEquals(applySetupCommand(game, 0, "-dev slots 3"), "dev: slots refused");
  assertEquals(applySetupCommand(game, 0, "-dev slots 03 0"), "dev: slots refused");
  assertEquals(applySetupCommand(game, 0, "-dev show"), undefined);
});

test("fighter commands set a computer's fighter or the typist's own, and nobody else's", () => {
  const game = twoPlayers();
  applySetupCommand(game, 0, "-dev slots 3 12");
  const illidan = fighterName(Character.demonHunter);
  assertEquals(applySetupCommand(game, 0, `-dev fighter 3 ${illidan.toLowerCase()}`), `dev: player 3 plays ${illidan}`);
  assertEquals(applySetupCommand(game, 0, `-dev fighter 4 ${fighterName(Character.archer)}`), `dev: player 4 plays ${fighterName(Character.archer)}`);
  assertEquals(`${game.characterChoices[2]} ${game.characterChoices[3]}`, `${Character.demonHunter} ${Character.archer}`);
  assertEquals(applySetupCommand(game, 0, `-dev fighter 1 ${illidan}`), `dev: player 1 plays ${illidan}`);
  assertEquals(game.characterReadiness[0], true);
  assertEquals(applySetupCommand(game, 0, `-dev fighter 2 ${illidan}`), "dev: fighter refused");
  assertEquals(applySetupCommand(game, 0, "-dev fighter 3 nobody"), "dev: fighter refused");
  assertEquals(applySetupCommand(game, 0, "-dev fighter 5 archer"), "dev: fighter refused");
});

test("rule and stage commands set fighter selection's values within their ranges", () => {
  const game = twoPlayers();
  assertEquals(applySetupCommand(game, 1, "-dev stocks 1"), "dev: 1 stocks");
  assertEquals(applySetupCommand(game, 1, "-dev time 1"), "dev: 1 minutes");
  assertEquals(applySetupCommand(game, 1, "-dev auto-rematch on"), "dev: automatic rematch on");
  assertEquals(applySetupCommand(game, 0, "-dev stage 0"), "dev: stage 0");
  assertEquals(`${game.stockCount} ${game.timeLimitMinutes} ${game.automaticRematch} ${game.stageChoice}`, "1 1 true 0");
  assertEquals(applySetupCommand(game, 0, "-dev stocks 10"), "dev: stocks refused");
  assertEquals(applySetupCommand(game, 0, "-dev time 11"), "dev: time refused");
  assertEquals(applySetupCommand(game, 0, "-dev auto-rematch yes"), "dev: automatic rematch refused");
  assertEquals(applySetupCommand(game, 0, "-dev stage 99"), "dev: stage refused");
  assertEquals(applySetupCommand(game, 2, "-dev stage 2"), "dev: stage refused");
  // The stage can still change at stage selection; nothing changes in a match.
  game.phase = Phase.stageMenu;
  assertEquals(applySetupCommand(game, 0, "-dev stage 2"), "dev: stage 2");
  game.phase = Phase.match;
  assertEquals(applySetupCommand(game, 0, "-dev stage 0"), "dev: stage refused");
  assertEquals(applySetupCommand(game, 0, "-dev stocks 2"), "dev: stocks refused");
  assertEquals(applySetupCommand(game, 0, "-dev slots 3 4"), "dev: slots refused");
  assertEquals(game.stageChoice, 2);
});
