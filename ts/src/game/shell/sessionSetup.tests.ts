import { assertEquals, test } from "wisp/src/runtime/testing";
import { createMatchState, setParticipants } from "../match/rules";
import { Character } from "../sim/codes";
import { fighterName } from "../sim/heroes/registry";
import { applySetupCommand } from "./sessionSetup";

const twoPlayers = () => {
  const game = createMatchState();
  setParticipants(game, 3, 0);
  return game;
};

test("slot commands reach any tag combination from the lobby's, by the tag clicks' rule [spec docs/native-bot-session.md]", () => {
  const game = twoPlayers();

  game.computerMask = 12;
  assertEquals(applySetupCommand(game, 0, "-dev slots 3 0"), "dev: slots human-fighters=3 computers=0");
  assertEquals(`${game.humanFighterMask} ${game.computerMask}`, "3 0");
  for (const [humans, computers] of [[7, 0], [3, 4], [11, 4], [3, 12]] as const) {
    assertEquals(applySetupCommand(game, 0, `-dev slots ${humans} ${computers}`), `dev: slots human-fighters=${humans} computers=${computers}`);
    assertEquals(`${game.humanFighterMask} ${game.computerMask}`, `${humans} ${computers}`);
  }

  assertEquals(applySetupCommand(game, 1, "-dev slots 3 0"), "dev: slots refused");
  assertEquals(applySetupCommand(game, 0, "-dev slots 3 3"), "dev: slots refused");
  assertEquals(applySetupCommand(game, 0, "-dev slots 3"), "dev: slots refused");
  assertEquals(applySetupCommand(game, 0, "-dev slots 03 0"), "dev: slots refused");
  assertEquals(applySetupCommand(game, 0, "-dev show"), undefined);
});

test("fighter commands set a computer's fighter or the typist's own, and nobody else's [spec docs/native-bot-session.md]", () => {
  const game = twoPlayers();
  applySetupCommand(game, 0, "-dev slots 3 12");
  const illidan = fighterName(Character.demonHunter);
  assertEquals(applySetupCommand(game, 0, `-dev fighter 3 ${illidan.toLowerCase()}`), `dev: player 3 plays ${illidan}`);
  assertEquals(applySetupCommand(game, 0, `-dev fighter 4 ${fighterName(Character.rifleman)}`), `dev: player 4 plays ${fighterName(Character.rifleman)}`);
  assertEquals(`${game.characterChoices[2]} ${game.characterChoices[3]}`, `${Character.demonHunter} ${Character.rifleman}`);
  assertEquals(applySetupCommand(game, 0, `-dev fighter 1 ${illidan}`), `dev: player 1 plays ${illidan}`);
  assertEquals(game.characterReadiness[0], true);
  assertEquals(applySetupCommand(game, 0, `-dev fighter 2 ${illidan}`), "dev: fighter refused");
  assertEquals(applySetupCommand(game, 0, "-dev fighter 3 nobody"), "dev: fighter refused");
  assertEquals(applySetupCommand(game, 0, "-dev fighter 5 rifleman"), "dev: fighter refused");
});
