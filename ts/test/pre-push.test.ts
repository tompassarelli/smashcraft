import { expect, test } from "bun:test";
import { checksFor } from "../scripts/prePush";

test("the pre-push gate type-checks and audits a push that changes TypeScript, and skips one that doesn't [spec AGENTS.md]", () => {
  expect(checksFor(["ts/scripts/wisp/buildInputs.ts"]).map(({ name }) => name)).toEqual(["type-check ts", "type escapes and source shapes"]);
  expect(checksFor(["client/ui/src/main.ts"]).map(({ name }) => name)).toEqual(["type-check client/ui"]);
  expect(checksFor(["docs/play.md", "companion/src/main.rs"])).toEqual([]);
});

test("a push that changes clips or model build inputs checks the model facts, and its refusal names the refresh command [spec AGENTS.md]", () => {
  // 41cdbd3c's files: it replaced Thrall clips without refreshing the table.
  const checks = checksFor(["build-inputs.json", "tools/animations/thrall-clips.ts", "ts/src/game/presentation/heroes/thrallClips.ts"]);
  expect(checks.map(({ name }) => name)).toContain("model facts fresh");
  expect(checks.find(({ name }) => name === "model facts fresh")?.fix).toContain("bun wisp view models");
  expect(checksFor(["build-inputs.json"]).map(({ name }) => name)).toEqual(["model facts fresh"]);
});

