import { expect, test } from "bun:test";
import { checksFor } from "../scripts/prePush";

test("the pre-push gate type-checks and audits a push that changes TypeScript, and skips one that doesn't", () => {
  expect(checksFor(["ts/scripts/wisp/buildInputs.ts"]).map(({ name }) => name)).toEqual(["type-check ts", "type escapes and source shapes"]);
  expect(checksFor(["client/ui/src/main.ts"]).map(({ name }) => name)).toEqual(["type-check client/ui"]);
  expect(checksFor(["docs/play.md", "companion/src/main.rs"])).toEqual([]);
});
