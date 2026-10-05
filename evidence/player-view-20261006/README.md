# Player-view checks on the two shipped defects, 6 October 2026

Lane `player-view-20261005`. The scene runs below used Smashcraft
playable-ts-20261005 30381c4 with Wisp 425109a plus the scene report and frame
probe. The current-code run was repeated, and the bundles compared, on
origin/main a5a0315 with published Wisp 0f0be1d. Host-only: no native client
was controlled.

## Frame probe on the stage-less recording

Frames: `ffmpeg -i native-delivery-20261005/four-fighters-2/four-fighters-a.mkv
-vf fps=1 ff2-%03d.ppm` (1280x720, 87 frames; the integrity build of the
0.0.43 code, whose compiled script has `STAGE_DECK_MODEL = ""`). Measured with
`bun wisp view frame ff2-*.ppm`; every line is in
four-fighters-2-frames.txt.

| Frames | Arena sky | Stage rows (needs 8) | Verdict |
|---|---|---|---|
| 33-54, 61-83 (45 in match) | 89.7-97.2% present | 0 in 44, 1 in ff2-065 | 45 of 45 fail: no stage under the fighters |
| 1-32, 55-60, 84-87 (42 menus, lobby, results) | 0.0-3.3% absent | 66-187 | 42 of 42 fail: no match on screen |

## Scene report on the old code

A one-off Bun run of the development entry in the two-client simulation
(ts/test/desync): archer against rifleman, both specials pressed on frame 1,
400 more frames with a report every 30, then one more report.

Current code (30381c4, and again a5a0315, with the player view): frame 401,
267 effects across 25 models, only the stage deck in view; no problems.

Stage deck model as checked in at 168e08c (`STAGE_DECK_MODEL = ""`):

```
no stage under the fighters: 0 of the 1 stage deck pieces a match needs are drawn (the game declares no stage deck model)
invisible stage deck: 1 effects were created with no model, 1 of them meant to be drawn now (model path is empty)
```

The ts/test/visual-lifecycle.test.ts development-build test fails with the
same two problems on that model and passes on 12905df's.

Render code before 05266a3 (`git revert --no-commit 05266a3`, with the
floor height written as 1800.0 because that commit introduced the constant):

```
a projectile stayed in view for 6.17 s; it should be gone within 4.00 s (model Abilities/Weapons/Arrow/ArrowMissile.mdx: 370 frames without a break, lifetime 240; now 16 of 16 in view, 0 drawn)
a projectile stayed in view for 6.17 s; it should be gone within 4.00 s (model Abilities/Weapons/GyroCopter/GyroCopterMissile.mdx: 370 frames without a break, lifetime 240; now 16 of 16 in view, 0 drawn)
a hit spark stayed in view for 6.17 s; it should be gone within 3.00 s (model war3mapImported/ImpactHit-14ab984c85a771b2c9feb68275c44577ceb14d0f5c5f2e3801cbc00c2decd594.mdx: 370 frames without a break, lifetime 180; now 1 of 8 in view, 0 drawn)
```

The rifleman's 16 GyroCopterMissile models, the lingering dark object in the
recording, stayed in view collapsed (16 of 16 in view, 0 drawn) from the first
report on; after 05266a3 parks hidden effects beneath the floor, none is in
view.

## Playable bundle

`tsconfig.playable.json` compiled at origin/main a5a0315 (Wisp 3e422ab) and
in the lane (Wisp 0f0be1d, which adds only new modules to what a map
bundles): both sha256
2c8eca6c079da29ba1a1d6e97801b4dbd33ecd21408fd86f457c623d28bb12ac (1,210,811
bytes). The main bundle keeps all 162 earlier modules byte for byte, adds
platform.devMain, platform.sceneReport and Wisp's runtime and platform scene
modules, and starts from platform.devMain. The integrity bundle changes
platform.integrityMain and adds the same three recorder modules.
