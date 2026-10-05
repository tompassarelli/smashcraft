// Runs the game's tests in Lua with Warcraft's number model (32-bit integers,
// binary32 numbers). Usage: LUA=<LUA_32BITS lua> bun scripts/lua-tests.ts
// GAME_SOAK=1 runs the long *.soak.ts scenarios instead.
const pattern = process.env.GAME_SOAK === "1" ? "src/**/*.soak.ts" : "src/**/*.tests.ts";
const modules = [...new Bun.Glob(pattern).scanSync(".")].sort();
await Bun.write("test/lua/index.ts", `${modules.map((m) => `import "../../${m.replace(/\.ts$/, "")}";`).join("\n")}\n`);
const compile = Bun.spawnSync(["bun", "--bun", "node_modules/typescript-to-lua/dist/tstl.js", "-p", "tsconfig.lua-tests.json"], { stdout: "inherit", stderr: "inherit" });
if (compile.exitCode !== 0) process.exit(compile.exitCode ?? 1);
const run = Bun.spawnSync([process.env.LUA ?? "lua", "build/lua-tests/tests.lua"], { stdout: "inherit", stderr: "inherit" });
process.exit(run.exitCode ?? 1);

export {};
