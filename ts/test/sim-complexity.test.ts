import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";
import ts from "typescript";

const STEP = join(import.meta.dir, "../src/game/sim/step.ts");
/** #421: no function in sim/step.ts branches more than this. */
const MAX_COMPLEXITY = 40;

const LOGICAL = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

function decisions(node: ts.Node): number {
  switch (node.kind) {
    case ts.SyntaxKind.IfStatement:
    case ts.SyntaxKind.ConditionalExpression:
    case ts.SyntaxKind.CaseClause:
    case ts.SyntaxKind.ForStatement:
    case ts.SyntaxKind.ForInStatement:
    case ts.SyntaxKind.ForOfStatement:
    case ts.SyntaxKind.WhileStatement:
    case ts.SyntaxKind.DoStatement:
    case ts.SyntaxKind.CatchClause:
      return 1;
    case ts.SyntaxKind.BinaryExpression:
      return LOGICAL.has((node as ts.BinaryExpression).operatorToken.kind) ? 1 : 0;
    default:
      return 0;
  }
}

/** Cyclomatic complexity of every function in a file: 1 + if/?:/&&/||/??/case/loop/catch, nested functions counted apart. */
function complexities(path: string): { name: string; complexity: number }[] {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.ESNext, true);
  const found: { name: string; complexity: number }[] = [];
  const measure = (fn: ts.SignatureDeclaration, name: string) => {
    let complexity = 1;
    const walk = (node: ts.Node): void => {
      if (ts.isFunctionLike(node)) {
        visit(node);
        return;
      }
      complexity += decisions(node);
      ts.forEachChild(node, walk);
    };
    ts.forEachChild(fn, walk);
    found.push({ name, complexity });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) && "body" in node && node.body !== undefined) {
      const named = node.name !== undefined && ts.isIdentifier(node.name) ? node.name.text
        : ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name) ? node.parent.name.text
          : `<anonymous line ${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}>`;
      measure(node, named);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

test("no function in sim/step.ts has cyclomatic complexity over 40 [spec #421]", () => {
  const measured = complexities(STEP).sort((a, b) => b.complexity - a.complexity);
  expect(measured.length).toBeGreaterThan(0);
  expect(measured.filter(fn => fn.complexity > MAX_COMPLEXITY)).toEqual([]);
});
