




import { afterAll, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Effect, Layer } from "effect";
import { installHeadless } from "wisp/scripts/wisp/headless";
import { HotReload } from "wisp/scripts/wisp/hotReload";
import { Tune } from "wisp/scripts/wisp/tune";
import type { MapEntry } from "wisp/src/headless/client";
import { ackFile } from "wisp/src/runtime/gameFiles";
import { INTEGRITY_BUILD } from "../src/game/shell/currentBuild";
import { type Roster, fighterAt } from "../src/game/sim/roster";
import { authoredTuning, melee } from "../src/game/sim/tuning";
import { install, start, startBuild } from "../src/platform/main";
import { confirmedChecksum } from "../src/platform/shell/diagnostics";
import { shell } from "../src/platform/shell/state";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";
import { SMASHCRAFT_TUNABLES } from "../scripts/wisp/tunables";

const tsDirectory = join(import.meta.dir, "..");
const headless = installHeadless(SMASHCRAFT_HEADLESS);
const copies: string[] = [];
afterAll(() => {
  headless.restore();
  for (const copy of copies) rmSync(copy, { recursive: true });
});

const JUMP = 0x49;
const TUNED_GRAVITY = [["Rifleman gravity", 0.3], ["Demon Hunter gravity", 0.3]] as const;

interface Tuned {
  readonly entry: MapEntry;

  readonly tuning: { readonly authoredTuning: typeof authoredTuning };

  readonly files: readonly string[];
}


async function tunedEntry(values: readonly (readonly [string, number])[]): Promise<Tuned> {
  const replacements = new Map<string, string>();
  const reload = HotReload.of({ publish: Effect.succeed(1) });
  await Effect.runPromise(Effect.gen(function*() {
    const tune = yield* Tune;
    for (const [name, value] of values) yield* tune.apply(name, value);
  }).pipe(Effect.provide(Tune.layer(tsDirectory, SMASHCRAFT_TUNABLES, replacements).pipe(Layer.provide(Layer.succeed(HotReload, reload))))));
  mkdirSync(join(tsDirectory, "build"), { recursive: true });
  const copy = mkdtempSync(join(tsDirectory, "build/tune-"));
  copies.push(copy);
  cpSync(join(tsDirectory, "src"), join(copy, "src"), { recursive: true });
  for (const [path, text] of replacements) writeFileSync(join(copy, relative(tsDirectory, path)), text);
  const entry: MapEntry = await import(join(copy, "src/platform/main.ts"));
  const tuning: Tuned["tuning"] = await import(join(copy, "src/game/sim/tuning.ts"));
  return { entry, tuning, files: [...replacements.keys()].map((path) => relative(tsDirectory, path)) };
}

interface Observed {
  readonly installed: boolean;
  readonly checksum: string;
  readonly height: number;
  readonly gravity: number;
}


function play(next: MapEntry): Observed[][] {
  const clients = headless.clients({ start, install }, [0, 1], { keepCalls: 0 });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(6);
  const version = clients.reload(headless.modules(next));
  const frames: Observed[][] = [];
  for (let frame = 0; frame < 28; frame++) {
    if (frame === 20) clients.press(0, JUMP);
    clients.frames(1);
    frames.push(clients.clients.map((client) => {
      let observed: Observed | undefined;
      client.run(() => {
        const s = shell();
        const fighter = fighterAt(s.world, 0);
        const acknowledgement = client.files.get(ackFile(client.slot, "smashcraft"))?.[0] ?? "";
        observed = { installed: acknowledgement.startsWith(`applied ${version} `), checksum: confirmedChecksum(s), height: fighter.motion.z, gravity: fighter.tuning.physics.gravity };
      });
      if (observed === undefined) throw new Error(`p${client.slot} observed nothing`);
      return observed;
    }));
  }
  expect(clients.firstDivergence()).toBeUndefined();
  for (const client of clients.clients) expect(client.errors).toEqual([]);
  return frames;
}

let tuned: Promise<Tuned> | undefined;
const tunedGravity = () => (tuned ??= tunedEntry(TUNED_GRAVITY));


test("under rollback the speculative match and every history snapshot take tuned values too, so a correction can't undo them [invariant]", async () => {
  const { entry, tuning } = await tunedGravity();
  const clients = headless.clients({ install, start: () => startBuild(INTEGRITY_BUILD) }, [0, 1], { keepCalls: 0 });
  clients.start();
  clients.frames(30);
  clients.chat(0, "-dev quick");
  clients.frames(12);
  clients.reload(headless.modules(entry));
  clients.frames(10);
  expect(clients.unappliedReloads()).toEqual([]);
  for (const client of clients.clients) {
    client.run(() => {
      const s = shell();
      const rollback = s.rollback;
      if (rollback === undefined) throw new Error("the integrity build has no rollback");
      const worlds: Roster[] = [s.world, rollback.speculative.world, rollback.seed.world];
      rollback.playback.visitWorlds((world) => worlds.push(world));
      expect(worlds.length).toBeGreaterThan(3);
      for (const world of worlds) {
        for (const fighter of world.fighters) if (fighter !== undefined) expect(fighter.tuning).toEqual(tuning.authoredTuning(fighter.character));
      }
      const { character } = fighterAt(s.world, 0);
      expect(tuning.authoredTuning(character).physics.gravity).not.toBe(authoredTuning(character).physics.gravity);
    });
  }
}, 30_000);


test("tuned gravity reaches both clients' fighters on the frame they install it and changes the match alike in both [repro #242]", async () => {
  const tuned = await tunedGravity();
  expect(tuned.files).toEqual(["src/game/sim/tuning.ts"]);
  const reference = play({ start, install });
  const changed = play(tuned.entry);
  const installFrame = (frames: Observed[][], slot: number) => frames.findIndex((frame) => frame[slot]?.installed === true);
  const at = installFrame(changed, 0);
  expect(at).toBeGreaterThanOrEqual(0);
  expect(installFrame(changed, 1)).toBe(at);
  expect(installFrame(reference, 0)).toBe(at);
  for (const frame of changed) expect(frame[1]).toEqual(frame[0]!);
  for (const frame of reference) expect(frame[1]).toEqual(frame[0]!);
  const column = (frames: Observed[][], field: keyof Observed) => frames.map((frame) => frame[0]?.[field]);

  expect(column(changed, "checksum").slice(0, at)).toEqual(column(reference, "checksum").slice(0, at));
  for (let frame = at; frame < changed.length; frame++) expect(changed[frame]![0]!.checksum).not.toBe(reference[frame]![0]!.checksum);
  const gravity = changed[at]![0]!.gravity;
  expect([melee(0.3499999940395355), melee(0.30000001192092896)]).toContain(gravity);
  expect(reference[at]![0]!.gravity).not.toBe(gravity);

  const heights = column(changed, "height");
  const referenceHeights = column(reference, "height");
  expect(heights.slice(0, 20)).toEqual(referenceHeights.slice(0, 20));
  expect(heights.some((height, frame) => height !== referenceHeights[frame])).toBe(true);
  expect(Math.max(...heights.map(Number))).toBeLessThan(Math.max(...referenceHeights.map(Number)));
}, 30_000);
