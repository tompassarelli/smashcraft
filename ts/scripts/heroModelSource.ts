// Where host tools read a hero's model from under a build's --assets: a
// community model from imported-models, a stock one from hero-models (each
// extracted there from the game's archives).
import { IMPORTED_MODEL_FILES } from "../src/game/assets/importedModelInfo";

/** The imported-models file an archive path is imported from, or undefined for the game's own. */
export function importedModelFile(path: string): string | undefined {
  const wanted = path.toLowerCase();
  return IMPORTED_MODEL_FILES.find(({ entry }) => entry.toLowerCase() === wanted)?.file;
}

/** The game's archive path of a stock model, as CascLib names it: the classic models the clients draw. */
// Warcraft accepts .mdl model names; the archive stores their binary .mdx files.
export const stockModelPath = (model: string) => `war3.w3mod:${model.replaceAll("\\", "/").toLowerCase().replace(/\.mdl$/, ".mdx")}`;

/** A hero model's file relative to --assets. */
export function heroModelSource(model: string): string {
  const imported = importedModelFile(model);
  return imported !== undefined ? `imported-models/${imported}` : `hero-models/${stockModelPath(model).split("/").at(-1) ?? ""}`;
}
