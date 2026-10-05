import { Effect, Exit } from "effect";
import { expect, test } from "bun:test";
import { acknowledgementVersion, forEachHotClient, validateDataDirectories } from "../scripts/hotEffects";

test("hot reload requires at least one non-empty client data directory", async () => {
  expect(await Effect.runPromise(validateDataDirectories(["/client/data"]))).toEqual(["/client/data"]);
  expect(Exit.isFailure(await Effect.runPromiseExit(validateDataDirectories([])))).toBe(true);
  expect(Exit.isFailure(await Effect.runPromiseExit(validateDataDirectories([""])))).toBe(true);
  expect(Exit.isFailure(await Effect.runPromiseExit(validateDataDirectories(["/client/data", "/client/data"])))).toBe(true);
});

test("hot reload accepts only a complete finite acknowledgement record", () => {
  expect(acknowledgementVersion('call Preload( "applied 12 at 0.375" )')).toBe(12);
  expect(acknowledgementVersion('call Preload( "applied -1 at 0.375" )')).toBeUndefined();
  expect(acknowledgementVersion('call Preload( "applied 12 at Infinity" )')).toBeUndefined();
  expect(acknowledgementVersion('call Preload( "applied 12" )')).toBeUndefined();
});

test("hot reload publishes to at most two client directories at once", async () => {
  let active = 0;
  let maximum = 0;
  await Effect.runPromise(forEachHotClient(["a", "b", "c", "d", "e"], () => Effect.promise(async () => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
  })));
  expect(maximum).toBe(2);
});
