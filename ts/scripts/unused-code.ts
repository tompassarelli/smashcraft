




import { basename, dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "./hostProcess";

const project = resolve(import.meta.dir, "..");
const repository = resolve(project, "..");
const main = Effect.gen(function*() {
const listed = yield* runProcess(ChildProcess.make("git", ["ls-files"], { cwd: repository }));
const tracked = listed.split("\n").filter((file) => file !== "");
const projectFiles = tracked.filter((file) => file.startsWith("ts/") && !file.startsWith("ts/vendor/"));
const sources = projectFiles.filter((file) => file.endsWith(".ts")).map((file) => join(repository, file));
// tools/ and the git hooks import ts/ modules, so they count as importers; only ts/ exports are judged.
// Hooks have no extension, so the compiler reads each one under a `.ts` alias.
const hooks = new Map(tracked.filter((file) => file.startsWith(".githooks/")).map((file) => [join(repository, `${file}.ts`), join(repository, file)]));
const consumers = [...tracked.filter((file) => file.startsWith("tools/") && file.endsWith(".ts")).map((file) => join(repository, file)), ...hooks.keys()];
// Recorded pads, corpus runs and fixtures are test data that tests and tools open by directory.
const fixture = (file: string): boolean => /^ts\/test\/(native\/(pads|captures)|corpus|fixtures)\//.test(file);

const conventional = new Set([".gitignore", "bunfig.toml", "package.json", "bun.lock", "README.md"]);

const live = tracked.filter((file) => !/^(evidence|repos|references)\//.test(file) && !file.startsWith("ts/vendor/")
  && !/\.(png|svg|jsonl|pld|txt|chain|toc|fdf|tgz)$/.test(file));
const liveText = new Map<string, string>();
for (const file of live) liveText.set(file, yield* Effect.tryPromise(() => Bun.file(join(repository, file)).text()));

const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true, declaration: true, skipLibCheck: true, types: ["bun", "lua-types/5.3"],
};
const host = ts.createCompilerHost(options);
const hostFileExists = host.fileExists.bind(host), hostReadFile = host.readFile.bind(host);
host.fileExists = (file) => hooks.has(file) || hostFileExists(file);
host.readFile = (file) => hostReadFile(hooks.get(file) ?? file);
const program = ts.createProgram([...sources, ...consumers], options, host);
const checker = program.getTypeChecker();
const ours = new Set(sources);
const reading = new Set([...sources, ...consumers]);


const bundleEntries = new Set(projectFiles.filter((file) => /(^|\/)tsconfig[^/]*\.json$/.test(file)).flatMap((file) => {
  const config: unknown = ts.parseConfigFileTextToJson(file, liveText.get(file) ?? "").config;
  const entry = typeof config === "object" && config !== null && "tstl" in config && typeof config.tstl === "object" && config.tstl !== null
    && "luaBundleEntry" in config.tstl && typeof config.tstl.luaBundleEntry === "string" ? config.tstl.luaBundleEntry : undefined;
  return entry === undefined ? [] : [join(project, entry)];
}));

const usedElsewhere = new Set<ts.Symbol>();
const importers = new Map<string, Set<string>>();
for (const source of program.getSourceFiles()) {
  if (!reading.has(source.fileName)) continue;
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)
      || (ts.isCallExpression(node.parent) && node.parent.expression.kind === ts.SyntaxKind.ImportKeyword))) {
      const resolved = ts.resolveModuleName(node.text, source.fileName, options, ts.sys).resolvedModule?.resolvedFileName;
      if (resolved !== undefined) importers.set(resolved, (importers.get(resolved) ?? new Set()).add(source.fileName));
    }
    // `const { name } = await import("./module")` binds a local, so take the property it reads.
    if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const key = node.propertyName ?? node.name;
      const property = ts.isIdentifier(key) ? checker.getTypeAtLocation(node.parent).getProperty(key.text) : undefined;
      if (property !== undefined && (property.declarations?.some((declaration) => declaration.getSourceFile() !== source) ?? false)) usedElsewhere.add(property);
    }
    if (ts.isIdentifier(node)) {
      let symbol = checker.getSymbolAtLocation(node);
      // A namespace import used as a value (`Object.entries(moves)`) can reach every export of its module.
      const aliased = symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : undefined;
      if (aliased !== undefined && (aliased.flags & ts.SymbolFlags.ValueModule) !== 0 && !ts.isNamespaceImport(node.parent)
        && !(ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) && !ts.isQualifiedName(node.parent)) {
        for (const exported of checker.getExportsOfModule(aliased)) usedElsewhere.add(exported);
      }
      for (let depth = 0; symbol !== undefined && depth < 16; depth++) {
        if (symbol.declarations?.some((declaration) => declaration.getSourceFile() !== source) ?? false) usedElsewhere.add(symbol);
        symbol = (symbol.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getImmediateAliasedSymbol(symbol) : undefined;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

// An inferred type can name another module's export (`import("./hostProcess").ProcessFailure`) without an identifier
// in the source; declaration emit spells those names out.
program.emit(undefined, (file, text, _bom, _error, emitted) => {
  const from = emitted?.[0];
  if (from === undefined || !ours.has(from.fileName)) return;
  for (const [, specifier, name] of text.matchAll(/import\("([^"]+)"\)\.(\w+)/g)) {
    if (specifier === undefined || name === undefined) continue;
    const resolved: string | undefined = ts.resolveModuleName(specifier, from.fileName, options, ts.sys).resolvedModule?.resolvedFileName;
    const target: ts.SourceFile | undefined = resolved === undefined ? undefined : program.getSourceFile(resolved);
    const module = target === undefined ? undefined : checker.getSymbolAtLocation(target);
    const symbol = module === undefined ? undefined : checker.getExportsOfModule(module).find((exported) => exported.name === name);
    if (symbol !== undefined && target !== from) usedElsewhere.add(symbol);
  }
}, undefined, true);

const exportedNames = (statement: ts.Statement): ts.Identifier[] => {
  if (ts.isExportDeclaration(statement)) {
    return statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)
      ? statement.exportClause.elements.flatMap((element) => ts.isIdentifier(element.name) ? [element.name] : []) : [];
  }
  if (!ts.canHaveModifiers(statement) || !(ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false)) return [];
  if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.flatMap((declaration) => ts.isIdentifier(declaration.name) ? [declaration.name] : []);
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement)
    || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name !== undefined) return [statement.name];
  return [];
};
// A generated file's exports are its generator's interface, which the next regeneration would restore.
const generated = (source: ts.SourceFile): boolean => /^\/\/ Generated by /m.test(source.text.slice(0, source.statements[0]?.getStart(source) ?? 0));
const unusedExports: string[] = [];
for (const source of program.getSourceFiles()) {
  if (!ours.has(source.fileName) || bundleEntries.has(source.fileName) || generated(source)) continue;
  for (const statement of source.statements) for (const name of exportedNames(statement)) {
    const symbol = checker.getSymbolAtLocation(name);
    if (symbol !== undefined && usedElsewhere.has(symbol)) continue;
    const line = source.getLineAndCharacterOfPosition(name.getStart(source)).line + 1;
    unusedExports.push(`${relative(repository, source.fileName)}:${line} ${name.text}`);
  }
}

const basenameCounts = new Map<string, number>();
for (const file of tracked) basenameCounts.set(basename(file), (basenameCounts.get(basename(file)) ?? 0) + 1);

const mentions = (text: string, word: string, hasExtension: boolean): boolean =>
  new RegExp(`(^|[^A-Za-z0-9_.-])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^A-Za-z0-9_${hasExtension ? "" : "."}-])`, "m").test(text);

const named = (file: string): boolean => {
  const name = basename(file);
  const stem = name.replace(/\.[^.]+$/, "");
  const toolDirectory = file.split("/").slice(0, 2).join("/");
  for (const [other, text] of liveText) {
    if (other === file) continue;
    if (text.includes(file) || text.includes(relative(dirname(join(repository, other)), join(repository, file)))) return true;
    if (file.startsWith("ts/") && text.includes(relative(project, join(repository, file)))) return true;
    if (basenameCounts.get(name) === 1 && mentions(text, name, true)) return true;
    const sameTool = file.startsWith("tools/") && file.includes("/", "tools/".length) ? other.startsWith(`${toolDirectory}/`) : dirname(other) === dirname(file);
    if (sameTool && mentions(text, stem, false)) return true;
  }
  return false;
};
const unreachedFiles = projectFiles.filter((file) => !fixture(file) && !conventional.has(basename(file)) && !/\.(test|tests|soak)\.ts$/.test(file)
  && (importers.get(join(repository, file))?.size ?? 0) === 0 && !named(file));
const unreferencedTools = tracked.filter((file) => file.startsWith("tools/") && !conventional.has(basename(file)) && !named(file));

for (const line of unusedExports) console.log(`unused export ${line}`);
for (const file of unreachedFiles) console.log(`unreached file ${file}`);
for (const file of unreferencedTools) console.log(`unreferenced tool ${file}`);
console.log(`unused exports: ${unusedExports.length}; unreached ts/ files: ${unreachedFiles.length}; unreferenced tools/ files: ${unreferencedTools.length}`);
if (unusedExports.length + unreachedFiles.length + unreferencedTools.length > 0) process.exitCode = 1;

});
BunRuntime.runMain(main.pipe(Effect.provide(BunServices.layer)));
