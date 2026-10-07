// `wisp inputs`: the checkout's content-addressed map build inputs
// (smashcraft:docs/build-inputs.md). `add FAMILY PATH` stores a family under
// its hash and writes that hash into smashcraft:build-inputs.json; `check`
// verifies every family the manifest names; `path [NAME]` prints the inputs'
// paths for tools that take --base, --container, --assets or --summon.
import { renameSync } from "node:fs";
import { Effect } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { FAMILIES, FAMILY_NAMES, type Family, MANIFEST, checkoutInputs, storeFamily } from "../buildInputs";

const isFamily = (name: string): name is Family => name in FAMILIES;

const add = (family: string, source: string) => Effect.gen(function*() {
  if (!isFamily(family)) return yield* new UsageFailure({ problem: `inputs add takes one of ${FAMILY_NAMES.join(", ")}` });
  const hash = yield* Effect.tryPromise({ try: () => storeFamily(family, source), catch: (cause) => new MapBuildFailure({ operation: "store build input", path: source, cause }) });
  yield* Effect.tryPromise({
    try: async () => {
      const current: Record<string, string> = await Bun.file(MANIFEST).exists() ? await Bun.file(MANIFEST).json() : {};
      const next = Object.fromEntries(FAMILY_NAMES.flatMap((name) => {
        const value = name === family ? hash : current[name];
        return value === undefined ? [] : [[name, value]];
      }));
      await Bun.write(`${MANIFEST}.${process.pid}.next`, `${JSON.stringify(next, null, 2)}\n`);
      renameSync(`${MANIFEST}.${process.pid}.next`, MANIFEST);
    },
    catch: (cause) => new MapBuildFailure({ operation: "write build inputs", path: MANIFEST, cause }),
  });
  console.log(`${family} ${hash}\nwrote it into ${MANIFEST}; commit the change to build with it`);
});

export const inputs: Command = (args) => Effect.gen(function*() {
  const [verb, ...rest] = args;
  if (verb === "add" && rest.length === 2) return yield* add(rest[0]!, rest[1]!);
  if (verb === "check" && rest.length === 0) {
    const paths = yield* checkoutInputs();
    console.log(`every family in ${MANIFEST} is stored and unchanged\n--assets ${paths.assets}`);
    return;
  }
  if (verb === "path" && rest.length <= 1) {
    const paths = yield* checkoutInputs();
    const name = rest[0];
    if (name === undefined) return console.log(`--base ${paths.base} --container ${paths.container} --assets ${paths.assets} --summon ${paths.summon}`);
    if (name === "base" || name === "container" || name === "assets" || name === "summon") return console.log(paths[name]);
    return yield* new UsageFailure({ problem: "inputs path takes base, container, assets or summon" });
  }
  return yield* new UsageFailure({ problem: "inputs takes add FAMILY PATH | check | path [base|container|assets|summon]" });
});
