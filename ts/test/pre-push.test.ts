import { expect, test } from "bun:test";
import { redIssueBody } from "../scripts/mainRed";
import { checksFor, redNotice } from "../scripts/prePush";

test("the pre-push gate type-checks and audits a push that changes TypeScript, and skips one that doesn't", () => {
  expect(checksFor(["ts/scripts/wisp/buildInputs.ts"]).map(({ name }) => name)).toEqual(["type-check ts", "type escapes and source shapes"]);
  expect(checksFor(["client/ui/src/main.ts"]).map(({ name }) => name)).toEqual(["type-check client/ui"]);
  expect(checksFor(["docs/play.md", "companion/src/main.rs"])).toEqual([]);
});

test("a push that changes clips or model build inputs checks the model facts, and its refusal names the refresh command", () => {
  // 41cdbd3c's files: it replaced Thrall clips without refreshing the table.
  const checks = checksFor(["build-inputs.json", "tools/animations/thrall-clips.ts", "ts/src/game/presentation/heroes/thrallClips.ts"]);
  expect(checks.map(({ name }) => name)).toContain("model facts fresh");
  expect(checks.find(({ name }) => name === "model facts fresh")?.fix).toContain("bun wisp view models");
  expect(checksFor(["build-inputs.json"]).map(({ name }) => name)).toEqual(["model facts fresh"]);
});

test("the red-main notice is one line naming the issue's failing tests", () => {
  const run = (id: number, conclusion: string, headSha: string) => ({ databaseId: id, conclusion, status: "completed", headSha, url: `run/${id}` });
  const body = redIssueBody("main", ["player view > scene", "Lua32: jab chain"], [run(3, "failure", "c".repeat(40)), run(2, "failure", "b".repeat(40)), run(1, "success", "a".repeat(40))], "o/r");
  expect(body).toContain(`First failing commit: ${"b".repeat(40)}`);
  const notice = redNotice({ number: 7, body, url: "issue/7" });
  expect(notice).toBe("pre-push: main is red (#7 issue/7), 2 failing: player view > scene; Lua32: jab chain");
});
