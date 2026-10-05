import { mkdtempSync, utimesSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit } from "effect";
import { expect, test } from "bun:test";
import { Acknowledgement } from "../scripts/waygate/boundary";
import { runHotWatch, validateDataDirectories } from "../scripts/waygate/commands/hot";
import { freshBundleAge } from "../scripts/waygate/mapBuild";

test("hot reload requires at least one non-empty client data directory", async () => {
  expect(await Effect.runPromise(validateDataDirectories(["/client/data"]))).toEqual(["/client/data"]);
  expect(Exit.isFailure(await Effect.runPromiseExit(validateDataDirectories([])))).toBe(true);
  expect(Exit.isFailure(await Effect.runPromiseExit(validateDataDirectories([""])))).toBe(true);
  expect(Exit.isFailure(await Effect.runPromiseExit(validateDataDirectories(["/client/data", "/client/data"])))).toBe(true);
});

test("an acknowledgement decodes from the game's native Preload file and names a malformed field", async () => {
  const nativeFile = 'function PreloadFiles takes nothing returns nothing\n\r\n\tcall PreloadStart()\r\n\tcall Preload( "applied 42 at 621.2031" )\r\n\tcall PreloadEnd( 0.0 )\r\n\nendfunction\n\n\r\n';
  expect(await Effect.runPromise(Acknowledgement.decode("ack.txt", nativeFile))).toEqual({ version: 42, elapsed: 621.2031 });
  const malformed = await Effect.runPromiseExit(Acknowledgement.decode("ack.txt", nativeFile.replace("applied 42", "applied -1")));
  expect(Exit.isFailure(malformed) && String(malformed.cause)).toContain("version");
});

test("hot watch interrupts scoped poll work and closes its timer on shutdown", async () => {
  let polls = 0;
  await Effect.runPromise(runHotWatch(
    Effect.void,
    Effect.sync(() => {
      polls++;
    }),
    Effect.sleep("125 millis"),
  ));
  const pollsAtShutdown = polls;
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(pollsAtShutdown).toBeGreaterThan(0);
  expect(polls).toBe(pollsAtShutdown);
});

test("a map command reuses the compiled bundle only while it is newer than every compile input", () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-fresh-"));
  const src = join(root, "src");
  mkdirSync(join(src, "game"), { recursive: true });
  const source = join(src, "game", "a.ts");
  const config = join(root, "tsconfig.map.json");
  const bundle = join(root, "map.lua");
  for (const file of [source, config, bundle, `${bundle}.map`]) writeFileSync(file, "");
  const at = (file: string, seconds: number) => utimesSync(file, seconds, seconds);
  at(source, 100);
  at(config, 100);
  at(bundle, 200);
  expect(freshBundleAge(bundle, [src, config], 203_000)).toBe(3);
  at(source, 250);
  expect(freshBundleAge(bundle, [src, config], 260_000)).toBeUndefined();
});
