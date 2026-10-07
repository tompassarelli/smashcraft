# Jaina source and animation checks

Jaina's hidden source checkpoint is main `8052d660`. The final staff clips,
spell cues and candidate computer contract accompany this record. Selection
remains disabled until the combined fighter assets and balance field land.

## Gameplay and computer

- `GAME_TESTS=jaina.tests bun test test/game.test.ts`: 10 passed, 0 failed,
  1.95 seconds, using the repository's `TEST_WORKER_ENV`.
- `GAME_TESTS=specialCues.tests bun test test/game.test.ts`: 6 passed,
  0 failed, 134 ms.
- The same 16 contracts compiled through the repository's TSTL numeric
  plugin and passed in its stock Lua 5.3.6 binary with 32-bit numbers.
- Eight seeds, 1,800 production Wren Expert frames each: Frostbolt 82,
  Blizzard 14, Blink 8, Water Elemental 21; attacks 83, movement 6,594,
  denied casts 0, missing coverage 0. This is the candidate coverage check,
  separate from the full seeded balance field.

## Animation and stock assets

- `bun tools/animations/jaina-clips.ts STOCK_JAINA.mdx PRIVATE_OUTPUT`:
  81 authored clips, nine stock sequences preserved, MDX round trip passed.
- Twelve key actions inspected from both facings: forward/up/down tilts,
  back/down aerials, four specials, rolling, get-up attack and down smash.
- Staff grip-to-tip direction at contact: forward +35.2 X / 0 Z;
  backward -35.2 X / 0 Z; down 0 X / -35.2 Z.
- Get-up and down smash have distinct front/back contacts; rolls include
  quarter-turn keys. Recovery lengths use the shared simulation constants.
- `bun run check` passed. The original Jaina rig, textures and nine stock
  sequences are retained. Dispel Magic, Frost Wyrm and Lich missiles,
  Mass Teleport caster/target and Water Elemental missile paths extracted
  successfully from the existing Warcraft installation.

The final private model is
`~/.local/share/smashcraft-build-inputs/jaina223/art-fix/generated/jaina.mdx`.
The combined fighter asset worker owns its pooled clips, white body overlay,
model facts and map packaging.
