// Private native benchmark assembly and readback. The Lua below is the irreducible
// Warcraft/OS boundary: Wurst imports bare natives and both executors share os.clock.
import { join, resolve } from "node:path";
import { Effect } from "effect";
import { canonicalChecksum } from "../src/game/replay/canonical";
import { mapCompiler, report } from "./compiler";
import { verifyToolchain } from "./waygate/mapBuild";
import { composeScript, loadBundle } from "./mapScript";

const project = resolve(import.meta.dir, "../..");
const [command, directory, runId] = process.argv.slice(2);
if (directory === undefined) throw new Error("usage: bun smashcraft:ts/scripts/frameCost.ts compose PRIVATE_BUILD RUN_ID | read CUSTOM_MAP_DATA RUN_ID");
if (runId === undefined || !/^[a-z0-9][a-z0-9-]*$/.test(runId)) throw new Error("supply a distinct lowercase diagnostic run ID");

if (command === "compose") {
  await Effect.runPromise(verifyToolchain(join(project, "typescript-toolchain.lock"), join(project, "ts")));
  const config = join(directory, "tsconfig.json");
  await Bun.write(config, JSON.stringify({
    extends: join(project, "ts/tsconfig.map.json"),
    compilerOptions: { outDir: directory, rootDir: join(project, "ts/src"),
      typeRoots: [join(project, "ts/node_modules"), join(project, "ts/node_modules/@types")] },
    include: [join(project, "ts/src/platform/frameCostMain.ts"), join(project, "ts/src/natives/*.d.ts")],
    tstl: { luaBundle: "benchmark.lua", luaBundleEntry: join(project, "ts/src/platform/frameCostMain.ts"),
      luaPlugins: [{ name: join(project, "ts/plugins/warcraft-numbers.ts") }] },
  }));
  const diagnostics = mapCompiler(config)();
  if (diagnostics.length > 0) throw new Error(report(diagnostics));
  const base = await Bun.file(join(directory, "base.lua")).text();
  const bridge = `
function smashcraftFrameCostClock()
    return os.clock()
end
function smashcraftRunTypeScriptFrameCost()
    smashcraftTs.run()
end
function smashcraftFrameCostEmit(language, frames, total, mean, initial, final, state)
    PreloadGenClear()
    PreloadGenStart()
    Preload("frames=" .. I2S(frames))
    Preload("total_seconds=" .. R2SW(total, 16, 9))
    Preload("mean_seconds=" .. R2SW(mean, 16, 9))
    Preload("initial_checksum=" .. initial)
    Preload("final_checksum=" .. final)
    for offset = 1, #state, 200 do
        Preload("state=" .. string.sub(state, offset, offset + 199))
    end
    PreloadGenEnd("smashcraft-frame-cost-${runId}-p" .. I2S(GetPlayerId(GetLocalPlayer())) .. "-" .. language .. ".txt")
    DisplayTextToPlayer(GetLocalPlayer(), 0, 0, "Benchmark " .. language .. ": " .. I2S(frames) .. " frames, " .. R2SW(total, 12, 6) .. " seconds")
end
`;
  await Bun.write(join(directory, "war3map.lua"), composeScript(base + bridge, loadBundle(join(directory, "benchmark.lua"))));
} else if (command === "read") {
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
} else throw new Error("expected compose or read");
