# Native physics repair — 5 October 2026

The unchanged sixteen-group diagnostic passed in Warcraft: **16/16 groups,
19 messages, zero launch, DI and discrete-DI mismatches**, ending with
`NATIVE_PHYSICS_COMPLETED`. The native capture exited 0 in 20.724 seconds.

| Attempt | Source commit | Bundle key | Groups passed | Messages |
| --- | --- | --- | --- | --- |
| First repair | `16304be8d730879bd9a584dcf2086c12f65ad567` | `6900984-1436069` | 15/16 | 20 |
| Cutoff trace | `63d48f8360d66621debde90cf9d2ffae134e5ab1` | `4327531-7115697` | 15/16 | 42 |
| Accepted repair | `fb3632e15bb3555d6415101476c53e8021ef7425` | `7709691-4136390` | 16/16 | 19 |

The first repair left only `AIR_CUTOFF_4_X` failing: expected
`-5.364456e-10`, actual `0.0`. The trace measured a cutoff of
`11171210 * 2^-32` against a squared speed of `11171209 * 2^-32`.
The fused residual was already correct, `-12884992 * 2^-57`; the higher
cutoff selected the zeroing branch. Computing the preceding decay value
with `subtractFloat32(decay, spacing)` repaired that threshold. The native
fixture then passed without changing its inputs or expectations.

The accepted bundle SHA256 is
`691331d75d5ee46dea9bf28f26188b530222a2c106e97c7fed0083f7613cc52f`.
The private diagnostic map SHA256 is
`b9379ac3ed4e7713777ac22e4088e6df032490d7832ce793bd5b83919478caae`.
Its Waygate source pin is `be5a2bd35d2742ae710f4ba7e70f8490bb1086ec`.
The four focused motion groups and diagnostic compilation passed after the
cutoff repair. No new native mechanics or comparison criteria were added.

The following exports are retained byte-for-byte; maps and proprietary assets
remain outside the repository:

- [First repair failure](https://github.com/tompassarelli/smashcraft/blob/main/evidence/native-physics-repair-20261005/physics-repaired-r1.txt), SHA256 `0aaadf3e8b693c9ced771147202535ba5a4b010212ae76ee964d939561907e8d`.
- [Cutoff trace](https://github.com/tompassarelli/smashcraft/blob/main/evidence/native-physics-repair-20261005/physics-cutoff-trace-r1.txt), SHA256 `7bf59786b46a85a526a1841524434c8234bc84fcd73aa97622b67ca495a0df06`.
- [Accepted repair](https://github.com/tompassarelli/smashcraft/blob/main/evidence/native-physics-repair-20261005/physics-repaired-r2.txt), SHA256 `c68ede25f09825e9f7379b54c616eeb882f00abe9c918db31336aca6c82be0ba`.

This establishes the diagnostic's production fixtures on the tested native
candidate. It is not a playable-release installation or a human playtest.
