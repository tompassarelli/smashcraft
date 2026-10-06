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

/** Results per corpus case (src/parity/corpus.ts). */
const RESULTS = 11;

function sameValue(a: number, b: number): boolean {
  return Object.is(a, b) || (a !== a && b !== b);
}

/** One output's results against Bun's: prints its mismatches, returns whether it has cases and none. */
function compareOutput(name: string, output: string): boolean {
  let cases = 0;
  let mismatches = 0;
  const perField: number[] = [];
  for (const line of output.split("\n")) {
    const fields = line.trim().split(/\s+/);
    if (!/^\d+$/.test(fields[0] ?? "")) continue;
    if (fields.length !== RESULTS + 1) continue;
    const index = Number(fields[0]);
    const expected = evaluateCase(index);
    cases++;
    for (let field = 0; field < RESULTS; field++) {
      const actual = parseLuaNumber(at(fields, field + 1));
      if (!sameValue(actual, at(expected, field))) {
        mismatches++;
        perField[field] = (perField[field] ?? 0) + 1;
        if (mismatches <= 10) console.log(`${name}: case ${index} result ${field}: lua ${fields[field + 1]} host ${expected[field]}`);
      }
    }
  }
  console.log(`${name}: mismatches by result (+ - * / fma atan2 cos sin, then f32 + - *): ${JSON.stringify(perField)}`);
  console.log(`${name}: ${cases} cases, ${cases * RESULTS} results, ${mismatches} mismatches`);
  return cases > 0 && mismatches === 0;
}

/**
 * Runs the emitted Lua corpus in each named Lua, or reads the supplied native
 * result files, against Bun; returns false for an empty or divergent result.
 */
export async function runNumericParity(supplied: readonly string[], luas: readonly (readonly [name: string, executable: string])[]): Promise<boolean> {
  if (supplied.length > 0) {
    const texts = await Promise.all(supplied.map((path) => Bun.file(path).text()));
    // Preload files wrap each line as: call Preload( "..." )
    return compareOutput("native", texts.join("\n").replace(/call Preload\( "([^"]*)" \)/g, "$1"));
  }
  const compile = Bun.spawnSync([process.execPath, "--bun", "node_modules/typescript-to-lua/dist/tstl.js", "-p", "tsconfig.lua.json"], { stdout: "inherit", stderr: "inherit" });
  if (compile.exitCode !== 0) throw new Error("TypeScriptToLua failed");
  let passed = true;
  for (const [name, executable] of luas) {
    const run = Bun.spawnSync([executable, "build/parity.lua"], { stderr: "inherit" });
    if (run.exitCode !== 0) throw new Error(`${name} run failed`);
    if (!compareOutput(name, run.stdout.toString())) passed = false;
  }
  return passed;
}
