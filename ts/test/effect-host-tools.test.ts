import { expect, test } from "bun:test";
import { join } from "node:path";
import ts from "typescript";

const root = join(import.meta.dir, "..");
const importsEffect = /(?:from|import)\s*\(?\s*["'](?:effect|@effect\/[^"'/]+)(?:\/[^"']*)?["']/;

const rawOperation = (node: ts.Node): boolean => {
  if (ts.isNewExpression(node)) return ts.isIdentifier(node.expression) && node.expression.text === "Promise";
  if (!ts.isCallExpression(node)) return false;
  const name = node.expression.getText();
  return /^(?:Bun\.(?:spawn|spawnSync|sleep|sleepSync)|setTimeout|spawnSync|fetch)$/.test(name);
};

const inEffect = (node: ts.Node): boolean => {
  for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
    if (ts.isCallExpression(parent) && /^Effect\./.test(parent.expression.getText())) return true;
  }
  return false;
};

test("host tools under scripts/ own processes and waits in Effect [spec AGENTS.md]", async () => {
  const problems: string[] = [];
  let scanned = 0;
  for (const file of new Bun.Glob("scripts/**/*.ts").scanSync(root)) {
    if (/\.tests?\.ts$/.test(file)) continue;
    scanned++;
    const source = await Bun.file(join(root, file)).text();
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (rawOperation(node) && (!importsEffect.test(source) || !inEffect(node))) {
        const line = parsed.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        problems.push(`${file}:${line} raw process or wait outside Effect`);
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
  }
  expect(scanned).toBeGreaterThanOrEqual(100);
  expect(problems).toEqual([]);
});
