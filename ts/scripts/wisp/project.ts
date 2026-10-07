import { join } from "node:path";
import { homedir } from "node:os";
import { Effect } from "effect";
import { UsageFailure } from "wisp/scripts/wisp/command";
import type { BuildProject } from "wisp/scripts/wisp/mapBuild";
import { GameFiles } from "wisp/scripts/wisp/gameFiles";
import { SourceErrors } from "wisp/scripts/wisp/sourceErrors";

export const tsDirectory = join(import.meta.dir, "../..");
export const projectRoot = join(tsDirectory, "..");
export const clientState = join(homedir(), ".local/state/smashcraft/clients.json");
export const sourceMapDirectory = join(tsDirectory, "build/source-maps");

/** Every compile of the map: normal gameplay, and each diagnostic with its own entry and TypeScriptToLua configuration. */
const profiles = ["main", "integrity", "playable", "native-input", "analog-keys", "analog-cursor", "native-perf", "physics-probe", "frame-cost", "stack-trace", "damage-blend-probe"] as const;
type Profile = (typeof profiles)[number];
/** Profiles whose entry starts the scene recorder (src/platform/sceneReport.ts). */
export const sceneProfiles: ReadonlySet<Profile> = new Set<Profile>(["main", "integrity"]);
const profileConfigs: Readonly<Record<Profile, string>> = {
  main: "tsconfig.map.json",
  integrity: "tsconfig.integrity.json",
  playable: "tsconfig.playable.json",
  "native-input": "tsconfig.native-input.json",
  "analog-keys": "tsconfig.analog-keys.json",
  "analog-cursor": "tsconfig.analog-cursor.json",
  "native-perf": "tsconfig.native-perf.json",
  "physics-probe": "tsconfig.physics-probe.json",
  "frame-cost": "tsconfig.frame-cost.json",
  "stack-trace": "tsconfig.stack-trace.json",
  "damage-blend-probe": "tsconfig.damage-blend-probe.json",
};
const profileConfig = (profile: Profile) => join(tsDirectory, profileConfigs[profile]);

export const buildProject = (profile: Profile = "main"): BuildProject => ({
  projectRoot,
  configPath: profileConfig(profile),
  bundlePath: join(tsDirectory, profile === "main" ? "build/map.lua" : `build/${profile}.lua`),
  compileInputs: [join(tsDirectory, "src"), join(tsDirectory, "node_modules/wisp/src"), join(tsDirectory, "node_modules/wisp/plugins"), join(tsDirectory, "plugins"), join(tsDirectory, "wisp.lock"),
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

export const gameFilesLayer = GameFiles.layer({ mapFolder: "Maps/00-Smashcraft/tests", replacedMaps: "Maps/00-Smashcraft/tests", preserveMaps: true });
export const sourceErrorsLayer = SourceErrors.layer({ sourceMapDirectory, filePrefix: "smashcraft" });
