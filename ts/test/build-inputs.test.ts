import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Effect, Exit, Schema } from "effect";
import { FAMILIES, FAMILY_NAMES, Manifest, removeTree, resolveInputs, storeFamily, verifiedFamily } from "../scripts/wisp/buildInputs";

const scratch = () => mkdtempSync(join(tmpdir(), "smashcraft-build-inputs-"));
const failureText = (exit: Exit.Exit<unknown, unknown>) => Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "succeeded";


async function populated(root: string): Promise<{ store: string; manifest: Manifest }> {
  const store = join(root, "store");
  const entries = await Promise.all(FAMILY_NAMES.map(async (family) => {
    const source = join(root, "sources", family);
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "model.mdx"), `${family} bytes`);
    const file: string | undefined = family === "base" || family === "container" ? join(source, "model.mdx") : undefined;
    return [family, await storeFamily(family, file ?? source, store)] as const;
  }));
  return { store, manifest: Schema.decodeUnknownSync(Manifest)(Object.fromEntries(entries)) };
}

test("two concurrent builds of one revision both succeed and publish one identical output [spec docs/build-inputs.md]", async () => {
  const root = scratch();
  try {
    const final = join(root, "play-current", "0123456789abcdef0123456789abcdef01234567");
    const log = join(root, "builds.log");
    const worker = join(import.meta.dir, "fixtures/build-inputs/build-once-worker.ts");
    const builders = [0, 1].map(() => Bun.spawn([process.execPath, worker, join(root, "revision.lock"), final, log], { stdout: "pipe", stderr: "pipe" }));
    const results = await Promise.all(builders.map(async (child) => ({ code: await child.exited, out: (await new Response(child.stdout).text()).trim(), err: await new Response(child.stderr).text() })));
    expect(results.map(({ code, err }) => [code, err])).toEqual([[0, ""], [0, ""]]);
    expect(results.map(({ out }) => out.split("\n").at(-1)).sort()).toEqual(["published the revision's map", "reused the revision's map"]);
    expect(readFileSync(log, "utf8").trim().split("\n")).toHaveLength(1);

    expect(readdirSync(join(root, "play-current"))).toEqual(["0123456789abcdef0123456789abcdef01234567"]);
    expect(readdirSync(final).sort()).toEqual(["map.w3x", "map.w3x.next"]);
  } finally { removeTree(root); }
});

test("a manifest naming a family the store lacks fails with the command that regenerates it [spec docs/build-inputs.md]", async () => {
  const root = scratch();
  try {
    const { store, manifest } = await populated(root);
    removeTree(join(store, "original-clips-static-lights"));
    const text = failureText(await Effect.runPromiseExit(resolveInputs(manifest, store)));
    expect(text).toContain(`original-clips-static-lights ${manifest["original-clips-static-lights"]} is not in the store`);
    expect(text).toContain(FAMILIES["original-clips-static-lights"].produce);
    expect(text).toContain("bun wisp inputs add original-clips-static-lights DIR");
  } finally { removeTree(root); }
});

test("changing assets takes a manifest change: stored families are sealed, and an edit in place fails the build [spec docs/build-inputs.md]", async () => {
  const root = scratch();
  try {
    const { store, manifest } = await populated(root);
    const resolved = await Effect.runPromise(resolveInputs(manifest, store));
    expect(readFileSync(join(resolved.assets, "stage-assets/model.mdx"), "utf8")).toBe("stage-assets bytes");
    expect(readFileSync(resolved.base, "utf8")).toBe("base bytes");
    const stored = join(store, "stage-assets", manifest["stage-assets"], "model.mdx");
    expect(() => writeFileSync(stored, "new art")).toThrow();

    const source = join(root, "new-stage");
    mkdirSync(source);
    writeFileSync(join(source, "model.mdx"), "new art");
    const hash = await storeFamily("stage-assets", source, store);
    expect(hash).not.toBe(manifest["stage-assets"]);
    expect(readFileSync(join(resolved.assets, "stage-assets/model.mdx"), "utf8")).toBe("stage-assets bytes");
    const changed = await Effect.runPromise(resolveInputs({ ...manifest, "stage-assets": hash }, store));
    expect(readFileSync(join(changed.assets, "stage-assets/model.mdx"), "utf8")).toBe("new art");

    chmodSync(stored, 0o644);
    writeFileSync(stored, "edited in place");
    const text = failureText(await Effect.runPromiseExit(verifiedFamily("stage-assets", manifest["stage-assets"], store)));
    expect(text).toContain("stage-assets was changed in place");
    expect(existsSync(join(store, "stage-assets", hash))).toBe(true);
  } finally { removeTree(root); }
});
