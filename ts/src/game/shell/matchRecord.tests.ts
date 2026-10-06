import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { testMatch } from "../match/testMatch";
import { Phase } from "../match/rules";
import { createMatchTally } from "../presentation/matchCues";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { fighterAt } from "../sim/roster";
import { matchRecordFile } from "../../runtime/gameFiles";
import { MATCH_RECORD_HEADER, matchRecordLines, nextSerial, ratio, recordValue } from "./matchRecord";

/** Mountain King (P1, human) beat a Lich computer (P2) on Frozen Throne. */
function finishedMatch() {
  const match = testMatch(3, Character.mountainKing);
  const { game, world } = match;
  world.fighters[1] = createFighter(Character.lich, 0.0, -1);
  game.humanMask = 1;
  game.humanFighterMask = 1;
  game.computerMask = 2;
  game.stageChoice = 2;
  game.stockCount = 3;
  game.timeLimitMinutes = 7;
  game.matchFrame = 4521;
  game.phase = Phase.result;
  game.winner = 0;
  fighterAt(world, 0).status.stocks = 2;
  fighterAt(world, 0).status.damage = 37.75;
  fighterAt(world, 1).status.stocks = 0;
  fighterAt(world, 1).status.damage = 112.5;
  const tally = createMatchTally();
  tally.kos[0] = 3;
  tally.falls[0] = 1;
  tally.kos[1] = 1;
  tally.falls[1] = 3;
  tally.combat.dealt[0] = 141.5;
  tally.combat.openings[0] = 9;
  tally.combat.techs[0] = 2;
  tally.combat.missedTechs[0] = 1;
  tally.combat.ledgeGrabs[0] = 4;
  tally.combat.dealt[1] = 36.0;
  tally.combat.openings[1] = 3;
  tally.combat.ledgeGrabs[1] = 1;
  return { game, world, tally };
}

test("a finished match's record names the build, rules, result, stage and every fighter's stocks, damage, KOs, falls and combat stats", () => {
  const { game, world, tally } = finishedMatch();
  const lines = matchRecordLines({ build: "0.0.52", serial: 7, local: 0, players: ["Tom#1234", undefined, undefined, undefined] }, game, world, tally);
  assertEquals(lines.join("\n"), [
    `${MATCH_RECORD_HEADER} v=1 build=0.0.52 serial=7 local=P1 mode=versus`,
    "rules stocks=3 minutes=7",
    "result frames=4521 winner=P1 timed-out=0 interrupted=0",
    "stage id=2 name=Frozen Throne",
    `fighter slot=P1 kind=human player=Tom#1234 character=${Character.mountainKing} stocks=2 damage=37 kos=3 falls=1 left=0 name=Mountain King`,
    "combat slot=P1 dealt=141 openings=9 per-opening=15.6 openings-per-ko=3.0 techs=2 missed-techs=1 ledge-grabs=4",
    `fighter slot=P2 kind=computer character=${Character.lich} stocks=0 damage=112 kos=1 falls=3 left=0 name=Lich`,
    "combat slot=P2 dealt=36 openings=3 per-opening=12.0 openings-per-ko=3.0 techs=0 missed-techs=0 ledge-grabs=1",
    "end lines=8",
  ].join("\n"));
});

test("a record from an observer, a draw and a departed player says so", () => {
  const { game, world, tally } = finishedMatch();
  game.computerMask = 0;
  game.humanMask = 3;
  game.winner = undefined;
  game.interrupted = true;
  game.departedMask = 2;
  const lines = matchRecordLines({ build: "dev build", serial: 1, local: 5, players: ["A", "Name \"with\" spaces", undefined, undefined] }, game, world, tally);
  assertEquals(lines[0], `${MATCH_RECORD_HEADER} v=1 build=dev_build serial=1 local=none mode=versus`);
  assertEquals(lines[2], "result frames=4521 winner=none timed-out=0 interrupted=1");
  assertTrue((lines[6] ?? "").includes("kind=human player=Name__with__spaces "));
  assertTrue((lines[6] ?? "").includes(" left=1 "));
});

test("record lines fit a Preload line and hold nothing a JASS string can't", () => {
  const { game, world, tally } = finishedMatch();
  const lines = matchRecordLines({ build: "x".repeat(40), serial: 123456, local: 0, players: ["p".repeat(40), undefined, undefined, undefined] }, game, world, tally);
  for (const line of lines) {
    assertTrue(line.length <= 200);
    assertTrue(!line.includes("\"") && !line.includes("\\"));
  }
  assertEquals(recordValue("a b=c\"d\\e"), "a_b_c_d_e");
});

test("record serials continue from the index and start at 1 without one", () => {
  assertEquals(ratio(7, 0), "none");
  assertEquals(ratio(10, 3), "3.3");
  assertEquals(ratio(4, 4), "1.0");
  assertEquals(nextSerial(undefined), 1);
  assertEquals(nextSerial(""), 1);
  assertEquals(nextSerial("junk"), 1);
  assertEquals(nextSerial("0"), 1);
  assertEquals(nextSerial("42"), 42);
  assertEquals(matchRecordFile(nextSerial("42")), "smashcraft-match-42.txt");
});
