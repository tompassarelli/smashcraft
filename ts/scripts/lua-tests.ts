// Runs the game's tests in Lua with Warcraft's number model (32-bit integers,
// binary32 numbers). Usage: LUA=<LUA_32BITS lua> bun scripts/lua-tests.ts
// GAME_SOAK=1 runs the long *.soak.ts scenarios instead.
// GAME_TESTS includes and GAME_TESTS_EXCLUDE excludes module-path substrings.
// The remainder (no GAME_TESTS) also runs the memory census and stack checks.
// The stack plugin instruments a whole bundle, so the stack-trace profile's
// TypeScript frames are checked in a second bundle, after the tests pass.
// On the farm (`wisp farm test`), LUA_TESTS_STEP=compile only compiles the
// remainder's bundle (every module and the census) for sharded runs
// (test/lua/entry.ts), and LUA_TESTS_STEP=stack runs only the stack check.
import { runAdmitted } from "./heavyCapacity";

await runAdmitted("moderate", "smashcraft:lua-tests", 1800);
const lua = process.env.LUA ?? "lua";
const compile = (config: string) =>
  Bun.spawnSync([process.execPath, "--bun", "node_modules/typescript-to-lua/dist/tstl.js", "-p", config], { stdout: "inherit", stderr: "inherit" }).exitCode ?? 1;
const run = (bundle: string) => Bun.spawnSync([lua, bundle], { stdout: "inherit", stderr: "inherit" }).exitCode ?? 1;

const soak = process.env.GAME_SOAK === "1";
const include = process.env.GAME_TESTS ?? "";
const exclude = process.env.GAME_TESTS_EXCLUDE ?? "";
const remainder = include === "";
const pattern = soak ? "src/**/*.soak.ts" : "src/**/*.tests.ts";
const modules = [...new Bun.Glob(pattern).scanSync(".")]
  .filter((module) => module.includes(include) && (exclude === "" || !module.includes(exclude))).sort();
if (modules.length === 0) throw new Error("No Lua test modules match GAME_TESTS and GAME_TESTS_EXCLUDE");
const imports = modules.map((module) => `import "../../${module.replace(/\.ts$/, "")}";`);
if (remainder) imports.push('import "./memoryCensus.tests";');
await Bun.write("test/lua/index.ts", `${imports.join("\n")}\n`);
const only = process.env.LUA_TESTS_STEP;
const steps = only === "compile" ? [() => compile("tsconfig.lua-tests.json")]
  : only === "stack" ? [() => compile("tsconfig.lua-stack.json"), () => run("build/lua-stack/stack.lua")]
  : [
    () => compile("tsconfig.lua-tests.json"),
    () => run("build/lua-tests/tests.lua"),
    ...(soak || !remainder ? [] : [() => compile("tsconfig.lua-stack.json"), () => run("build/lua-stack/stack.lua")]),
  ];
for (const step of steps) {
  const exitCode = step();
  if (exitCode !== 0) process.exit(exitCode);
}

