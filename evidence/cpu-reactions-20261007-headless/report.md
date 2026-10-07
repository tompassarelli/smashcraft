# CPU reaction pad — 7 Oct 2026

Candidate: `ba7dd79a6f8b70765694c62356f263e2324632db`; Wisp: `53f7fa35f338fca632e5d23d83765b600e057a94`.

The original `ts/test/native/pads/cpu-reactions.pad` passed headless unchanged:

- 2/2 original expectations: player a damage is 12.753 at frame 64 and 18.753 at frame 149.
- 26 recorded input edges, 0 off their authored frame, 0 written late, 0 helpers stopped.
- Exit 0; the finite capacity wrapper released lease `d8bc34ea-3a20-4d4c-adfa-2e76c595ee5b`.

Command, from the matching candidate's TypeScript checkout:

```sh
bun wisp pad test/native/pads/cpu-reactions.pad --headless --helper /home/tom/.local/share/smashcraft-build-inputs/codex-native-147-0e756e8a-20261007/wc3-journal --out /home/tom/.local/state/smashcraft/gameplay-native-r3-20261007/176-original-headless
```

The script, result and both input traces are retained here. Script SHA-256: `044420f23ca0f76a87c017a059de3acdd3e921e6219fe04c2e6e6e04634e8a7b`; helper SHA-256: `da641adf4d52afcfde822cf7d776d20d87ab7c232d794c6797f95adf07ca649a`.

Native parity box satisfied by headless, per wisp#19 (Tom, 7 Oct).

The original report-rerun requirement is complete on the changed CPU code at `5ec2f09619f05fa74d5c387a8fae28b8751219d2`:

- [Difficulty run 37631770264](https://github.com/tompassarelli/smashcraft/actions/runs/37631770264): terminal PASS, Expert beats Rookie 100/100; pooled win rates rise 8/31/55/70/86%. Report landed in [78c9e6d6](https://github.com/tompassarelli/smashcraft/commit/78c9e6d6863007b1eb863510fe7f960a38a2f387).
- [Balance run 37631770653](https://github.com/tompassarelli/smashcraft/actions/runs/37631770653): terminal FAIL after 31,200 matches, 400 per pair. Original report and raw field landed in [3167f92b](https://github.com/tompassarelli/smashcraft/commit/3167f92b5aa39ae996621f0c80d7cf0de2c9634c).

CPU match code is unchanged between the report revision and this candidate. The existing focused Lua32 result (23/23), 150 profile replays and reaction/direction floors are retained without rerunning them.

Remaining risk: the original 40–60% balance field fails for Archer, Rifleman, Blademaster, Mountain King, Dreadlord and Beastmaster.
