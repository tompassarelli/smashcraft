# Shield tilt and optional tap jump — 7 October 2026

Issue: [Smashcraft #203](https://github.com/tompassarelli/smashcraft/issues/203).
Gameplay source: `dcc698fe432db5b41adbab8d481de89dcd772733`.
Helper option: `c2f15987`; Controller setting: `4ea5b6ad`.
Confirmed-event parser and real-helper fixture: `33efc8d576b3c76f67681621075e1c534dcb6ba3`.

## Original headless checks

`GAME_TESTS=shieldTilt bun test test/game.test.ts` passed 9/9 cases.
The four cardinal input rows with shield and Tilt clamp each axis at binary32
0.65, retain raised shield and grounded motion, and begin no dodge or jump.
Mario's cited primary offsets, scaled to Archer's authored radius 60, give:

| Direction | Centre X | Centre Z |
|---|---:|---:|
| Left | −18.928207 | 45.000000 |
| Right | 15.773506 | 45.000000 |
| Up | 0.000000 | 70.237844 |
| Down | 0.000000 | 24.180436 |

The same tests retain ordinary side rolls/down dodge, the jump request route,
shared drawn/contact centres, and copied replay state. Existing adapter,
dodge/stock and out-of-shield jump/grab suites passed 37/37 more cases.
The focused emitted Lua32 set, including shield presentation, passed 49/49.
`bun run check` and publication type/source checks passed.

## Actual optional stick-jump producer

The helper defaults tap jump off. `WC3_TAP_JUMP=on` enables its cited 0.6625
stick-up threshold; shield plus Tilt caps the effective stick at 0.65 before
the helper merges stick/button Jump. Button jumps remain independent.

The original `ts/test/native/pads/203/shield-tilt.pad` ran through the actual
virtual-pad/kernel/helper/input-row path into two headless game clients with
tap jump **on**. Its five expectations passed: all four full pushes produced
the capped tilt, and no jump appeared during the shield/modifier hold.
Its 22 inputs landed on their authored frames; zero late writes.

`ts/test/native/pads/203/tap-jump.pad` ran through that same helper with the
option on. Full up without Tilt caused its first grounded jump; Y with Tilt
and shield caused its second grounded jump, with `double 0`.
Two retained executions each had 14 inputs, zero missed frames and zero late
writes. Both pass the two fixture expectations. The unchanged comparator
matches all six confirmed checksums, all 274 intended input rows and all 14
fighter lines through frame 278. Both executions are headless.

The new trace event initially lacked registration in the comparator; the
landed registration has a focused regression, and its existing suite passed
11/11. The new fixture initially expected serial 1 for the second grounded
jump; its corrected assertion is serial 2, `double 0`. This changes no
authored action frame. Retained valid executions were reconciled with that
assertion rather than replayed for confidence. Other late-write attempts are
retained as failed timing checks and excluded from these passing counts.

Private records:

- `~/.local/state/smashcraft/shield203-20261007/dcc698fe/cardinals-on-checked/`
- `~/.local/state/smashcraft/shield203-20261007/dcc698fe/tap-jump-on/tap-jump/session/`
- `~/.local/state/smashcraft/shield203-20261007/dcc698fe/tap-jump-on/tap-jump/headless/`
- `~/.local/state/smashcraft/shield203-20261007/tap-jump-reconciled.json`

The original native four-capture parity box is still pending; these are
headless results.
