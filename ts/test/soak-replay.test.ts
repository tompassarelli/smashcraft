// wisp#16: the native helper soak's repro of its match 0 (da3dd889) crashed
// `bun wisp soak --repro`. Its pad stick sat inside the helper's dead zone
// (-9083 of 32767) and the replay fed the pads' edges to the journal stand-in
// as if they were rows. A match played through the helpers replays what they
// typed; its pads' edges never reach the game.
import { afterAll, expect, test } from "bun:test";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { type SoakInputs, type SoakMatch, playSoakMatch } from "wisp/scripts/wisp/soak";
import project from "../scripts/wisp/soak";
import game from "./soak/game";

const runtime = installHeadless(project.map);
afterAll(runtime.restore);

const match: SoakMatch = { index: 0, seed: 96542, fighters: ["archer", "archer"], stage: "sky-deck", policies: ["fuzz", "cpu"], frames: 30 };
const quiet: SoakInputs = { edges: [], silences: [], hitches: [], slow: [] };

test("a stick inside its dead zone replays: through the helpers as pad edges the game never sees, through the stand-in as a row", () => {
  // The native file's first edges: the helper's full-scale stick, inside its 9175 dead zone.
  const helper = playSoakMatch(runtime, game, project, { ...match, typed: true }, {
    ...quiet, edges: [[11, 0, { axis: 1, value: -9083 }], [12, 0, { axis: 1, value: 7396 }]], typed: [], files: [],
  });
  // Nothing typed, so no helper reports ready in these 30 frames: the match is only unfinished.
  expect(helper.findings.map(({ kind }) => kind)).toEqual(["unfinished"]);
  // The stand-in's own stick, in rows' units, inside its 35 dead zone.
  const standIn = playSoakMatch(runtime, game, project, match, { ...quiet, edges: [[11, 0, { axis: 1, value: -20 }], [12, 0, { axis: 0, value: 34 }]] });
  expect(standIn.findings.filter(({ kind }) => kind === "crash")).toEqual([]);
});
