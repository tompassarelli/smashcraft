




import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { type SoakGame, type SoakInputs, type SoakMatch, playSoakMatch, readSoakRepro } from "wisp/scripts/wisp/soak";
import project from "../scripts/wisp/soak";
import game from "./soak/game";
import { Phase } from "../src/game/match/rules";
import { shell } from "../src/platform/shell/state";
import phaseRepro from "../../evidence/camera-blastzones-20261006/match-72.json";
import { sweep } from "./sweep";

const runtime = installHeadless(project.map);
afterAll(runtime.restore);

const match: SoakMatch = { index: 0, seed: 96542, fighters: ["rifleman", "rifleman"], stage: "sky-deck", policies: ["fuzz", "cpu"], frames: 30 };
const quiet: SoakInputs = { edges: [], silences: [], hitches: [], slow: [] };

sweep("offscreen indicators follow the presented result while confirmation is still finishing the match [native]", () => {
  const repro = readSoakRepro(JSON.stringify(phaseRepro));
  let sawResultAhead = false;
  const cameraFindings: string[] = [];
  const observed: SoakGame = { ...game, begin: (clients, match) => {
    const driver = game.begin(clients, match);
    return { ...driver, findings: (client) => {
      const s = shell();
      const presented = s.rollback?.active ? s.rollback.speculative.game : s.game;
      if (s.game.phase === Phase.match && presented.phase === Phase.result) sawResultAhead = true;
      const findings = driver.findings?.(client) ?? [];
      cameraFindings.push(...findings.filter(({ detector }) => detector === "offscreen-bubble" || detector === "visible-ko").map(({ text }) => text));
      return findings;
    } };
  } };
  playSoakMatch(runtime, observed, project, repro.match, repro.inputs);
  expect(sawResultAhead).toBe(true);
  expect(cameraFindings).toEqual([]);
});

test("a stick inside its dead zone replays: through the helpers as pad edges the game never sees, through the stand-in as a row [repro wisp#16]", () => {

  const helper = playSoakMatch(runtime, game, project, { ...match, typed: true }, {
    ...quiet, edges: [[11, 0, { axis: 1, value: -9083 }], [12, 0, { axis: 1, value: 7396 }]], typed: [], files: [],
  });

  expect(helper.findings.map(({ kind }) => kind)).toEqual(["unfinished"]);

  const standIn = playSoakMatch(runtime, game, project, match, { ...quiet, edges: [[11, 0, { axis: 1, value: -20 }], [12, 0, { axis: 0, value: 34 }]] });
  expect(standIn.findings.filter(({ kind }) => kind === "crash")).toEqual([]);
});
