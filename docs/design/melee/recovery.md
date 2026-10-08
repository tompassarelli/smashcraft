# Melee recovery reference for Smashcraft's recovery redesign

Scale: 1 Melee unit (MU) = 6 Smashcraft world units (w)
(`smashcraft:ts/src/game/sim/tuning.ts` `WORLD_UNITS_PER_MELEE_UNIT = 6.0`). Cells read
"MU (w)". Speeds are per frame at 60 fps.

Stage context (`smashcraft:docs/design/stages.md`, read from the NTSC 1.02 stage files):
Final Destination's ledges are at x = ±85.57 MU (±513 w), side blast zones ±246, bottom −140.
Battlefield's are at ±68.4 MU (±410 w), side blast ±224, bottom −108.8. Smashcraft's main deck
spans −600..600 w (±100 MU). The hero reference height is 132 w (22 MU). So a 600 w recovery
covers about one Final Destination half-width.

## Table

| Fighter | Gravity | Fall speed | Air speed | Aerial jump height × count | Up-B: travel starts / total / landing lag (frames) | Up-B vertical | Up-B horizontal (farthest angle) | Up-B angle control | Ledge grab during up-B | Side-B / other recovery (helpless?) | Ledge snap x / y / h (MU) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Fox | 0.23 (1.38) | 2.80 (16.8) | 0.83 (4.98) | 40.2 (241) × 1 | travel f43 (charge hitbox f20) / 92 / 18 | 77.7–81.5 (466–489) travel, after a ~6 (36) sink while charging | same 77.7–81.5 (466–489) | analog 360 | yes (charge and travel) | Illusion (air): 83.7 (502) [56.2 dash in 4 f + 27.6 end slide]; helpless, 20 landing lag | 11 / 13 / 9 |
| Falco | 0.17 (1.02) | 3.10 (18.6) | 0.83 (4.98) | 41.8 (251) × 1 | f43 / 84 / 18 | 60.1 (361) after a ~6.5 (39) sink | 60.1 (361) | analog 360 | yes | Phantasm (air): 77.1 (463) [49.5 + 27.6]; helpless, 20 landing lag | 11 / 13 / 9 |
| Marth | 0.085 (0.51) | 2.20 (13.2) | 0.90 (5.4) | 25.2 (151) × 1 | hitbox f5 / 39 / 34 | 50.6 (303) in air; 47.2 (283) from ground | ~17 (~104) estimate (50.6 × sin 20°) | stick tilt up to 20° | no (only after entering helpless fall) | Dancing Blade lift: unknown; no other recovery | 12 / 17 / 11 |
| Sheik | 0.12 (0.72) | 2.13 (12.8) | 0.80 (4.8) | 38.0 (228) × 1 | travel f37–56 (meleeframedata hitbox f36) / 94 / 30 | ~70 (~420): 30.5 (183) start rise, about −4 (−26) settle, 40 (240) teleport, ~3 (19) reappear | 40 (240) teleport, plus up to ~0.8/f drift during the 36-frame start | analog 360 (speed 1.5–2.0 MU/f with stick magnitude) | yes (start, travel, end) | none useful; Vanish is the recovery | 11 / 15 / 11 |
| Jigglypuff | 0.064 (0.384) | 1.30 (7.8) | 1.35 (8.1) | unknown (own animation) × 5 | no recovery up-B (Sing; 179 total) | — | — | — | — | Pound: ≤27.5 (165) horizontal, ≤9.4 (56) rise per use; not helpless | 9 / 10 / 9 |
| Peach | 0.08 (0.48) | 1.50 (9.0) | 1.10 (6.6) | unknown (own animation) × 1 | hitbox f6 / 40 / 30 | 35.0 (210) in air; 36.8 (221) from ground | ~11 (~65) estimate (35.0 × sin 18°) | stick tilt up to 18° | no (parasol fall afterwards) | Float: 150 frames at zero vertical speed, drift ≤1.1/f (≤165 MU, 990 w); Peach Bomber: unknown | 10 / 15 / 11 |
| Ganondorf | 0.13 (0.78) | 2.00 (12.0) | 0.78 (4.68) | 22.2 (133) × 1 | hitbox f13 / 64 / 30 | 41.9 (251) in air; 54.5 (327) from ground | ≤38 (≤229) computed drift bound | air drift only (cap 0.66 MU/f) | yes, once the move's catch flag is set | Gerudo Dragon (air): unknown | 9 / 17 / 11 |
| Captain Falcon | 0.13 (0.78) | 2.90 (17.4) | 1.12 (6.72) | 28.6 (172) × 1 | hitbox f13 / 64 / 30 | 37.6 (226) in air; 48.9 (294) from ground | ≤52 (≤310) computed drift bound | air drift only (cap 0.95 MU/f) | yes, once the move's catch flag is set | Raptor Boost (air): unknown | 9 / 17 / 11 |
| Mario | 0.095 (0.57) | 1.70 (10.2) | 0.86 (5.16) | 26.7 (160) × 1 | hitbox f3 / 37 / 30 | 38.4 (230) in air; 40.4 (242) from ground | ~12 (~71) estimate (38.4 × sin 18°) | stick tilt up to 18° | no | Cape (air) lift 9.2 (55); Tornado rise 39.9 (239) as recorded; not helpless | 12 / 15 / 10 |
| Samus | 0.066 (0.396) | 1.40 (8.4) | 0.89 (5.34) | 26.1 (157) × 1 | hitbox f4 / 47 (air) / 24 | 46.1 (277) in air; 44.5 (267) from ground | unknown | air drift | yes | Bomb jumps and grapple: unknown | 10 / 10 / 9 |
| Mewtwo | 0.082 (0.492) | 1.50 (9.0) | 1.20 (7.2) | unknown (own animation) × 1 | travel f9–18 (meleeframedata f7) / 32 / 30 | ~56 (~336): 50 (300) teleport + 6 (36) end | 50 (300) teleport | analog 360 (speed 3.5–5 MU/f) | yes (start and travel) | none | 11 / 14 / 12 |

Common to every fighter: the air dodge sets 3.1 MU/f and multiplies it by 0.9 every frame
(PlCo common +0x338 / +0x33C in `retail-roster.json`). That totals 29.7 MU (178 w) over 30 frames,
with a limit of 31 MU (186 w). Melee's air dodge leaves the fighter helpless and can't catch the
ledge until its 49-frame animation has ended (`smashcraft:docs/physics.md`, "Outer ledge recovery").

## How each value was obtained

- **Gravity, fall speed, air speed, aerial jump height, jump count**: from
  `smashcraft:docs/design/melee/movement.md` (Falling and Jumps tables) and
  `smashcraft:docs/smash-melee-reference/retail-roster.json` `max_jumps`. Aerial jumps are
  `max_jumps − 1`; Jigglypuff has `max_jumps` 6. Peach, Mewtwo and Jigglypuff use their own
  animation-driven aerial jumps, which movement.md marks "own", so their heights are unknown.
- **Up-B startup and total**: from `smashcraft:references/melee-frame-data/records.jsonl`
  (meleeframedata `up_b` / `aup_b`).
  - Fox and Falco: the travel frame comes from the disc's `SpecialHiHold` animation, which is 43
    frames long. This agrees with Fox's record, where the hitbox ends on frame 72 = 42 + 30
    travel frames.
  - Sheik: the travel frames come from the 36-frame `SpecialAirHiStart` animation followed by 20
    travel frames.
  - Mewtwo: the travel frames come from the 8-frame start animation followed by 10 travel frames.
- **Landing lag after the up-B's helpless fall**: read from the disc, in each fighter's special
  attributes (`ftData +0x04`). Each field was identified by the argument it supplies to
  `ftCo_80096900` / `ftCo_LandingFallSpecial_Enter` in that fighter's SpecialHi source:
  - Fox and Falco `x90` = 18
  - Sheik `x5C` = 30
  - Marth `x2C` = 34
  - Captain Falcon and Ganondorf `specialhi_landing_lag` = 30
  - Mario `specialhi.landing_lag` = 30
  - Peach `x74` = 30
  - Samus `x50` = 24
  - Mewtwo `x74` = 30

  meleeframedata agrees on every value except Fox and Falco, where it lists 6 in `land_lag`. That
  6 is probably the grounded Fire Fox landing, but this was not checked.
- **Computed from disc attributes** with the private reader
  `~/.local/share/smashcraft-melee-reference/recovery-facts.ts`. The reader reads the special
  attributes, the `ftData x44` ledge box and the special animation frame counts from the ISO. The
  field meanings come from the decompilation types. None of these figures is frame-perfect: the
  frame on which an action starts and ends can shift each total by about one frame of travel.
  - Fire Fox (`ftFox_DatAttrs`, shared with Falco):
    - Fox: speed `x74` = 3.8 MU/f for `x68` = 30 frames. From frame `x70` = 6 onward the speed
      drops by `x78` = 0.1 per frame. Sum over 30 frames: 81.5.
    - Falco: speed 4.2 for 22 frames, dropping by 0.17 per frame from frame 4. Sum: 60.1.
    - Speed is the same at every angle, so the horizontal distance equals the vertical one.
    - Charge sink: gravity is held off for `x54` = 15 frames, then falls at `x60` = 0.015
      (Falco 0.016) per frame for the rest of the 43-frame charge.
    - Direction: `atan2` of the stick, needing a stick sum of at least `x64` = 0.5; otherwise the
      move goes straight up (`ftFx_SpecialAirHi_Enter`).
  - Vanish (`ftSeakAttributes`, `ftseakspecialhi.c`):
    - Start: vertical speed `x2C` = 3.5, gravity `x30` = 0.19, terminal `x34` = 0.25, over the
      36-frame start animation. Peak 30.5.
    - Teleport: speed `x44`·|stick| + `x48` = 1·|stick| + 1 MU/f for `x38` = 20 frames, giving
      40 at full stick (`ftSk_SpecialHi_80113A30`).
    - Reappearing keeps 0.3 (`x54`) of the teleport speed.
  - Teleport (`ftMewtwoAttributes`): speed `x5C`·|stick| + `x60` = 2·|stick| + 3 MU/f for `x50` =
    10 frames, giving 50 at full stick.
  - Float: Peach's float timer is `ftPe_DatAttrs xC` = 150 frames (`ftpeachfloat.c`).
  - Pound: speed `xF0` = 2.2 at a stick angle of up to `xE4` = 20°, multiplied by `xF4` = 0.92
    per frame. The 27.5 MU geometric limit is an upper bound.
  - Falcon Dive and Dark Dive horizontal bound: drift capped at `specialhi_horz_vel` 0.85 ×
    air speed, with acceleration `air_drift_stick_mul` 0.04 × 1.1, held for the whole 65-frame
    animation from frame 1. This is an upper bound, not a measurement.
  - Up-B tilt limits:
    - Marth: `x38` = 20°.
    - Mario: `specialhi.angle_diff` = 18°.
    - Peach: `x80` = 18°.
    - The "estimate" horizontal distances in the table assume the tilt rotates the move's whole
      travel by that angle. They are estimates, not measurements.
- **Recorded in game** (libmelee `framedata.csv` at revision `ef679270`, SHA-256 `8e0d8112…`, the
  same file the repo's libmelee intake uses). These are per-frame `locomotion_x/y` sums:
  - Marth: actions `0x16F` / `0x170` (libmelee's own `UP_B_GROUND` / `UP_B_AIR` names).
  - Captain Falcon and Ganondorf: `0x161` / `0x162`.
  - Mario: `0x15B` / `0x15C`.
  - Peach: `0x169` / `0x16B`.
  - Samus: `0x161` / `0x162`.
  - Fox and Falco: `0x164` (Fire Fox in the air: Fox 77.7, Falco 60.1, matching the disc
    computation) and `0x15F` + `0x160` (Illusion dash and end in the air).
  - Sheik: `0x166` (start rise 30.51, matching the disc computation).
  - Mewtwo: `0x165` / `0x166` (5.0 per frame, matching the disc).

  For the fighters other than Marth and Fox, the action-to-move mapping is inferred by matching
  recorded frame counts to the disc's animation lengths, for example Falcon's 64 recorded frames
  against the 65-frame `SpecialAirHi`. These animation-driven moves have no attribute to compute
  from.
- **Ledge grab during the move**: whether the move's collision callback calls
  `ftCliffCommon_80081298`:
  - Fox: in `ftFx_SpecialHiHoldAir_Coll` and `ftFx_SpecialAirHi_Coll`.
  - Sheik: in `ftSk_SpecialAirHiStart_0/1_Coll` and `ftSk_SpecialAirHi_Coll`.
  - Mewtwo: in `ftMt_SpecialAirHiLost_Coll`.
  - Captain Falcon and Ganondorf: in `ftcaptainspecialhi.c`, gated by `specialhi.x2_b1`.
  - Samus: in `ftsamusspecialhi.c`.
  - Marth, Mario and Peach's up-B files contain no ledge check. They catch the ledge only from the
    helpless fall that follows.
- **Ledge snap box**: `ftData x44 +0x10/+0x14/+0x18` read from each `PlXx.dat` on the disc. Fox,
  Falco and Captain Falcon match `smashcraft:docs/physics.md`.

## Edgeguard character by archetype

- **Fox / Falco**: very long recovery: Fire Fox about 80 / 60 MU, and Illusion / Phantasm about
  84 / 77 MU. But the 43-frame charge is a sitting target, and the travel is a fixed straight
  line. An opponent who reads the angle intercepts it or takes the ledge. Falco's shorter Fire
  Bird and fast fall make his recovery the worse of the two.
- **Marth**: good vertical reach (51 MU) and only 20° of tilt, so his horizontal reach is short.
  The move is fast (frame 5), but he can't grab the ledge until the move ends. Hitting him low,
  or taking the ledge so the move finishes into helpless fall, beats it.
- **Sheik**: strong and flexible vertical reach (about 70 MU), with a 360° invisible teleport and
  intangibility in transit. Her 36-frame start is long and visible, so edgeguarders attack the
  startup or the 30-frame landing lag rather than the endpoint.
- **Jigglypuff / Peach**: five floaty aerial jumps with Pound, or 150 frames of float with no
  vertical drop. Their mix-ups come from timing rather than a single committed move. They are
  hard to edgeguard by position and are punished by covering where they must eventually land.
  Peach's parasol fall is slow, so the punish window is long.
- **Ganondorf / Captain Falcon**: short, slow, predictable dives of 38–42 MU from the air. They
  fall fast (Falcon) or drift slowly (Ganondorf), and the dive catches the ledge only late. They
  are easy to edgeguard: an intercept above the ledge, a ledge-hog, or a reverse hit off the
  dive's descent.
- **Mario / Samus / Mewtwo (cheap extras)**:
  - Mario's up-B is short (38 MU) but fast (frame 3), and he adds Cape and Tornado lift.
  - Samus's up-B gives 46 MU, catches the ledge and has 24 frames of landing lag; she also has
    tether and bomb stalls.
  - Mewtwo's 50 MU 360° teleport catches the ledge, after a floaty approach.

## Sources and rights

- In-repo, read only:
  - `smashcraft:ts/src/game/sim/tuning.ts`
  - `smashcraft:docs/design/melee/movement.md`
  - `smashcraft:docs/smash-melee-reference/retail-roster.json`
  - `smashcraft:references/melee-frame-data/records.jsonl` and its `README.md`
  - `smashcraft:docs/physics.md` ("Outer ledge recovery")
  - `smashcraft:docs/design/stages.md`
- Disc: the owner's GALE01 rev 2 ISO at
  `~/.local/share/smashcraft-melee-reference/ntsc-1.02/`, read by the private reader
  `~/.local/share/smashcraft-melee-reference/recovery-facts.ts`. Files read: `PlFx`, `PlFc`, `PlSk`,
  `PlMt`, `PlPe`, `PlCa`, `PlGn`, `PlMs`, `PlMr`, `PlSs` and `PlPr`, each `.dat` and `AJ.dat`.
  Rights: Nintendo/HAL copyright, owner's copy. Only numbers are used; no files leave the private
  directory.
- Decompilation: https://github.com/doldecomp/melee at `0296f009f32f710495979d30772d8332af2d411a`
  (`~/code/resources/melee`). Files read: `src/melee/ft/types.h` (`ftData`) and
  `src/melee/ft/kinds/{ftFox,ftSeak,ftMewtwo,ftPeach,ftCaptain,ftMario,ftMars,ftSamus,ftPurin}/`
  (`types.h` plus the SpecialHi, SpecialS and float sources). Functions:
  - `ftFx_SpecialAirHi_Enter`, `ftFx_SpecialAirHi_Phys`, `ftFx_SpecialHiHoldAir_Phys`
  - `ftSk_SpecialHi_80113A30`, `ftSk_SpecialAirHiStart_0_Phys`
  - `ftMt_SpecialAirHiLost_Coll`
  - `ftCa_SpecialHi_Phys`
  - `ftPr_SpecialAirS_Phys`

  Rights: no license in the repository. It was used for field meanings only; no code was copied
  or translated.
- meleeframedata.com database: https://github.com/mitchhit234/meleeWebProject `characters.db` at
  `ec5155149faeed24b5e5781d7efe17387cc9ee3d` (https://meleeframedata.com/). Rights: no reuse
  license found; factual numbers only.
- libmelee: https://raw.githubusercontent.com/altf4/libmelee/ef679270ff95f0d42339dcdf1608282a35023349/melee/framedata.csv
  and `melee/enums.py`. Rights: LGPL-3.0; factual recorded numbers only, no code used.
- SmashWiki (https://www.ssbwiki.com/Dolphin_Slash, https://www.ssbwiki.com/Falcon_Dive) was
  checked and gives no distances, so it is not used for any number. Rights: CC BY-SA text; not
  reused.
