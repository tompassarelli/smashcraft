import { Effect } from "effect";
import { expect, test } from "bun:test";
import { ResponsePage, writtenGameFileKind } from "../scripts/wisp/boundary";
import { devReceiptFile } from "../src/game/shell/journalFiles";
import { createMatchState } from "../src/game/match/rules";

const preload = (lines: readonly string[]) => `function PreloadFiles takes nothing returns nothing\n\n\tcall PreloadStart()\r\n${lines.map((line) => `\tcall Preload( "${line}" )\r\n`).join("")}\tcall PreloadEnd( 0.1 )\r\nendfunction\n`;

test("the developer receipt decoder accepts the game's rematch command receipt [invariant]", async () => {
  const file = devReceiptFile({ build: "typescript-integrity", epoch: 0, slot: 0 }, 1, { rollback: 24, delay: 0, batch: 6, rematchSeconds: 20 }, createMatchState());
  const kind = writtenGameFileKind(file.name);
  if (kind === undefined) throw new Error("missing developer receipt decoder");
  await Effect.runPromise(kind.decode(file.name, preload(file.lines)));
});

test("native pause and resume position pages remain readable [native] [repro #206]", async () => {
  const file = new URL("../../evidence/pause-resume-206-20261008/smashcraft-response-p0-run1-page0.txt", import.meta.url);
  const page = await Effect.runPromise(ResponsePage.decode(file.pathname, await Bun.file(file).text()));
  expect(page.lines).toContain("I 214 pause-boundary paused 167");
  expect(page.lines).toContain("I 385 pause-boundary resumed 167");
});
