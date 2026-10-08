// Runs every registered test in Lua; the index imports the test modules.
// On the farm (`wisp farm test`), LUA_SHARD=K/N runs only shard K's tests:
// those LUA_SHARD_PLAN (NAME<TAB>SHARD lines) assigns to K, and unplanned ones
// whose name hashes to K; LUA_TEST_RESULT gets STATUS<TAB>SECONDS<TAB>NAME a test.
import { imod } from "wisp/src/sim/intMath";
import { AssertionFailure, registeredTests } from "wisp/src/runtime/testing";
import "./index";

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

const mine = registeredTests.filter(({ name }) => shardSpec === undefined || (planned.get(name) ?? hashShard(name)) === shard);
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
  if (results !== undefined) {
    results.write(`${status}\t${os.clock() - started}\t${name}\n`);
    results.flush();
  }
}
results?.close();
print(`${mine.length - failures} of ${mine.length} passed`);
if (failures > 0) os.exit(1);
