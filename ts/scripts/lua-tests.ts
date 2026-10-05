// Runs the game's tests in Lua with Warcraft's number model (32-bit integers,
// binary32 numbers). Usage: LUA=<LUA_32BITS lua> bun scripts/lua-tests.ts
// GAME_SOAK=1 runs the long *.soak.ts scenarios instead.
// The stack plugin instruments a whole bundle, so the stack-trace profile's
// TypeScript frames are checked in a second bundle, after the tests pass.
const lua = process.env.LUA ?? "lua";
const compile = (config: string) =>
  Bun.spawnSync([process.execPath, "--bun", "node_modules/typescript-to-lua/dist/tstl.js", "-p", config], { stdout: "inherit", stderr: "inherit" }).exitCode ?? 1;
const run = (bundle: string) => Bun.spawnSync([lua, bundle], { stdout: "inherit", stderr: "inherit" }).exitCode ?? 1;

const soak = process.env.GAME_SOAK === "1";
const pattern = soak ? "src/**/*.soak.ts" : "src/**/*.tests.ts";
const modules = [...new Bun.Glob(pattern).scanSync(".")].sort();
await Bun.write("test/lua/index.ts", `${modules.map((m) => `import "../../${m.replace(/\.ts$/, "")}";`).join("\n")}\n`);
const steps = [
  () => compile("tsconfig.lua-tests.json"),
  () => run("build/lua-tests/tests.lua"),
  ...(soak ? [] : [() => compile("tsconfig.lua-stack.json"), () => run("build/lua-stack/stack.lua")]),
];
for (const step of steps) {
  const exitCode = step();
  if (exitCode !== 0) process.exit(exitCode);
}

export {};
