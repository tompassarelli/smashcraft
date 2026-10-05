# Native desync diagnosis, #39 — 5 October 2026

**Pass.** After `-dev desync`, `waygate hot --watch` named the diverged values
from both clients' Warcraft desync reports. It read them 8 ms after the game
wrote its report, then printed both Desync.txt paths.

## Candidate

- Source: smashcraft `68dc038` (origin/main, Waygate `4cc471c`) plus lane
  commits that do not touch map source.
- A private copy of the four-fighter diagnostic, rebuilt with the main profile
  (build `typescript-dev`, dev console on) by
  `bun waygate fresh MAP.w3x --rebuild --from-game`: compile 7.67 s. Map
  SHA-256 `932bd4556ef56d51058dbbaf108b54686cb9dad8dd7774b0747bf5ff4ca7d16e`,
  kept private under ~/.local/share/smashcraft-build-inputs/native-owner-20261005/desync/.

## Steps

1. The fresh run above built the map, but B's join was not seen by A
   (B: `PLAYERS: 2/4`, chat "You left … / You joined …"; A: `PLAYERS: 1/4`).
   `bun waygate fresh MAP.w3x` without `--rebuild` then put both clients into
   a quick match in 33.2 s.
2. `bun waygate hot --data <A CustomMapData> --data <B CustomMapData> --watch`
   started before the injection and installed v102 on both clients.
3. In client A: Return, `-dev desync`, Return.
4. The watcher was stopped with SIGINT.

## Result

From hot-output.txt:

```text
Warcraft desync on turn 2822, diverged: next presence tag (client 0: 03098, client 1: 03115), next birth tag (client 0: 04452, client 1: 04451), tempest checksum (client 0: 724c2484, client 1: 7014b3c8); 8 ms after the game wrote its report
…/Documents/Warcraft III/Errors/2026-10-05 16.50.48 e7c84c60/Desync.txt (client A)
…/Documents/Warcraft III/Errors/2026-10-05 16.50.48 e666f740/Desync.txt (client B)
```

The copies are a-Desync.txt and b-Desync.txt. Apart from memory figures and
the race field, they differ only in those three values. When checked about 2 s
after the report, the screens no longer showed the
"dev: desync from player 1's client" message: A had dropped to the score
screen, and B showed "Player 2 wins by forfeit."

## Other observations

- **Stage drawn.** The main-profile rebuild from 68dc038 draws the stage: one
  in-match frame shows a gray deck under both fighters. The script names
  `war3mapImported\StageDeck-48ca8b3c….mdx`.
- **Dark spiky object.** The same frame shows a small dark spiky object at the
  centre of the stage, between the two idle fighters. Timer 6:46, developer
  display `simulation=868`, `-dev quick` match just started, no player input.
- **Password prompt on join.** Afterwards `fresh` reached A's lobby, but B's
  join hit the same modal as #39 fresh run 4: a `[L:PASSWORD ENTER]` prompt
  with CANCEL/CONFIRM over B's lobby, although A listed B. CANCEL cleared it,
  and Start on A brought both clients to fighter selection (both ready files
  `BUILD typescript-dev`).
