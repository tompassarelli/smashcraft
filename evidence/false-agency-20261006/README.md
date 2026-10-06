# False-agency sweep and soak, 6 October 2026 (#68)

Lane `false-agency-20261006` at f499773c (origin/main 6 Oct afternoon merged,
Wisp 21d9b2f), headless, Bun 1.3.13. The analysis and its definitions are in
smashcraft:docs/typescript.md ("Victim agency").

## Commands

From smashcraft:ts/, three processes at once, each in a `moderate` capacity
scope, on a machine shared with other lanes (load 9-14):

    bun wisp agency --attacker Archer --out build/agency/archer.jsonl
    bun wisp agency --attacker Rifleman --out build/agency/rifleman.jsonl
    bun wisp agency --attacker Illidan --out build/agency/illidan.jsonl

Archer's took 689 s, Illidan's 783 s and the Rifleman's 1,704 s. Both
Archer's and the Rifleman's exit 1: they find loops that hold against every
held DI direction. `sweep-*.txt` is each printed report; `sweep-*.jsonl`
holds every starter's and every link's result.

Then, in a `heavy` scope, `bun wisp soak --workers 4` (200 matches, seed 1):
`soak-200.txt`. `soak-detector-counts.jsonl` is the same 200 matches
played again in four processes with a counting copy of the soak's
lock-loop detector (a scratch harness, not committed): cycles it replayed,
steps the recorded rows didn't reproduce (the shell's changes at pauses and
match ends), and lock-loop findings.

## Result

Starters that caught their victim: Archer 348, Rifleman 360, Illidan 336
(throws and jab resets at 0-150% in steps of 10; normals and specials at 0,
50, 100 and 150%; against all three fighters).

Stretches over 20 frames with no frame the victim could act on: 74, all
listed per percent in `sweep-*.txt`. They are launches (smash attacks up to
105 frames at 100%, tilts and Archer's down special up to 121 at 150%),
throws (back throw 20-24 frames below 40%, up throw 20-51, down throw
13-44), and the Rifleman's freeze, 299 frames at every percent. Every jab
reset (144) is a 15-frame forced stand that no repeated jab extends.

Loops a repeating follow-up made: Archer 72, Rifleman 88, Illidan 69, all
from up throws, down throws, the Rifleman's down special (trap) and the
Rifleman's neutral special (an 18-frame escape each cycle). With the victim
holding no direction, 121 loops leave it at most 3 frames to act on: up
throw regrabs from 20-30% to 110-140% against every victim by every thrower,
down throw regrabs at 100-150%, and every trap loop. Held DI breaks most
throw loops or leaves about 20 frames when held away from the thrower; 13
hold against all eight held directions with some regrab plan: the 12 trap
loops (one frame to act on, the frame a freeze ends) and Archer's up throw on
Rifleman at 100%. Filed: #84 (trap), #85 (throw regrabs).

The move comparisons' 18 bounded true links, replayed through the frame
executor: every follow-up contacts on the comparison's tick; each holds
against 2-4 of the 8 held DI directions.

Soak: 200 matches, 193,416 frames (55.0 game minutes) in 75.8 s with four
workers. No lock-loop finding; the detector replayed 5 cycles, each
escapable. The run fails on 59 `cost` findings, each attributing its costly
frames to taking typed text, outside this lane's change.
