# Throw regrab acceptance, 6 October 2026

Issue: https://github.com/tompassarelli/smashcraft/issues/85.

All three unchanged agency sweeps pass the issue's neutral-input gate:
576 throw starters, **zero loops leaving three or fewer frames to act**.
Each attacker exercises four throw directions against every victim at
0–150% in steps of 10. The detector and three-frame threshold are unchanged.
The stricter neutral-input result is checked directly in the JSONL records;
the command's exit status alone would not establish this gate.

| Attacker | Throw starters | Tight neutral throw loops | Sweep seconds |
| --- | ---: | ---: | ---: |
| Archer | 192 | 0 | 444.299 |
| Illidan | 192 | 0 | 489.282 |
| Rifleman | 192 | 0 | 511.913 |
| Total | 576 | 0 | |

The measured candidate is `c16d0b4b66fae3b8e94759e58f7bc0c1f54927ec`:
the throw restriction from `1af7b71c`, gentle-landing correction
`8f65c9a1c5fedd18857b339d62497929a1cea9ae`, accepted design defaults and
the trap-immunity change. Integration `4e3271c1` retains these rules while
adding the published hit presentation, body placement and unused-export
repairs. Those changes do not alter the throw/landing behavior exercised here.

Commands from smashcraft:ts/, each inside a finite moderate capacity scope:

```sh
bun wisp agency --attacker Archer --out ../evidence/throw-regrabs-20261006/archer-final.jsonl
bun wisp agency --attacker Illidan --out ../evidence/throw-regrabs-20261006/illidan-final.jsonl
bun wisp agency --attacker Rifleman --out ../evidence/throw-regrabs-20261006/rifleman-final.jsonl
```

The aggregate reads each final JSONL record, selects
`row.starter.endsWith("throw")`, and counts records whose
`row.followUp?.loop?.escapeFrames <= 3`. It requires 576 selected records
and zero failures. Adjacent final logs retain complete output, durations and
capacity-scope release receipts; each command exited zero.

The original Archer and Illidan records are retained separately. Each found
five residual loops under the first restriction because a gentle landing
ended throw hitstun early and permitted regrab during landing recovery.
smashcraft:evidence/throw-regrabs-20261006/initial.md describes the executable
counterexample. The correction preserves remaining throw hitstun through that
landing, without adding an immunity timer.

smashcraft:evidence/throw-regrabs-20261006/integrated-checks.log records the
integrated candidate `305dee84`: type check, zero unused exports/files/tools,
all three throw contracts, and 10 replay tapes / 6,830 frames with zero
divergence against both Lua32 rounding modes. The subsequent merge adds only
published SDI design and catch-up evidence, with no changed execution code.
smashcraft:evidence/throw-regrabs-20261006/lua-contracts.log records the
corrected throw/trap candidate's 733/733 emitted-Lua contracts. The Bun suite's
two five-second harness timeouts under a six-worker/two-CPU run passed unchanged
in a six-CPU scope (709 ms and 413 ms); their retry record is
smashcraft:evidence/throw-regrabs-20261006/bun-harness-retry.log.

This establishes the simulated throw-loop gate. Ordinary follow-up attacks
can replace throw hitstun and permit attack-to-grab reads; true throw-to-attack
combos remain. Native pair acceptance is owned by the parent run separately.
