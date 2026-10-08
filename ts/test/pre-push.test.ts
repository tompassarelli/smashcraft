import { expect, test } from "bun:test";
import { checksFor } from "../scripts/prePush";
import { newFailures, refusal } from "../scripts/newFailures";

test("the pre-push gate type-checks and audits a push that changes TypeScript, and skips one that doesn't [spec AGENTS.md]", () => {
  expect(checksFor(["ts/scripts/wisp/buildInputs.ts"]).map(({ name }) => name)).toEqual(["clean room", "type-check ts", "type escapes and source shapes"]);
  expect(checksFor(["client/ui/src/main.ts"]).map(({ name }) => name)).toEqual(["clean room", "type-check client/ui"]);
  expect(checksFor(["docs/play.md", "companion/src/main.rs"]).map(({ name }) => name)).toEqual(["clean room"]);
  expect(checksFor([])).toEqual([]);
});

test("a push that changes clips or model build inputs checks the model facts, and its refusal names the refresh command [spec AGENTS.md]", () => {
  // 41cdbd3c's files: it replaced Thrall clips without refreshing the table.
  const checks = checksFor(["build-inputs.json", "tools/animations/thrall-clips.ts", "ts/src/game/presentation/heroes/thrallClips.ts"]);
  expect(checks.map(({ name }) => name)).toContain("model facts fresh");
  expect(checks.find(({ name }) => name === "model facts fresh")?.fix).toContain("bun wisp view models");
  expect(checksFor(["build-inputs.json"]).map(({ name }) => name)).toEqual(["clean room", "model facts fresh"]);
});


test("a push to main is refused for an affected test that main's CI run doesn't fail, naming it and its rerun, and not for one main already fails [spec AGENTS.md]", () => {
  const game = "GAME_MODULES=game/sim/combat.tests.ts bun test test/game.test.ts";
  const x = "src/game/sim/combat > X shield breaks at zero [spec #1]";
  const y = "src/game/sim/combat > Y knockback grows with damage [spec #2]";
  const output = (...failing: string[]) => ["test/game.test.ts:", "(pass) src/game/sim/combat > hitstun [0.20ms]", ...failing.map((name) => `(fail) ${name} [1.00ms]`), "", " 1 pass", ` ${failing.length} fail`].join("\n");
  const known = new Set([x, "Lua32: X shield breaks at zero [spec #1]"]);
  // The change breaks Y while main already fails X: only Y blocks.
  const broken = newFailures([
    { command: game, exitCode: 1, output: output(x, y) },
    { command: "GAME_MODULES=src/game/sim/combat.tests.ts bun scripts/lua-tests.ts", exitCode: 1, output: "fail X shield breaks at zero [spec #1]: expected 0\nfail Y knockback grows with damage [spec #2]: expected 3\n0 of 2 passed" },
  ], known);
  expect(broken.map(({ test }) => test)).toEqual([y, "Lua32: Y knockback grows with damage [spec #2]"]);
  const message = refusal(broken, "main 958e793180: 1 failing");
  expect(message).toContain(y);
  expect(message).toContain(`reproduce: cd ts && ${game} -t '^src/game/sim/combat Y knockback grows with damage \\[spec #2\\]'`);
  expect(message).not.toContain("X shield");
  // The change touches X, which main already fails: nothing blocks.
  expect(newFailures([{ command: game, exitCode: 1, output: output(x) }], known)).toEqual([]);
  // A crash that names no test is new.
  expect(newFailures([{ command: game, exitCode: 134, output: "Segmentation fault" }], known).map(({ test }) => test)).toEqual([`process: ${game} exited 134`]);
});
