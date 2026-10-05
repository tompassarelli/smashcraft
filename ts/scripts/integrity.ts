// Issue #26's input-integrity harness. `capture` drives both signed-in clients
// through an instrumented match and rematch with Linux virtual pads; `result`
// reconciles a capture directory into #26's table.
// Usage: bun scripts/integrity.ts capture --helper BINARY --build BUILD --out DIR
//          --app-id CLIENT=APP_ID --app-id CLIENT=APP_ID
//          [--sweep RB[:BATCH],...] [--first-epoch N] [--four-fighters] [--clients FILE]
//        bun scripts/integrity.ts result CAPTURE_DIR
import { Effect } from "effect";
import { captureMatches, parseCaptureArguments } from "./integrity/capture";
import { reconcileCapture, tryIntegrity } from "./integrity/evidence";

const [command, ...rest] = Bun.argv.slice(2);

const program = Effect.gen(function*() {
  switch (command) {
    case "capture": {
      const options = yield* tryIntegrity("read arguments", "capture", () => parseCaptureArguments(rest));
      yield* captureMatches(options);
      return true;
    }
    case "result": {
      const [root] = rest;
      if (root === undefined || rest.length !== 1) return yield* Effect.die("usage: bun scripts/integrity.ts result CAPTURE_DIR");
      return yield* reconcileCapture(root);
    }
    default:
      return yield* Effect.die(`unknown command ${command ?? "(none)"}; use capture or result`);
  }
});

process.exitCode = (await Effect.runPromise(program)) ? 0 : 1;
