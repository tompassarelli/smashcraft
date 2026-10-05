# Render visibility on the two shipped defects, 6 October 2026

Lane `render-visibility-20261006`, Smashcraft 0c0cf05 (origin/main 4072029
plus the render-visibility consumer) with published Wisp 71330ad.
Host-only: no native client was controlled.

## Model facts

`bun wisp view models` read the 253 models the scene kinds name: 246
imported from `~/.local/share/smashcraft-build-inputs/build-port-20261005`
(the 0.0.44 build's `--assets` and `--summon` inputs) and 7 stock models from
the local install's CASC storage, classic graphics (`war3.w3mod:`), through
the CascLib extractor built from smashcraft:tools/animations/casc-extract.cpp.
Every stock model reads headlessly, about 0.6 s each; the whole table takes
1.2 s. war3-model 4.0.1 rejects the version 1800 light records of
GyroCopterMissile, ManaFlareMissile and ManaBurnTarget (24 bytes longer than
it reads); Wisp counts those records and parses the rest.

Stock models (z extent of the mesh at scale 1; emitters: when each runs):

| Model | Triangles | Lights | Mesh z | Emitters | Emits while hidden |
|---|---|---|---|---|---|
| ArrowMissile | 2 | 0 | -32 to 29 | ribbon BlizRibbon02: shown and death, 12/s, 0.4 s | BlizRibbon02 |
| GyroCopterMissile | 36 | 1 | -37 to 195 | BlizParticle02: shown, 30/s, 0.5 s; BlizParticle02burst: death, 140/s, 0.675 s; BlizParticle02burst2: death, 110/s, 0.6 s | BlizParticle02 |
| ManaFlareMissile | 56 | 1 | -47 to 48 | BlizParticle01: shown, 60/s, 0.3 s; BlizParticle02burst: death, 100/s, 0.5 s | BlizParticle01 |
| HippoGryph | 346 | 0 | -73 to 156 | three model emitters (bones, guts, spray): death, 24-69/s, 3-3.17 s | no |
| ImmolationTarget | 4 | 0 | -19 to 176 | BlizParticle06: shown, 50/s, 0.7 s | BlizParticle06 |
| ManaBurnTarget | 10 | 1 | -77 to 202 | none | no |
| ThunderclapTarget | 4 | 0 | -3 to 18 | none | no |

Imported: every model has triangles except the light-only
IllidanOriginalLight; the only imported emitters are the Demon Hunter KO
body's BlizParticle01smoke (60.7/s, 0.85 s) and BlizParticle01fireattack
(77/s, 0.5 s), both running while shown. No model draws nothing.

Parked at the ground beneath the stage center, nothing any model can draw
reaches any of the 225 arena framings. Raising the parking place until a
model's boxes first enter a framing: ImmolationTarget 95 units,
HippoGryph 286, GyroCopterMissile 288, every other model at least 408.

## Scene runs

A one-off Bun run of the development entry in the two-client simulation:
archer against rifleman, both specials pressed on frame 1, 400 more frames
with a report every 30, then the result and a rematch. Each report is
checked with `sceneProblems` and the full Smashcraft declaration.

Current code: every report (match start, frames 31-401, result, rematch
start) shows 1 stage deck piece drawn, 1 of 267 effects in view across 25
models, no problems.

Stage deck model as checked in at 168e08c (`STAGE_DECK_MODEL = ""`), from
the match's first report on:

```
model 1 1 1 0 0 0 1
no stage under the fighters: 0 of the 1 stage deck pieces a match needs are drawn (the game declares no stage deck model)
invisible stage deck: 1 effects were created with no model, 1 of them meant to be drawn now (model path is empty)
nothing where a stage deck should be: the game names no model for it (model path is empty)
```

Render code before 05266a3 (`git revert --no-commit 05266a3`, conflicts in
fighterBody.ts, shell.ts, view.ts and visual-lifecycle.test.ts resolved to
the current files: they only rename the 1800 floor height), from the
match's first report on:

```
model 16 16 0 0 0 0 0 Abilities/Weapons/GyroCopter/GyroCopterMissile.mdx
16 hidden projectiles in view still show particles (model Abilities/Weapons/GyroCopter/GyroCopterMissile.mdx: 16 in view, 0 drawn; BlizParticle02 emits 30/s, each for 0.5 s)
16 hidden projectiles in view still show particles (model Abilities/Weapons/Arrow/ArrowMissile.mdx: 16 in view, 0 drawn; BlizRibbon02 emits 12/s, each for 0.4 s)
```

The lifetime check first fails at frame 241, when the pools have been in
view 4 s. At the rematch the reverted code destroys both pools where they
wait, and the check adds:

```
16 projectiles destroyed in view burst particles as they go (model Abilities/Weapons/GyroCopter/GyroCopterMissile.mdx: its death animation runs BlizParticle02burst, BlizParticle02burst2 where the effect stood)
16 projectiles destroyed in view burst particles as they go (model Abilities/Weapons/Arrow/ArrowMissile.mdx: its death animation runs BlizRibbon02 where the effect stood)
```
