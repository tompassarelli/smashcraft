// Warcraft entry for the TypeScript spike: evaluates the parity corpus in the
// game's Lua and records exact results and runtime facts in CustomMapData.
import { evaluateCase } from "../parity/corpus";

declare function PreloadGenClear(this: void): void;
declare function PreloadGenStart(this: void): void;
declare function Preload(this: void, text: string): void;
declare function PreloadGenEnd(this: void, filename: string): void;

const CASES = 300;
// One Preload line per case keeps each line well under the native length limit.
const LINES_PER_FILE = 150;

function writeFile(name: string, lines: string[]): void {
  PreloadGenClear();
  PreloadGenStart();
  for (const line of lines) Preload(line);
  PreloadGenEnd(name);
}

export function start(this: void): void {
  // Runtime-parsed operands keep Lua's compile-time constant folding out of the
  // rounding probe. Nearest: 1/3 = 0x1.555556p-2; toward zero: 0x1.555554p-2.
  const one = tonumber("1.0")!;
  const two = tonumber("2.0")!;
  const three = tonumber("3.0")!;
  const tenth = tonumber("0.1")!;
  const fifth = tonumber("0.2")!;
  const facts = [
    `rounding 1/3 ${string.format("%a", one / three)} -1/3 ${string.format("%a", -one / three)} 2/3 ${string.format("%a", two / three)}`,
    `rounding 0.1+0.2 ${string.format("%a", tenth + fifth)} 0.1*3 ${string.format("%a", tenth * three)}`,
    // Exact decimal inputs. x*x = 2.25 + 1.5 ulp + 2^-46: nearest 0x1.200004p+1, toward zero 0x1.200002p+1.
    // 1 + 3*2^-24 = 1 + 1.5 ulp: nearest 0x1.000004p+0, toward zero 0x1.000002p+0.
    `rounding parse0.1 ${string.format("%a", tenth)} mul ${string.format("%a", tonumber("1.50000011920928955078125")! * tonumber("1.50000011920928955078125")!)} add ${string.format("%a", one + tonumber("0.000000178813934326171875")!)}`,
    `maxinteger ${string.format("%d", math.maxinteger)}`,
    `string.pack ${type(rawget(string, "pack"))}`,
    `load ${type(rawget(_G, "load"))}`,
    `math.type ${type(rawget(math, "type"))}`,
  ];
  writeFile("smashcraft-ts-facts.txt", facts);
  let lines: string[] = [];
  let page = 0;
  for (let index = 0; index < CASES; index++) {
    const fields = [`${index}`];
    for (const value of evaluateCase(index)) fields.push(string.format("%a", value));
    lines.push(fields.join(" "));
    if (lines.length === LINES_PER_FILE || index === CASES - 1) {
      writeFile(`smashcraft-ts-parity-p${page}.txt`, lines);
      lines = [];
      page++;
    }
  }
}
