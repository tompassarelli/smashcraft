


import { IMPORTED_MODEL_FILES } from "../src/game/assets/importedModelInfo";


export function importedModelFile(path: string): string | undefined {
  const wanted = path.toLowerCase();
  return IMPORTED_MODEL_FILES.find(({ entry }) => entry.toLowerCase() === wanted)?.file;
}



export const stockModelPath = (model: string) => `war3.w3mod:${model.replaceAll("\\", "/").toLowerCase().replace(/\.mdl$/, ".mdx")}`;


export function heroModelSource(model: string): string {
  const imported = importedModelFile(model);
  return imported !== undefined ? `imported-models/${imported}` : `hero-models/${stockModelPath(model).split("/").at(-1) ?? ""}`;
}
