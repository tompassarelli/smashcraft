import { resolve } from "node:path";
import { Console, Effect, Schema } from "effect";
import type * as Timeline from "../src/game/sim/dashDance.tests";

class ReferenceFailure extends Schema.TaggedError<ReferenceFailure>()("ReferenceFailure", { message: Schema.String }) {}

const main = Effect.gen(function*() {
  const [source, output] = process.argv.slice(2);
  if (source === undefined || output === undefined) {
    return yield* new ReferenceFailure({ message: "Usage: bun scripts/dashDanceReference.ts CURRENT_MAIN_WORKTREE OUTPUT.ts" });
  }
  const revision = yield* Effect.tryPromise({
    try: async () => {
      const git = Bun.spawn(["git", "-C", source, "rev-parse", "HEAD", "origin/main"], { stdout: "pipe", stderr: "inherit" });
      const [sha, currentMain] = (await new Response(git.stdout).text()).trim().split("\n");
      if (await git.exited !== 0 || sha === undefined || !/^[a-f0-9]{40}$/.test(sha) || sha !== currentMain) throw new Error("Reference must be current origin/main");
      const clean = Bun.spawn(["git", "-C", source, "diff", "--quiet", "HEAD", "--", "ts/src"], { stdout: "inherit", stderr: "inherit" });
      if (await clean.exited !== 0) throw new Error("Reference source must be unchanged");
      return sha;
    },
    catch: (cause) => new ReferenceFailure({ message: String(cause) }),
  });
  const sourceModule = resolve(source, "ts/src/game/sim/dashDance.tests.ts");
  const runLoad = Effect.runPromiseWith(yield* Effect.context<never>());
  Bun.plugin({
    name: "dash-dance-reference-exports",
    setup(build) {
      build.onLoad({ filter: /dashDance\.tests\.ts$/ }, ({ path }) => runLoad(Effect.gen(function*() {
        if (path !== sourceModule) return undefined;
        let contents = yield* Effect.tryPromise({
          try: () => Bun.file(path).text(),
          catch: (cause) => new ReferenceFailure({ message: String(cause) }),
        });
        for (const name of ["ROSTER", "DANCE_HOLDS", "DANCE_INPUTS", "danceDriver", "holdToward", "travelSample"]) {
          contents = contents.replace(new RegExp(`^(const|function) ${name}\\b`, "m"), `export $1 ${name}`);
        }
        return { contents, loader: "ts" as const };
      })));
    },
  });
  const timeline: typeof Timeline = yield* Effect.tryPromise({
    try: () => import(sourceModule),
    catch: (cause) => new ReferenceFailure({ message: String(cause) }),
  });
  const rows: string[] = [];
  let frames = 0;
  for (const character of timeline.ROSTER) for (const facing of [-1, 1]) {
    for (const [input, phase] of timeline.DANCE_INPUTS) for (let transition = 1; transition <= 4; transition++) {
      const driver = timeline.danceDriver(character, facing);
      const samples: number[] = [];
      const capture = () => {
        samples.push(driver.fighter.facing, driver.fighter.ground.dashDirection, driver.fighter.motion.x);
        frames++;
      };
      let toward = facing;
      timeline.holdToward(driver, input, toward);
      capture();
      for (const hold of timeline.DANCE_HOLDS) {
        for (let frame = 1; frame < hold; frame++) {
          timeline.holdToward(driver, input, toward);
          capture();
        }
        toward = -toward;
        for (let step = 0; ; step++) {
          const done = timeline.travelSample(driver, input, toward, transition, phase, step);
          capture();
          if (done) break;
        }
      }
      rows.push(JSON.stringify(samples.join("|")));
    }
  }
  yield* Effect.tryPromise({
    try: () => Bun.write(output, `export const DASH_DANCE_REFERENCE_MAIN = "${revision}";\nexport const DASH_DANCE_REFERENCE: readonly string[] = [\n${rows.map(row => `  ${row},`).join("\n")}\n];\n`),
    catch: (cause) => new ReferenceFailure({ message: String(cause) }),
  });
  yield* Console.log(`dash-dance reference ${revision}: ${rows.length} timelines, ${frames} frames, 9,984 dash-backs`);
});

await Effect.runPromise(main);
