import { join } from "node:path";
import { homedir } from "node:os";
import { MapBuild, type BuildProject } from "waygate/scripts/waygate/mapBuild";
import { GameFiles } from "waygate/scripts/waygate/gameFiles";
import { SourceErrors } from "waygate/scripts/waygate/sourceErrors";

export const ts = join(import.meta.dir, "../..");
export const projectRoot = join(ts, "..");
export const clientState = join(homedir(), ".local/state/smashcraft/clients.json");
export const sourceMapDirectory = join(ts, "build/source-maps");
export const buildProject = (profile: "main" | "integrity" | "playable" | "physics-probe" | "frame-cost" = "main"): BuildProject => ({
  projectRoot,
  configPath: join(ts, profile === "main" ? "tsconfig.map.json" : `tsconfig.${profile}.json`),
  bundlePath: join(ts, profile === "main" ? "build/map.lua" : `build/${profile}.lua`),
  compileInputs: [join(ts, "src"), join(ts, "node_modules/waygate/src"), join(ts, "node_modules/waygate/plugins"),
    join(ts, "tsconfig.map.json"), join(ts, "tsconfig.integrity.json"), join(ts, "tsconfig.playable.json"), join(ts, "tsconfig.physics-probe.json"), join(ts, "tsconfig.frame-cost.json"), join(ts, "tsconfig.json")],
  packager: join(projectRoot, "build/tools/map-pack"),
  toolchainLockPath: join(projectRoot, "typescript-toolchain.lock"),
  packageDirectory: ts,
  entryGlobal: "smashcraftTs",
});
export const mapBuildLayer = MapBuild.layer(buildProject());
export const gameFilesLayer = GameFiles.layer({ mapFolder: "Maps/00-Smashcraft", replacedMaps: "smashcraft-replaced-maps" });
export const sourceErrorsLayer = SourceErrors.layer({ sourceMapDirectory, filePrefix: "smashcraft" });
