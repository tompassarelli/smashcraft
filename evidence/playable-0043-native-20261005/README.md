# Smashcraft 0.0.43 candidate check — 5 October 2026

**Result: the candidate fails before native play. Its map script draws no stage.**

| File | SHA-256 |
| --- | --- |
| `Smashcraft 0.0.43.w3x` | `a98604f24bbb27bd9e8b8b432ab836b7ce329a1d45e2ff343ca4c0616d7e70fc` (matches the build record) |
| `wc3-journal-0.0.43` | `d78e70838306ae55adfc59928277f6019ae64648f06461b9f59bfc54cb7ecce3` (matches the build record) |
| Extracted `war3map.lua` | `f818e55ac7b6ec1e2b6407595d7dc31909412d4ee659c3fad02449f95e9f3519` |

Both private files are in
~/.local/share/smashcraft-build-inputs/native-delivery-20261005/playable-0043/.

## What was checked

1. Hashed the map and helper; both match.
2. Extracted the packaged script with `map-pack extract MAP.w3x OUT war3map.lua`.
   The script contains the checked-in placeholder for the stage deck model:

   ```text
   27103: ____exports.STAGE_DECK_MODEL = ""
   27243: local STAGE_DECK_MODEL = ____stageAssetInfo.STAGE_DECK_MODEL
   27355:             local deck = AddSpecialEffect(STAGE_DECK_MODEL, x, origin.y)
   ```

   An empty model path creates invisible decks, so fighters stand over the sky
   backdrop. This matches Tom's report from the four-fighter recording. The
   source is smashcraft:ts/src/game/assets/stageAssetInfo.ts, which is
   checked in as `""`. Only smashcraft:tools/stage/package.ts regenerates it,
   and no TypeScript map build runs that step.

## Not done

The candidate was not installed in `Maps/00-Smashcraft` and was not run on the
clients. Both clients stayed signed in at fighter selection of the earlier
diagnostic map. The player guide was not changed, because the stage defect
is in the build, not in the guide's steps.

## For the next candidate

`bun waygate playable capture` now drives a playable build the way its guide
does, followed by `bun waygate playable result DIR`. It starts one helper per
player with the guide's arguments on a virtual pad. Each player selects with
A and continues with Start. The capture sets one stock on the stage screen and
plays a match and a rematch. Each match ends with an ordinary stock loss: Player
1 walks off in the match, Player 2 in the rematch. The result passes only if
both clients show the same winner on the result screen and the same END frame,
the Ctrl+T result traces have the same confirmed checksums, and the capture
archived no in-game error report. This command has not been run natively yet.
