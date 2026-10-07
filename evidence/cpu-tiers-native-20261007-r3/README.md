# Original CPU tier native check, 7 October 2026

Issue: https://github.com/tompassarelli/smashcraft/issues/134

Result: **not passed**. The unchanged Expert script is INVALID during native
setup; the unchanged Rookie script FAILS its authored expectations. The last
issue checkbox remains open. No gameplay policy or assertion was changed.

## Candidate and command

- Host checkout: `ba7dd79a6f8b70765694c62356f263e2324632db`.
- Wisp: `53f7fa35f338fca632e5d23d83765b600e057a94`.
- Latest CPU policy in the candidate: `5ec2f09619f05fa74d5c387a8fae28b8751219d2`.
- Immutable map: `~/.local/share/smashcraft-build-inputs/aerials-r3-3167f92b-20261007/Smashcraft-aerials.w3x`.
- Scripts: `ts/test/native/pads/cpu-expert.pad` and `cpu-rookie.pad`, with
  every original expectation and action frame retained.
- Pair: offline LAN pair 0, private desktops, visual profile, 60 FPS.
- Helper: `~/.local/share/smashcraft-build-inputs/codex-native-147-0e756e8a-20261007/wc3-journal`.

The prepared driver ran `bun wisp pad` with both scripts, `--pair 0`,
`--headless-jobs 1`, `--retries 0`, the helper and immutable map. A finite
480-second moderate capacity run contained the driver; the clients had native
capacity scopes. Initial protected CPU PSI was 5.81%.

Private evidence:
`~/.local/state/smashcraft/gameplay-native-r3-20261007/original-pair0-1791384048158/`.

## Measured result

The batch took 178.5 seconds: 0 PASS, 1 FAIL, 1 INVALID.

Expert native setup timed out twice waiting for the new chat entry publication
after Return; the final wait was 8 seconds. No native scripted actions ran.
The Expert headless run had 18 edges, 0 off their authored frames and 0 late
writes, but failed 9 of 12 expectations. Hits at frames 64 and 152 still
matched. The next expected hit was frame 341, damage 34.507; the recorded
headless hits were frame 324, damage 32.507 and frame 330, damage 35.507.

Rookie native had 18 edges, 0 off their authored frames and 0 late writes.
The native match reached frame 367 and its fighter trace ended at frame 345.
The comparison replayed 15 native checksums through frame 367 and one repeated
checksum at frame 367 with equal results. All 367 native input rows matched;
19 fighter lines matched through frame 304. These partial results do not close
the original 1–1000-frame checkbox.

Rookie comparison reported 13 problems: seven native expectation failures and
six headless expectation failures. The expected first hit was frame 143,
damage 17.855; the recorded damage was already 12.753 by frame 127. Headless
also hit human b at frame 894 for 12.753%, contrary to the original absence
assertion.

## Settlement

The driver printed `PAIR 0 STOPPED`, awaited the pair and exited with code 1.
Recorded Warcraft PIDs 393291 and 395287 were absent after termination. Pair
wrapper PID was 391965. The finite capacity lease
`43503b2d-a1d2-481f-bf08-7bf6e6676925` and worker lease
`32efaf60-3e71-47a5-a46d-7c7fe8130141` both returned `RELEASED`.
No native retry or new client was started after the parent stopped native work.

The scripts last changed in `c0424f66`, which migrated their setup to named CPU
profiles while retaining their old assertions. Later `6ce5c1a3` changed
horizontal forecasts for attacks and punishes, and `5ec2f096` changed hero
special reach. No causal bisect was run and no policy rollback was attempted.
Next decision: reconcile the intended CPU changes with the original hit
baseline before attempting this checkbox again.
