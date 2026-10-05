import { expect, test } from "bun:test";
import { relative, join } from "node:path";
import ts from "typescript";

const root = join(import.meta.dir, "..");
const mapSources = [...new Bun.Glob("src/**/*.ts").scanSync(root)].sort();

interface SourceShapeViolation {
  readonly file: string;
  readonly line: number;
  readonly shape: string;
}

interface FunctionParts {
  readonly name: string;
  readonly parameters: readonly ts.ParameterDeclaration[];
  readonly body: ts.ConciseBody | ts.Block | undefined;
}

function functionParts(node: ts.Node): FunctionParts | undefined {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    return { name: node.name?.getText() ?? "", parameters: node.parameters, body: node.body };
  }
  if (ts.isVariableDeclaration(node) && node.initializer !== undefined && ts.isIdentifier(node.name)
    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
    return { name: node.name.text, parameters: node.initializer.parameters, body: node.initializer.body };
  }
  if ((ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node))
    && node.initializer !== undefined
    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
    return { name: node.name.getText(), parameters: node.initializer.parameters, body: node.initializer.body };
  }
  return undefined;
}

function assignedRecordFields(body: ts.ConciseBody | ts.Block | undefined, target: string, values: ReadonlySet<string>): number {
  if (body === undefined) return 0;
  const fields = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left)
      && ((target === "this" && node.left.expression.kind === ts.SyntaxKind.ThisKeyword)
        || (ts.isIdentifier(node.left.expression) && node.left.expression.text === target))
      && ts.isIdentifier(node.right) && values.has(node.right.text)) {
      fields.add(node.left.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return fields.size;
}

test("map source follows the TypeScript shapes required by #35", () => {
  const violations: SourceShapeViolation[] = [];
  const counts = {
    files: mapSources.length,
    converterTodoMarkers: 0,
    accessors: 0,
    defaultExports: 0,
    namespaceOnlyClasses: 0,
    positionalRecordSetters: 0,
  };

  for (const path of mapSources) {
    const file = join(root, path);
    const text = ts.sys.readFile(file) ?? "";
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const addAt = (start: number, shape: string): void => {
      const { line } = source.getLineAndCharacterOfPosition(start);
      violations.push({ file: relative(root, file), line: line + 1, shape });
    };
    const add = (node: ts.Node, shape: string): void => addAt(node.getStart(source), shape);

    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
      if ((token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia)
        && scanner.getTokenText().includes("TODO(wurst2ts)")) {
        counts.converterTodoMarkers++;
        addAt(scanner.getTokenPos(), "converter TODO marker");
      }
    }

    const visit = (node: ts.Node): void => {
      if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
        counts.accessors++;
        add(node, "accessor around record fields");
      }

      const defaultReExport = ts.isExportDeclaration(node) && node.exportClause !== undefined
        && (ts.isNamedExports(node.exportClause)
          ? node.exportClause.elements.some((element) => element.name.text === "default")
          : ts.isNamespaceExport(node.exportClause) && node.exportClause.name.text === "default");
      if ((ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword))
        || (ts.isExportAssignment(node) && !node.isExportEquals) || defaultReExport) {
        counts.defaultExports++;
        add(node, "default export");
      }

      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        const hasBaseClass = node.heritageClauses?.some((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword) ?? false;
        const onlyStaticMembers = node.members.length === 0 ? !hasBaseClass : node.members.every((member) =>
          ts.canHaveModifiers(member) && ts.getModifiers(member)?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword));
        if (onlyStaticMembers) {
          counts.namespaceOnlyClasses++;
          add(node, "class used only as a namespace");
        }
      }

      const parts = functionParts(node);
      if (parts !== undefined && /^(assign|set[A-Z])/.test(parts.name) && parts.parameters.length >= 4) {
        const valueNames = new Set(parts.parameters.flatMap((parameter) =>
          ts.isIdentifier(parameter.name) ? [parameter.name.text] : []));
        const writesReceiver = assignedRecordFields(parts.body, "this", valueNames) >= 3;
        const target = parts.parameters[0];
        const targetValues = new Set(parts.parameters.slice(1).flatMap((parameter) =>
          ts.isIdentifier(parameter.name) ? [parameter.name.text] : []));
        const writesTarget = target !== undefined && ts.isIdentifier(target.name)
          && assignedRecordFields(parts.body, target.name.text, targetValues) >= 3;
        if (writesReceiver || writesTarget) {
          counts.positionalRecordSetters++;
          add(node, "positional record setter");
        }
      }

      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  console.info(`source shape audit: ${JSON.stringify(counts)}`);
  expect(violations).toEqual([]);
});
