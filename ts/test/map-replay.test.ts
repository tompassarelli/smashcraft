// #141: the client plays a replay in the simulation of the map that recorded
// it (smashcraft:client/src-tauri/src/mapsim.rs): its Lua glue loads a map
// bundle without starting it, adds viewer.lua's modules and drives the viewer.
// Here the map is a TypeScriptToLua bundle compiled as maps are, wrapped as
// war3map.lua holds it, in the 32-bit Lua that LUA names (CI's Lua step).
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { joinReplay, parseReplayHeader, parseReplayPart } from "../src/game/replay/matchReplay";
import { TAPE_REPLAY_SERIAL, recordTapeReplay } from "../src/game/replay/tapeReplay";
import { buildViewerLua } from "../scripts/viewerLua";

const ts = join(import.meta.dir, "..");
const lua = process.env.LUA;

test.skipIf(lua === undefined)("a replay plays in a map bundle's own simulation with the viewer's modules added", () => {
  const viewer = buildViewerLua(ts);
  const bundle = readFileSync(join(ts, "build/viewer-lua/viewer.lua"), "utf8");
  const recorded = recordTapeReplay(700, 401);
  const header = parseReplayHeader(recorded.manifest);
  if (typeof header === "string") throw new Error(header);
  const joined = joinReplay(header, recorded.parts.map((part, index) => parseReplayPart(part, TAPE_REPLAY_SERIAL, index + 1) as string[]));
  const folder = mkdtempSync(join(tmpdir(), "smashcraft-map-replay-"));
  writeFileSync(join(folder, "war3map.lua"), `function main() end\nsmashcraftTs = assert(load([=[\n${bundle}\n]=], "=map-test"))()\n`);
  writeFileSync(join(folder, "viewer.lua"), viewer);
  writeFileSync(join(folder, "replay.txt"), `${joined.join("\n")}\n`);
  writeFileSync(join(folder, "run.lua"), [
    "local function read(name) local file = assert(io.open(arg[1] .. '/' .. name, 'rb')); local text = file:read('a'); file:close(); return text end",
    "dofile(arg[2])",
    "smashcraft_load_map(read('war3map.lua'))",
    "smashcraft_add_viewer(read('viewer.lua'))",
    "print(smashcraft_open(read('replay.txt')))",
    "print(smashcraft_advance('450'))",
    "print(smashcraft_seek('120'))",
    "print(smashcraft_advance('1000'))",
  ].join("\n"));
  const run = Bun.spawnSync([lua ?? "lua", join(folder, "run.lua"), folder, join(ts, "../client/src-tauri/src/mapsim.lua")], { stdout: "pipe", stderr: "pipe" });
  expect(run.stderr.toString()).toBe("");
  const [opened, advanced, sought, ended] = run.stdout.toString().trim().split("\n").map((line) => JSON.parse(line));
  expect(opened).toEqual({ first: 0, last: 700, frame: 0 });
  // Across the pause's segment break, and back again by seeking.
  expect([advanced.frame, advanced.ended, advanced.scene.fighters.length]).toEqual([450, false, 2]);
  expect(advanced.scene.fighters[0].parts.length).toBeGreaterThan(0);
  expect([sought.frame, sought.scene.frame]).toEqual([120, 120]);
  expect([ended.frame, ended.ended]).toEqual([700, true]);
}, 120_000);
