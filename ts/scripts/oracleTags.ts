// Every test names its oracle: where its expected value comes from, outside
// the code under test (#243). The suite runners (scripts/test.ts,
// scripts/lua-tests.ts) read each test's title from the source and refuse to
// run when one has no tag. Titles must be literal text so the tag is visible.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const TAG = /\[(?:native|reference|invariant|provisional)\]|\[repro (?:wisp)?#\d+\]|\[spec (?:(?:wisp)?#\d+|[\w.:/-]+)\]/;

export const hasOracleTag = (title: string): boolean => TAG.test(title);

export const ORACLE_TAGS = [
  "Every test title ends with its oracle, the source of its expected value outside the code under test:",
  "  [native]                   real-game captures, or replay tapes recorded from real matches",
  "  [reference]                an independent implementation: Wurst parity, Bun vs 32-bit Lua, retail Melee recordings",
  "  [spec #N] / [spec docs/…]  a value or rule Tom or a design doc set, cited",
  "  [repro #N]                 reproduces a real defect and fails on the pre-fix code",
  "  [invariant]                holds however the code computes it: same seed twice, equal client checksums, round trips, rollback equals straight play",
  "A headless expectation not yet confirmed natively stays as [provisional] and is listed on wisp#69.",
  "A test with no oracle restates the code: delete it (bun wisp help testing).",
].join("\n");

const REGISTRARS = new Set(["test", "it", "sweep"]);
/** `test.each(rows)` and `test.if(condition)` return the function that takes the title. */
const CURRIED = new Set(["each", "if", "skipIf", "todoIf"]);

/** `test(...)`, `test.skip(...)`, `test.each(rows)(...)`, `sweep(...)`: the call that takes a title. */
function registersTest(call: ts.CallExpression): boolean {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return REGISTRARS.has(callee.text);
  if (ts.isPropertyAccessExpression(callee)) return ts.isIdentifier(callee.expression) && REGISTRARS.has(callee.expression.text) && !CURRIED.has(callee.name.text);
  if (ts.isCallExpression(callee)) {
    const inner = callee.expression;
    return ts.isPropertyAccessExpression(inner) && ts.isIdentifier(inner.expression) && REGISTRARS.has(inner.expression.text);
  }
  return false;
}

/** The title's literal text, `${…}` for substitutions; undefined when the title isn't literal. */
function titleText(node: ts.Expression | undefined): string | undefined {
  if (node === undefined) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span) => `\${…}${span.literal.text}`).join("");
  return undefined;
}

export type Untagged = { readonly file: string; readonly line: number; readonly title: string };

/** Every test in FILES (relative to ROOT) whose title has no oracle tag. */
export function untaggedTests(root: string, files: readonly string[]): Untagged[] {
  const found: Untagged[] = [];
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(join(root, file), "utf8"), ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && registersTest(node)) {
        const title = titleText(node.arguments[0]);
        if (title === undefined || !hasOracleTag(title)) {
          found.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, title: title ?? node.arguments[0]?.getText(source) ?? "" });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

/** Exits 1, naming each untagged test and the tags, before any test runs. */
export function refuseUntagged(root: string, files: readonly string[]): void {
  const untagged = untaggedTests(root, files);
  if (untagged.length === 0) return;
  console.error(`refused: ${untagged.length} test${untagged.length === 1 ? " has" : "s have"} no oracle tag; nothing ran.`);
  for (const { file, line, title } of untagged) console.error(`  ${file}:${line}  ${title}`);
  console.error(ORACLE_TAGS);
  process.exit(1);
}
