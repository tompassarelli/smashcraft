# Net accept

- Online acceptance (wisp#112): `bun wisp net-accept --out DIR` plays full
  three-stock matches between two standalone processes through Wisp's delay
  and loss proxy, with scripted presses drawn from `--seed`, and reports, for
  each round trip, the checksums compared, mismatches, rollback depth and
  presses lost or extra. `--matches` (20), `--frames` (7200), `--jobs` (5),
  `--rtts` (0,60,120 ms) and `--loss` (0.01) set the run's size;
  `--four-fighters` measures one four-fighter online match instead.
- Each side's log, pad script and standalone result land under DIR; the
  command exits non-zero when any round trip fails (smashcraft:ts/scripts/wisp/netAcceptance.ts).
