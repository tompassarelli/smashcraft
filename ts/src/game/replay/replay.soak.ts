

import { test } from "wisp/src/runtime/testing";
import { runRecordedTape } from "./tapeWorld";

test("a 4096-frame recorded tape matches its replayed run on every frame [invariant]", () => {
  runRecordedTape(4096, 64, 99);
});

test("a 1024-frame recorded tape matches through a rollback every frame [invariant]", () => {
  runRecordedTape(1024, 1, 99);
});

test("a 100000-frame recorded tape matches its replayed run on every frame [invariant]", () => {


  runRecordedTape(100000, 64, 100001);
});
