import { expect, test } from "bun:test";
import { relative, join } from "node:path";
import ts from "typescript";
import { scanNumberRules } from "wisp/plugins/number-rules";
import { savedFiles } from "wisp/scripts/wisp/devResult";

const root = join(import.meta.dir, "..");
const saved = savedFiles();
/** Each audit checks every file on its own, so under `bun wisp dev` it checks only the saved ones. */
const audited = (paths: readonly string[]) => (saved === undefined ? paths : paths.filter((path) => saved.includes(join(root, path))));
const mapSources = audited([...new Bun.Glob("src/**/*.ts").scanSync(root)].sort());

const parsed = new Map<string, { readonly text: string; readonly source: ts.SourceFile }>();
/** Each audit reads the same files; parse each once. */
function parse(path: string): { readonly text: string; readonly source: ts.SourceFile } {
  const cached = parsed.get(path);
  if (cached !== undefined) return cached;
  const file = join(root, path);
  const text = ts.sys.readFile(file) ?? "";
  const result = { text, source: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS) };
  parsed.set(path, result);
  return result;
}

interface SourceShapeViolation {
  readonly file: string;
  readonly line: number;
  readonly shape: string;
}

/**
 * Each decimal literal the map compiler's number rule TS9300 refuses
 * (wisp:plugins/number-rules.ts), as `file:line`. A literal inside f32() needs the
 * checker to confirm f32 is Wisp's helper; the compiler accepts it, so it is skipped.
 */
function nonBinary32Literals(paths: readonly string[]): string[] {
  return paths.flatMap((path) => {
    const { source } = parse(path);
    return scanNumberRules<ts.Node>(ts, source)
      .filter(({ node, condition }) => ts.isNumericLiteral(node) && condition === undefined)
      .map(({ node, message }) => `${path}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${message}`);
  });
}

interface FunctionParts {
  readonly name: string;
  readonly parameters: readonly ts.ParameterDeclaration[];
  readonly body: ts.ConciseBody | ts.Block | undefined;
}

function functionParts(node: ts.Node, source: ts.SourceFile): FunctionParts | undefined {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    return { name: node.name?.getText(source) ?? "", parameters: node.parameters, body: node.body };
  }
  if (ts.isVariableDeclaration(node) && node.initializer !== undefined && ts.isIdentifier(node.name)
    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
    return { name: node.name.text, parameters: node.initializer.parameters, body: node.initializer.body };
  }
  if ((ts.isPropertyAssignment(node) || ts.isPropertyDeclaration(node))
    && node.initializer !== undefined
    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
    return { name: node.name.getText(source), parameters: node.initializer.parameters, body: node.initializer.body };
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

// About 1.4 s alone; a loaded host takes a test several times that, past Bun's 5 s default.
test("map source follows the TypeScript shapes required by #35 [spec #35]", () => {
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
    const { text, source } = parse(path);
    const addAt = (start: number, shape: string): void => {
      const { line } = source.getLineAndCharacterOfPosition(start);
      violations.push({ file: relative(root, file), line: line + 1, shape });
    };
    const add = (node: ts.Node, shape: string): void => addAt(node.getStart(source), shape);

    if (text.includes("TODO(wurst2ts)")) {
      const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
      for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
        if ((token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia)
          && scanner.getTokenText().includes("TODO(wurst2ts)")) {
          counts.converterTodoMarkers++;
          addAt(scanner.getTokenPos(), "converter TODO marker");
        }
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

      const parts = functionParts(node, source);
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
}, 30_000);

test("production TypeScript has no type escapes (#35, #38) [spec #38]", () => {
  const production = audited([...new Bun.Glob("{src,scripts}/**/*.ts").scanSync(root)]
    .filter((path) => !/\.(test|tests|soak)\.ts$/.test(path)).sort());
  const violations: SourceShapeViolation[] = [];
  const counts = { files: production.length, any: 0, nonNull: 0, assertions: 0, suppressions: 0 };
  for (const path of production) {
    const { text, source } = parse(path);
    const add =(node: ts.Node, shape: keyof typeof counts): void => {
      counts[shape]++;
      violations.push({ file: path, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, shape });
    };
    if (/@ts-(ignore|expect-error|nocheck)/.test(text)) add(source, "suppressions");
    const visit = (node: ts.Node): void => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) add(node, "any");
      if (ts.isNonNullExpression(node)) add(node, "nonNull");
      if (ts.isTypeAssertionExpression(node)) add(node, "assertions");
      // `as const` narrows a literal; every other `as` overrides the checker.
      if (ts.isAsExpression(node) && !(ts.isTypeReferenceNode(node.type) && node.type.typeName.getText(source) === "const")) add(node, "assertions");
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  console.info(`type escape audit: ${JSON.stringify(counts)}`);
  expect(violations).toEqual([]);
});

test("map code has no decimal literal the map compiler refuses as non-binary32 (TS9300) [repro #267]", () => {
  expect(nonBinary32Literals(mapSources.filter((path) => !/\.(test|tests)\.ts$|\.d\.ts$/.test(path)))).toEqual([]);
});

test("the binary32 literal audit names 6.489 at its file and line [repro #267]", () => {
  expect(nonBinary32Literals(["test/fixtures/binary32/scale.ts"]))
    .toEqual(["test/fixtures/binary32/scale.ts:2: 6.489 isn't a binary32 value; write 6.488999843597412 or f32(6.489)"]);
});
