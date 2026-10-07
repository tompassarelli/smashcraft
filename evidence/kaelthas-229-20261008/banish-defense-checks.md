# Banish defense checks

Measured on 7 October 2026 UTC from source `234ee593`, then integrated with
main `27374428`, including the shared platform-approach fix `1a6b6b67` and the
performance worker's 21-fighter reaction-test correction `70566d65`.

- Banish alone opts into defensive use. The computer's stance selection and
  wait decision can read its existing f5–12 intangible window despite its
  later burst. The pure-stance predicate, offensive eligibility and guard
  mana reserve are unchanged. No damage, timing, geometry, reaction delay,
  direction commitment or replay-state field changed.
- The same-shot regression first failed without the opt-in. It checks 300
  decisions: 30 shot serials at each of five arrival times with either 14 or
  15 mana. Arrivals that meet action frames 5, 8 and 12 can choose Banish;
  those meeting frames 4 and 13 cannot. A real started jab excludes Banish,
  and Banish remains an offensive close-range burst.
- `GAME_TESTS=botDefenseForecast bun test test/game.test.ts`: 7 passed.
- Focused emitted Lua32: those same 7 contracts passed, exit 0. The temporary
  config extended `tsconfig.lua-tests.json`, retaining its Warcraft number
  plugin, and compilation used the pinned TypeScriptToLua. Execution used
  the existing Lua 5.3.6 `LUA_32BITS` binary in `codex-perf-20261007`.
- `GAME_TESTS=kaelthas bun test test/game.test.ts`: 9 passed, including the
  original normal, grab, Flame Strike, other-special and body contracts.
- `GAME_TESTS=botReactionContracts bun test test/game.test.ts`: 8 passed after
  consuming the performance worker's count correction. The original
  150 surprise-action traces, frame-12 response, five-frame direction
  commitment, 21×360 = 7,560 direction traces and retained/replayed
  observations all passed, including zero early direction reversals.
- Current-21 CPU coverage: 8 matches, specials 50/8/9/11, 132 ordinary
  attacks, 0 missing actions. Counts on both the initial source and integrated
  platform-approach source are retained in `cpu-banish-defense.json` and
  `cpu-banish-defense-mainmerge.json` respectively.

All local checks and compilation ran under `heavy` capacity scopes. No
native session, whole field or new farm was run for this fix.
