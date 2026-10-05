# Warcraft Lua number semantics, 5 October 2026

Native probe maps `ts-spike-r1` to `ts-spike-r5` (TypeScriptToLua bundle in the
Wurst map, see #35) ran on both signed-in clients. Final map: Smashcraft
diagnostic ts-spike-r5, SHA256 `751365b624a713cd0f59fe0b1ce519a391b2b45b32bf56b14d98c01d2ecdf124`, source `ts/` at the commit adding this
record. Both clients wrote identical files; client A's are retained here.

Facts (`client-a-facts-ts-spike-r5.txt`, Lua `%a` output):
- `math.maxinteger` 2147483647; `%a` prints 24-bit significands: 32-bit
  integers and binary32 numbers.
- `1/3`, `-1/3`, `2/3` and `tonumber("0.1")` round to nearest.
- `(1.5 + 2^-23)^2` gives 2.25 + 1 ulp (nearest is + 2 ulp); `0.1 + 0.2` and
  `0.1 * 3` give 0x1.333332p-2 (nearest 0x1.333334p-2); `1 + 3 * 2^-24`
  gives exactly 1. Operands were parsed at run time to avoid constant folding.
- `string.pack`, `load` and `math.type` are functions.

Parity (`scripts/parity.ts`): 300 cases of binary32 add, subtract,
multiply, divide, fused multiply-add, atan2, cos and sin. ts-spike-r2 matched
Bun bit for bit in 2,250 of 2,400 results; 150 cos/sin results whose last
step was a raw float multiplication were one ulp toward zero. ts-spike-r5
routes that multiplication through `multiplyFloat32`: 2,400 of 2,400 match.
