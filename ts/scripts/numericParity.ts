// Numeric Lua parity implementation used by the Wisp parity command.
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { evaluateCase } from "../src/parity/corpus";
import { at } from "wisp/src/runtime/lookup";
import { runProcess } from "./hostProcess";

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

/** A corpus step that couldn't run: an unreadable result file, or TypeScriptToLua or a Lua that failed. */
export class NumericParityFailure extends Schema.TaggedError<NumericParityFailure>()("NumericParityFailure", {
  operation: Schema.String,
  problem: Schema.String,
}) {
  override get message(): string {
    return `${this.operation}: ${this.problem}`;
  }
}

/**
 * Runs the emitted Lua corpus in each named Lua, or reads the supplied native
 * result files, against Bun; succeeds with false for an empty or divergent result.
 */
export const runNumericParity = (supplied: readonly string[], luas: readonly (readonly [name: string, executable: string])[]) => Effect.gen(function*() {
  if (supplied.length > 0) {
    const texts = yield* Effect.tryPromise({
      try: () => Promise.all(supplied.map((path) => Bun.file(path).text())),
      catch: (cause) => new NumericParityFailure({ operation: "read native results", problem: String(cause) }),
    });
    // Preload files wrap each line as: call Preload( "..." )
    return compareOutput("native", texts.join("\n").replace(/call Preload\( "([^"]*)" \)/g, "$1"));
  }
  yield* runProcess(ChildProcess.make(process.execPath, ["--bun", "node_modules/typescript-to-lua/dist/tstl.js", "-p", "tsconfig.lua.json"], { stdout: "inherit", stderr: "inherit" })).pipe(
    Effect.mapError((failure) => new NumericParityFailure({ operation: "TypeScriptToLua", problem: failure.message })));
  let passed = true;
  for (const [name, executable] of luas) {
    const output = yield* runProcess(ChildProcess.make(executable, ["build/parity.lua"], { stderr: "inherit" })).pipe(
      Effect.mapError((failure) => new NumericParityFailure({ operation: `${name} run`, problem: failure.message })));
    if (!compareOutput(name, output)) passed = false;
  }
  return passed;
});
