# Gameplay design decisions

This is the one place Smashcraft's stance is written: the owner's principles
and decisions, how Smashcraft departs from Melee, and the questions still open.
The design references are descriptive and take no position:
[Melee case study](design/melee/README.md),
[modern platform fighters](design/modern-platform-fighters.md),
[execution windows](design/execution-windows.md) and the
[physics reference](physics.md). Each decision below names its owner's date
and, where there is one, its issue.

## Dash dancing

Owner direction, 7 Oct 2026 (#175): quick reversals should dash back reliably,
with the sampling tolerance of Slippi/UCF. The authored roster has thirteen
initial-dash frames, then enters Run on frame fourteen; since #390 a few heroes
vary that inside Melee's spread ([Ground states](#ground-states-and-the-stick-map)). Thirteen is Melee's
median initial-dash duration ([movement reference](design/melee/movement.md));
it replaces the provisional ten-frame window. Reference test rigs keep their
own actor timing.

Tom decided, 7 Oct (delegated) (#188): the dash-back window is the initial
dash plus a three-sample stick travel. A reversal whose first stick sample
past the centre (beyond the controller's 0.28 deadzone, on the opposite
side) arrives on dash frames 1-13 dashes back when any of its first three
opposite samples reaches 0.8, including samples past frame 13. Up to two
opposite samples below 0.8 keep the current dash, clock and facing; a third
selects walking. Weak travel that begins after frame 13 walks at once, as
from standing. A dash whose input went neutral is still a dash after frame
13 (its dash attack, dash grab and Dash-to-Guard timing are unchanged); only
Run turns with TurnRun, so a full opposite flick out of that neutral tail
starts a fresh dash, as Melee's Wait-to-Dash does. Holding forward through
frame 14 enters Run, whose reversal is the ordinary TurnRun. Full digital
directions, including keyboard keys, count as full-strength flicks; opposite
keys held together cancel to neutral. Small same-direction stick variation
keeps an existing dash; the walk modifier explicitly selects walking.

Why three samples: a linear 4-frame flick spends about 1.04 frames between
0.28 and 0.8, so at some sample phases it shows two weak samples before the
gate. UCF's two samples misread those as tilt turns; #188's scripted dance
(13 fighters, both facings, stick at ten sample phases and keyboard with
overlapping or gapped keys, 1-4 frame flicks: 9,984 dash-backs) measured 208
misreads under #175's rule and 0 under this one. 936 dash-backs released to
neutral late in the window also read 0 misreads; #175 ran any reversal from
that tail past frame 13 as a run turn. The cost is one
more frame before a deliberately weak opposite stick walks out of a dash.

[UCF's technical description](https://www.20xx.me/ucf.html) allows the first
tilt-turn frame to cancel into dashback, increasing its one-sample opportunity
to two. Its [v0.65 changelog](https://www.20xx.me/ucf-changelog.html) names a
0.95 second-frame requirement; Smashcraft deliberately uses the same 0.8
threshold on all three samples for small stick variation. This is an authored
tolerance policy, not exact UCF emulation. It uses independently described
behavior and numerical facts; no external implementation was copied.

## Ground states and the stick map

Tom, 9 Oct 2026 (#390): copy Melee's ground states and its analog stick map,
each state with its own options, with a little per-fighter variation. Values
are GALE01 revision 2 `ftCommonData` fields read from the owner's PlCo.dat
(offsets as in melee:src/melee/ft/types.h at revision
0296f009f32f710495979d30772d8332af2d411a; that source has no license, so only
numbers and function names are cited, no code). SmashWiki's
[Turn](https://www.ssbwiki.com/Turn) page agrees: tilt turn 0.28–0.78, smash
turn 0.8–1.0, a smash turn dashes on its first frame. The pure rules are
smashcraft:ts/src/game/sim/stickZones.ts.

### Stick zones

Stick values are −1 to 1 after the 0.28 absolute deadzone (+0x0, +0x4), which
the input adapter applies to row directions. A side "flick" means the stick
crossed the 0.25 smash deadzone (+0x8) at most two samples ago (Melee's
`dash_smash_window` +0x40 is 2; #188 keeps three samples). An up flick is the
same on the vertical axis within the 4-frame tap-jump window (+0x74). Zones
are checked in `ftCo_Wait_IASA`'s order: jump, dash, crouch, turn, walk, so the
diagonal corners go to the earlier zone.

| Zone | Condition (facing right; mirror for left) | Melee field / function |
| --- | --- | --- |
| Deadzone | \|x\| < 0.28 and no other zone | +0x0 `horizontal_stick_deadzone` |
| Tilt turn | x ≤ −0.28 (turn threshold −0.25, +0x34, under the deadzone), not a fresh smash | `ftCo_800C97A8` |
| Smash turn | x ≤ −0.8, fresh flick | +0x3C, `ftCo_Dash_CheckInput` → `ftCo_Turn_Enter_Smash` |
| Walk slow | 0.28 ≤ x < 0.4 | +0x24 0.18 (under the deadzone), +0x28 0.4 `ftWalkCommon_GetWalkType` |
| Walk middle | 0.4 ≤ x < 0.8 | +0x28, +0x2C |
| Walk fast | x ≥ 0.8, not a fresh flick | +0x2C 0.8 |
| Dash slow | 0.8 ≤ \|x\| < 1, fresh flick; run target = \|x\| × run speed | +0x3C, `getAccelAndTarget` |
| Dash fast | \|x\| = 1, fresh flick | same |
| Dash 1f → jump | dash zone with 0.5625 ≤ y < 0.6625 on a fresh up flick: dash, then the relaxed tap jump next frame | +0x80 `relaxed_tap_jump_threshold`, `fn_800CAF78` |
| Jump | y ≥ 0.6625 on a fresh up flick (0.5625 in dash, run, run brake, turn-run) | +0x70, +0x74, +0x80 |
| Crouch | y < −0.6875; held until y > −0.625 | +0x90 `ftCo_Squat_CheckInput`, +0x94 `ftCo_SquatRv_CheckInput` |

Run holds while x × facing ≥ 0.625 (+0x58, `ftCo_RunBrake_CheckInput`),
turns at ≤ −0.375 (+0x38, `fn_800C9D40`) and otherwise brakes; a dash enters
Run at its run frame only with the stick past 0.625 forward (`fn_800CA5F0`).
#392's platform bands reuse the deadzone, the 0.6875 crouch threshold and the
0.6625 jump threshold ([Platforms](#platforms)).

### States and their options

| State | Entered by | Tilts / jab | Smashes | Dash attack | Grab | Shield | Jump | Crouch | Dash / dash dance | Run turnaround |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Stand (`ftCo_Wait_IASA`) | neutral | yes | yes | – | yes | yes | yes | yes | dash, smash turn | – |
| Walk slow/middle/fast (`ftCo_Walk_IASA`) | walk zone; re-enters Dash when the stick then flicks past 0.8 within the window (`ftCo_Dash_CheckInput` in Walk's list) | yes | yes | – | yes | yes | yes | yes | dash | – |
| Initial dash (`ftCo_Dash_IASA`) | dash zone from stand, walk or crouch, or a dash back | no: A gives the dash attack | forward smash on frames 1–4 only (+0x44 = 4) | frames 1–20 (+0x4C = 20) | dash grab | yes | yes (relaxed) | no | dash back (the dash dance) | – |
| Run (`ftCo_Run_IASA`) | dash held forward to its run frame | no: A gives the dash attack | no | yes | dash grab | yes | yes (relaxed) | no | no | turn-run at x ≤ −0.375 |
| Run brake (`ftCo_RunBrake_IASA`) | run with \|x\| < 0.625 | no | no | no | no | no | yes (relaxed) | yes: crouch from run goes through here | no | turn-run within its command window |
| Turn-run (`ftCo_TurnRun_IASA`) | run or run brake turned | no | no | no | pivot grab (Smashcraft, #337) | no | yes (relaxed) | no | no | – |
| Crouch (`ftCo_Squat_IASA`, `ftCo_SquatWait_IASA`) | crouch zone from stand, walk or run brake | yes | yes | – | yes | yes | yes | holds | dash | – |

`groundOptionAllowed` holds this table and `groundGatedStyle`
(smashcraft:ts/src/game/sim/attacks.ts) applies it: a refused ground normal in
a dash (through frame 20) or run becomes the dash attack, otherwise it does not
start; shield and crouch are refused in the states marked no. Recorded
scenarios in smashcraft:ts/src/game/sim/stickZones.tests.ts drive a fighter
into each state and check each allowed and refused option.

Where Smashcraft keeps its own rule, and why:

- Tap jump stays off: jumps use the jump button and Up stays the up-attack
  direction on keyboard. The jump and dash-1f-jump zones are computed but do
  not jump.
- Turns have no separate 11-frame Turn state: a tilt turn walks the other way
  at once and a smash turn is the dash back.
- Specials are not gated by ground state (Melee's Dash allows only the side
  special); #390 gates the normals, grab, shield and crouch.
- Rolls come from shield on every state that allows shield (Melee also rolls
  out of dash frames 1–3, +0x48).
- The forward-smash window applies to every initial dash, including dash backs.
- A held stick at full deflection (keyboard keys and a pad at the rim) still
  dashes when it was not a fresh flick, keeping the walk modifier's release
  to a dash (smashcraft:docs/physics.md); a pad held at 0.8–0.99 walks fast.
- Walk speed is \|x\| × walk speed for analog sticks (#204); the walk modifier
  gives one full walk speed.

### Per-fighter variation

Walk, initial dash and run speeds are clamped to Melee's roster spread (walk
0.65–1.60, initial dash 1.00–2.00, run 1.10–2.30 Melee units a frame), and the
run-from-dash frame to 8–19 ([movement reference](design/melee/movement.md));
`MELEE_*_SPREAD` in smashcraft:ts/src/game/sim/tuning.ts. Heavy heroes (Anub'arak,
Pit Lord, Thrall, Cairne) run from frame 16 like Donkey Kong and Ganondorf.
No hero runs earlier than frame 14: a shorter initial dash would shrink #188's
dash-back window (first opposite sample on dash frames 1–13), which the dash-dance
sweep holds for the roster.
Each fighter's values are listed in its section of the [move list](move-list.md).

## Air drift and jump momentum

Tom decided, 7 Oct (delegated) (#190), after his playtest found too little
horizontal air drift on many fighters: a dash, a jump at the dash's speed and a
long aerial that crosses up a shield should feel good.

**Melee's rules.** Values come from smashcraft:docs/smash-melee-reference/retail-roster.json
(NTSC 1.02 PlXx.dat attributes, `ftCo_DatAttrs` field names from the
decompilation); the per-fighter air table is in the
[movement reference](design/melee/movement.md#falling-and-air-control).

- A ground jump's horizontal speed on takeoff is the ground speed × the
  fighter's `ground_to_air_jump_momentum_multiplier`, plus the stick ×
  `jump_h_initial_velocity`, capped at `jump_h_max_velocity`; traction
  keeps braking through the jump squat (smashcraft:docs/physics.md, jump
  checkpoint). Across the 26 fighters the multiplier runs 0.70 (Mewtwo, Peach,
  Yoshi, Zelda) to 1.00 (Falco, Jigglypuff), mostly 0.80; the initial speed
  0.60 (Ice Climbers) to 1.00; the cap 0.75 (Luigi) to 2.10 (Captain
  Falcon), with Fox and Falco at 1.70. A run jump keeps most of the run up to
  the cap: Fox's 2.2 run gives 2.55, capped to 1.70.
- In the air the held stick accelerates by a base plus a stick-scaled amount
  up to the air speed. Above the air speed, holding forward loses only the
  air friction each frame, never dropping below the air speed, under the
  common 3.0 cap (Falco 4.0); with no stick the fighter loses its air
  friction (`ftCommon_CalcSelfAccel`). So jump momentum fades at 0.005 to
  0.05 a frame (Fox 0.02), which is what carries a dash-jump aerial across a
  shield. An aerial jump replaces the horizontal speed with the stick ×
  `air_jump_h_multiplier`.
- Air speed runs 0.68 (Luigi) to 1.35 (Jigglypuff), median 0.90; maximum air
  acceleration from 0.0325 (Samus) to 0.08 (Fox), with Jigglypuff an outlier
  at 0.28 ([SmashWiki: Air speed](https://www.ssbwiki.com/Air_speed),
  [Air acceleration](https://www.ssbwiki.com/Air_acceleration)).
- Aerial attacks never set air velocity: AttackAir runs the ordinary air
  physics, so drift continues and a fast fall persists
  (melee:src/melee/ft/kinds/ftCommon/ftCo_AttackAir.c). Specials do:
  [B-reversing](https://www.ssbwiki.com/B-reverse) and
  [wavebouncing](https://www.ssbwiki.com/Wavebounce) flip momentum on many
  specials. Horizontal recoveries set the velocity outright (Fox's Illusion,
  Falco's Phantasm), and some specials stall or lift (Mario's Cape, Marth's
  Dancing Blade, Peach's float).

**Ultimate and Rivals 2.** Ultimate's air speed runs 0.735 (King Dedede) to
1.344 (Yoshi), median about 1.00; air acceleration 0.03 to 0.13, with aerials
likewise leaving velocity alone (SmashWiki pages above). Rivals 2 drifts much
further relative to its ground speed. Zetterburn's air speed is 13 against a
run of 18 and a horizontal jump speed of 15; Kragg's 11.33, 16.3 and 12.5
([Dragdown: Zetterburn](https://dragdown.wiki/wiki/RoA2/Zetterburn),
[Kragg](https://dragdown.wiki/wiki/RoA2/Kragg)). That is about 70% of run speed
in the air, against Melee Fox's 38%.

**Decision.**

Historical fixture before #339: - **One momentum rule for everyone.** Every fighter jumps by Melee's
  ground-jump rule and drifts by its air rule. Illidan used to keep his full
  ground speed and then snap to his 0.88 air speed on his first steer, which
  threw away his dash. He now uses the shared rule with his retained
  momentum multiplier of 1.00 and no extra jump impulse, a 1.70 jump cap,
  and Melee's common 3.0 air cap. This preserves his standing-hop cross-ups
  while his dash carries and fades by air friction like everyone else's.
  Aerial jumps are unchanged. Tom delegated, 7 Oct.
- **Air bands.** Air speed is 0.75–1.25 and maximum air acceleration
  0.04–0.10 Melee units a frame. The floor comes from Ultimate (0.735) rather
  than Melee (0.68), as deviations start from Ultimate. Rivals 2's much
  larger drift is a different game's feel, so it is not the starting point.
  A hero's air multiplier now multiplies 1.00 (Ultimate's median) instead of
  Archer's 0.83. That lifts every hero by a fifth, and Pit Lord rises from
  0.70 to 0.75, still the lowest. Archer and Rifleman keep Fox's and Falco's
  0.83: their reach comes from the jump and, for Rifleman, the hang time.
- **Aerials leave air velocity alone**, as in Melee and Ultimate. Specials
  keep their authored motion.
- Gravity, fall speed, the 1.70 jump cap and the air dodge are unchanged.

smashcraft:ts/scripts/airDrift.tests.ts holds every fighter to the band and
the rule. Its cross-up test dashes 8 frames from 40 Melee units in front of
a shielding mirror, jumps holding forward and throws an aerial, which must
meet the shield from behind. `bun scripts/airDrift.ts` prints the roster
table (Melee units a frame; takeoffs after 8 dash frames and 24 run frames):

| Fighter | Air speed | Air acceleration | Air friction | Jump momentum × | Jump initial | Jump cap | Dash-jump takeoff | Run-jump takeoff | Cross-up from 40 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Rifleman | 0.83 | 0.070 | 0.020 | 1.00 | 0.70 | 1.70 | 1.70 | 1.70 | short hop back air, press 30 |
| Illidan | 0.88 | 0.075 | 0.020 | 1.00 | 0.00 | 1.70 | 1.68 | 1.68 | short hop back air, press 27 |
| Blademaster | 1.00 | 0.080 | 0.020 | 0.83 | 0.72 | 1.70 | 1.70 | 1.70 | short hop back air, press 20 |
| Mountain King | 0.82 | 0.080 | 0.020 | 0.83 | 0.72 | 1.70 | 1.70 | 1.70 | short hop back air, press 14 |
| Warden | 1.10 | 0.080 | 0.020 | 0.83 | 0.72 | 1.70 | 1.70 | 1.70 | short hop back air, press 22 |
| Lich | 0.95 | 0.080 | 0.020 | 0.83 | 0.72 | 1.70 | 1.70 | 1.70 | short hop back air, press 19 |
| Forsaken Paladin | 0.88 | 0.080 | 0.020 | 0.83 | 0.72 | 1.70 | 1.70 | 1.70 | short hop back air, press 18 |
| Dreadlord | 1.22 | 0.080 | 0.020 | 0.83 | 0.72 | 1.70 | 1.70 | 1.70 | short hop back air, press 20 |
| Shadow Hunter | 1.00 | 0.080 | 0.020 | 0.83 | 0.72 | 1.70 | 1.70 | 1.70 | short hop back air, press 16 |
| Pit Lord | 0.75 | 0.080 | 0.020 | 0.83 | 0.72 | 1.70 | 1.70 | 1.70 | short hop back air, press 13 |
| Beastmaster | 0.88 | 0.080 | 0.020 | 0.83 | 0.72 | 1.70 | 1.70 | 1.70 | short hop back air, press 16 |
| Lich King | 0.86 | 0.080 | 0.020 | 0.83 | 0.72 | 1.70 | 1.70 | 1.70 | short hop back air, press 20 |


## Principles

Owner decisions, 6 Oct 2026 (#62):

Historical fixture before #339: - **Not a Melee clone.** Melee's data is a reference, not a template, and every
  fighter gets original hitboxes. The owner had already said so for the
  physics (3 Oct): Smashcraft's fighters are original characters; verifying
  Melee's physics concerns its shared equations and state rules, not making
  Archer Fox or Rifleman Falco; any value a fighter borrows from a Melee
  fighter, such as a jump squat, is a separate design choice. Melee fighters
  appear only as test rigs.
- **The best mechanics from any platform fighter.** The candidates are
  inventoried in [modern platform fighters](design/modern-platform-fighters.md) (#66).
- **No false agency.** Players must never believe they can escape when they
  can't. Wobbling and 0-to-death chain grabs are the anti-pattern
  ([Melee case study](design/melee/techniques.md#jank)). Locked states should
  be legible (#68).
- **SDI without teleport jank** (#70).
- **Non-interactive execution is dubious** (6 Oct, #54; see "L-cancelling" below).
- **Short true combos, devastating combos through reads** (6 Oct, #83; see
  "Combo structure" below).
- **Deviations start from Ultimate and Rivals of Aether 2** (6 Oct). When a
  Melee mechanic feels worse than it should and we deviate from it, look first
  at Smash Ultimate's and Rivals of Aether 2's values; proposals cite both
  (where they exist) and recommend one as the starting point. Tom tunes from
  there. First application: shield release lag, 15 → 11 frames, Ultimate's
  value (#100).
- **Positions are used, not camped** (6 Oct, #103). Platforms are used quickly
  and situationally: to extend a combo or escape a pressure string. A fighter
  sitting on a platform is slightly disadvantaged against one below it;
  advantage comes from leaving a position well (running off and fast falling),
  not from height or from the fastest jump. See "Platforms" below.
- **Balance by sharpening identity, never by homogenizing** (6 Oct, #105).
  Each fighter declares a gameplan its computer plays: the range it keeps, its
  key spacing tools, how it approaches and defends, its combos and finishers,
  its way back and the situations it avoids. A fighter that loses is fixed by
  raising its signature strengths or making its weakness more avoidable
  through its gameplan, measured, not by making its kit like the others. See
  "Fighter gameplans" under "Computer opponent".

## Online input timing

Tom decided, 9 Oct 2026 (#396), superseding the fixed delay of #60: input
delay feels the same in every mode, so practice transfers. The pure policy is
smashcraft:ts/src/game/netcode/delayPolicy.ts; the Warcraft map and Wisp's own
transport (wisp#110) both call it.

- **Default 2 frames (33 ms)** against computers, in local versus and online,
  as in Slippi.
- **Delay setting**, saved per player with the controls (Controls and delay,
  F1 on character select, which is also the lobby): **Auto** (the default) or
  **Fixed N** frames, 0 to 8, used as-is. Rollback absorbs the rest. Local
  matches can lower it to 0 or 1. **Recalibrate** shows the measured ping,
  Auto's choice and the expected rollback depth, and one press makes that
  choice fixed.
- **Lobby agreement:** each player sees the other's request on character
  select. The match uses the higher request, so nobody plays below what they
  asked for. When the agreed delay is 8 frames (133 ms) or more, the lobby
  warns: "Input delay of 8+ frames: this connection will feel sluggish".
- **Auto, online:** round trip comes from the input stream itself, the echo
  of each sent row, with no extra packets. It is smoothed in integer
  milliseconds with Jacobson/Karels (RFC 6298: SRTT gain 1/8, RTTVAR gain
  1/4). Auto chooses delay = max(2, ceil(one-way frames) − R), using the
  smoothed trip plus two deviations, and caps it at 8. R, the rollback budget,
  is 7 frames. Delay rises above 2 only past 2 + R = 9 one-way frames (about
  300 ms round trip), so ordinary connections keep 2 frames and rollback
  absorbs the rest. Auto raises at once but lowers only when one more frame of
  round trip would still allow the lower value, so jitter cannot flip it back
  and forth.
- **When delay changes:** only at match start, on the epoch every client
  begins together, from requests already exchanged through the synchronized
  channel. It never changes mid-exchange.
- **Time sync (GGPO-style, pause-free):** the client that runs ahead by two
  or more frames of advantage waits one frame, at most once per second, so
  rollback depth stays even on both sides (`timeSyncWait`). Wisp's
  peer-to-peer transport (wisp#110) needs it. The Warcraft map does not call
  it: Warcraft relays every sync message through its host to all clients on
  the same turn, so neither client runs ahead, and a local wait would only
  make the two clients' predicted drawing differ.
- **Network indicator:** online matches show the current delay and rollback
  depth. If the one-way trip exceeds the window plus the delay, it shows
  "connection poor" instead of desyncing.
- **Rollback window:** 24 frames, the hard stall limit
  (smashcraft:ts/src/game/replay/limits.ts). It is not the budget: deeper
  corrections look like teleports and cost more replay.

Prior art, read from source on 9 Oct 2026:
- GGPO: `MAX_PREDICTION_FRAMES 8` (pond3r/ggpo src/lib/ggpo/sync.h). Its time
  sync (src/lib/ggpo/timesync.cpp) averages local and remote frame advantage
  over 40 frames. The side ahead sleeps round((remote − local) / 2) frames when
  that is at least 3, at most 9, and asks again every 240 frames
  (backends/p2p.cpp). Smashcraft slows more gently: one frame a second at most.
- Slippi: `ROLLBACK_MAX_FRAMES 7` (project-slippi/Ishiiruka
  Source/Core/Core/Slippi/SlippiNetplay.h). Players pick delay frames, 2 by
  default, and rollback absorbs the rest. R = 7 follows Slippi; GGPO's 8 is
  one frame more.
- Rivals of Aether 2 (SnapNet) shows input and prediction frames on screen.
  Players set input frames, or the netcode adapts delay to the connection
  (edgegap.com, "Rivals of Aether 2 – How is its online experience is so
  good?"). Players report 2 delay frames and 2 rollback frames as the
  defaults; that is not confirmed from an official source.

The journal integrity diagnostic and the playable keyboard build both start
at delay 2 with the 24-frame window. The capture-to-first-prediction check
measures map admission, which does not establish press-to-screen time.

## Bounded SDI

Reversible default selected under the owner's authorization, 6 Oct 2026 (#70),
and implemented in smashcraft:ts/src/game/sim/smashDirectionalInfluence.ts.

SDI should change where a hit leaves the defender, with a useful escape choice
in multi-hits, without rewarding ever more inputs with unbounded travel. Count
travel distance, including reversals, rather than distance from the hit's origin.
All distances below are Melee units; one is six world units.

- **Per hit:** at most 12 units total, comprising at most 9 SDI and 3 ASDI.
- **Per uninterrupted string:** at most 24 units total across SDI and ASDI.
  A new contact renews the hit allowance, never the string allowance. A string
  ends after one complete tick in which the defender can act, or on stock loss,
  respawn or match reset. Hitlag, hitstun, grabs and scripted holds (freeze
  traps, the stage cannon, knockdown bounce and jab-reset damage) keep it open;
  a gap between multi-hits while the defender is still held does not renew it.
  The tick that ends hitstun is the first actionable tick, so a hit landing at
  its end still continues the string; the string renews at the start of the
  next tick.
- **Smoothing:** each fresh pulse requests up to the existing 6-unit travel,
  spent in ordered steps of at most 3 units per tick while hitlag remains.
  Reserve up to 3 units of the remaining string allowance for that hit's ASDI
  before admitting SDI requests. Pending requests reserve the remaining hit and
  string allowance, so extra flicks cannot build an unbounded queue. ASDI uses
  the release tick's whole 3-unit step; do not drain queued SDI on that tick.
  Discard unfinished SDI on release or a replacement hit, and release its
  unused reservation. Never continue it into hitstun or ordinary movement.
- **Contacts:** charge each requested step's length before collision clipping;
  walls cannot refill the allowance. Use the existing swept surface contacts,
  grounded non-lifting restriction and blast-zone checks for every step. ASDI
  still prefers the C-stick, can land, and uses the existing non-tumble/tech
  landing rules. Continuous DI still reads the left stick on release and keeps
  its launch-angle rule. Attacker hitlag never admits victim SDI.

The shared string cap also limits ASDI: after 24 units have been spent, a later
hit supplies no positional SDI or ASDI until control returns. This is a deliberate
departure from Melee; reserving ASDI on each eligible hit keeps the held-direction
choice useful before that cap. An ordinary stationary-held direction generates
no repeat pulses. No extra delay is added before the first smoothed step.

At these defaults, a two-frame freeze permits 3 SDI plus 3 ASDI units; a
four-frame or longer freeze can spend the full 12. Two fully spent hits exhaust
the 24-unit string budget. The numerical defaults are ordinary tuning values
and can be revised together without altering the rule.

Each fighter's launch state carries the travel charged this hit and this
string and at most two queued requests (a full pulse and the rest of the hit's
SDI, the most the defaults admit), in Melee units, through snapshots, replay
and rollback. smashcraft:ts/src/game/sim/smashDirectionalInfluence.tests.ts
replays the ten teleport fixtures through the production step: the 20-frame
cases now travel 72 world units (12 Melee units) instead of 702, the three-hit
strings 144 instead of 378 and 2,106, and no tick moves more than 18. The
oracle's "smash DI" rows report Melee's 114 units and 6-unit shifts beside our
9 and 3 under the SDI departure. Native feel remains a later playtest.

The factual baseline is [Melee's defense](design/melee/defense.md#influence-on-knockback)
and [SDI teleports](design/melee/techniques.md#sdi-teleports). The current
unbounded simulation's measurements at build 89abaf3c are retained in
smashcraft:evidence/sdi-design-20261006.json.

## Combo structure

Owner decision, 6 Oct 2026 (#83): devastating combos should be the norm
against a player who is being outplayed, but they are earned through reads,
not granted by one hit.

- True combos are short: a hit guarantees about one or two follow-ups at most.
- Every extension beyond that is a read: a DI guess, a tech or escape guess,
  a coin flip the defender influences.
- A player who wins 2–3 reads in a row can take a stock from 0. Explosive
  moments come from chained reads, not from everyone landing two hits.
- One hit never guarantees a stock (see also "No false agency", #68).

Terms for measuring it. An **opening** is a hit or grab that lands. A
**guaranteed follow-up** lands whatever the victim does: every DI direction
including none, SDI, tech in place, left, right or missed, jump, air dodge and
mash. A **read** is a follow-up that lands against some of those choices but
not all, when the victim makes one it beats. A **string** is an opening and the
follow-ups that land after it.

Accepted measurement targets for #83, following the owner's 6 Oct 2026
authorization to carry out the recommendations. The interaction graph reports
violations to guide balance work; this measurement issue does not rebalance
every move ([interaction graph](design/interaction-graph.md)).

| Target | Accepted | Breaks it |
|---|---|---|
| Guaranteed follow-ups after an opening | at most 2, at every percent | a string of 4 or more hits that no victim choice escapes |
| Guaranteed damage from one opening, by the victim's percent when it lands | at most 30% at 0–99%; from 100%, a guaranteed string may end in a KO | more damage than that before the victim has a choice that escapes |
| Reads for 0-to-death | about 2–3: from 0%, no opening takes the stock with fewer than 2 reads, and each fighter has openings that take it with 3 | a stock taken from 0% with 0 or 1 reads; or a fighter with no 0-to-death path even with 3 reads |

The damage cap is chosen to fit the reads target: an opening and 2–3 reads,
each followed by guaranteed follow-ups worth up to about 30%, bring a victim
from 0% to roughly 90–120% before the last hit.

## Throw regrabs

Implementation choice, 6 Oct 2026 (#85), under the owner's instruction to
implement the suggested defaults: a grab cannot catch a fighter whose current
hitstun came from a throw. Standing, dash and shield grabs share this rule.
When that hitstun ends, grabs can catch again. A follow-up strike can still hit
during throw hitstun; if it replaces the throw's hitstun, ordinary grab
eligibility returns. Damage-only arrows do not replace the throw's hitstun.
A gentle landing keeps the throw's remaining hitstun instead of ending it
early while the victim is still recovering from the landing.

This removes direct throw-to-regrab chains while retaining true throw-to-attack
combos and attack-to-grab reads. It does not grant a timed immunity after control
returns or forbid grabs during ordinary attack hitstun.

## Throw roles

Owner direction, 6 Oct 2026 (#107): grabs and throws are launchers with a
deliberate trade-off, and shields cannot trivially escape them.

- **Up throw: a guaranteed short juggle.** Every fighter's up throw leaves
  its victim out of tumble through mid percent (its JUGGLE class) and the
  thrower recovers 8 to 13 frames after the release, so one or two
  follow-ups land whatever the victim does at 0, 30 and 60%. Past that the
  victim tumbles and can tech, so the follow-up becomes a read: the up throw
  is the safer, smaller reward.
- **Down throw: a tech chase.** Every down throw tumbles its victim from 0%
  (its CHASE class, knockback above 80) and lands it 14 to 35 frames after
  the release, inside the throw's hitstun, so the victim must tech in place,
  tech roll either way or miss the tech. No down throw guarantees a
  follow-up at 0-60%; each tech option has a follow-up that lands when the
  thrower reads it. It is the harder throw with the higher ceiling.
- **Forward and back throws** follow each fighter's identity (spacing, edge
  position, Mountain King's and the Dreadlord's KILL back throws); #107
  leaves them unchanged.

Measured by `bun wisp interactions` for every selectable fighter in
smashcraft:tools/move-data/interactions/throws.md
(smashcraft:ts/scripts/throwRoles.ts).

**Grabs against jump out of shield.** A grab catches a fighter within the
first 7 frames after a ground jump leaves the deck as if its feet were still
at the grabber's height (EARLY_ASCENT_GRAB_FRAMES in
smashcraft:ts/src/game/sim/moves.ts). Seven is the slowest standing grab's
first active frame (the Lich, frame 10) less the fastest jump squat (3), so a
grab started on the frame a shielding opponent jumps catches it for every
pair of fighters (smashcraft:ts/src/game/match/jumpOutOfShieldGrabContracts.tests.ts).
In Melee the standing catch boxes are live on timeline frames 6 to 8
(smashcraft:docs/smash-melee-reference/retail-grab-events.json, ftCo_Catch)
and jump squat runs 3 to 8 frames (ftCo_KneeBend,
[movement](design/melee/movement.md#jumps)), so a jump from a 3-frame squat
is already 4 frames into its ascent when a same-frame grab's box appears.
Ultimate gives every fighter a 3-frame jump squat and adds about 4 frames to
a grab out of shield, against 3 for a jump
([EventHubs](https://www.eventhubs.com/news/2018/dec/19/trouble-punishing-shielded-moves-super-smash-bros-ultimate-out-shield-mechanics-work-very-differently-and-require-change-habits));
Rivals 2 is not sourced. The window covers grabs only: a grab pressed 6 or
more frames after the jump misses every fighter, and no attack gets the
window, so jumping out of shield still escapes slower attacks.

## Advantage state

Owner direction, 9 Oct 2026 (#388): the advantage state is built from grabs,
tech chases, juggles, DI mix-ups and tech traps, and every fighter has each of
them. Grabs are the usual launcher, above all at low percent. The tools extend
"Combo structure": the true part stays short, and each step past it is a read.

Prior art. In Melee a grab at low percent is the standard starter: Marth's and
Fox's up throws lead into up airs, Sheik's and Captain Falcon's down throws
start tech chases, and DI decides which follow-up works, so attackers "throw
out an unexpected move which punishes the player for their DI"
([SmashWiki DI](https://www.ssbwiki.com/Directional_influence),
[SmashWiki Tech-chasing](https://www.ssbwiki.com/Tech-chasing),
[chain grabs](design/melee/techniques.md#chain-grabs)). Ultimate keeps
up-throw juggles but shortens tech rolls, making tech chases reads rather than
reactions ([SmashWiki Tech-chasing](https://www.ssbwiki.com/Tech-chasing)).
A juggled fighter escapes with DI and air dodge and escapes more easily as its
percent rises ([SmashWiki Juggle](https://www.ssbwiki.com/Juggle)). Rivals 2
restored grabs "because they counter shields"
([Rivals 2 FAQ](https://rivals2.com/faq)). A tech trap is a hitbox placed or
timed to catch two tech options at once, typically tech in place and the
missed tech, whose vulnerable frames overlap
([platform fighters](design/platform-fighters.md#tech-chases)).

Targets, for every fighter against a light, a medium and a heavy target
(Lich, Rifleman and Cairne, the roster's lightest, middle and heaviest
weights), measured by the combo explorer at 0, 20, 40 and 60%:

- **Grabs.** At each of 0, 20 and 40%, at least one throw starts a true combo
  (a follow-up that lands against the escape-optimal DI), a DI mix-up or a
  forced knockdown. Grab reach is #337's (see
  [grabs](design/grabs.md)).
- **Tech-chasing.** At least one move (the down throw first, then down smash,
  down tilt, forward or back throw) knocks the victim down under every DI, and
  some follow-up lands against each of tech in place, tech in, tech away and
  the missed tech when the attacker reads it.
- **Juggling.** An up-angled launcher (up throw, up tilt or up smash) is
  followed by an up air or up tilt that hits the falling victim at some
  percent against every DI but at most one (of none, in, out, up and down), so
  only a correct DI guess escapes the re-launch; the victim's landing (drift,
  air dodge, fast fall) is what the juggler then reads.
- **DI mix-ups.** At least one throw whose first follow-up against DI in
  differs from the one against DI out, so the attacker reads DI instead of
  repeating one string.
- **Tech traps.** One of the tech-chase reads lands against at least two of
  the four tech options with the same inputs.

None of these may become a true zero-to-death: no throw takes a stock at 0 to
60% against the escape-optimal DI, and "Combo structure"'s limits still apply.
Computer fighters tech chase: a downed or teching opponent is a punish window
(smashcraft:ts/src/game/match/botPunish.ts) that opens when its intangibility
ends, so tiers with faster reactions and more punish judgment chase more.

`bun wisp combos --advantage` (from ts/) writes the per-fighter report to
smashcraft:tools/move-data/advantage-state.md: true combos from each throw
with and without DI, the DI mix-ups, the knockdown and its tech-chase
coverage, the tech trap and the juggle.

## Platforms

Owner decisions, 6 Oct 2026 (#103), implemented in
smashcraft:ts/src/game/sim/platformMoves.ts and recorded in its scenarios. Platforms are physical things
fighters contest, not lines they phase through: in real life you climb onto a
platform and climb off it. They replace #51's instant pass-through and the
"Platform shield drop" default, following the principle that positions are
used, not camped.

Owner decisions, 9 Oct 2026 (#392, settled with the lead), replace #103's
half-circle wraps and the ascent's hit-through: the climb and the drop replace
the aerial, and intent is read from how far the stick is held toward the
platform, not from taps or timing.

- **Rising: climb by default.** When a rising fighter's body meets a
  pass-through platform from below, it climbs the platform over its jump
  squat (Rifleman 5, Illidan 4, each hero its own), the honest proxy for its
  agility, carrying its feet from where they met the platform to its top.
  Any aerial or special in progress ends with the climb, with no landing lag:
  a fighter can't attack and climb at once. An aerial's strike still resolves
  on the contact frame, and the aerial ends as the climb's first frame begins. A helpless fighter stays
  helpless. With no input it keeps its momentum, with gravity, and leaves the
  top still rising if it has rise left; holding jump, or up past the jump
  threshold (0.6625), sustains the rise with no gravity. It is actionable as
  the climb ends, so rising back air → climb → down air comes out on the first
  actionable frame.
- **Falling: land by default,** with the aerial's normal landing lag, as in
  Melee; edge cancels on platform ends apply (#386). After standing, down is
  an ordinary crouch input and a fresh down descends as below.
- **Intent is the stick held toward the platform** on the contact frame and
  the 3 frames after it (`PLATFORM_INTENT_FRAMES`; Melee has no such read).
  Bands start just past the 0.28 deadzone (PlCo +0x0) and stop at Melee's
  crouch threshold, y < −0.6875 (+0x90, `ftCo_Squat_CheckInput`), and jump
  threshold, y ≥ 0.6625 (+0x70), the #390 values in
  smashcraft:ts/src/game/sim/stickZones.ts. They are bands, not half-way
  points.

  | Contact | Stick | Analog | Keyboard | Result |
  | --- | --- | --- | --- | --- |
  | Rising | neutral | \|y\| < 0.28 | no direction | climb through with momentum |
  | Rising | down | y ≤ −0.28 | down or Tilt + down | stand on the platform, no landing lag |
  | Falling | neutral, shallow or up | y ≥ −0.6875 | no direction, up or Tilt + down | land, with landing lag |
  | Falling | full down | y < −0.6875 | down | drop through, ending the aerial |

  Down held from before the climb counts. A falling drop also comes from full
  down in the 3 frames after landing, ending the landing lag (not after an
  air dodge's landing, so wavelands stay). Shield held or pressed during a climb still ends it standing on
  the platform, shielding.
- **The drop** lowers the fighter through the platform over its jump squat
  until its body is below it, and it is actionable as the drop ends: falling
  down air → drop → up air on the first actionable frame.
- Diagonals: depth decides, not diagonal notches, because players hold
  diagonals while drifting (Tom and the lead, 9 Oct); a keyboard
  down-diagonal is past the crouch threshold.
- The wrap over a platform's edge (#392) was removed (Tom, 10 Oct): it needed
  a wrap-around animation per fighter for a gymnastic option.
- Chains are bounded by geometry rather than a cooldown: each cancel needs a
  platform, and going up costs a jump. Tom's route: falling down air → drop →
  up air → drop → double jump → rising up air → climb → down air.
- **Platform descent.** A fresh down standing on a platform (analog at Melee's
  drop-through speed, or a digital down) lowers the fighter through it like
  the drop. The tilt modifier keeps a digital down for crouching and down
  tilts. An aerial, air dodge or special pressed during the descent comes out
  on its first free frame below.
- **No platform shield drop.** Down while shielding does not fall through a
  platform; leaving one goes through a descent.
- Fighters are fully vulnerable, hittable and grabbable, through climbs,
  drops and descents. With no shield drop and a jump-squat descent, a
  fighter on a platform is slightly behind one below it, as the principle
  intends. Measured by smashcraft:ts/scripts/platformAdvantage.ts (earliest
  first hit from rest, each fighter on a stage 1 side platform with another
  directly below): across the 64 pairs of the 8 selectable fighters at #103's
  landing, the fighter below struck first in 31, level in 10 and later in 23.
  Across the 676 pairs of the 26 selectable fighters at #392's landing, with
  climbs ending aerials at contact, it strikes first in 304, level in 103 and
  later in 269 (60.2% no later; 71.9% before #392, when attacks hit through
  the platform for their whole active frames). Its test requires the fighter
  below to strike no later in at least 60% of pairs.
- Presentation: the climb plays the fighter's ledge-climb clip, the drop and
  descent its ledge-hang clip, each stretched
  over the move (smashcraft:ts/src/game/presentation/fighterClips.ts).

## Grab holds and pummels

Owner direction, 6 Oct 2026 (#101): grabs are legible and never a chore. Melee's
hold grows with the victim's percent, so nobody can tell how many pummels a
grab allows, and every grab invites a pummel chore. Implemented in
smashcraft:ts/src/game/sim/grabs.ts with its values in
smashcraft:ts/src/game/sim/moves.ts:

- **Hold ignores percent.** Every grab holds 120 frames (owner decision, 6 Oct: Ultimate's hold is 90 + 1.7 per percent, about 120 at 18%; Melee's 76 + 1.6 per percent is about 116 at 25%, so 120 matches a typical mid-percent hold).
  Each mash input, a fresh press or a new stick direction as before, takes 8
  frames off (Ultimate's stick value), but no hold ends before frame 30.
- **Only the throw is guaranteed.** A throw input on any of the first 29 held
  frames starts the throw whatever the victim mashes.
- **One pummel, and it is a read.** Every fighter's pummel deals 3% (owner
  decision, 6 Oct 2026) and connects 60 frames
  after its input and lasts 68; a kit authors only its look. Pressed on the
  first held frame, it lands on frame 60. A victim mashing
  8 presses a second from the catch escapes on frame 56, before it, so a realistic mash
  from the start beats it; a slow or absent one takes it.
  Escape frame by mash rate, from the catch (120-frame hold, 8 off per press,
  first press on the first held frame):

  | Presses a second | 4 | 6 | 8 | 10 | 12 | 14 |
  |---|---|---|---|---|---|---|
  | Escape frame | 75 | 64 | 56 | 48 | 45 | 40 |
  | Against the 60-frame pummel | takes it | takes it | escapes | escapes | escapes | escapes |

  After the pummel the grabber throws (a throw pressed during the pummel
  starts when it ends) or the victim goes free.
- **Neutral release.** A mash escape and the release after a pummel leave both
  fighters able to act on the same frame (11 frames later), so a release
  grants no guaranteed follow-up.
- **Escape meter.** Both players see a segmented bar above the held fighter:
  full is the whole hold, it drains each frame and faster with mashing, and
  empty is the escape; its lines split it into 10-frame segments. A mark
  stands as many frames from the empty end as a pummel needs to land: 60
  while the pummel is available, closing in as a started pummel winds up, and
  gone once it has landed. A bar at or short of the mark empties before the
  pummel lands, even without mashing. Implemented in
  smashcraft:ts/src/game/presentation/escapeMeter.ts and
  smashcraft:ts/src/game/ui/escapeMeter.ts.

This departs further than Ultimate, whose hold still scales with percent; see
"Grab hold" in the deviations table.

## Physics foundation

Smashcraft's shared physics follows Melee's NTSC 1.02 rules, as roadmaps #2
and #9 set out, checked against the decompilation and by `bun wisp oracle`
(smashcraft:docs/physics.md). Where Smashcraft departs from Melee, the
departure is a row in the table below, and the oracle reports each departure it
exercises under that row's name; smashcraft:ts/scripts/meleeOracle.tests.ts
checks that every oracle departure names a row here.

## Deviations from Melee

| Mechanic | Melee | Ultimate or others | Smashcraft | Reason | Issue |
|---|---|---|---|---|---|
| L-cancelling | An L, R or Z press within 7 frames before landing halves an aerial's landing lag | Removed from Brawl onward, with more autocancel; kept in Project M and Project+ ([SmashWiki](https://www.ssbwiki.com/L-cancel)) | Removed: every aerial lands with the L-cancelled lag, with no input | Non-interactive execution test, a chore on every aerial with no decision in it | #54 |
| Stale moves and freshness bonuses | Repeats among the last 9 connected moves deal less damage and knockback | Ultimate keeps the 9-move queue, adds a freshness bonus, counts shield hits and weakens the knockback effect ([SmashWiki](https://www.ssbwiki.com/Stale-move_negation)) | None: a repeat deals the same damage and knockback | An over-engineered attempt at move diversity; diversity comes by construction, from move design | decisions 4 and 6 Oct |
| Tap-jump | Stick up jumps, always | Optional from Brawl onward ("Stick Jump" in Ultimate; [SmashWiki](https://www.ssbwiki.com/Tap_jump)) | Removed: stick-up and Space are just "up"; jump is its own button | Jump is its own button (owner, 6 Oct) | #49 |
| Stick deadzone | Each stick axis reads zero within 0.28 of centre, after a radial clamp | not covered here | Melee's deadzone applies to every controller; the value and its decompilation citation are in wc3-controller:README.md ("Fighter layout") | A resting or drifting stick reads neutral | #49 |
| SDI | Each fresh stick movement during hitlag moves the fighter 6 units, as often as every frame ([case study](design/melee/defense.md#influence-on-knockback)) | Weakened in later games ([SmashWiki](https://www.ssbwiki.com/Smash_directional_influence)) | SDI + ASDI travel capped at 12 units per hit (at most 9 SDI) and 24 per uninterrupted string, in steps of at most 3 per tick ([bounded SDI](#bounded-sdi)) | Keep displacement choices useful while bounding visible jumps and repeated-hit travel | #70 |
| Grab hold | 76 + 1.6 frames per percent, minus 1 a frame and 6 per mash input; pummels repeat while held ([case study](design/melee/defense.md#grabs)) | Brawl onward: 90 + 1.7 frames per percent, 8 per stick mash input (14.4 per button in Smash 4 and Ultimate), never under 19 ([SmashWiki](https://www.ssbwiki.com/Grab)). Rivals 2: one pummel per grab, Attack or Special, broken when the victim presses the same button ([FAQ](https://rivals2.com/faq)); a 60-frame hold animation ([workshop](https://rivals2.com/workshop/?p=389)) | 120 frames at any percent; 8 off per mash input, never under 30; one pummel, connecting 60 frames after its input, then a throw or a neutral release ([grab holds](#grab-holds-and-pummels)) | Legible: the same hold every grab, a visible escape meter, no pummel chore; 120 frames matches a typical mid-percent hold (Melee about 116 at 25%, Ultimate about 120 at 18%), owner decision 6 Oct | #101 |
| Horizontal air dodge | The dodge goes where the stick points | – | A horizontal-only digital air dodge angles 18° below horizontal, mirrored, by default and with no toggle | Owner-selected control (30 Sep); the shallow angle keeps horizontal momentum into the landing | – |
| Fast fall | A fresh stick down, diagonals included | – | Down with neutral horizontal input only; down-left and down-right keep drifting | Owner-selected control, 30 Sep | – |
| Air dodge | Directional; ends in helpless fall (FallSpecial) until landing | Ultimate: one directional air dodge per airtime, no helpless fall, refreshed on landing, ledge grab and being hit ([SmashWiki](https://www.ssbwiki.com/Air_dodge)). Rivals of Aether 2: the dodge ends in an ordinary fall ([workshop](https://rivals2.com/workshop/?p=389)) | Once per airtime, ending actionable; refreshed on landing, ledge catch and being hit; spends no jump. Direction and the momentum carried through landing are unchanged | Owner decision, 6 Oct: the air dodge works as in Smash | #100 |
| Air dodge speed | 3.1 Melee units per frame; 0.9 decay | – | 3.4 Melee units per frame, about 9.7% faster; 0.9 decay, 10-frame landing lag, intangibility and per-fighter traction retained | Owner playtest, 9 Oct: slightly stronger air dodges and wavedashes | #347 |
| Shield release lag | 15 frames (GuardOff) | Ultimate: 11 frames | 11 frames; the 8-frame minimum hold and direct shield grab/jump bypass are unchanged | Owner decision, 6 Oct: Melee's lag makes dropping shield almost never worth it; dropping shield should be a real alternative to jumping into an aerial or rolling out of shield. Ultimate's value is the starting point; tune if it still goes unused | #100 |
| Dodge timing | Per fighter | – | One shared profile: spot dodge 22 frames, intangible 2–15; rolls 31, intangible 4–19; air dodge 49, intangible 4–29, landing 10 | Owner's common frame-data profile | – |
| Powershield | A full press within 2 frames of the trigger moving, while raising the shield: a hit in its first 4 frames does no shield damage and pushes back harder, a projectile in its first 2 reflects. The hit's shieldstun is unchanged, and the common +0x2B8 counter (4 frames) only lets attacks and grabs cut the shield drop short (`ftCo_80092F2C`, `ftCo_GuardOff_IASA`, `ftCo_80094138`); a press during shieldstun is ignored (`ftCo_GuardSetOff_IASA` is empty) | Ultimate: release-timed in the first 5 frames of the 11-frame shield drop; any attack skips the drop lag and acts 3 frames sooner than a block against direct hits; no reflection ([SmashWiki](https://www.ssbwiki.com/Perfect_shield)). Rivals 2: a 4-frame perfect shield plus a separate parry, active 6–13, that stuns the attacker 40–100 frames ([Dragdown](https://dragdown.wiki/wiki/RoA2/System_Mechanics/Defense)) | Melee's raise-timed press, but a parry: no shield damage, no shieldstun, no release lag; the whole shield reflects during its 2 reflector frames, not Melee's 0.75 reflector circle (#118); any grounded option on the first frame after the hit's freeze, an option pressed during the freeze buffered into it. One press parries one hit; a red parry re-pressed in shieldstun parries the next hit in a 2-frame window. Ground only ([Powershield and parry](#powershield-and-parry)) | A true parry with a clear reward that stays the player's own choice of punish, after Street Fighter III's parry and red parry (owner, 6 Oct) | #102 |
| Aerial shieldstun | ⌊(0.45 × damage + 2) × 200/201⌋ frames on a full shield, the same for every attack (`ftCo_80092F2C`); 1.425 × damage + 2 on the lightest shield ([case study](design/melee/aerials-on-shield.md#shieldstun)) | Ultimate: ⌊0.8 × damage × 0.33 + 2⌋ for aerials, 0.264 a damage, with shield hitlag × 0.67 ([SmashWiki](https://www.ssbwiki.com/Shieldstun), [hitlag](https://www.ssbwiki.com/Hitlag)). Rivals 2: 0.8 × damage + 1 for every attack, and the input buffer drops to 2 frames after a shield contact ([Dragdown](https://dragdown.wiki/wiki/RoA2/System_Mechanics/Defense)) | Aerials: ⌊(0.6 × damage + 2) × 200/201⌋ (Melee's damage term × 4/3; the same × 4/3 on light shields). Ground attacks, hitlag, pushback and landing lag stay Melee's ([Aerials on shield](#aerials-on-shield)) | Tilt slightly toward aggression from Melee, in Rivals 2's direction rather than Ultimate's; pays back the defender's 6-frame grab buffer, which Melee lacks | #106 |
| Platform ascent | A rising fighter passes up through a platform with no change to its action (mpCheckFloor meets a platform only while descending) | Ultimate passes through the same way ([SmashWiki](https://www.ssbwiki.com/Soft_platform)); Rivals 2 not sourced | A climb over the jump squat ends any aerial with no landing lag; jump or up sustains the rise, down stands, shield shields ([Platforms](#platforms)) | Platforms are contested physically; positions are used, not camped; the climb is a cancel route | #103, #392 |
| Platform descent | A fresh down falls through at once | Ultimate drops through at once ([SmashWiki](https://www.ssbwiki.com/Soft_platform)); Rivals 2 not sourced | A vulnerable descent over the jump squat; falling onto a platform with full down drops through it ending the aerial ([Platforms](#platforms)) | Leaving a platform is a commitment, so sitting on one is slightly disadvantaged; the drop is a cancel route | #103, #392 |
| Platform shield drop | Down while shielding drops through a platform | Removed in Ultimate ([SmashWiki](https://www.ssbwiki.com/Shield_drop)); Project+ keeps it | Removed: down while shielding stays on the platform | Owner (6 Oct): no safe retaliation from a platform; leaving one goes through a descent | #103 |

## Turnaround specials

Tom decided, 7 Oct (delegated) (#187). Reference: Melee's turnaround special
(the stick held back as B is pressed) and B-reverse (a back flick in the
special's first frames turns it and reverses momentum;
[SmashWiki](https://www.ssbwiki.com/B-reverse)); Ultimate and Rivals of Aether 2
keep both, Ultimate with a more lenient B-reverse.

One rule for every fighter, applied before any neutral or side special starts,
airborne or grounded (smashcraft:ts/src/game/sim/specials.ts, `turnForSpecial`):

- A side special faces the side pressed with it, always. No kit keeps its
  facing on a backward press (Lich's Death and Decay lost its 0.9H near
  placement for this).
- A neutral special faces the side the stick last pressed, when that press
  was at most 8 input frames before B (`TURNAROUND_SPECIAL_WINDOW_FRAMES`).
  A flick back, release, then B fires backward; an older press leaves the
  facing alone. Deviation from Melee: the window sits before B rather than in
  the special's first frames, because our controllers read any sideways stick
  on the B press as a side special, so "flick, then B" is how a player asks
  for a turned neutral special. It adds no input delay: nothing waits on it.
- In the air, a side press whose side special is ground-only (Shadow Hunter's
  Serpent Ward, Beastmaster's bear) starts the neutral special, turned to the
  stick, instead of nothing.

Up and down specials keep their own aiming. Momentum is unchanged: no
wavebounce. smashcraft:ts/src/game/sim/turnaroundSpecials.tests.ts holds the
rule over all 13 selectable fighters.

## Controls

- **Tap-jump** (owner, 6 Oct, #49): stick-up and Space are just "up"; jump is
  its own button.
- **Stick deadzone** (owner, 6 Oct, #49): Melee's stick deadzone applies to
  every controller. The value and its decompilation citation are in
  wc3-controller:README.md ("Fighter layout").
- **Digital air dodge and fast fall** (owner-selected, 30 Sep): a
  horizontal-only air dodge angles 18° below horizontal by default, with no
  modifier or toggle; fast fall needs down with neutral horizontal input. The
  implementation is in smashcraft:docs/physics.md, "Default digital wavedash
  and fast-fall directions".
- **Attack inputs** (owner): neutral attack is the jab, attack with a direction
  is a smash, and attack with a direction while holding the walk modifier is a
  tilt (smashcraft:docs/physics.md, "Prototype attack phases").
- **Shared dodge and knockdown timing**: every fighter uses the owner's common
  dodge profile in the table above, and one knockdown profile recorded in
  smashcraft:docs/physics.md, "Grounded knockdown and jab resets", as the
  requested shared profile.

## Fighters

### Expansion roster defaults

Owner decision, 6 October 2026: adopt the 2 October expansion brief as
[the roster specification](design/roster.md). Build Blademaster, Mountain King,
Warden, Lich, Forsaken Paladin, Dreadlord and Shadow Hunter in that order; "shadow shaman"
means Shadow Hunter (Rokhan), and Forsaken Paladin uses the Paladin identity. The eight
Tavern fighters are optional candidates, including Brewmaster; their inclusion
in the specification is not a commitment to ship them.

The specification answers these design questions for the expansion:

| Question | Adopted default |
| --- | --- |
| Physical differences | Use each hero's relative weight, run and air-speed table as initial tuning. The complete candidate table spans weight 0.85–1.28, run 0.80–1.14 and air 0.75–1.22 (of 1.00 Melee units a frame since #190). Jump velocity and gravity initially inherit the reference. |
| Archetypes | State each fighter's purpose and exploitable weakness before building its moves. |
| Meter | 100 mana, full on spawn; normal/throw hits earn 1 per whole percent (12 cap), hits taken earn 1 per 2 whole percent (6 cap), and a perfect shield/parry earns 8. Idle, movement and shielding earn nothing. Specials pay their listed costs; normals/grabs are free; up specials retain free recovery. |
| EX specials | Shield + neutral or side Special spends the normal cost plus 25 mana for one-hit startup armor. See the EX table below. There are no ultimates. Existing per-move cooldowns remain part of each kit. |

### Build-and-spend mana and EX specials

Mana rewards getting into exchanges. A normal or throw earns one point per
whole percent dealt to the body, capped at 12 per contact. Any non-pummel
body hit gives its victim one point per two whole percent actually taken,
capped at 6. A perfect shield or reflected projectile gives eight points
once per parry window. Ordinary shield contacts and pummels earn nothing;
specials do not earn their caster mana. Every gain caps at 100. Stock loss
and rematch restore 100 and clear the spending and armor state.

Idle time, movement and shielding earn nothing; there is no idle refill
(smashcraft:docs/design/mana.md). There is no spending delay. Offense builds the budget faster than waiting;
recovery remains available through the existing free up-special forms.

Hold either Shield and press neutral or side Special to request EX, on the
same frame as an ordinary special. The chord takes priority over a shield,
roll or air dodge, and can leave an actionable shield. It cannot cancel
hitstun, shieldstun, release lag, attacks or other action locks. Up/down
specials and follow-up inputs retain their ordinary behavior. If the chosen
form's cost plus 25 is unaffordable, the same press starts its ordinary
version and pays its ordinary cost; if that is also unaffordable, the
existing refusal applies. Recalls and alternate forms pay their own cost
plus 25. The HUD shows **EX Neutral**, **EX Side**, or **EX Neutral + Side** beside the bar
when that ground/air cast can be paid. The match help names the chord.

Every EX neutral/side has one upgrade: one hit of at most 8% can deal its
damage and hitlag without interrupting the first six action frames. The
armor is consumed by that hit. A larger hit, a throw, a second hit or a hit
after frame six interrupts normally. Existing authored armor is independent.
Startup, contact windows, damage, launch, projectile limits, cooldowns,
landing lag and recovery keep their ordinary values. Thus spacing, grabs
and delayed attacks still punish the commitment; no move gains a cinematic
pause or an invulnerable reversal. The shared upgrade makes the extra cost
readable while the existing kits supply the different rewards and risks.

Ground entry costs below include the extra 25; air, recall and marked
forms use their authored normal cost plus 25. The shared rule applies to
every newly registered fighter too.

| Fighter | EX neutral (mana) | EX side (mana) | Upgrade on both |
|---|---|---|---|
| Rifleman | Blaster (28) | Bear (50) | One 8% hit armored on frames 1–6 |
| Illidan | Mana Burn (35) | Fel Rush (37) | One 8% hit armored on frames 1–6 |
| Blademaster | Wind Cutter (25) | Wind Walk (43) | One 8% hit armored on frames 1–6 |
| Mountain King | Storm Bolt (33) | Storm Rush (43) | One 8% hit armored on frames 1–6 |
| Warden | Shadow Strike (30) | Shadow Pursuit (40) | One 8% hit armored on frames 1–6 |
| Lich | Frost Nova (35) | Death and Decay (50) | One 8% hit armored on frames 1–6 |
| Forsaken Paladin | Cleansing Hammer (35) | Righteous Fury (50) | One 8% hit armored on frames 1–6 |
| Dreadlord | Carrion Swarm (30) | Vampiric Pounce (45) | One 8% hit armored on frames 1–6 |
| Shadow Hunter | Spirit Glaive (25) | Serpent Ward (45) | One 8% hit armored on frames 1–6 |
| Pit Lord | Howl of Terror (37) | Ruin Charge (47) | One 8% hit armored on frames 1–6 |
| Beastmaster | Wild Axes (25) | Summon Bear (45) | One 8% hit armored on frames 1–6 |
| Lich King | Howling Blast (40) | Val'kyr Shadowguard (45) | One 8% hit armored on frames 1–6 |
| Thrall | Chain Lightning (35) | Feral Spirit (43) | One 8% hit armored on frames 1–6 |
| Jaina Proudmoore | Frostbolt (31) | Blizzard (43) | One 8% hit armored on frames 1–6 |
| Sylvanas Windrunner | Black Arrow (33) | Silence (45) | One 8% hit armored on frames 1–6 |
| Cairne Bloodhoof | Shockwave (40) | War Stomp (45) | One 8% hit armored on frames 1–6 |
| Chen Stormstout | Breath of Fire (35) | Drunken Haze (37) | One 8% hit armored on frames 1–6 |
| Peon | Lumber Toss (25) | Burrow (45) | One 8% hit armored on frames 1–6 |
| Goblin Tinker | Cluster Rockets (35) | Pocket Factory (45) | One 8% hit armored on frames 1–6 |
| Kael'thas Sunstrider | Flamestrike (45) | Drain Mana (30) | One 8% hit armored on frames 1–6 |
| Murloc | Ensnare (35) | Tidal Rush (35) | One 8% hit armored on frames 1–6 |

Prior art informs the decision, not these original numbers:
[Capcom's EX manual](https://game.capcom.com/manual/sfv/en-us/page.html?cat=2&subcat=2)
establishes spending a gauge on a stronger ordinary special;
[Capcom's EX Pac-Dash](https://game.capcom.com/manual/sfxtk/en-UK/page-44.html)
is an explicit example of a one-hit armored EX.
[Street Fighter 6's Drive](https://news.capcomusa.com/2022/06/02/street-fighter-6-redefines-the-genre-in-2023/)
keeps the budget shared between offensive and defensive choices; Smashcraft
uses its existing mana instead of adding another gauge.
[Rivals' roster](https://rivalsofaether.com/characters/) shows different
special decisions built from elemental setups, while its
[Shovel Knight update](https://rivalsofaether.com/patch-1-4-0-for-shovelry/)
illustrates authored armor windows rather than universal invulnerability.
[Guilty Gear's official guide](https://www.arcsystemworks.jp/guiltygear/img/playguide-en.pdf)
rewards Instant Block with extra Tension; that supports paying precise
defense here. The rejected alternative was one-button ultimates with idle
refill: saving for a single large event would replace the exchange-by-exchange
choice between an ordinary special and an armored commitment.
| Disjoints | Weapon extensions only; attached body parts keep hurtboxes. |
| Throw escape | Mashing; retain the existing escape system and use the brief's fallback only where none exists. |
| Simultaneous grabs | Both break, with symmetric separation and 12 frames of recovery. |
| Regrabs | Today's #85 throw-hitstun restriction, including remaining hitstun after gentle landing; no fixed 45-frame timer. |

These are expansion defaults and authored starting values, not claims that the
existing three fighters have already changed. Preserve existing fighters and
the infrastructure finish line when integrating new gameplay.

- **Rifleman's trap escape** (delegated choice, 6 Oct 2026, #84): keep the
  single 300-frame freeze, then prevent any trap from catching that fighter
  until 20 frames after thaw. A hit that breaks ice grants the same interval.
  This covers the accepted 15-frame response floor plus the longest current
  five-frame jump squat: a jump chosen 15 frames after thaw leaves the ground
  before a waiting trap can spring. The trade-off is that Rifleman can still
  cover the escape with another move, and an idle fighter can be caught again
  when the interval expires. This is trap immunity, not protection from damage.
- **Mashing out of a freeze** (owner direction, 7 Oct 2026, #114: "wiggle out
  of the frost trap"): a frozen fighter mashes out with the grab hold's rule
  and code (smashcraft:ts/src/game/sim/mash.ts). Each frame, a fresh press of
  attack, special, jump, grab or a shield button counts once and a new stick
  direction once more; each takes 8 frames off the 300-frame freeze, but
  mashing never thaws it before frame 60, so a trap sprung near Rifleman still
  gives him a follow-up. Holding a button or a direction counts only on its
  first frame. Melee's freeze runs its grab-mash routine on its own timer the
  same way (`ftCo_DamageIce_Anim`, melee:src/melee/ft/kinds/ftCommon/ftCo_DamageIce.c).
  The thaw frame, from the freeze, by presses a second (first on frame 1):

  | Mash | none | 4 | 8 | 12 | 8 + 8 stick flips | 14 + 14 stick flips |
  |---|---|---|---|---|---|---|
  | Thaw frame | 300 | 195 | 143 | 115 | 92 | 61 |

  The escape meter shows over a frozen fighter too: full is the 300-frame
  freeze (its 12 segments are 25 frames each) and empty is the thaw. A frozen
  computer presses 10 times a second and thaws on frame 131.

## Historical character trade-offs and move evaluation

Evaluation model selected under the owner's authorization, 6 Oct 2026 (#62).
Use the current Rifleman and Illidan, with jab, down tilt, forward smash,
forward air and down air as the first sample. The numerical baseline is
smashcraft:tools/move-data/gameplay-model.json, derived from the published
move exports, contextual comparisons, interaction graph and retained bot data;
it is an analysis artifact, never gameplay tuning input.

### Numerical identities

These are authored values at d1971253, rounded for display. Run and air speed
are world units per frame. Reach below is the hit capsule's forward extent
relative to its fighter, before adding the opponent's hurt capsule; it is not
an effective range or a guaranteed connection. All three have a 4-frame,
5-damage jab, with 21 unpaused frames total. Down tilt starts on frame 5 and
lasts 28 frames; forward smash starts on 6 and lasts 36.

| Fighter | Weight | Run / air speed | Jump squat | Down tilt damage / reach | Forward smash damage / reach | Down air active frames |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rifleman | 80 | 9.00 / 4.98 | 5 | 10 / 145 | 18 / 121 | 3 |
| Illidan | 80 | 11.10 / 5.28 | 4 | 7 / 115 | 15 / 171 | 3 |

Historical fixture before #339: Archer pays for the fastest run and jump start with the lowest weight.
Rifleman's down tilt pays more damage at Archer's timing and reach, while his
run is slower and jump start later. Illidan's forward smash reaches farther
but deals less, and his down tilt gives up both damage and reach; his air speed
is highest. These are the strengths and costs to preserve or deliberately
replace when authoring the fighters' original volumes and animations.

### Model and provisional targets

Evaluate a move in a named situation: fighter and opponent, stage, spacing,
percent, grounded/airborne state, timing, and DI/defensive policy. The definitions
of frame advantage, reachable punishment and weighted choices come from
[fighting-game design](design/fighting-games.md#frame-advantage-safety-and-punishes)
and the [interaction graph](design/platform-fighters.md#the-interaction-graph).

- **Option count N:** group inputs by their ordered outcome against every
  tested response (winner, hit/grab/none, blocked). Count distinct groups;
  keep timing and damage alongside them. The neutral mirror fixtures offer
  13 inputs each, but N is 8 at distance 60 for all three, and 6/6/7 at 120
  for Rifleman/Illidan. This is a coarse sampled distinction, not a
  count of all strategic choices. Provisional target: at least three distinct
  patterns in each ordinary neutral sample, with each attacking choice denied
  by a reachable block, evasion or counter in that named situation.
- **Punish window P:** retain the exact set of start frames that land before
  the target can act, and its longest contiguous interval. Do not turn holes
  into a continuous window or infer a punish from negative advantage alone.
  Close advancing down air is -8/-10/-8 in the three mirror fixtures; jump
  neutral air and jump back air each punish from frames 12 and 13. Spaced
  fade-back forward air is -2 for all three and has no tested reachable punish.
  Of the 30 aerial/shield variants per fighter, 19/19/20 have no tested punish.
  Preserve the spacing-dependent safe/unsafe distinction rather than making
  every aerial uniformly safe or unsafe.
- **Reward and risk:** use direct damage R on a successful named hit and
  damage C from a specified reachable punish, then report R/C and the binary
  break-even success probability C/(R+C). Keep stock loss, follow-up situation
  and escape choices separate; do not convert them into invented damage points.
  If no tested punish reaches, C and the ratio are unknown, not zero/infinity.
  Provisional target: extra reward pays in an observed cost (commitment,
  exposure, fewer safe spacings or a stronger punish), not merely a slower
  number whose consequence no opponent can exploit.

In the grounded first-active, spacing-60, 0% contact fixture against Rifleman,
Illidan's forward smash deals 15 and is -6 at the normal-action gate after
shield release. An approaching Rifleman jab starts at 32 and hits at 36 before
Illidan acts at 37: a 5-damage cost, R/C = 3, break-even 25% for precisely that
binary branch. Rifleman deal 18 and are -4; no tested jab reaches
before recovery, so their ratios remain unknown. These comparisons are not
the mirror fixture's earliest out-of-shield gate or a full payoff matrix.

### Predictions and the role of bots

Historical fixture before #339: The existing fixtures make three falsifiable predictions for this sample:
Archer's long-active down air remains punishable at close advancing spacing
while his spaced fade-back forward air is safe against the tested responses;
Rifleman's stronger down tilt produces 18 hitstun frames against weight 100
versus Archer's 17 at the same timing and reach; Illidan's longer-reaching
forward smash still permits the specified shield-release jab punish. Evaluate
any proposed change against these named rows with the existing move and
interaction commands, then retain its before/after effect on N, P and R/C.

The retained post-down-tilt 540-match bot run supplies historical context:
CPU-versus-fuzz wins were 118/120, 120/120 and 116/120, and damage per landed
hit 8.86, 7.03 and 8.32 for Rifleman and Illidan. Repeated deterministic
CPU setups are not independent samples. The Rifleman change moved 118 to 120
wins, while two unrelated fuzz matches also changed; that run did not resolve
a balance effect. Its policy, stages and revision are named in
smashcraft:evidence/rifleman-down-tilt-20261006/README.md. Later gameplay changes
mean these are historical observations, not present balance, human win odds,
or a complete formula for fun. A playable change and its relevant bot/geometry
measurement remain the acceptance work in #62 after #61.

## Stale moves and freshness bonuses

Smashcraft deliberately has neither stale-move penalties nor freshness bonuses.
Repeating a move does not reduce its damage or knockback parameters, and using
a different move does not grant a damage bonus.

Attack-history penalties add inconsistency without improving the intended
combat decisions. Repetitive play should be punishable through startup and
recovery, spacing, commitment, defensive options, and opponent counterplay. If
a move is too effective when repeated, improve those interactions instead of
adding a hidden repetition penalty. Move outcomes should remain predictable
under the same combat conditions; victim percent, weight, hit region, and
other explicit mechanics still affect the result.

This is an intentional departure from Melee, not a missing feature.

Owner decision reaffirmed 2026-10-04: **skip Melee's stale-move mechanic**,
including its freshness bonus, for the physics foundation and subsequent
character balancing. Do not implement a recent-move queue, history-based damage
or knockback multipliers, or projectile staleness snapshots. This omission is
accepted scope, not a fidelity defect or a deferred implementation task.
Independent Melee comparisons must state that this modifier is omitted; all
other shared formula requirements remain open until verified.

Reaffirmed by the owner 2026-10-06: stale moves are an over-engineered attempt
to create move diversity. Diversity should come by construction, from move
design (how each move's hitboxes, startup, recovery and rewards work), not from
a bolted-on physics rule that rescales damage behind the player's back.

## L-cancelling

Non-interactive execution is dubious. Smash's execution tests are meant to be
interactive: they reward anticipating and reading the opponent's responses to
your actions. Part of Smash's appeal as an alternative to traditional fighters
is that its most complex execution is an interaction with the opponent, not a
single-player flowchart. L-cancelling is a single-player execution test that
involves no opponent, which is why it is a bad idea.

L-cancelling asks for a thoughtless input on every aerial. It is a persistent
chore that tires players' hands and adds an arbitrary execution test with no
benefit. The game's depth belongs in mechanics with real decisions: combo
follow-ups, directional influence and aerial drift.

Every aerial therefore lands with Melee's L-cancelled landing lag, automatically:
half its authored landing lag, at least one frame (Melee's PlCo +0x0E8 = 2). No
button shortens or lengthens it, and there is no L-cancel input, window or state.
Empty and air-dodge landings keep their own lag.

This is an intentional departure from Melee, not a missing feature.

Owner decision 2026-10-06 (#54): **remove L-cancelling**. This omission is
accepted scope, not a fidelity defect or a deferred implementation task.
Independent Melee comparisons, including `bun wisp oracle`, must state that
L-cancelling is omitted.

## Computer opponent

The computer (smashcraft:ts/src/game/match/botPlay.ts and its bot*.ts
siblings) plays inside the synchronized simulation: each frame it reads the
match and writes its fighter's controls and attack commands, as a player's
input row would, so every client and every rollback replay derives the same
decisions. The replayed runtime keeps attack pauses, a bounded history of
visible opponent observations and horizontal direction commitments. Level 9
uses observations from 12 frames earlier (200 ms); lower tiers wait longer
(smashcraft:docs/design/cpu-profiles.md). It holds a horizontal choice for five
frames before reversing, while its own legality, damage and recovery remain
immediate. Each choice that looks random is
`botChoice`, a nonlinear hash of whole numbers from the match (the frame,
attack and grab serials, hits taken, the truncated percent) whose squares
stay inside 32-bit integers, so Bun and Warcraft's Lua compute it alike.

- It never steers its fighter past the point where it could still stop on
  the main deck: on the ground and in the air it compares where the fighter
  would come to rest, braking at traction or air acceleration, with the
  deck's edges less 40 units, and turns back when that point would pass them.
  A ground attack starts only if the slide it leaves ends on the deck it
  stands on, and specials that move it (Parry Step) only with room
  to land.
- At advanced and expert (#392) it uses platforms as cancels: it climbs on
  toward a target in the air above, drops through with full down to reach a target below, and starts no aerial
  that a climb would end before its strike. Lower tiers stand on every
  platform they climb.
- It attacks with whatever reaches: each move's strike at its first active
  frame, from the authored hit regions and contact capsules, against the
  target where both will be by then. Specials join when they suit the
  distance; shots, the homing arrow and the bear from range. A 40-frame plan
  weighs ground pressure, jumping in with aerials, or keeping away and
  shooting.
- It shields, spot dodges, rolls or (Illidan) parries some strikes, shots,
  Immolations and bear swipes, one choice per threat, and lets others land.
- Knocked down it gets up: with the target in reach mostly a get-up attack,
  otherwise a stand, a roll or a short wait; one tumble landing in three it
  misses the tech. It never lies still under jab resets.
- Off the stage it returns to the deck or, facing a free ledge, falls onto
  the ledge and climbs, rolls, jumps or attacks from it.

### Fighter gameplans

A fighter may declare a `FighterGameplan` (smashcraft:ts/src/game/sim/gameplan.ts)
next to its kit: a hero in its `HeroDefinition.gameplan`, an original fighter
in smashcraft:ts/src/game/sim/originalGameplans.ts. Its computer then plays it
(smashcraft:ts/src/game/match/botGameplan.ts); one without a gameplan plays
as above. Moves are attack styles (aerials by their own style, the dash
attack as `dashAttack`), `GameplanSpecial` or `GameplanThrow`.

- **Plan.** Each 40-frame stretch it either keeps its preferred range (weight
  2, or 1 when it avoids long range) or follows one of its approach options
  (run, jump or shoot, each by its weight, default 1).
- **Position.** Keeping range, it stands a gap in its band away, on its own
  side of the target, and short-hops when a spacing aerial's band holds the
  gap. Running or jumping in it closes fully, or to the near end of its band
  when it avoids close range; shooting keeps the far end. Avoiding `below`, it
  keeps its range instead of standing under a target overhead and never jumps
  into one; avoiding `edge`, its spot stays 160 units inside the deck; avoiding
  `air`, it never plans to jump in; avoiding `above`, it never jumps in over a
  grounded target. A grounded target's raised shield draws it in to grab it,
  unless it avoids `close` (then its spacing tools pressure the shield). A
  target standing on another deck, more than 110 units above or below, is out
  of reach from anywhere else: every plan heads under or over it and jumps up
  or drops through to that deck, whatever it avoids (#160).
- **Moves.** Of the moves in reach, an unnamed one weighs 1. A spacing tool
  at its spacing weighs 4; a move of the approach in force 3; a combo starter
  2 in neutral; a follow-up 4 while the fighter's own hit stuns the target;
  a finisher 6 inside its percent window. The factors multiply. Every attack
  waits for its reach, read where both fighters will be on its first active
  frame: a fall or jump slowed by gravity and held by the deck it lands on,
  the attacker's run cut to a short slide, an aerial that would land first
  left out (#160). Specials with a purpose at range (projectiles, traps,
  summons) are the exception, and a ground spacing tool at its spacing may
  wall off a target level with it and at most 30 units past its reach.
- **Defense, grabs, recovery.** A threat it answers (7 in 10, as before) gets
  one of its listed answers: shield, spot dodge, roll, its stance special,
  jump or retreat; at the edge a roll, shield or retreat becomes a spot
  dodge. Holding a grab it throws for the kill inside a throw finisher's
  window, else into a throw combo starter. Its route back aims always for the
  ledge, always for the deck or either, and spends its up special before or
  after its jump.

The gameplan is static kit data. Snapshots and replays also retain the
computer's delayed observations and direction commitments.

The 540-match `--policy cpu` soak checks this behaviour: departures,
self-destructs, time-outs and the moves that landed
(smashcraft:ts/scripts/soakOutcomes.ts summarizes them).

## Execution and reaction windows (#69)

Adopted 6 Oct 2026 under the owner's instruction to carry out the proposed
recommendations. These are delegated design choices, not quotations from the
owner. Evidence and its limitations are in
[execution windows](design/execution-windows.md). Bounds are design constraints,
not claims that these timings guarantee human reaction on every setup.

| Window type | Lower | Upper | Today |
|---|---|---|---|
| Reaction-based option (responder must see a cue, then act) | 15 frames from the cue, for one option | about 25 at four options | not measured |
| Tech (defensive press before contact) | 11 | 20 | 20 |
| Tech lockout between presses | 20 | 40 | 40 |
| Input buffer | 4 | 10 | 6 |
| Offensive link or follow-up | 3 | none beyond the move's own timing | no required links |
| Jump squat; short-hop release window | 3 | 5 | 3 and 5 |
| Parry active window (counter specials) | 6 | 10 | none: no fighter authors a counter |
| Powershield input window | 2 | 4 | 2 |
| Red parry (re-press in shieldstun) | 2 | 4 | 2 |
| Ledge intangibility | 30 | 37 | 30 on the first grab, then 22, 14, 6, 0 |
| Ledge regrab lock | 30 | 60 | 30 |
| Ledge hang limit | by time | by time | 300 frames |
| Any required precision input with no aid | 3 | n/a | L-cancel removed |

The reaction figures are authoring targets: at least 15 frames from the first
visible cue for one response, about 25 for four choices. The latter is a chosen
budget, not a measured Hick coefficient or a hard maximum on readable cues.
Required links and unaided precision inputs need at least 3 accepted frames;
there is no mandatory one-frame input in ordinary play. Optional optimizations
may be tighter. A powershield is such an optional reward, not required defence.
Longer delays need a stated gameplay reason rather than automatic rejection.
The 20-frame tech-lockout floor and 60-frame regrab ceiling are chosen bounds,
not empirical limits.

The oracle checks the shipped tech, lockout, attack buffer, jump squat and
short-hop release, parry, powershield, red parry and ledge windows against
these ranges. Interaction timing checks apply the reaction, required-link and
precision rules to authored situations. No current move is designated a
required link or guaranteed reaction option; the graph's existence of a punish
is not a claim that a human can react to it.

## Shared mechanic defaults

Delegated choices, 6 Oct 2026 (#62): the owner authorized carrying out the
recommended defaults without another approval round. The remaining questions
from the descriptive references are resolved below. Existing explicit owner
decisions, the expansion roster contract and the #85 throw-hitstun rule take
precedence over older proposals. These are authoring defaults; recording one
does not imply its implementation or balance has been checked.

### Attack geometry and commitment

The descriptive basis is [fighting-game language](design/fighting-games.md),
[platform-fighter language](design/platform-fighters.md) and
[Melee's attacks](design/melee/attacks.md).

| Question | Adopted default | Reason |
|---|---|---|
| Attack hurtboxes and fidelity | Author deterministic per-frame body volumes from the verified animation pose, including extended limbs during startup, active frames and recovery. Weapons can extend without a hurtbox; attached hands, feet, wings and tails cannot. | Make visible exposure and whiff punishment agree; implements #62's animated-hurtbox direction and the roster's weapon-only disjoints. |
| Hitbox generosity | Match the visible strike's path and outer extent. Use its authored capsule thickness, without an extra invisible range bonus or a solid volume filling an entire swing. | Spacing must be readable; the roster already states this geometry contract. |
| Disjoint cost | Keep weapon-only disjoints. Pay for extra effective reach with an observable cost in commitment, body exposure, safe spacing or punishability; do not require one universal startup tax. | Reach matters through whole interactions, as the character-evaluation model above measures. |
| Counter hits | No new universal bonus for hitting startup. Preserve explicitly authored vulnerabilities, including the existing interrupted-smash-charge modifier. | Predictable move outcomes; no random critical hits or hidden universal damage layer. |
| Knockdowns | Ordinary knockdowns retain tech or missed-tech/get-up choices. Authored forced states, such as jab-reset stand and freeze, remain explicitly marked by the locked-state signal. | Preserve real defensive choices without pretending that a forced interval can be escaped. |
| Invincible reversals | No universal action that clears hitstun or knockdown. A kit can have stated armor or intangible frames after its action becomes legal, with punishable failed commitment; keep the roster's defensive limits. | A defensive read can have value without bypassing the opponent's earned hit. |
| Same-frame strikes and clanking | Resolve valid fighter strikes symmetrically as trades from the same pre-contact state. Add no universal 9%-difference clank rule; any move-specific clash or projectile interaction must be explicit. | Preserve the established simultaneous-contact model instead of adding an unseen priority system. |
| Grab versus strike; mutual grabs | Preserve the existing grab-over-strike contact priority. Mutual grabs break symmetrically, with the roster's 12-frame recovery. Throw-hitstun regrabs remain forbidden by #85. | Make the interaction deterministic and retain the adopted throw counterplay. |
| Throw defence | Existing mash escape; no new timed throw-tech input. Once an immediate throw has started, only the release-frame DI choice remains, as the locked-state signal explains. | The expansion contract preserves the existing escape system and true throw-to-strike follow-ups. |
| Grab hold and pummel | Every hold lasts 120 frames at any percent; each mash input takes 8 off, never below 30. One 3% pummel per grab, connecting 60 frames after its input; then a throw (bufferable) or a neutral release. Both players see the escape meter above the held fighter ([grab holds](#grab-holds-and-pummels)). | Owner direction (#101): the throw is the guarantee, the pummel a visible read, and no grab is a chore. |
| Option selects | Keep combinations that retain commitment and an opponent answer. Repair a specific option select when it removes both branches' counterplay for free; no blanket ban on emergent input combinations. | Judge the actual interaction, not the mere existence of a multi-purpose input. |
| Mixup branch reward | Each intended branch must offer a meaningful different result or punish. Use its measured reward/risk and break-even probability; no universal damage floor for the weaker branch. | A position, escape or stock threat can matter without an invented damage-equivalent score. |
| Balance changes and archetypes | State each fighter's purpose and exploitable weakness, then adjust the evidenced interaction with buffs or nerfs as needed. No buff-first rule or universal "no 7–3" numerical promise. | Preserves the adopted roster identities and the current bounded evaluation model. |

### Shields and defence

| Question | Adopted default | Reason |
|---|---|---|
| Shield geometry | Keep the shrinking bubble (confirmed by #102): it drains while held (0.28 health a frame digitally), regenerates once lowered (0.07 a frame), and its radius scales with health (0.15 + 0.85 × health/60 × pressure scale), so a worn shield exposes the body to a projectile passing outside it. Melee contacts on a raised shield are all blocked; melee pokes are not modelled yet. Preserve the authored shield centre and current input handling; add no required shield-tilt input. | Keep the established shield system and visible body exposure rather than replacing it with a fixed bubble. |
| Aerial shieldstun | Superseded (owner, 6 Oct, #106): aerials take a third more shieldstun per damage than Melee, 0.6 rather than 0.45 a damage on a full shield; ground attacks keep Melee's ([Aerials on shield](#aerials-on-shield)). | Aerial safety still varies through contact timing, landing, spacing and drift; the tilt rewards aggression slightly without making any aerial safe by rule. |
| Whiff penalties | No global extra miss-only recovery or landing-lag multiplier. Author commitment and recovery per move. | Counterplay should follow the same visible move phases whether the strike connects or misses. |
| Ground moves on shield | Close committed moves should have reachable punishment; spaced pokes may be safe. In the same shield-contact context, greater shield damage costs later attacker recovery or an earlier defender response. | Adopts smashcraft:docs/move-comparisons.md's measured category rule without changing its gate; it is not a global damage-to-lag formula. |
| Aerials on shield | Safety is earned by timing, spacing, side and the move's own properties, never granted by rule ([Aerials on shield](#aerials-on-shield), #106). | The graph shows the spread: late and low, spaced and cross-up aerials safe or close; early and high hits in front punished out of shield. |
| Shield release and out-of-shield actions | Owner decision (6 Oct, #100): 11-frame release lag, Ultimate's value, with the 8-frame minimum shield hold. Direct shield grab and jump bypass release lag when otherwise legal; jump into aerials, rolls and spot dodges remain available. Add no instant grounded up-smash cancel. | Melee's 15 frames make dropping shield almost never worth it; dropping shield should be a real alternative to jumping into an aerial or rolling out of shield. Tune later if it is still never used. Shieldstun and other action locks still apply. |
| Platform shield drop | Removed (owner, 6 Oct, #103): down while shielding stays on the platform. Leaving a platform goes through a [platform descent](#platforms); shielded fighters use their jump, dodge or release choices. | Superseded: no safe retaliation from a platform, so a fighter on one is slightly behind one below. |
| Cross-ups | Coverage follows each move's authored front/back regions and legal facing change. No automatic tracking or universal behind-the-fighter hit extension. | A cross-up changes which responses reach; the answer comes from the move, not hidden target tracking. |
| Powershield and dedicated parry | The raise-timed powershield, with the accepted 2-frame input window and its projectile reflection, is a true parry: no shieldstun and no release lag, any grounded option on the first frame after the hit's freeze ([Powershield and parry](#powershield-and-parry), #102). Ground only. Counters stay per-fighter specials; add no universal parry button or release-timed replacement. | One shared, learnable timing whose reward is the defender's own punish, kept apart from the committal counters a kit can author. |

### Movement, recovery and resources

| Question | Adopted default | Reason |
|---|---|---|
| Air dodge | Owner decision (6 Oct, #100): one directional air dodge per airtime with the shared frame profile. It ends actionable, not in helpless fall, and spends no jump; landing, catching a ledge and being hit refresh it. | Works as in Smash; once per airtime still prevents repeated free dodges, and wavedash movement is unchanged. |
| Wavedash and waveland | Keep air-dodge momentum through landing and the 10-frame dodge landing lag, including the owner-selected shallow digital angle. | An interactive movement option, unlike the removed L-cancel chore. |
| Offstage air-dodge buffering | Do not add a general held-input air-dodge buffer. Retain fresh dodge presses and the deliberate dodge press queued during jump squat; a fresh offstage press still works when legal. | Avoid accidental automatic dodges while preserving explicit player commands. |
| Platforms | Climbs, drops and descents last the fighter's jump squat, end any aerial and leave it vulnerable; intent is the stick's depth toward the platform; no shield drop ([Platforms](#platforms)). | Positions are used, not camped (owner, 6 Oct, #103). |
| Short hop and jump squat | Keep release-during-squat short hops, without a jump+attack macro or a new mandatory binding. Jump squat remains per fighter within #69's 3–5 frames: Rifleman 5, Illidan 4. | Preserves current controls and physical differences inside the accepted execution bounds. |
| Input buffer and priority | Keep the 6-frame human attack grace. Same-frame attack requests prefer grab, unchargeable C-stick smash, chargeable smash, tilt, then the established style ordering; conflicting equal requests leave facing neutral. Existing action locks and fresh-input rules remain authoritative. | Deterministic input intent without a new universal hold buffer or callback-order priority. |
| Right stick with Tilt | A C-stick press while Tilt is held makes the matching tilt on the ground and the matching aerial in the air. Tom's pad layout holds Tilt with every right-stick deflection, so its right stick tilts and throws aerials; the default layout's right stick smashes. | Tom's decision for his pad profile, without widening the 18-action input wire. |
| Wall movement | Keep existing wall tech and authored wall-jump eligibility. No wall climbing or free refresh of jumps, recovery specials or ledge protection. | Movement should respect the visible stage walls without granting an unlimited recovery loop. |
| Ledges | Keep exclusive occupancy/edgehogging, first-grab catch intangibility of 30 frames (shrinking by 8 per regrab until the stage is touched, #386) and the 30-frame regrab lock. No trump or extra two-frame catch vulnerability. | Retains the current Melee-derived ledge system within #69's accepted bounds. |
| DI, crouch and ASDI | Retain 18° maximum continuous DI rotation, crouch cancelling and ASDI-down landing behaviour. SDI/ASDI travel uses the selected bounded-SDI design when #70 is implemented. | Keep useful defensive positioning while addressing teleport distance at its chosen seam. |
| Tech chases and platforms | Preserve current floor-tech and tech-roll timing on the surface actually contacted; pass-through platforms catch from above and do not become walls or ceilings. Extensions can require reads; only call a response reaction-based when its visible cue meets #69's budget. | Gives platforms a real escape/landing role and supports the short-combo, chained-read direction without promising a guaranteed human reaction chase. |
| Launchers and recovery routes | Each fighter has at least one deliberate launcher into a juggle, tech chase or ledge situation and at least two meaningfully different recovery choices through path, drift, ledge/stage destination or timing. A second recovery special is not required. | Makes follow-up reads and offstage counterplay part of each kit; the roster already requires a weaker free recovery. |
| Physical spread and dash dancing | Keep existing per-fighter gravity, fall/air/run speed and weight; the authored dash window and stick tolerance follow [Dash dancing](#dash-dancing). Expansion fighters use the adopted relative-property table as starting tuning, with reference jump velocity/gravity until deliberately authored otherwise. | No forced common weight/speed profile and no heavy-must-be-slow rule; each strength needs its stated cost. |
| Rage, meter and cooldowns | No percent-dependent rage bonus. Build-and-spend mana, EX neutral/side specials and free recovery use the adopted roster contract. There are no ultimates or new common cooldowns. | Predictable knockback and explicit resources, consistent with the removed stale/freshness layer and adopted expansion defaults. |
| Interaction-graph requirements | Use the existing contextual option-count, reachable-punish and reward/risk model above, plus #83's accepted combo targets. Keep distinct defensive answers in ordinary neutral; do not impose one payoff ratio or option count on every forced state. | A locked interval can be honest, while an ordinary neutral option needs a reachable counter. The measured sample is not a guarantee about every matchup. |

## Stage defaults

Delegated choices, 6 Oct 2026 (#75), reconciling the owner's stage direction,
the [stage research](design/stages.md) and the published themed catalog.
Tournament labels below are a proposed competitive preset, not a claim of
external tournament adoption or proven matchup balance.

| Question | Adopted default | Reason |
|---|---|---|
| Flat stage | Keep Sky Deck accessible as the clearly labelled test/practice tile after the eight themed stages; exclude it from the ranked competitive list. | Matches the owner's testing use without promoting the flat arena as the default competitive choice. |
| Moving platforms | Their deterministic movement remains enabled in competitive play. | The owner explicitly welcomes drifting and independently patrolling platforms. |
| Starters and counterpicks | Start with Frozen Throne, Hellfire Citadel, Durotar Skies and Naxxramas; use Nordrassil, Gryphon Aerie, Blackrock and Ahn'Qiraj as counterpicks. | Stable or broadly familiar layouts lead; wind, tight carried-platform play, cannon recovery and timed platform relief provide deliberate matchup variation. |
| Static versus hazardous | Keep both. Frozen Throne and Hellfire Citadel are mechanically static; blizzard, embers and background motion are cosmetic. | The owner asks for light learned hazards, not a hazard on every stage. |
| Hazard effects | No incidental hazard damage. Wind and platforms can move fighters; Blackrock's readable recovery cannon can launch them. Fixed schedules and visible routes remain learnable. | Preserves the requested wind, Randall-like platform and barrel without random chip damage. |
| Blast zones and size | Use the published #80 per-stage bounds; keep new competitive layouts within the researched Melee legal size band as a starting point. Keep Blackrock's cannon on its normal-size deck, not Kongo Jungle's oversized camping layout. | The earlier overly tight blast zones are superseded; legal-band dimensions are a starting design choice, not proof of competitive balance. |
| Race/theme spread | Keep Hellfire Citadel, the Burning Legion stage, in place of Ring of Valor. Preserve Frozen Throne and representation for Human, Orc and Night Elf alongside Scourge and raid themes. | Adopts the research's variety recommendation and the already published catalog; no additional Naga stage is required. |
| Graphics | Support the installed classic-graphics clients with available classic models/skies and authored effects. HD-only scenery is optional future art, never required for these stages to read correctly. | The actual test clients must see the intended arena. |
| Ahn'Qiraj platform art | Keep the authored rising platform in a Qiraji/Obsidian Statue scene. Do not describe a built-in substitute as a tentacle; a bespoke animated tentacle is not required for the current platform mechanic. | The research found no available tentacle model; the current themed platform gives an honest supported default. |
| Competitive list size | Eight themed stages, in the published order: Frozen Throne, Nordrassil, Gryphon Aerie, Durotar Skies, Naxxramas, Hellfire Citadel, Blackrock, Ahn'Qiraj. | Fits the owner's 5–8-stage scope and the accepted variety proposal. |

## Hit presentation

Recommended defaults adopted under Tom's 6 Oct 2026 instruction to do all
recommended work (#82), rather than recorded as independently chosen by Tom:

- Warcraft's stock spell and impact art carries Melee's event vocabulary;
  the descriptive mapping is in smashcraft:docs/design/melee/hit-effects.md.
  Demon Hunter melee contacts use Cleave, Immolation uses fire and
  Mana Burn uses lightning; those element choices change presentation only.
- Strength has three sizes (0.75, 1.0, 1.25), at knockback 80 and 180.
  The upper threshold follows Melee's strong normal spark; 80 and the sizes
  are authored readability defaults. No random extra spark obscures strength.
- Damage lightly colours the victim by element through hitlag and hitstun;
  hitlag vibrates its body by 2 world units, 3 for electric; the camera stays
  steady. Freeze retains blue. Shield contact compresses and rebounds the
  bubble through hitlag and shieldstun, with a warm hue and a 6-unit recoil
  away from contact; the held bubble returns as soon as shieldstun ends.
  These are bounded Warcraft approximations, not Melee's colour programs.
- Walk steps are quiet at a 16-frame cadence; run steps are louder at 8;
  dash has one louder start cue. Combat and landing cues take priority in
  players' attention. This is an authored rhythm, not imported footstep audio.
- Pummels are short, quiet and higher-pitched; throw releases use a separate
  Blink sound. Preserve the existing star/screen KO body treatment, with
  Warcraft impact sounds and the fighters' original death cues.

Style questions raised by the mapping: should whole-screen shake replace the
small body vibration; should every contact have a louder flash; should footsteps
track each clip's exact planted foot; should top KOs become Warcraft explosions?
The adopted defaults above answer these with a steady camera, bounded sparks,
a shared footstep rhythm and retained top-KO bodies. Revisit only after an
observed readability problem; no separate approval is outstanding for them.

## Strong and weak hits (#389)

Tom's rule (9 Oct 2026): a move may split its hit into a strong hit and a
weak hit along two independent axes, decided per move.

- **Position (sweetspot and sourspot).** A separate strong region, usually
  live on every active frame, at the part of the weapon that is harder to
  space: a sword's tip, a hammer's head, a spear's point. Melee's Marth
  forward smash is the model: 20% at the tip against 14% on the blade.
- **Timing (clean and late).** Strength over the active window: strong on the
  first frames, weak while it lingers. Melee's sex kicks are the model: Fox's
  neutral air 12% clean against 9% late, Sheik's 14% against 9%; Captain
  Falcon's knee (forward air, 18% against 6%) and Zelda's kicks (forward and
  back air, 20% against 10%) are the extreme cases.
- Ultimate keeps all three: Marth's tipper, Captain Falcon's knee and Zelda's
  lightning kicks still split strong and weak, and the strong hit gets its own
  sound and a bigger spark, the feedback this rule copies.
- Rivals of Aether 2 keeps the same vocabulary of sweetspot, sourspot, early
  and late hitboxes in its frame data.

Each move is a table of hitbox region by active window, each cell with its own
damage and knockback; a move can use position only, timing only, both, or
neither. Defaults for legibility: a late window keeps any spatial split scaled
down, and strength falls over time. A uniform late hit or a stronger late hit
is a deliberate choice stated with its reason.

Which moves split: forward smashes and the fighter's key aerial or spacing
tool, and at least one signature move per fighter that matches its identity
(a blade's tip, a hammer's head, a kick that fades). Multi-hit moves keep their
link hits and launcher and are not strong/weak splits.

Gap: the weak hit deals 50% to 85% of the strong hit's damage. New splits use
70% damage and 85% of growth and base knockback for the weak hit and keep the
move's authored values for the strong hit, so kill percents of the strong hit
stay where they were. Falcon's 33% knee is outside this band on purpose: a
sourspot that harmless reads as a whiff.

The strong part is the harder one to land: a sweetspot lies farther from the
body than its sourspot (spacing), and clean frames never outlast late frames
(timing). smashcraft:ts/src/game/sim/strongHits.tests.ts checks every fighter
against these rules.

Feedback for whichever axis produced it: a strong hit adds 3 hitlag frames to
attacker and victim (the extra Forsaken Paladin's hammer head already had),
draws the contact spark at 1.75 times its size (above the 1.25 of the largest
ordinary spark, reusing the same pooled models so no effect is added), tints
it gold (`STRONG_SPARK_COLOUR`; size alone did not read on a single hit, since
the ordinary star is the same white-blue) and plays
the fighter's strong hit sound (the large-tier hit layered with its sweetener).
A weak hit keeps the ordinary spark, sound and hitlag.

Signature moves, with each move's regions, frames and damage in the generated
[move list](move-list.md):

| Fighter | Signature move | Axis |
| --- | --- | --- |
| Rifleman | Forward tilt (bayonet point) | Position |
| Illidan | Neutral air (glaive spin) | Timing |
| Blademaster | Forward smash (katana tip) | Position |
| Mountain King | Forward smash (hammer head) | Position |
| Warden | Forward smash (blade edge) | Position |
| Lich | Forward smash (staff tip) | Position |
| Forsaken Paladin | Forward smash (hammer head) | Position |
| Dreadlord | Back air (wing-claw) | Timing |
| Shadow Hunter | Forward tilt (spear point) | Position |
| Pit Lord | Forward smash (cleaver edge) | Position |
| Beastmaster | Forward smash (axe head) | Position |
| Lich King | Forward smash (Frostmourne's point) | Position |
| Thrall | Forward smash (Doomhammer impact) | Timing |
| Jaina | Neutral air (arcane burst) | Timing |
| Sylvanas | Forward smash (blade point) | Position |
| Cairne | Forward smash (totem head) | Position |
| Chen | Neutral air (flying kick) | Timing |
| Peon | Forward smash (pick point) | Position |
| Tinker | Forward smash (claw at full extension) | Position |
| Kael'thas | Forward smash (phoenix flame at the tip) | Position |
| Murloc | Neutral air (flailing spin) | Timing |
| Grom | Forward smash (Gorehowl's blade) | Position |
| Kobold | Forward smash (candle at the pick's end) | Position |
| Malfurion | Forward smash (Wrath at the staff's tip) | Position |
| Medivh | Neutral air (arcane ring) | Timing |
| Anub'arak | Forward smash (impaling claw) | Position |

## Legible locked states (#68)

No false agency asks that a fighter who can't get out knows it. The agency
analysis (smashcraft:docs/typescript.md, "Victim agency") sorts every frame
a fighter is under the other's control into three states.

- **Locked, nothing matters**: no input changes anything. Measured on 6
  October: a grab thrown at once (5 to 51 frames from the grab until the
  thrown fighter can act, longest for an up throw at 150%), the forced stand
  after a jab reset (15 frames), hitstun after a launch until the 20 frames
  before a tumble landing (up to about 100 frames after a smash attack at
  100%), and the Rifleman's freeze (299 frames).
- **Locked, only DI matters**: only the stick changes what happens: SDI
  pulses during hitlag, and DI on hitlag's last frame or on the frame a throw
  lets go. These are short: 1 frame in a throw, up to 9 in a smash attack's
  hitlag.
- **You can act**: a button changes what happens. That includes a press the
  buffer keeps for up to 6 frames and a tech press up to 20 frames before the
  landing, so the analysis says "can act" before the fighter visibly moves.

Prior art, described: traditional fighting games' combo counters count a hit
only while the opponent is still in hitstun, so the counter tells both
players whether the defender could have acted; Street Fighter 6's training
mode frame meter shows each frame of both characters as a coloured pip
(startup, active, recovery, hitstun, blockstun) ([EventHubs](https://www.eventhubs.com/news/2022/sep/16/sf6-training-visual-frame-data));
Super Smash Bros. Ultimate marks some states on the fighter itself: a
flashing red overlay and an orange halo while stunned after a shield break,
and in Training Mode a blue glow while intangible and green while invincible;
from Brawl on, a stunned fighter plays a recovery animation as its stun ends
([SmashWiki, stun](https://www.ssbwiki.com/Stun); [SmashWiki, Training Mode](https://www.ssbwiki.com/Training_Mode)).

Adopted 6 Oct 2026 under the owner's blanket authorization to carry out the
recommendations; these are delegated choices, not quoted owner answers:

- Mark the two locked states; "you can act" is the unmarked default.
- Use distinct fighter tints or outlines for "nothing matters" and "only DI".
  Both players see the same distinction. Choose the final colours during the
  visual implementation so they remain readable on every fighter.
- Remove the locked signal on the first frame an input can change the outcome,
  including a buffered button or a tech press before movement resumes.
- Show DI-only frames accurately, including the one-frame throw release;
  do not stretch the signal across frames where DI no longer changes anything.
- Compute the live signal with a cheap rule over current fighter state
  (hitlag, hitstun, grab, freeze, forced stand, buffer and tech eligibility).
  Validate it against the existing replay-based agency analysis before shipping.

Implementing and observing these signals is a separate follow-up to #68's
completed detector and design proposal. The analysis is the validation oracle,
not a thirty-input replay workload to run for every fighter during a match.

The Rifleman's trap can freeze a fighter again as each freeze ends (#84).
Throw-to-regrab chains are governed by the throw regrab rule above (#85).

## Legible hurtboxes

Delegated choices, 6 Oct 2026 (#97), under the owner's instruction that
correct play should win: spacing that is right by every visible cue must not
lose to a hurtbox the player could not see. The mechanisms behind Ultimate's
"played right, still lost" reports, and Melee's comparable cases, are in
[hurtbox legibility](design/hurtbox-legibility.md). Authoring is described in
smashcraft:docs/hurtboxes.md.

Historical fixture before #339: Two owner principles (6 Oct 2026) frame the rules: **attacking limbs can be
hit**, so counter-hitting an extended arm, leg or wing is always possible,
and **weapons are disjoint**: a held weapon (Blademaster's sword, Mountain
King's and Forsaken Paladin's hammers, Rifleman's gun) is never part of the
hurtbox, so striking the weapon does nothing while the hand and arm holding it
can be hit. Counter-hit the limb, not the sword.

1. **One body outside attacks.** Standing, idle, walking, dashing, running,
   jumping, falling and shielding all use the standing body; only crouch,
   attacks and specials author others. No idle pose, animation timing or
   random draw ever selects a body.
2. **Connected.** Every part of every body touches its first part (the torso)
   directly or through other parts: no floating hurt volumes.
3. **Held poses.** Every authored pose lasts at least 3 frames, and an
   attack's or special's poses do not overlap and end within the move. A
   gap between poses returns to the standing body, and counts as a change.
4. **Bounded steps.** One change of body (entering the move, pose to pose,
   returning to standing) moves the body's front, back, top or bottom extent by
   at most 60 world units (10 Melee units, about one standing body width plus
   a quarter). A longer reach ramps through intermediate poses.
5. **Attacking limbs can be hit** (owner decision, 6 Oct 2026): counter-hitting
   an extended limb is an important mechanic, and an unhittable limb breaks
   it. No attack or special pose authors an intangible or invincible part.
   Intangibility and invincibility belong only to explicit defensive states,
   whole-body and shown: dodges, ledge, techs, respawn, and a special's own
   intangible or armor window or a counter.
6. **Weapons are disjoint** (owner decision, 6 Oct 2026): no hurt part
   follows a weapon past the hand. Every part stays within a fully extended
   limb's reach of the fighter: horizontally within 0.7 of its standing
   height of its feet, vertically from a quarter of that height below its
   feet to 0.3 of it above its head. A wing or tail that reaches farther is a
   named departure.
7. **Touching is hitting.** Any overlap of a strike and a normal part,
   tangency included, is a hit: no glancing-blow or phantom band. A strike's
   tested volume is its authored capsule on that frame, never a chord swept
   from the previous frame.
8. **Judged on the shown frame.** A contact is resolved against the pose both
   fighters show on the contact frame, from the same pre-contact state for
   both; no zoom or slowdown replays the hit in a different pose.

Rules 1–7 are checked on every fighter's authored bodies, the original three
and each registered hero, by smashcraft:ts/src/game/sim/hurtboxLegibility.tests.ts. A fighter that needs
to break a rule lists a named departure there and in this section, with its
reason. Current departures:

- **Mountain King's down air (Double Boot), rule 6.** The boots are the
  strike, so the leg volume follows the whole downward strike, about 70 units
  below his feet, past a limb's reach. It is body, not weapon, and can be hit.
- **Chen's down air (downward boot), rule 6.** The boot is the strike, so
  the extended leg stays hittable through its full 71-unit downward reach.
  The staff remains disjoint.
- **Forsaken Paladin's back air (boot kick), rule 6.** The extended leg is the strike,
  about 0.78 of his height behind him, and stays hittable to its full length.
- **Dreadlord's wings and claws, rule 6** (down smash, forward smash, forward
  air, back air, down air). The roster keeps hurtboxes on attached body parts;
  the wings reach about 0.83 of his height sideways and the claws about half
  below his feet, all hittable.
- **Pit Lord's back air (Tail Lash), rule 6.** The tail is the strike and the
  roster lengthens his tail hurtbox with it, so the tail volume reaches about
  0.97 of his height behind him and stays hittable to its full length.
- **Thrall's low wolf strikes, rule 6** (forward tilt down, down tilt, down
  smash and down air). The mounted wolf's attacking paws reach 116 units
  sideways, about 0.764 of the standing height. Their measured body volumes
  stay hittable to the end of each paw; only Doomhammer is disjoint.
- **Anub'arak's side special (Burrow Hunt), rule 4.** He drops under the
  floor in one change and erupts in one change: while he travels only the low
  mound, about 22 units tall, is hittable. A halfway pose would show a body
  the burrow doesn't have.

## Aerials on shield

Owner direction, 6 Oct 2026 (#106): an aerial's safety on shield comes from
physics, timing and spacing, not a blanket rule. No move is safe by rule:
safety is earned by timing, spacing, mixups and the move's own properties, and
a slower, set-up-heavy move can be safer. Melee's derivation, with the knee and
drill worked through, is in
[the case study](design/melee/aerials-on-shield.md).

- **Timing.** A hit late in the fall, just before landing, leaves only the
  landing lag: the safest pressure. A hit at the top of the fall leaves the rest
  of the fall plus the landing lag. Fast falling shortens the fall.
- **Hit strength.** Strong hits deal much more shieldstun than weak ones.
  A weak hit high on the shield followed by a slow fall can be grabbed before
  the attacker lands.
- **Shieldstun and hitlag.** Both fighters take the hit's hitlag, so it moves
  no advantage; shieldstun, computed differently from hitstun, outlasts the
  remaining fall plus landing lag only for well-timed hits.
- **Out-of-shield options.** A buffered shield grab and a jump out of shield
  into an aerial, which for a fast fighter comes out about as soon as a grab.
- **Spacing and side.** Landing in front of the shield is the risk; landing
  out of shield-grab range or crossing up behind the shield is the answer, and
  mixing them is the skill.
- **Hitbox timing.** Early, lingering hitboxes cover space and chip the shield
  but concede frames; late, committed hits risk more and reward more.

**The aggression tilt.** Start from Melee's numbers and tilt slightly toward
the attacker, in Rivals 2's direction rather than Ultimate's. Implemented in
smashcraft:ts/src/game/sim/shield.ts (`AERIAL_SHIELD_STUN_MULTIPLIER`):

| Full-shield shieldstun, frames | 4 damage | 8 | 12 | 18 |
|---|---:|---:|---:|---:|
| Melee, every attack: ⌊(0.45 d + 2) × 200/201⌋ | 3 | 5 | 7 | 10 |
| Ultimate, aerials: ⌊0.264 d + 2⌋ | 3 | 4 | 5 | 6 |
| Rivals 2, every attack: 0.8 d + 1 | 4.2 | 7.4 | 10.6 | 15.4 |
| Smashcraft, aerials: ⌊(0.6 d + 2) × 200/201⌋ | 4 | 6 | 9 | 12 |

- Aerials' shieldstun per damage is Melee's × 4/3 (the shield's 1.5 stun
  multiplier becomes 2), on a full or a light shield. Hits up to 10
  damage gain at most one frame (1, 3 and 5 damage none), 11–18 damage two or
  three, stronger hits more. The tilt widens the gap between strong and weak hits as well as
  favouring the attacker.
- Everything else stays Melee's: ground attacks' shieldstun, hitlag on shield
  for both fighters (Ultimate's × 0.67 is not adopted: equal hitlag moves no
  advantage), pushback, attacker recoil, and the landing lag, which is the
  automatic L-cancelled lag (#54).
- Why the attacker needs it: Smashcraft's defender has a 6-frame attack
  buffer, so a shield grab pressed during shieldstun comes out on the first
  free frame. Melee has none (`ftCo_GuardSetOff_IASA` is empty and
  `ftCo_Catch_CheckInput` reads that frame's press), which made its shield grab
  a frame-perfect input. Rivals 2 answers the same problem by cutting the
  buffer to 2 frames after a shield contact; Smashcraft keeps the buffer, an
  aid with no decision in it, and pays the attacker in shieldstun instead.
- Shield release (#100, 11 frames) does not touch this: shield grab and jump
  out of shield bypass it. A parry (#102) takes no shieldstun at all, so the
  tilt never reaches it: a defender who reads the aerial's timing still gets
  the full reward.

The [interaction graph](design/interaction-graph.md) measures the spread for
each fighter (aerial on shield rows: advancing, early advancing, fade-back and
fade-forward, unspaced and spaced). smashcraft:ts/scripts/interactions.tests.ts
pins one safe and one punishable aerial per fighter.

## Powershield and parry

Delegated design, 6 Oct 2026 (#102), under the owner's direction that the
shield stays Smash's slowly shrinking bubble and a powershield becomes a true
parry with a clear reward; the owner added Street Fighter III: Third Strike's
parry strings and red parry the same day, and decided against an air parry.
Ultimate's and Rivals 2's parries are cited first and Melee's from the
decompilation in the deviations table above; Third Strike's rules are in
[fighting-game design language](design/fighting-games.md#parries-street-fighter-iii-third-strike).
The starting point is Ultimate's reward, any option with no shield-drop lag,
taken further to no shieldstun so the defender acts on the next frame, as the
owner asked. Rivals 2's stun on the parried attacker is not adopted: it pays
out automatically, which is what counter specials are for (below). The input
stays Melee's raise-timed press, so a parry is a read of the hit's timing.

1. **The shield.** The bubble drains while held, regenerates once lowered and
   shrinks with its health, as the Shields and defence rows above record.
2. **Parry timing.** A full shield press within 2 frames of the trigger first
   moving, while raising the shield, opens the parry: a melee hit in its first
   4 frames, or a projectile in its first 2 (which reflects, rule 1 of
   [Projectiles and powershield](#projectiles-and-powershield)), is parried.
   An unshielded fighter presses on the hit's frame or up to 3 frames before.
3. **The reward.** A parried hit does no shield damage and no shieldstun. Its
   freeze (hitlag) still plays, and on the freeze's last frame, the first the
   defender can act on, it can start any grounded option: jab, a tilt, a
   smash, shield grab, a jump into any aerial, either roll, a spot dodge, or
   simply drop the shield, all with no release lag. An option pressed during
   the freeze is buffered into that frame: an attack keeps its buffer through
   the freeze, a jump or ground dodge is held for it. A parried projectile
   gives the same reward from the next frame. The reward lasts while the
   shield stays held for 4 frames (Melee's `+0x2B8` counter); holding it
   longer spends it, and dropping the shield then costs the ordinary release
   lag.
4. **One press, one hit.** A press parries one hit or one projectile and its
   window closes. Each hit of a multi-hit move and each projectile of a stream
   needs its own timed press: drop the shield (free after a parry) and press
   again. An ordinary block anywhere in the string ends the reward and takes
   that hit's shieldstun, so parrying every hit gives the reward after the
   last one, as Third Strike's parried supers do.
5. **Red parry.** In shieldstun from an ordinary block, a fresh full press (let
   go of the shield and press it again; the shieldstun holds it up) parries the
   next hit if it lands on the hit's contact frame or the one before: a 2-frame
   window. Success clears the shieldstun and gives the same reward. One try
   per blocked hit: a second press in the same shieldstun does nothing, so
   mashing earns nothing. Why 2 frames: tighter than the parry's 4, as Third
   Strike's red parry is tighter than its parry, and at #69's lower bound for
   an optional powershield; 1 frame would be an unaided one-frame input,
   below every bound #69 accepts.
6. **Ground only.** There is no air parry (owner, 6 Oct): it would make every
   aerial approach a guess. Shields and parries are ground tools; airborne
   defence is the air dodge and a fighter's counter specials.

### Powershield, counter specials and guard specials

Melee keeps the universal powershield apart from per-character counters
(Marth's and Roy's Counter), and Smashcraft keeps that split, with a third
kind of defensive special beside the counters:

| | Universal powershield | Counter specials | Guard specials |
|---|---|---|---|
| Who | Every fighter, through the shared shield | Fighters whose kit authors one (none since Illidan's Parry Step became Fel Rush, #147) | Fighters whose kit authors one: Forsaken Paladin's Divine Shield (#96, #131) |
| Input | The ordinary shield press, timed | A special move | A special move |
| Commitment | None beyond the shield: a press that parries nothing is an ordinary shield | Startup, a counter window and recovery; a whiff is punishable | Startup, a guard window and recovery; a whiff is punishable, and grabs beat it |
| Reward | No shieldstun or release lag and next-frame action with the defender's own grounded option, which can still be the wrong choice | An automatic strike authored by the move, such as cancelling the attack and launching the attacker | A non-strike reward and no automatic strike: Divine Shield is intangible through its window, and a successful guard leaves him intangible to strikes and projectiles (not grabs) for 45 frames or until he attacks |
| Against strings | One press per hit; the red parry rejoins a string | The move's own window | The move's own window |

The powershield never strikes back on its own: the punish is the defender's
choice and execution. A counter is a committed read with an automatic strike
and a whiff punish. A guard special is a committed read whose payoff is
something other than a strike, such as healing, with the same whiff punish.
## Projectiles and powershield

Delegated choices, 6 Oct 2026 (#98), under the owner's direction that
projectiles create pressure without making play safe, spammy and boring, and
that a practised player can powershield on purpose. Ultimate's and Melee's
projectile properties are described in [projectiles](design/projectiles.md).

1. **Powershield reflects.** Raising the shield so its reflector is up when a
   traveling projectile arrives reflects it back at its shooter, at 0.7 speed
   and half damage, now owned by the reflector. The reflector is the whole
   shield bubble, up for the shield's first 2 frames, inside #69's accepted
   2–4; every projectile meeting it on such a frame, such as all arrows of
   one volley, reflects (#118). Every traveling
   projectile is reflectable; only persistent zones, puddles, markers and
   summons are not (the roster contract), and a held shield blocks those.
   A reflection is a parry: the defender acts from the next frame with no
   shieldstun or release lag, and each projectile of a stream needs its own
   press ([Powershield and parry](#powershield-and-parry)).
2. **Unsafe up close.** Fired point blank into a held shield, every
   projectile is punishable: some out-of-shield option of the defender lands
   before the shooter can act. At range a projectile may be safe by distance;
   rule 5 covers that.
3. **Few at once.** A fighter has at most 3 traveling projectiles and 2
   persistent objects out at once (the roster contract); a cast beyond the
   cap fails before spending mana.
4. **Short flights.** A traveling projectile lives at most 90 frames.
5. **A counterplay option in every projectile situation.** Against each
   projectile at every tested spacing, the defender has at least one option
   other than holding shield that avoids it: a powershield, a jump, a dodge
   or a roll. The interaction graph's projectile situations show which.
6. **Out-of-shield answers for every fighter.** Every fighter keeps shield
   grab, jump out of shield into any aerial, both rolls, spot dodge and the
   raise-timed powershield; no fighter trades one of them away.

smashcraft:ts/scripts/projectileRules.tests.ts measures every fighter's
projectiles, the original three and each registered hero's, through the
interaction graph's projectile situations (each special that makes a
projectile, fired at a mirror defender 60, 240 and 480 apart): the
powershield presses that reflect it (at least 2), the out-of-shield punishes
from point blank, the most out at once with the special pressed every other
frame, its flight, and the answers of a standing defender. Rule 6 is checked
from a held shield: each out-of-shield option must start. Rule 1 itself is
smashcraft:ts/scripts/powershieldReflect.tests.ts: each of those projectiles,
meeting the shield on its first frame, on the reflector's last frame and one
frame late, must reflect on the first two and not on the third (it prints the
table; a press that only parries does not count as a reflection). Swift
Arrow's visible draw and recovery (#172) leave it punishable by shield grab
at 60 units, and its repeat interval keeps at most two arrows in flight.

One move-specific projectile clash exists (#116). Illidan's Mana Burn orb
and any opposing traveling projectile it meets cancel each other. Other
projectiles pass through each other
([Mana Burn](design/roster.md#mana-burn-neutral-special)).

## Items (#196)

Owner direction, 7 Oct 2026: items are welcome when they are temporary,
balanced and predictable, so players fight over them instead of being swung by
luck. They are meant to be a defining competitive part of Smashcraft, the way
timed pickups are in Quake and the economy is in Counter-Strike.

### Precedent

**Arena-shooter item timing.** In Quake duels the strong pickups respawn on a
fixed timer after they are taken, so a player who knows when an item was taken
knows when it returns. In Quake Live armour returns 25 s and Mega Health 35 s
after pickup, and players practise counting them on the match clock
([lutro.me beginner guide](https://www.lutro.me/quake-live-beginner-guide));
in Quake Champions, Quad Damage first spawns 90 s into the match, returns
every 120 s and lasts 30 s
([Church of Quake](https://churchofquake.com/wiki/items/)).
Coaching material treats this as the core skill: "Controlling key items is the
fundamental skill of any arena shooter", denying the opponent "a fair fight"
([Dignitas](https://dignitas.gg/articles/blogs/Quake/11424/how-to-master-quake-spawn-timers-controlling-mega-and-armor)).
Because the timer is deterministic, an item is contestable: both players can
be there when it spawns, and arriving first, holding the approach or trading
the item for position are decisions, not luck. QuakeCon banned external
timers in 1v1 because timing by memory "is a highly valued skill in 1v1"
([The great timer debate](https://dondeq2.com/2017/05/26/the-great-timer-debate/)).
Quake Champions moved the other way and announces each powerup 15 s before
it spawns (Church of Quake, above), so the fight gathers at the spawn instead
of rewarding camping
([Steam discussion](https://steamcommunity.com/app/611500/discussions/0/1495615865209189281)).

**Counter-Strike economy.** Winning a round gives money and losing gives a
loss bonus that grows with consecutive losses ($1,400 up to $3,400 in CS2), a
catch-up rule that stops one side snowballing
([Refrag](https://refrag.gg/blog/cs2-economy-crash-course-what-are-kill-rewards-and-loss-bonus),
[csdb.gg](https://csdb.gg/economy-guide)). Players accept it as skill because
every consequence follows a published rule from visible events: a team can
deduce what its opponent can afford and choose to save, force or counter-buy.
Smashcraft borrows the shape: a buff is earned by controlling the centre at a
known time, ends on a knockout, and when and what arrives is public.

**Why competitive Smash bans items.** Items were contested in early Melee
tournaments; the community settled on items off "due to the element of
randomness", especially unpredictable spawns of explosives such as Bob-ombs
and Capsules ([SmashWiki: SSBM rulesets](https://ssbwiki.com/Tournament_rulesets_(SSBM))).
Containers have a one-in-eight chance to explode instead of releasing an item
([SmashWiki: Items](https://www.ssbwiki.com/Items),
[Capsule](https://ssbwiki.com/Capsule)). The Ultimate standard ruleset keeps
items off because random items like Smash Balls and Poké Balls can make the
better player lose to luck
([esports.net](https://www.esports.net/news/super-smash-bros/ultimate-tournament-rules/),
[SmashWiki: rulesets](https://ssbwiki.com/Ruleset)); Project M events ran
items off too. Rivals of Aether has no item pool; its small team folded
item-like effects into fighters' moves instead
([Game Developer](https://gamedeveloper.com/design/a-i-super-smash-bros-i--inspired-design-designed-backwards)).
No source found shows a mainstream ruleset that legalised individual items;
the community objection is to random spawns, random places and swingy power,
which are exactly what Smashcraft removes. Pro-item players argued items
"required skill and did not reduce the depth of the game" (SmashWiki, above).

**Bunny Hood and Metal Box in Melee.** They change how a fighter moves rather
than dealing damage, which is why they are the model. Melee's Bunny Hood makes
a fighter quicker, jump much higher (midair jumps included) and fall faster,
for about 12 s, and a strong hit can knock it off; SmashWiki gives no Melee
multipliers, while Ultimate's are 2x walk, run and jump and 1.5x fall speed and
gravity ([SmashWiki: Bunny Hood](https://www.ssbwiki.com/Bunny_Hood)).
Melee's Metal Box lasts 12 s, shortened by damage taken, and sets weight 3.0x,
fall speed and gravity 2.0x, jump force 1.55x and walk speed 0.7x, and
subtracts 30 units from all knockback, so weak hits cause no flinch
([SmashWiki: Metal Box](https://www.ssbwiki.com/Metal_Box)). Those values
were tuned for casual random play; Smashcraft guarantees an item every 30–60 s
in its standard ruleset, so its buffs keep the same shapes at a fraction of
the size, with no flinch immunity, and last at most 10 s.

### Rules

Tom decided, 7 Oct:

- Items always appear at centre stage.
- Each item arrives a seeded, deterministic 30–60 s after the previous one,
  never less than 30 s apart, identical in replays and on every client.
- A visible and audible 10 s warning plays at the spawn point before each
  item.
- Items are on in the standard ruleset; a match setting turns them off and
  picks which items are enabled.
- Every effect lasts at most 10 s. The items are Speed, Extra Jump and Heavy.

Tom decided, 7 Oct (delegated):

- The first item arrives 30–60 s after GO. Intervals are whole seconds drawn
  from the match seed and the draw count.
- The warning names the coming item and counts down 10 to 1 at the centre,
  with a sound when it starts and when the item appears, so both players can
  decide whether to contest it: public information, as in Counter-Strike.
- When an item appears, the match HUD shows when the next one arrives ("Next
  item 0:42"). A seeded interval cannot be counted from memory like Quake's
  fixed timers, so the skill is positioning and centre control around a known
  time rather than bookkeeping.
- An untaken item stays at the centre until taken and is replaced when the
  next one arrives.
- Pickup is touching the item and pressing attack or grab, grounded or
  airborne, on a frame where that attack could start. The press is spent on
  the pickup.
- A fighter holds one buff at a time; a new pickup replaces the old one. A
  knockout ends it. Every buff lasts 10 s (600 frames).
- Items appear in matches and practice when enabled, never in training.
  Computer players do not chase items yet.

Effects, Tom decided, 7 Oct (delegated), scaled down from the Melee shapes
above:

- **Speed** (Bunny Hood): walk, dash, run and air-drift top speeds x1.3; jump
  launch speeds x1.1, about x1.2 jump height.
- **Extra Jump:** one additional midair jump while it runs; one midair jump is
  granted immediately on pickup.
- **Heavy** (Metal Box): weight x1.5 against knockback; gravity and fall speed
  x1.3; nothing else changes.

## The corner belongs to the attacker (#386)

Owner direction, 9 Oct: in Melee the ledge was built so some fighters are
stronger there than on stage, and running away carried no penalty. Smashcraft
makes the edge a place the attacker wants to put the opponent. Being near it or
off the stage is dangerous; the attacker has options at the edge that the
centre does not offer.

### Edge cancels

An aerial's landing lag, or a ground move's end lag, ends on the frame the
fighter slides off the surface. It applies to the stage edge and to the ends of
platforms alike, and covers every landing lag (aerial, air dodge, special).

| | Melee | Ultimate | Smashcraft |
| --- | --- | --- | --- |
| Landing lag when sliding off an edge | Cancelled for any landing; the fighter enters fall with no lag ([SmashWiki](https://ssbwiki.com/Edge_cancel)) | Restricted to specific actions; Smash 4 allowed it only on an air dodge facing the ledge | Cancelled for every landing lag, on the first airborne frame |
| End lag of a ground move | Cancelled for specials used at the lip ([SmashWiki](https://ssbwiki.com/Edge_cancel)) | Not sourced | Cancelled once the move's active frames are over; startup and active frames are kept |

Frames: the cancel takes effect on the frame the fighter leaves the surface, so
a fighter that lands with 7 frames of lag one frame from the lip is actionable
in the air on the next frame. A move still in startup or its active frames is
not cancelled; a hit, knockdown, grab or shield takes precedence over it.
L-cancelling stays removed, so the cancel is the only way to shorten landing
lag and it is a position decision, not an input chore.

The attacker's options out of the cancel, each deterministic and visible on the
tapes `edge-cancel-turnaround` and `edge-cancel-back-air`:

- Overshoot: an aerial landed with momentum toward the edge carries the fighter
  off. A defender who shields the aerial sees the attacker disappear from the
  stage with no lag.
- Turnaround: a fighter that jumped back (facing the stage, drifting toward the
  edge) lands, cancels and, still facing the stage, catches the ledge.
- Back air: the freed fighter attacks backward at once, so a back air can
  follow a shielded aerial and carry the attacker back toward the centre.

### Corner pressure

Shield pushback stays Melee's damage-only formula (owner decision, 9 Oct);
momentum-scaled pushback is not adopted. What changes is the edge. A fighter that
is shielding, in shieldstun or being pushed when it leaves the surface drops its
shield, loses the pushback and enters a helpless fall (`special.fall`), which
ends only on a ledge catch, a landing or a hit. Rolling or full-hopping out of the
corner stays available beforehand, readable and punishable. Tape
`shield-slide-off` shows repeated hits carrying a shielding fighter off.

### Ledge intangibility decay

Catching the ledge grants 30 frames of intangibility on the first grab. Each
further grab without touching the stage removes 8 frames (30, 22, 14, 6, then
none), and touching the stage restores the full value: the mount frame of a
getup, a landing, a respawn. The regrab lock of 30 frames is unchanged, and
intangibility still ends when the fighter lets go.

| Game | Rule |
| --- | --- |
| Melee | Full intangibility on every grab, with a 30-frame regrab lock; the ledge could be chained indefinitely |
| Ultimate | Consecutive grabs reduce intangibility in each getup option (for example 26, 21 and 13 frames of one fighter's getup attack) and none from the fourth ([SmashWiki](https://www.ssbwiki.com/Lucario_(SSBU)/Edge_getups)) |
| Rivals of Aether 2 | About 29 frames of ledge intangibility, lost on becoming actionable or on the ledge jump; community-reported, not official ([Steam thread](https://steamcommunity.com/app/2217000/discussions/0/601898462569583345)) |
| Smashcraft | 30 minus 8 per regrab since the stage was last touched, never below 0 |

The decay step is a first value, chosen to reach none on the fifth grab, and is
tuned from playtests; the first-grab 30 stays inside the #69 bound of 30 to 37.
The ledge commitment lock, the computer's use of these options and the seeded win
rate measurements are tracked in #386's remaining boxes.

### Ledge hang limit (#411)

A fighter who hangs on the ledge for 300 frames (5 seconds) lets go and falls,
as if it had pressed away: the same drop as the away getup, with the ledge
regrab lock and the decayed intangibility of the next catch unchanged. Without
a limit an idle hanger, or a fighter ahead on stocks or percent, could stall
the clock on the ledge; the playtest in #407 found an idle fighter hung
there for the full 3,600 frames. The limit is a first value for the owner to
tune; it is long enough to read and pick any getup.

Prior art: Melee, Smash 4 and Ultimate all end a long hang by time, and
SmashWiki's Ledge page lists the limits (Ultimate's is shorter than Melee's
and falls with damage). I could not fetch that page from the build
environment, so the 300 frames is chosen here and not copied from it; check
the page's figures before treating the number as sourced.

The Expert computer contests a hanger. It stands 60 units inside the deck edge
facing the ledge, and when the hanger's getup (climb or attack) begins it
throws a forward tilt that is active as the climber stands up. Ground moves do
not reach a fighter hanging 90 units below the deck, so the trap covers the
getup and the hang limit ends a hanger who never moves. Test: the Expert
computer hits a climber within 45 frames of the getup press (input delay 4,
climb 25, tilt startup and travel about 16).

## Meter drops (#385)

Owner direction, 9 Oct 2026: in a game with meter, meter is advantage, so give
it a place on the stage. Meter energy appears at known stage points with a
short telegraph, so players fight over a space instead of stalling; a player
who runs away cedes the drop. It replaces a stalling penalty, adds no second
meter and is not an item.

### Precedent

**MOBA runes and objectives.** Dota 2's power runes first spawn at 6:00 and
then every 2 minutes at one of two river rune spots; an untaken rune
disappears when the next one spawns
([Liquipedia: Runes](https://liquipedia.net/dota2/Runes),
[Hotspawn](https://www.hotspawn.com/?p=147428)). League of Legends' dragon
spawns at 5:00 and 5:00 after each kill, in a fixed pit, and the next
dragon's type is shown on the timer and the pit wall before it appears
([League wiki: Dragon pit](https://wiki.leagueoflegends.com/en-us/Dragon_pit_(League_of_Legends))).
Both put a timed resource at a learnable place, so the map's fights gather
there on a known clock; the criticism of both is the random part (which river
spot, which dragon element;
[Team Liquid forum](https://tl.net/forum/league-of-legends/509598-the-rng-dragon-problem)).

**Platform-fighter pickups.** Competitive Smash keeps items off because their
spawns, places and effects are random ([Items](#items-196), above).
Brawlhalla, whose ranked play keeps weapon pickups on, spawns its first
pickup at the centre of the stage and later ones in fixed spawn zones whose
order is shuffled per match
([Brawlhalla wiki: Item Spawning](https://brawlhalla.wiki.gg/wiki/Item_Spawning)).
Rivals of Aether 2 has neither items nor meter, so it offers no precedent
here.

Smashcraft keeps the timing and the place public and removes the random
parts: the schedule comes from the match seed, the place from a fixed
rotation, and the effect is always one EX segment.

### Rules

Tom decided, 9 Oct (delegated in #385):

- **Telegraph.** A blue marker (Mass Teleport's arrival column) grows and
  pulses at the point for 3 s (180 frames) before the orb appears, which is a
  blue Frost Wyrm missile at scale 0.8, about 60 px wide at 640x360 on the near
  match camera. Classic Wisp frames, effects alone: marker 0.8%, orb 1.1% of
  the screen, under #380's 4%; the marker hides when the orb appears. A
  sound plays at the point when the telegraph starts, when the orb appears and when it is taken.
- **Schedule.** The first drop appears 15 s after GO. Each later drop appears
  a seeded 10–18 s (whole seconds from the match seed and the draw count) after
  the previous one is taken. An untaken orb stays until someone touches it.
- **Points.** The first drop is at the centre of the main deck. Later drops
  rotate through the stage's fixed points in a fixed order (centre, then each
  static platform centred within 150 units of the stage centre, in deck
  order), starting from a seeded offset, so the points are learnable but the
  next one is not always the same. Side and moving platforms hold no point: a
  side point let one fighter take the drop near a ledge while the other stayed
  at the far edge, which raised the time fighters spent apart in the computer
  field; a fighter on the centre line is never more than half a stage from an
  opponent on the main deck. Each stage's points are listed in
  [stages](design/stages.md#meter-drop-points).
- **Amount.** Touching the orb (the body within 48 units sideways, from
  60 units above the point down to the fighter's height below it) grants
  one EX segment, 33 mana (`ROSTER_MANA.exCost`), to the nearest touching
  fighter, capped at full. A full fighter still takes the orb and denies it.
- **Rule.** Drops are on in the standard ruleset; the Drops button on the
  stage menu (or `-dev drops on|off`) turns them off. They never appear in
  training or in Classic and lore runs.
- **Computers** contest a drop after their reaction delay from the start of
  the telegraph, choosing per drop at their judgment: Expert contests every
  drop, Rookie about one in three (smashcraft:ts/src/game/match/cpuSkill.ts,
  `contestTenths`). While the opponent is off the main deck they keep chasing
  it instead. `bun scripts/meterDropField.ts` from ts/ plays a seeded field
  with drops off and on and prints the share of frames the fighters spend more
  than half a stage apart, each fighter's win rate and the win-rate spread
  (max minus min). `--camp` makes the fighter ahead on stocks retreat to the far
  side of the stage and wait (measurement only, not default play); `--shard K/N`
  with `--json` and `--merge` splits the field across cores.

The drop state (schedule, point, serials, last taker) is part of the match
snapshot, its checksum and its replay
(smashcraft:ts/src/game/match/meterDrops.ts).

## Recovery and edgeguarding

[spec #252] Each fighter has a recovery archetype with a distinct strength and
edgeguarding weakness. These bands adapt the relations in the
[Melee recovery reference](design/melee/recovery.md) to Smashcraft's larger
bodies; they are authored gameplay targets. The physics scale remains
6 world units per Melee unit.

Tom decided, 7 Oct (delegated in #189): guided up specials answer held input
during travel. Charged-angle up specials choose one of eight directions during
startup, then commit; Rifleman charges four frames, the others eight. Neutral
aim launches upward. An up special spends the aerial jump and ends helpless.

| Archetype | Fighters | Up-special rise | Up-special reach | Envelope height minimum | Envelope reach minimum |
|---|---|---:|---:|---:|---:|
| Long, committed route | Rifleman, Blademaster, Tinker, Kael'thas | 480–640 | 480–900 | 780 | 920 |
| Vertical, route mixups | Warden, Lich, Shadow Hunter, Thrall, Jaina, Chen | 400–560 | 320–600 | 700 | 840 |
| Drifting, wide approach | Illidan, Dreadlord, Beastmaster, Sylvanas | 380–520 | 600–900 | 680 | 920 |
| Heavy, exposed approach | Mountain King, Forsaken Paladin, Pit Lord, Lich King, Cairne, Peon, Murloc | 320–440 | 320–480 | 620 | 740 |

[spec #252] With empty mana, an up special reaches at least 240 units on each
axis, and the full recovery envelope reaches at least 500 units deep and 640
units out. Original fighters spend no mana. The up-special bands describe the
best route, including Illidan's glide jump; every aim need not reach both limits.

An envelope measures recovery from rest with one aerial jump, combining the
jump, air dodge, side special and up special through 21 timing/aim plans. Its
height starts 120 units outside the right ledge; its reach starts 150 units
below it. A catch or landing counts as recovery. Searches resolve to 8 units
and stop at 820 deep or 940 out, just inside the blast zones. Values at either
limit mean the fighter recovers from that tested start.

[spec #252] A running up special moving level or up into a solid wall turns
the travel stopped by that wall upward along it. The wall ride spends the same
move and grants no new jump or special. A descending up special may catch a
free ledge while still running, ending the move there. Holding down declines
the normal catch; facing, the catch box, regrab lock and occupied ledges still
apply. Heroes taller than the reference body use Fox's ledge box scaled by
body height; shorter bodies retain the reference box.

[spec #252] Warden's and Jaina's Blink may pass a main-deck edge when the path
enters within 0.5 body-reference heights (66 units) below the deck. Ending
above the deck keeps that endpoint. Ending inside this lip within 66 units of
a free ledge catches it; farther in, the fighter lands above its endpoint.
An occupied ledge or regrab lock leaves the fighter just outside the lip.
A path entering deeper than the lip stops against the solid stage.

The before/after record below is the full-mana envelope (height / reach, world
units) from the recorded main baseline and recovery branch `28c15a07` in
[evidence/recovery-envelope-20261008](../evidence/recovery-envelope-20261008/).
The branch's up-special and empty-mana measurements are kept there too.

| Fighter | Before height / reach | After height / reach |
|---|---:|---:|
| Rifleman | 685 / 940 | 820 / 940 |
| Illidan | 762 / 940 | 762 / 940 |
| Blademaster | 660 / 793 | 820 / 940 |
| Mountain King | 692 / 749 | 692 / 749 |
| Warden | 609 / 786 | 730 / 903 |
| Lich | 628 / 793 | 801 / 889 |
| Forsaken Paladin | 352 / 764 | 647 / 764 |
| Dreadlord | 609 / 903 | 685 / 940 |
| Shadow Hunter | 673 / 808 | 762 / 903 |
| Pit Lord | 615 / 749 | 634 / 786 |
| Beastmaster | 621 / 764 | 743 / 940 |
| Lich King | 609 / 778 | 685 / 800 |
| Thrall | 602 / 793 | 820 / 867 |
| Jaina Proudmoore | 634 / 749 | 724 / 845 |
| Sylvanas Windrunner | 609 / 771 | 698 / 940 |
| Cairne Bloodhoof | 583 / 764 | 647 / 808 |
| Chen Stormstout | 583 / 815 | 820 / 918 |
| Peon | 621 / 793 | 653 / 793 |
| Goblin Tinker | 647 / 830 | 820 / 940 |
| Kael'thas Sunstrider | 621 / 889 | 794 / 940 |

`GAME_TESTS=upSpecialRecovery bun test test/game.test.ts` measures each
selectable fighter's up-special route from (700, 300), facing away from the
stage with jumps spent: vertical holds up; horizontal takes the best of level,
diagonal-up and a glide jump at frame 20 while within 10 units below the start.
The same tests check charged angles and guided steering through keyboard and
controller input. `GAME_TESTS=edgeRecovery bun test test/game.test.ts` checks
wall rides, Blink lip outcomes and descending up-special catches. The farm
sweeps check every fighter's envelope and all eight aims against the stage.

### Edge-guarding and gimps (#387)

Delegated by Tom, 9 Oct (#387), within Melee precedent. Prior art:
Melee's edge-guard lives on gimps, edgehogging and the two-frame ledge
window, and every recovery there has a hittable startup or travel and a
helpless end. Ultimate swaps edgehogging for trumping and decays ledge
intangibility on regrabs. Rivals 1 removed ledges for one wall jump per
airtime, and Rivals 2 brought them back. The sources are in
[platform fighters](design/platform-fighters.md) and
[modern platform fighters §9](design/modern-platform-fighters.md#9-ledge-rules-edgehogging-ledge-trumping-ledge-decay).
Smashcraft keeps Melee's exclusive ledge with its 30-frame catch
intangibility ([Movement, recovery and resources](#movement-recovery-and-resources)).
So there is no two-frame punish here; its role goes to the up special's
hittable travel and helpless end.

[spec #387] Recovery and edge-guard rules:

- Every up special has a vulnerable window. Startup and travel are hittable
  except the intangible frames the table lists, and it ends helpless. From
  the predictable start below, it leaves at least one run of 15 hittable
  frames before the fighter can act again, which is #69's one-option
  reaction floor. An up special that no listed option beats is flagged and
  fixed with longer startup, fewer intangible frames, less speed or a fixed
  route.
- A recovering fighter has real options: route (aim or steering), timing
  (when to spend the up special), drift (toward, holding or away) and
  destination (ledge or deck). The edge-guarder has real tools: every
  fighter has an offstage aerial that kills its own predictable recovery at
  40%. The move list names it under "Edge-guard tool". Reaction aerials, and
  projectiles against routes at 30 units a frame or slower, beat recoveries
  as the table lists.
- Low-percent kills are possible offstage. A predictable recovery is one
  that starts 200 units out and 100 below the ledge at 40%, with no jumps,
  drifts in for 12 frames and then aims its up special up and in. Every
  fighter's predictable recovery returns unguarded and is killed by a
  recorded down air or forward air from its own mirror.
- A well-mixed recovery mixes its up-special timing (2, 8 or 14 frames) and
  its drift (in, hold or away). It must return at least half the time against
  each fighter of the Wren Expert field, standing at the ledge, over the
  eight seeded plans.

No up special is flagged. Every one has a recorded read kill and a reaction
opening of at least 31 frames, so none was changed. Recoil Shot keeps its
frames 4–10 intangibility from #127. Its opening comes after the
intangibility and before the second shot.

The table below is the recovery table, generated by `bun scripts/recoveryTable.ts`
from ts/. Startup counts the frames from the press to the first rise.
Intangible counts frames during the move. Top speed is in units a frame.
Rise / reach is the full-mana up-special route. Opening is the longest run
of hittable frames from the press until the fighter can act. Mixed returns
counts the well-mixed plans that returned against the 26-fighter Wren
Expert field.

| Fighter | Up special | Startup | Intangible | Top speed | Rise / reach | Route control | Opening | Beaten by | Mixed returns |
|---|---|---:|---:|---:|---:|---|---:|---|---:|
| Rifleman | Recoil Shot | 4 | 8 | 34 | 523 / 870 | aimed (8-way, 4 frames), second shot re-aims | 31 | read down air (offstage launch, KO at 40%), reaction aerial | 208/208 |
| Illidan | Wing Ascent | 1 | 4 | 29 | 435 / 864 | guided, glide branch | 49 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 182/208 |
| Blademaster | Rising Whirlwind | 9 | 0 | 55 | 540 / 544 | aimed (8-way, 8 frames) | 47 | read down air (spike, KO at 40%), reaction aerial | 208/208 |
| Mountain King | Thunder Leap | 9 | 0 | 32 | 355 / 359 | aimed (8-way, 8 frames) | 41 | read down air (offstage launch, KO at 40%), reaction aerial | 207/208 |
| Warden | Blink | 9 | 4 | 462 (teleport) | 461 / 465 | aimed (8-way, 8 frames) | 37 | read down air (spike, KO at 40%), reaction aerial | 205/208 |
| Lich | Spectral Ascent | 10 | 0 | 20 | 522 / 439 | guided | 72 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 196/208 |
| Forsaken Paladin | Ascension | 8 | 0 | 30 | 333 / 362 | guided | 42 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 208/208 |
| Dreadlord | Bat Ascension | 9 | 0 | 35 | 389 / 681 | guided | 61 | read down air (offstage launch, KO at 40%), reaction aerial | 202/208 |
| Shadow Hunter | Loa Vault | 9 | 0 | 41 | 467 / 471 | aimed (8-way, 8 frames) | 46 | read down air (spike, KO at 40%), reaction aerial | 208/208 |
| Pit Lord | Abyssal Leap | 13 | 0 | 43 | 339 / 377 | guided | 48 | read down air (offstage launch, KO at 40%), reaction aerial | 197/208 |
| Beastmaster | Summon Hawk | 10 | 0 | 68 | 399 / 674 | guided | 55 | read down air (offstage launch, KO at 40%), reaction aerial | 199/208 |
| Lich King | Ascension of the Damned | 8 | 0 | 22 | 386 / 380 | guided | 60 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 192/208 |
| Thrall | Far Sight | 9 | 0 | 19 | 505 / 471 | guided | 73 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 207/208 |
| Jaina Proudmoore | Blink | 14 | 5 | 422 (teleport) | 421 / 425 | aimed (8-way, 13 frames) | 32 | read forward air (offstage launch, KO at 40%), reaction aerial | 204/208 |
| Sylvanas Windrunner | Banshee Flight | 8 | 0 | 29 | 395 / 802 | guided | 65 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 208/208 |
| Cairne Bloodhoof | Spirit Lift | 11 | 0 | 22 | 359 / 345 | guided | 56 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 202/208 |
| Chen Stormstout | Storm Rise | 8 | 0 | 19 | 503 / 461 | guided | 71 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 205/208 |
| Peon | Worksite Launch | 8 | 0 | 22 | 355 / 358 | guided | 55 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 205/208 |
| Goblin Tinker | Rocket Boots | 7 | 0 | 19 | 521 / 501 | guided | 72 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 205/208 |
| Kael'thas Sunstrider | Phoenix Flight | 11 | 0 | 28 | 534 / 722 | aimed (8-way, 10 frames) | 62 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 205/208 |
| Murloc | Tide Spout | 6 | 0 | 18 | 435 / 400 | guided | 62 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 204/208 |
| Grom Hellscream | Blood Leap | 7 | 0 | 27 | 383 / 334 | guided | 45 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 204/208 |
| Kobold | Candle Escape | 6 | 0 | 18 | 404 / 350 | guided | 59 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 198/208 |
| Malfurion Stormrage | Dream Ascent | 10 | 0 | 27 | 426 / 400 | guided | 60 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 205/208 |
| Medivh | Raven Flight | 9 | 0 | 21 | 373 / 460 | aimed (8-way, 8 frames) | 51 | read down air (offstage launch, KO at 40%), reaction aerial, projectile | 203/208 |
| Anub'arak | Crypt Eruption | 9 | 0 | 20 | 399 / 403 | aimed (8-way, 8 frames) | 54 | read forward air (offstage launch, KO at 40%), reaction aerial, projectile | 198/208 |

`GAME_TESTS=edgeGuard bun test test/game.test.ts` checks Rifleman's recorded
gimp and Recoil Shot opening, plus Thrall's and Warden's mixed plans. The
sweeps check every fighter's recorded gimp, its up-special opening and its
mixed-return rate. Open: the computer does not yet edge-guard differently at
higher skill levels. Across the seven fighters sampled, Wren Expert and
Intermediate killed 0 to 3 of 26 predictable recoveries per fighter. A reactive guard loses to its
observation delay, so the computer side needs a read-based design. Its
45–55% win-rate check belongs to that change.
