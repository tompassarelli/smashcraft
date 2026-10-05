// Warcraft's Lua uses 32-bit integers that wrap silently and binary32 floats.
// Two TypeScriptToLua defaults would change results there:
// - 1.0 prints as the integer literal 1, so `x * 2.0` could stay an integer and
//   overflow. Literals written with a decimal point or exponent stay floats,
//   matching Wurst's real literals.
// - Math.floor(a / b) divides in binary32, losing bits above 2^24, and `%`
//   floors in Lua but truncates in JavaScript. floorDiv and floorMod from
//   src/sim/intMath.ts compile to Lua's exact integer `//` and `%`.
import * as ts from "typescript";
import * as tstl from "typescript-to-lua";
import { LuaPrinter } from "typescript-to-lua";

const floatLiterals = new WeakSet<tstl.NumericLiteral>();

class WarcraftNumberPrinter extends LuaPrinter {
  override printNumericLiteral(expression: tstl.NumericLiteral) {
    const text = String(expression.value);
    if (floatLiterals.has(expression) && Number.isInteger(expression.value) && !/[eE]/.test(text)) {
      return this.createSourceNode(expression, `${text}.0`);
    }
    return super.printNumericLiteral(expression);
  }
}

const integerOperators: Record<string, tstl.BinaryOperator> = {
  floorDiv: tstl.SyntaxKind.FloorDivisionOperator,
  floorMod: tstl.SyntaxKind.ModuloOperator,
};

function integerOperator(node: ts.CallExpression, checker: ts.TypeChecker): tstl.BinaryOperator | undefined {
  if (!ts.isIdentifier(node.expression) || node.arguments.length !== 2) return undefined;
  const operator = integerOperators[node.expression.text];
  if (operator === undefined) return undefined;
  let symbol = checker.getSymbolAtLocation(node.expression);
  if (symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const declaration = symbol?.declarations?.[0];
  return declaration !== undefined && declaration.getSourceFile().fileName.endsWith("/src/sim/intMath.ts") ? operator : undefined;
}

const plugin: tstl.Plugin = {
  visitors: {
    [ts.SyntaxKind.NumericLiteral]: (node, context) => {
      const result = context.superTransformExpression(node);
      // Synthesized literals (for example from i++) have no source text.
      if (tstl.isNumericLiteral(result) && node.pos >= 0 && /[.eE]/.test(node.getText())) floatLiterals.add(result);
      return result;
    },
    [ts.SyntaxKind.CallExpression]: (node, context) => {
      const operator = integerOperator(node, context.checker);
      if (operator === undefined) return context.superTransformExpression(node);
      const [left, right] = node.arguments;
      return tstl.createBinaryExpression(context.transformExpression(left!), context.transformExpression(right!), operator, node);
    },
  },
  printer: (program, emitHost, fileName, file) => new WarcraftNumberPrinter(emitHost, program, fileName).print(file),
};

export default plugin;
