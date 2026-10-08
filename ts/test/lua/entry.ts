// Runs every registered test in Lua; the index imports the test modules.
// On the farm (`wisp farm test`), LUA_SHARD=K/N runs only shard K's tests:
// those LUA_SHARD_PLAN (NAME<TAB>SHARD lines) assigns to K, and unplanned ones
// whose name hashes to K; LUA_TEST_RESULT gets STATUS<TAB>SECONDS<TAB>NAME a test.
// LUA_TEST_COST gets MODULE<TAB>CPU SECONDS<TAB>NAME a test for the suite's
// CPU budget (scripts/testCost.ts); the index records where each module's tests start.
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

// SWEEPS=1 runs only the sweeps (src/runtime/sweep.ts); the suite skips them.
const sweeps = os.getenv("SWEEPS") === "1";
const mine = registeredTests.filter(({ name }) => isSweep(name) === sweeps
  && (shardSpec === undefined || (planned.get(name) ?? hashShard(name)) === shard));
let failures = 0;
for (const { name, run } of mine) {
  const started = os.clock();
  let status = "pass";
  try {
    run();
  } catch (error) {
    failures++;
    status = "fail";
    print(`fail ${name}: ${error instanceof AssertionFailure ? error.message : String(error)}`);
  }
  const seconds = os.clock() - started;
  if (results !== undefined) {
    results.write(`${status}\t${seconds}\t${name}\n`);
    results.flush();
  }
  costs?.write(`${moduleOf.get(name) ?? ""}\t${seconds}\t${name}\n`);
}
results?.close();
costs?.close();
print(`${mine.length - failures} of ${mine.length} passed`);
if (failures > 0) os.exit(1);
