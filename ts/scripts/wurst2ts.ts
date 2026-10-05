// Deterministic first pass of the Wurst-to-TypeScript port (#35).
// Converts the mechanical bulk and keeps the semantics that are easy to lose:
// Wurst precedence (unary minus below *, `not` below ==), truncating `div` and
// Wurst `mod` (idiv/imod), array reads that default instead of returning
// undefined, implicit `this` members, and binary32 reals: types are inferred
// from Wurst declarations, real arithmetic is wrapped in f32() and real literals
// are emitted as their exact binary32 value, so Bun, 32-bit Lua and Wurst's
// interpreter compute the same numbers.
// Anything it does not recognize becomes a `TODO(wurst2ts)` comment; `tsc`
// errors are the remaining work list.
// Usage: bun scripts/wurst2ts.ts OUT_DIR WURST_FILE...
import { basename } from "node:path";

// ---------------------------------------------------------------- lexer

type TokenKind = "id" | "num" | "str" | "op" | "eol";
interface Token {
  kind: TokenKind;
  text: string;
  start: number;
}

const OPERATORS = ["...", "..", "->", "==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "++", "--", "?.",
  "+", "-", "*", "/", "%", "<", ">", "=", "(", ")", "[", "]", ",", ".", "?", ":", "!"];

function rawcode(text: string): string {
  // 'abcd' four-character codes are big-endian integers (FourCC).
  let value = 0;
  for (const char of text) value = value * 256 + char.charCodeAt(0);
  return `${value} /* '${text}' */`;
}

function lex(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i]!;
    if (c === " " || c === "\t") { i++; continue; }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(i))!;
      tokens.push({ kind: "id", text: m[0], start: i });
      i += m[0].length;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(line[i + 1] ?? ""))) {
      const m = /^(0x[0-9A-Fa-f]+|\$[0-9A-Fa-f]+|[0-9]*\.[0-9]*(?:[eE][-+]?[0-9]+)?|[0-9]+(?:[eE][-+]?[0-9]+)?)/.exec(line.slice(i))!;
      tokens.push({ kind: "num", text: m[0], start: i });
      i += m[0].length;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j += line[j] === "\\" ? 2 : 1;
      tokens.push({ kind: "str", text: line.slice(i, j + 1), start: i });
      i = j + 1;
      continue;
    }
    if (c === "'") {
      const end = line.indexOf("'", i + 1);
      tokens.push({ kind: "num", text: rawcode(line.slice(i + 1, end)), start: i });
      i = end + 1;
      continue;
    }
    const op = OPERATORS.find((o) => line.startsWith(o, i));
    if (op === undefined) throw new Error(`unexpected character ${c} in: ${line}`);
    tokens.push({ kind: "op", text: op, start: i });
    i += op.length;
  }
  tokens.push({ kind: "eol", text: "", start: line.length });
  return tokens;
}

/** Splits a line into code and trailing // comment, ignoring // inside strings. */
function splitComment(line: string): [string, string] {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i - 1] !== "\\") inString = !inString;
    if (!inString && c === "/" && line[i + 1] === "/") return [line.slice(0, i), line.slice(i)];
  }
  return [line, ""];
}

// ---------------------------------------------------------------- types

const TYPE_MAP: Record<string, string> = { int: "number", real: "number", boolean: "boolean", bool: "boolean", string: "string", code: "() => void" };

function tsType(wurst: string): string {
  return TYPE_MAP[wurst] ?? wurst;
}

function defaultValue(wurst: string): string {
  if (wurst === "int") return "0";
  if (wurst === "real") return "0.0";
  if (wurst === "boolean" || wurst === "bool") return "false";
  if (wurst === "string") return '"" /* TODO(wurst2ts): Wurst default is null */';
  return "null";
}

function literal(text: string): Emitted {
  if (text.startsWith("$")) return { text: `0x${text.slice(1)}`, prec: 20, type: "int" };
  if (text.includes("/*") || /^0x/i.test(text) || !/[.eE]/.test(text)) return { text, prec: 20, type: "int" };
  // A real literal means its nearest binary32 value; print that value exactly,
  // keeping a decimal point or exponent so the plugin emits a Lua float.
  let exact = String(Math.fround(Number(text.endsWith(".") ? `${text}0` : text)));
  if (!/[.eE]/.test(exact)) exact += ".0";
  return { text: exact, prec: 20, type: "real" };
}

// ---------------------------------------------------------------- expressions

// Wurst binding power (higher binds tighter) and TypeScript precedence for re-emission.
const BINARY: Record<string, { power: number; ts: string; tsPrec: number }> = {
  or: { power: 1, ts: "||", tsPrec: 3 },
  and: { power: 2, ts: "&&", tsPrec: 4 },
  "==": { power: 4, ts: "===", tsPrec: 8 },
  "!=": { power: 4, ts: "!==", tsPrec: 8 },
  "<": { power: 5, ts: "<", tsPrec: 9 },
  "<=": { power: 5, ts: "<=", tsPrec: 9 },
  ">": { power: 5, ts: ">", tsPrec: 9 },
  ">=": { power: 5, ts: ">=", tsPrec: 9 },
  "+": { power: 6, ts: "+", tsPrec: 11 },
  "-": { power: 6, ts: "-", tsPrec: 11 },
  "*": { power: 8, ts: "*", tsPrec: 12 },
  "/": { power: 8, ts: "/", tsPrec: 12 },
  div: { power: 8, ts: "idiv", tsPrec: 20 },
  mod: { power: 8, ts: "imod", tsPrec: 20 },
  "%": { power: 8, ts: "imod", tsPrec: 20 },
};
const NOT_POWER = 3;
const NEGATE_POWER = 7;

/** Emitted text with its TypeScript precedence (20 = primary). */
interface Emitted {
  text: string;
  prec: number;
  /** Inferred Wurst type ("int", "real", class name, "array:T"), if known. */
  type?: string | undefined;
}

const METHOD_TYPES: Record<string, (receiver: string | undefined) => string | undefined> = {
  toInt: () => "int",
  toReal: () => "real",
  abs: (r) => r,
  roundToFloat32: () => "real",
  squared: (r) => r,
  length: () => "int",
  toChar: () => "int",
  toString: () => "string",
};

function arithmeticType(op: string, left: string | undefined, right: string | undefined): string | undefined {
  if (op === "+" && (left === "string" || right === "string")) return "string";
  if (op === "/") return "real";
  if (left === "real" || right === "real") return "real";
  if (left === "int" && right === "int") return "int";
  return undefined;
}

const STDLIB_METHODS: Record<string, (receiver: string, args: string[]) => string> = {
  toInt: (r) => `toInt(${r})`,
  toReal: (r) => `toReal(${r})`,
  abs: (r) => `Math.abs(${r})`,
  roundToFloat32: (r) => `roundToFloat32(${r})`,
  squared: (r) => `squared(${r})`,
  length: (r) => `${r}.length`,
  toChar: (r) => `${r}.charCodeAt(0)`,
  // A Wurst char and an int both have toString(); only the type says which.
  toString: (r: string) => `String(${r}) /* TODO(wurst2ts): char.toString() is String.fromCharCode, real.toString() is R2S */`,
  assertTrue: (r) => `assertTrue(${r})`,
  assertFalse: (r) => `assertFalse(${r})`,
  assertEquals: (r, a) => (a.length === 2 ? `assertNear(${[r, ...a].join(", ")})` : `assertEquals(${[r, ...a].join(", ")})`),
  assertGreaterThan: (r, a) => `assertGreaterThan(${[r, ...a].join(", ")})`,
  assertLessThan: (r, a) => `assertLessThan(${[r, ...a].join(", ")})`,
};

export interface Scope {
  /** Instance members of the enclosing class, including inherited ones. */
  members: Set<string>;
  /** Static members of the enclosing class. */
  statics: Set<string>;
  className: string | undefined;
  /** Locals and parameters visible here; shadow members. */
  locals: Set<string>;
  /** Array names (globals or members) with their element default. */
  arrays: Map<string, string>;
  /** Helper names the output needs imported. */
  helpers: Set<string>;
  /** Wurst types of locals and parameters. */
  localTypes: Map<string, string>;
  /** The enclosing class, for member types. */
  cls: ClassInfo | undefined;
  tables: Tables;
}

interface Tables {
  /** Global variables and constants; arrays as "array:T". */
  globals: Map<string, string>;
  /** Top-level function return types; tuple names return their tuple. */
  functions: Map<string, string>;
  /** Classes and tuples by name. */
  classes: Map<string, ClassInfo>;
}

function classChain(tables: Tables, name: string | undefined): ClassInfo[] {
  const chain: ClassInfo[] = [];
  let current = name !== undefined ? tables.classes.get(name) : undefined;
  while (current !== undefined && !chain.includes(current)) {
    chain.push(current);
    current = current.base !== undefined ? tables.classes.get(current.base) : undefined;
  }
  return chain;
}

function fieldType(tables: Tables, owner: string | undefined, name: string): string | undefined {
  for (const info of classChain(tables, owner)) {
    const type = info.fields.get(name);
    if (type !== undefined) return type;
  }
  return undefined;
}

function returnType(tables: Tables, owner: string | undefined, name: string): string | undefined {
  for (const info of classChain(tables, owner)) {
    const type = info.returns.get(name);
    if (type !== undefined) return type;
  }
  return undefined;
}

function elementType(type: string | undefined): string | undefined {
  return type?.startsWith("array:") ? type.slice(6) : undefined;
}

class ExpressionParser {
  private index = 0;
  constructor(private readonly tokens: Token[], private readonly scope: Scope) {}

  peek(offset = 0): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)]!;
  }

  next(): Token {
    return this.tokens[this.index++]!;
  }

  at(text: string): boolean {
    const t = this.peek();
    return (t.kind === "op" || t.kind === "id") && t.text === text;
  }

  expect(text: string): void {
    const t = this.next();
    if (t.text !== text) throw new Error(`expected ${text}, got ${t.text || "end of line"}`);
  }

  done(): boolean {
    return this.peek().kind === "eol";
  }

  position(): number {
    return this.index;
  }

  parse(minPower = 0): Emitted {
    let left = this.prefix();
    for (;;) {
      const t = this.peek();
      if (t.kind === "op" && t.text === "?" && minPower === 0) {
        this.next();
        const whenTrue = this.parse();
        this.expect(":");
        const whenFalse = this.parse();
        left = { text: `${wrap(left, 3)} ? ${wrap(whenTrue, 2)} : ${wrap(whenFalse, 2)}`, prec: 2, type: whenTrue.type ?? whenFalse.type };
        continue;
      }
      const info = BINARY[t.text];
      if (info === undefined || (t.kind !== "op" && t.kind !== "id") || info.power <= minPower) break;
      this.next();
      const right = this.parse(info.power);
      if (info.ts === "idiv" || info.ts === "imod") {
        this.scope.helpers.add(info.ts);
        left = { text: `${info.ts}(${left.text}, ${right.text})`, prec: 20, type: "int" };
      } else if (["+", "-", "*", "/"].includes(info.ts)) {
        const type = arithmeticType(info.ts, left.type, right.type);
        const text = `${wrap(left, info.tsPrec)} ${info.ts} ${wrap(right, info.tsPrec + 1)}`;
        left = type === "real" ? { text: `f32(${text})`, prec: 20, type } : { text, prec: info.tsPrec, type };
      } else {
        left = { text: `${wrap(left, info.tsPrec)} ${info.ts} ${wrap(right, info.tsPrec + 1)}`, prec: info.tsPrec, type: "boolean" };
      }
    }
    return left;
  }

  prefix(): Emitted {
    const t = this.peek();
    if (t.kind === "id" && t.text === "not") {
      this.next();
      const operand = this.parse(NOT_POWER);
      return { text: `!${wrap(operand, 14)}`, prec: 14, type: "boolean" };
    }
    if (t.kind === "op" && t.text === "-") {
      this.next();
      const operand = this.parse(NEGATE_POWER);
      return { text: `-${wrap(operand, 14)}`, prec: 14, type: operand.type };
    }
    return this.postfix(this.primary());
  }

  /** A closure `(T a, T b) -> body` or `x -> body` starting at the current token, if any. */
  closure(): Emitted | undefined {
    const params: string[] = [];
    let i = 0;
    if (this.peek().kind === "id" && this.peek(1).text === "->") {
      params.push(this.peek().text);
      i = 1;
    } else if (this.at("(")) {
      i = 1;
      for (;;) {
        const t = this.peek(i);
        if (t.text === ")") { i++; break; }
        if (t.kind !== "id" && t.text !== ",") return undefined;
        i++;
      }
      if (this.peek(i).text !== "->") return undefined;
      // Parameters are `T name` or `name`, comma separated.
      const parts: string[][] = [[]];
      for (let k = 1; k < i - 1; k++) {
        const t = this.peek(k);
        if (t.text === ",") parts.push([]);
        else parts[parts.length - 1]!.push(t.text);
      }
      for (const part of parts) {
        if (part.length === 2) {
          params.push(`${part[1]}: ${tsType(part[0]!)}`);
          this.scope.localTypes.set(part[1]!, part[0]!);
        } else if (part.length === 1) params.push(part[0]!);
      }
    } else {
      return undefined;
    }
    for (let k = 0; k <= i; k++) this.next(); // parameters and ->
    for (const p of params) this.scope.locals.add(p.split(":")[0]!);
    if (this.done()) return { text: `(${params.join(", ")}) => {`, prec: 2 }; // block body follows
    if (this.at("skip")) {
      this.next();
      return { text: `(${params.join(", ")}) => {}`, prec: 2 };
    }
    const body = this.parse();
    return { text: `(${params.join(", ")}) => ${body.text}`, prec: 2 };
  }

  primary(): Emitted {
    const lambda = this.closure();
    if (lambda !== undefined) return lambda;
    const t = this.next();
    if (t.kind === "num") return literal(t.text);
    if (t.kind === "str") return { text: t.text, prec: 20, type: "string" };
    if (t.kind === "op" && t.text === "(") {
      const inner = this.parse();
      this.expect(")");
      return { text: `(${inner.text})`, prec: 20, type: inner.type };
    }
    if (t.kind !== "id") throw new Error(`unexpected ${t.text || "end of line"}`);
    switch (t.text) {
      case "null":
        return { text: t.text, prec: 20 };
      case "true":
      case "false":
        return { text: t.text, prec: 20, type: "boolean" };
      case "this":
        return { text: "this", prec: 20, type: this.scope.cls?.name };
      case "new": {
        const name = this.next().text;
        const args = this.at("(") ? this.args() : [];
        return { text: `new ${name}(${args.join(", ")})`, prec: 20, type: name };
      }
      case "function": {
        const name = this.next().text;
        return { text: this.resolve(name), prec: 20 };
      }
      case "destroy": {
        const target = this.parse(NEGATE_POWER);
        return { text: `${wrap(target, 20)}.destroy()`, prec: 20 };
      }
    }
    if (this.at("(")) {
      const callee = this.resolve(t.text);
      const type = callee.startsWith("this.") || callee.includes(".")
        ? returnType(this.scope.tables, this.scope.cls?.name, t.text)
        : this.scope.tables.functions.get(t.text);
      return { text: `${callee}(${this.args().join(", ")})`, prec: 20, type };
    }
    const resolved = this.resolve(t.text);
    let type: string | undefined;
    if (this.scope.locals.has(t.text)) type = this.scope.localTypes.get(t.text);
    else if (resolved !== t.text) type = fieldType(this.scope.tables, this.scope.cls?.name, t.text);
    else type = this.scope.tables.globals.get(t.text);
    return { text: resolved, prec: 20, type };
  }

  /** Bare identifiers inside class methods may be members: add this. or Class. */
  resolve(name: string): string {
    if (this.scope.locals.has(name)) return name;
    if (this.scope.members.has(name)) return `this.${name}`;
    if (this.scope.statics.has(name) && this.scope.className !== undefined) return `${this.scope.className}.${name}`;
    return name;
  }

  args(): string[] {
    this.expect("(");
    const list: string[] = [];
    while (!this.at(")")) {
      list.push(this.parse().text);
      if (this.at(",")) this.next();
      else break;
    }
    this.expect(")");
    return list;
  }

  postfix(base: Emitted): Emitted {
    let current = base;
    for (;;) {
      if (this.at(".") || this.at("..") || this.at("?.")) {
        const dot = this.next().text === "?." ? "?." : ".";
        const name = this.next().text;
        if (this.at("(")) {
          const args = this.args();
          const special = Object.hasOwn(STDLIB_METHODS, name) ? STDLIB_METHODS[name] : undefined;
          if (special !== undefined && dot === ".") {
            current = { text: special(current.text, args), prec: 20, type: METHOD_TYPES[name]?.(current.type) };
            for (const helper of ["toInt", "toReal", "roundToFloat32", "squared", "assertTrue", "assertFalse", "assertEquals", "assertGreaterThan", "assertLessThan"]) {
              if (current.text.startsWith(`${helper}(`)) this.scope.helpers.add(helper);
            }
          } else {
            current = { text: `${wrap(current, 20)}${dot}${name}(${args.join(", ")})`, prec: 20, type: returnType(this.scope.tables, current.type, name) };
          }
        } else {
          current = { text: `${wrap(current, 20)}${dot}${name}`, prec: 20, type: fieldType(this.scope.tables, current.type, name) };
        }
        continue;
      }
      if (this.at("[")) {
        this.next();
        const index = this.parse();
        this.expect("]");
        current = { text: `${current.text}[${index.text}]`, prec: 20, type: elementType(current.type) };
        continue;
      }
      if (this.at("castTo")) {
        this.next();
        const type = this.next().text;
        current = { text: `(${current.text} as unknown as ${tsType(type)})`, prec: 20, type };
        continue;
      }
      return current;
    }
  }
}

function wrap(e: Emitted, minPrec: number): string {
  return e.prec < minPrec ? `(${e.text})` : e.text;
}

/** Array reads default like Wurst arrays; writes stay plain. */
function defaultArrayReads(text: string, scope: Scope): string {
  if (scope.arrays.size === 0) return text;
  // name[expr] where name (optionally this.) is a known array; expr may nest one bracket level.
  return text.replace(/(?<![\w.])((?:this\.|[A-Z]\w*\.)?(\w+))\[((?:[^[\]]|\[[^[\]]*\])*)\]/g, (whole, access: string, name: string, index: string) => {
    const fallback = scope.arrays.get(name);
    return fallback === undefined ? whole : `(${access}[${defaultArrayReads(index, scope)}] ?? ${fallback})`;
  });
}

export function expression(source: string, scope: Scope): Emitted {
  const parser = new ExpressionParser(lex(source), scope);
  const result = parser.parse();
  if (!parser.done()) throw new Error(`unparsed text after expression: ${source}`);
  if (result.text.includes("f32(")) scope.helpers.add("f32");
  return { ...result, text: defaultArrayReads(result.text, scope) };
}

// ---------------------------------------------------------------- statements

interface ClassInfo {
  name: string;
  base: string | undefined;
  members: Set<string>;
  statics: Set<string>;
  arrays: Map<string, string>;
  /** Field types; arrays as "array:T". */
  fields: Map<string, string>;
  /** Method return types. */
  returns: Map<string, string>;
}

function emptyClass(name: string, base: string | undefined): ClassInfo {
  return { name, base, members: new Set(), statics: new Set(), arrays: new Map(), fields: new Map(), returns: new Map() };
}

/** The Wurst type of an untyped constant's literal initializer. */
function literalType(init: string | undefined): string | undefined {
  if (init === undefined) return undefined;
  const value = init.trim();
  if (/^-?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/.test(value)) return "real";
  if (/^-?\d+$/.test(value) || /^'.{1,4}'$/.test(value)) return "int";
  if (value.startsWith('"')) return "string";
  if (value === "true" || value === "false") return "boolean";
  return undefined;
}

interface Block {
  indent: number;
  closer: string;
  kind: "class" | "function" | "control" | "lambda" | "init";
  classInfo?: ClassInfo;
  hadDestroy?: boolean;
}

const MODIFIERS = new Set(["public", "private", "protected", "static", "override", "abstract", "constant", "readonly"]);

function indentOf(line: string): number {
  let width = 0;
  for (const c of line) {
    if (c === "\t") width += 4;
    else if (c === " ") width += 1;
    else break;
  }
  return width;
}

interface Declaration {
  modifiers: Set<string>;
  keyword: "let" | "var" | "constant" | "typed";
  type: string | undefined;
  array: string | undefined; // size expression, "" for unsized
  name: string;
  init: string | undefined;
}

/** `mods* (let|var|constant [T]|T [array[N]]) name [= expr]` */
function parseDeclaration(code: string): Declaration | undefined {
  const untyped = /^((?:(?:public|private|protected|static)\s+)*)constant\s+([A-Za-z_]\w*)\s*=\s*(.*)$/.exec(code);
  if (untyped !== null) {
    const modifiers = new Set([...untyped[1]!.trim().split(/\s+/).filter((x) => x !== ""), "constant"]);
    return { modifiers, keyword: "constant", type: undefined, array: undefined, name: untyped[2]!, init: untyped[3] };
  }
  const m = /^((?:(?:public|private|protected|static|constant|readonly)\s+)*)(?:(let|var)\s+|([A-Za-z_]\w*)(?:\s+array(?:\s*\[([^\]]*)\])?)?\s+)([A-Za-z_]\w*)\s*(?:=\s*(.*))?$/.exec(code);
  if (m === null) return undefined;
  const modifiers = new Set(m[1]!.trim().split(/\s+/).filter((x) => x !== ""));
  const keywordOrType = m[2] ?? m[3]!;
  if (["if", "while", "for", "return", "else", "function", "class", "tuple", "import", "package", "new", "destroy", "not", "construct", "ondestroy", "init", "skip", "break"].includes(keywordOrType)) return undefined;
  const isArray = /\barray\b/.test(code.split("=")[0]!);
  let type: string | undefined = m[2] === undefined ? m[3] : undefined;
  let keyword: Declaration["keyword"] = m[2] === "let" ? "let" : m[2] === "var" ? "var" : "typed";
  if (modifiers.has("constant") && m[2] === undefined && type !== undefined && !isArray && m[5] !== undefined) keyword = "typed";
  if (modifiers.has("constant")) keyword = keyword === "typed" ? "typed" : keyword;
  return { modifiers, keyword, type, array: isArray ? (m[4] ?? "") : undefined, name: m[5]!, init: m[6] };
}

const CONTINUES = new Set(["and", "or", "+", "-", "*", "/", ",", ".", "(", "[", "=", "==", "!=", "<", ">", "<=", ">=", "div", "mod", "?", ":", "+=", "-=", "*=", "/="]);
const LEADS = new Set(["and", "or", "+", "*", "/", ".", "..", "?", ":", "div", "mod", "-"]);

interface LogicalLine {
  indent: number;
  code: string;
  comment: string;
  /** Text emitted unchanged: blank lines and block comments. */
  verbatim?: string;
}

function depthAndLast(code: string): [number, string] {
  try {
    const tokens = lex(code).filter((t) => t.kind !== "eol");
    let depth = 0;
    for (const t of tokens) {
      if (t.text === "(" || t.text === "[") depth++;
      if (t.text === ")" || t.text === "]") depth--;
    }
    return [depth, tokens[tokens.length - 1]?.text ?? ""];
  } catch {
    return [0, ""];
  }
}

function logicalLines(lines: string[]): LogicalLine[] {
  const result: LogicalLine[] = [];
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (inBlockComment || (trimmed.startsWith("/*") && !trimmed.includes("*/"))) {
      inBlockComment = !trimmed.includes("*/") || (inBlockComment && !trimmed.includes("*/"));
      if (trimmed.startsWith("/*") && !trimmed.includes("*/")) inBlockComment = true;
      result.push({ indent: 0, code: "", comment: "", verbatim: raw });
      continue;
    }
    if (trimmed === "") {
      result.push({ indent: 0, code: "", comment: "", verbatim: "" });
      continue;
    }
    if (trimmed.startsWith("/*") && trimmed.endsWith("*/")) {
      result.push({ indent: 0, code: "", comment: "", verbatim: raw });
      continue;
    }
    const indent = indentOf(raw);
    let [code, comment] = splitComment(trimmed);
    code = code.trim();
    for (;;) {
      const [depth, last] = depthAndLast(code);
      let j = i + 1;
      while (j < lines.length && lines[j]!.trim() === "") j++;
      if (j >= lines.length || code === "") break;
      const [nextCode, nextComment] = splitComment(lines[j]!.trim());
      const nextFirst = (() => {
        try { return lex(nextCode.trim())[0]?.text ?? ""; } catch { return ""; }
      })();
      const leads = LEADS.has(nextFirst) && indentOf(lines[j]!) > indent;
      if (depth <= 0 && !CONTINUES.has(last) && !leads) break;
      if (/->\s*$/.test(code) || (/^(if|while|else|for)\b/.test(code) && depth <= 0 && !CONTINUES.has(last) && !leads)) break;
      code = `${code} ${nextCode.trim()}`;
      comment = [comment, nextComment].filter((c) => c !== "").join(" ");
      i = j;
    }
    result.push({ indent, code, comment });
  }
  return result;
}

/** Splits `target op value` at a top-level assignment operator, if any. */
function splitAssignment(code: string): [string, string, string] | undefined {
  let tokens: Token[];
  try { tokens = lex(code); } catch { return undefined; }
  let depth = 0;
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]!;
    if (t.text === "(" || t.text === "[") depth++;
    if (t.text === ")" || t.text === "]") depth--;
    if (depth === 0 && t.kind === "op" && ["=", "+=", "-=", "*=", "/="].includes(t.text)) {
      return [code.slice(0, t.start).trim(), t.text, code.slice(t.start + t.text.length).trim()];
    }
  }
  return undefined;
}

export interface Conversion {
  ts: string;
  todos: number;
  exports: Set<string>;
}

export function convert(source: string, packageExports: Map<string, string>, tables: Tables): Conversion {
  const classIndex = tables.classes;
  const lines = source.split(/\r?\n/);
  const out: string[] = [];
  const stack: Block[] = [];
  const helpers = new Set<string>();
  const exports = new Set<string>();
  const globalArrays = new Map<string, string>();
  let todos = 0;
  let pendingTest = false;
  let pendingAnnotations: string[] = [];
  let inBlockComment = false;
  let packageName = "";

  const pad = () => "  ".repeat(stack.length);
  const currentClass = () => [...stack].reverse().find((b) => b.kind === "class")?.classInfo;
  const inFunction = () => stack.some((b) => b.kind === "function" || b.kind === "lambda" || b.kind === "init");
  let locals = new Set<string>();
  let localTypes = new Map<string, string>();

  const scope = (): Scope => {
    const cls = currentClass();
    const arrays = new Map(globalArrays);
    if (cls !== undefined) for (const [k, v] of cls.arrays) arrays.set(k, v);
    return {
      members: inFunction() && cls !== undefined ? cls.members : new Set(),
      statics: inFunction() && cls !== undefined ? cls.statics : new Set(),
      className: cls?.name,
      locals,
      arrays,
      helpers,
      localTypes,
      cls,
      tables,
    };
  };
  const typed = (text: string): Emitted => {
    try {
      return expression(text, scope());
    } catch (error) {
      todos++;
      return { text: `undefined as never /* TODO(wurst2ts): ${(error as Error).message.replace(/\*\//g, "* /")}: ${text.replace(/\*\//g, "* /")} */`, prec: 20 };
    }
  };
  const expr = (text: string): string => typed(text).text;
  const declareLocal = (name: string, type: string | undefined) => {
    locals.add(name);
    if (type !== undefined) localTypes.set(name, type);
  };
  const closeTo = (indent: number) => {
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      const block = stack.pop()!;
      if (block.kind === "class" && !block.hadDestroy) out.push(`${pad()}  destroy(): void {}`);
      out.push(`${pad()}${block.closer}`);
      if (block.kind === "function" || block.kind === "init") {
        locals = new Set();
        localTypes = new Map();
      }
    }
  };
  const open = (indent: number, header: string, block: Omit<Block, "indent" | "closer"> & { closer?: string }) => {
    out.push(`${pad()}${header}`);
    stack.push({ closer: "}", ...block, indent });
  };

  for (const line of logicalLines(lines)) {
    if (line.verbatim !== undefined) {
      out.push(line.verbatim);
      continue;
    }
    let code = line.code;
    const comment = line.comment;
    const suffix = comment === "" ? "" : ` ${comment}`;
    // Annotations may share the line with the declaration they mark.
    let annotation: RegExpExecArray | null;
    while ((annotation = /^@(\w+)\s*/.exec(code))) {
      if (annotation[1] === "Test") pendingTest = true;
      else pendingAnnotations.push(annotation[1]!);
      code = code.slice(annotation[0].length);
    }
    if (code === "") {
      out.push(`${pad()}${comment}`);
      continue;
    }
    const indent = line.indent;
    closeTo(indent);
    const p = pad();
    let m: RegExpExecArray | null;

    if ((m = /^package\s+(\w+)/.exec(code))) {
      packageName = m[1]!;
      out.push(`// Converted from package ${packageName} by scripts/wurst2ts.ts.${suffix}`);
      continue;
    }
    if (/^import\s/.test(code)) continue;
    if (code === "init") {
      open(indent, `export function initialize${packageName}(): void {${suffix}`, { kind: "init" });
      exports.add(`initialize${packageName}`);
      continue;
    }
    if ((m = /^(?:(?:public|abstract)\s+)*class\s+(\w+)(?:\s+extends\s+(\w+))?/.exec(code))) {
      const info = classIndex.get(m[1]!) ?? emptyClass(m[1]!, m[2]);
      open(indent, `export class ${m[1]}${m[2] ? ` extends ${m[2]}` : ""} {${suffix}`, { kind: "class", classInfo: info, hadDestroy: false });
      exports.add(m[1]!);
      continue;
    }
    if ((m = /^(?:public\s+)?tuple\s+(\w+)\s*\(([^)]*)\)/.exec(code))) {
      const fields = m[2]!.split(",").map((f) => f.trim().split(/\s+/)).filter((f) => f.length === 2);
      out.push(`${p}/** Wurst tuple: a value type. Copy before mutating a received tuple. */${suffix}`);
      out.push(`${p}export interface ${m[1]} { ${fields.map(([t, n]) => `${n}: ${tsType(t!)};`).join(" ")} }`);
      out.push(`${p}export function ${m[1]}(${fields.map(([t, n]) => `${n}: ${tsType(t!)}`).join(", ")}): ${m[1]} { return { ${fields.map(([, n]) => n).join(", ")} }; }`);
      exports.add(m[1]!);
      continue;
    }
    if ((m = /^((?:(?:public|private|protected|static|override|abstract)\s+)*)function\s+(\w+)\s*\(([^)]*)\)\s*(?:returns\s+(\w+))?\s*$/.exec(code))) {
      const mods = new Set(m[1]!.trim().split(/\s+/).filter((x) => x !== ""));
      const params = m[3]!.split(",").map((f) => f.trim().split(/\s+/)).filter((f) => f.length === 2);
      locals = new Set();
      localTypes = new Map();
      for (const [t, n] of params) declareLocal(n!, t);
      const signature = `${m[2]}(${params.map(([t, n]) => `${n}: ${tsType(t!)}`).join(", ")})${m[4] ? `: ${tsType(m[4])}` : ": void"}`;
      const cls = currentClass();
      if (pendingTest) {
        helpers.add("test");
        open(indent, `test("${m[2]}", () => {${suffix}`, { kind: "function", closer: "});" });
        pendingTest = false;
      } else if (cls !== undefined && stack[stack.length - 1]?.kind === "class") {
        const access = mods.has("private") ? "private " : mods.has("protected") ? "protected " : "";
        open(indent, `${access}${mods.has("static") ? "static " : ""}${signature} {${suffix}`, { kind: "function" });
      } else {
        open(indent, `${stack.length === 0 ? "export " : ""}function ${signature} {${suffix}`, { kind: "function" });
        if (stack.length === 1) exports.add(m[2]!);
      }
      if (pendingAnnotations.length > 0) out.splice(out.length - 1, 0, `${p}// TODO(wurst2ts): annotations ${pendingAnnotations.join(", ")}`);
      if (pendingAnnotations.length > 0) todos++;
      pendingAnnotations = [];
      continue;
    }
    if ((m = /^construct\s*\(([^)]*)\)\s*$/.exec(code))) {
      const params = m[1]!.split(",").map((f) => f.trim().split(/\s+/)).filter((f) => f.length === 2);
      locals = new Set();
      localTypes = new Map();
      for (const [t, n] of params) declareLocal(n!, t);
      open(indent, `constructor(${params.map(([t, n]) => `${n}: ${tsType(t!)}`).join(", ")}) {${suffix}`, { kind: "function" });
      if (currentClass()?.base !== undefined) out.push(`${pad()}super(); // TODO(wurst2ts): check super arguments`);
      continue;
    }
    if (code === "ondestroy") {
      const classBlock = [...stack].reverse().find((b) => b.kind === "class");
      if (classBlock !== undefined) classBlock.hadDestroy = true;
      locals = new Set();
      localTypes = new Map();
      open(indent, `destroy(): void {${suffix}`, { kind: "function" });
      continue;
    }
    if ((m = /^if\s+(.*)$/.exec(code))) {
      open(indent, `if (${expr(m[1]!)}) {${suffix}`, { kind: "control" });
      continue;
    }
    if ((m = /^else\s+if\s+(.*)$/.exec(code))) {
      open(indent, `else if (${expr(m[1]!)}) {${suffix}`, { kind: "control" });
      continue;
    }
    if (code === "else") {
      open(indent, `else {${suffix}`, { kind: "control" });
      continue;
    }
    if ((m = /^while\s+(.*)$/.exec(code))) {
      open(indent, `while (${expr(m[1]!)}) {${suffix}`, { kind: "control" });
      continue;
    }
    if ((m = /^for\s+(\w+)\s*=\s*(.*?)\s+(to|downto)\s+(.*?)(?:\s+step\s+(.*))?$/.exec(code))) {
      const [, name, start, direction, end, step] = m;
      declareLocal(name!, "int");
      const up = direction === "to";
      const increment = step === undefined ? (up ? `${name}++` : `${name}--`) : `${name} ${up ? "+=" : "-="} ${expr(step)}`;
      open(indent, `for (let ${name} = ${expr(start!)}; ${name} ${up ? "<=" : ">="} ${expr(end!)}; ${increment}) {${suffix}`, { kind: "control" });
      continue;
    }
    if ((m = /^for\s+(\w+)\s+(in|from)\s+(.*)$/.exec(code))) {
      locals.add(m[1]!);
      open(indent, `for (const ${m[1]} of ${expr(m[3]!)}) {${suffix} // TODO(wurst2ts): check iteration`, { kind: "control" });
      todos++;
      continue;
    }
    if (code === "break") { out.push(`${p}break;${suffix}`); continue; }
    if (code === "skip") { out.push(`${p}// skip${suffix}`); continue; }
    if ((m = /^return(?:\s+(.*))?$/.exec(code))) {
      out.push(`${p}return${m[1] ? ` ${expr(m[1])}` : ""};${suffix}`);
      continue;
    }
    if ((m = /^destroy\s+(.*)$/.exec(code))) {
      out.push(`${p}${expr(m[1]!)}.destroy();${suffix}`);
      continue;
    }

    // A trailing closure: `call(args) (params) ->` with an indented body.
    if (/->\s*$/.test(code)) {
      const call = /^(.*\))\s+(\([^()]*\)|\w+)\s*->\s*$/.exec(code) ?? /^(.*\))\s*()->\s*$/.exec(code);
      if (call !== null) {
        const params = (call[2] || "()").replace(/^\(|\)$/g, "").split(",").map((x) => x.trim()).filter((x) => x !== "");
        for (const param of params) {
          const parts = param.split(/\s+/);
          declareLocal(parts[parts.length - 1]!, parts.length === 2 ? parts[0] : undefined);
        }
        const typed = params.map((param) => {
          const parts = param.split(/\s+/);
          return parts.length === 2 ? `${parts[1]}: ${tsType(parts[0]!)}` : parts[0]!;
        });
        const head = expr(call[1]!);
        const withClosure = head.endsWith("()") ? `${head.slice(0, -1)}(${typed.join(", ")}) => {` : `${head.slice(0, -1)}, (${typed.join(", ")}) => {`;
        open(indent, `${withClosure}${suffix}`, { kind: "lambda", closer: "});" });
        continue;
      }
    }

    const declaration = parseDeclaration(code);
    if (declaration !== undefined) {
      const { modifiers, keyword, type, array, name, init } = declaration;
      const cls = currentClass();
      const isField = cls !== undefined && stack[stack.length - 1]?.kind === "class";
      const isGlobal = stack.length === 0;
      const tsT = type !== undefined ? tsType(type) : undefined;
      if (array !== undefined) {
        const fallback = defaultValue(type ?? "int").replace(/ \/\*.*$/, "");
        if (isGlobal) globalArrays.set(name, fallback);
        else if (cls !== undefined) cls.arrays.set(name, fallback);
        const sizeNote = array === "" ? "" : ` // Wurst size ${array}`;
        if (isField) out.push(`${p}${modifiers.has("private") ? "private " : ""}${modifiers.has("static") ? "static " : ""}${name}: ${tsT}[] = [];${sizeNote}${suffix}`);
        else out.push(`${p}${isGlobal ? "export " : ""}const ${name}: ${tsT}[] = [];${sizeNote}${suffix}`);
        if (isGlobal) exports.add(name);
        else if (!isField) declareLocal(name, `array:${type ?? "int"}`);
        continue;
      }
      const valueTyped = init !== undefined ? typed(init) : undefined;
      const value = valueTyped?.text;
      const constant = keyword === "let" || modifiers.has("constant");
      if (isField) {
        const access = `${modifiers.has("private") ? "private " : modifiers.has("protected") ? "protected " : ""}${modifiers.has("static") ? "static " : ""}${constant ? "readonly " : ""}`;
        const initializer = value ?? (type !== undefined && TYPE_MAP[type] !== undefined ? defaultValue(type) : undefined);
        out.push(`${p}${access}${name}${initializer === undefined ? `!: ${tsT ?? "unknown"}` : `${tsT ? `: ${tsT}` : ""} = ${initializer}`};${suffix}`);
        continue;
      }
      const binding = constant ? "const" : "let";
      const initializer = value ?? (type !== undefined && TYPE_MAP[type] !== undefined ? defaultValue(type) : undefined);
      if (isGlobal) {
        out.push(`${p}export ${binding} ${name}${tsT ? `: ${tsT}` : ""}${initializer === undefined ? ` = null as unknown as ${tsT ?? "unknown"}` : ` = ${initializer}`};${suffix}`);
        exports.add(name);
      } else {
        declareLocal(name, type ?? valueTyped?.type);
        out.push(`${p}${binding} ${name}${initializer === undefined ? `!: ${tsT ?? "unknown"}` : `${tsT ? `: ${tsT}` : ""} = ${initializer}`};${suffix}`);
      }
      continue;
    }

    // Assignments and expression statements.
    const assignment = splitAssignment(code);
    if (assignment !== undefined) {
      const [targetText, operator, valueText] = assignment;
      const targetTyped = typed(targetText);
      const target = targetTyped.text;
      const plainTarget = target.replace(/^\(([\w.]+)\[(.*)\] \?\? [^)]*\)$/, "$1[$2]");
      const valueTyped = typed(valueText);
      const value = valueTyped.text;
      const resultType = operator === "=" ? undefined : arithmeticType(operator[0]!, targetTyped.type, valueTyped.type);
      if (resultType === "real") {
        helpers.add("f32");
        out.push(`${p}${plainTarget} = f32(${target} ${operator[0]} (${value}));${suffix}`);
      } else if (operator === "=" || plainTarget === target) out.push(`${p}${plainTarget} ${operator} ${value};${suffix}`);
      else out.push(`${p}${plainTarget} = ${target} ${operator[0]} (${value});${suffix}`);
      continue;
    }
    if ((m = /^(.+?)\s*(\+\+|--)$/.exec(code))) {
      const target = expr(m[1]!);
      const plainTarget = target.replace(/^\(([\w.]+)\[(.*)\] \?\? [^)]*\)$/, "$1[$2]");
      out.push(plainTarget === target ? `${p}${target}${m[2]};${suffix}` : `${p}${plainTarget} = ${target} ${m[2] === "++" ? "+" : "-"} 1;${suffix}`);
      continue;
    }
    out.push(`${p}${expr(code)};${suffix}`);
  }
  closeTo(-1);
  const imports: string[] = [];
  // Names used in the output but defined elsewhere: shared modules first, then converted packages.
  const body = out.join("\n");
  const used = new Set((body.replace(/"(?:[^"\\]|\\.)*"/g, "").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")).match(/\b[A-Za-z_]\w*\b/g) ?? []);
  const byModule = new Map<string, string[]>();
  for (const name of used) {
    if (exports.has(name)) continue;
    const shared = SHARED_EXPORTS.get(name);
    const owner = shared ?? packageExports.get(name);
    if (owner === undefined || owner === packageName) continue;
    byModule.set(owner, [...(byModule.get(owner) ?? []), name]);
  }
  for (const [module, names] of [...byModule].sort()) imports.push(`import { ${names.sort().join(", ")} } from "${modulePath(packageName, module)}";`);
  return { ts: `${imports.join("\n")}${imports.length > 0 ? "\n\n" : ""}${body}\n`, todos, exports };
}

// ---------------------------------------------------------------- module layout

/** Shared hand-written modules, by the names the converted code uses. */
const SHARED_EXPORTS = new Map<string, string>([
  ...["roundToFloat32", "addFloat32", "subtractFloat32", "multiplyFloat32", "divideFloat32", "fusedMultiplyAddFloat32"].map((n) => [n, "@sim/binary32"] as const),
  ...["idiv", "imod", "floorDiv", "floorMod"].map((n) => [n, "@sim/intMath"] as const),
  ["f32", "@sim/f32"] as const,
  ...["toInt", "toReal", "squared", "max", "min"].map((n) => [n, "@runtime/wurst"] as const),
  ...["test", "assertTrue", "assertFalse", "assertEquals", "assertNear", "assertDefined", "assertGreaterThan", "assertLessThan"].map((n) => [n, "@runtime/testing"] as const),
]);

/** Packages produced by build tooling live in game/generated. */
export const generatedPackages = new Set<string>();

function modulePath(fromPackage: string, target: string): string {
  const fromGenerated = generatedPackages.has(fromPackage);
  if (target.startsWith("@")) return `${fromGenerated ? "../../" : "../"}${target.slice(1)}`;
  const toGenerated = generatedPackages.has(target);
  if (fromGenerated === toGenerated) return `./${target}`;
  return fromGenerated ? `../${target}` : `./generated/${target}`;
}

// ---------------------------------------------------------------- index and driver

/** Exported names and type tables, collected before conversion. */
export function index(sources: Map<string, string>): { packageExports: Map<string, string>; tables: Tables } {
  const packageExports = new Map<string, string>();
  const tables: Tables = { globals: new Map(), functions: new Map(), classes: new Map() };
  for (const [file, source] of sources) {
    const pkg = /^package\s+(\w+)/m.exec(source)?.[1] ?? basename(file, ".wurst");
    let current: ClassInfo | undefined;
    let classIndent = -1;
    let memberIndent = -1;
    for (const line of logicalLines(source.split(/\r?\n/))) {
      if (line.verbatim !== undefined) continue;
      const code = line.code.replace(/^(@\w+\s*)+/, "");
      if (code === "") continue;
      const indent = line.indent;
      if (current !== undefined && indent <= classIndent) current = undefined;
      let m: RegExpExecArray | null;
      if ((m = /^(?:(?:public|abstract)\s+)*class\s+(\w+)(?:\s+extends\s+(\w+))?/.exec(code))) {
        current = emptyClass(m[1]!, m[2]);
        classIndent = indent;
        memberIndent = -1;
        tables.classes.set(m[1]!, current);
        packageExports.set(m[1]!, pkg);
        continue;
      }
      if (indent === 0) {
        if ((m = /^(?:public\s+)?tuple\s+(\w+)\s*\(([^)]*)\)/.exec(code))) {
          const info = emptyClass(m[1]!, undefined);
          for (const [type, name] of m[2]!.split(",").map((f) => f.trim().split(/\s+/)).filter((f) => f.length === 2)) {
            info.fields.set(name!, type!);
          }
          tables.classes.set(m[1]!, info);
          tables.functions.set(m[1]!, m[1]!);
          packageExports.set(m[1]!, pkg);
        } else if ((m = /^(?:(?:public|private)\s+)*function\s+(\w+)\s*\([^)]*\)\s*(?:returns\s+(\w+))?/.exec(code))) {
          tables.functions.set(m[1]!, m[2] ?? "void");
          packageExports.set(m[1]!, pkg);
        } else {
          const d = parseDeclaration(code);
          if (d !== undefined) {
            packageExports.set(d.name, pkg);
            const type = d.type ?? literalType(d.init);
            if (type !== undefined) tables.globals.set(d.name, d.array !== undefined ? `array:${type}` : type);
          }
        }
        continue;
      }
      if (current !== undefined && indent > classIndent) {
        // Direct members only: the first indentation level inside the class.
        if (memberIndent < 0) memberIndent = indent;
        if (indent !== memberIndent) continue;
        const fn = /^((?:(?:public|private|protected|static|override|abstract)\s+)*)function\s+(\w+)\s*\([^)]*\)\s*(?:returns\s+(\w+))?/.exec(code);
        if (fn !== null) {
          (fn[1]!.includes("static") ? current.statics : current.members).add(fn[2]!);
          current.returns.set(fn[2]!, fn[3] ?? "void");
          continue;
        }
        const d = parseDeclaration(code);
        if (d !== undefined && !/^(let|var)\b/.test(code)) {
          (d.modifiers.has("static") ? current.statics : current.members).add(d.name);
          const type = d.type ?? literalType(d.init);
          if (type !== undefined) current.fields.set(d.name, d.array !== undefined ? `array:${type}` : type);
          if (d.array !== undefined) current.arrays.set(d.name, defaultValue(d.type ?? "int").replace(/ \/\*.*$/, ""));
        }
      }
    }
  }
  // Inherited members for implicit this.
  for (const info of tables.classes.values()) {
    for (const base of classChain(tables, info.base)) {
      for (const member of base.members) info.members.add(member);
      for (const [name, fallback] of base.arrays) info.arrays.set(name, fallback);
    }
  }
  return { packageExports, tables };
}

if (import.meta.main) {
  const [outDir, ...files] = process.argv.slice(2);
  if (outDir === undefined || files.length === 0) throw new Error("usage: bun scripts/wurst2ts.ts OUT_DIR WURST_FILE...");
  const sources = new Map<string, string>();
  for (const file of files) sources.set(file, await Bun.file(file).text());
  const { packageExports, tables } = index(sources);
  let total = 0;
  // Files outside the authored wurst/ directory are build outputs.
  for (const [file, source] of sources) {
    const pkg = /^package\s+(\w+)/m.exec(source)?.[1] ?? basename(file, ".wurst");
    if (!/(^|\/)wurst\/[^/]+\.wurst$/.test(file) || file.includes("/build/")) generatedPackages.add(pkg);
  }
  for (const [file, source] of sources) {
    const name = basename(file, ".wurst");
    const result = convert(source, packageExports, tables);
    const pkg = /^package\s+(\w+)/m.exec(source)?.[1] ?? name;
    await Bun.write(`${outDir}/${generatedPackages.has(pkg) ? "generated/" : ""}${name}.ts`, result.ts);
    total += result.todos;
    if (result.todos > 0) console.log(`${name}: ${result.todos} TODO(wurst2ts)`);
  }
  console.log(`${sources.size} files, ${total} TODO(wurst2ts) markers`);
}
