# Throw regrab trial, 6 October 2026

Source: `1af7b71c`, with the grab restriction during throw-origin hitstun.
Commands, from smashcraft:ts/: `bun wisp agency --attacker Archer` and
`bun wisp agency --attacker Illidan`, each with `--out` pointing to its
JSONL record in smashcraft:evidence/throw-regrabs-20261006/.

Each sweep caught 192 throw starters: four directions, every victim, and
0–150% in steps of 10. Each attacker retained five neutral-input up-throw
loops with zero frames to act: Archer at 30%, Rifleman at 20% and 30%, and
Illidan at 20% and 30%. The agency detector and its three-frame threshold
were unchanged. The CLI itself passed because each remaining loop escaped
against some held DI direction; #85's stricter neutral-input criterion failed.

The production frame executor reproduced Archer's up throw on Archer at
30% with repeat reach 110: release at frame 22 had 29 hitstun frames; the
gentle landing at frame 45 cleared the remaining hitstun and imposed four
landing-recovery frames; the next grab at frame 47 caught during the last
two landing-recovery frames. The same pattern recurred at frames 85 and 87.

Raw records: smashcraft:evidence/throw-regrabs-20261006/archer.jsonl and
smashcraft:evidence/throw-regrabs-20261006/illidan.jsonl. Exact command output,
including capacity scope settlement: the adjacent archer.log and illidan.log
in that evidence directory.
