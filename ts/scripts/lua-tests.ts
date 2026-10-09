


















import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import { runAdmitted } from "./heavyCapacity";
import { LUA_TEST_CEILING_INSTRUCTIONS, LUA_TEST_CEILING_S, addLuaCost, judgeLua, type LuaCosts } from "./testCost";
import { stockLua } from "./wisp/luaRuntimes";
import { refuseUntagged } from "./oracleTags";

const processCode = (command: string, args: readonly string[], env?: Record<string, string | undefined>) => Effect.scoped(Effect.gen(function*() {
  const child = yield* ChildProcess.make(command, args, { stdout: "inherit", stderr: "inherit", ...(env === undefined ? {} : { env }) });
  return yield* child.exitCode;
}));
const compile = (config: string) => processCode(process.execPath, ["--bun", "node_modules/typescript-to-lua/dist/tstl.js", "-p", config]);
const run = (bundle: string) => processCode(lua, [bundle]);
const jobs = Math.max(1, Number(process.env.LUA_JOBS ?? "1"));
const [partition = NaN, partitions = NaN] = (process.env.LUA_PARTITION ?? "0/1").split("/").map(Number);
if (!Number.isInteger(partition) || !Number.isInteger(partitions) || partition < 0 || partitions <= partition) {
  throw new Error("LUA_PARTITION must be K/N with 0 <= K < N");
}
const only = process.env.LUA_TESTS_STEP;
const savedCosts = process.env.LUA_TEST_COST_DIR;
const costDirectory = savedCosts ?? mkdtempSync(join(tmpdir(), "smashcraft-lua-cost-"));
const costFile = (shard: number) => join(costDirectory, `${shard}.tsv`);
const runSharded = (bundle: string) => Effect.forEach(Array.from({ length: jobs }, (_, shard) => shard), (shard) =>
  processCode(lua, [bundle], { ...process.env, ...(jobs * partitions === 1 ? {} : { LUA_SHARD: `${partition * jobs + shard}/${jobs * partitions}` }), LUA_TEST_COST: costFile(shard) }),
  { concurrency: jobs },
).pipe(Effect.map((codes) => codes.find((code) => code !== 0) ?? 0));

const budget = () => {
  const measured: LuaCosts = new Map();
  const over: string[] = [];
  const paths = savedCosts === undefined
    ? Array.from({ length: jobs }, (_, shard) => costFile(shard))
    : [...new Bun.Glob("**/lua-cost-*.tsv").scanSync({ cwd: savedCosts, absolute: true })];
  if (savedCosts !== undefined && paths.length === 0) throw new Error(`No Lua cost rows found in ${savedCosts}`);
  for (const path of paths) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const [module = "", instructions = "", allocKb = "", ...name] = line.split("\t");
      if (module === "") continue;
      addLuaCost(measured, module, Number(instructions), Number(allocKb));
      if (Number(instructions) > LUA_TEST_CEILING_INSTRUCTIONS) over.push(`${module}: test "${name.join("\t")}" ran ${(Number(instructions) / 1e6).toFixed(0)}M Lua instructions, over the ${LUA_TEST_CEILING_INSTRUCTIONS / 1e6}M ceiling per test (${LUA_TEST_CEILING_S} s on the reference runner); shrink it or move it to the farm`);
    }
  }
  if (savedCosts === undefined) rmSync(costDirectory, { recursive: true, force: true });
  const write = process.env.TEST_COST_WRITE !== "0";
  const judgement = judgeLua({ measured, baselinePath: resolve("test/lua/cost-baseline.tsv"), project: resolve("."), write });
  for (const line of [...over, ...judgement.risen]) console.log(line);
  if (judgement.updated > 0) console.log(`test cost baseline: ${judgement.updated} rows ${write ? "updated in" : "differ from (not written: TEST_COST_WRITE=0)"} ts/test/lua/cost-baseline.tsv; commit them with the tests`);
  console.log(judgement.heaviest);
  console.log(judgement.summary);
  return over.length + judgement.risen.length === 0 ? 0 : 1;
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

  "const mark = (module: string): void => {",
  "  testModules.push([registeredTests.length, module]);",
  "};",
  ...loaded.map((module) => `mark("${module}");\nrequire("../../${module.replace(/\.ts$/, "")}");`),
  "",
].join("\n"));
const steps = only === "compile" ? [compile("tsconfig.lua-tests.json")]
  : only === "stack" ? [compile("tsconfig.lua-stack.json"), run("build/lua-stack/stack.lua")]
  : [
    compile("tsconfig.lua-tests.json"),
    runSharded("build/lua-tests/tests.lua"),
    ...(soak || sweeps || !remainder ? [] : [compile("tsconfig.lua-stack.json"), run("build/lua-stack/stack.lua")]),
    ...(soak || sweeps ? [] : [Effect.sync(budget)]),
  ];
BunRuntime.runMain(Effect.gen(function*() {
  for (const step of steps) {
    const exitCode = yield* step;
    if (exitCode !== 0) {
      process.exitCode = exitCode;
      return;
    }
  }
}).pipe(Effect.provide(BunServices.layer)));
