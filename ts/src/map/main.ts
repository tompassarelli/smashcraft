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
  const facts = [
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
