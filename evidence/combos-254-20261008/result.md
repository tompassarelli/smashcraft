# Combo explorer roster measurement — 8 October 2026

Command: `bun wisp combos --jobs 6` from `ts/`.

Search: `bee5e43a`; recovery/game data: `e28c5aa1`. Later history borrowing
and Wisp native-state changes during publication did not change these game data.
The run used an admitted six-core capacity scope and Bun 1.3.13.

- 21 fighters, 126 opponent/position units, 43,358 landing opener/percent cells.
- 583,170,457 simulated search frames.
- 2,282 of 2,282 retained routes replayed to identical damage and stock loss.
- 2,149.489 seconds (35.8 minutes) for search, replay and output.
- Three embedded routes match recorded Bun damage and stock loss in Lua32;
  Lua32 used 0.215 seconds of CPU.
- Seed 13, frame 1,699: the seeded Wren match's true follow-up dealt
  7.6399993896484375%; the explorer found 8.595001220703125% from that state.

The generated [roster table](../../tools/move-data/combo-potential.md) and
[JSON](../../tools/move-data/combo-potential.json) contain all fighters.
The [method](../../docs/design/balance.md#combo-potential) defines the grid,
DI choices, true links, search limits and opening counts. The measured range
is 4.5–8.5+ openings per kill; fighter tuning is separate from this delivery.
