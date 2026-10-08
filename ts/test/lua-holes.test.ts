// Code that runs in Lua never iterates a list that may hold undefined (#168).
// TypeScriptToLua turns undefined into nil, and a Lua list ends at its first
// nil: `for...of` becomes ipairs, and spreads and array methods read `#`. So
// `for (const model of [this.ready, this.proc])` skipped `proc` whenever
// `ready` was undefined, and seven fighters left an effect behind every
// match. Iterate the defined values instead (by slot, by name, or a list
// built with push). Object.values is exempt: TypeScriptToLua builds it with
// pairs, which skips nil, so its list is always dense.
import { expect } from "bun:test";
import { join, relative } from "node:path";
import ts from "typescript";
import { sweep } from "./sweep";

const root = join(import.meta.dir, "..");

/** Array methods TypeScriptToLua's library runs over `#list`. */
const ITERATING_METHODS = new Set(["forEach", "map", "flatMap", "filter", "some", "every", "reduce", "reduceRight", "find", "findIndex", "findLast", "findLastIndex", "includes", "indexOf", "lastIndexOf", "join", "entries", "keys", "values", "slice", "concat"]);

sweep("Lua code iterates no list that may hold undefined", () => {
  // tsconfig.game.json holds every file compiled to Lua: the map, its emitted-Lua tests and the Lua programs.
  const configPath = join(root, "tsconfig.game.json");
  const config = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, root);
  const program = ts.createProgram({ rootNames: config.fileNames, options: { ...config.options, noEmit: true, incremental: false, declaration: false, emitDeclarationOnly: false } });
  const checker = program.getTypeChecker();
  const nullish = (type: ts.Type): boolean =>
    type.isUnion() ? type.types.some(nullish) : (type.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)) !== 0;
  const mayHoldNil = (type: ts.Type): boolean => {
    if (type.isUnion()) return type.types.some(mayHoldNil);
    if (!checker.isArrayType(type) && !checker.isTupleType(type)) return false;
    return checker.getTypeArguments(type as ts.TypeReference).some(nullish);
  };
  const objectValues = (node: ts.Expression): boolean =>
    ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "values"
    && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "Object";
  const found: string[] = [];
  for (const source of program.getSourceFiles()) {
    if (source.isDeclarationFile || !source.fileName.startsWith(root) || source.fileName.includes("/node_modules/")) continue;
    const visit = (node: ts.Node): void => {
      let list: ts.Expression | undefined;
      if (ts.isForOfStatement(node)) list = node.expression;
      else if (ts.isSpreadElement(node)) list = node.expression;
      else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ITERATING_METHODS.has(node.expression.name.text)) list = node.expression.expression;
      if (list !== undefined && !objectValues(list) && mayHoldNil(checker.getTypeAtLocation(list))) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        found.push(`${relative(root, source.fileName)}:${line + 1} ${list.getText(source).slice(0, 80)}: ${checker.typeToString(checker.getTypeAtLocation(list))}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(found).toEqual([]);
}, 60_000);
