// Numeric Lua parity implementation used by the Wisp parity command.
import { evaluateCase } from "../src/parity/corpus";
import { at } from "wisp/src/runtime/lookup";

// Lua's %a hex floats are exact: [-]0xH.HHHp[+-]D.
function parseHexFloat(text: string): number {
  const match = /^(-?)0x([0-9a-f]+)(?:\.([0-9a-f]*))?p([+-]\d+)$/.exec(text);
  if (match === null) return NaN;
  const [, sign, whole, fractionDigits = "", exponent] = match;
  if (whole === undefined || exponent === undefined) return NaN;
  let value = parseInt(whole, 16);
  for (let i = 0; i < fractionDigits.length; i++) value += parseInt(fractionDigits.charAt(i), 16) / 16 ** (i + 1);
  value *= 2 ** Number(exponent);
  return sign === "-" ? -value : value;
}

function parseLuaNumber(text: string): number {
  if (text.startsWith("0x") || text.startsWith("-0x")) return parseHexFloat(text);
  if (text === "inf") return Infinity;
  if (text === "-inf") return -Infinity;
  if (text.includes("nan")) return NaN;
  return Number(text);
}

function sameValue(a: number, b: number): boolean {
  return Object.is(a, b) || (a !== a && b !== b);
}

/** Runs the emitted Lua corpus against Bun; returns false for an empty or divergent result. */
export async function runNumericParity(supplied: readonly string[] = []): Promise<boolean> {
  let output: string;
  if (supplied.length > 0) {
    const texts = await Promise.all(supplied.map((path) => Bun.file(path).text()));
    // Preload files wrap each line as: call Preload( "..." )
    output = texts.join("\n").replace(/call Preload\( "([^"]*)" \)/g, "$1");
  } else {
    const compile = Bun.spawnSync([process.execPath, "--bun", "node_modules/typescript-to-lua/dist/tstl.js", "-p", "tsconfig.lua.json"], { stdout: "inherit", stderr: "inherit" });
    if (compile.exitCode !== 0) throw new Error("TypeScriptToLua failed");
    const run = Bun.spawnSync([process.env.LUA ?? "lua", "build/parity.lua"], { stderr: "inherit" });
    if (run.exitCode !== 0) throw new Error("Lua run failed");
    output = run.stdout.toString();
  }

  let cases = 0;
  let mismatches = 0;
  const perField: number[] = [];
  for (const line of output.split("\n")) {
    const fields = line.trim().split(/\s+/);
    if (!/^\d+$/.test(fields[0] ?? "")) continue;
    if (fields.length !== 9) continue;
    const index = Number(fields[0]);
    const expected = evaluateCase(index);
    cases++;
    for (let field = 0; field < 8; field++) {
      const actual = parseLuaNumber(at(fields, field + 1));
      if (!sameValue(actual, at(expected, field))) {
        mismatches++;
        perField[field] = (perField[field] ?? 0) + 1;
        if (mismatches <= 10) console.log(`case ${index} result ${field}: lua ${fields[field + 1]} host ${expected[field]}`);
      }
    }
  }
  console.log(`mismatches by result (+ - * / fma atan2 cos sin): ${JSON.stringify(perField)}`);
  console.log(`${cases} cases, ${cases * 8} results, ${mismatches} mismatches`);
  return cases > 0 && mismatches === 0;
}
