


import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { buildOnce } from "../../../scripts/wisp/buildInputs";

const [lock, final, log] = process.argv.slice(2) as [string, string, string];
const outcome = await Effect.runPromise(buildOnce(lock, final, (folder) => Bun.file(join(folder, "map.w3x")).size > 0, "waiting", (staging) => Effect.promise(async () => {
  appendFileSync(log, `built ${process.pid}\n`);
  writeFileSync(join(staging, "map.w3x.next"), "");
  await Bun.sleep(400);
  writeFileSync(join(staging, "map.w3x"), "the revision's map");
})));
console.log(`${outcome} ${readFileSync(join(final, "map.w3x"), "utf8")}`);
