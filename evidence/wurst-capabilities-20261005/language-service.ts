import ts from "../../ts/node_modules/typescript/lib/typescript.js";
import { resolve } from "node:path";

// Host-only compiler API demonstration. These files stay in memory.
const definitionFile = resolve(import.meta.dir, "fighter.ts");
const consumerFile = resolve(import.meta.dir, "match.ts");
const files = new Map([
  [definitionFile, "export function stockAfterKo(stocks: number): number { return stocks - 1; }\n"],
  [consumerFile, 'import { stockAfterKo } from "./fighter";\nexport const nextStocks: number = stockAfterKo(4);\nexport const eliminated: number = stockAfterKo(1);\nexport const invalidStocks: number = "four";\n'],
]);
const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  types: [],
  skipLibCheck: true,
};
let version = 0;
const host: ts.LanguageServiceHost = {
  getScriptFileNames: () => [...files.keys()],
  getScriptVersion: () => String(version),
  getScriptSnapshot: (file) => {
    const text = files.get(file) ?? ts.sys.readFile(file);
    return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
  },
  getCurrentDirectory: () => import.meta.dir,
  getCompilationSettings: () => options,
  getDefaultLibFileName: ts.getDefaultLibFilePath,
  fileExists: (file) => files.has(file) || ts.sys.fileExists(file),
  readFile: (file) => files.get(file) ?? ts.sys.readFile(file),
  readDirectory: ts.sys.readDirectory,
};
const service = ts.createLanguageService(host);
const consumer = files.get(consumerFile);
if (consumer === undefined) throw new Error("consumer fixture absent");
const position = consumer.indexOf("stockAfterKo(4)");
const definitions = service.getDefinitionAtPosition(consumerFile, position) ?? [];
const references = service.getReferencesAtPosition(consumerFile, position) ?? [];
const definition = files.get(definitionFile);
if (definition === undefined) throw new Error("definition fixture absent");
const rename = service.findRenameLocations(definitionFile, definition.indexOf("stockAfterKo"), false, false) ?? [];
const diagnostics = service.getSemanticDiagnostics(consumerFile);
if (definitions.length !== 1 || definitions[0]?.fileName !== definitionFile) throw new Error("definition lookup failed");
if (references.length !== 4 || rename.length !== 4) throw new Error("references or cross-file rename incomplete");
if (diagnostics.length !== 1 || diagnostics[0]?.code !== 2322) throw new Error("incorrect diagnostic");
for (const [file, original] of files) {
  const locations = rename.filter((location) => location.fileName === file).sort((a, b) => b.textSpan.start - a.textSpan.start);
  let text = original;
  for (const location of locations) {
    text = text.slice(0, location.textSpan.start) + "stocksAfterElimination" + text.slice(location.textSpan.start + location.textSpan.length);
  }
  files.set(file, text.replace('= "four"', "= 4"));
}
version++;
const restoredDiagnostics = [...files.keys()].flatMap((file) => [
  ...service.getSyntacticDiagnostics(file),
  ...service.getSemanticDiagnostics(file),
]);
if (restoredDiagnostics.length !== 0) throw new Error("renamed and repaired fixture does not typecheck");
console.log(JSON.stringify({
  compiler: ts.version,
  fixtureFiles: 2,
  definition: { count: definitions.length, file: "fighter.ts", start: definitions[0]?.textSpan.start },
  references: references.length,
  rename: { locations: rename.length, files: new Set(rename.map((location) => location.fileName)).size },
  invalidAssignment: { diagnostics: diagnostics.length, code: diagnostics[0]?.code },
  renamedAndRepairedDiagnostics: restoredDiagnostics.length,
}, null, 2));
service.dispose();
