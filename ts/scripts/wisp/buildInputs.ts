// Content-addressed map build inputs (smashcraft:docs/build-inputs.md). Each
// family of private assets is stored once under the hash of its contents and
// never changed; smashcraft:build-inputs.json names the hash of each family the
// revision builds with. New art is a new hash and a manifest commit.
import { chmodSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { Effect, Schema } from "effect";
import { MapBuildFailure } from "wisp/scripts/wisp/mapBuild";
import { withLock } from "./fileLock";
import { projectRoot } from "./project";

export const INPUTS_STORE = join(homedir(), ".local/share/smashcraft-build-inputs/store");
export const MANIFEST = join(projectRoot, "build-inputs.json");

/**
 * Every family a build reads, with how to produce it. A family stored from a
 * single file (base, container) is a folder holding that file under `file`.
 * The others are the folders of `--assets` and the `--summon` folder.
 */
export const FAMILY_NAMES = ["base", "container", "summon", "animation-assets", "illidan-animation", "selection-assets", "fighter-renders",
  "stage-assets", "impact-assets", "imported-models", "original-clips-static-lights", "hero-models", "model-sounds"] as const;
export type Family = (typeof FAMILY_NAMES)[number];
export const FAMILIES = {
  base: { file: "base.w3m", produce: "the private base map Melee_Prototype_Base.w3m (smashcraft:docs/development-loop.md)" },
  container: { file: "container.w3x", produce: "the private asset container map (a built Smashcraft map carrying the stock imports)" },
  summon: { produce: "the private summon clip export (summon-clips-evidence.json and imports/war3mapImported/)" },
  "animation-assets": { produce: "bash tools/animations/build-assets.sh (writes build/animation-assets)" },
  "illidan-animation": { produce: "bun tools/animations/package-illidan.ts (writes build/illidan-animation)" },
  "selection-assets": { produce: "bun tools/selection/build-art.ts (writes build/selection-assets)" },
  "fighter-renders": { produce: "bun tools/selection/render-fighters.ts --extract CASC_EXTRACT --assets \"$(bun wisp inputs path assets)\"" },
  "stage-assets": { produce: "bun tools/stage/package.ts (writes build/stage-assets)" },
  "impact-assets": { produce: "bun tools/effects/package.ts, trap.ts and shield.ts (write build/impact-assets)" },
  "imported-models": { produce: "the community models smashcraft:ts/src/game/assets/importedModelInfo.ts lists, from their authors' downloads" },
  "original-clips-static-lights": { produce: "cp -rL \"$(bun wisp inputs path assets)/original-clips-static-lights\" NEW && chmod -R u+w NEW && bun tools/animations/export-original-clips.ts --assets \"$(bun wisp inputs path assets)\" --out NEW --keep-unchanged (after adding the new fighter models' animation-assets or illidan-animation)" },
  "hero-models": { produce: "the stock hero models extracted from the game's archives (smashcraft:ts/scripts/heroModelSource.ts)" },
  "model-sounds": { produce: "bun tools/animations/export-model-sounds.ts --assets \"$(bun wisp inputs path assets)\" --sounds AnimSounds.slk --out NEW" },
} as const satisfies Record<Family, { readonly file?: string; readonly produce: string }>;
/** The file a single-file family's folder holds. */
const singleFile = (family: Family): string | undefined => family === "base" ? FAMILIES.base.file : family === "container" ? FAMILIES.container.file : undefined;
/** The families `--assets` holds as its folders. */
export const ASSET_FAMILIES = FAMILY_NAMES.filter((family) => family !== "base" && family !== "container" && family !== "summon");

const Hash = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/));
/** Every family's hash; a manifest missing one doesn't decode. */
export const Manifest = Schema.Record(Schema.Literals(FAMILY_NAMES), Hash);
export type Manifest = typeof Manifest.Type;

/** The build's `--base`, `--container`, `--assets` and `--summon`. */
export interface BuildInputPaths { readonly base: string; readonly container: string; readonly assets: string; readonly summon: string }

const failure = (operation: string, path: string, cause: string) => new MapBuildFailure({ operation, path, cause });

/** Every regular file under `root` (links followed), as sorted relative paths. */
function listFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else if (stat.isFile()) files.push(relative(root, path));
    }
  };
  walk(root);
  return files.sort();
}

/** The hash of a folder: each file's relative path and SHA-256, in path order. */
export async function hashTree(root: string): Promise<string> {
  const tree = new Bun.CryptoHasher("sha256");
  for (const file of listFiles(root)) {
    const content = new Bun.CryptoHasher("sha256").update(await Bun.file(join(root, file)).bytes()).digest("hex");
    tree.update(`${file}\0${content}\n`);
  }
  return tree.digest("hex");
}

/** Makes everything under `root` writable again and removes it. */
export function removeTree(root: string): void {
  if (!existsSync(root)) return;
  const unseal = (path: string) => {
    // lstat: an assets view's links lead into the store, which stays sealed.
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat?.isDirectory() !== true) return;
    chmodSync(path, 0o755);
    for (const entry of readdirSync(path)) unseal(join(path, entry));
  };
  unseal(root);
  rmSync(root, { recursive: true, force: true });
}

function seal(root: string): void {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) seal(path);
    else chmodSync(path, 0o444);
  }
  chmodSync(root, 0o555);
}

/**
 * Publishes the finished folder `staging` at `final` by one rename. When
 * another writer published `final` first, `staging` is discarded and theirs
 * stays: whoever renames first wins and nobody writes into a published path.
 */
export function publish(staging: string, final: string): "published" | "reused" {
  try {
    renameSync(staging, final);
    return "published";
  } catch (cause) {
    const code = cause instanceof Error && "code" in cause ? cause.code : undefined;
    if ((code === "ENOTEMPTY" || code === "EEXIST") && existsSync(final)) {
      removeTree(staging);
      return "reused";
    }
    throw cause;
  }
}

/**
 * Builds the folder `final` once. Builders of one key share the lock at
 * `lock`: the first builds into a private staging folder beside `final` and
 * publishes it by one rename; the others wait, then reuse it. A folder that
 * isn't `complete` (left by an interrupted run of older tooling) is rebuilt.
 */
export const buildOnce = <E, R>(lock: string, final: string, complete: (final: string) => boolean, waiting: string, build: (staging: string) => Effect.Effect<void, E, R>) =>
  withLock(lock, waiting, Effect.gen(function*() {
    if (existsSync(final) && complete(final)) return "reused" as const;
    const staging = yield* Effect.try({
      try: () => {
        removeTree(final);
        mkdirSync(dirname(final), { recursive: true });
        return mkdtempSync(join(dirname(final), `.${basename(final).slice(0, 12)}-`));
      },
      catch: (cause) => failure("stage build", final, String(cause)),
    });
    yield* build(staging).pipe(Effect.onError(() => Effect.sync(() => removeTree(staging))));
    return yield* Effect.try({ try: () => publish(staging, final), catch: (cause) => failure("publish build", final, String(cause)) });
  }));

/**
 * Stores `source` (a folder, or the file of a single-file family) as
 * `family` and returns its hash. Copies into a private staging folder, hashes
 * the copy, seals it read-only and publishes it at store/FAMILY/HASH.
 */
export async function storeFamily(family: Family, source: string, store = INPUTS_STORE): Promise<string> {
  const file = singleFile(family);
  const parent = join(store, family);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, ".add-"));
  try {
    const files = file === undefined ? listFiles(source).map((path) => [join(source, path), join(staging, path)] as const) : [[source, join(staging, file)] as const];
    for (const [from, to] of files) {
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(from, to, constants.COPYFILE_FICLONE);
    }
    const hash = await hashTree(staging);
    if (existsSync(join(parent, hash))) {
      removeTree(staging);
      return hash;
    }
    seal(staging);
    publish(staging, join(parent, hash));
    return hash;
  } finally {
    removeTree(staging);
  }
}

/** Where a stage-select card with SHA-256 `sha256` is stored; ts/stage-thumbnails.json names each card's hash. */
export const stageCardPath = (sha256: string, store = INPUTS_STORE) => join(store, "stage-cards", sha256);

/** Stores one stage-select card under its own SHA-256 and returns the hash. */
export async function storeStageCard(bytes: Uint8Array, store = INPUTS_STORE): Promise<string> {
  const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  const final = stageCardPath(hash, store);
  if (existsSync(final)) return hash;
  mkdirSync(dirname(final), { recursive: true });
  const staging = join(dirname(final), `.add-${hash.slice(0, 12)}-${process.pid}`);
  await Bun.write(staging, bytes);
  chmodSync(staging, 0o444);
  renameSync(staging, final);
  return hash;
}

/** How to bring back a family the store lacks. */
export const regenerate = (family: Family, hash: string) =>
  `produce it with ${FAMILIES[family].produce}, then run \`bun wisp inputs add ${family} DIR\` from the checkout ` +
  `(it must hash to ${hash}, or commit the hash it writes into build-inputs.json)`;

/** The stored folder of `family` at `hash`, after checking its contents still hash to it. */
export const verifiedFamily = (family: Family, hash: string, store = INPUTS_STORE) => Effect.gen(function*() {
  const directory = join(store, family, hash);
  if (!existsSync(directory)) return yield* failure("find build input", directory, `${family} ${hash} is not in the store; ${regenerate(family, hash)}`);
  const actual = yield* Effect.tryPromise({ try: () => hashTree(directory), catch: (cause) => failure("hash build input", directory, String(cause)) });
  if (actual !== hash) {
    return yield* failure("verify build input", directory, `${family} was changed in place (it hashes to ${actual}); stored inputs are never edited: ${regenerate(family, hash)}`);
  }
  return directory;
});

/** The manifest at `path`. */
export const readManifest = (path = MANIFEST) =>
  Effect.tryPromise({ try: () => Bun.file(path).json(), catch: (cause) => failure("read build inputs", path, String(cause)) }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Manifest)),
    Effect.mapError((cause) => cause instanceof MapBuildFailure ? cause : failure("decode build inputs", path, String(cause))),
  );

/**
 * The `--assets` folder of `manifest`: a folder of links to each stored asset
 * family, itself stored under the hash of the families it names.
 */
export function assetsView(manifest: Manifest, store = INPUTS_STORE): string {
  const names = ASSET_FAMILIES.map((family) => `${family} ${manifest[family]}\n`).join("");
  const final = join(store, "views", new Bun.CryptoHasher("sha256").update(names).digest("hex"));
  if (existsSync(final)) return final;
  mkdirSync(dirname(final), { recursive: true });
  const staging = mkdtempSync(join(dirname(final), ".add-"));
  for (const family of ASSET_FAMILIES) symlinkSync(join("../..", family, manifest[family]), join(staging, family));
  publish(staging, final);
  return final;
}

/** The checked inputs `manifest` names. */
export const resolveInputs = (manifest: Manifest, store = INPUTS_STORE) => Effect.gen(function*() {
  yield* Effect.forEach(FAMILY_NAMES, (family) => verifiedFamily(family, manifest[family], store), { concurrency: 4, discard: true });
  const path = (family: Family) => join(store, family, manifest[family]);
  const assets = yield* Effect.try({ try: () => assetsView(manifest, store), catch: (cause) => failure("link assets", store, String(cause)) });
  return { base: join(path("base"), FAMILIES.base.file), container: join(path("container"), FAMILIES.container.file), assets, summon: path("summon") } satisfies BuildInputPaths;
});

/** The checked inputs of the checkout's manifest. */
export const checkoutInputs = (manifest = MANIFEST, store = INPUTS_STORE) => readManifest(manifest).pipe(Effect.flatMap((decoded) => resolveInputs(decoded, store)));
