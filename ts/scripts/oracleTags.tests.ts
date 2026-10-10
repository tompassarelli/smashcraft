import { expect, test } from "bun:test";
import { kindTagProblems, type TestTitle } from "./oracleTags";

const DOCS = new Set(["docs/physics.md", "docs/design/roster.md"]);
const docExists = (path: string): boolean => DOCS.has(path);

const random = (seed: number) => () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed / 2_147_483_648;
};

const TAGS = ["[k1 scenario]", "[k2 property]", "[k3 measure #422]", "[k3 measure docs/physics.md]", "[k4 reference melee-decomp]", "[k4 reference lua32]"];

const BROKEN = [
  (body: string) => body,
  (body: string) => `${body} [k2 property] trailing words`,
  (body: string) => `${body} [k1 scenario] [k2 property]`,
  (body: string) => `${body} [spec #12] [k2 property]`,
  (body: string) => `${body} [k3 measure docs/missing.md]`,
  (body: string) => `${body} [k6 other]`,
  (body: string) => `${body}[k1 scenario]`,
] as const;

test("a title is refused exactly when it breaks the kind-tag rule, and boundary names are each used once, over 2,000 generated suites [k2 property]", () => {
  const next = random(422);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  const words = ["shield", "drops", "every", "frame", "Melee's", "50%", "${…}", "(x, y)", "#7", "docs/x"];
  for (let suite = 0; suite < 2_000; suite++) {
    const titles: TestTitle[] = [];
    const expected: number[] = [];
    const boundaries = new Set<string>();
    const count = 1 + Math.floor(next() * 8);
    for (let index = 0; index < count; index++) {
      const body = Array.from({ length: 1 + Math.floor(next() * 6) }, () => pick(words)).join(" ");
      const roll = next();
      let title: string | undefined;
      let bad: boolean;
      if (roll < 0.1) {
        title = undefined;
        bad = true;
      } else if (roll < 0.35) {
        title = pick(BROKEN)(body);
        bad = true;
      } else if (roll < 0.5) {
        const name = pick(["wc3-client", "wc3-preload", "sdl-pad"]);
        title = `${body} [k5 boundary ${name}]`;
        bad = boundaries.has(name);
        boundaries.add(name);
      } else {
        title = `${body} ${pick(TAGS)}`;
        bad = false;
      }
      titles.push({ file: `f${suite}.ts`, line: index + 1, title });
      if (bad) expected.push(index + 1);
    }
    expect(kindTagProblems(titles, docExists).map((refused) => refused.line), titles.map((each) => each.title ?? "<expression>").join(" | ")).toEqual(expected);
  }
});
