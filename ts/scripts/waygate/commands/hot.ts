import { join } from "node:path";
import { makeHot } from "waygate/scripts/waygate/commands/hot";
import { buildProject, sourceMapDirectory, ts } from "../project";
export const hot = makeHot({ project: buildProject(), sourceDirectory: join(ts, "src"), sourceMapDirectory, filePrefix: "smashcraft" });
