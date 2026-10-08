// Runs the game's tests in Lua with Warcraft's number model (32-bit integers,
// binary32 numbers). Usage: bun scripts/lua-tests.ts; LUA names the Lua32,
// else Wisp's cached pinned build (wisp:scripts/wisp/lua32.ts).
// GAME_SOAK=1 runs the long *.soak.ts scenarios instead; SWEEPS=1 runs only
// the sweeps (src/runtime/sweep.ts). LUA_JOBS=N runs the tests in N Lua
// processes at once, each taking the tests whose name hashes to its shard.
// GAME_TESTS includes and GAME_TESTS_EXCLUDE excludes module-path substrings.
// The remainder (no GAME_TESTS) also runs the memory census and stack checks.
// The stack plugin instruments a whole bundle, so the stack-trace profile's
// TypeScript frames are checked in a second bundle, after the tests pass.
// On the farm (`wisp farm test`), LUA_TESTS_STEP=compile only compiles the
// remainder's bundle (every module and the census) for sharded runs
// (test/lua/entry.ts), and LUA_TESTS_STEP=stack runs only the stack check.
// Outside soaks and sweeps the run ends with its CPU against the committed
// baseline, test/lua/cost-baseline.tsv (scripts/testCost.ts, AGENTS.md "Test cost").
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
const costDirectory = mkdtempSync(join(tmpdir(), "smashcraft-lua-cost-"));
const costFile = (shard: number) => join(costDirectory, `${shard}.tsv`);
const runSharded = async (bundle: string) => {
  const codes = await Promise.all(Array.from({ length: jobs }, (_, shard) =>
    Bun.spawn([lua, bundle], {
      env: { ...process.env, ...(jobs === 1 ? {} : { LUA_SHARD: `${shard}/${jobs}` }), LUA_TEST_COST: costFile(shard) },
      stdout: "inherit", stderr: "inherit",
    }).exited));
  return codes.find((code) => code !== 0) ?? 0;
};

const soak = process.env.GAME_SOAK === "1";
const sweeps = process.env.SWEEPS === "1";
const include = process.env.GAME_TESTS ?? "";
const exclude = process.env.GAME_TESTS_EXCLUDE ?? "";
const remainder = include === "";
const pattern = soak ? "src/**/*.soak.ts" : "src/**/*.tests.ts";
const modules = [...new Bun.Glob(pattern).scanSync(".")]
  .filter((module) => module.includes(include) && (exclude === "" || !module.includes(exclude))).sort();
if (modules.length === 0) throw new Error("No Lua test modules match GAME_TESTS and GAME_TESTS_EXCLUDE");
// TSTL hoists imports above other statements, so the index loads each module
// with require and records the registry length before it: entry.ts charges
// each test's CPU to the module that registered it.
const loaded = [...modules, ...(remainder ? ["test/lua/memoryCensus.tests.ts"] : [])];
refuseUntagged(".", loaded);
await runAdmitted("moderate", "smashcraft:lua-tests", 1800);
const lua = await Effect.runPromise(stockLua);
await Bun.write("test/lua/index.ts", [
  'import { registeredTests } from "wisp/src/runtime/testing";',
  "export const testModules: [number, string][] = [];",
  // A call per module, not a statement that TSTL gives a local: Lua allows 200 locals.
  "const mark = (module: string): void => {",
  "  testModules.push([registeredTests.length, module]);",
  "};",
  ...loaded.map((module) => `mark("${module}");\nrequire("../../${module.replace(/\.ts$/, "")}");`),
  "",
].join("\n"));
let pressure: { readonly peak: number | undefined } = { peak: undefined };
/** The run's CPU against the per-test ceiling and the committed per-module baseline. */
const budget = () => {
  const measured: Costs = new Map();
  const over: string[] = [];
  for (let shard = 0; shard < jobs; shard++) {
    if (!existsSync(costFile(shard))) continue;
    for (const line of readFileSync(costFile(shard), "utf8").split("\n")) {
      const [module = "", seconds = "", ...name] = line.split("\t");
      if (module === "") continue;
      addCost(measured, module, 1, Number(seconds), Number(seconds));
      if (Number(seconds) > LUA_TEST_CEILING_S) over.push(`${module}: test "${name.join("\t")}" used ${Number(seconds).toFixed(2)} s CPU, over the ${LUA_TEST_CEILING_S} s ceiling per test; shrink it or move it to the farm`);
    }
  }
  rmSync(costDirectory, { recursive: true, force: true });
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
const only = process.env.LUA_TESTS_STEP;
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

