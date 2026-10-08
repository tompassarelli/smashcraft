// The 32-bit Luas the game's Lua runs use: LUA, a stock Lua32 whose raw float
// + - * round to nearest, and TOWARD_ZERO_LUA, one that rounds them toward
// zero, the nearest model of Warcraft's found
// (wisp:docs/headless.md#raw-float-rounding). Either, when unset, is Wisp's
// cached pinned build (wisp:scripts/wisp/lua32.ts). Results equal to Bun's in
// both rely on no raw float + - *, whatever Warcraft's exact rounding is.
import { Effect } from "effect";
import { lua32, luaRounding } from "wisp/scripts/wisp/lua32";

/** LUA, else Wisp's cached stock Lua32; fails with what is wrong. */
export const stockLua = Effect.suspend(() => {
  const given = process.env.LUA;
  return given === undefined ? lua32("stock").pipe(Effect.mapError((failure) => failure.message)) : Effect.succeed(given);
});

/** The stock and toward-zero Luas, each checked to round as named; fails with what is wrong. */
export const luaRuntimes = Effect.gen(function*() {
  const nearest = yield* stockLua;
  const stock = luaRounding(nearest);
  if (stock !== "nearest") return yield* Effect.fail(`LUA=${nearest}: ${stock === "toward-zero" ? "it rounds toward zero; point LUA at a stock 32-bit Lua" : stock}`);
  const given = process.env.TOWARD_ZERO_LUA;
  const towardZero = given ?? (yield* lua32("toward-zero").pipe(Effect.mapError((failure) => failure.message)));
  const rounding = luaRounding(towardZero);
  if (rounding !== "toward-zero") return yield* Effect.fail(`TOWARD_ZERO_LUA=${towardZero}: ${rounding === "nearest" ? "it rounds to nearest" : rounding}`);
  return { nearest, towardZero };
});
