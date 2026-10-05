// Read recorded paired native benchmark results, including historical Wurst baselines.
import { join } from "node:path";
import { canonicalChecksum } from "../src/game/replay/canonical";
import { Effect } from "effect";
import { MalformedGameFile } from "waygate/scripts/waygate/boundary";
import { GameFiles, readGameFile } from "waygate/scripts/waygate/gameFiles";
import { FrameCost, frameCostFile } from "./waygate/boundary";

const [command, directory, runId] = process.argv.slice(2);
if (directory === undefined) throw new Error("usage: bun smashcraft:ts/scripts/frameCost.ts read CUSTOM_MAP_DATA RUN_ID");
if (runId === undefined || !/^[a-z0-9][a-z0-9-]*$/.test(runId)) throw new Error("supply a distinct lowercase diagnostic run ID");

if (command === "read") {
  const records = await Effect.runPromise(Effect.forEach(["wurst", "typescript"] as const, (language) => Effect.gen(function*() {
    const path = join(directory, frameCostFile(runId, 0, language));
    const stored = yield* readGameFile(path, FrameCost);
    if (stored === undefined) return yield* new MalformedGameFile({ file: path, field: "record", problem: "file is missing" });
    const { frames, totalSeconds, meanSeconds, initialChecksum, finalChecksum } = stored.value;
    const state = stored.value.state.map((line) => line.slice(6)).join("");
    if (!state.startsWith("SmashcraftReplay2") || canonicalChecksum(state) !== finalChecksum) {
      return yield* new MalformedGameFile({ file: path, field: "state", problem: "replay state is incomplete or does not match final_checksum" });
    }
    return { language, frames, totalSeconds, meanSeconds, initialChecksum, finalChecksum, state };
  }), { concurrency: 2 }).pipe(Effect.provide(GameFiles.layer())));
  const [wurst, typescript] = records;
  if (wurst === undefined || typescript === undefined) throw new Error("missing paired result");
  const equal = wurst.initialChecksum === typescript.initialChecksum && wurst.finalChecksum === typescript.finalChecksum && wurst.state === typescript.state;
  const ratio = typescript.totalSeconds / wurst.totalSeconds;
  console.log(JSON.stringify({ frames: 4096, equalWorkload: equal, wurst: { totalSeconds: wurst.totalSeconds, meanSeconds: wurst.meanSeconds, checksum: wurst.finalChecksum },
    typescript: { totalSeconds: typescript.totalSeconds, meanSeconds: typescript.meanSeconds, checksum: typescript.finalChecksum }, ratio, removalGate: equal && ratio <= 1 }, null, 2));
  if (!equal) {
    const left = wurst.state.split("|");
    const right = typescript.state.split("|");
    const index = left.findIndex((value, index) => value !== right[index]);
    console.error(`first final state difference: ${left[index]} / ${right[index]}`);
  }
  if (!equal || ratio > 1) process.exitCode = 1;
} else throw new Error("expected read");
