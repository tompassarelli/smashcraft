// Writes client kit 1 (smashcraft:docs/client-interface.md) into OUT: `bun scripts/clientKit.ts OUT`.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { joinReplay, parseReplayHeader, parseReplayPart } from "../src/game/replay/replayFormat";
import { TAPE_REPLAY_SERIAL, recordTapeReplay } from "../src/game/replay/tapeReplay";
import { SOURCE_STAMP_TEXT, sourceVersion } from "./sourceVersion";
import { buildViewerLua } from "./viewerLua";

const CLIENT_KIT = 1;

class KitFailure extends Schema.TaggedError<KitFailure>()("KitFailure", { problem: Schema.String }) {}
const ts = resolve(import.meta.dir, "..");

const writeClientKit = Effect.fn("writeClientKit")(function*(out: string) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "fixtures"), { recursive: true });
  const sim = yield* Effect.tryPromise(() => Bun.build({
    entrypoints: [join(ts, "src/game/replay/viewerBundle.ts")], outdir: out, naming: "sim.js", target: "browser", format: "esm", minify: true,
  }));
  if (!sim.success) return yield* new KitFailure({ problem: sim.logs.map(String).join("\n") });
  const version = sourceVersion(ts);
  const code = readFileSync(join(out, "sim.js"), "utf8");
  if (!code.includes(SOURCE_STAMP_TEXT)) return yield* new KitFailure({ problem: "sim.js holds no source stamp to replace" });
  writeFileSync(join(out, "sim.js"), code.replaceAll(SOURCE_STAMP_TEXT, JSON.stringify(version)));
  copyFileSync(join(ts, "src/game/replay/clientKitApi.d.ts"), join(out, "sim.d.ts"));
  writeFileSync(join(out, "viewer.lua"), yield* buildViewerLua(ts));
  const tape = recordTapeReplay(700, 401);
  const manifest = tape.manifest.map((line) => (line === "version development" ? `version ${version}` : line));
  writeFileSync(join(out, "fixtures/tape-replay.json"), `${JSON.stringify({ serial: TAPE_REPLAY_SERIAL, manifest, parts: tape.parts })}\n`);
  const header = parseReplayHeader(tape.manifest);
  if (typeof header === "string") return yield* new KitFailure({ problem: header });
  const parts: (readonly string[])[] = [];
  for (const [index, part] of tape.parts.entries()) {
    const lines = parseReplayPart(part, TAPE_REPLAY_SERIAL, index + 1);
    if (typeof lines === "string") return yield* new KitFailure({ problem: lines });
    parts.push(lines);
  }
  writeFileSync(join(out, "fixtures/tape-replay.txt"), `${joinReplay(header, parts).join("\n")}\n`);
  const bundle = readFileSync(join(ts, "build/viewer-lua/viewer.lua"), "utf8");
  writeFileSync(join(out, "fixtures/map.lua"), `function main() end\nsmashcraftTs = assert(load([=[\n${bundle}\n]=], "=map-test"))()\n`);
  writeFileSync(join(out, "kit.json"), `${JSON.stringify({ kit: CLIENT_KIT, version, viewerApi: 1 }, null, 2)}\n`);
  console.log(`client kit ${CLIENT_KIT}, version ${version}: ${out}`);
});

if (import.meta.main) {
  const out = process.argv[2];
  if (out === undefined) {
    console.error("usage: bun scripts/clientKit.ts OUT");
    process.exit(2);
  }
  BunRuntime.runMain(writeClientKit(resolve(out)).pipe(Effect.provide(BunServices.layer)));
}
