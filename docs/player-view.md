# What a player sees

Logic tests, type checks, the desync guard and the native match gate can all
pass while a player sees no stage or an effect that never leaves. Smashcraft
uses Wisp's player-view checks (wisp:docs/player-view.md) to fail on those:

- **Scene report.** The development entry (smashcraft:ts/src/platform/devMain.ts)
  and the integrity entry start Wisp's scene recorder through
  smashcraft:ts/src/platform/sceneReport.ts. The recorder's clock is the
  confirmed simulation frame. An effect is out of view only when it is parked
  on the ground beneath the floor, where `hideEffect` puts it and
  `AddSpecialEffect` creates it: alpha, scale and time scale do not stop a
  model's particle emitters. Playable entries never import the recorder; their
  emitted Lua is unchanged by it.
- **Frame probe.** One frame per client, captured off-screen from its private
  desktop and kept on disk.

smashcraft:ts/scripts/wisp/playerView.ts declares the expectations. Each kind
of effect lists its models, taken from the game's asset modules where the host
can load them, and the longest a player should see one stay in view. The stage
needs one drawn deck. A model the declaration doesn't list fails the check as
soon as it is in view, so a new model needs a kind before it ships.

## Where it runs

- `bun wisp fresh MAP.w3x` checks every client after the quick match's
  receipts: the scene report once the match has run 30 frames (main and
  integrity profiles), and one frame saved to
  `~/.local/state/smashcraft/frames/CLIENT.ppm` (every profile).
- The native journeys (`bun wisp four-fighters capture`, `integrity capture`)
  check both at each match start, about one second in, saving frames to
  `OUT/player-view-EPOCH/CLIENT.ppm`, and the scene again at each result,
  when every stay in view has ended. The playable journey's build has no
  recorder, so it gets the frame only.
- `bun wisp view scene DATA_DIR...` checks each client's latest report and
  `bun wisp view frame FRAME.ppm...` measures frames, from captures or
  recordings, with the same expectations.

A failure names the client, what a player would see wrong, the measurement or
report line that shows it, and the report or frame file.

## Frame features

Bands are fractions of the frame, so a 2560x1440 capture and a 1280x720
recording are measured alike.

- **Arena sky**: at least 50% of the top 40% of the frame is sky (blue at
  least 170 and at least 25 above red). Menus, lobbies and results have none,
  so a capture that missed the match fails instead of passing.
- **Stage in the stage band**: in rows 45% to 71% of the frame height,
  between the fighters' feet at match start and the HUD, at least 1% of the
  frame's height in rows (14 at 1440, 8 at 720) must hold an unbroken run of
  deck colour at least 20% of the frame's width long. Deck colour is the
  charcoal, steel or brass of smashcraft:ts/src/game/assets/stagePalette.ts,
  each channel within 40; the deck model is unshaded, so it renders in those
  colours. The slate top is left out: it is within 32 of the sky and clouds.

Calibration, on the 87 frames at 1 fps of the stage-less native four-fighter
recording (native-delivery-20261005/four-fighters-2, an integrity build of the
0.0.43 code, 1280x720): in the 45 match frames the stage band held at most
1 qualifying row (one transient frame; 44 frames held none) against the 8
required, and sky covered 89.7% to 97.2% of the top band; all 45 fail as
stage-less. The 42 menu, lobby and result frames show at most 3.3% sky and
fail as no match; the stage band alone would pass them, because the
selection backdrop is deck-coloured. At tolerance 40 the match frames'
longest deck-coloured run was 5.9% of the width, apart from the transient
frame's one full-width dark row; adding slate at tolerance 32 lets sky and
clouds reach 24.7%. A frame with the stage drawn has not been measured yet;
the deck's front face spans an estimated 35% to 63% of the width over 2% to
7% of the height at match start.

## Lifetimes

Lifetimes are what a player should see, not what the code that hides an
effect happens to do, with room for a pool slot reused while shown: three
seconds for hit sparks, KO bodies, hippogryph, bear and Illidan's flames;
four for projectiles; six for an ice shell; ten for the dizzy mark; 31 for
an unsprung freeze trap; 75 for a shield bubble, which the lightest press
drains in about 72 s. Positions are read every half second, so a stay is
known to half a second.
