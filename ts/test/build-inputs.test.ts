import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Effect, Exit, Schema } from "effect";
import { FAMILY_NAMES, Manifest, removeTree, resolveInputs, storeFamily, verifiedFamily } from "../scripts/wisp/buildInputs";

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
