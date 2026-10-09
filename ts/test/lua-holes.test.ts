// Lua iteration stops at nil; TypeScriptToLua Object.values uses pairs and produces a dense list.







import { expect } from "bun:test";
import { join, relative } from "node:path";
import ts from "typescript";
import { sweep } from "./sweep";

const root = join(import.meta.dir, "..");


const ITERATING_METHODS = new Set(["forEach", "map", "flatMap", "filter", "some", "every", "reduce", "reduceRight", "find", "findIndex", "findLast", "findLastIndex", "includes", "indexOf", "lastIndexOf", "join", "entries", "keys", "values", "slice", "concat"]);

sweep("Lua code iterates no list that may hold undefined [repro #168]", () => {

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
