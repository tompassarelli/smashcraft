import { Effect } from "effect";
import { test } from "bun:test";
import { writtenGameFileKind } from "../scripts/wisp/boundary";
import { devReceiptFile } from "../src/game/shell/journalFiles";
import { createMatchState } from "../src/game/match/rules";

const preload = (lines: readonly string[]) => `function PreloadFiles takes nothing returns nothing\n\n\tcall PreloadStart()\r\n${lines.map((line) => `\tcall Preload( "${line}" )\r\n`).join("")}\tcall PreloadEnd( 0.1 )\r\nendfunction\n`;

test("the developer receipt decoder accepts the game's rematch command receipt [invariant]", async () => {
  const file = devReceiptFile({ build: "typescript-integrity", epoch: 0, slot: 0 }, 1, { rollback: 24, delay: 0, batch: 6, rematchSeconds: 20 }, createMatchState());
  const kind = writtenGameFileKind(file.name);
  if (kind === undefined) throw new Error("missing developer receipt decoder");
  await Effect.runPromise(kind.decode(file.name, preload(file.lines)));
});
