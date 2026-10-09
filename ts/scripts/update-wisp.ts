

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "./hostProcess";

const [checkout, requestedRevision] = process.argv.slice(2);
if (checkout !== undefined && (requestedRevision === undefined || !/^[a-f0-9]{40}$/.test(requestedRevision))) {
  throw new Error("usage: bun run update:wisp [WISP_CHECKOUT FULL_COMMIT]");
}
const repository = "https://github.com/tompassarelli/wisp";
const project = resolve(import.meta.dir, "..");
const run = (args: [string, ...string[]], cwd = project) => runProcess(ChildProcess.make(args[0], args.slice(1), { cwd, stderr: "inherit" }));
const Revision = Schema.String.check(Schema.isPattern(/^[a-f0-9]{40}$/));
const main = Effect.gen(function*() {
mkdirSync(resolve(project, "vendor"), { recursive: true });
mkdirSync(resolve(project, "build"), { recursive: true });
const work = yield* Effect.acquireRelease(
  Effect.try(() => mkdtempSync(resolve(project, "build/wisp-package-"))),
  (directory) => Effect.sync(() => rmSync(directory, { recursive: true })),
);
const source = resolve(work, "source");
mkdirSync(source);
const sourceArchive = resolve(work, "source.tar");
let revision: string;
let archive: string;
{
  const gitSource = checkout === undefined ? resolve(work, "repository") : resolve(checkout);
  if (checkout === undefined) {
    yield* run(["git", "clone", "--quiet", "--bare", "--depth=1", "--branch=main", `${repository}.git`, gitSource]);
  }
  revision = yield* run(["git", "-C", gitSource, "rev-parse", `${requestedRevision ?? "HEAD"}^{commit}`]);
  revision = yield* Schema.decodeEffect(Revision)(revision);
  if (requestedRevision !== undefined && revision !== requestedRevision) {
    throw new Error("Wisp revision did not resolve to the requested commit");
  }
  archive = `vendor/wisp-${revision}.tgz`;
  if (!(yield* Effect.tryPromise(() => Bun.file(resolve(project, archive)).exists()))) {
    yield* run(["git", "-C", gitSource, "archive", "--format=tar", `--output=${sourceArchive}`, revision]);
    yield* run(["tar", "-xf", sourceArchive, "-C", source]);
    yield* run([process.execPath, "install", "--frozen-lockfile"], source);
    yield* run([process.execPath, "scripts/package.ts", resolve(project, archive)], source);
  }
}
const packagePath = resolve(project, "package.json");
const packageText = yield* Effect.tryPromise(() => Bun.file(packagePath).text());
const pkg = yield* Schema.decodeEffect(Schema.fromJsonString(Schema.StructWithRest(Schema.Struct({ devDependencies: Schema.Record(Schema.String, Schema.String) }), [Schema.Record(Schema.String, Schema.Unknown)])))(packageText);
const updated = { ...pkg, devDependencies: { ...pkg.devDependencies, wisp: `file:${archive}` } };
yield* Effect.tryPromise(() => Bun.write(packagePath, `${JSON.stringify(updated, null, 2)}\n`));
yield* Effect.tryPromise(() => Bun.write(resolve(project, "wisp.lock"), `${JSON.stringify({
  repository,
  revision,
  archive,
}, null, 2)}\n`));
yield* run([process.execPath, "install"]);

for (const old of new Bun.Glob("vendor/wisp-*.tgz").scanSync(project)) {
  if (old !== archive) rmSync(resolve(project, old));
}
console.log(`Wisp ${revision} installed from ${archive}`);

});
BunRuntime.runMain(main.pipe(Effect.scoped, Effect.provide(BunServices.layer)));
