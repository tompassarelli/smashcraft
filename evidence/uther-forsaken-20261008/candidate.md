# Forsaken Uther candidate, 8 October 2026

Issue: https://github.com/tompassarelli/smashcraft/issues/216 .
Tom's 03:10 Forsaken direction supersedes the Human Paladin candidate.

Design preceded implementation: 9165c61d, published ca174207.
Gameplay: edebde2e, published abcf45a4f6db2c636dc66372bc8c7a80b27bd974.
Replay identity, current move list and revised pad assertions: c918a76b,
published a4cc812951adfa17baf08d6ebf2bcef89f0ed3e6.

## Installed source

Warcraft 3.0.1.24342 identifies Npal's model as
Units/Creeps/HeroForsakenPaladin/HeroForsakenPaladin. It has 28 sequences,
143 nodes and a sword; the requested hammer uses the classic Paladin's
separable hammer faces on the Forsaken weapon joint. Private extracted game
files remain under ~/.local/share/smashcraft-build-inputs/uther216-forsaken-20261008/.

Ability IDs: ANcp Righteous Fury, AHcr Consecration, AHpa Sacred Aura,
AHcl Cleansing Fire. Installed ANcp damage is 90/135/180; the official final
patch notes say 90/135/185. Both agree on the 40% movement slow adapted here.
The source and the provisional Smashcraft contracts are in docs/design/uther.md.

## Completed gameplay checks

- `GAME_TESTS=uther bun test test/game.test.ts`: 22 move/special checks;
  the added replay-kit-identity check passes separately, making 23.
- The same Uther move/special modules compiled with tsconfig.lua-tests.json
  into uther216-tests.lua and run under the 32-bit Lua 5.3.6 executable:
  **23/23 pass**.
- Six targeted Uther computer checks pass across botPlayContracts,
  botDefenseForecast and botKitOptions. No original guard/wave expectation
  remains in those Uther contracts.
- `fighterCoverage` with the unchanged eight seeded Wren Expert matches:
  neutral 18, side 48, up 8, down 7; 108 normal attacks, 210 defensive
  actions, zero denied mana presses and no missing coverage categories.
- The generated move list check and publication type/source checks pass.

## Headless pad checks

The real wc3-journal helper drove both scripts through the headless clients.
The current shared collector waits for the 4500-callback trace; the first
attempt diagnosed the stale 45-second limit. The published fix is ea6fb53f;
no Uther-specific timeout change was landed.

| Script | Inputs on time | Gameplay assertions | Effect models | Matching replay exports |
| --- | --- | --- | --- | --- |
| uther.pad | 26/26 | 6 | 2 | 1, 476 frames |
| uther-cues.pad | 62/62 | 10 | 6 | 2, 1234 frames |

The charge deals 11.9 at frame 74. Cleansing Hammer brings total damage to
22.95 at frame 183. The aura fixture's fourth tilt lands at frame 261:
10.2 damage, 10 hitlag, 16 hitstun. Ground and air neutral/side forms and
free Ascension are exercised. The gameplay contracts separately exercise
paid Ascension, failed air Consecration, pool pulse spacing, jumping clear,
shield stopping Fury's slow, the cleanse boundary, and replay restoration.

Retained local runs are ts/build/uther216-forsaken-pad-r3 and
uther216-forsaken-cues. Their art was the preceding model while the separate
Forsaken hammer family was authored; final chosen-model images are recorded
by that art publication.

## Balance source

The original 13 selectable fighters were checked at runtime before dispatch.
Run https://github.com/tompassarelli/smashcraft/actions/runs/37675071322 uses
abcf45a4f6db2c636dc66372bc8c7a80b27bd974, Wren Expert, 400 matches per pair.
The follow-up changes only replay identity, descriptions and scripted input
fixtures, not the battle rules or numbers used by that field.
