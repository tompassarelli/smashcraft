





import { Effect } from "effect";
import { lua32, luaRounding } from "wisp/scripts/wisp/lua32";


export const stockLua = Effect.suspend(() => {
  const given = process.env.LUA;
  return given === undefined ? lua32("stock").pipe(Effect.mapError((failure) => failure.message)) : Effect.succeed(given);
});


export const luaRuntimes = Effect.gen(function*() {
  const nearest = yield* stockLua;
  const stock = yield* luaRounding(nearest).pipe(Effect.mapError((failure) => failure.message));
  if (stock !== "nearest") return yield* Effect.fail(`LUA=${nearest}: ${stock === "toward-zero" ? "it rounds toward zero; point LUA at a stock 32-bit Lua" : stock}`);
  const given = process.env.TOWARD_ZERO_LUA;
  const towardZero = given ?? (yield* lua32("toward-zero").pipe(Effect.mapError((failure) => failure.message)));
  const rounding = yield* luaRounding(towardZero).pipe(Effect.mapError((failure) => failure.message));
  if (rounding !== "toward-zero") return yield* Effect.fail(`TOWARD_ZERO_LUA=${towardZero}: ${rounding === "nearest" ? "it rounds to nearest" : rounding}`);
  return { nearest, towardZero };
});
