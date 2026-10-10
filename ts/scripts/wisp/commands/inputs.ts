




import { Effect } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { FAMILIES, FAMILY_NAMES, type Family, MANIFEST, checkoutInputs, storeFamily, writePin } from "../buildInputs";

const isFamily = (name: string): name is Family => name in FAMILIES;

const add = (family: string, source: string) => Effect.gen(function*() {
  if (!isFamily(family)) return yield* new UsageFailure({ problem: `inputs add takes one of ${FAMILY_NAMES.join(", ")}` });
  const hash = yield* Effect.tryPromise({ try: () => storeFamily(family, source), catch: (cause) => new MapBuildFailure({ operation: "store build input", path: source, cause }) });
  yield* Effect.try({ try: () => writePin(family, hash), catch: (cause) => new MapBuildFailure({ operation: "write build inputs", path: MANIFEST, cause }) });
  console.log(`${family} ${hash}\nwrote it into ${MANIFEST}/${family}; commit the change to build with it`);
});

export const inputs: Command = (args) => Effect.gen(function*() {
  const [verb, ...rest] = args;
  const [family, source, ...extra] = rest;
  if (verb === "add" && family !== undefined && source !== undefined && extra.length === 0) return yield* add(family, source);
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
