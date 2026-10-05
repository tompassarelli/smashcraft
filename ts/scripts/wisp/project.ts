import { join } from "node:path";
import { homedir } from "node:os";
import { Effect } from "effect";
import { UsageFailure } from "wisp/scripts/wisp/command";
import { MapBuild, type BuildProject } from "wisp/scripts/wisp/mapBuild";
import { GameFiles } from "wisp/scripts/wisp/gameFiles";
import { SourceErrors } from "wisp/scripts/wisp/sourceErrors";

export const tsDirectory = join(import.meta.dir, "../..");
export const projectRoot = join(tsDirectory, "..");
export const clientState = join(homedir(), ".local/state/smashcraft/clients.json");
export const sourceMapDirectory = join(tsDirectory, "build/source-maps");

/** Every compile of the map: normal gameplay, and each diagnostic with its own entry and TypeScriptToLua configuration. */
export const profiles = ["main", "integrity", "playable", "physics-probe", "frame-cost", "stack-trace"] as const;
export type Profile = (typeof profiles)[number];
const profileConfig = (profile: Profile) => join(tsDirectory, profile === "main" ? "tsconfig.map.json" : `tsconfig.${profile}.json`);

export const buildProject = (profile: Profile = "main"): BuildProject => ({
  projectRoot,
  configPath: profileConfig(profile),
  bundlePath: join(tsDirectory, profile === "main" ? "build/map.lua" : `build/${profile}.lua`),
  compileInputs: [join(tsDirectory, "src"), join(tsDirectory, "node_modules/wisp/src"), join(tsDirectory, "node_modules/wisp/plugins"),
    ...profiles.map(profileConfig), join(tsDirectory, "tsconfig.json")],
  packager: join(projectRoot, "build/tools/map-pack"),
  toolchainLockPath: join(projectRoot, "typescript-toolchain.lock"),
  packageDirectory: tsDirectory,
  entryGlobal: "smashcraftTs",
});

/** The command's `--profile NAME` (main when absent) and its other arguments. */
export const profileOption = (args: readonly string[]) => Effect.gen(function*() {
  const index = args.indexOf("--profile");
  const name = index < 0 ? "main" : args[index + 1];
  const profile = profiles.find((candidate) => candidate === name);
  if (profile === undefined) return yield* new UsageFailure({ problem: `--profile takes ${profiles.join(", ")}` });
  return { profile, args: index < 0 ? [...args] : [...args.slice(0, index), ...args.slice(index + 2)] };
});

export const mapBuildLayer = MapBuild.layer(buildProject());
export const gameFilesLayer = GameFiles.layer({ mapFolder: "Maps/00-Smashcraft", replacedMaps: "smashcraft-replaced-maps" });
export const sourceErrorsLayer = SourceErrors.layer({ sourceMapDirectory, filePrefix: "smashcraft" });
