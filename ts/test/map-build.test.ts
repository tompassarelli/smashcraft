import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { expect, test } from "bun:test";
import { runProcess, stageMap, verifyToolchain } from "../scripts/mapEffects";
import { composeScript, typescriptBase } from "../scripts/mapScript";
import { fileIoAbility } from "../scripts/objectData";

const project = join(import.meta.dir, "../..");
const baseMapScript = "function main()\nInitBlizzard()\nRunInitializationTriggers()\nend\n\nfunction config()\nSetPlayers(1)\nend\n";
const bundle = { text: "return { start = function() end }", key: "1-2" };

test("the installed TypeScript toolchain matches typescript-toolchain.lock", async () => {
  await Effect.runPromise(verifyToolchain(join(project, "typescript-toolchain.lock"), join(project, "ts")));
});

test("a TypeScript-only map starts the TypeScript entry with its own config, before and after a rebuild", () => {
  const base = typescriptBase(baseMapScript, "function mapConfig()\n    SetPlayers(4)\nend\n");
  expect(base).not.toMatch(/^RunInitializationTriggers\(\)$/m);
  for (const script of [composeScript(base, bundle), composeScript(base, { ...bundle, key: "3-4" })]) {
    expect(script).toContain("function main()\n    baseMain()\n    smashcraftTs.start()\nend");
    expect(script).toContain("function config()\n    mapConfig()\nend");
    expect(script).not.toContain("wurst");
  }
  expect(() => composeScript(base, undefined)).toThrow();
});

test("a Wurst map keeps starting Wurst, then the TypeScript bundle", () => {
  const wurst = "function baseMain()\nend\nfunction wurstMain() \nend\nfunction wurstConfig() \nend\n";
  expect(composeScript(wurst, bundle)).toContain("baseMain()\n    wurstMain()\n    smashcraftTs.start()\nend\n\nfunction config()\n    wurstConfig()\nend");
  expect(composeScript(wurst, undefined)).not.toContain("smashcraftTs");
});

test("the FileIO ability equals the Wurst build's war3map.w3a", () => {
  const hash = new Bun.CryptoHasher("sha256").update(fileIoAbility()).digest("hex");
  expect(hash).toBe("28b1c0200840165876f4feccaf5bb389a2261e7492ffb0269b23ba0cb569e994");
});

test("a failed map step removes the staged copy and keeps the previous map", async () => {
  const directory = mkdtempSync(join(tmpdir(), "smashcraft-stage-"));
  const map = join(directory, "map.w3x");
  writeFileSync(map, "previous");
  const exit = await Effect.runPromiseExit(stageMap(map, map, (staged) => Effect.gen(function*() {
    writeFileSync(staged, "partial");
    yield* runProcess("replace war3map.lua", staged, ["false"]);
  })));
  expect(Exit.isFailure(exit)).toBe(true);
  expect(readFileSync(map, "utf8")).toBe("previous");
  expect(existsSync(`${map}.next`)).toBe(false);
});

test("interrupting a map step stops its child process", async () => {
  const directory = mkdtempSync(join(tmpdir(), "smashcraft-process-"));
  const pidFile = join(directory, "pid");
  const exit = await Effect.runPromiseExit(
    runProcess("sleep", directory, ["sh", "-c", `echo $$ > ${pidFile}; exec sleep 30`]).pipe(Effect.timeout("200 millis")),
  );
  expect(Exit.isFailure(exit)).toBe(true);
  const pid = Number(readFileSync(pidFile, "utf8"));
  await Bun.sleep(50);
  expect(() => process.kill(pid, 0)).toThrow();
});
