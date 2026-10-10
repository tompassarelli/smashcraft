import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";

/** The one kind tag a title ends with (#422). */
export const KIND_TAG = / \[(k1 scenario|k2 property|k3 measure (#\d+|docs\/[\w./-]+\.md)|k4 reference [\w.:/#-]+|k5 boundary [a-z0-9-]+)\]$/;

const ANY_KIND = /\[k\d[^\]]*\]/g;

const ORACLE = /\[(?:native|reference|invariant|provisional)\]|\[repro (?:wisp)?#\d+\]|\[spec [^\]]+\]/;

export const KIND_TAGS = [
  "Every test title ends with exactly one kind tag (#422):",
  "  [k1 scenario]                       replayed input through the whole system, asserting invariants or agreement",
  "  [k2 property]                       a property over a pure core",
  "  [k3 measure #N] / [k3 measure docs/<path>.md]  an owner-decided number, citing the issue or doc that sets it",
  "  [k4 reference <source>]             an external reference: melee, melee-decomp, lua32, wurst, native, …",
  "  [k5 boundary <name>]                one integration check per real boundary; each name once in the suite",
  "A test that fits no kind is scaffolding: delete it (bun wisp help testing).",
].join("\n");

export type TestTitle = { readonly file: string; readonly line: number; readonly title: string | undefined };

export type Refused = { readonly file: string; readonly line: number; readonly title: string; readonly why: string };


/** The pure core: every title that breaks the kind-tag rule, and why. `docExists` answers for repo-relative paths. */
export function kindTagProblems(titles: readonly TestTitle[], docExists: (path: string) => boolean): Refused[] {
  const refused: Refused[] = [];
  const boundaries = new Map<string, TestTitle>();
  for (const entry of titles) {
    const { file, line, title } = entry;
    const refuse = (why: string): void => void refused.push({ file, line, title: title ?? "", why });
    if (title === undefined) { refuse("title is not literal text"); continue; }
    const tag = KIND_TAG.exec(title);
    if (tag === null) { refuse("does not end with a kind tag"); continue; }
    if ((title.match(ANY_KIND) ?? []).length !== 1) { refuse("carries more than one kind tag"); continue; }
    if (ORACLE.test(title)) { refuse("still carries an oracle tag"); continue; }
    const [, kind, doc] = tag;
    if (doc?.startsWith("docs/") === true && !docExists(doc)) refuse(`cites ${doc}, which does not exist`);
    if (kind?.startsWith("k5 ") === true) {
      const name = kind.slice("k5 boundary ".length);
      const first = boundaries.get(name);
      if (first === undefined) boundaries.set(name, entry);
      else refuse(`boundary ${name} is already checked at ${first.file}:${first.line}`);
    }
  }
  return refused;
}

const REGISTRARS = new Set(["test", "it", "sweep"]);

const CURRIED = new Set(["each", "if", "skipIf", "todoIf"]);


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


function titleText(node: ts.Expression | undefined): string | undefined {
  if (node === undefined) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span) => `\${…}${span.literal.text}`).join("");
  return undefined;
}


/** Every test call site's title in `files`; a title that is not literal text is undefined. */
export function testTitles(root: string, files: readonly string[]): TestTitle[] {
  const found: TestTitle[] = [];
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(join(root, file), "utf8"), ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && registersTest(node)) {
        found.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, title: titleText(node.arguments[0]) });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}


/** Exits 1 naming each refused title; `root` is ts/, and k3 doc paths resolve from the repo root above it. */
export function refuseUntagged(root: string, files: readonly string[]): void {
  const repo = resolve(root, "..");
  const refused = kindTagProblems(testTitles(root, files), (path) => existsSync(join(repo, path)));
  if (refused.length === 0) return;
  console.error(`refused: ${refused.length} test title${refused.length === 1 ? " breaks" : "s break"} the kind-tag rule; nothing ran.`);
  for (const { file, line, title, why } of refused) console.error(`  ${file}:${line}  ${why}: ${title}`);
  console.error(KIND_TAGS);
  process.exit(1);
}
