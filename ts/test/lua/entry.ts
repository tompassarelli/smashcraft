





import { imod } from "wisp/src/sim/intMath";
import { AssertionFailure, registeredTests } from "wisp/src/runtime/testing";
import { isSweep } from "../../src/runtime/sweep";
import { testModules } from "./index";

const readText = (path: string | undefined): string => {
  if (path === undefined || path === "") return "";
  const [file] = io.open(path, "r");
  if (file === undefined) return "";
  const text = file.read("a") ?? "";
  file.close();
  return text;
};

const shardSpec = os.getenv("LUA_SHARD");
const slash = shardSpec === undefined ? -1 : shardSpec.indexOf("/");
const shard = shardSpec === undefined ? 0 : Number(shardSpec.slice(0, slash));
const shards = shardSpec === undefined ? 1 : Number(shardSpec.slice(slash + 1));
const planned = new Map<string, number>();
for (const line of readText(os.getenv("LUA_SHARD_PLAN")).split("\n")) {
  const fields = line.split("\t");
  if (fields.length > 1) planned.set(fields.slice(0, -1).join("\t"), Number(fields[fields.length - 1]));
}
const hashShard = (name: string): number => {
  let hash = 0;
  for (let index = 0; index < name.length; index++) hash = imod(hash * 31 + name.charCodeAt(index), 65521);
  return imod(hash, shards);
};
const resultPath = os.getenv("LUA_TEST_RESULT");
const [results] = resultPath === undefined ? [undefined] : io.open(resultPath, "w");
const costPath = os.getenv("LUA_TEST_COST");
const [costs] = costPath === undefined ? [undefined] : io.open(costPath, "w");
const moduleOf = new Map<string, string>();
registeredTests.forEach(({ name }, index) => {
  let module = "";
  for (const [start, path] of testModules) if (start <= index) module = path;
  moduleOf.set(name, module);
});


const sweeps = os.getenv("SWEEPS") === "1";
const mine = registeredTests.filter(({ name }) => isSweep(name) === sweeps
  && (shardSpec === undefined || (planned.get(name) ?? hashShard(name)) === shard));
// Counts are deterministic for one runtime and test order, unlike CPU seconds (#394).
const HOOK_STEP = 1000;
const COLLECT_ABOVE_KB = 65536;
let ticks = 0;
let heapKb = 0;
let allocatedKb = 0;
const sample = () => {
  const now = collectgarbage("count");
  if (now > heapKb) allocatedKb += now - heapKb;
  heapKb = now;
};
const tick = () => {
  ticks++;
  sample();
  if (heapKb > COLLECT_ABOVE_KB) {
    collectgarbage("collect");
    heapKb = collectgarbage("count");
  }
};
let failures = 0;
for (const { name, run } of mine) {
  collectgarbage("collect");
  collectgarbage("stop");
  ticks = 0;
  allocatedKb = 0;
  heapKb = collectgarbage("count");
  const started = os.clock();
  debug.sethook(tick, "", HOOK_STEP);
  let status = "pass";
  try {
    run();
  } catch (error) {
    failures++;
    status = "fail";
    print(`fail ${name}: ${error instanceof AssertionFailure ? error.message : String(error)}`);
  }
  debug.sethook();
  sample();
  collectgarbage("restart");
  const seconds = os.clock() - started;
  if (results !== undefined) {
    results.write(`${status}\t${seconds}\t${name}\n`);
    results.flush();
  }
  costs?.write(`${moduleOf.get(name) ?? ""}\t${ticks * HOOK_STEP}\t${Math.floor(allocatedKb)}\t${name}\n`);
}
results?.close();
costs?.close();
print(`${mine.length - failures} of ${mine.length} passed`);
if (failures > 0) os.exit(1);
