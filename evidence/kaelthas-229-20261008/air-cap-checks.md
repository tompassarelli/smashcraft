# Kael air-speed cap

Measured 7 October 2026 UTC from main `f5d9d6b4` with this change.

Kael's air multiplier is intentionally capped from Ultimate Mewtwo's 1.313
reference to the existing roster maximum 1.25: 7.5 world units per frame.
Weight 79 and run speed 2.255 reference units (13.53 world units per frame)
remain unchanged. The design and named body contract state the adaptation.
No other hero body, move, special, geometry or global air-drift check changed.

- `GAME_TESTS=kaelthas bun test test/game.test.ts`: 9 passed, 0 failed.
- Focused emitted Lua32: the same 9 Kael contracts passed, exit 0. The
  temporary config extended `tsconfig.lua-tests.json`, retaining its Warcraft
  number plugin. Compilation used the pinned TypeScriptToLua; execution used
  the existing Lua 5.3.6 `LUA_32BITS` binary in `codex-perf-20261007`.
- `bun test ./scripts/airDrift.tests.ts`: 2 passed, 1 failed. The unchanged
  shared momentum case and every fighter's dash/jump/aerial cross-up passed.
  The unchanged air-band case moved past Kael and failed on Thrall's existing
  0.735 air multiplier below the unchanged 0.75 minimum. Its correction is
  owned separately; this record does not claim all three shared cases passed.

All focused tests and compilation ran under `heavy` capacity scopes and all
scopes released. No native clients or balance field were run. The parent
explicitly instructed publication of this finished Kael change independently
of the Thrall correction.
