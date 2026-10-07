# Original computer coverage and strategy checks

The original 99 bot checks have passing Bun and emitted-Lua results. The
remaining failure from the frozen hosted run no longer reproduces on
`e8c3cac2ad93519c240d083d5333d4ed65296770`; no extra gameplay repair or test
relaxation was needed.

## Final bot result

[Hosted job 112953978018](https://github.com/tompassarelli/smashcraft/actions/runs/37668537276/job/112953978018)
at `921d0b3aeb286a2838a2e141c69f8fc41ca10345` completed **98/99** original
Lua bot cases in 16 minutes 38 seconds. Its sole failure was Blademaster's
normalized shield-share comparison, **2032 <= 2387**. The retained
[terminal lines](921d0b3a-hosted-lua-result.log) identify that failure; the
whole hosted job is not represented as passing.

After the already-landed gameplay changes, the unchanged `botNewMoves`
module passes **9/9 in Bun** and **9/9 in stock Lua32** at `e8c3cac2`:

```sh
GAME_TESTS=game/match/botNewMoves bun test test/game.test.ts
GAME_TESTS=game/match/botNewMoves LUA=<stock Lua32> bun scripts/lua-tests.ts
```

The [Bun log](e8c3cac2-botNewMoves-bun.log) records 10.28 seconds; the
[Lua log](e8c3cac2-botNewMoves-lua.log) records the nine-case verdict. Both
commands ran in finite heavy capacity scopes which released after exit 0.
The other **90 original cases** retain their passing hosted results, giving
**99 distinct passing cases** without repeating the full suite. The earlier
whole [Bun result](31c78c07-bun.log) was 99/99 at `31c78c07`.

The original Blademaster fixture still plays 16 seeded mirrors, 1,800 frames
each, with the original seeds and damage split. Its [measured counts](e8c3cac2-blademaster-counts.json)
are **8/81 ready-passive attacks shielded**, versus **36/512 charging
attacks**: **8 × 512 = 4096 > 36 × 81 = 2916**. The inequality, observation
code, sample count and timeouts are unchanged. The original move-use and
passive-payoff assertions also pass.

Warden's separate recovery fixture had aimed for stage 0 while simulating
the default stage 2. Commit `4f05d846` names stage 0 in the fixture; its
original **22 starts and 300-frame limit** pass at `e8c3cac2` in
[Bun](e8c3cac2-warden-bun.log) and [Lua32](e8c3cac2-warden-lua.log).
Uther's existing pummel test now accounts for his accepted 0.85 outgoing
damage multiplier, preserving raw move damage and mash timing; that fix
already landed in `a7fdfa77`, whose original 12 grab cases passed both
runtimes as recorded in the linked field evidence.

## Retained integrated checks

- [All-13 activity report](31c78c07-coverage.md): **104 seeded matches,
  0 inactive fighters, 0 refused mana presses**, eight original matches
  per fighter. Movement, attacks, kit use, defense and recovery are recorded.
- [Normal-selection and prepared-read pads](README.md): all 13 roster
  scripts pass **39/39 expectations, 52 edges**, and `cpu-reads` passes
  **2/2 expectations, 28 edges**; both have zero late/off-frame edges.
  Roadmap #16 authorizes these same headless scripts for the native behavior
  and parity boxes.
- [Calibration at cf7be04b](../cpu-calibration-20261007/cf7be04b-repair.md):
  **30 rows, six growth paths, 30 counterplays** pass; 3,000 restored states
  have zero differences, 3,000 surprises have zero early reactions, and
  27,000 reversals have zero inside five frames. Original difficulty passes
  **100/100 Expert/Rookie**, with pooled tier rates **11/34/46/75/84%**.
- [Newer original-roster field](../archer-172-closeout-20261008/balance.md),
  source `3c47d8d444da22fa516c8a2f78eb684181e93759`, hosted run
  [37669368177](https://github.com/tompassarelli/smashcraft/actions/runs/37669368177):
  **all 13 within 40–60%, 31,200 matches, two ties, zero time-outs**.
  This accepted report includes the Rifleman recovery, Beastmaster damage
  and down-smash corrections and retains the original field gate.

These results name their measured snapshots. Later new-fighter and ability
revisions keep their own acceptance work.
