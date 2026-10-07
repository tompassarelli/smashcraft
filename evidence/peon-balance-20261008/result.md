# Peon forward-tilt repair

The first 21-fighter field gave Peon 3,247 wins in 8,160 games (39.79%).
Across those games, Peon dealt 7.48 damage per hit and received 8.06;
forward tilt and its two angled forms accounted for 59,649 move starts.
This correction adds one damage to those three forms (8 to 9), preserving
their timings, reach, knockback parameters and animation.

The matched comparison used main `ffc1ecc1b73a5b1771d01566463964663188cdec`,
including the shared ledge and Lumber Toss recovery fixes. Control
`5ad5cb886ddcca001fa48b71ab8589778f477647` enabled Peon only on its test branch;
candidate `89b8e4578ead34cff009f42d0632a8d7595ab35e` changed only the tilt damage
and its matching contracts/design row. The temporary selection edit was not
part of the published repair.

The coordinator authorized one local heavy scope after both hosted runs
(37675221084 and 37675317536) remained queued. Each queued run was cancelled
once its local arm began. Both arms ran the same existing command for each
of `blademaster:peon`, `lich:peon`, `pit-lord:peon` and `beastmaster:peon`:

```sh
bun scripts/cpuField.ts --pairs PAIR --opponents wren,wren --tiers expert,expert --per-pair 400 --seeds 100 --json OUTPUT.json
```

The original stages, both player orders, three stocks and four-minute clock
produced 408 games per pair, 1,632 per arm. All 1,632 stage/variant/seed/order
keys matched. Peon rose from 456 wins (27.94%) to 498 (30.51%), a gain of
42 wins and 2.57 percentage points. Of the paired outcomes, 292 became wins,
250 became losses and 1,090 kept their result. Three opponent rows improved;
Blademaster worsened. Exact counts are in `comparison.json`.

The candidate passed 28 focused Bun checks, including all four specials in
the eight-seed CPU fixture, and 27 focused emitted-Lua gameplay contracts.
This four-opponent repair comparison does not close the full-roster 40–60%
gate; the coordinator's next consistent full field supplies that result.
