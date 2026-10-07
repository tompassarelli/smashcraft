# Archer's mounted Hippogryph Ride (#232)

Candidate: `codex-rider232-20261008`, based on `267eb68c`.

- Bun: 12 existing Archer recovery contracts, four mounted presentation contracts, all pass.
- Emitted Lua32: the same 16 contracts pass from `build/lua-tests/tests.lua` compiled by `bun scripts/lua-tests.ts`; run with the stock Lua32 at `~/code/smashcraft/worktrees/codex-perf-20261007/ts/build/lua-stock/lua-5.3.6/src/lua`.
- `bun test test/hippogryph-render.test.ts`: three profiles pass, 168 assertions. Native unit bodies, confirmed pools and predicted pools hide the separate Archer and bird while mounted, then restore both on jump-off.
- `bun run check`: pass.

Captures used the real pad timeline in `ts/test/native/pads/232/hippogryph-ride.pad`:

```sh
bun wisp play --standalone --headless \
  --script test/native/pads/232/hippogryph-ride.pad --frames 240 \
  --capture-frames 62,70,80,84,88 \
  --out ~/.local/share/smashcraft-animation-reference/rider232-20261008/captures-fixed
```

The GPU renderer used Warcraft stock model meshes and textures. The five PNGs
remain in that private output folder. `poses.json` records the numerical
observations: frames 62/70/80 contain one mounted rider, no unmounted bird,
and a hidden Archer unit; frames 84/88 contain a visible Archer and one
unmounted attacking bird. Frames 70/80 bank in opposite directions.

Warcraft's local UnitUI.slk names `ehpr` as `RiddenHippoGryph`; the path
suggested by the issue, `HippoGryphRider/HippoGryphRider.mdx`, is absent from
this installed archive. The mounted stock model has `Stand`, `Walk` and
`Attack` sequences. No fighter art or physics source changed.
