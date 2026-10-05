import { lstatSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const tsRoot = join(import.meta.dir, "../..");
const fixtureLink = join(import.meta.dir, "effect-source");
const compiler = "node_modules/typescript-to-lua/dist/tstl.js";

function run(config: string): { readonly code: number; readonly output: string } {
  const result = Bun.spawnSync([process.execPath, "--bun", compiler, "-p", `test/compatibility/${config}`], {
    cwd: tsRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: result.exitCode,
    output: `${new TextDecoder().decode(result.stdout)}${new TextDecoder().decode(result.stderr)}`,
  };
}

try {
  lstatSync(fixtureLink);
  throw new Error(`refusing to replace existing compatibility path: ${fixtureLink}`);
} catch (cause) {
  if (!(cause instanceof Error) || !("code" in cause && cause.code === "ENOENT")) throw cause;
}

const packaged = run("tsconfig.effect-package.json");
console.log(`Published package resolver (exit ${packaged.code}):\n${packaged.output.trim()}`);
if (!packaged.output.includes("Could not resolve lua source files for require path 'effect'")) {
  throw new Error("expected TSTL to report the published Effect package as having no Lua sources");
}

symlinkSync("../../node_modules/effect/src", fixtureLink, "dir");
let source: ReturnType<typeof run>;
try {
  source = run("tsconfig.effect-source.json");
} finally {
  unlinkSync(fixtureLink);
}

console.log(`Mapped installed TypeScript source (exit ${source.code}):\n${source.output.trim()}`);
if (!source.output.includes("TypeError: undefined is not an object") || !source.output.includes("getReflectionClassName")) {
  throw new Error("expected TSTL to fail in its class transformation while compiling Effect's installed TypeScript source");
}
