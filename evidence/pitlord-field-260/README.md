# Pit Lord finishing reward (#260)

The published field on `a7b07a462b336a27e3ae4f0263274d5c88858139`
measured Pit Lord at 3230/8160 (39.59%). Annihilating Cleave took 34.55%
of his credited kills; his self-destruct share was 4.28%.

The change raises only Pit Lord's KILL knockback growth from 100 to 105.
That class serves Demonic Bulk, Annihilating Cleave, Abyssal Lift, Falling
Cleaver and the back throw. It strengthens the siege heavyweight's finishing
reward while preserving his authored damage, timing, body, reach and recovery.

`before.json` contains the 96 Archer matches from that published field with
spawn variant 0, seeds 0–3, both player orders and all 12 stages. These are
Wren Expert matches with three stocks and a four-minute clock. The source
field's options remain in the file; the retained records are the stated subset.
Pit Lord won 63/96 (65.63%) of these matches.

With KILL growth 105, `after.json` records 69/96 wins (71.88%), six more
wins and a 6.25-point increase. The stage, variant, seed and ordered fighter
identities match exactly across both sets. The candidate is based on
`955cbaf8407439895f7fd3ac3f575e2512267a16`, whose Pit Lord moves and specials
match the published baseline before this change.

The comparison command from `ts/` is:

```sh
bun scripts/cpuField.ts --pairs pit-lord:archer --per-pair 96 --seeds 100 --json ../evidence/pitlord-field-260/after.json
```

The affected gameplay checks are `GAME_TESTS=pitLord bun test test/game.test.ts`,
`GAME_TESTS=pitLord bun scripts/lua-tests.ts`, and `bun run check`.
Both runtimes passed all 13 Pit Lord contracts; the type check passed.
The final roster result comes from the single shared field after all independent
fighter changes land.
