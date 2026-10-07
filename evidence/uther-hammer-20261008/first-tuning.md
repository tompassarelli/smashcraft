# Uther hammer kit, first field and tuning

The design was landed as `906dfc34` before implementation `a244b250`, published
at `91e8d8c3f269613f91120d74496b4cd8eb4aaf13`.

## First original field

`bun wisp farm balance --ref 91e8d8c3f269613f91120d74496b4cd8eb4aaf13 --wait`
ran [37656971455](https://github.com/tompassarelli/smashcraft/actions/runs/37656971455).
The original 31,200-match field uses 400 matches for every pair, 100 seeds with
spawn variants, Wren Expert, three stocks and the four-minute clock.

Uther won **4304/4800 = 89.6667%**. All other fighters were inside 40–60%.
Holy Radiance represented 36% of Uther's action starts. The unmodified farm
report is `field-r1.md`.

## First tuning

`b579b75a`, published at `8901bfcd74492dc9e2a9818420dc225062f84e4b`, changes
Holy Radiance's end frame from 49 to 69. Its damage, startup, travel, mana and
hit regions stay fixed. The CPU chooses its Divine Shield stance on three
of four planned defensive reads, falling back to ordinary shield when the
stance window would miss.

- Focused Bun move contracts: five passing; CPU coverage and protected offense
  checks pass after using a 30-second runner timeout for the existing long
  CPU scenarios.
- Emitted Lua32: 23/23 Uther special, hammer normal and impact-tier contracts.
- Same eight seeded roster matches: neutral 7, side 75, up 6, down 1;
  82 normal attacks, 6836 moving frames, zero mana refusals. Full counts are
  `coverage-r2.json`.
- Headless `test/native/pads/uther.pad`: six gameplay expectations, two effect
  models, 26 input edges, zero off-frame or late edges; 33.55 seconds.
- The pad's close Hammer of Justice hit deals 13 damage and applies 10 frames
  of hitlag. Holy Radiance's distant wave deals 6 damage.
- Pre-push type-check and source-shape checks pass.

The impact capture at frame 183 is retained privately in
`~/.local/share/smashcraft-animation-reference/uther216-r2/`. Shared body-flash
geometry still obscures the contact in that headless render; issue #211 owns
that correction. This trial does not close the readable-impact box.
