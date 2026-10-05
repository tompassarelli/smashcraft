// Integer division for values that must stay exact in Warcraft's Lua, whose
// numbers are binary32: float division loses bits above 2^24. The float-literals
// plugin compiles idiv(a, b) to Lua's integer `a // b`.
export function idiv(a: number, b: number): number {
  return Math.floor(a / b);
}
