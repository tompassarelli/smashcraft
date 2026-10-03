# Retail wall and ceiling recovery behavior

Target: Melee NTSC 1.02, GALE01 revision 2. The observations below were
independently checked against the retail common-parameter table and the pinned
decompile at `0296f009f32f710495979d30772d8332af2d411a`. This records behavior
and numeric facts; it does not reproduce game code or assets.

## Wall tech

- A wall tech starts a five-frame hang (`PlCo` common field `0x760 = 5`).
  During those startup frames, movement and gravity are suspended.
- On contact, wall-jump action selection accepts a jump-button active age
  strictly below 20 frames (`PlCo` common field `0x250 = 20`) or an upward
  stick input. The same input predicate can select a wall jump later during
  the hang.
- Once selected, the jump is queued through the five-frame hang and launches
  when it expires. The retail selection path does not consult the ordinary
  character wall-jump trait or a minimum approach-speed threshold.
- Entering the wall-tech state clears self velocity, knockback, ground
  knockback, shield motion, and acceleration channels. The wall jump's
  character-authored horizontal and vertical launch values remain distinct.
- Wall contact protection uses common field `0x764 = 14` frames.

## Ceiling tech

- Ceiling tech does not use the wall's shared five-frame hang. Its action
  begins at animation rate one and normal physics proceeds.
- Ceiling horizontal motion is applied when that character's animation emits
  the throw-flag-B3 command. That command's per-character animation frame is
  not yet recorded here, so the simulation currently leaves this authored
  ceiling impulse unapplied. Treat ceiling-impulse timing and exact behavior
  as open; do not infer it from the five-frame wall timer.

Sources: `melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c`,
`ftCo_PassiveCeil.c`, `ftCo_PassiveCeil.h`, `melee:src/melee/ft/ftaction.c`,
`melee:src/melee/ft/ftcommon.c`, and selected fields in
`physics-parameters.json`.
