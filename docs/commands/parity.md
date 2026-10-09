# Parity

- Tapes: set `LUA` to the 32-bit Lua executable, then run `bun wisp parity tapes` to
  compare replay results across Bun, that Lua32 and a Lua32 whose raw float
  `+ - *` round toward zero (`TOWARD_ZERO_LUA`, or built with nix on first use).

- Native corpus (wisp#69): every native session (`pad`, `fresh`, captures, `accept`,
  `client doctor|watch`) records what its clients' maps wrote into
  ~/.local/state/wisp/corpus/ with no extra step:
  each match's replay, whose test-build frames each carry a digest of every
  fighter's position, velocity, action, timers, shield and damage
  (smashcraft:ts/src/game/replay/frameDigest.ts). `bun wisp parity corpus [DIR...]`
  replays every recording (by default smashcraft:ts/test/corpus/ and the local
  corpus) in Bun and 32-bit Lua, each on the commit that recorded it, and names
  each replay's first divergent frame and field; `bun wisp parity corpus keep
  RECORDING...` copies local recordings into smashcraft:ts/test/corpus/, which
  CI and `farm test` replay on every push.
  A native box in a subsystem with zero corpus divergence is met by its
  headless check plus the weekly native spot batch. Keep the corpus coverage
  and replay result for that subsystem in wisp#69; native lanes batch the
  weekly spot checks with their other pending sessions.
