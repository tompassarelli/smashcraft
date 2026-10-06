// The two 32-bit Luas `wisp tapes` and `wisp parity numeric` run in: LUA, a
// stock Lua32 whose raw float + - * round to nearest, and one that rounds
// them toward zero, the nearest model of Warcraft's found
// (wisp:docs/headless.md#raw-float-rounding): TOWARD_ZERO_LUA, or one built
// with nix in build/toward-zero-lua. Results equal to Bun's in both rely on no
// raw float + - *, whatever Warcraft's exact rounding is.
import { join } from "node:path";
import { Effect } from "effect";
import { luaRounding, towardZeroLua } from "wisp/scripts/wisp/towardZeroLua";

/** The stock and toward-zero Luas, each checked to round as named; fails with what is wrong. */
export const luaRuntimes = (ts: string) => Effect.gen(function*() {
  const nearest = process.env.LUA ?? "lua";
  const stock = luaRounding(nearest);
  if (stock !== "nearest") return yield* Effect.fail(`LUA=${nearest}: ${stock === "toward-zero" ? "it rounds toward zero; point LUA at a stock 32-bit Lua" : stock}`);
  const given = process.env.TOWARD_ZERO_LUA;
  const towardZero = given ?? (yield* towardZeroLua(join(ts, "build/toward-zero-lua")).pipe(Effect.mapError((failure) => failure.message)));
  const rounding = luaRounding(towardZero);
  if (rounding !== "toward-zero") return yield* Effect.fail(`TOWARD_ZERO_LUA=${towardZero}: ${rounding === "nearest" ? "it rounds to nearest" : rounding}`);
  return { nearest, towardZero };
});
