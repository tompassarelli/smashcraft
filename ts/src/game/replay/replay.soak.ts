// Long recorded tapes, outside the default suite. Run on demand:
// GAME_SOAK=1 bun test test/game.test.ts, or GAME_SOAK=1 with scripts/lua-tests.ts.
import { test } from "wisp/src/runtime/testing";
import { runRecordedTape } from "./tapeWorld";

test("a 4096-frame recorded tape matches its replayed run on every frame", () => {
  runRecordedTape(4096, 64, 99);
});

test("a 1024-frame recorded tape matches through a rollback every frame", () => {
  runRecordedTape(1024, 1, 99);
});

test("a 100000-frame recorded tape matches its replayed run on every frame", () => {
  // More stocks than frames keeps combat going for the whole run, even at one
  // stock lost per fighter per frame.
  runRecordedTape(100000, 64, 100001);
});
