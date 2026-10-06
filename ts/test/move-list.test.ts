import { expect, test } from "bun:test";
import { MOVE_LIST_PATH, moveListMarkdown } from "../scripts/moveList";

// The kit data is the only place a move name is written; the docs page is
// generated from it, so the two agree whenever this passes.
test("docs/move-list.md is the move list the kit data generates", async () => {
  const committed = await Bun.file(MOVE_LIST_PATH).text();
  expect(committed, "rerun `bun scripts/moveList.ts` from ts/ and commit docs/move-list.md").toBe(moveListMarkdown());
});
