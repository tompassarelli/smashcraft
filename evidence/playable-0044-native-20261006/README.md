# Smashcraft 0.0.44 native check — 6 October 2026

**Result: the candidate fails at fighter selection.** On both clients the game
slowed to a near stop: Warcraft's main thread ran at about 100% and neither
screen drew a new frame for minutes. Selection and menu input took effect
minutes late, and the match/rematch was never reached.

| File | SHA-256 |
| --- | --- |
| `Smashcraft 0.0.44.w3x` (38,568,569 bytes) | `e0201b0531985e273e39559af787b08cf61389b33c2ad265d6fc36b75c22f137` |
| `wc3-journal-0.0.44` (the 0.0.43 binary, renamed) | `d78e70838306ae55adfc59928277f6019ae64648f06461b9f59bfc54cb7ecce3` |
| Packaged `war3map.lua` | `55568083e05ac1cb99c49efcca4b8f807418973d6d7a3ffb74a31783b20d265a` |

Both are private under ~/.local/share/smashcraft-build-inputs/playable-0044/.

## Build

From smashcraft `a5a0315`, with the command in smashcraft:docs/playable-0044.md
(build.log). Compile 7.29 s; all 304 archive entries verified. The packaged
script carries build ID `playable-0044` and the stage deck path
`war3mapImported\StageDeck-48ca8b3c….mdx`. It also carries 225 imported clip
model paths and the `game.assets.modelSoundInfo` table.

## What happened

1. `bun wisp fresh MAP --from-game --no-quick` installed 0.0.44 as the only
   map in `Maps/00-Smashcraft` on both clients. It hosted, joined and started
   the game. Both ready files read `BUILD playable-0044` (fresh.log). Start →
   fighter selection took 13.74 s; this route takes 10.0–10.6 s with the
   integrity builds from `30381c4`.
2. `bun wisp playable capture --helper wc3-journal-0.0.44 --build playable-0044 …`
   started both helpers with the guide's arguments. Each pad pressed A, then
   A's pad pressed Start. Both helpers emitted their menu keys (`n` select,
   `y` start; capture-attempt1/helper-*.log), but the map stayed at
   CHARACTER, and the capture stopped after 30 s: "live controller menu phase
   STAGE absent". Pressing `n` directly on A afterwards did eventually show
   both fighters selected and "Press Start".
3. Leaving for a clean retry: fresh-2 reached the Game Menu, but its 5 s read
   missed it. fresh-3 opened End Game on both clients, but `q` and then a
   mouse click on Quit Mission did nothing. Two full-screen captures 1 s
   apart were identical on both clients, and still identical 15 s later.
   Escape had no visible effect. Each game's main thread was at 93–100% CPU.
   The machine was not contended (24 cores, load 6–8, CPU pressure about 0.1–0.4%).
4. About two minutes later the queued input arrived (A's Escape at about
   00:40:35). Both clients then rendered normally again, reached the score
   screen and went back to Custom Games. No in-game error report was written
   (`smashcraft-error-p*.txt` unchanged since 5 October).

## First divergence and likely cause

The first divergence is step 2: helper selection keys were sent, but the menu
did not change within 30 s. Between `30381c4` (integrity captures ran
normally today) and `a5a0315`, the map source changes only
`fighterOriginalClipInfo.ts` (pooled fighter clips restored),
`modelSoundInfo.ts`, `fighterPool.ts` (hidden clips parked beneath the floor
instead of alpha 0) and the hot-reload configuration. The pooled clips are
the likely cost: hidden clips are collapsed and parked but still exist,
possibly still emitting. They are also a likely source of the slower load.
This was not isolated further.

## Not checked

The stage deck, pooled animation, model sounds and lingering puffs were not
judged, because no match started. War3Log.txt on A has not been written since
00:17, so it has no load record for this map.
