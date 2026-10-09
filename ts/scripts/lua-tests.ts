


















import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Effect } from "effect";
import { BUSY_PRESSURE, INCONCLUSIVE_EXIT, withPressure } from "wisp/scripts/wisp/testRunner";
import { runAdmitted } from "./heavyCapacity";
import { LUA_TEST_CEILING_S, addCost, judge, type Costs } from "./testCost";
import { stockLua } from "./wisp/luaRuntimes";
import { refuseUntagged } from "./oracleTags";

const compile = (config: string) =>
  Bun.spawnSync([process.execPath, "--bun", "node_modules/typescript-to-lua/dist/tstl.js", "-p", config], { stdout: "inherit", stderr: "inherit" }).exitCode ?? 1;
const run = (bundle: string) => Bun.spawnSync([lua, bundle], { stdout: "inherit", stderr: "inherit" }).exitCode ?? 1;
const jobs = Math.max(1, Number(process.env.LUA_JOBS ?? "1"));
const [partition = NaN, partitions = NaN] = (process.env.LUA_PARTITION ?? "0/1").split("/").map(Number);
if (!Number.isInteger(partition) || !Number.isInteger(partitions) || partition < 0 || partitions <= partition) {
  throw new Error("LUA_PARTITION must be K/N with 0 <= K < N");
}
const only = process.env.LUA_TESTS_STEP;
const savedCosts = process.env.LUA_TEST_COST_DIR;
const costDirectory = savedCosts ?? mkdtempSync(join(tmpdir(), "smashcraft-lua-cost-"));
const costFile = (shard: number) => join(costDirectory, `${shard}.tsv`);
const runSharded = async (bundle: string) => {
  const codes = await Promise.all(Array.from({ length: jobs }, (_, shard) =>
    Bun.spawn([lua, bundle], {
      env: { ...process.env, ...(jobs * partitions === 1 ? {} : { LUA_SHARD: `${partition * jobs + shard}/${jobs * partitions}` }), LUA_TEST_COST: costFile(shard) },
      stdout: "inherit", stderr: "inherit",
    }).exited));
  return codes.find((code) => code !== 0) ?? 0;
};

let pressure: { readonly peak: number | undefined } = { peak: undefined };

const budget = () => {
  const measured: Costs = new Map();
  const over: string[] = [];
  const paths = savedCosts === undefined
    ? Array.from({ length: jobs }, (_, shard) => costFile(shard))
    : [...new Bun.Glob("**/lua-cost-*.tsv").scanSync({ cwd: savedCosts, absolute: true })];
  if (savedCosts !== undefined && paths.length === 0) throw new Error(`No Lua CPU cost rows found in ${savedCosts}`);
  for (const path of paths) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const [module = "", seconds = "", ...name] = line.split("\t");
      if (module === "") continue;
      addCost(measured, module, 1, Number(seconds), Number(seconds));
      if (Number(seconds) > LUA_TEST_CEILING_S) over.push(`${module}: test "${name.join("\t")}" used ${Number(seconds).toFixed(2)} s CPU, over the ${LUA_TEST_CEILING_S} s ceiling per test; shrink it or move it to the farm`);
    }
  }
  if (savedCosts === undefined) rmSync(costDirectory, { recursive: true, force: true });
  const judgement = judge({ label: "Lua32", measured, baselinePath: resolve("test/lua/cost-baseline.tsv"), project: resolve(".") });
  const busy = pressure.peak !== undefined && pressure.peak > BUSY_PRESSURE;
  const note = busy ? ` (inconclusive: CPU pressure ${Math.round(pressure.peak ?? 0)}%)` : "";
  for (const line of [...over, ...judgement.risen]) console.log(`${line}${note}`);
  if (judgement.updated > 0) console.log(`test cost baseline: ${judgement.updated} rows updated in ts/test/lua/cost-baseline.tsv; commit them with the tests`);
  console.log(judgement.heaviest);
  console.log(judgement.summary);
  if (over.length + judgement.risen.length === 0) return 0;
  return busy ? INCONCLUSIVE_EXIT : 1;
};
if (only === "budget") process.exit(budget());

const soak = process.env.GAME_SOAK === "1";
const sweeps = process.env.SWEEPS === "1";
const include = process.env.GAME_TESTS ?? "";
const exclude = process.env.GAME_TESTS_EXCLUDE ?? "";
const listed = process.env.GAME_MODULES?.split(",");
const remainder = include === "" && listed === undefined;
const pattern = soak ? "src/**/*.soak.ts" : "src/**/*.tests.ts";
const modules = [...new Bun.Glob(pattern).scanSync(".")]
  .filter((module) => module.includes(include) && (exclude === "" || !module.includes(exclude)) && (listed === undefined || listed.includes(module))).sort();
if (modules.length === 0) throw new Error("No Lua test modules match GAME_TESTS and GAME_TESTS_EXCLUDE");



const loaded = [...modules, ...(remainder ? ["test/lua/memoryCensus.tests.ts"] : [])];
refuseUntagged(".", loaded);
await runAdmitted("moderate", "smashcraft:lua-tests", 1800);
const lua = await Effect.runPromise(stockLua);
await Bun.write("test/lua/index.ts", [
  'import { registeredTests } from "wisp/src/runtime/testing";',
  "export const testModules: [number, string][] = [];",
  // Lua limits a function to 200 locals; register each module through a call.
  "const mark = (module: string): void => {",
  "  testModules.push([registeredTests.length, module]);",
  "};",
  ...loaded.map((module) => `mark("${module}");\nrequire("../../${module.replace(/\.ts$/, "")}");`),
  "",
].join("\n"));
const steps = only === "compile" ? [() => compile("tsconfig.lua-tests.json")]
  : only === "stack" ? [() => compile("tsconfig.lua-stack.json"), () => run("build/lua-stack/stack.lua")]
  : [
    () => compile("tsconfig.lua-tests.json"),
    async () => {
      const measured = await Effect.runPromise(withPressure(Effect.promise(() => runSharded("build/lua-tests/tests.lua"))));
      pressure = measured.pressure;
      return measured.value;
    },
    ...(soak || sweeps || !remainder ? [] : [() => compile("tsconfig.lua-stack.json"), () => run("build/lua-stack/stack.lua")]),
    ...(soak || sweeps ? [] : [budget]),
  ];
for (const step of steps) {
  const exitCode = await step();
  if (exitCode !== 0) process.exit(exitCode);
}
