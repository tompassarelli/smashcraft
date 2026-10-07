# CPU tier headless check, 7 October 2026

Issue: https://github.com/tompassarelli/smashcraft/issues/134

Both named scripts PASS their refreshed exact references. Over frames 1–1000,
Expert lands **19 hits**, Rookie lands **8 hits**, and neither computer takes
a hit. Each script retains every original input and developer setup line.

Tom approved refreshing the stale exact trajectory references on 7 October,
including the new Rookie hit on human B. The required behavior is that both
scripts pass, Expert lands more hits than Rookie, and neither CPU takes a hit.
The `#! absent c 1-1000 damage` assertions remain in both scripts.

## Why the reference changed

`081025d3 (#182)` added contextual move-value weights and anticipatory reads.
Historical source comparison found the first changed Expert decision at frame
189: the old chooser starts up-smash (style 3), while the new chooser starts
Immolation (special 9). That changes subsequent movement and hits. Before
that policy, the measured `c324ede8` scripts passed their original 12 Expert
and 7 Rookie expectations with 36 input edges on their exact frames. The
later named-profile integration also intentionally changed mechanical skill.

This refresh records the intended current policy; no gameplay, damage,
reaction, direction commitment, opponent profile or tier threshold changed.
The original failures are retained separately in
`evidence/cpu-tiers-native-20261007-r3/README.md` and the private measurement
folders. The former Rookie `absent b` trajectory assertion is replaced by its
exact frame-894 hit under Tom's explicit approval, not silently discarded.

## Candidate and run

- Gameplay source: `cf7be04b772318ffcf8c775fe8a16b9637d2976a` (`origin/main`).
- Owned checkout at measurement: `a4536cb721d9c3502d840f5ef8ea5af718f47713`;
  its gameplay source matches that main revision.
- Wisp: `61d9ef8ab50191e5c8cfd41d413f5c89d510917d`.
- Build: `typescript-integrity` in two headless clients, using the real
  journal helper and virtual pads. No native game or GUI was launched.
- Private measurements: `~/.local/state/smashcraft/cpu134-golden-r3/`.

Each measured script first ran against the stale references. Every hit and
respawn through frame 1000 became an exact reference, and each same script
then ran once against those refreshed references:

```sh
bun wisp pad test/native/pads/cpu-expert.pad --headless --helper HELPER --out OUT
bun wisp pad test/native/pads/cpu-rookie.pad --headless --helper HELPER --out OUT
```

`HELPER` is the existing private
`~/.local/share/smashcraft-build-inputs/codex-native-147-0e756e8a-20261007/wc3-journal`.
The verification commands ran sequentially inside one finite 120-second
moderate capacity scope, which returned `RELEASED`.

| Check | Expert | Rookie |
| --- | ---: | ---: |
| Exact hit and respawn references | 20 PASS | 9 PASS |
| CPU no-hit assertion | PASS | PASS |
| Hits on human A / human B | 18 / 1 | 7 / 1 |
| Total hits on humans | 19 | 8 |
| Damage dealt to humans, across stocks | 108.790% | 76.912% |
| Authored input edges | 18 | 18 |
| Off-frame inputs / late writes | 0 / 0 | 0 / 0 |
| Input/setup lines unchanged from main | 13 | 13 |

The tier's retained directory contains its exact script, full confirmed
traces, input result, hit summary and passing verification log.
`bun run check` completed with suggestions only; the existing pad-script
tests passed 10/10. The original >=95/100 strongest-versus-weakest threshold,
tier ordering, and replay/CPU behavior assertions are untouched.

An optional 150-case replay test exceeded Bun's default five-second timeout
under concurrent load; it reported no state assertion mismatch.

Native parity box satisfied by headless, per wisp#19 (Tom, 7 Oct).
