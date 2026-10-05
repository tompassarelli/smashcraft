// Read recorded paired native benchmark results, including historical Wurst baselines.
import { join } from "node:path";
import { canonicalChecksum } from "../src/game/replay/canonical";

const [command, directory, runId] = process.argv.slice(2);
if (directory === undefined) throw new Error("usage: bun smashcraft:ts/scripts/frameCost.ts read CUSTOM_MAP_DATA RUN_ID");
if (runId === undefined || !/^[a-z0-9][a-z0-9-]*$/.test(runId)) throw new Error("supply a distinct lowercase diagnostic run ID");

if (command === "read") {
  const records = await Promise.all(["wurst", "typescript"].map(async language => {
    const path = join(directory, `smashcraft-frame-cost-${runId}-p0-${language}.txt`);
    const file = await Bun.file(path).text();
    const lines = [...file.matchAll(/Preload\(\s*"([^"\r\n]*)"\s*\)/g)].map(match => match[1] ?? "");
    const field = (name: string) => lines.find(line => line.startsWith(`${name}=`))?.slice(name.length + 1);
    const frames = Number(field("frames"));
    const totalSeconds = Number(field("total_seconds"));
    const meanSeconds = Number(field("mean_seconds"));
    const initialChecksum = field("initial_checksum");
    const finalChecksum = field("final_checksum");
    const state = lines.filter(line => line.startsWith("state=")).map(line => line.slice(6)).join("");
    if (frames !== 4096 || !(totalSeconds > 0) || !(meanSeconds > 0) || initialChecksum === undefined || finalChecksum === undefined
      || !state.startsWith("SmashcraftReplay2") || canonicalChecksum(state) !== finalChecksum) {
      throw new Error(`incomplete benchmark record: ${path}`);
    }
    return { language, frames, totalSeconds, meanSeconds, initialChecksum, finalChecksum, state };
  }));
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
